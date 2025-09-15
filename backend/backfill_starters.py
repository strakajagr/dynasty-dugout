#!/usr/bin/env python3
"""
Backfill was_starter flag for all pitcher game logs
This enables proper games_started calculation
"""
import json
import logging
import boto3
import requests
import time
from datetime import datetime, date, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# Database configuration
DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
rds_client = boto3.client('rds-data', region_name='us-east-1')

def execute_sql(sql, params=None):
    """Execute SQL using RDS Data API"""
    try:
        request = {
            'resourceArn': DB_CLUSTER_ARN,
            'secretArn': DB_SECRET_ARN,
            'database': 'postgres',
            'sql': sql
        }
        if params:
            request['parameters'] = []
            for k, v in params.items():
                param = {'name': k}
                if v is None:
                    param['value'] = {'isNull': True}
                elif isinstance(v, bool):
                    param['value'] = {'booleanValue': v}
                elif isinstance(v, int):
                    param['value'] = {'longValue': v}
                elif isinstance(v, float):
                    param['value'] = {'doubleValue': v}
                else:
                    param['value'] = {'stringValue': str(v)}
                request['parameters'].append(param)
        return rds_client.execute_statement(**request)
    except Exception as e:
        logger.error(f"SQL Error: {e}")
        raise

def backfill_starters_for_date(target_date):
    """Identify and mark starting pitchers for all games on a specific date"""
    date_str = target_date.strftime('%Y-%m-%d')
    logger.info(f"Processing starters for {date_str}")
    
    # Get schedule for this date
    url = "https://statsapi.mlb.com/api/v1/schedule"
    params = {
        'date': date_str,
        'sportId': 1,
        'hydrate': 'boxscore'
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        if response.status_code != 200:
            logger.warning(f"  Schedule API returned {response.status_code}")
            return 0
            
        data = response.json()
        updates = 0
        games_found = 0
        
        for date_entry in data.get('dates', []):
            for game in date_entry.get('games', []):
                games_found += 1
                game_state = game.get('status', {}).get('codedGameState', '')
                
                if game_state != 'F':
                    continue
                
                # Get detailed boxscore to identify starters
                game_pk = game['gamePk']
                box_url = f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
                box_response = requests.get(box_url, timeout=15)
                
                if box_response.status_code == 200:
                    box_data = box_response.json()
                    boxscore = box_data.get('liveData', {}).get('boxscore', {})
                    teams_data = boxscore.get('teams', {})
                    
                    # Get starting pitcher IDs
                    home_starter_id = None
                    away_starter_id = None
                    
                    # Method 1: Check pitchers array (first pitcher is usually the starter)
                    home_pitchers = teams_data.get('home', {}).get('pitchers', [])
                    away_pitchers = teams_data.get('away', {}).get('pitchers', [])
                    
                    if home_pitchers:
                        home_starter_id = home_pitchers[0]
                    if away_pitchers:
                        away_starter_id = away_pitchers[0]
                    
                    # Method 2: Check gameData for probable pitchers (backup)
                    game_info = box_data.get('gameData', {})
                    if not home_starter_id:
                        probable_home = game_info.get('probablePitchers', {}).get('home', {})
                        if probable_home:
                            home_starter_id = probable_home.get('id')
                    if not away_starter_id:
                        probable_away = game_info.get('probablePitchers', {}).get('away', {})
                        if probable_away:
                            away_starter_id = probable_away.get('id')
                    
                    # Update was_starter for identified starters
                    starters = []
                    if home_starter_id:
                        starters.append(home_starter_id)
                    if away_starter_id:
                        starters.append(away_starter_id)
                    
                    if starters:
                        # Mark these pitchers as starters for this game
                        for starter_id in starters:
                            update_sql = """
                            UPDATE player_game_logs 
                            SET was_starter = true
                            WHERE player_id = :player_id 
                            AND game_date = :game_date::date
                            AND position_played = 'P'
                            """
                            
                            result = execute_sql(update_sql, {
                                'player_id': starter_id,
                                'game_date': date_str
                            })
                            
                            if result.get('numberOfRecordsUpdated', 0) > 0:
                                updates += 1
                                logger.debug(f"  Marked player {starter_id} as starter")
                    
                    # Also mark all other pitchers in this game as non-starters
                    # This ensures we have explicit false values
                    all_pitcher_ids = set()
                    
                    # Get all pitchers who played in this game
                    for team_key in ['home', 'away']:
                        team_pitchers = teams_data.get(team_key, {}).get('pitchers', [])
                        all_pitcher_ids.update(team_pitchers)
                    
                    # Remove starters from the set
                    non_starters = all_pitcher_ids - set(starters)
                    
                    for pitcher_id in non_starters:
                        update_sql = """
                        UPDATE player_game_logs 
                        SET was_starter = false
                        WHERE player_id = :player_id 
                        AND game_date = :game_date::date
                        AND position_played = 'P'
                        AND was_starter IS NULL
                        """
                        
                        result = execute_sql(update_sql, {
                            'player_id': pitcher_id,
                            'game_date': date_str
                        })
                        
                        if result.get('numberOfRecordsUpdated', 0) > 0:
                            updates += 1
                
                # Rate limit
                time.sleep(0.2)
        
        logger.info(f"  Updated {updates} pitcher records for {date_str} ({games_found} games)")
        return updates
        
    except Exception as e:
        logger.error(f"Error processing {date_str}: {e}")
        return 0

def main():
    """Backfill was_starter for all pitcher game logs"""
    
    # Check if was_starter column exists
    logger.info("Checking if was_starter column exists...")
    try:
        execute_sql("""
            ALTER TABLE player_game_logs 
            ADD COLUMN IF NOT EXISTS was_starter BOOLEAN DEFAULT FALSE
        """)
        logger.info("✅ was_starter column ensured")
    except Exception as e:
        logger.error(f"Failed to add was_starter column: {e}")
        return
    
    # Start from regular season
    season_start = date(2025, 3, 27)
    today = date.today()
    current = season_start
    total_updates = 0
    
    logger.info(f"Starting was_starter backfill from {season_start} to {today}")
    
    # First, check current state
    result = execute_sql("""
        SELECT 
            COUNT(*) FILTER (WHERE position_played = 'P') as total_pitchers,
            COUNT(*) FILTER (WHERE position_played = 'P' AND was_starter = true) as starters,
            COUNT(*) FILTER (WHERE position_played = 'P' AND was_starter = false) as non_starters,
            COUNT(*) FILTER (WHERE position_played = 'P' AND was_starter IS NULL) as unknown
        FROM player_game_logs
        WHERE game_date >= '2025-03-27'
    """)
    
    if result and result.get('records'):
        record = result['records'][0]
        total = record[0].get('longValue', 0)
        starters = record[1].get('longValue', 0)
        non_starters = record[2].get('longValue', 0)
        unknown = record[3].get('longValue', 0)
        logger.info(f"📊 Starting state: {total} pitcher appearances")
        logger.info(f"   Starters: {starters}, Non-starters: {non_starters}, Unknown: {unknown}")
    
    while current <= today:
        updates = backfill_starters_for_date(current)
        total_updates += updates
        current += timedelta(days=1)
        
        # Progress report every 10 days
        if (current - season_start).days % 10 == 0:
            logger.info(f"Progress: {current}, Total updates: {total_updates}")
    
    logger.info(f"✅ Starter backfill complete! Total updates: {total_updates}")
    
    # Check final stats
    result = execute_sql("""
        SELECT 
            COUNT(*) FILTER (WHERE position_played = 'P') as total_pitchers,
            COUNT(*) FILTER (WHERE position_played = 'P' AND was_starter = true) as starters,
            COUNT(*) FILTER (WHERE position_played = 'P' AND was_starter = false) as non_starters,
            COUNT(*) FILTER (WHERE position_played = 'P' AND was_starter IS NULL) as unknown
        FROM player_game_logs
        WHERE game_date >= '2025-03-27'
    """)
    
    if result and result.get('records'):
        record = result['records'][0]
        total = record[0].get('longValue', 0)
        starters = record[1].get('longValue', 0)
        non_starters = record[2].get('longValue', 0)
        unknown = record[3].get('longValue', 0)
        logger.info(f"📊 Final stats: {total} pitcher appearances")
        logger.info(f"   Starters: {starters}, Non-starters: {non_starters}, Unknown: {unknown}")
    
    # Now recalculate games_started in player_season_stats
    logger.info("Recalculating games_started from was_starter flags...")
    result = execute_sql("""
        UPDATE player_season_stats ps
        SET games_started = (
            SELECT COUNT(*)
            FROM player_game_logs gl
            WHERE gl.player_id = ps.player_id
            AND EXTRACT(YEAR FROM gl.game_date) = ps.season
            AND gl.was_starter = true
        )
        WHERE ps.season = 2025
    """)
    
    updated = result.get('numberOfRecordsUpdated', 0)
    logger.info(f"✅ Updated games_started for {updated} players")

if __name__ == "__main__":
    main()