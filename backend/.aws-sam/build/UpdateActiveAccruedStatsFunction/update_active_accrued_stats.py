# update_active_accrued_stats.py
"""
Update Active Accrued Stats
Tracks stats accumulated while player is on active roster
FIXED: Quality starts are now summed from game_logs, not calculated inline
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

def get_current_season():
    """Get current MLB season year"""
    now = datetime.now()
    return now.year if now.month >= 4 else now.year - 1

CURRENT_SEASON = get_current_season()

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
    """
    Update active accrued stats for all players
    These are stats accumulated only while on active roster
    """
    try:
        today = date.today()
        logger.info(f"📋 Starting active accrued stats update for {today}")
        
        # First, get all leagues
        leagues_result = execute_sql(
            "SELECT league_id, league_name FROM leagues WHERE is_active = true",
            database_name='leagues'
        )
        
        if not leagues_result or not leagues_result.get('records'):
            logger.warning("No active leagues found")
            return {
                'statusCode': 200,
                'body': json.dumps({'success': True, 'message': 'No active leagues'})
            }
        
        total_updated = 0
        leagues_processed = 0
        
        for league_record in leagues_result['records']:
            league_id = league_record[0].get('stringValue')
            league_name = league_record[1].get('stringValue', 'Unknown League')
            
            logger.info(f"Processing league: {league_name} ({league_id})")
            
            # Get active roster history for this league
            # This query finds periods when players were on active roster
            roster_history_sql = """
                SELECT DISTINCT
                    rsh.league_player_id,
                    lp.mlb_player_id,
                    lp.team_id,
                    rsh.effective_date,
                    COALESCE(rsh.end_date, CURRENT_DATE) as end_date
                FROM roster_status_history rsh
                JOIN league_players lp ON rsh.league_player_id = lp.league_player_id
                WHERE rsh.league_id = :league_id::uuid
                  AND rsh.roster_status = 'active'
                  AND rsh.effective_date IS NOT NULL
                ORDER BY lp.mlb_player_id, rsh.effective_date
            """
            
            roster_result = execute_sql(
                roster_history_sql,
                {'league_id': league_id},
                database_name='leagues'
            )
            
            if not roster_result or not roster_result.get('records'):
                logger.info(f"No active roster history for league {league_name}")
                continue
            
            # Process each player's active periods
            player_stats = {}
            
            for roster_record in roster_result['records']:
                league_player_id = roster_record[0].get('stringValue')
                mlb_player_id = roster_record[1].get('longValue')
                team_id = roster_record[2].get('stringValue')
                start_date = roster_record[3].get('stringValue')
                end_date = roster_record[4].get('stringValue')
                
                if not mlb_player_id:
                    continue
                
                # Initialize player stats if not exists
                if mlb_player_id not in player_stats:
                    player_stats[mlb_player_id] = {
                        'team_id': team_id,
                        'league_player_id': league_player_id,
                        'periods': [],
                        'total_stats': {
                            'games_played': 0,
                            'at_bats': 0,
                            'hits': 0,
                            'home_runs': 0,
                            'rbi': 0,
                            'runs': 0,
                            'stolen_bases': 0,
                            'walks': 0,
                            'strikeouts': 0,
                            'innings_pitched': 0.0,
                            'wins': 0,
                            'losses': 0,
                            'saves': 0,
                            'earned_runs': 0,
                            'quality_starts': 0,
                            'hits_allowed': 0,
                            'walks_allowed': 0
                        }
                    }
                
                player_stats[mlb_player_id]['periods'].append({
                    'start': start_date,
                    'end': end_date
                })
            
            # Now get game logs for each player during their active periods
            for mlb_player_id, player_data in player_stats.items():
                for period in player_data['periods']:
                    # Get stats for this active period from postgres
                    # FIXED: Now summing quality_starts directly from game_logs
                    period_stats_sql = """
                        SELECT 
                            COUNT(*) as games,
                            COALESCE(SUM(at_bats), 0) as at_bats,
                            COALESCE(SUM(hits), 0) as hits,
                            COALESCE(SUM(home_runs), 0) as home_runs,
                            COALESCE(SUM(rbi), 0) as rbi,
                            COALESCE(SUM(runs), 0) as runs,
                            COALESCE(SUM(stolen_bases), 0) as stolen_bases,
                            COALESCE(SUM(walks), 0) as walks,
                            COALESCE(SUM(strikeouts), 0) as strikeouts,
                            COALESCE(SUM(innings_pitched), 0) as innings_pitched,
                            COALESCE(SUM(wins), 0) as wins,
                            COALESCE(SUM(losses), 0) as losses,
                            COALESCE(SUM(saves), 0) as saves,
                            COALESCE(SUM(earned_runs), 0) as earned_runs,
                            COALESCE(SUM(quality_starts), 0) as quality_starts,
                            COALESCE(SUM(hits_allowed), 0) as hits_allowed,
                            COALESCE(SUM(walks_allowed), 0) as walks_allowed
                        FROM player_game_logs
                        WHERE player_id = :player_id
                          AND game_date >= :start_date::date
                          AND game_date <= :end_date::date
                    """
                    
                    stats_result = execute_sql(
                        period_stats_sql,
                        {
                            'player_id': mlb_player_id,
                            'start_date': period['start'],
                            'end_date': period['end']
                        },
                        database_name='postgres'
                    )
                    
                    if stats_result and stats_result.get('records'):
                        record = stats_result['records'][0]
                        # Add to total stats
                        player_data['total_stats']['games_played'] += record[0].get('longValue', 0)
                        player_data['total_stats']['at_bats'] += record[1].get('longValue', 0)
                        player_data['total_stats']['hits'] += record[2].get('longValue', 0)
                        player_data['total_stats']['home_runs'] += record[3].get('longValue', 0)
                        player_data['total_stats']['rbi'] += record[4].get('longValue', 0)
                        player_data['total_stats']['runs'] += record[5].get('longValue', 0)
                        player_data['total_stats']['stolen_bases'] += record[6].get('longValue', 0)
                        player_data['total_stats']['walks'] += record[7].get('longValue', 0)
                        player_data['total_stats']['strikeouts'] += record[8].get('longValue', 0)
                        player_data['total_stats']['innings_pitched'] += record[9].get('doubleValue', 0.0)
                        player_data['total_stats']['wins'] += record[10].get('longValue', 0)
                        player_data['total_stats']['losses'] += record[11].get('longValue', 0)
                        player_data['total_stats']['saves'] += record[12].get('longValue', 0)
                        player_data['total_stats']['earned_runs'] += record[13].get('longValue', 0)
                        player_data['total_stats']['quality_starts'] += record[14].get('longValue', 0)
                        player_data['total_stats']['hits_allowed'] += record[15].get('longValue', 0)
                        player_data['total_stats']['walks_allowed'] += record[16].get('longValue', 0)
            
            # Insert/update accrued stats in leagues database
            for mlb_player_id, player_data in player_stats.items():
                stats = player_data['total_stats']
                
                # Calculate derived stats
                batting_avg = 0.0
                if stats['at_bats'] > 0:
                    batting_avg = round(stats['hits'] / stats['at_bats'], 3)
                
                era = 0.0
                whip = 0.0
                if stats['innings_pitched'] > 0:
                    era = round((stats['earned_runs'] * 9.0) / stats['innings_pitched'], 2)
                    whip = round((stats['hits_allowed'] + stats['walks_allowed']) / stats['innings_pitched'], 3)
                
                # Calculate total active days
                total_days = 0
                first_date = None
                last_date = None
                for period in player_data['periods']:
                    start = datetime.strptime(period['start'], '%Y-%m-%d').date()
                    end = datetime.strptime(period['end'], '%Y-%m-%d').date()
                    total_days += (end - start).days + 1
                    if not first_date or start < first_date:
                        first_date = start
                    if not last_date or end > last_date:
                        last_date = end
                
                # Insert or update the accrued stats
                upsert_sql = """
                    INSERT INTO player_active_accrued_stats (
                        mlb_player_id, league_id, team_id,
                        first_active_date, last_active_date, total_active_days,
                        active_games_played, active_at_bats, active_hits,
                        active_home_runs, active_rbi, active_runs,
                        active_stolen_bases, active_walks, active_strikeouts,
                        active_batting_avg, active_innings_pitched,
                        active_wins, active_losses, active_saves,
                        active_earned_runs, active_quality_starts,
                        active_era, active_whip, last_updated
                    ) VALUES (
                        :mlb_player_id, :league_id::uuid, :team_id::uuid,
                        :first_date::date, :last_date::date, :total_days,
                        :games, :at_bats, :hits,
                        :home_runs, :rbi, :runs,
                        :stolen_bases, :walks, :strikeouts,
                        :batting_avg, :innings_pitched,
                        :wins, :losses, :saves,
                        :earned_runs, :quality_starts,
                        :era, :whip, NOW()
                    )
                    ON CONFLICT (mlb_player_id, league_id, team_id)
                    DO UPDATE SET
                        first_active_date = EXCLUDED.first_active_date,
                        last_active_date = EXCLUDED.last_active_date,
                        total_active_days = EXCLUDED.total_active_days,
                        active_games_played = EXCLUDED.active_games_played,
                        active_at_bats = EXCLUDED.active_at_bats,
                        active_hits = EXCLUDED.active_hits,
                        active_home_runs = EXCLUDED.active_home_runs,
                        active_rbi = EXCLUDED.active_rbi,
                        active_runs = EXCLUDED.active_runs,
                        active_stolen_bases = EXCLUDED.active_stolen_bases,
                        active_walks = EXCLUDED.active_walks,
                        active_strikeouts = EXCLUDED.active_strikeouts,
                        active_batting_avg = EXCLUDED.active_batting_avg,
                        active_innings_pitched = EXCLUDED.active_innings_pitched,
                        active_wins = EXCLUDED.active_wins,
                        active_losses = EXCLUDED.active_losses,
                        active_saves = EXCLUDED.active_saves,
                        active_earned_runs = EXCLUDED.active_earned_runs,
                        active_quality_starts = EXCLUDED.active_quality_starts,
                        active_era = EXCLUDED.active_era,
                        active_whip = EXCLUDED.active_whip,
                        last_updated = NOW()
                """
                
                execute_sql(
                    upsert_sql,
                    {
                        'mlb_player_id': mlb_player_id,
                        'league_id': league_id,
                        'team_id': player_data['team_id'],
                        'first_date': str(first_date) if first_date else str(today),
                        'last_date': str(last_date) if last_date else str(today),
                        'total_days': total_days,
                        'games': stats['games_played'],
                        'at_bats': stats['at_bats'],
                        'hits': stats['hits'],
                        'home_runs': stats['home_runs'],
                        'rbi': stats['rbi'],
                        'runs': stats['runs'],
                        'stolen_bases': stats['stolen_bases'],
                        'walks': stats['walks'],
                        'strikeouts': stats['strikeouts'],
                        'batting_avg': batting_avg,
                        'innings_pitched': stats['innings_pitched'],
                        'wins': stats['wins'],
                        'losses': stats['losses'],
                        'saves': stats['saves'],
                        'earned_runs': stats['earned_runs'],
                        'quality_starts': stats['quality_starts'],
                        'era': era,
                        'whip': whip
                    },
                    database_name='leagues'
                )
                total_updated += 1
            
            leagues_processed += 1
            logger.info(f"✅ Processed {len(player_stats)} players for league {league_name}")
        
        logger.info(f"""
        ✅ Active accrued stats update complete
        - Leagues processed: {leagues_processed}
        - Player records updated: {total_updated}
        """)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'date': str(today),
                'leagues_processed': leagues_processed,
                'records_updated': total_updated
            })
        }
        
    except Exception as e:
        logger.error(f"❌ Error updating active accrued stats: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'success': False, 'error': str(e)})
        }

# For local testing
if __name__ == "__main__":
    # Set environment variables for local testing
    os.environ['DB_CLUSTER_ARN'] = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
    os.environ['DB_SECRET_ARN'] = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
    
    result = lambda_handler({}, {})
    print(json.dumps(result, indent=2))