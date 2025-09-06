"""
Dynasty Dugout - League Database Connection Router
Routes queries to the correct league-specific database
"""

import logging
from typing import Dict, List, Any, Optional
from contextlib import contextmanager
from core.database import execute_sql

logger = logging.getLogger(__name__)

class LeagueDatabaseRouter:
    """
    Routes database queries to the correct league-specific database.
    Handles connection management and automatic switching between databases.
    """
    
    _current_database = None
    _main_database = "main_database"  # Name of your main database
    
    @staticmethod
    def get_league_database_name(league_id: str) -> str:
        """Generate the database name for a league"""
        return f"league_{league_id.replace('-', '_')}"
    
    @staticmethod
    def switch_to_main_database():
        """Switch to the main Dynasty Dugout database"""
        try:
            if LeagueDatabaseRouter._current_database != LeagueDatabaseRouter._main_database:
                execute_sql(f"USE {LeagueDatabaseRouter._main_database}")
                LeagueDatabaseRouter._current_database = LeagueDatabaseRouter._main_database
                logger.debug(f"Switched to main database: {LeagueDatabaseRouter._main_database}")
        except Exception as e:
            logger.error(f"Error switching to main database: {str(e)}")
            raise
    
    @staticmethod
    def switch_to_league_database(league_id: str):
        """Switch to a specific league's database"""
        try:
            db_name = LeagueDatabaseRouter.get_league_database_name(league_id)
            if LeagueDatabaseRouter._current_database != db_name:
                execute_sql(f"USE {db_name}")
                LeagueDatabaseRouter._current_database = db_name
                logger.debug(f"Switched to league database: {db_name}")
        except Exception as e:
            logger.error(f"Error switching to league database for {league_id}: {str(e)}")
            raise
    
    @staticmethod
    def verify_league_database_exists(league_id: str) -> bool:
        """Check if a league's database exists"""
        try:
            db_name = LeagueDatabaseRouter.get_league_database_name(league_id)
            
            # Switch to main database to check
            LeagueDatabaseRouter.switch_to_main_database()
            
            check_sql = """
                SELECT 1 FROM pg_database WHERE datname = %s
            """
            
            response = execute_sql(check_sql, (db_name,))
            exists = bool(response.get('records'))
            
            logger.debug(f"League database {db_name} exists: {exists}")
            return exists
            
        except Exception as e:
            logger.error(f"Error checking league database existence: {str(e)}")
            return False
    
    @staticmethod
    @contextmanager
    def league_database_context(league_id: str):
        """Context manager for temporarily switching to a league database"""
        original_db = LeagueDatabaseRouter._current_database
        
        try:
            # Verify database exists before switching
            if not LeagueDatabaseRouter.verify_league_database_exists(league_id):
                raise Exception(f"League database does not exist for league: {league_id}")
            
            # Switch to league database
            LeagueDatabaseRouter.switch_to_league_database(league_id)
            yield league_id
            
        finally:
            # Always switch back to original database
            if original_db:
                if original_db == LeagueDatabaseRouter._main_database:
                    LeagueDatabaseRouter.switch_to_main_database()
                else:
                    # Extract league_id from database name if it was a league database
                    if original_db.startswith('league_'):
                        original_league_id = original_db.replace('league_', '').replace('_', '-')
                        LeagueDatabaseRouter.switch_to_league_database(original_league_id)
    
    @staticmethod
    def execute_league_query(league_id: str, sql: str, params: Optional[tuple] = None) -> Dict[str, Any]:
        """Execute a query in a specific league's database"""
        try:
            with LeagueDatabaseRouter.league_database_context(league_id):
                return execute_sql(sql, params)
        except Exception as e:
            logger.error(f"Error executing league query for {league_id}: {str(e)}")
            raise
    
    @staticmethod
    def execute_main_query(sql: str, params: Optional[tuple] = None) -> Dict[str, Any]:
        """Execute a query in the main database"""
        try:
            LeagueDatabaseRouter.switch_to_main_database()
            return execute_sql(sql, params)
        except Exception as e:
            logger.error(f"Error executing main database query: {str(e)}")
            raise
    
    @staticmethod
    def get_league_connection_info(league_id: str) -> Dict[str, Any]:
        """Get connection information for a league's database"""
        try:
            db_name = LeagueDatabaseRouter.get_league_database_name(league_id)
            
            # Switch to main database to get connection info
            LeagueDatabaseRouter.switch_to_main_database()
            
            info_sql = """
                SELECT 
                    datname,
                    pg_encoding_to_char(encoding) as encoding,
                    datcollate,
                    datctype,
                    pg_size_pretty(pg_database_size(datname)) as size_pretty,
                    pg_database_size(datname) as size_bytes,
                    (SELECT count(*) FROM pg_stat_activity WHERE datname = %s) as active_connections
                FROM pg_database 
                WHERE datname = %s
            """
            
            response = execute_sql(info_sql, (db_name, db_name))
            
            if not response.get('records'):
                return {
                    'exists': False,
                    'league_id': league_id,
                    'database_name': db_name
                }
            
            record = response['records'][0]
            
            return {
                'exists': True,
                'league_id': league_id,
                'database_name': record[0].get('stringValue'),
                'encoding': record[1].get('stringValue'),
                'collate': record[2].get('stringValue'),
                'ctype': record[3].get('stringValue'),
                'size_pretty': record[4].get('stringValue'),
                'size_bytes': record[5].get('longValue'),
                'active_connections': record[6].get('longValue')
            }
            
        except Exception as e:
            logger.error(f"Error getting league connection info: {str(e)}")
            return {
                'exists': False,
                'error': str(e),
                'league_id': league_id
            }

# Helper functions for common league database operations
def get_league_players(league_id: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Get players from a league's database"""
    try:
        where_conditions = []
        params = []
        
        if filters:
            if filters.get('status'):
                where_conditions.append("roster_status = %s")
                params.append(filters['status'])
            
            if filters.get('team_id'):
                where_conditions.append("team_id = %s")
                params.append(filters['team_id'])
            
            if filters.get('position'):
                where_conditions.append("position = %s")
                params.append(filters['position'])
            
            if filters.get('active_only', True):
                where_conditions.append("is_active = true")
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        sql = f"""
            SELECT 
                league_player_id, mlb_player_id, team_id, salary, contract_years,
                roster_status, first_name, last_name, position, mlb_team, is_active
            FROM players
            WHERE {where_clause}
            ORDER BY last_name, first_name
        """
        
        response = LeagueDatabaseRouter.execute_league_query(league_id, sql, tuple(params) if params else None)
        
        players = []
        if response.get('records'):
            for record in response['records']:
                players.append({
                    'league_player_id': record[0].get('stringValue'),
                    'mlb_player_id': record[1].get('longValue'),
                    'team_id': record[2].get('stringValue'),
                    'salary': record[3].get('doubleValue', 1.0),
                    'contract_years': record[4].get('longValue', 1),
                    'roster_status': record[5].get('stringValue', 'available'),
                    'first_name': record[6].get('stringValue', ''),
                    'last_name': record[7].get('stringValue', ''),
                    'position': record[8].get('stringValue', ''),
                    'mlb_team': record[9].get('stringValue', ''),
                    'is_active': record[10].get('booleanValue', True)
                })
        
        return players
        
    except Exception as e:
        logger.error(f"Error getting league players: {str(e)}")
        return []

def get_league_teams(league_id: str) -> List[Dict[str, Any]]:
    """Get teams from a league's database"""
    try:
        sql = """
            SELECT team_id, user_id, team_name, manager_name, is_active
            FROM teams
            WHERE is_active = true
            ORDER BY team_name
        """
        
        response = LeagueDatabaseRouter.execute_league_query(league_id, sql)
        
        teams = []
        if response.get('records'):
            for record in response['records']:
                teams.append({
                    'team_id': record[0].get('stringValue'),
                    'user_id': record[1].get('stringValue'),
                    'team_name': record[2].get('stringValue', ''),
                    'manager_name': record[3].get('stringValue', ''),
                    'is_active': record[4].get('booleanValue', True)
                })
        
        return teams
        
    except Exception as e:
        logger.error(f"Error getting league teams: {str(e)}")
        return []

def add_league_transaction(league_id: str, transaction_data: Dict[str, Any]) -> bool:
    """Add a transaction to a league's database"""
    try:
        sql = """
            INSERT INTO transactions (
                transaction_type, from_team_id, to_team_id, player_id,
                salary_change, contract_change, status, notes, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        params = (
            transaction_data.get('transaction_type'),
            transaction_data.get('from_team_id'),
            transaction_data.get('to_team_id'),
            transaction_data.get('player_id'),
            transaction_data.get('salary_change'),
            transaction_data.get('contract_change'),
            transaction_data.get('status', 'pending'),
            transaction_data.get('notes'),
            transaction_data.get('created_by')
        )
        
        LeagueDatabaseRouter.execute_league_query(league_id, sql, params)
        return True
        
    except Exception as e:
        logger.error(f"Error adding league transaction: {str(e)}")
        return False