#!/usr/bin/env python3
"""
Fetch missing MLB game logs for specific dates and populate the database
"""

import requests
import boto3
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
import time

# Database configuration
DB_CLUSTER_ARN = "arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless"
DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb"
DATABASE_NAME = "postgres"

# Initialize RDS client
rds_client = boto3.client('rds-data', region_name='us-east-1')

def execute_sql(sql: str, params: dict = None) -> dict:
    """Execute SQL using RDS Data API"""
    request = {
        'resourceArn': DB_CLUSTER_ARN,
        'secretArn': DB_SECRET_ARN,
        'database': DATABASE_NAME,
        'sql': sql
    }
    
    if params:
        request['parameters'] = [
            {'name': k, 'value': {'longValue': v} if isinstance(v, int) 
             else {'doubleValue': v} if isinstance(v, float)
             else {'booleanValue': v} if isinstance(v, bool)
             else {'stringValue': str(v)}}
            for k, v in params.items()
        ]
    
    return rds_client.execute_statement(**request)

def get_player_id_mapping() -> Dict[int, int]:
    """Get mapping of MLB player IDs to our database player IDs"""
    # In this database, player_id IS the MLB player ID
    # So we just map each ID to itself
    sql = "SELECT player_id FROM mlb_players WHERE player_id IS NOT NULL"
    response = execute_sql(sql)
    
    mapping = {}
    if response and response.get('records'):
        for record in response['records']:
            player_id = record[0].get('longValue')
            if player_id:
                # Map MLB ID to itself since they're the same
                mapping[player_id] = player_id
    
    return mapping

def fetch_schedule(date_str: str) -> List[int]:
    """Fetch game PKs for a specific date"""
    url = f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={date_str}"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        game_pks = []
        for date_data in data.get('dates', []):
            for game in date_data.get('games', []):
                if game.get('gamePk'):
                    game_pks.append(game['gamePk'])
        
        return game_pks
    except Exception as e:
        print(f"Error fetching schedule for {date_str}: {e}")
        return []

def fetch_game_data(game_pk: int) -> Dict[str, Any]:
    """Fetch detailed game data including box score"""
    url = f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching game {game_pk}: {e}")
        return None

def calculate_quality_start(ip: float, er: int) -> int:
    """Calculate if a pitching performance was a quality start"""
    # Quality start: 6+ IP and 3 or fewer ER
    return 1 if ip >= 6.0 and er <= 3 else 0

def parse_innings_pitched(ip_str: str) -> float:
    """Convert innings pitched string (e.g., '6.2') to decimal"""
    if not ip_str or ip_str == 'N/A':
        return 0.0
    
    if '.' in ip_str:
        innings, outs = ip_str.split('.')
        return float(innings) + (float(outs) / 3.0)
    return float(ip_str)

def extract_player_stats(game_data: Dict, game_date: str, player_mapping: Dict) -> List[Dict]:
    """Extract player statistics from game data"""
    if not game_data:
        return []
    
    stats = []
    
    try:
        # Get game info
        game_info = game_data.get('gameData', {})
        live_data = game_data.get('liveData', {})
        boxscore = live_data.get('boxscore', {})
        
        if not boxscore:
            return []
        
        # Get teams
        teams = boxscore.get('teams', {})
        
        for side in ['away', 'home']:
            team_data = teams.get(side, {})
            team_abbr = game_info.get('teams', {}).get(side, {}).get('abbreviation', 'UNK')
            opponent_abbr = game_info.get('teams', {}).get('home' if side == 'away' else 'away', {}).get('abbreviation', 'UNK')
            
            # Process batters
            batters = team_data.get('players', {})
            for player_id_str, player_data in batters.items():
                if not player_id_str.startswith('ID'):
                    continue
                    
                mlb_player_id = int(player_id_str.replace('ID', ''))
                
                # Skip if we don't have this player in our database
                if mlb_player_id not in player_mapping:
                    continue
                
                db_player_id = player_mapping[mlb_player_id]
                
                # Get batting stats
                batting = player_data.get('stats', {}).get('batting', {})
                if batting:
                    stat_entry = {
                        'player_id': db_player_id,
                        'game_date': game_date,
                        'opponent': opponent_abbr,
                        'home_away': 'H' if side == 'home' else 'A',
                        'mlb_team': team_abbr,  # ADD THIS
                        'at_bats': batting.get('atBats', 0),
                        'hits': batting.get('hits', 0),
                        'runs': batting.get('runs', 0),
                        'rbi': batting.get('rbi', 0),
                        'home_runs': batting.get('homeRuns', 0),
                        'doubles': batting.get('doubles', 0),
                        'triples': batting.get('triples', 0),
                        'stolen_bases': batting.get('stolenBases', 0),
                        'caught_stealing': batting.get('caughtStealing', 0),
                        'walks': batting.get('baseOnBalls', 0),
                        'strikeouts': batting.get('strikeOuts', 0),
                        'hit_by_pitch': batting.get('hitByPitch', 0),
                        'sacrifice_flies': batting.get('sacFlies', 0),
                        'sacrifice_bunts': batting.get('sacBunts', 0),
                        # Pitching stats (will be 0 for batters)
                        'innings_pitched': 0,
                        'wins': 0,
                        'losses': 0,
                        'saves': 0,
                        'blown_saves': 0,
                        'holds': 0,
                        'earned_runs': 0,
                        'hits_allowed': 0,
                        'walks_allowed': 0,
                        'strikeouts_pitched': 0,
                        'home_runs_allowed': 0,
                        'quality_starts': 0
                    }
                    
                    stats.append(stat_entry)
                
                # Get pitching stats
                pitching = player_data.get('stats', {}).get('pitching', {})
                if pitching and pitching.get('inningsPitched'):
                    # Update the existing entry or create new one
                    ip_str = pitching.get('inningsPitched', '0.0')
                    ip = parse_innings_pitched(ip_str)
                    er = pitching.get('earnedRuns', 0)
                    
                    # Find if we already have an entry for this player
                    existing_entry = None
                    for entry in stats:
                        if entry['player_id'] == db_player_id and entry['game_date'] == game_date:
                            existing_entry = entry
                            break
                    
                    if existing_entry:
                        # Update pitching stats on existing entry
                        existing_entry.update({
                            'innings_pitched': ip,
                            'wins': 1 if player_data.get('gameStatus', {}).get('isWin', False) else 0,
                            'losses': 1 if player_data.get('gameStatus', {}).get('isLoss', False) else 0,
                            'saves': 1 if player_data.get('gameStatus', {}).get('isSave', False) else 0,
                            'blown_saves': 1 if player_data.get('gameStatus', {}).get('isBlownSave', False) else 0,
                            'holds': 1 if player_data.get('gameStatus', {}).get('isHold', False) else 0,
                            'earned_runs': er,
                            'hits_allowed': pitching.get('hits', 0),
                            'walks_allowed': pitching.get('baseOnBalls', 0),
                            'strikeouts_pitched': pitching.get('strikeOuts', 0),
                            'home_runs_allowed': pitching.get('homeRuns', 0),
                            'quality_starts': calculate_quality_start(ip, er)
                        })
                    else:
                        # Create pitcher-only entry
                        stat_entry = {
                            'player_id': db_player_id,
                            'game_date': game_date,
                            'opponent': opponent_abbr,
                            'home_away': 'H' if side == 'home' else 'A',
                            'mlb_team': team_abbr,  # ADD THIS
                            # Batting stats (0 for pitcher-only appearance)
                            'at_bats': 0,
                            'hits': 0,
                            'runs': 0,
                            'rbi': 0,
                            'home_runs': 0,
                            'doubles': 0,
                            'triples': 0,
                            'stolen_bases': 0,
                            'caught_stealing': 0,
                            'walks': 0,
                            'strikeouts': 0,
                            'hit_by_pitch': 0,
                            'sacrifice_flies': 0,
                            'sacrifice_bunts': 0,
                            # Pitching stats
                            'innings_pitched': ip,
                            'wins': 1 if player_data.get('gameStatus', {}).get('isWin', False) else 0,
                            'losses': 1 if player_data.get('gameStatus', {}).get('isLoss', False) else 0,
                            'saves': 1 if player_data.get('gameStatus', {}).get('isSave', False) else 0,
                            'blown_saves': 1 if player_data.get('gameStatus', {}).get('isBlownSave', False) else 0,
                            'holds': 1 if player_data.get('gameStatus', {}).get('isHold', False) else 0,
                            'earned_runs': er,
                            'hits_allowed': pitching.get('hits', 0),
                            'walks_allowed': pitching.get('baseOnBalls', 0),
                            'strikeouts_pitched': pitching.get('strikeOuts', 0),
                            'home_runs_allowed': pitching.get('homeRuns', 0),
                            'quality_starts': calculate_quality_start(ip, er)
                        }
                        
                        stats.append(stat_entry)
    
    except Exception as e:
        print(f"Error extracting stats: {e}")
    
    return stats

def insert_game_logs(stats: List[Dict]) -> int:
    """Insert game logs into database"""
    if not stats:
        return 0
    
    inserted = 0
    
    for stat in stats:
        # Remove fields that don't exist in the table
        stat_copy = stat.copy()
        stat_copy.pop('sacrifice_flies', None)
        stat_copy.pop('sacrifice_bunts', None)
        stat_copy.pop('home_runs_allowed', None)
        
        sql = """
        INSERT INTO player_game_logs (
            player_id, game_date, opponent, home_away, mlb_team,
            at_bats, hits, runs, rbi, home_runs, doubles, triples,
            stolen_bases, caught_stealing, walks, strikeouts, hit_by_pitch,
            innings_pitched, wins, losses, saves, blown_saves, holds,
            earned_runs, hits_allowed, walks_allowed, strikeouts_pitched,
            quality_starts
        ) VALUES (
            :player_id, CAST(:game_date AS DATE), :opponent, :home_away, :mlb_team,
            :at_bats, :hits, :runs, :rbi, :home_runs, :doubles, :triples,
            :stolen_bases, :caught_stealing, :walks, :strikeouts, :hit_by_pitch,
            :innings_pitched, :wins, :losses, :saves, :blown_saves, :holds,
            :earned_runs, :hits_allowed, :walks_allowed, :strikeouts_pitched,
            :quality_starts
        )
        ON CONFLICT (player_id, game_date) DO NOTHING
        """
        
        try:
            execute_sql(sql, stat_copy)
            inserted += 1
        except Exception as e:
            print(f"Error inserting game log for player {stat_copy['player_id']} on {stat_copy['game_date']}: {e}")
    
    return inserted

def main():
    """Main function to fetch and populate missing game logs"""
    
    # Dates we're missing (based on your query results)
    missing_dates = [
        '2025-09-04',
        '2025-09-05', 
        '2025-09-06',
        '2025-09-07',
        '2025-09-08'
    ]
    
    print("Fetching player ID mapping...")
    player_mapping = get_player_id_mapping()
    print(f"Found {len(player_mapping)} players in database")
    
    total_inserted = 0
    
    for date_str in missing_dates:
        print(f"\nProcessing {date_str}...")
        
        # Get games for this date
        game_pks = fetch_schedule(date_str)
        print(f"Found {len(game_pks)} games on {date_str}")
        
        date_stats = []
        
        for i, game_pk in enumerate(game_pks, 1):
            print(f"  Fetching game {i}/{len(game_pks)}: {game_pk}")
            
            # Fetch game data
            game_data = fetch_game_data(game_pk)
            
            if game_data:
                # Extract stats
                stats = extract_player_stats(game_data, date_str, player_mapping)
                date_stats.extend(stats)
                print(f"    Extracted {len(stats)} player stats")
            
            # Rate limit to avoid overwhelming the API
            time.sleep(1)
        
        # Insert all stats for this date
        if date_stats:
            inserted = insert_game_logs(date_stats)
            print(f"Inserted {inserted} game logs for {date_str}")
            total_inserted += inserted
    
    print(f"\nTotal game logs inserted: {total_inserted}")
    
    # Verify Keller's 9/6 game specifically
    print("\nVerifying Keller's 9/6 game...")
    sql = """
    SELECT game_date, opponent, innings_pitched, earned_runs 
    FROM player_game_logs 
    WHERE player_id = 656605 
    AND game_date = '2025-09-06'
    """
    
    response = execute_sql(sql)
    if response and response.get('records'):
        print("Keller's 9/6 game found:", response['records'][0])
    else:
        print("WARNING: Keller's 9/6 game still not found - may need manual investigation")

if __name__ == "__main__":
    main()