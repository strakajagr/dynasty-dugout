# calculate_rolling_stats.py
"""
Calculate rolling stats for ALL players in MAIN DB
"""
import json
import logging
import boto3
import os
from datetime import datetime, date, timedelta

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Database configuration
DB_CLUSTER_ARN = os.environ.get('DB_CLUSTER_ARN')
DB_SECRET_ARN = os.environ.get('DB_SECRET_ARN')
rds_client = boto3.client('rds-data', region_name='us-east-1')

# Get current season
def get_current_season():
    now = datetime.now()
    return now.year if now.month >= 4 else now.year - 1

CURRENT_SEASON = get_current_season()
SEASON_START = f"{CURRENT_SEASON}-03-28"

def execute_sql(sql, params=None, database_name='postgres'):
    """Execute SQL using RDS Data API"""
    try:
        request = {
            'resourceArn': DB_CLUSTER_ARN,
            'secretArn': DB_SECRET_ARN,
            'database': database_name,
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
    except Exception as e:
        logger.error(f"SQL Error: {e}")
        raise

def lambda_handler(event, context):
    """Calculate rolling stats for all players"""
    try:
        today = date.today()
        logger.info(f"Starting rolling stats calculation for {today}")
        
        # Define periods to calculate
        periods = [
            ('last_7_days', 7),
            ('last_14_days', 14),
            ('last_30_days', 30)
        ]
        
        total_updated = 0
        
        for period_name, days in periods:
            start_date = today - timedelta(days=days)
            
            logger.info(f"Calculating {period_name} stats from {start_date} to {today}")
            
            # Calculate rolling stats from game logs
            sql = f"""
                INSERT INTO player_rolling_stats (
                    player_id, period, as_of_date,
                    games_played, at_bats, hits, home_runs, rbi, runs,
                    stolen_bases, caught_stealing, walks, strikeouts,
                    batting_avg, obp, slg, ops,
                    games_started, innings_pitched, wins, losses, saves, blown_saves,
                    earned_runs, era, whip, quality_starts, strikeouts_pitched,
                    hits_allowed, walks_allowed
                )
                SELECT 
                    player_id,
                    '{period_name}',
                    '{today}',
                    COUNT(*) as games_played,
                    SUM(at_bats) as at_bats,
                    SUM(hits) as hits,
                    SUM(home_runs) as home_runs,
                    SUM(rbi) as rbi,
                    SUM(runs) as runs,
                    SUM(stolen_bases) as stolen_bases,
                    SUM(caught_stealing) as caught_stealing,
                    SUM(walks) as walks,
                    SUM(strikeouts) as strikeouts,
                    -- Batting average
                    CASE WHEN SUM(at_bats) > 0 
                        THEN ROUND(SUM(hits)::NUMERIC / SUM(at_bats), 3)
                        ELSE 0.000 
                    END as batting_avg,
                    -- OBP
                    CASE WHEN (SUM(at_bats) + SUM(walks)) > 0 
                        THEN ROUND((SUM(hits) + SUM(walks))::NUMERIC / 
                                  (SUM(at_bats) + SUM(walks)), 3)
                        ELSE 0.000 
                    END as obp,
                    -- SLG
                    CASE WHEN SUM(at_bats) > 0 
                        THEN ROUND((SUM(hits) + SUM(doubles) + 2*SUM(triples) + 3*SUM(home_runs))::NUMERIC / 
                                  SUM(at_bats), 3)
                        ELSE 0.000 
                    END as slg,
                    -- OPS (will be calculated after insert)
                    0.000 as ops,
                    -- Pitching stats
                    SUM(CASE WHEN innings_pitched > 0 THEN 1 ELSE 0 END) as games_started,
                    SUM(innings_pitched) as innings_pitched,
                    SUM(wins) as wins,
                    SUM(losses) as losses,
                    SUM(saves) as saves,
                    SUM(blown_saves) as blown_saves,
                    SUM(earned_runs) as earned_runs,
                    -- ERA
                    CASE WHEN SUM(innings_pitched) > 0 
                        THEN ROUND((SUM(earned_runs) * 9.0) / SUM(innings_pitched), 2)
                        ELSE 0.00 
                    END as era,
                    -- WHIP
                    CASE WHEN SUM(innings_pitched) > 0 
                        THEN ROUND((SUM(hits_allowed) + SUM(walks_allowed))::NUMERIC / 
                                  SUM(innings_pitched), 3)
                        ELSE 0.000 
                    END as whip,
                    -- Quality Starts
                    SUM(CASE 
                        WHEN innings_pitched >= 6.0 AND earned_runs <= 3 
                        THEN 1 
                        ELSE 0 
                    END) as quality_starts,
                    SUM(strikeouts_pitched) as strikeouts_pitched,
                    SUM(hits_allowed) as hits_allowed,
                    SUM(walks_allowed) as walks_allowed
                FROM player_game_logs
                WHERE game_date >= '{start_date}'
                  AND game_date <= '{today}'
                  AND game_date >= '{SEASON_START}'
                GROUP BY player_id
                ON CONFLICT (player_id, period, as_of_date) 
                DO UPDATE SET
                    games_played = EXCLUDED.games_played,
                    at_bats = EXCLUDED.at_bats,
                    hits = EXCLUDED.hits,
                    home_runs = EXCLUDED.home_runs,
                    rbi = EXCLUDED.rbi,
                    runs = EXCLUDED.runs,
                    stolen_bases = EXCLUDED.stolen_bases,
                    caught_stealing = EXCLUDED.caught_stealing,
                    walks = EXCLUDED.walks,
                    strikeouts = EXCLUDED.strikeouts,
                    batting_avg = EXCLUDED.batting_avg,
                    obp = EXCLUDED.obp,
                    slg = EXCLUDED.slg,
                    games_started = EXCLUDED.games_started,
                    innings_pitched = EXCLUDED.innings_pitched,
                    wins = EXCLUDED.wins,
                    losses = EXCLUDED.losses,
                    saves = EXCLUDED.saves,
                    blown_saves = EXCLUDED.blown_saves,
                    earned_runs = EXCLUDED.earned_runs,
                    era = EXCLUDED.era,
                    whip = EXCLUDED.whip,
                    quality_starts = EXCLUDED.quality_starts,
                    strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                    hits_allowed = EXCLUDED.hits_allowed,
                    walks_allowed = EXCLUDED.walks_allowed,
                    last_calculated = NOW()
            """
            
            result = execute_sql(sql, database_name='postgres')
            
            # Update OPS (OBP + SLG)
            execute_sql(f"""
                UPDATE player_rolling_stats 
                SET ops = obp + slg 
                WHERE period = '{period_name}' 
                  AND as_of_date = '{today}'
            """, database_name='postgres')
            
            # Count updated records
            count_result = execute_sql(f"""
                SELECT COUNT(*) FROM player_rolling_stats 
                WHERE period = '{period_name}' AND as_of_date = '{today}'
            """, database_name='postgres')
            
            if count_result and count_result.get('records'):
                period_count = count_result['records'][0][0].get('longValue', 0)
                total_updated += period_count
                logger.info(f"Updated {period_count} player records for {period_name}")
        
        # Clean up old data (keep last 45 days)
        cleanup_date = today - timedelta(days=45)
        execute_sql(f"""
            DELETE FROM player_rolling_stats 
            WHERE as_of_date < '{cleanup_date}'
        """, database_name='postgres')
        
        logger.info(f"Rolling stats calculation complete. Updated {total_updated} total records.")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'date': str(today),
                'records_updated': total_updated
            })
        }
        
    except Exception as e:
        logger.error(f"Error calculating rolling stats: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'success': False, 'error': str(e)})
        }