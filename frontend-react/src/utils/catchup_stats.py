#!/usr/bin/env python3
"""
Catch-up script to process all missing MLB game logs from a start date to yesterday
Run this locally or as a Lambda function to backfill all missing stats
"""

import os
import sys
import boto3
import requests
import logging
from datetime import datetime, timedelta, date
import json
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration - update these for your environment
DB_CLUSTER_ARN = os.environ.get('DB_CLUSTER_ARN', 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless')
DB_SECRET_ARN = os.environ.get('DB_SECRET_ARN', 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb')
REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Season configuration
CURRENT_SEASON = 2025
SEASON_START = '2025-03-20'  # Opening Day 2025
CATCHUP_START = '2025-08-18'  # Start catching up from this date

rds_client = boto3.client('rds-data', region_name=REGION)
lambda_client = boto3.client('lambda', region_name=REGION)

def execute_sql(sql, parameters=None, database='postgres'):
    """Execute SQL using RDS Data API"""
    try:
        request = {
            'resourceArn': DB_CLUSTER_ARN,
            'secretArn': DB_SECRET_ARN,
            'database': database,
            'sql': sql
        }
        if parameters:
            request['parameters'] = []
            for k, v in parameters.items():
                if v is None:
                    request['parameters'].append({'name': k, 'value': {'isNull': True}})
                elif isinstance(v, int):
                    request['parameters'].append({'name': k, 'value': {'longValue': v}})
                elif isinstance(v, float):
                    request['parameters'].append({'name': k, 'value': {'doubleValue': v}})
                elif isinstance(v, bool):
                    request['parameters'].append({'name': k, 'value': {'booleanValue': v}})
                else:
                    request['parameters'].append({'name': k, 'value': {'stringValue': str(v)}})
        return rds_client.execute_statement(**request)
    except Exception as e:
        logger.error(f"SQL Error: {e}")
        raise

def get_dates_needing_update():
    """Find all dates that need game logs fetched"""
    try:
        # Get the latest date we have game logs for - using f-string to avoid RDS Data API casting issues
        result = execute_sql(
            f"SELECT MAX(game_date) FROM player_game_logs WHERE game_date >= '{CATCHUP_START}'::date",
            database='postgres'
        )
        
        if result and result.get('records') and result['records'][0][0]:
            last_date_str = result['records'][0][0].get('stringValue')
            if last_date_str:
                last_date = datetime.strptime(last_date_str, '%Y-%m-%d').date()
                logger.info(f"Latest game log date in database: {last_date}")
            else:
                last_date = datetime.strptime(CATCHUP_START, '%Y-%m-%d').date() - timedelta(days=1)
        else:
            last_date = datetime.strptime(CATCHUP_START, '%Y-%m-%d').date() - timedelta(days=1)
            logger.info(f"No game logs found after {CATCHUP_START}, starting fresh")
        
        # Generate list of dates from day after last_date to yesterday
        dates_to_process = []
        current_date = last_date + timedelta(days=1)
        yesterday = date.today() - timedelta(days=1)
        
        while current_date <= yesterday:
            dates_to_process.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)
        
        logger.info(f"Found {len(dates_to_process)} dates needing processing")
        return dates_to_process
        
    except Exception as e:
        logger.error(f"Error finding dates to update: {e}")
        # Fallback: process everything from CATCHUP_START
        dates_to_process = []
        current_date = datetime.strptime(CATCHUP_START, '%Y-%m-%d').date()
        yesterday = date.today() - timedelta(days=1)
        
        while current_date <= yesterday:
            dates_to_process.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)
        
        return dates_to_process

def fetch_and_store_game_logs(date_str):
    """Fetch and store game logs for a specific date (copied from master_daily_updater)"""
    try:
        schedule_url = f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={date_str}"
        response = requests.get(schedule_url, timeout=15)
        schedule_data = response.json()
        
        if not schedule_data.get('dates'):
            logger.info(f"No games found for {date_str}")
            return 0
        
        logs_inserted = 0
        games = schedule_data['dates'][0].get('games', [])
        
        for game in games:
            if game.get('status', {}).get('abstractGameState') != 'Final':
                continue
                
            game_pk = game['gamePk']
            boxscore_url = f"https://statsapi.mlb.com/api/v1/game/{game_pk}/boxscore"
            
            try:
                boxscore_response = requests.get(boxscore_url, timeout=15)
                boxscore_data = boxscore_response.json()
            except Exception as e:
                logger.error(f"Failed to fetch boxscore for game {game_pk}: {e}")
                continue
            
            for team_type in ['home', 'away']:
                players = boxscore_data.get('teams', {}).get(team_type, {}).get('players', {})
                for player_id_str, player_data in players.items():
                    player_id = int(player_id_str.replace('ID', ''))
                    stats = player_data.get('stats', {})
                    
                    if not (stats.get('batting') or stats.get('pitching')):
                        continue
                    
                    # Ensure player exists (this will add them to leagues with rookie pricing)
                    player_info = player_data.get('person', {})
                    ensure_player_exists(player_id, player_info)
                    
                    batting = stats.get('batting', {})
                    pitching = stats.get('pitching', {})
                    
                    # Get position played
                    position_played = ''
                    if 'position' in player_data:
                        position_played = player_data.get('position', {}).get('abbreviation', '')
                    if not position_played and 'allPositions' in player_data:
                        positions = player_data.get('allPositions', [])
                        if positions:
                            position_played = positions[0].get('abbreviation', '')
                    
                    # Determine opponent
                    if team_type == 'home':
                        opponent = game.get('teams', {}).get('away', {}).get('team', {}).get('abbreviation', 'UNK')
                    else:
                        opponent = game.get('teams', {}).get('home', {}).get('team', {}).get('abbreviation', 'UNK')
                    
                    # Insert game log - NO home runs allowed tracking
                    try:
                        execute_sql(f"""
                            INSERT INTO player_game_logs (
                                player_id, game_date, opponent, position_played,
                                at_bats, hits, doubles, triples, home_runs, rbi, runs,
                                walks, strikeouts, stolen_bases, caught_stealing, hit_by_pitch,
                                innings_pitched, wins, losses, saves, blown_saves, holds,
                                earned_runs, hits_allowed, walks_allowed, strikeouts_pitched,
                                quality_start
                            ) VALUES (
                                :player_id, '{date_str}'::date, :opponent, :position_played,
                                :at_bats, :hits, :doubles, :triples, :home_runs, :rbi, :runs,
                                :walks, :strikeouts, :stolen_bases, :caught_stealing, :hit_by_pitch,
                                :innings_pitched, :wins, :losses, :saves, :blown_saves, :holds,
                                :earned_runs, :hits_allowed, :walks_allowed, :strikeouts_pitched,
                                :quality_start
                            ) ON CONFLICT (player_id, game_date) DO UPDATE SET
                                position_played = EXCLUDED.position_played,
                                at_bats = EXCLUDED.at_bats,
                                hits = EXCLUDED.hits,
                                doubles = EXCLUDED.doubles,
                                triples = EXCLUDED.triples,
                                home_runs = EXCLUDED.home_runs,
                                rbi = EXCLUDED.rbi,
                                runs = EXCLUDED.runs,
                                walks = EXCLUDED.walks,
                                strikeouts = EXCLUDED.strikeouts,
                                stolen_bases = EXCLUDED.stolen_bases,
                                caught_stealing = EXCLUDED.caught_stealing,
                                hit_by_pitch = EXCLUDED.hit_by_pitch,
                                innings_pitched = EXCLUDED.innings_pitched,
                                wins = EXCLUDED.wins,
                                losses = EXCLUDED.losses,
                                saves = EXCLUDED.saves,
                                blown_saves = EXCLUDED.blown_saves,
                                holds = EXCLUDED.holds,
                                earned_runs = EXCLUDED.earned_runs,
                                hits_allowed = EXCLUDED.hits_allowed,
                                walks_allowed = EXCLUDED.walks_allowed,
                                strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                                quality_start = EXCLUDED.quality_start
                        """, {
                            'player_id': player_id,
                            'opponent': opponent,
                            'position_played': position_played,
                            'at_bats': batting.get('atBats', 0),
                            'hits': batting.get('hits', 0),
                            'doubles': batting.get('doubles', 0),
                            'triples': batting.get('triples', 0),
                            'home_runs': batting.get('homeRuns', 0),
                            'rbi': batting.get('rbi', 0),
                            'runs': batting.get('runs', 0),
                            'walks': batting.get('baseOnBalls', 0),
                            'strikeouts': batting.get('strikeOuts', 0),
                            'stolen_bases': batting.get('stolenBases', 0),
                            'caught_stealing': batting.get('caughtStealing', 0),
                            'hit_by_pitch': batting.get('hitByPitch', 0),
                            'innings_pitched': float(pitching.get('inningsPitched', 0.0) or 0.0),
                            'wins': pitching.get('wins', 0),
                            'losses': pitching.get('losses', 0),
                            'saves': pitching.get('saves', 0),
                            'blown_saves': pitching.get('blownSaves', 0),
                            'holds': pitching.get('holds', 0),
                            'earned_runs': pitching.get('earnedRuns', 0),
                            'hits_allowed': pitching.get('hits', 0),
                            'walks_allowed': pitching.get('baseOnBalls', 0),
                            'strikeouts_pitched': pitching.get('strikeOuts', 0),
                            'quality_start': 1 if (float(pitching.get('inningsPitched', 0.0) or 0.0) >= 6.0 
                                                  and pitching.get('earnedRuns', 0) <= 3) else 0
                        })
                        logs_inserted += 1
                    except Exception as e:
                        logger.error(f"Failed to insert game log for player {player_id}: {e}")
                        continue
        
        return logs_inserted
        
    except Exception as e:
        logger.error(f"Error fetching game logs for {date_str}: {e}")
        return 0

def ensure_player_exists(player_id, player_info=None):
    """Ensure player exists in database (simplified version)"""
    try:
        # Check if player exists - FIXED: Changed params to parameters
        check_result = execute_sql(
            "SELECT player_id FROM mlb_players WHERE player_id = :player_id",
            parameters={'player_id': player_id},
            database='postgres'
        )
        
        if check_result and check_result.get('records') and len(check_result['records']) > 0:
            return True
        
        # If not, add player
        if not player_info:
            return False
            
        first_name = player_info.get('firstName', 'Unknown')
        last_name = player_info.get('lastName', 'Player')
        position = player_info.get('primaryPosition', {}).get('abbreviation', 'DH')
        mlb_team = player_info.get('currentTeam', {}).get('abbreviation', 'FA')
        jersey_number = player_info.get('primaryNumber', '')
        
        # Handle jersey_number as integer or NULL
        if jersey_number and jersey_number.isdigit():
            jersey_number_value = int(jersey_number)
        else:
            jersey_number_value = None
        
        execute_sql("""
            INSERT INTO mlb_players (
                player_id, first_name, last_name, 
                position, mlb_team, jersey_number, is_active
            ) VALUES (
                :player_id, :first_name, :last_name,
                :position, :mlb_team, :jersey_number, true
            ) ON CONFLICT (player_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                position = EXCLUDED.position,
                mlb_team = EXCLUDED.mlb_team,
                jersey_number = EXCLUDED.jersey_number,
                is_active = EXCLUDED.is_active
        """, parameters={  # FIXED: Changed params to parameters
            'player_id': player_id,
            'first_name': first_name,
            'last_name': last_name,
            'position': position,
            'mlb_team': mlb_team,
            'jersey_number': jersey_number_value  # Now passes int or None
        }, database='postgres')
        
        logger.info(f"Added new player: {first_name} {last_name} ({player_id})")
        return True
        
    except Exception as e:
        logger.error(f"Failed to ensure player exists: {e}")
        return False

def update_all_season_stats():
    """Update season stats for all players after catching up game logs"""
    try:
        logger.info("Updating all season stats...")
        
        # Note: home_runs_allowed not tracked in our system
        execute_sql(f"""
            INSERT INTO player_season_stats (
                player_id, season, games_played, at_bats, runs, hits,
                doubles, triples, home_runs, rbi, stolen_bases, caught_stealing,
                walks, strikeouts, hit_by_pitch, batting_avg, obp, slg, ops,
                games_started, wins, losses, saves, blown_saves, holds,
                quality_starts, innings_pitched, hits_allowed, earned_runs,
                walks_allowed, strikeouts_pitched, era, whip
            )
            SELECT 
                player_id, {CURRENT_SEASON},
                COUNT(*), 
                SUM(at_bats), 
                SUM(runs), 
                SUM(hits),
                SUM(doubles), 
                SUM(triples), 
                SUM(home_runs), 
                SUM(rbi),
                SUM(stolen_bases), 
                SUM(caught_stealing), 
                SUM(walks), 
                SUM(strikeouts),
                SUM(hit_by_pitch),
                CASE WHEN SUM(at_bats) > 0 THEN ROUND(SUM(hits)::DECIMAL / SUM(at_bats), 3) ELSE 0 END,
                CASE WHEN SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch) > 0 
                    THEN ROUND((SUM(hits) + SUM(walks) + SUM(hit_by_pitch))::DECIMAL / 
                              (SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch)), 3) ELSE 0 END,
                CASE WHEN SUM(at_bats) > 0 
                    THEN ROUND((SUM(hits) + SUM(doubles) + 2*SUM(triples) + 3*SUM(home_runs))::DECIMAL / SUM(at_bats), 3) ELSE 0 END,
                0, -- OPS calculated separately
                COUNT(CASE WHEN innings_pitched >= 5 THEN 1 END),
                SUM(wins), 
                SUM(losses), 
                SUM(saves),
                SUM(blown_saves),
                SUM(holds),
                SUM(CASE WHEN quality_start = 1 THEN 1 ELSE 0 END),
                SUM(innings_pitched),
                SUM(hits_allowed), 
                SUM(earned_runs), 
                SUM(walks_allowed), 
                SUM(strikeouts_pitched),
                CASE WHEN SUM(innings_pitched) > 0 
                    THEN ROUND((SUM(earned_runs) * 9)::DECIMAL / SUM(innings_pitched), 2) ELSE 0 END,
                CASE WHEN SUM(innings_pitched) > 0 
                    THEN ROUND((SUM(hits_allowed) + SUM(walks_allowed))::DECIMAL / SUM(innings_pitched), 3) ELSE 0 END
            FROM player_game_logs
            WHERE game_date >= '{SEASON_START}'
              AND game_date < CURRENT_DATE + INTERVAL '1 day'
            GROUP BY player_id
            ON CONFLICT (player_id, season) DO UPDATE SET
                games_played = EXCLUDED.games_played,
                at_bats = EXCLUDED.at_bats,
                runs = EXCLUDED.runs,
                hits = EXCLUDED.hits,
                doubles = EXCLUDED.doubles,
                triples = EXCLUDED.triples,
                home_runs = EXCLUDED.home_runs,
                rbi = EXCLUDED.rbi,
                stolen_bases = EXCLUDED.stolen_bases,
                caught_stealing = EXCLUDED.caught_stealing,
                walks = EXCLUDED.walks,
                strikeouts = EXCLUDED.strikeouts,
                hit_by_pitch = EXCLUDED.hit_by_pitch,
                batting_avg = EXCLUDED.batting_avg,
                obp = EXCLUDED.obp,
                slg = EXCLUDED.slg,
                games_started = EXCLUDED.games_started,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                saves = EXCLUDED.saves,
                blown_saves = EXCLUDED.blown_saves,
                holds = EXCLUDED.holds,
                quality_starts = EXCLUDED.quality_starts,
                innings_pitched = EXCLUDED.innings_pitched,
                hits_allowed = EXCLUDED.hits_allowed,
                earned_runs = EXCLUDED.earned_runs,
                walks_allowed = EXCLUDED.walks_allowed,
                strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                era = EXCLUDED.era,
                whip = EXCLUDED.whip,
                last_updated = NOW()
        """)
        
        # Update OPS
        execute_sql(f"""
            UPDATE player_season_stats 
            SET ops = obp + slg 
            WHERE season = {CURRENT_SEASON}
        """, database='postgres')
        
        logger.info(f"✅ Season stats updated for all players")
        
    except Exception as e:
        logger.error(f"Failed to update season stats: {e}")
        raise

def trigger_rolling_stats():
    """Trigger the calculate-rolling-stats Lambda"""
    try:
        logger.info("Triggering rolling stats calculation...")
        response = lambda_client.invoke(
            FunctionName='calculate-rolling-stats',
            InvocationType='RequestResponse',
            Payload=json.dumps({'date': str(date.today())})
        )
        result = json.loads(response['Payload'].read())
        logger.info(f"✅ Rolling stats calculation completed: {result}")
    except Exception as e:
        logger.error(f"Failed to trigger rolling stats: {e}")

def trigger_accrued_stats():
    """Trigger the update-active-accrued-stats Lambda"""
    try:
        logger.info("Triggering accrued stats update...")
        response = lambda_client.invoke(
            FunctionName='update-active-accrued-stats',
            InvocationType='RequestResponse',
            Payload=json.dumps({'date': (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')})
        )
        result = json.loads(response['Payload'].read())
        logger.info(f"✅ Accrued stats update completed: {result}")
    except Exception as e:
        logger.error(f"Failed to trigger accrued stats: {e}")

def main():
    """Main execution function"""
    logger.info("=" * 60)
    logger.info("DYNASTY DUGOUT STATS CATCH-UP SCRIPT")
    logger.info(f"Catching up from {CATCHUP_START} to yesterday")
    logger.info("=" * 60)
    
    # Get list of dates that need processing
    dates_to_process = get_dates_needing_update()
    
    if not dates_to_process:
        logger.info("✅ All caught up! No dates need processing.")
        return
    
    logger.info(f"Processing {len(dates_to_process)} dates...")
    
    # Process each date
    total_logs = 0
    for i, date_str in enumerate(dates_to_process, 1):
        logger.info(f"\n[{i}/{len(dates_to_process)}] Processing {date_str}...")
        logs = fetch_and_store_game_logs(date_str)
        total_logs += logs
        logger.info(f"  → Inserted {logs} game logs")
        
        # Rate limiting to avoid overwhelming MLB API
        if i % 10 == 0:
            logger.info("Pausing for rate limiting...")
            time.sleep(2)
    
    logger.info(f"\n✅ Finished processing game logs: {total_logs} total logs inserted")
    
    # Update all season stats
    logger.info("\nUpdating season stats for all players...")
    update_all_season_stats()
    
    # Trigger rolling stats calculation
    logger.info("\nTriggering rolling stats calculation...")
    trigger_rolling_stats()
    
    # Trigger accrued stats update
    logger.info("\nTriggering accrued stats update...")
    trigger_accrued_stats()
    
    logger.info("\n" + "=" * 60)
    logger.info("✅ CATCH-UP COMPLETE!")
    logger.info(f"Processed {len(dates_to_process)} dates with {total_logs} game logs")
    logger.info("=" * 60)

if __name__ == "__main__":
    main()