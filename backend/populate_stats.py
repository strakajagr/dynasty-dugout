#!/usr/bin/env python3
"""
MLB Stats Data Populator - Safe Version
Works with any schema by checking what columns exist first
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

# Initialize RDS client
rds_client = boto3.client('rds-data', region_name='us-east-1')

def execute_sql(sql, parameters=None):
    """Execute SQL query using RDS Data API"""
    try:
        params = {
            'resourceArn': DATABASE_CONFIG['resourceArn'],
            'secretArn': DATABASE_CONFIG['secretArn'],
            'database': DATABASE_CONFIG['database'],
            'sql': sql,
            'includeResultMetadata': True
        }
        
        if parameters:
            params['parameters'] = parameters
            
        response = rds_client.execute_statement(**params)
        return response
        
    except Exception as e:
        print(f"Database error: {str(e)}")
        raise

def get_table_columns():
    """Get all columns in the player_stats table"""
    try:
        sql = "SELECT column_name FROM information_schema.columns WHERE table_name = 'player_stats' ORDER BY ordinal_position"
        response = execute_sql(sql)
        
        columns = []
        if response.get('records'):
            for record in response['records']:
                if record[0].get('stringValue'):
                    columns.append(record[0]['stringValue'])
        
        print(f"📋 Available columns: {', '.join(columns)}")
        return columns
        
    except Exception as e:
        print(f"Error getting table columns: {e}")
        return []

def get_mlb_player_stats(mlb_id, season=2025):
    """Fetch player stats from MLB Stats API"""
    try:
        url = f"https://statsapi.mlb.com/api/v1/people/{mlb_id}/stats"
        params = {
            'stats': 'season',
            'group': 'hitting,pitching',
            'season': season
        }
        
        print(f"  Fetching stats from MLB API...")
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return data.get('stats', [])
        else:
            print(f"  API error: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"  Error fetching stats: {e}")
        return None

def parse_all_stats(stats_data):
    """Parse both hitting and pitching stats from MLB API response"""
    hitting_stats = {}
    pitching_stats = {}
    
    for stat_group in stats_data:
        group_name = stat_group.get('group', {}).get('displayName', '')
        splits = stat_group.get('splits', [])
        
        if not splits:
            continue
            
        stat = splits[0].get('stat', {})
        
        if group_name == 'hitting':
            hitting_stats = {
                'games_played': stat.get('gamesPlayed', 0),
                'at_bats': stat.get('atBats', 0),
                'hits': stat.get('hits', 0),
                'runs': stat.get('runs', 0),
                'rbis': stat.get('rbi', 0),
                'home_runs': stat.get('homeRuns', 0),
                'stolen_bases': stat.get('stolenBases', 0),
                'walks': stat.get('baseOnBalls', 0),
                'strikeouts': stat.get('strikeOuts', 0),
                'batting_avg': float(stat.get('avg', '0.000')),
                'on_base_pct': float(stat.get('obp', '0.000')),
                'slugging_pct': float(stat.get('slg', '0.000'))
            }
        elif group_name == 'pitching':
            pitching_stats = {
                'games_played': stat.get('gamesPlayed', 0),
                'innings_pitched': float(stat.get('inningsPitched', '0.0')),
                'wins': stat.get('wins', 0),
                'losses': stat.get('losses', 0),
                'saves': stat.get('saves', 0),
                'earned_runs': stat.get('earnedRuns', 0),
                'strikeouts_pitched': stat.get('strikeOuts', 0),
                'era': float(stat.get('era', '0.00')),
                'whip': float(stat.get('whip', '0.00'))
            }
    
    return hitting_stats, pitching_stats

def build_safe_insert(player_id, hitting_stats, pitching_stats, available_columns, season=2025, week=1):
    """Build an INSERT statement using only columns that exist in the table"""
    
    # Map of possible stat names to their values
    all_stats = {
        'player_id': player_id,
        'week_number': week,
        'season_year': season,
        'games_played': hitting_stats.get('games_played', 0) or pitching_stats.get('games_played', 0),
        'at_bats': hitting_stats.get('at_bats', 0),
        'hits': hitting_stats.get('hits', 0),
        'runs': hitting_stats.get('runs', 0),
        'rbis': hitting_stats.get('rbis', 0),
        'home_runs': hitting_stats.get('home_runs', 0),
        'stolen_bases': hitting_stats.get('stolen_bases', 0),
        'walks': hitting_stats.get('walks', 0),
        'strikeouts': hitting_stats.get('strikeouts', 0),
        'batting_avg': hitting_stats.get('batting_avg', 0.0),
        'on_base_pct': hitting_stats.get('on_base_pct', 0.0),
        'slugging_pct': hitting_stats.get('slugging_pct', 0.0),
        'innings_pitched': pitching_stats.get('innings_pitched', 0.0),
        'wins': pitching_stats.get('wins', 0),
        'losses': pitching_stats.get('losses', 0),
        'saves': pitching_stats.get('saves', 0),
        'earned_runs': pitching_stats.get('earned_runs', 0),
        'strikeouts_pitched': pitching_stats.get('strikeouts_pitched', 0),
        'era': pitching_stats.get('era', 0.0),
        'whip': pitching_stats.get('whip', 0.0)
    }
    
    # Only use columns that exist in the table
    valid_stats = {}
    for col_name, value in all_stats.items():
        if col_name in available_columns:
            valid_stats[col_name] = value
    
    if not valid_stats:
        return None, None
    
    # Build the SQL
    columns = list(valid_stats.keys())
    placeholders = [f":{col}" for col in columns]
    
    sql = f"""
    INSERT INTO player_stats ({', '.join(columns)})
    VALUES ({', '.join(placeholders)})
    ON CONFLICT (player_id, week_number, season_year) 
    DO UPDATE SET {', '.join([f"{col} = EXCLUDED.{col}" for col in columns if col not in ['player_id', 'week_number', 'season_year']])}
    """
    
    # Build parameters
    parameters = []
    for col_name, value in valid_stats.items():
        if isinstance(value, float):
            param_value = {'doubleValue': value}
        else:
            param_value = {'longValue': int(value)}
        
        parameters.append({
            'name': col_name,
            'value': param_value
        })
    
    return sql, parameters

def insert_player_stats(player_id, hitting_stats, pitching_stats, available_columns, season=2025, week=1):
    """Insert player statistics using only available columns"""
    try:
        sql, parameters = build_safe_insert(player_id, hitting_stats, pitching_stats, available_columns, season, week)
        
        if not sql:
            print(f"  ⚠️  No valid columns to insert")
            return False
        
        execute_sql(sql, parameters)
        
        # Log what we inserted
        if hitting_stats.get('at_bats', 0) > 0:
            avg = hitting_stats.get('batting_avg', 0)
            hr = hitting_stats.get('home_runs', 0)
            rbi = hitting_stats.get('rbis', 0)
            print(f"  ✅ HITTER: {hitting_stats.get('games_played', 0)}G, .{avg:.3f} AVG, {hr}HR, {rbi}RBI")
        elif pitching_stats.get('innings_pitched', 0) > 0:
            era = pitching_stats.get('era', 0)
            ip = pitching_stats.get('innings_pitched', 0)
            wins = pitching_stats.get('wins', 0)
            print(f"  ✅ PITCHER: {pitching_stats.get('games_played', 0)}G, {ip:.1f}IP, {era:.2f}ERA, {wins}W")
        else:
            games = hitting_stats.get('games_played', 0) or pitching_stats.get('games_played', 0)
            print(f"  ✅ PLAYER: {games}G (limited stats)")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error inserting stats: {e}")
        return False

def get_players_from_db():
    """Get players from database"""
    try:
        sql = "SELECT player_id, mlb_id, first_name, last_name, position FROM mlb_players WHERE is_active = true LIMIT 10"
        response = execute_sql(sql)
        
        players = []
        if response.get('records'):
            columns = [col['name'] for col in response.get('columnMetadata', [])]
            for record in response['records']:
                player = {}
                for i, column in enumerate(columns):
                    if i < len(record):
                        value = record[i]
                        if 'stringValue' in value:
                            player[column] = value['stringValue']
                        elif 'longValue' in value:
                            player[column] = value['longValue']
                        else:
                            player[column] = None
                players.append(player)
        
        return players
        
    except Exception as e:
        print(f"Error fetching players: {e}")
        return []

def populate_stats():
    """Main function to populate stats"""
    print("🚀 Starting MLB Stats Population...")
    print("🔍 Safe mode: Only using columns that exist in your schema")
    
    # First, check what columns are available
    available_columns = get_table_columns()
    if not available_columns:
        print("❌ Could not determine table schema")
        return
    
    # Get players from database
    players = get_players_from_db()
    print(f"📊 Found {len(players)} active players to process")
    
    success_count = 0
    error_count = 0
    
    for i, player in enumerate(players):
        try:
            player_id = player['player_id']
            mlb_id = player['mlb_id']
            position = player.get('position', 'Unknown')
            name = f"{player.get('first_name', '')} {player.get('last_name', '')}"
            
            print(f"\n[{i+1}/{len(players)}] {name} ({position}) - ID: {player_id}")
            
            # Skip if no MLB ID
            if not mlb_id:
                print(f"  ⚠️  Skipping - no MLB ID")
                continue
            
            # Fetch stats from MLB API
            stats_data = get_mlb_player_stats(mlb_id)
            
            if not stats_data:
                print(f"  ⚠️  No stats data available")
                error_count += 1
                continue
            
            # Parse stats
            hitting_stats, pitching_stats = parse_all_stats(stats_data)
            
            # Insert using safe method
            if insert_player_stats(player_id, hitting_stats, pitching_stats, available_columns):
                success_count += 1
            else:
                error_count += 1
            
            # Rate limiting
            time.sleep(0.5)
            
        except Exception as e:
            print(f"  ❌ Error processing {player.get('first_name', '')} {player.get('last_name', '')}: {e}")
            error_count += 1
            continue
    
    print(f"\n🎉 Stats population complete!")
    print(f"✅ Successfully processed: {success_count} players")
    print(f"❌ Errors: {error_count} players")

if __name__ == "__main__":
    populate_stats()