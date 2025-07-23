"""
Dynasty Dugout - League Player Service
Manages league-specific player pools and syncs with MLB data updates
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
import json
from core.database import execute_sql

logger = logging.getLogger(__name__)

class LeaguePlayerService:
    """
    Core service for managing league-specific player pools.
    Handles MLB data synchronization, player status updates, and league player operations.
    """
    
    @staticmethod
    def create_league_player_pool(league_id: str, player_pool_type: str = 'all_mlb') -> Dict[str, Any]:
        """Create league-specific player table and populate with MLB players"""
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            # Create league-specific player table
            create_table_sql = f"""
                CREATE TABLE IF NOT EXISTS {table_name} (
                    league_player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    mlb_player_id INTEGER NOT NULL,
                    team_id UUID,
                    salary DECIMAL(8,2) DEFAULT 1.0,
                    contract_years INTEGER DEFAULT 1,
                    roster_status VARCHAR(20) DEFAULT 'available',
                    position_eligibility TEXT[],
                    acquisition_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT fk_mlb_player FOREIGN KEY (mlb_player_id) REFERENCES mlb_players(player_id),
                    CONSTRAINT unique_league_player_{league_id.replace('-', '_')} UNIQUE(mlb_player_id)
                );
            """
            
            execute_sql(create_table_sql)
            
            # Determine which players to include based on player pool type
            where_clause = "WHERE mp.player_id IS NOT NULL"
            
            if player_pool_type == 'al_only':
                where_clause += " AND mp.league = 'AL'"
            elif player_pool_type == 'nl_only':
                where_clause += " AND mp.league = 'NL'"
            elif player_pool_type == 'american_national':
                where_clause += " AND mp.league IN ('AL', 'NL')"
            elif player_pool_type == 'minor_leagues_only':
                where_clause += " AND mp.is_minor_league = true"
            # 'all_mlb' and others include all players
            
            # Copy MLB players to league-specific table
            copy_players_sql = f"""
                INSERT INTO {table_name} (mlb_player_id, salary, contract_years, roster_status, position_eligibility)
                SELECT 
                    mp.player_id,
                    1.0 as salary,
                    1 as contract_years,
                    'available' as roster_status,
                    ARRAY[mp.position] as position_eligibility
                FROM mlb_players mp
                {where_clause}
                ON CONFLICT (mlb_player_id) DO NOTHING
            """
            
            result = execute_sql(copy_players_sql)
            
            # Get count of players added
            count_sql = f"SELECT COUNT(*) FROM {table_name}"
            count_response = execute_sql(count_sql)
            
            player_count = 0
            if count_response.get('records') and count_response['records'][0]:
                player_count = count_response['records'][0][0].get('longValue', 0)
            
            logger.info(f"Created league player pool for {league_id} with {player_count} players")
            
            return {
                'success': True,
                'league_id': league_id,
                'player_pool_type': player_pool_type,
                'players_added': player_count,
                'table_name': table_name
            }
            
        except Exception as e:
            logger.error(f"Error creating league player pool: {str(e)}")
            raise

    @staticmethod
    def sync_with_mlb_updates(league_id: str) -> Dict[str, Any]:
        """Sync league player pool with latest MLB data updates"""
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            # Get league's player pool configuration
            league_config_sql = f"""
                SELECT player_pool FROM user_leagues 
                WHERE league_id = '{league_id}'
            """
            
            config_response = execute_sql(league_config_sql)
            player_pool_type = 'all_mlb'  # Default
            
            if config_response.get('records') and config_response['records'][0]:
                player_pool_type = config_response['records'][0][0].get('stringValue', 'all_mlb')
            
            sync_results = {
                'league_id': league_id,
                'new_players_added': 0,
                'players_updated': 0,
                'players_deactivated': 0,
                'changes': []
            }
            
            # Add any new MLB players that match the league's player pool criteria
            where_clause = "WHERE mp.player_id IS NOT NULL"
            
            if player_pool_type == 'al_only':
                where_clause += " AND mp.league = 'AL'"
            elif player_pool_type == 'nl_only':
                where_clause += " AND mp.league = 'NL'"
            elif player_pool_type == 'american_national':
                where_clause += " AND mp.league IN ('AL', 'NL')"
            elif player_pool_type == 'minor_leagues_only':
                where_clause += " AND mp.is_minor_league = true"
            
            # Find new players not in league pool
            new_players_sql = f"""
                INSERT INTO {table_name} (mlb_player_id, salary, contract_years, roster_status, position_eligibility)
                SELECT 
                    mp.player_id,
                    1.0 as salary,
                    1 as contract_years,
                    'available' as roster_status,
                    ARRAY[mp.position] as position_eligibility
                FROM mlb_players mp
                LEFT JOIN {table_name} lp ON mp.player_id = lp.mlb_player_id
                {where_clause}
                AND lp.mlb_player_id IS NULL
                ON CONFLICT (mlb_player_id) DO NOTHING
            """
            
            new_players_result = execute_sql(new_players_sql)
            
            # Update existing player information (position changes, team changes, etc.)
            update_info_sql = f"""
                UPDATE {table_name}
                SET 
                    position_eligibility = ARRAY[mp.position],
                    updated_at = NOW()
                FROM mlb_players mp
                WHERE {table_name}.mlb_player_id = mp.player_id
                AND (
                    position_eligibility != ARRAY[mp.position]
                    OR {table_name}.updated_at < mp.updated_at
                )
            """
            
            update_result = execute_sql(update_info_sql)
            
            # Handle player deactivations (retired, released, etc.)
            # Players who are no longer active in MLB but are on team rosters should be flagged
            deactivate_sql = f"""
                SELECT lp.mlb_player_id, lp.team_id, mp.first_name, mp.last_name
                FROM {table_name} lp
                JOIN mlb_players mp ON lp.mlb_player_id = mp.player_id
                WHERE mp.is_active = false 
                AND lp.team_id IS NOT NULL
                AND lp.roster_status = 'active'
            """
            
            deactivate_response = execute_sql(deactivate_sql)
            
            if deactivate_response.get('records'):
                for record in deactivate_response['records']:
                    player_id = record[0].get('longValue')
                    team_id = record[1].get('stringValue')
                    first_name = record[2].get('stringValue', '')
                    last_name = record[3].get('stringValue', '')
                    
                    sync_results['changes'].append({
                        'type': 'player_deactivated',
                        'player_id': player_id,
                        'player_name': f"{first_name} {last_name}",
                        'team_id': team_id,
                        'message': 'Player is no longer active in MLB'
                    })
                    sync_results['players_deactivated'] += 1
            
            # Get counts for reporting
            count_new_sql = f"""
                SELECT COUNT(*) FROM {table_name} 
                WHERE created_at > NOW() - INTERVAL '1 hour'
            """
            
            count_new_response = execute_sql(count_new_sql)
            if count_new_response.get('records') and count_new_response['records'][0]:
                sync_results['new_players_added'] = count_new_response['records'][0][0].get('longValue', 0)
            
            logger.info(f"Synced league {league_id}: {sync_results['new_players_added']} new, {sync_results['players_deactivated']} deactivated")
            
            return sync_results
            
        except Exception as e:
            logger.error(f"Error syncing league with MLB updates: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_league_players(league_id: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get players from league pool with filtering options"""
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            if filters is None:
                filters = {}
            
            # Build WHERE clause based on filters
            where_conditions = []
            
            # Filter by roster status
            status = filters.get('status', 'available')
            if status:
                where_conditions.append(f"lp.roster_status = '{status}'")
            
            # Filter by position
            position = filters.get('position')
            if position:
                where_conditions.append(f"mp.position = '{position}'")
            
            # Filter by team
            team_id = filters.get('team_id')
            if team_id:
                where_conditions.append(f"lp.team_id = '{team_id}'")
            
            # Filter by active status
            active_only = filters.get('active_only', True)
            if active_only:
                where_conditions.append("mp.is_active = true")
            
            # Search by name
            search = filters.get('search')
            if search:
                where_conditions.append(
                    f"(mp.first_name ILIKE '%{search}%' OR mp.last_name ILIKE '%{search}%')"
                )
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            # Pagination
            limit = filters.get('limit', 50)
            offset = filters.get('offset', 0)
            
            sql = f"""
                SELECT 
                    lp.league_player_id,
                    lp.mlb_player_id,
                    lp.team_id,
                    lp.salary,
                    lp.contract_years,
                    lp.roster_status,
                    lp.acquisition_date,
                    mp.first_name,
                    mp.last_name,
                    mp.position,
                    mp.mlb_team,
                    mp.jersey_number,
                    mp.is_active
                FROM {table_name} lp
                JOIN mlb_players mp ON lp.mlb_player_id = mp.player_id
                WHERE {where_clause}
                ORDER BY mp.last_name, mp.first_name
                LIMIT {limit} OFFSET {offset}
            """
            
            response = execute_sql(sql)
            
            players = []
            if response.get('records'):
                for record in response['records']:
                    player = {
                        'league_player_id': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None,
                        'mlb_player_id': record[1].get('longValue') if record[1] and not record[1].get('isNull') else None,
                        'team_id': record[2].get('stringValue') if record[2] and not record[2].get('isNull') else None,
                        'salary': record[3].get('doubleValue') if record[3] and not record[3].get('isNull') else 1.0,
                        'contract_years': record[4].get('longValue') if record[4] and not record[4].get('isNull') else 1,
                        'roster_status': record[5].get('stringValue') if record[5] and not record[5].get('isNull') else 'available',
                        'acquisition_date': record[6].get('stringValue') if record[6] and not record[6].get('isNull') else None,
                        'first_name': record[7].get('stringValue') if record[7] and not record[7].get('isNull') else '',
                        'last_name': record[8].get('stringValue') if record[8] and not record[8].get('isNull') else '',
                        'position': record[9].get('stringValue') if record[9] and not record[9].get('isNull') else '',
                        'mlb_team': record[10].get('stringValue') if record[10] and not record[10].get('isNull') else '',
                        'jersey_number': record[11].get('longValue') if record[11] and not record[11].get('isNull') else None,
                        'is_active': record[12].get('booleanValue') if record[12] and not record[12].get('isNull') else True
                    }
                    players.append(player)
            
            return players
            
        except Exception as e:
            logger.error(f"Error getting league players: {str(e)}")
            return []

    @staticmethod
    def get_player_ownership_info(league_id: str, player_id: int) -> Dict[str, Any]:
        """Get ownership information for a specific player in the league"""
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            sql = f"""
                SELECT 
                    lp.team_id,
                    lp.salary,
                    lp.contract_years,
                    lp.roster_status,
                    lp.acquisition_date,
                    mp.first_name,
                    mp.last_name,
                    mp.position,
                    mp.mlb_team
                FROM {table_name} lp
                JOIN mlb_players mp ON lp.mlb_player_id = mp.player_id
                WHERE lp.mlb_player_id = {player_id}
            """
            
            response = execute_sql(sql)
            
            if not response.get('records'):
                return {
                    'player_id': player_id,
                    'in_league': False,
                    'message': 'Player not found in this league'
                }
            
            record = response['records'][0]
            
            ownership_info = {
                'player_id': player_id,
                'in_league': True,
                'team_id': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None,
                'salary': record[1].get('doubleValue') if record[1] and not record[1].get('isNull') else 1.0,
                'contract_years': record[2].get('longValue') if record[2] and not record[2].get('isNull') else 1,
                'roster_status': record[3].get('stringValue') if record[3] and not record[3].get('isNull') else 'available',
                'acquisition_date': record[4].get('stringValue') if record[4] and not record[4].get('isNull') else None,
                'player_info': {
                    'first_name': record[5].get('stringValue') if record[5] and not record[5].get('isNull') else '',
                    'last_name': record[6].get('stringValue') if record[6] and not record[6].get('isNull') else '',
                    'position': record[7].get('stringValue') if record[7] and not record[7].get('isNull') else '',
                    'mlb_team': record[8].get('stringValue') if record[8] and not record[8].get('isNull') else ''
                }
            }
            
            # Determine ownership status
            if ownership_info['team_id']:
                ownership_info['is_owned'] = True
                ownership_info['status'] = f"Owned by team {ownership_info['team_id'][:8]}"
            else:
                ownership_info['is_owned'] = False
                ownership_info['status'] = 'Available for pickup'
            
            return ownership_info
            
        except Exception as e:
            logger.error(f"Error getting player ownership info: {str(e)}")
            return {
                'player_id': player_id,
                'error': str(e)
            }

    @staticmethod
    def update_player_salary(league_id: str, player_id: int, new_salary: float) -> Dict[str, Any]:
        """Update a player's salary in the league"""
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            sql = f"""
                UPDATE {table_name}
                SET 
                    salary = {new_salary},
                    updated_at = NOW()
                WHERE mlb_player_id = {player_id}
            """
            
            execute_sql(sql)
            
            logger.info(f"Updated player {player_id} salary to ${new_salary} in league {league_id}")
            
            return {
                'success': True,
                'player_id': player_id,
                'new_salary': new_salary
            }
            
        except Exception as e:
            logger.error(f"Error updating player salary: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def bulk_update_salaries(league_id: str, salary_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Update multiple player salaries at once"""
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            results = {
                'success': True,
                'updated_count': 0,
                'errors': []
            }
            
            for update in salary_updates:
                player_id = update.get('player_id')
                new_salary = update.get('salary')
                
                if not player_id or new_salary is None:
                    results['errors'].append(f"Invalid update data: {update}")
                    continue
                
                try:
                    sql = f"""
                        UPDATE {table_name}
                        SET 
                            salary = {new_salary},
                            updated_at = NOW()
                        WHERE mlb_player_id = {player_id}
                    """
                    
                    execute_sql(sql)
                    results['updated_count'] += 1
                    
                except Exception as e:
                    results['errors'].append(f"Player {player_id}: {str(e)}")
            
            if results['errors']:
                results['success'] = len(results['errors']) == 0
            
            logger.info(f"Bulk salary update in league {league_id}: {results['updated_count']} updated, {len(results['errors'])} errors")
            
            return results
            
        except Exception as e:
            logger.error(f"Error in bulk salary update: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_league_pool_stats(league_id: str) -> Dict[str, Any]:
        """Get statistics about the league's player pool"""
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            # Get overall stats
            stats_sql = f"""
                SELECT 
                    COUNT(*) as total_players,
                    COUNT(CASE WHEN team_id IS NOT NULL THEN 1 END) as owned_players,
                    COUNT(CASE WHEN roster_status = 'available' THEN 1 END) as available_players,
                    AVG(salary) as avg_salary,
                    SUM(CASE WHEN team_id IS NOT NULL THEN salary ELSE 0 END) as total_salary_committed
                FROM {table_name}
            """
            
            stats_response = execute_sql(stats_sql)
            
            # Get position breakdown
            position_sql = f"""
                SELECT 
                    mp.position,
                    COUNT(*) as total,
                    COUNT(CASE WHEN lp.team_id IS NOT NULL THEN 1 END) as owned,
                    COUNT(CASE WHEN lp.roster_status = 'available' THEN 1 END) as available
                FROM {table_name} lp
                JOIN mlb_players mp ON lp.mlb_player_id = mp.player_id
                GROUP BY mp.position
                ORDER BY mp.position
            """
            
            position_response = execute_sql(position_sql)
            
            stats = {
                'league_id': league_id,
                'total_players': 0,
                'owned_players': 0,
                'available_players': 0,
                'ownership_percentage': 0.0,
                'avg_salary': 0.0,
                'total_salary_committed': 0.0,
                'position_breakdown': []
            }
            
            # Process overall stats
            if stats_response.get('records') and stats_response['records'][0]:
                record = stats_response['records'][0]
                stats['total_players'] = record[0].get('longValue', 0)
                stats['owned_players'] = record[1].get('longValue', 0)
                stats['available_players'] = record[2].get('longValue', 0)
                stats['avg_salary'] = record[3].get('doubleValue', 0.0)
                stats['total_salary_committed'] = record[4].get('doubleValue', 0.0)
                
                if stats['total_players'] > 0:
                    stats['ownership_percentage'] = (stats['owned_players'] / stats['total_players']) * 100
            
            # Process position breakdown
            if position_response.get('records'):
                for record in position_response['records']:
                    position_stats = {
                        'position': record[0].get('stringValue', ''),
                        'total': record[1].get('longValue', 0),
                        'owned': record[2].get('longValue', 0),
                        'available': record[3].get('longValue', 0),
                        'ownership_percentage': 0.0
                    }
                    
                    if position_stats['total'] > 0:
                        position_stats['ownership_percentage'] = (position_stats['owned'] / position_stats['total']) * 100
                    
                    stats['position_breakdown'].append(position_stats)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting league pool stats: {str(e)}")
            return {'error': str(e)}

    @staticmethod
    def cleanup_league_player_pool(league_id: str) -> Dict[str, Any]:
        """Remove league-specific player table (for league deletion)"""
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            # Get count before deletion
            count_sql = f"SELECT COUNT(*) FROM {table_name}"
            count_response = execute_sql(count_sql)
            
            player_count = 0
            if count_response.get('records') and count_response['records'][0]:
                player_count = count_response['records'][0][0].get('longValue', 0)
            
            # Drop the table
            drop_sql = f"DROP TABLE IF EXISTS {table_name} CASCADE"
            execute_sql(drop_sql)
            
            logger.info(f"Cleaned up league player pool for {league_id}: removed {player_count} players")
            
            return {
                'success': True,
                'league_id': league_id,
                'players_removed': player_count,
                'table_dropped': table_name
            }
            
        except Exception as e:
            logger.error(f"Error cleaning up league player pool: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }