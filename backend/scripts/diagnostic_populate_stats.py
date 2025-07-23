#!/usr/bin/env python3
"""
FIXED DIAGNOSTIC MLB Stats Populator
Handles data type mismatches and shows exactly what's failing
"""

import boto3
import json
import requests
from datetime import datetime
import time

# Database configuration
DATABASE_CONFIG = {
    'resourceArn': 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball',
    'secretArn': 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-db-credentials-MoEtfC',
    'database': 'postgres'
}

def execute_sql(sql, parameters=None):
    """Execute SQL using RDS Data API"""
    rds_client = boto3.client('rds-data', region_name='us-east-1')
    
    try:
        params = {
            'resourceArn': DATABASE_CONFIG['resourceArn'],
            'secretArn': DATABASE_CONFIG['secretArn'],
            'database': DATABASE_CONFIG['database'],
            'sql': sql
        }
        
        if parameters:
            params['parameters'] = parameters
            
        response = rds_client.execute_statement(**params)
        return response
        
    except Exception as e:
        print(f"Database error: {str(e)}")
        raise

def test_mlb_api_call(mlb_id):
    """Test a single MLB API call and show detailed response"""
    try:
        # Convert mlb_id to string if it isn't already
        mlb_id_str = str(mlb_id).strip()
        
        # Skip if empty or invalid
        if not mlb_id_str or mlb_id_str in ['0', 'None', 'null', '']:
            print(f"    ❌ Invalid MLB ID: '{mlb_id_str}'")
            return None
        
        url = f"https://statsapi.mlb.com/api/v1/people/{mlb_id_str}/stats"
        params = {
            'stats': 'season',
            'season': '2025'
        }
        
        print(f"    🔍 Testing API call: {url}")
        print(f"    📊 Parameters: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        
        print(f"    📡 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"    ✅ Response received: {len(str(data))} characters")
            print(f"    📋 Response structure: {list(data.keys()) if data else 'Empty'}")
            
            if 'stats' in data:
                print(f"    📊 Stats groups: {len(data['stats'])}")
                for i, stat_group in enumerate(data['stats']):
                    group_name = stat_group.get('group', {}).get('displayName', 'Unknown')
                    splits = stat_group.get('splits', [])
                    print(f"      Group {i}: {group_name} ({len(splits)} splits)")
                    
                    if splits:
                        first_split = splits[0]
                        stat = first_split.get('stat', {})
                        print(f"        Sample stats keys: {list(stat.keys())[:10]}")
            
            return data
        else:
            print(f"    ❌ API Error: {response.status_code}")
            print(f"    📄 Response text: {response.text[:200]}")
            return None
            
    except Exception as e:
        print(f"    ❌ Exception: {e}")
        return None

def check_data_types():
    """Check the data types of key columns"""
    print("🔍 Checking database column types...")
    
    sql = """
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'mlb_players' 
    AND column_name IN ('player_id', 'mlb_id', 'first_name', 'last_name')
    ORDER BY column_name
    """
    
    response = execute_sql(sql)
    
    if response.get('records'):
        print("📋 Column types in mlb_players:")
        for record in response['records']:
            col_name = record[0].get('stringValue', '')
            data_type = record[1].get('stringValue', '')
            nullable = record[2].get('stringValue', '')
            print(f"  • {col_name}: {data_type} (nullable: {nullable})")

def diagnose_players():
    """Diagnose the first 10 players to see what's failing"""
    print("\n🔍 DIAGNOSTIC MODE: Testing first 10 players...")
    print("=" * 60)
    
    # Get first 10 players - handle different data types
    sql = """
    SELECT player_id, mlb_id, first_name, last_name, position 
    FROM mlb_players 
    WHERE is_active = true
    ORDER BY last_name, first_name
    LIMIT 10
    """
    
    response = execute_sql(sql)
    
    players = []
    for record in response.get('records', []):
        # Handle different data types safely
        player_id = None
        mlb_id = None
        
        # Player ID (could be long or string)
        if record[0].get('longValue') is not None:
            player_id = record[0]['longValue']
        elif record[0].get('stringValue'):
            try:
                player_id = int(record[0]['stringValue'])
            except:
                player_id = record[0]['stringValue']
        
        # MLB ID (could be long or string)
        if record[1].get('longValue') is not None:
            mlb_id = record[1]['longValue']
        elif record[1].get('stringValue'):
            mlb_id = record[1]['stringValue']
        elif record[1].get('isNull'):
            mlb_id = None
        
        players.append({
            'player_id': player_id,
            'mlb_id': mlb_id,
            'first_name': record[2].get('stringValue', '') if record[2] else '',
            'last_name': record[3].get('stringValue', '') if record[3] else '',
            'position': record[4].get('stringValue', '') if record[4] else ''
        })
    
    success_count = 0
    error_count = 0
    error_types = {}
    
    for i, player in enumerate(players):
        print(f"\n[{i+1}/10] {player['first_name']} {player['last_name']} ({player['position']})")
        print(f"  Player ID: {player['player_id']} (type: {type(player['player_id'])})")
        print(f"  MLB ID: {player['mlb_id']} (type: {type(player['mlb_id'])})")
        
        # Check if MLB ID exists and is valid
        if not player['mlb_id'] or str(player['mlb_id']).strip() in ['0', 'None', 'null', '']:
            print(f"  ❌ ERROR: No valid MLB ID")
            error_count += 1
            error_types['no_mlb_id'] = error_types.get('no_mlb_id', 0) + 1
            continue
        
        # Test API call
        api_data = test_mlb_api_call(player['mlb_id'])
        
        if api_data:
            success_count += 1
            print(f"  ✅ SUCCESS: API call worked")
        else:
            error_count += 1
            error_types['api_failed'] = error_types.get('api_failed', 0) + 1
        
        # Small delay
        time.sleep(1)
    
    print("\n" + "=" * 60)
    print("🔍 DIAGNOSTIC SUMMARY:")
    print(f"✅ Successful: {success_count}")
    print(f"❌ Failed: {error_count}")
    print(f"📊 Error breakdown: {error_types}")
    
    return success_count, error_count, error_types

def check_existing_stats():
    """Check what stats we currently have"""
    print("\n🔍 Checking existing stats in database...")
    
    # Count players with stats
    sql = "SELECT COUNT(DISTINCT player_id) as players_with_stats FROM player_stats WHERE season_year = 2025"
    response = execute_sql(sql)
    
    if response.get('records'):
        count = response['records'][0][0].get('longValue', 0)
        print(f"📊 Players with 2025 stats: {count}")
    
    # Check sample of players with stats
    sql = """
    SELECT p.first_name, p.last_name, p.position, COUNT(s.stat_id) as stat_records
    FROM mlb_players p
    JOIN player_stats s ON p.player_id = s.player_id
    WHERE s.season_year = 2025
    GROUP BY p.player_id, p.first_name, p.last_name, p.position
    ORDER BY stat_records DESC
    LIMIT 5
    """
    
    response = execute_sql(sql)
    
    if response.get('records'):
        print("📋 Top players with most stat records:")
        for record in response['records']:
            name = f"{record[0].get('stringValue', '')} {record[1].get('stringValue', '')}"
            position = record[2].get('stringValue', '')
            count = record[3].get('longValue', 0)
            print(f"  • {name} ({position}): {count} records")

def check_mlb_id_issues():
    """Check for MLB ID problems - FIXED VERSION"""
    print("\n🔍 Checking MLB ID issues...")
    
    # Count players without MLB IDs (handle string/int types)
    sql = """
    SELECT COUNT(*) FROM mlb_players 
    WHERE is_active = true 
    AND (mlb_id IS NULL OR mlb_id = '' OR mlb_id = '0' OR TRIM(mlb_id) = '')
    """
    
    try:
        response = execute_sql(sql)
        if response.get('records'):
            count = response['records'][0][0].get('longValue', 0)
            print(f"❌ Players without valid MLB IDs: {count}")
    except Exception as e:
        print(f"❌ Error checking invalid MLB IDs: {e}")
    
    # Count players with MLB IDs
    sql = """
    SELECT COUNT(*) FROM mlb_players 
    WHERE is_active = true 
    AND mlb_id IS NOT NULL 
    AND mlb_id != '' 
    AND mlb_id != '0' 
    AND TRIM(mlb_id) != ''
    """
    
    try:
        response = execute_sql(sql)
        if response.get('records'):
            count = response['records'][0][0].get('longValue', 0)
            print(f"✅ Players with valid MLB IDs: {count}")
    except Exception as e:
        print(f"❌ Error checking valid MLB IDs: {e}")
    
    # Show sample of players without MLB IDs
    sql = """
    SELECT first_name, last_name, position, player_id, mlb_id
    FROM mlb_players 
    WHERE is_active = true 
    AND (mlb_id IS NULL OR mlb_id = '' OR mlb_id = '0' OR TRIM(mlb_id) = '')
    LIMIT 5
    """
    
    try:
        response = execute_sql(sql)
        if response.get('records'):
            print("📋 Sample players without valid MLB IDs:")
            for record in response['records']:
                name = f"{record[0].get('stringValue', '')} {record[1].get('stringValue', '')}"
                position = record[2].get('stringValue', '')
                player_id = record[3].get('longValue', 0)
                mlb_id = record[4].get('stringValue', 'NULL') if record[4] else 'NULL'
                print(f"  • {name} ({position}) - Player ID: {player_id}, MLB ID: '{mlb_id}'")
    except Exception as e:
        print(f"❌ Error checking sample invalid MLB IDs: {e}")

def check_stat_distribution():
    """Check how stats are distributed by position"""
    print("\n🔍 Checking stat distribution by position...")
    
    sql = """
    SELECT p.position, COUNT(DISTINCT p.player_id) as total_players, 
           COUNT(DISTINCT s.player_id) as players_with_stats
    FROM mlb_players p
    LEFT JOIN player_stats s ON p.player_id = s.player_id AND s.season_year = 2025
    WHERE p.is_active = true
    GROUP BY p.position
    ORDER BY total_players DESC
    """
    
    try:
        response = execute_sql(sql)
        if response.get('records'):
            print("📋 Stats distribution by position:")
            print("Position | Total | With Stats | Success Rate")
            print("-" * 45)
            for record in response['records']:
                position = record[0].get('stringValue', 'Unknown')
                total = record[1].get('longValue', 0)
                with_stats = record[2].get('longValue', 0)
                success_rate = (with_stats / total * 100) if total > 0 else 0
                print(f"{position:8} | {total:5} | {with_stats:10} | {success_rate:7.1f}%")
    except Exception as e:
        print(f"❌ Error checking stat distribution: {e}")

def main():
    """Main diagnostic function"""
    start_time = datetime.now()
    print("🔍 DIAGNOSTIC MODE: MLB Stats Population Issues")
    print("Finding out why 400/802 players failed...")
    print()
    
    try:
        # Check column data types first
        check_data_types()
        
        # Check existing stats
        check_existing_stats()
        
        # Check stat distribution by position
        check_stat_distribution()
        
        # Check MLB ID issues
        check_mlb_id_issues()
        
        # Test sample players
        success_count, error_count, error_types = diagnose_players()
        
        duration = datetime.now() - start_time
        print(f"\n⏱️  Diagnostic duration: {duration}")
        
        # Recommendations
        print("\n💡 RECOMMENDATIONS:")
        if error_types.get('no_mlb_id', 0) > 0:
            print("   🔧 Fix MLB ID mapping - many players missing valid MLB IDs")
            print("   🔧 Consider using player_id as mlb_id for players without valid MLB IDs")
        if error_types.get('api_failed', 0) > 0:
            print("   🔧 Check MLB API rate limits or response format changes")
            print("   🔧 Some players may be inactive for 2025 season")
        if success_count > 0:
            print("   ✅ Some players work - suggests data quality issue rather than API problem")
        
        print("\n🔧 NEXT STEPS:")
        print("   1. Fix MLB ID mapping in database")
        print("   2. Update populate_stats.py to handle missing MLB IDs")
        print("   3. Add better error handling for inactive players")
        print("   4. Re-run population with fixed script")
        
    except Exception as e:
        print(f"❌ Diagnostic failed: {e}")

if __name__ == "__main__":
    main()