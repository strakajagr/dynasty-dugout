"""
Backfill position data for all game logs missing positions
Goes through each game and gets position data from MLB API boxscores
"""
import json
import logging
import boto3
import os
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

def backfill_positions_for_date(target_date):
    """Backfill positions for all games on a specific date"""
    date_str = target_date.strftime('%Y-%m-%d')
    logger.info(f"Processing {date_str}")
    
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
            return 0
            
        data = response.json()
        updates = 0
        
        for date_entry in data.get('dates', []):
            for game in date_entry.get('games', []):
                if game.get('status', {}).get('codedGameState') != 'F':
                    continue
                    
                # Get detailed boxscore
                game_pk = game['gamePk']
                box_url = f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
                box_response = requests.get(box_url, timeout=15)
                
                if box_response.status_code == 200:
                    box_data = box_response.json()
                    all_players = box_data.get('liveData', {}).get('boxscore', {}).get('teams', {})
                    
                    for team_type in ['home', 'away']:
                        team_players = all_players.get(team_type, {}).get('players', {})
                        
                        for player_key, player_info in team_players.items():
                            player_id = player_info.get('person', {}).get('id')
                            
                            # Get position from boxscore
                            position = None
                            
                            # Check game position
                            if 'gamePosition' in player_info:
                                position = player_info['gamePosition'].get('abbreviation', '')
                            
                            # Check position field
                            if not position and 'position' in player_info:
                                position = player_info['position'].get('abbreviation', '')
                            
                            # Check allPositions
                            if not position and 'allPositions' in player_info:
                                positions = player_info.get('allPositions', [])
                                if positions:
                                    position = positions[0].get('abbreviation', '')
                            
                            # Check stats for position hint
                            if not position:
                                stats = player_info.get('stats', {})
                                if stats.get('pitching', {}).get('inningsPitched', '0.0') != '0.0':
                                    position = 'P'
                                elif stats.get('batting', {}).get('atBats', 0) > 0:
                                    # Can't determine specific position, skip
                                    continue
                            
                            if player_id and position:
                                # Update the game log
                                update_sql = """
                                UPDATE player_game_logs 
                                SET position_played = :position
                                WHERE player_id = :player_id 
                                AND game_date = :game_date::date
                                AND (position_played IS NULL OR position_played = '')
                                """
                                
                                result = execute_sql(update_sql, {
                                    'player_id': player_id,
                                    'game_date': date_str,
                                    'position': position
                                })
                                
                                if result.get('numberOfRecordsUpdated', 0) > 0:
                                    updates += 1
                
                # Rate limit
                time.sleep(0.2)
                
        logger.info(f"  Updated {updates} positions for {date_str}")
        return updates
        
    except Exception as e:
        logger.error(f"Error processing {date_str}: {e}")
        return 0

def main():
    """Backfill all missing positions from season start to today"""
    season_start = date(2025, 3, 28)
    today = date.today()
    current = season_start
    total_updates = 0
    
    logger.info(f"Starting position backfill from {season_start} to {today}")
    
    while current <= today:
        updates = backfill_positions_for_date(current)
        total_updates += updates
        current += timedelta(days=1)
        
        # Progress report every 10 days
        if (current - season_start).days % 10 == 0:
            logger.info(f"Progress: {current}, Total updates: {total_updates}")
    
    logger.info(f"✅ Backfill complete! Total positions updated: {total_updates}")
    
    # Check final stats
    result = execute_sql("""
        SELECT 
            COUNT(*) as total_logs,
            COUNT(position_played) as with_position,
            ROUND(COUNT(position_played)::numeric / COUNT(*) * 100, 2) as percentage
        FROM player_game_logs
        WHERE EXTRACT(YEAR FROM game_date) = 2025
    """)
    
    if result and result.get('records'):
        record = result['records'][0]
        total = record[0].get('longValue', 0)
        with_pos = record[1].get('longValue', 0)
        pct = record[2].get('stringValue', '0')
        logger.info(f"📊 Final stats: {with_pos}/{total} game logs have positions ({pct}%)")

if __name__ == "__main__":
    main()