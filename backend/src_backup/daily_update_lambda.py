"""
Dedicated Lambda Function for Dynasty Dugout Daily Updates
This is the production-ready, serverless version of the daily stats updater.
It runs on a schedule and reads its configuration from environment variables.
"""
import os
import boto3
import requests
import time
from datetime import datetime, timedelta
import logging

# Configure logging for Lambda
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Get DB config from environment variables provided by template.yaml
DB_CLUSTER_ARN = os.environ.get('DB_CLUSTER_ARN')
DB_SECRET_ARN = os.environ.get('DB_SECRET_ARN')
REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Global client for connection reuse
rds_client = boto3.client('rds-data', region_name=REGION)

def execute_sql(sql, params=None, database='postgres'):
    """Helper function to execute SQL using the RDS Data API"""
    try:
        request = {
            'resourceArn': DB_CLUSTER_ARN,
            'secretArn': DB_SECRET_ARN,
            'database': database,
            'sql': sql
        }
        if params:
            formatted_params = []
            for name, value in params.items():
                param = {'name': name}
                if isinstance(value, bool):
                    param['value'] = {'booleanValue': value}
                elif isinstance(value, int):
                    param['value'] = {'longValue': value}
                elif isinstance(value, float):
                    param['value'] = {'doubleValue': value}
                elif value is None:
                    param['value'] = {'isNull': True}
                else:
                    param['value'] = {'stringValue': str(value)}
                formatted_params.append(param)
            request['parameters'] = formatted_params
        
        return rds_client.execute_statement(**request)
    except Exception as e:
        logger.error(f"SQL Error on DB '{database}': {e}")
        logger.error(f"Failing SQL: {sql[:500]}...")
        raise

def fetch_and_insert_game_logs(date_str):
    """Fetches game data from MLB API and inserts it into the player_game_logs table."""
    logger.info(f"Fetching games for {date_str}")
    schedule_url = f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={date_str}"
    response = requests.get(schedule_url, timeout=15)
    schedule_data = response.json()

    if not schedule_data.get('dates'):
        logger.info(f"No games found for {date_str}.")
        return 0

    games = schedule_data['dates'][0].get('games', [])
    logs_inserted = 0
    for game in games:
        if game.get('status', {}).get('abstractGameState') != 'Final':
            continue

        game_pk = game['gamePk']
        boxscore_url = f"https://statsapi.mlb.com/api/v1/game/{game_pk}/boxscore"
        boxscore_response = requests.get(boxscore_url, timeout=15)
        boxscore_data = boxscore_response.json()

        for team_type in ['home', 'away']:
            players = boxscore_data.get('teams', {}).get(team_type, {}).get('players', {})
            for player_id_str, player_data in players.items():
                stats = player_data.get('stats', {})
                if not (stats.get('batting') or stats.get('pitching')):
                    continue
                
                player_id = int(player_id_str.replace('ID', ''))
                batting = stats.get('batting', {})
                pitching = stats.get('pitching', {})
                
                ip = float(pitching.get('inningsPitched', 0.0) or 0.0)
                er = pitching.get('earnedRuns', 0)
                is_quality_start = (ip >= 6.0 and er <= 3)

                log = {
                    'player_id': player_id, 'game_date': date_str,
                    'at_bats': batting.get('atBats', 0), 'hits': batting.get('hits', 0),
                    'doubles': batting.get('doubles', 0), 'triples': batting.get('triples', 0),
                    'runs': batting.get('runs', 0), 'rbis': batting.get('rbi', 0),
                    'home_runs': batting.get('homeRuns', 0), 'walks': batting.get('baseOnBalls', 0),
                    'strikeouts': batting.get('strikeOuts', 0), 'stolen_bases': batting.get('stolenBases', 0),
                    'innings_pitched': ip, 'wins': 1 if pitching.get('wins') else 0,
                    'losses': 1 if pitching.get('losses') else 0, 'saves': 1 if pitching.get('saves') else 0,
                    'earned_runs': er, 'hits_allowed': pitching.get('hits', 0),
                    'walks_allowed': pitching.get('baseOnBalls', 0),
                    'strikeouts_pitched': pitching.get('strikeOuts', 0),
                    'quality_start': is_quality_start
                }

                execute_sql("""
                    INSERT INTO player_game_logs (
                        player_id, game_date, at_bats, hits, doubles, triples, runs, rbis, home_runs,
                        walks, strikeouts, stolen_bases, innings_pitched, wins, losses, saves, earned_runs,
                        hits_allowed, walks_allowed, strikeouts_pitched, quality_start
                    ) VALUES (
                        :player_id, :game_date::date, :at_bats, :hits, :doubles, :triples, :runs, :rbis, :home_runs,
                        :walks, :strikeouts, :stolen_bases, :innings_pitched, :wins, :losses, :saves, :earned_runs,
                        :hits_allowed, :walks_allowed, :strikeouts_pitched, :quality_start
                    ) ON CONFLICT (player_id, game_date) DO UPDATE SET
                        at_bats = EXCLUDED.at_bats, hits = EXCLUDED.hits, home_runs = EXCLUDED.home_runs,
                        rbis = EXCLUDED.rbis, runs = EXCLUDED.runs, stolen_bases = EXCLUDED.stolen_bases,
                        innings_pitched = EXCLUDED.innings_pitched, wins = EXCLUDED.wins, losses = EXCLUDED.losses,
                        saves = EXCLUDED.saves, strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                        earned_runs = EXCLUDED.earned_runs, quality_start = EXCLUDED.quality_start,
                        updated_at = NOW()
                """, log)
                logs_inserted += 1
    logger.info(f"Inserted/updated {logs_inserted} game logs for {date_str}.")
    return logs_inserted

def recalculate_season_stats():
    """Recalculates and updates the player_stats table for the 2025 season."""
    logger.info("Recalculating all 2025 season stats...")
    execute_sql("DELETE FROM player_stats WHERE season = 2025")
    
    recalc_sql = """
        INSERT INTO player_stats (
            player_id, season, games_played, at_bats, hits, doubles, triples, home_runs, rbi, runs,
            walks, strikeouts, stolen_bases, avg, obp, slg, ops, innings_pitched, wins, losses,
            saves, quality_starts, earned_runs, hits_allowed, walks_allowed, strikeouts_pitched, era, whip
        )
        SELECT 
            player_id, 2025 as season, COUNT(DISTINCT game_date),
            COALESCE(SUM(at_bats), 0), COALESCE(SUM(hits), 0), COALESCE(SUM(doubles), 0),
            COALESCE(SUM(triples), 0), COALESCE(SUM(home_runs), 0), COALESCE(SUM(rbis), 0),
            COALESCE(SUM(runs), 0), COALESCE(SUM(walks), 0), COALESCE(SUM(strikeouts), 0),
            COALESCE(SUM(stolen_bases), 0),
            -- Rate Stats
            CASE WHEN SUM(at_bats) > 0 THEN SUM(hits)::float / SUM(at_bats) ELSE 0 END as avg,
            CASE WHEN (SUM(at_bats) + SUM(walks)) > 0 THEN (SUM(hits) + SUM(walks))::float / (SUM(at_bats) + SUM(walks)) ELSE 0 END as obp,
            CASE WHEN SUM(at_bats) > 0 THEN ((SUM(hits) - SUM(doubles) - SUM(triples) - SUM(home_runs)) + (2*SUM(doubles)) + (3*SUM(triples)) + (4*SUM(home_runs)))::float / SUM(at_bats) ELSE 0 END as slg,
            0 as ops, -- Will be updated in a separate step
            COALESCE(SUM(innings_pitched), 0), COALESCE(SUM(wins), 0), COALESCE(SUM(losses), 0),
            COALESCE(SUM(saves), 0), COALESCE(SUM(CASE WHEN quality_start THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(earned_runs), 0), COALESCE(SUM(hits_allowed), 0), COALESCE(SUM(walks_allowed), 0),
            COALESCE(SUM(strikeouts_pitched), 0),
            CASE WHEN SUM(innings_pitched) > 0 THEN (SUM(earned_runs) * 9.0) / SUM(innings_pitched) ELSE 0 END as era,
            CASE WHEN SUM(innings_pitched) > 0 THEN (SUM(walks_allowed) + SUM(hits_allowed))::float / SUM(innings_pitched) ELSE 0 END as whip
        FROM player_game_logs
        WHERE EXTRACT(YEAR FROM game_date) = 2025
        GROUP BY player_id
    """
    execute_sql(recalc_sql)
    execute_sql("UPDATE player_stats SET ops = obp + slg WHERE season = 2025")
    logger.info("✅ Season stats recalculation complete.")

def lambda_handler(event, context):
    """AWS Lambda handler for daily stats updates."""
    start_time = datetime.utcnow()
    logger.info("🚀 Dynasty Dugout Daily Stats Updater Lambda started.")
    
    if not DB_CLUSTER_ARN or not DB_SECRET_ARN:
        logger.error("❌ Database ARN or Secret ARN environment variables not set.")
        return {'statusCode': 500, 'body': 'Configuration error.'}

    try:
        # Default to updating yesterday's games
        yesterday = datetime.now() - timedelta(days=1)
        date_str = yesterday.strftime('%Y-%m-%d')
        
        fetch_and_insert_game_logs(date_str)
        recalculate_season_stats()
        
        duration = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"✅ Daily update completed successfully in {duration:.2f} seconds.")
        return {'statusCode': 200, 'body': 'Update complete.'}

    except Exception as e:
        logger.error(f"❌ Daily update failed: {str(e)}", exc_info=True)
        return {'statusCode': 500, 'body': f"An error occurred: {e}"}
