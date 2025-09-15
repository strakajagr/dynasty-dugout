#!/usr/bin/env python3
"""
Backfill MLB team data for all game logs missing teams
Goes through each game and gets team data from MLB API boxscores
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

# Team name to abbreviation mapping (all must be 3 chars or less!)
TEAM_ABBREVIATIONS = {
    # American League
    'Baltimore Orioles': 'BAL',
    'Boston Red Sox': 'BOS',
    'New York Yankees': 'NYY',
    'Tampa Bay Rays': 'TB',
    'Toronto Blue Jays': 'TOR',
    'Chicago White Sox': 'CWS',
    'Cleveland Guardians': 'CLE',
    'Detroit Tigers': 'DET',
    'Kansas City Royals': 'KC',
    'Minnesota Twins': 'MIN',
    'Houston Astros': 'HOU',
    'Los Angeles Angels': 'LAA',
    'Oakland Athletics': 'OAK',
    'Seattle Mariners': 'SEA',
    'Texas Rangers': 'TEX',
    # National League
    'Atlanta Braves': 'ATL',
    'Miami Marlins': 'MIA',
    'New York Mets': 'NYM',
    'Philadelphia Phillies': 'PHI',
    'Washington Nationals': 'WSH',
    'Chicago Cubs': 'CHC',
    'Cincinnati Reds': 'CIN',
    'Milwaukee Brewers': 'MIL',
    'Pittsburgh Pirates': 'PIT',
    'St. Louis Cardinals': 'STL',
    'Arizona Diamondbacks': 'ARI',  # Changed from AZ to ARI
    'Colorado Rockies': 'COL',
    'Los Angeles Dodgers': 'LAD',
    'San Diego Padres': 'SD',
    'San Francisco Giants': 'SF',
    # Also map abbreviations to themselves
    'BAL': 'BAL', 'BOS': 'BOS', 'NYY': 'NYY', 'TB': 'TB', 'TOR': 'TOR',
    'CWS': 'CWS', 'CLE': 'CLE', 'DET': 'DET', 'KC': 'KC', 'MIN': 'MIN',
    'HOU': 'HOU', 'LAA': 'LAA', 'OAK': 'OAK', 'SEA': 'SEA', 'TEX': 'TEX',
    'ATL': 'ATL', 'MIA': 'MIA', 'NYM': 'NYM', 'PHI': 'PHI', 'WSH': 'WSH',
    'CHC': 'CHC', 'CIN': 'CIN', 'MIL': 'MIL', 'PIT': 'PIT', 'STL': 'STL',
    'ARI': 'ARI', 'AZ': 'ARI', 'COL': 'COL', 'LAD': 'LAD', 'SD': 'SD', 'SF': 'SF'
}

def get_team_abbreviation(team_str):
    """Convert team name or abbreviation to standard 2-3 letter abbreviation"""
    if not team_str:
        return ''
    # Check if it's already an abbreviation or full name
    result = TEAM_ABBREVIATIONS.get(team_str, '')
    if not result:
        # Unknown team - truncate to 3 chars max
        result = team_str[:3].upper() if team_str else ''
    # Final safety check - ensure it's 3 chars or less
    return result[:3]

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

def backfill_teams_for_date(target_date):
    """Backfill MLB teams and opponents for all games on a specific date"""
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
                    logger.debug(f"  Skipping game {game['gamePk']} - state: {game_state}")
                    continue
                    
                # Get team abbreviations or names and convert to abbreviations
                home_team_raw = (game.get('teams', {}).get('home', {}).get('team', {}).get('abbreviation') or
                                game.get('teams', {}).get('home', {}).get('abbreviation') or
                                game.get('teams', {}).get('home', {}).get('team', {}).get('name') or '')
                away_team_raw = (game.get('teams', {}).get('away', {}).get('team', {}).get('abbreviation') or
                                game.get('teams', {}).get('away', {}).get('abbreviation') or
                                game.get('teams', {}).get('away', {}).get('team', {}).get('name') or '')
                
                # Convert to abbreviations
                home_team = get_team_abbreviation(home_team_raw)
                away_team = get_team_abbreviation(away_team_raw)
                
                # Debug: print first game structure to see where teams are
                if games_found == 1 and (not home_team or not away_team):
                    logger.info(f"  DEBUG - Raw teams: home='{home_team_raw}' -> '{home_team}', away='{away_team_raw}' -> '{away_team}'")
                
                if not home_team or not away_team:
                    logger.warning(f"  Missing teams for game {game['gamePk']}: home={home_team}, away={away_team}")
                    continue
                
                # Get detailed boxscore
                game_pk = game['gamePk']
                box_url = f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
                box_response = requests.get(box_url, timeout=15)
                
                if box_response.status_code == 200:
                    box_data = box_response.json()
                    all_players = box_data.get('liveData', {}).get('boxscore', {}).get('teams', {})
                    
                    # Process HOME team players
                    # They play FOR home_team AGAINST away_team
                    home_players = all_players.get('home', {}).get('players', {})
                    for player_key, player_info in home_players.items():
                        player_id = player_info.get('person', {}).get('id')
                        
                        if player_id and home_team and away_team:
                            # Update with team they play FOR and opponent
                            update_sql = """
                            UPDATE player_game_logs 
                            SET mlb_team = :mlb_team,
                                opponent = :opponent
                            WHERE player_id = :player_id 
                            AND game_date = :game_date::date
                            AND (mlb_team IS NULL OR mlb_team = '' OR opponent IS NULL OR opponent = '')
                            """
                            
                            result = execute_sql(update_sql, {
                                'player_id': player_id,
                                'game_date': date_str,
                                'mlb_team': home_team,     # Team they play FOR
                                'opponent': away_team       # Team they play AGAINST
                            })
                            
                            if result.get('numberOfRecordsUpdated', 0) > 0:
                                updates += 1
                    
                    # Process AWAY team players  
                    # They play FOR away_team AGAINST home_team
                    away_players = all_players.get('away', {}).get('players', {})
                    for player_key, player_info in away_players.items():
                        player_id = player_info.get('person', {}).get('id')
                        
                        if player_id and away_team and home_team:
                            # Update with team they play FOR and opponent
                            update_sql = """
                            UPDATE player_game_logs 
                            SET mlb_team = :mlb_team,
                                opponent = :opponent
                            WHERE player_id = :player_id 
                            AND game_date = :game_date::date
                            AND (mlb_team IS NULL OR mlb_team = '' OR opponent IS NULL OR opponent = '')
                            """
                            
                            result = execute_sql(update_sql, {
                                'player_id': player_id,
                                'game_date': date_str,
                                'mlb_team': away_team,     # Team they play FOR
                                'opponent': home_team       # Team they play AGAINST  
                            })
                            
                            if result.get('numberOfRecordsUpdated', 0) > 0:
                                updates += 1
                else:
                    logger.warning(f"  Boxscore API failed for game {game_pk}: {box_response.status_code}")
                
                # Rate limit
                time.sleep(0.2)
        
        if games_found == 0:
            logger.info(f"  No games found for {date_str}")
        else:
            logger.info(f"  Updated {updates} records for {date_str} ({games_found} games)")
        return updates
        
    except Exception as e:
        logger.error(f"Error processing {date_str}: {e}")
        return 0

def main():
    """Backfill all missing MLB teams from season start to today"""
    # Start from regular season, not spring training
    season_start = date(2025, 3, 27)  # Regular season starts March 27, 2025
    today = date.today()
    current = season_start
    total_updates = 0
    
    logger.info(f"Starting MLB team backfill from {season_start} to {today}")
    
    # First, check current state
    result = execute_sql("""
        SELECT 
            COUNT(*) as total_logs,
            COUNT(mlb_team) as with_team,
            COUNT(*) - COUNT(mlb_team) as missing_team
        FROM player_game_logs
        WHERE game_date >= '2025-03-20'
    """)
    
    if result and result.get('records'):
        record = result['records'][0]
        total = record[0].get('longValue', 0)
        with_team = record[1].get('longValue', 0)
        missing = record[2].get('longValue', 0)
        logger.info(f"📊 Starting state: {with_team}/{total} have teams, {missing} missing")
    
    while current <= today:
        updates = backfill_teams_for_date(current)
        total_updates += updates
        current += timedelta(days=1)
        
        # Progress report every 10 days
        if (current - season_start).days % 10 == 0:
            logger.info(f"Progress: {current}, Total updates: {total_updates}")
    
    logger.info(f"✅ Backfill complete! Total teams updated: {total_updates}")
    
    # Check final stats
    result = execute_sql("""
        SELECT 
            COUNT(*) as total_logs,
            COUNT(mlb_team) as with_team,
            ROUND(COUNT(mlb_team)::numeric / COUNT(*) * 100, 2) as percentage
        FROM player_game_logs
        WHERE game_date >= '2025-03-20'
    """)
    
    if result and result.get('records'):
        record = result['records'][0]
        total = record[0].get('longValue', 0)
        with_team = record[1].get('longValue', 0)
        pct = record[2].get('stringValue', '0')
        logger.info(f"📊 Final stats: {with_team}/{total} game logs have teams ({pct}%)")

if __name__ == "__main__":
    main()