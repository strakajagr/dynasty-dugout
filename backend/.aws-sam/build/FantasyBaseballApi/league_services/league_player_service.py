"""
Dynasty Dugout - League Player Service
Manages league-specific player pools and provisions separate databases per league
UPDATED: Full PostgreSQL compatibility with database-per-league architecture
FIXED: Removed references to non-existent mp.league column
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
import json
from core.database import (
    execute_sql, 
    create_league_database, 
    drop_league_database, 
    setup_league_database_schema,
    get_league_database_name,
    get_database_info
)

logger = logging.getLogger(__name__)

class LeaguePlayerService:
    """
    Core service for managing league-specific player pools.
    PostgreSQL-compatible with separate databases per league.
    """
    
    @staticmethod
    def create_league_player_pool(league_id: str, player_pool_type: str = 'american_national') -> Dict[str, Any]:
        """Create league-specific database and populate with MLB players"""
        try:
            logger.info(f"Creating league player pool for {league_id} with type {player_pool_type}")
            
            # Step 1: Create the separate database
            db_result = create_league_database(league_id)
            db_name = db_result['database_name']
            
            # Step 2: Set up the database schema
            schema_result = setup_league_database_schema(league_id)
            
            # Step 3: Populate with MLB players based on pool type
            population_result = LeaguePlayerService.populate_league_player_pool(
                league_id, player_pool_type
            )
            
            logger.info(f"Created complete league database for {league_id} with {population_result['players_added']} players")
            
            return {
                'success': True,
                'league_id': league_id,
                'database_name': db_name,
                'player_pool_type': player_pool_type,
                'players_added': population_result['players_added'],
                'database_size_mb': population_result.get('database_size_mb', 0)
            }
            
        except Exception as e:
            logger.error(f"Error creating league player pool: {str(e)}")
            # Cleanup on failure - drop the database if it was created
            try:
                LeaguePlayerService.cleanup_league_database(league_id)
            except:
                pass
            raise

    @staticmethod
    def populate_league_player_pool(league_id: str, player_pool_type: str) -> Dict[str, Any]:
        """Populate the league database with filtered MLB players"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Determine which players to include based on player pool type
            where_conditions = ["mp.player_id IS NOT NULL"]
            
            # FIXED: Removed league-based filtering since mp.league column doesn't exist
            # Instead, filter by active status and other available criteria
            if player_pool_type in ['al_only', 'nl_only', 'american_national']:
                # For now, include all active MLB players regardless of league
                # TODO: Add proper league filtering when mlb_teams table has league info
                where_conditions.append("mp.is_active = true")
            elif player_pool_type == 'minor_leagues_only':
                # This assumes you have a column for minor league players
                where_conditions.append("mp.is_minor_league = true")
            else:
                # 'all_mlb' - include all active players
                where_conditions.append("mp.is_active = true")
            
            where_clause = " AND ".join(where_conditions)
            
            # FIXED: Removed mp.league from SELECT since column doesn't exist
            get_players_sql = f"""
                SELECT 
                    mp.player_id, mp.first_name, mp.last_name, mp.position,
                    mp.mlb_team, mp.jersey_number, mp.is_active
                FROM mlb_players mp
                WHERE {where_clause}
                ORDER BY mp.last_name, mp.first_name
                LIMIT 5000
            """
            
            # Execute on main database (no database_name parameter)
            players_response = execute_sql(get_players_sql)
            
            # Insert players into league database
            players_added = 0
            if players_response.get('records'):
                for record in players_response['records']:
                    insert_sql = """
                        INSERT INTO league_players (
                            mlb_player_id, salary, contract_years, roster_status, position_eligibility
                        ) VALUES (
                            :mlb_player_id, 1.0, 1, 'available', ARRAY[:position_eligibility]
                        )
                        ON CONFLICT (mlb_player_id) DO NOTHING
                    """
                    
                    # Execute on league database
                    execute_sql(insert_sql, {
                        'mlb_player_id': record[0].get('longValue'),
                        'first_name': record[1].get('stringValue', ''),
                        'last_name': record[2].get('stringValue', ''),
                        'position': record[3].get('stringValue', ''),
                        'mlb_team': record[4].get('stringValue', ''),
                        'jersey_number': record[5].get('longValue'),
                        'is_active': record[6].get('booleanValue', True),
                        'position_eligibility': record[3].get('stringValue', '')
                    }, database_name=db_name)
                    
                    players_added += 1
            
            # Get database size from main database
            size_sql = f"""
                SELECT pg_database_size(:db_name) / 1024.0 / 1024.0 as size_mb
            """
            size_response = execute_sql(size_sql, {'db_name': db_name})
            
            database_size_mb = 0
            if size_response.get('records') and size_response['records'][0]:
                size_value = size_response['records'][0][0]
                if size_value and not size_value.get('isNull'):
                    database_size_mb = size_value.get('doubleValue', 0)
            
            logger.info(f"Populated league {league_id} database with {players_added} players ({database_size_mb:.2f} MB)")
            
            return {
                'success': True,
                'players_added': players_added,
                'database_size_mb': database_size_mb,
                'player_pool_type': player_pool_type
            }
            
        except Exception as e:
            logger.error(f"Error populating league player pool: {str(e)}")
            raise

    @staticmethod
    def cleanup_league_database(league_id: str) -> Dict[str, Any]:
        """Completely drop the league database and free all resources"""
        try:
            return drop_league_database(league_id)
        except Exception as e:
            logger.error(f"Error dropping league database: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'league_id': league_id
            }

    @staticmethod
    def get_league_database_info(league_id: str) -> Dict[str, Any]:
        """Get information about a league's database"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Get basic database info
            basic_info = get_database_info(db_name)
            
            if not basic_info['exists']:
                return {
                    'exists': False,
                    'league_id': league_id,
                    'database_name': db_name
                }
            
            # Get table stats from the league database
            table_stats_sql = """
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
                FROM pg_stat_user_tables
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            """
            
            table_response = execute_sql(table_stats_sql, database_name=db_name)
            
            tables = []
            if table_response.get('records'):
                for table_record in table_response['records']:
                    tables.append({
                        'schema': table_record[0].get('stringValue', ''),
                        'table': table_record[1].get('stringValue', ''),
                        'inserts': table_record[2].get('longValue', 0),
                        'updates': table_record[3].get('longValue', 0),
                        'deletes': table_record[4].get('longValue', 0),
                        'size': table_record[5].get('stringValue', '0 bytes')
                    })
            
            return {
                'exists': True,
                'league_id': league_id,
                'database_name': basic_info['database_name'],
                'size_pretty': basic_info['size_pretty'],
                'size_mb': basic_info['size_mb'],
                'active_connections': basic_info['active_connections'],
                'tables': tables
            }
            
        except Exception as e:
            logger.error(f"Error getting league database info: {str(e)}")
            return {
                'exists': False,
                'error': str(e),
                'league_id': league_id
            }

    @staticmethod
    def sync_with_mlb_updates(league_id: str) -> Dict[str, Any]:
        """Sync league database with latest MLB data updates"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Get league's player pool configuration from main database
            league_config_sql = """
                SELECT player_pool FROM user_leagues 
                WHERE league_id = :league_id::uuid
            """
            
            config_response = execute_sql(league_config_sql, {'league_id': league_id})
            player_pool_type = 'american_national'  # Default
            
            if config_response.get('records') and config_response['records'][0]:
                pool_value = config_response['records'][0][0]
                if pool_value and not pool_value.get('isNull'):
                    player_pool_type = pool_value.get('stringValue', 'american_national')
            
            sync_results = {
                'league_id': league_id,
                'database_name': db_name,
                'new_players_added': 0,
                'players_updated': 0,
                'players_deactivated': 0,
                'changes': []
            }
            
            # FIXED: Removed league-based filtering since mp.league column doesn't exist
            where_conditions = ["mp.player_id IS NOT NULL"]
            if player_pool_type in ['al_only', 'nl_only', 'american_national']:
                # For now, sync all active players regardless of league
                where_conditions.append("mp.is_active = true")
            elif player_pool_type == 'minor_leagues_only':
                where_conditions.append("mp.is_minor_league = true")
            else:
                where_conditions.append("mp.is_active = true")
            
            where_clause = " AND ".join(where_conditions)
            
            updated_players_sql = f"""
                SELECT player_id, first_name, last_name, position, mlb_team, 
                       jersey_number, is_active, updated_at
                FROM mlb_players mp
                WHERE {where_clause}
                AND updated_at > NOW() - INTERVAL '1 day'
            """
            
            # Execute on main database
            updated_response = execute_sql(updated_players_sql)
            
            # Apply updates to league database
            if updated_response.get('records'):
                for record in updated_response['records']:
                    update_sql = """
                        UPDATE league_players 
                        SET first_name = :first_name, last_name = :last_name, position = :position,
                            mlb_team = :mlb_team, jersey_number = :jersey_number, is_active = :is_active,
                            updated_at = NOW()
                        WHERE mlb_player_id = :mlb_player_id
                    """
                    
                    # Execute on league database
                    execute_sql(update_sql, {
                        'first_name': record[1].get('stringValue', ''),
                        'last_name': record[2].get('stringValue', ''),
                        'position': record[3].get('stringValue', ''),
                        'mlb_team': record[4].get('stringValue', ''),
                        'jersey_number': record[5].get('longValue'),
                        'is_active': record[6].get('booleanValue', True),
                        'mlb_player_id': record[0].get('longValue')
                    }, database_name=db_name)
                    
                    sync_results['players_updated'] += 1
            
            logger.info(f"Synced league {league_id} database: {sync_results['players_updated']} players updated")
            
            return sync_results
            
        except Exception as e:
            logger.error(f"Error syncing league with MLB updates: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_league_players(league_id: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get players from league database with filtering options"""
        try:
            db_name = get_league_database_name(league_id)
            
            if filters is None:
                filters = {}
            
            # Build WHERE clause based on filters
            where_conditions = []
            params = {}
            
            # Filter by roster status
            status = filters.get('status', 'available')
            if status:
                where_conditions.append("roster_status = :status")
                params['status'] = status
            
            # Filter by position
            position = filters.get('position')
            if position:
                where_conditions.append("position = :position")
                params['position'] = position
            
            # Filter by team
            team_id = filters.get('team_id')
            if team_id:
                where_conditions.append("team_id = :team_id::uuid")
                params['team_id'] = team_id
            
            # Filter by active status
            active_only = filters.get('active_only', True)
            if active_only:
                where_conditions.append("is_active = :is_active")
                params['is_active'] = True
            
            # Search by name
            search = filters.get('search')
            if search:
                where_conditions.append("(first_name ILIKE :search OR last_name ILIKE :search)")
                params['search'] = f'%{search}%'
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            # Pagination
            limit = filters.get('limit', 50)
            offset = filters.get('offset', 0)
            
            sql = f"""
                SELECT 
                    league_player_id, mlb_player_id, team_id, salary, contract_years,
                    roster_status, acquisition_date, first_name, last_name, position,
                    mlb_team, jersey_number, is_active
                FROM league_players
                WHERE {where_clause}
                ORDER BY last_name, first_name
                LIMIT :limit OFFSET :offset
            """
            
            params['limit'] = limit
            params['offset'] = offset
            
            response = execute_sql(sql, params, database_name=db_name)
            
            players = []
            if response.get('records'):
                for record in response['records']:
                    player = {
                        'league_player_id': record[0].get('stringValue'),
                        'mlb_player_id': record[1].get('longValue'),
                        'team_id': record[2].get('stringValue'),
                        'salary': record[3].get('doubleValue', 1.0),
                        'contract_years': record[4].get('longValue', 1),
                        'roster_status': record[5].get('stringValue', 'available'),
                        'acquisition_date': record[6].get('stringValue'),
                        'first_name': record[7].get('stringValue', ''),
                        'last_name': record[8].get('stringValue', ''),
                        'position': record[9].get('stringValue', ''),
                        'mlb_team': record[10].get('stringValue', ''),
                        'jersey_number': record[11].get('longValue'),
                        'is_active': record[12].get('booleanValue', True)
                    }
                    players.append(player)
            
            return players
            
        except Exception as e:
            logger.error(f"Error getting league players: {str(e)}")
            return []

    @staticmethod
    def get_league_pool_stats(league_id: str) -> Dict[str, Any]:
        """Get statistics about the league's player pool"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Get basic player counts
            stats_sql = """
                SELECT 
                    COUNT(*) as total_players,
                    COUNT(*) FILTER (WHERE roster_status = 'available') as available_players,
                    COUNT(*) FILTER (WHERE roster_status = 'rostered') as rostered_players,
                    COUNT(*) FILTER (WHERE is_active = true) as active_players,
                    COUNT(*) FILTER (WHERE is_active = false) as inactive_players
                FROM league_players
            """
            
            stats_response = execute_sql(stats_sql, database_name=db_name)
            
            # Get position breakdown
            position_sql = """
                SELECT position, COUNT(*) as count
                FROM league_players
                WHERE is_active = true
                GROUP BY position
                ORDER BY count DESC
            """
            
            position_response = execute_sql(position_sql, database_name=db_name)
            
            # Get team breakdown
            team_sql = """
                SELECT mlb_team, COUNT(*) as count
                FROM league_players
                WHERE is_active = true
                GROUP BY mlb_team
                ORDER BY count DESC
            """
            
            team_response = execute_sql(team_sql, database_name=db_name)
            
            stats = {
                'league_id': league_id,
                'database_name': db_name,
                'total_players': 0,
                'available_players': 0,
                'rostered_players': 0,
                'active_players': 0,
                'inactive_players': 0,
                'positions': [],
                'teams': []
            }
            
            # Parse basic stats
            if stats_response.get('records') and stats_response['records'][0]:
                record = stats_response['records'][0]
                stats.update({
                    'total_players': record[0].get('longValue', 0),
                    'available_players': record[1].get('longValue', 0),
                    'rostered_players': record[2].get('longValue', 0),
                    'active_players': record[3].get('longValue', 0),
                    'inactive_players': record[4].get('longValue', 0)
                })
            
            # Parse position breakdown
            if position_response.get('records'):
                for record in position_response['records']:
                    stats['positions'].append({
                        'position': record[0].get('stringValue', ''),
                        'count': record[1].get('longValue', 0)
                    })
            
            # Parse team breakdown
            if team_response.get('records'):
                for record in team_response['records']:
                    stats['teams'].append({
                        'team': record[0].get('stringValue', ''),
                        'count': record[1].get('longValue', 0)
                    })
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting league pool stats: {str(e)}")
            return {
                'league_id': league_id,
                'error': str(e)
            }