# backend/workers/update_active_accrued_stats.py - SHARED DATABASE VERSION
"""
Daily job to update accrued stats for ACTIVE roster players only
Runs for each league after rolling stats are calculated
"""

import json
import logging
from datetime import datetime, date, timedelta
from core.database import execute_sql

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """Update active accrued stats for all leagues"""
    try:
        # Get all active leagues - NO LONGER NEED database_name
        leagues = execute_sql(
            "SELECT league_id FROM user_leagues WHERE status = 'active'",
            database_name='postgres'
        )
        
        if not leagues or not leagues.get('records'):
            logger.info("No active leagues to process")
            return {'statusCode': 200, 'body': json.dumps({'success': True})}
        
        yesterday = date.today() - timedelta(days=1)
        
        for league_record in leagues['records']:
            league_id = league_record[0]['stringValue']
            
            try:
                update_league_active_stats(league_id, yesterday)
                logger.info(f"✅ Updated active stats for league {league_id}")
            except Exception as e:
                logger.error(f"❌ Error updating league {league_id}: {e}")
                continue
        
        return {
            'statusCode': 200,
            'body': json.dumps({'success': True})
        }
        
    except Exception as e:
        logger.error(f"❌ Error in active stats update: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'success': False, 'error': str(e)})
        }

def update_league_active_stats(league_id: str, game_date: date):
    """Update active accrued stats for one league"""
    
    # Get all players who were ACTIVE on this date - FROM SHARED DATABASE
    active_players_sql = f"""
        SELECT DISTINCT
            lp.mlb_player_id,
            lp.team_id,
            rsh.roster_status
        FROM league_players lp
        JOIN roster_status_history rsh ON lp.league_player_id = rsh.league_player_id
        WHERE lp.league_id = '{league_id}'::uuid
          AND rsh.league_id = '{league_id}'::uuid
          AND rsh.roster_status = 'active'
          AND rsh.effective_date <= '{game_date}'
          AND (rsh.end_date IS NULL OR rsh.end_date >= '{game_date}')
          AND lp.team_id IS NOT NULL
    """
    
    active_players = execute_sql(active_players_sql, database_name='leagues')  # SHARED DATABASE
    
    if not active_players or not active_players.get('records'):
        return
    
    # Get game stats for these players from MAIN DB
    player_ids = [r[0]['longValue'] for r in active_players['records']]
    player_ids_str = ','.join(map(str, player_ids))
    
    game_stats_sql = f"""
        SELECT 
            player_id,
            at_bats, hits, home_runs, rbi, runs, stolen_bases,
            walks, strikeouts, innings_pitched, wins, losses, saves,
            earned_runs, hits_allowed, walks_allowed, quality_starts
        FROM player_game_logs
        WHERE player_id IN ({player_ids_str})
          AND game_date = '{game_date}'
    """
    
    game_stats = execute_sql(game_stats_sql, database_name='postgres')
    
    if not game_stats or not game_stats.get('records'):
        return
    
    # Create lookup for game stats
    stats_by_player = {}
    for record in game_stats['records']:
        player_id = record[0]['longValue']
        stats_by_player[player_id] = record
    
    # Update accrued stats for each active player who played
    for player_record in active_players['records']:
        player_id = player_record[0]['longValue']
        team_id = player_record[1]['stringValue']
        
        if player_id not in stats_by_player:
            continue  # Player was active but didn't play
        
        stats = stats_by_player[player_id]
        
        # Update or insert accrued stats - WITH league_id
        update_sql = f"""
            INSERT INTO player_active_accrued_stats (
                league_id, mlb_player_id, team_id, first_active_date, last_active_date,
                total_active_days, active_games_played,
                active_at_bats, active_hits, active_home_runs, active_rbi,
                active_runs, active_stolen_bases, active_walks, active_strikeouts,
                active_innings_pitched, active_wins, active_losses, active_saves,
                active_earned_runs, active_quality_starts
            ) VALUES (
                '{league_id}'::uuid, {player_id}, '{team_id}', '{game_date}', '{game_date}',
                1, 1,
                {stats[1].get('longValue', 0)}, {stats[2].get('longValue', 0)},
                {stats[3].get('longValue', 0)}, {stats[4].get('longValue', 0)},
                {stats[5].get('longValue', 0)}, {stats[6].get('longValue', 0)},
                {stats[7].get('longValue', 0)}, {stats[8].get('longValue', 0)},
                {stats[9].get('doubleValue', 0)}, {stats[10].get('longValue', 0)},
                {stats[11].get('longValue', 0)}, {stats[12].get('longValue', 0)},
                {stats[13].get('longValue', 0)}, {stats[15].get('longValue', 0)}
            )
            ON CONFLICT (league_id, mlb_player_id, team_id) DO UPDATE SET
                last_active_date = '{game_date}',
                total_active_days = player_active_accrued_stats.total_active_days + 1,
                active_games_played = player_active_accrued_stats.active_games_played + 1,
                active_at_bats = player_active_accrued_stats.active_at_bats + {stats[1].get('longValue', 0)},
                active_hits = player_active_accrued_stats.active_hits + {stats[2].get('longValue', 0)},
                active_home_runs = player_active_accrued_stats.active_home_runs + {stats[3].get('longValue', 0)},
                active_rbi = player_active_accrued_stats.active_rbi + {stats[4].get('longValue', 0)},
                active_runs = player_active_accrued_stats.active_runs + {stats[5].get('longValue', 0)},
                active_stolen_bases = player_active_accrued_stats.active_stolen_bases + {stats[6].get('longValue', 0)},
                active_walks = player_active_accrued_stats.active_walks + {stats[7].get('longValue', 0)},
                active_strikeouts = player_active_accrued_stats.active_strikeouts + {stats[8].get('longValue', 0)},
                active_innings_pitched = player_active_accrued_stats.active_innings_pitched + {stats[9].get('doubleValue', 0)},
                active_wins = player_active_accrued_stats.active_wins + {stats[10].get('longValue', 0)},
                active_losses = player_active_accrued_stats.active_losses + {stats[11].get('longValue', 0)},
                active_saves = player_active_accrued_stats.active_saves + {stats[12].get('longValue', 0)},
                active_earned_runs = player_active_accrued_stats.active_earned_runs + {stats[13].get('longValue', 0)},
                active_quality_starts = player_active_accrued_stats.active_quality_starts + {stats[15].get('longValue', 0)},
                last_updated = NOW()
        """
        
        execute_sql(update_sql, database_name='leagues')  # SHARED DATABASE
    
    # Recalculate batting averages and ERAs - WITH league_id filter
    execute_sql(f"""
        UPDATE player_active_accrued_stats
        SET active_batting_avg = CASE 
                WHEN active_at_bats > 0 
                THEN ROUND(active_hits::NUMERIC / active_at_bats, 3)
                ELSE 0.000 
            END,
            active_era = CASE 
                WHEN active_innings_pitched > 0 
                THEN ROUND((active_earned_runs * 9.0) / active_innings_pitched, 2)
                ELSE 0.00 
            END,
            active_whip = CASE 
                WHEN active_innings_pitched > 0 
                THEN ROUND((active_hits + active_walks)::NUMERIC / active_innings_pitched, 3)
                ELSE 0.000 
            END
        WHERE league_id = '{league_id}'::uuid
          AND last_active_date = '{game_date}'
    """, database_name='leagues')  # SHARED DATABASE