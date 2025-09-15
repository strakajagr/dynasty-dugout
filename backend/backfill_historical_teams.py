"""
Backfill team data for historical player_season_stats
Fetches team information from MLB API for each player-season combination
"""
import json
import logging
import boto3
import os
import requests
import time
from datetime import datetime, date

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# Database configuration
DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
rds_client = boto3.client('rds-data', region_name='us-east-1')

# MLB Team ID to Abbreviation mapping
MLB_TEAM_MAPPING = {
    108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC',
    113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
    118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'OAK',
    134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL',
    139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI',
    144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL'
}

def execute_sql(sql, params=None, database='postgres'):
    """Execute SQL using RDS Data API"""
    try:
        request = {
            'resourceArn': DB_CLUSTER_ARN,
            'secretArn': DB_SECRET_ARN,
            'database': database,
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

def get_team_abbreviation(team_data):
    """Convert team data to abbreviation"""
    if isinstance(team_data, dict):
        team_id = team_data.get('id')
        if team_id in MLB_TEAM_MAPPING:
            return MLB_TEAM_MAPPING[team_id]
    return ''

def fetch_player_season_stats(player_id, season):
    """Fetch player stats for a specific season from MLB API"""
    try:
        # Try the standard stats endpoint
        url = f"https://statsapi.mlb.com/api/v1/people/{player_id}/stats"
        params = {
            'stats': 'yearByYear',
            'group': 'hitting,pitching',
            'season': season
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stats = data.get('stats', [])
            
            # Look through stats to find the team for this season
            for stat_group in stats:
                splits = stat_group.get('splits', [])
                for split in splits:
                    if split.get('season', '') == str(season):
                        team = split.get('team', {})
                        team_abbr = get_team_abbreviation(team)
                        if team_abbr:
                            return team_abbr
                        
        # Alternative: Try to get from player info with season filter
        url2 = f"https://statsapi.mlb.com/api/v1/people/{player_id}"
        params2 = {
            'season': season,
            'hydrate': 'stats(group=[hitting,pitching],type=[yearByYear])'
        }
        
        response2 = requests.get(url2, params=params2, timeout=10)
        
        if response2.status_code == 200:
            data2 = response2.json()
            people = data2.get('people', [])
            if people:
                # Check if we can get team from stats
                person = people[0]
                stats = person.get('stats', [])
                for stat_group in stats:
                    splits = stat_group.get('splits', [])
                    for split in splits:
                        if split.get('season', '') == str(season):
                            team = split.get('team', {})
                            team_abbr = get_team_abbreviation(team)
                            if team_abbr:
                                return team_abbr
                            
        return None
        
    except Exception as e:
        logger.error(f"Error fetching stats for player {player_id} season {season}: {e}")
        return None

def backfill_teams_for_season(season):
    """Backfill team data for all players in a specific season"""
    logger.info(f"Processing season {season}")
    
    # Get all players needing team data for this season
    sql = """
    SELECT DISTINCT player_id 
    FROM player_season_stats 
    WHERE season = :season 
    AND (mlb_team IS NULL OR mlb_team = '')
    AND games_played > 0
    ORDER BY player_id
    """
    
    result = execute_sql(sql, {'season': season})
    
    if not result or not result.get('records'):
        logger.info(f"No players need team data for {season}")
        return 0
    
    players = []
    for record in result['records']:
        player_id = record[0].get('longValue')
        if player_id:
            players.append(player_id)
    
    logger.info(f"Found {len(players)} players needing team data for {season}")
    
    updates = 0
    for i, player_id in enumerate(players):
        # Fetch team from MLB API
        team_abbr = fetch_player_season_stats(player_id, season)
        
        if team_abbr:
            # Update the database
            update_sql = """
            UPDATE player_season_stats 
            SET mlb_team = :team
            WHERE player_id = :player_id 
            AND season = :season
            """
            
            result = execute_sql(update_sql, {
                'player_id': player_id,
                'season': season,
                'team': team_abbr
            })
            
            if result.get('numberOfRecordsUpdated', 0) > 0:
                updates += 1
                logger.info(f"  Updated player {player_id} to {team_abbr}")
        
        # Rate limit - MLB API allows about 500 requests per minute
        time.sleep(0.15)
        
        # Progress report
        if (i + 1) % 50 == 0:
            logger.info(f"  Progress: {i + 1}/{len(players)} players, {updates} updated")
    
    logger.info(f"✅ Season {season}: Updated {updates}/{len(players)} players")
    return updates

def backfill_from_current_team():
    """For any remaining nulls, use current team as fallback"""
    logger.info("Backfilling remaining nulls with current team")
    
    sql = """
    UPDATE player_season_stats ps 
    SET mlb_team = (
        SELECT mlb_team 
        FROM mlb_players p 
        WHERE p.player_id = ps.player_id
    )
    WHERE ps.mlb_team IS NULL 
    AND EXISTS (
        SELECT 1 FROM mlb_players p 
        WHERE p.player_id = ps.player_id 
        AND p.mlb_team IS NOT NULL
    )
    """
    
    result = execute_sql(sql)
    updated = result.get('numberOfRecordsUpdated', 0)
    logger.info(f"Updated {updated} records with current team as fallback")
    return updated

def main():
    """Main backfill process"""
    logger.info("Starting historical team data backfill")
    
    # First, ensure the column exists
    logger.info("Ensuring mlb_team column exists...")
    execute_sql("ALTER TABLE player_season_stats ADD COLUMN IF NOT EXISTS mlb_team VARCHAR(10)")
    
    # For 2025, we can use game logs
    logger.info("Updating 2025 from game logs...")
    sql_2025 = """
    UPDATE player_season_stats ps 
    SET mlb_team = (
        SELECT mlb_team 
        FROM player_game_logs gl 
        WHERE gl.player_id = ps.player_id 
        AND EXTRACT(YEAR FROM gl.game_date) = ps.season 
        GROUP BY mlb_team 
        ORDER BY COUNT(*) DESC 
        LIMIT 1
    ) 
    WHERE ps.season = 2025 
    AND ps.mlb_team IS NULL
    """
    result = execute_sql(sql_2025)
    logger.info(f"Updated {result.get('numberOfRecordsUpdated', 0)} records for 2025")
    
    # Process historical seasons (2019-2024)
    total_updates = 0
    for season in range(2024, 2018, -1):  # 2024 down to 2019
        updates = backfill_teams_for_season(season)
        total_updates += updates
    
    # Use current team as fallback for any remaining
    fallback_updates = backfill_from_current_team()
    total_updates += fallback_updates
    
    # Final statistics
    result = execute_sql("""
    SELECT 
        COUNT(*) as total_records,
        COUNT(mlb_team) as with_team,
        COUNT(*) - COUNT(mlb_team) as missing_team,
        ROUND(COUNT(mlb_team)::numeric / COUNT(*) * 100, 2) as percentage
    FROM player_season_stats
    WHERE games_played > 0
    """)
    
    if result and result.get('records'):
        record = result['records'][0]
        total = record[0].get('longValue', 0)
        with_team = record[1].get('longValue', 0)
        missing = record[2].get('longValue', 0)
        pct = record[3].get('stringValue', '0')
        
        logger.info(f"""
        ✅ BACKFILL COMPLETE
        📊 Final Statistics:
        - Total records: {total}
        - With team data: {with_team}
        - Missing team: {missing}
        - Coverage: {pct}%
        """)

if __name__ == "__main__":
    main()