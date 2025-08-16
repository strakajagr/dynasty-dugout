#!/usr/bin/env python3
"""
MLB Stats Service - Automated Daily Data Pipeline
PURPOSE: Fetches daily MLB game logs, calculates season stats, and syncs them
to all league databases. This script is designed to be run once daily as a
scheduled job (e.g., via AWS Lambda with an EventBridge trigger).
"""

import boto3
import json
import requests
import logging
from datetime import datetime, timedelta
import time
from typing import List, Dict, Any, Optional

# Configure logging for better visibility
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MLBStatsService:
    """Service for managing the complete daily MLB stats data pipeline."""

    def __init__(self, db_cluster_arn: str, db_secret_arn: str, region: str = 'us-east-1'):
        """Initialize the stats service with necessary AWS resources."""
        self.rds_client = boto3.client('rds-data', region_name=region)
        self.db_cluster_arn = db_cluster_arn
        self.db_secret_arn = db_secret_arn

    def execute_sql(self, sql: str, params: Optional[Dict] = None, db_name: str = 'postgres') -> Dict:
        """Executes a SQL statement using the RDS Data API."""
        try:
            # Format parameters for the RDS Data API
            formatted_params = []
            if params:
                for name, value in params.items():
                    param = {'name': name}
                    # ✅ REORDERED CHECKS: The more specific 'bool' check must come BEFORE 'int'
                    if isinstance(value, bool):
                        param['value'] = {'booleanValue': value}
                    elif isinstance(value, int):
                        param['value'] = {'longValue': value}
                    elif isinstance(value, float):
                        param['value'] = {'doubleValue': value}
                    elif isinstance(value, str):
                        param['value'] = {'stringValue': value}
                    elif value is None:
                        param['value'] = {'isNull': True}
                    else:
                        param['value'] = {'stringValue': str(value)}
                    formatted_params.append(param)

            response = self.rds_client.execute_statement(
                resourceArn=self.db_cluster_arn,
                secretArn=self.db_secret_arn,
                database=db_name,
                sql=sql,
                parameters=formatted_params,
                includeResultMetadata=True
            )
            return response

        except Exception as e:
            logger.error(f"Database error in '{db_name}' executing SQL: {sql[:150]}... Error: {e}")
            raise

    def fetch_daily_game_logs(self, target_date: str) -> List[Dict]:
        """Fetches all player game logs for a specific date, including Quality Start detection."""
        logger.info(f"Fetching game logs for date: {target_date}")
        schedule_url = f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={target_date}"
        all_game_logs = []

        try:
            schedule_response = requests.get(schedule_url, timeout=15)
            schedule_response.raise_for_status()
            games = schedule_response.json().get('dates', [])[0].get('games', [])
            game_pks = [game['gamePk'] for game in games if game.get('status', {}).get('abstractGameState') == 'Final']
            logger.info(f"Found {len(game_pks)} completed games for {target_date}.")

            for i, pk in enumerate(game_pks):
                logger.info(f"Processing game {i+1}/{len(game_pks)} (ID: {pk})...")
                boxscore_url = f"https://statsapi.mlb.com/api/v1/game/{pk}/boxscore"
                boxscore_data = requests.get(boxscore_url, timeout=15).json()

                for team_loc in ['home', 'away']:
                    players = boxscore_data.get('teams', {}).get(team_loc, {}).get('players', {})
                    for player_id_str, data in players.items():
                        if not (data.get('stats', {}).get('batting') or data.get('stats', {}).get('pitching')):
                            continue

                        batting = data.get('stats', {}).get('batting', {})
                        pitching = data.get('stats', {}).get('pitching', {})

                        ip = float(pitching.get('inningsPitched', 0.0))
                        er = pitching.get('earnedRuns', 0)
                        is_quality_start = True if ip >= 6.0 and er <= 3 else False

                        all_game_logs.append({
                            "player_id": int(player_id_str.replace('ID', '')), "game_date": target_date,
                            "at_bats": batting.get('atBats', 0), "hits": batting.get('hits', 0),
                            "doubles": batting.get('doubles', 0), "triples": batting.get('triples', 0),
                            "runs": batting.get('runs', 0), "rbi": batting.get('rbi', 0),
                            "home_runs": batting.get('homeRuns', 0), "walks": batting.get('baseOnBalls', 0),
                            "strikeouts": batting.get('strikeOuts', 0), "stolen_bases": batting.get('stolenBases', 0),
                            "hit_by_pitch": batting.get('hitByPitch', 0),
                            "innings_pitched": ip, "wins": 1 if pitching.get('wins', 0) == 1 else 0,
                            "losses": 1 if pitching.get('losses', 0) == 1 else 0,
                            "saves": 1 if pitching.get('saves', 0) == 1 else 0,
                            "earned_runs": er, "hits_allowed": pitching.get('hits', 0),
                            "walks_allowed": pitching.get('baseOnBalls', 0), "strikeouts_pitched": pitching.get('strikeOuts', 0),
                            "quality_start": is_quality_start
                        })
                time.sleep(0.5) # Be respectful to the API
        except Exception as e:
            logger.error(f"Error fetching data from MLB API: {e}")
            return []

        logger.info(f"Successfully fetched {len(all_game_logs)} total player game logs.")
        return all_game_logs

    def insert_game_logs(self, game_logs: List[Dict]):
        """Inserts a batch of game logs, including the quality_start flag, into the main database."""
        if not game_logs:
            logger.info("No new game logs to insert.")
            return

        logger.info(f"Inserting/updating {len(game_logs)} game logs into the main database...")
        # This loop is for clarity; a true batch insert is more performant.
        for log in game_logs:
            sql = """
                INSERT INTO player_game_logs (player_id, game_date, at_bats, hits, doubles, triples, runs, rbi, home_runs, walks, strikeouts, stolen_bases, hit_by_pitch, innings_pitched, wins, losses, saves, earned_runs, hits_allowed, walks_allowed, strikeouts_pitched, quality_start)
                VALUES (:player_id, :game_date::date, :at_bats, :hits, :doubles, :triples, :runs, :rbi, :home_runs, :walks, :strikeouts, :stolen_bases, :hit_by_pitch, :innings_pitched, :wins, :losses, :saves, :earned_runs, :hits_allowed, :walks_allowed, :strikeouts_pitched, :quality_start)
                ON CONFLICT (player_id, game_date) DO UPDATE SET
                    at_bats = EXCLUDED.at_bats, hits = EXCLUDED.hits, doubles = EXCLUDED.doubles, triples = EXCLUDED.triples, runs = EXCLUDED.runs, rbi = EXCLUDED.rbi, home_runs = EXCLUDED.home_runs, walks = EXCLUDED.walks, strikeouts = EXCLUDED.strikeouts, stolen_bases = EXCLUDED.stolen_bases, hit_by_pitch = EXCLUDED.hit_by_pitch,
                    innings_pitched = EXCLUDED.innings_pitched, wins = EXCLUDED.wins, losses = EXCLUDED.losses, saves = EXCLUDED.saves, earned_runs = EXCLUDED.earned_runs, hits_allowed = EXCLUDED.hits_allowed, walks_allowed = EXCLUDED.walks_allowed, strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                    quality_start = EXCLUDED.quality_start;
            """
            self.execute_sql(sql, log)
        logger.info("✅ Game log insertion complete.")

    def calculate_and_store_season_stats(self):
        """Calculates 2025 season stats from all game logs in the main database."""
        logger.info("Calculating 2025 season stats from game logs (including Quality Starts)...")
        sql = """
            INSERT INTO player_stats (player_id, season, games_played, at_bats, hits, doubles, triples, home_runs, rbi, runs, walks, strikeouts, stolen_bases, avg, obp, slg, ops, innings_pitched, wins, losses, saves, quality_starts, earned_runs, hits_allowed, walks_allowed, strikeouts_pitched, era, whip, last_updated)
            SELECT
                player_id, 2025 AS season, COUNT(*) AS games_played, SUM(at_bats) AS at_bats, SUM(hits) AS hits, SUM(doubles) AS doubles, SUM(triples) AS triples, SUM(home_runs) AS home_runs, SUM(rbi) AS rbi, SUM(runs) AS runs, SUM(walks) AS walks, SUM(strikeouts) AS strikeouts, SUM(stolen_bases) AS stolen_bases,
                CASE WHEN SUM(at_bats) > 0 THEN ROUND(SUM(hits)::NUMERIC / SUM(at_bats), 3) ELSE 0 END AS avg,
                CASE WHEN (SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch)) > 0 THEN ROUND((SUM(hits) + SUM(walks) + SUM(hit_by_pitch))::NUMERIC / (SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch)), 3) ELSE 0 END AS obp,
                CASE WHEN SUM(at_bats) > 0 THEN ROUND((SUM(hits) - SUM(doubles) - SUM(triples) - SUM(home_runs) + (2*SUM(doubles)) + (3*SUM(triples)) + (4*SUM(home_runs)))::NUMERIC / SUM(at_bats), 3) ELSE 0 END AS slg,
                0.000 AS ops, SUM(innings_pitched) AS innings_pitched, SUM(wins) AS wins, SUM(losses) AS losses, SUM(saves) AS saves, SUM(CASE WHEN quality_start THEN 1 ELSE 0 END) AS quality_starts, SUM(earned_runs) AS earned_runs, SUM(hits_allowed) AS hits_allowed, SUM(walks_allowed) AS walks_allowed, SUM(strikeouts_pitched) AS strikeouts_pitched,
                CASE WHEN SUM(innings_pitched) > 0 THEN ROUND((SUM(earned_runs) * 9.0) / SUM(innings_pitched), 2) ELSE 0 END AS era,
                CASE WHEN SUM(innings_pitched) > 0 THEN ROUND((SUM(walks_allowed) + SUM(hits_allowed))::NUMERIC / SUM(innings_pitched), 3) ELSE 0 END AS whip,
                NOW() AS last_updated
            FROM player_game_logs WHERE EXTRACT(YEAR FROM game_date) = 2025 GROUP BY player_id
            ON CONFLICT (player_id, season) DO UPDATE SET
                games_played=EXCLUDED.games_played, at_bats=EXCLUDED.at_bats, hits=EXCLUDED.hits, doubles=EXCLUDED.doubles, triples=EXCLUDED.triples, home_runs=EXCLUDED.home_runs, rbi=EXCLUDED.rbi, runs=EXCLUDED.runs, walks=EXCLUDED.walks, strikeouts=EXCLUDED.strikeouts, stolen_bases=EXCLUDED.stolen_bases, avg=EXCLUDED.avg, obp=EXCLUDED.obp, slg=EXCLUDED.slg,
                innings_pitched=EXCLUDED.innings_pitched, wins=EXCLUDED.wins, losses=EXCLUDED.losses, saves=EXCLUDED.saves, quality_starts=EXCLUDED.quality_starts, earned_runs=EXCLUDED.earned_runs, hits_allowed=EXCLUDED.hits_allowed, walks_allowed=EXCLUDED.walks_allowed, strikeouts_pitched=EXCLUDED.strikeouts_pitched, era=EXCLUDED.era, whip=EXCLUDED.whip, last_updated=NOW();
        """
        self.execute_sql(sql)
        self.execute_sql("UPDATE player_stats SET ops = obp + slg WHERE season = 2025;")
        logger.info("✅ Season stat calculation complete.")

    def sync_stats_to_all_leagues(self):
        """Copies the calculated season stats from the main DB to every league DB."""
        logger.info("Syncing calculated stats to all active leagues...")
        
        leagues_res = self.execute_sql("SELECT database_name FROM user_leagues WHERE status = 'active'")
        if not leagues_res.get('records'):
            logger.warning("No active leagues found to sync.")
            return
        league_dbs = [rec[0]['stringValue'] for rec in leagues_res['records']]

        # Get column names from a table to build the query dynamically
        meta_res = self.execute_sql("SELECT * FROM player_stats WHERE 1=0;")
        cols = [m['name'] for m in meta_res['columnMetadata']]
        
        # Ensure season_year is used for the league table
        league_cols = [c if c != 'season' else 'season_year' for c in cols]
        
        # Fetch all stats from main DB
        stats_res = self.execute_sql(f"SELECT {', '.join(cols)} FROM player_stats WHERE season = 2025;")
        if not stats_res.get('records'):
            logger.warning("No calculated stats found in main DB to sync.")
            return

        for db_name in league_dbs:
            logger.info(f"Syncing {len(stats_res['records'])} players to {db_name}...")
            # This should be a single batch call in production for performance
            for record in stats_res['records']:
                params = {}
                for i, col_name in enumerate(cols):
                    value = record[i].get(list(record[i].keys())[0]) if not record[i].get('isNull') else None
                    params[col_name] = value

                sql = f"""
                    INSERT INTO player_season_stats ({', '.join(league_cols)})
                    VALUES ({', '.join([f':{c}' for c in cols])})
                    ON CONFLICT (player_id, season_year) DO UPDATE SET
                    {', '.join([f'{lc} = EXCLUDED.{lc}' for lc in league_cols if lc not in ['player_id', 'season_year']])};
                """
                self.execute_sql(sql, params, db_name=db_name)
            logger.info(f"✅ Finished sync for {db_name}.")
        logger.info("✅ All leagues have been synced.")


    def run_daily_pipeline(self):
        """Runs the full daily data pipeline in the correct sequence."""
        logger.info("🚀🚀🚀 STARTING DAILY DATA PIPELINE 🚀🚀🚀")
        start_time = datetime.now()
        
        #yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        target_date = '2025-07-23' # Start with the first missing day
        
        # Step 1: Fetch yesterday's game logs from the MLB API
        game_logs = self.fetch_daily_game_logs(target_date)
        
        # Step 2: Insert the new raw logs into our main database
        self.insert_game_logs(game_logs)
        
        # Step 3: Calculate aggregated season stats from all game logs
        self.calculate_and_store_season_stats()
        
        # Step 4: Sync the aggregated stats to all league databases
        self.sync_stats_to_all_leagues()

        duration = datetime.now() - start_time
        logger.info(f"🎉🎉🎉 PIPELINE COMPLETE. Duration: {duration} 🎉🎉🎉")


def main():
    """Main function for command line execution."""
    # These should be fetched from environment variables or a config file in production
    DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball'
    DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:rds!cluster-a4ca625a-7cb4-484a-8707-80f27e403c70-pwORGg'
    
    service = MLBStatsService(db_cluster_arn=DB_CLUSTER_ARN, db_secret_arn=DB_SECRET_ARN)
    service.run_daily_pipeline()

if __name__ == "__main__":
    main()