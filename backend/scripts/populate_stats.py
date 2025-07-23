#!/usr/bin/env python3
"""
FIXED MLB Stats Data Populator - UNLIMITED VERSION
Properly handles both pitchers and hitters with improved logic
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

def get_all_players():
    """Get ALL active players"""
    print("🔍 Fetching ALL active players from database...")
    
    sql = """
    SELECT player_id, mlb_id, first_name, last_name, position 
    FROM mlb_players 
    WHERE is_active = true
    ORDER BY last_name, first_name
    """
    
    response = execute_sql(sql)
    
    players = []
    for record in response.get('records', []):
        # Handle both integer and string player_id
        player_id = None
        if record[0].get('longValue') is not None:
            player_id = record[0]['longValue']
        elif record[0].get('stringValue'):
            player_id = int(record[0]['stringValue'])
        
        # Handle both integer and string mlb_id
        mlb_id = None
        if record[1].get('longValue') is not None:
            mlb_id = record[1]['longValue']
        elif record[1].get('stringValue'):
            mlb_id = record[1]['stringValue'].strip()
        
        # Use player_id as mlb_id if mlb_id is missing (fallback)
        if not mlb_id or mlb_id in ['0', 'None', 'null', '']:
            mlb_id = player_id
        
        players.append({
            'player_id': player_id,
            'mlb_id': str(mlb_id),  # Ensure string for API call
            'first_name': record[2]['stringValue'] if record[2].get('stringValue') else '',
            'last_name': record[3]['stringValue'] if record[3].get('stringValue') else '',
            'position': record[4]['stringValue'] if record[4].get('stringValue') else ''
        })
    
    print(f"📊 Found {len(players)} total active players to process")
    return players

def delete_existing_stats(player_id, season_year=2025):
    """Delete existing stats for a player to allow fresh data"""
    sql = """
    DELETE FROM player_stats 
    WHERE player_id = :player_id AND season_year = :season_year
    """
    
    parameters = [
        {'name': 'player_id', 'value': {'longValue': player_id}},
        {'name': 'season_year', 'value': {'longValue': season_year}}
    ]
    
    execute_sql(sql, parameters)

def fetch_mlb_stats(mlb_id):
    """Fetch stats from MLB Stats API"""
    try:
        url = f"https://statsapi.mlb.com/api/v1/people/{mlb_id}/stats"
        params = {
            'stats': 'season',
            'season': '2025'
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"  ⚠️  MLB API returned status {response.status_code}")
            return None
            
    except requests.RequestException as e:
        print(f"  ❌ Error fetching stats: {e}")
        return None

def process_player_stats(player):
    """FIXED: Process stats for a single player - handles both hitting and pitching properly"""
    try:
        player_id = player['player_id']
        mlb_id = player['mlb_id']
        position = player['position'].upper()
        is_pitcher = position in ['P', 'SP', 'RP', 'CL']
        
        print(f"  Fetching stats from MLB API...")
        
        # Delete existing stats first (daily overwrite)
        delete_existing_stats(player_id)
        
        # Fetch new stats
        stats_data = fetch_mlb_stats(mlb_id)
        if not stats_data:
            print(f"  ❌ No stats data available")
            return False
        
        # FIXED: Better logic to find hitting and pitching stats
        hitting_stats = None
        pitching_stats = None
        
        for stat_group in stats_data.get('stats', []):
            group_type = stat_group.get('group', {}).get('displayName', '').lower()
            
            for split in stat_group.get('splits', []):
                stat = split.get('stat', {})
                
                # Check if this is hitting data (has at-bats or plate appearances)
                if ('atBats' in stat or 'plateAppearances' in stat) and not hitting_stats:
                    hitting_stats = stat
                
                # Check if this is pitching data (has innings pitched)
                if 'inningsPitched' in stat and not pitching_stats:
                    pitching_stats = stat
        
        # FIXED: Insert stats based on what data we actually have, not just position
        success = False
        
        # Try pitching stats first (if available)
        if pitching_stats and float(pitching_stats.get('inningsPitched', '0')) > 0:
            try:
                sql = """
                INSERT INTO player_stats (
                    player_id, week_number, season_year, games_played, innings_pitched, wins, losses,
                    saves, holds, blown_saves, earned_runs, hits_allowed, walks_allowed, 
                    strikeouts_pitched, era, whip, fantasy_points
                ) VALUES (
                    :player_id, 1, 2025, :games_played, :innings_pitched, :wins, :losses,
                    :saves, :holds, :blown_saves, :earned_runs, :hits_allowed, :walks_allowed,
                    :strikeouts_pitched, :era, :whip, :fantasy_points
                )
                """
                
                # Calculate fantasy points
                fantasy_points = (
                    pitching_stats.get('wins', 0) * 5 +
                    pitching_stats.get('saves', 0) * 3 +
                    pitching_stats.get('strikeOuts', 0) * 1 +
                    float(pitching_stats.get('inningsPitched', '0')) * 1
                )
                
                parameters = [
                    {'name': 'player_id', 'value': {'longValue': player_id}},
                    {'name': 'games_played', 'value': {'longValue': pitching_stats.get('gamesPlayed', 0)}},
                    {'name': 'innings_pitched', 'value': {'doubleValue': float(pitching_stats.get('inningsPitched', '0'))}},
                    {'name': 'wins', 'value': {'longValue': pitching_stats.get('wins', 0)}},
                    {'name': 'losses', 'value': {'longValue': pitching_stats.get('losses', 0)}},
                    {'name': 'saves', 'value': {'longValue': pitching_stats.get('saves', 0)}},
                    {'name': 'holds', 'value': {'longValue': pitching_stats.get('holds', 0)}},
                    {'name': 'blown_saves', 'value': {'longValue': pitching_stats.get('blownSaves', 0)}},
                    {'name': 'earned_runs', 'value': {'longValue': pitching_stats.get('earnedRuns', 0)}},
                    {'name': 'hits_allowed', 'value': {'longValue': pitching_stats.get('hits', 0)}},
                    {'name': 'walks_allowed', 'value': {'longValue': pitching_stats.get('baseOnBalls', 0)}},
                    {'name': 'strikeouts_pitched', 'value': {'longValue': pitching_stats.get('strikeOuts', 0)}},
                    {'name': 'era', 'value': {'doubleValue': float(pitching_stats.get('era', '0'))}},
                    {'name': 'whip', 'value': {'doubleValue': float(pitching_stats.get('whip', '0'))}},
                    {'name': 'fantasy_points', 'value': {'doubleValue': fantasy_points}}
                ]
                
                execute_sql(sql, parameters)
                print(f"  ✅ PITCHER: {pitching_stats.get('gamesPlayed', 0)}G, {pitching_stats.get('inningsPitched', '0')}IP, {pitching_stats.get('era', '0')}ERA, {pitching_stats.get('wins', 0)}W")
                success = True
                
            except Exception as e:
                print(f"  ❌ Error inserting pitching stats: {e}")
        
        # Try hitting stats if no pitching or if pitching failed
        if not success and hitting_stats and hitting_stats.get('atBats', 0) > 0:
            try:
                sql = """
                INSERT INTO player_stats (
                    player_id, week_number, season_year, games_played, at_bats, hits, runs, rbis,
                    home_runs, doubles, triples, stolen_bases, walks, strikeouts, hit_by_pitch,
                    avg, obp, slg, ops, fantasy_points
                ) VALUES (
                    :player_id, 1, 2025, :games_played, :at_bats, :hits, :runs, :rbis,
                    :home_runs, :doubles, :triples, :stolen_bases, :walks, :strikeouts, :hit_by_pitch,
                    :avg, :obp, :slg, :ops, :fantasy_points
                )
                """
                
                # Calculate fantasy points
                fantasy_points = (
                    hitting_stats.get('hits', 0) * 1 +
                    hitting_stats.get('homeRuns', 0) * 4 +
                    hitting_stats.get('rbi', 0) * 1 +
                    hitting_stats.get('runs', 0) * 1 +
                    hitting_stats.get('stolenBases', 0) * 2
                )
                
                parameters = [
                    {'name': 'player_id', 'value': {'longValue': player_id}},
                    {'name': 'games_played', 'value': {'longValue': hitting_stats.get('gamesPlayed', 0)}},
                    {'name': 'at_bats', 'value': {'longValue': hitting_stats.get('atBats', 0)}},
                    {'name': 'hits', 'value': {'longValue': hitting_stats.get('hits', 0)}},
                    {'name': 'runs', 'value': {'longValue': hitting_stats.get('runs', 0)}},
                    {'name': 'rbis', 'value': {'longValue': hitting_stats.get('rbi', 0)}},
                    {'name': 'home_runs', 'value': {'longValue': hitting_stats.get('homeRuns', 0)}},
                    {'name': 'doubles', 'value': {'longValue': hitting_stats.get('doubles', 0)}},
                    {'name': 'triples', 'value': {'longValue': hitting_stats.get('triples', 0)}},
                    {'name': 'stolen_bases', 'value': {'longValue': hitting_stats.get('stolenBases', 0)}},
                    {'name': 'walks', 'value': {'longValue': hitting_stats.get('baseOnBalls', 0)}},
                    {'name': 'strikeouts', 'value': {'longValue': hitting_stats.get('strikeOuts', 0)}},
                    {'name': 'hit_by_pitch', 'value': {'longValue': hitting_stats.get('hitByPitch', 0)}},
                    {'name': 'avg', 'value': {'doubleValue': float(hitting_stats.get('avg', '0'))}},
                    {'name': 'obp', 'value': {'doubleValue': float(hitting_stats.get('obp', '0'))}},
                    {'name': 'slg', 'value': {'doubleValue': float(hitting_stats.get('slg', '0'))}},
                    {'name': 'ops', 'value': {'doubleValue': float(hitting_stats.get('ops', '0'))}},
                    {'name': 'fantasy_points', 'value': {'doubleValue': fantasy_points}}
                ]
                
                execute_sql(sql, parameters)
                print(f"  ✅ HITTER: {hitting_stats.get('gamesPlayed', 0)}G, {hitting_stats.get('avg', '0')} AVG, {hitting_stats.get('homeRuns', 0)}HR, {hitting_stats.get('rbi', 0)}RBI")
                success = True
                
            except Exception as e:
                print(f"  ❌ Error inserting hitting stats: {e}")
        
        if not success:
            print(f"  ⚠️  No usable stats found")
            print(f"       Has pitching data: {pitching_stats is not None}")
            print(f"       Has hitting data: {hitting_stats is not None}")
            if pitching_stats:
                print(f"       Innings pitched: {pitching_stats.get('inningsPitched', '0')}")
            if hitting_stats:
                print(f"       At bats: {hitting_stats.get('atBats', 0)}")
        
        return success
            
    except Exception as e:
        print(f"  ❌ Error processing stats: {e}")
        import traceback
        print(f"  📋 Traceback: {traceback.format_exc()}")
        return False

def main():
    """Main execution function"""
    start_time = datetime.now()
    print("🚀 Starting FIXED MLB Stats Population...")
    print("💪 Processing ALL active players with improved pitcher handling")
    print()
    
    try:
        # Get ALL players
        players = get_all_players()
        
        if not players:
            print("❌ No players found in database")
            return
        
        processed = 0
        errors = 0
        pitcher_success = 0
        hitter_success = 0
        
        for i, player in enumerate(players):
            position = player['position'].upper()
            is_pitcher = position in ['P', 'SP', 'RP', 'CL']
            
            print(f"[{i+1}/{len(players)}] {player['first_name']} {player['last_name']} ({player['position']}) - Player ID: {player['player_id']}, MLB ID: {player['mlb_id']}")
            
            try:
                success = process_player_stats(player)
                if success:
                    processed += 1
                    if is_pitcher:
                        pitcher_success += 1
                    else:
                        hitter_success += 1
                else:
                    errors += 1
                    
            except Exception as e:
                print(f"  ❌ Failed to process: {e}")
                errors += 1
            
            # Rate limiting - be respectful to MLB API
            if i < len(players) - 1:
                time.sleep(0.5)
        
        duration = datetime.now() - start_time
        print()
        print("🎉 FIXED Stats Population Complete!")
        print(f"✅ Successfully processed: {processed} players")
        print(f"   📊 Pitchers: {pitcher_success}")
        print(f"   📊 Hitters: {hitter_success}")
        print(f"❌ Errors: {errors} players")
        print(f"⏱️  Total duration: {duration}")
        print(f"🕐 Started: {start_time}")
        print(f"🕐 Finished: {datetime.now()}")
        
        # Show success rates
        total_pitchers = sum(1 for p in players if p['position'].upper() in ['P', 'SP', 'RP', 'CL'])
        total_hitters = len(players) - total_pitchers
        
        print()
        print("📊 SUCCESS RATES:")
        print(f"   Pitchers: {pitcher_success}/{total_pitchers} ({(pitcher_success/total_pitchers*100):.1f}%)")
        print(f"   Hitters: {hitter_success}/{total_hitters} ({(hitter_success/total_hitters*100):.1f}%)")
        
    except Exception as e:
        print(f"❌ Script failed: {e}")
        import traceback
        print(f"📋 Full traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    main()