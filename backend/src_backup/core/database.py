"""
Dynasty Dugout - Database Operations
Centralized database connection and query execution with PostgreSQL database-per-league support
"""
import logging
import os
import boto3
from fastapi import HTTPException
from pathlib import Path

# Auto-load .env file if it exists (for local development)
try:
    from dotenv import load_dotenv
    # Try to load .env from multiple possible locations
    env_paths = [
        Path(__file__).parent.parent.parent / '.env',  # backend/.env
        Path(__file__).parent.parent / '.env',          # src/.env
        Path('.env')                                    # current directory
    ]
    
    for env_path in env_paths:
        if env_path.exists():
            load_dotenv(env_path)
            break
except ImportError:
    pass  # dotenv not installed, likely running in Lambda

from .aws_clients import get_rds_client
from .config import DATABASE_CONFIG

logger = logging.getLogger(__name__)

def execute_sql(sql: str, parameters=None, database_name=None):
    """
    Execute SQL query using RDS Data API with PostgreSQL database switching support.
    """
    # 🐛 DEBUG: This is the only line we are adding to test the logs.
    print('!!!!!! ENTERING EXECUTE_SQL IN DATABASE.PY !!!!!!')
    
    rds_client = get_rds_client()
    
    if not rds_client:
        raise HTTPException(status_code=500, detail="Database client not initialized")
    
    try:
        # Use specified database or default to main database
        target_database = database_name or DATABASE_CONFIG['database']
        
        logger.info(f"Executing SQL on database '{target_database}': {sql[:100]}...")
        
        params = {
            'resourceArn': DATABASE_CONFIG['resourceArn'],
            'secretArn': DATABASE_CONFIG['secretArn'],
            'database': target_database,
            'sql': sql,
            'includeResultMetadata': True
        }
        
        # Parameter conversion with explicit boolean handling
        if parameters:
            if isinstance(parameters, dict):
                # Convert from dict format: {'key': value} to RDS format
                rds_parameters = []
                for key, value in parameters.items():
                    param = {'name': key}
                    
                    if value is None:
                        param['value'] = {'isNull': True}
                    elif isinstance(value, bool):
                        # Handle booleans BEFORE int check (bool is subclass of int in Python)
                        param['value'] = {'booleanValue': value}
                    elif isinstance(value, int):
                        param['value'] = {'longValue': value}
                    elif isinstance(value, float):
                        param['value'] = {'doubleValue': value}
                    elif isinstance(value, str):
                        param['value'] = {'stringValue': value}
                    else:
                        # Convert other types to string as fallback
                        param['value'] = {'stringValue': str(value)}
                    
                    rds_parameters.append(param)
                
                logger.info(f"Converted parameters: {rds_parameters}")
                params['parameters'] = rds_parameters
                
            elif isinstance(parameters, list):
                # Already in RDS format
                params['parameters'] = parameters
            
        response = rds_client.execute_statement(**params)
        logger.info(f"SQL executed successfully on '{target_database}', returned {len(response.get('records', []))} records")
        return response
        
    except Exception as e:
        logger.error(f"Database error on '{target_database or 'default'}': {str(e)}")
        logger.error(f"SQL: {sql}")
        logger.error(f"Parameters: {parameters}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

def execute_sql_on_database(sql: str, parameters=None, database_name=None):
    """
    Execute SQL query on a specific database - alias for execute_sql with database switching
    """
    return execute_sql(sql, parameters, database_name)

def create_league_database(league_id: str) -> dict:
    """
    Create a new PostgreSQL database for league-specific data only
    ARCHITECTURE: MLB data stays in main 'postgres' database, league data gets its own database
    """
    try:
        # Generate safe database name from league ID
        db_name = f"league_{league_id.replace('-', '_')}"
        
        logger.info(f"Creating league database (league-specific data only): {db_name}")
        
        # FIXED: Execute CREATE DATABASE on the 'postgres' system database
        # This is the only way to create databases via RDS Data API
        create_db_sql = f'CREATE DATABASE "{db_name}"'
        
        # Execute on 'postgres' system database (not main app database)
        execute_sql(create_db_sql, database_name='postgres')
        
        logger.info(f"Successfully created league database: {db_name}")
        
        return {
            'success': True,
            'database_name': db_name,
            'league_id': league_id
        }
        
    except Exception as e:
        logger.error(f"Error creating database for league {league_id}: {str(e)}")
        raise

def setup_league_database_schema(league_id: str) -> dict:
    """
    Set up schema for league-specific data only
    CRITICAL: This does NOT copy MLB data - creates tables that reference MLB data via foreign keys
    FIXED: Execute each SQL statement separately (RDS Data API doesn't support multistatements)
    """
    try:
        db_name = f"league_{league_id.replace('-', '_')}"
        
        logger.info(f"Setting up league schema (league-specific data only) in database: {db_name}")
        
        # Create league_players table - ONLY league-specific data with foreign key to MLB data
        create_league_players_table = """
            CREATE TABLE IF NOT EXISTS league_players (
                league_player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mlb_player_id INTEGER NOT NULL,  -- Foreign key to postgres.mlb_players.player_id
                team_id UUID,                      -- Which fantasy team owns this player
                salary DECIMAL(8,2) DEFAULT 1.0,
                contract_years INTEGER DEFAULT 1,
                roster_status VARCHAR(20) DEFAULT 'available',
                position_eligibility TEXT[],
                acquisition_date TIMESTAMP,
                acquisition_method VARCHAR(20), -- 'draft', 'trade', 'waiver', 'free_agent'
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_mlb_player_per_league UNIQUE(mlb_player_id)
            );
        """
        
        # Create league_teams table
        create_league_teams_table = """
            CREATE TABLE IF NOT EXISTS league_teams (
                team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(255) NOT NULL,   -- References Cognito user_id
                team_name VARCHAR(255),
                manager_name VARCHAR(255),
                team_logo_url TEXT,
                team_colors JSONB,
                team_motto TEXT,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_user_per_league UNIQUE(user_id)
            );
        """
        
        # Create league_transactions table
        create_league_transactions_table = """
            CREATE TABLE IF NOT EXISTS league_transactions (
                transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_player_id UUID NOT NULL,
                from_team_id UUID,              -- NULL for free agent pickups
                to_team_id UUID,                -- NULL for releases
                transaction_type VARCHAR(50) NOT NULL, -- 'draft', 'trade', 'waiver', 'free_agent', 'release'
                salary_change DECIMAL(8,2),
                contract_change INTEGER,
                transaction_date TIMESTAMP DEFAULT NOW(),
                processed_date TIMESTAMP,
                status VARCHAR(20) DEFAULT 'pending',
                notes TEXT,
                created_by VARCHAR(255),
                FOREIGN KEY (league_player_id) REFERENCES league_players(league_player_id),
                FOREIGN KEY (from_team_id) REFERENCES league_teams(team_id),
                FOREIGN KEY (to_team_id) REFERENCES league_teams(team_id)
            );
        """
        
        # Create league_standings table
        create_league_standings_table = """
            CREATE TABLE IF NOT EXISTS league_standings (
                standings_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID NOT NULL,
                category VARCHAR(50) NOT NULL,  -- 'batting_avg', 'home_runs', 'era', etc.
                value DECIMAL(10,4),
                rank INTEGER,
                points INTEGER,
                calculation_date TIMESTAMP DEFAULT NOW(),
                season INTEGER DEFAULT 2025,
                CONSTRAINT unique_team_category UNIQUE(team_id, category, season),
                FOREIGN KEY (team_id) REFERENCES league_teams(team_id)
            );
        """
        
        # Create league_settings table
        create_league_settings_table = """
            CREATE TABLE IF NOT EXISTS league_settings (
                setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id VARCHAR(255) NOT NULL,
                setting_name VARCHAR(100) NOT NULL,
                setting_value TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(league_id, setting_name)
            );
        """
        
        # Execute all table creations (one at a time - RDS Data API requirement)
        execute_sql(create_league_players_table, database_name=db_name)
        logger.info(f"✅ Created league_players table (foreign key to MLB data) in {db_name}")
        
        execute_sql(create_league_teams_table, database_name=db_name)
        logger.info(f"✅ Created league_teams table in {db_name}")
        
        execute_sql(create_league_transactions_table, database_name=db_name)
        logger.info(f"✅ Created league_transactions table in {db_name}")
        
        execute_sql(create_league_standings_table, database_name=db_name)
        logger.info(f"✅ Created league_standings table in {db_name}")
        
        execute_sql(create_league_settings_table, database_name=db_name)
        logger.info(f"✅ Created league_settings table in {db_name}")
        
        # FIXED: Create indexes one at a time (RDS Data API doesn't support multistatements)
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_league_players_mlb_id ON league_players(mlb_player_id)",
            "CREATE INDEX IF NOT EXISTS idx_league_players_team ON league_players(team_id)",
            "CREATE INDEX IF NOT EXISTS idx_league_players_status ON league_players(roster_status)",
            "CREATE INDEX IF NOT EXISTS idx_league_transactions_player ON league_transactions(league_player_id)",
            "CREATE INDEX IF NOT EXISTS idx_league_transactions_date ON league_transactions(transaction_date)",
            "CREATE INDEX IF NOT EXISTS idx_league_standings_team ON league_standings(team_id)",
            "CREATE INDEX IF NOT EXISTS idx_league_standings_category ON league_standings(category)"
        ]
        
        # Execute each index creation separately
        for i, index_sql in enumerate(indexes, 1):
            execute_sql(index_sql, database_name=db_name)
            logger.info(f"✅ Created index {i}/{len(indexes)} in {db_name}")
        
        logger.info(f"🎉 League database schema setup completed for {db_name} - LEAGUE DATA ONLY, MLB data remains in main database")
        
        return {
            'success': True,
            'database_name': db_name,
            'tables_created': [
                'league_players',  # Foreign key references to MLB data
                'league_teams', 
                'league_transactions', 
                'league_standings', 
                'league_settings'
            ],
            'indexes_created': len(indexes),
            'architecture': 'separation_model'  # MLB data in main DB, league data in league DB
        }
        
    except Exception as e:
        logger.error(f"Error setting up league database schema: {str(e)}")
        raise

def get_league_player_with_mlb_stats(league_id: str, mlb_player_id: int) -> dict:
    """
    Get complete player data: MLB stats + league-specific data
    This is how users see both historical stats AND league contract info
    """
    try:
        db_name = get_league_database_name(league_id)
        
        logger.info(f"Getting combined MLB + league data for player {mlb_player_id} in league {league_id}")
        
        # Get league-specific data from league database
        league_query = """
            SELECT league_player_id, team_id, salary, contract_years, 
                   roster_status, position_eligibility, acquisition_date, acquisition_method
            FROM league_players 
            WHERE mlb_player_id = :player_id
        """
        league_response = execute_sql(
            league_query,
            parameters={'player_id': mlb_player_id},
            database_name=db_name
        )
        
        # Get MLB stats and bio data from main database
        mlb_query = """
            SELECT p.player_id, p.first_name, p.last_name, p.position, p.mlb_team, p.jersey_number,
                   s.batting_avg, s.home_runs, s.rbi, s.era, s.wins, s.saves, s.stolen_bases,
                   cs.career_batting_avg, cs.career_home_runs, cs.career_rbi
            FROM mlb_players p
            LEFT JOIN player_stats s ON p.player_id = s.player_id AND s.season = 2025
            LEFT JOIN player_career_stats cs ON p.player_id = cs.player_id
            WHERE p.player_id = :player_id
        """
        mlb_response = execute_sql(
            mlb_query,
            parameters={'player_id': mlb_player_id},
            database_name="postgres"  # Main MLB database
        )
        
        # Combine the data
        if league_response.get('records') and mlb_response.get('records'):
            league_data = format_single_record(league_response['records'][0], league_response)
            mlb_data = format_single_record(mlb_response['records'][0], mlb_response)
            
            combined_data = {
                **league_data,  # League-specific: salary, contract, roster_status
                **mlb_data      # MLB data: stats, bio, historical data
            }
            
            logger.info(f"✅ Successfully combined MLB + league data for player {mlb_player_id}")
            return combined_data
        else:
            logger.warning(f"Player {mlb_player_id} not found in league {league_id} or MLB database")
            return None
            
    except Exception as e:
        logger.error(f"Error getting league player with MLB stats: {str(e)}")
        raise

def get_team_roster_with_mlb_stats(league_id: str, team_id: str) -> list:
    """
    Get complete team roster: All players with MLB stats + league contract info
    This shows users their team with current performance and contract details
    """
    try:
        db_name = get_league_database_name(league_id)
        
        logger.info(f"Getting team roster with MLB stats for team {team_id} in league {league_id}")
        
        # Get all players on the team with their league data
        roster_query = """
            SELECT lp.league_player_id, lp.mlb_player_id, lp.salary, lp.contract_years, 
                   lp.roster_status, lp.acquisition_date
            FROM league_players lp 
            WHERE lp.team_id = :team_id AND lp.is_active = true
            ORDER BY lp.salary DESC
        """
        roster_response = execute_sql(
            roster_query,
            parameters={'team_id': team_id},
            database_name=db_name
        )
        
        if not roster_response.get('records'):
            return []
        
        roster_data = format_player_data(roster_response['records'], roster_response)
        
        # Get MLB data for all players in batch
        mlb_player_ids = [player['mlb_player_id'] for player in roster_data]
        
        if not mlb_player_ids:
            return []
        
        # Create IN clause for batch query
        ids_placeholder = ','.join([str(pid) for pid in mlb_player_ids])
        
        mlb_query = f"""
            SELECT p.player_id, p.first_name, p.last_name, p.position, p.mlb_team,
                   s.batting_avg, s.home_runs, s.rbi, s.era, s.wins, s.saves
            FROM mlb_players p
            LEFT JOIN player_stats s ON p.player_id = s.player_id AND s.season = 2025
            WHERE p.player_id IN ({ids_placeholder})
        """
        mlb_response = execute_sql(mlb_query, database_name="postgres")
        
        if not mlb_response.get('records'):
            return roster_data  # Return league data only if no MLB data found
        
        mlb_data = format_player_data(mlb_response['records'], mlb_response)
        
        # Create lookup dict for MLB data
        mlb_lookup = {player['player_id']: player for player in mlb_data}
        
        # Combine league and MLB data
        combined_roster = []
        for league_player in roster_data:
            mlb_player = mlb_lookup.get(league_player['mlb_player_id'], {})
            combined_player = {
                **league_player,  # League contract info
                **mlb_player      # Current MLB performance
            }
            combined_roster.append(combined_player)
        
        logger.info(f"✅ Successfully combined roster data for {len(combined_roster)} players")
        return combined_roster
        
    except Exception as e:
        logger.error(f"Error getting team roster with MLB stats: {str(e)}")
        raise

def add_player_to_league(league_id: str, mlb_player_id: int, team_id: str = None, salary: float = 1.0) -> dict:
    """
    Add a player to a league (creates league-specific data, references MLB data)
    """
    try:
        db_name = get_league_database_name(league_id)
        
        logger.info(f"Adding MLB player {mlb_player_id} to league {league_id}")
        
        # First verify the MLB player exists in main database
        verify_query = "SELECT player_id, first_name, last_name FROM mlb_players WHERE player_id = :player_id"
        verify_response = execute_sql(
            verify_query,
            parameters={'player_id': mlb_player_id},
            database_name="postgres"
        )
        
        if not verify_response.get('records'):
            raise ValueError(f"MLB player {mlb_player_id} not found in main database")
        
        # Add player to league database
        insert_query = """
            INSERT INTO league_players (mlb_player_id, team_id, salary, acquisition_method, acquisition_date)
            VALUES (:mlb_player_id, :team_id, :salary, 'manual', NOW())
            RETURNING league_player_id
        """
        
        insert_response = execute_sql(
            insert_query,
            parameters={
                'mlb_player_id': mlb_player_id,
                'team_id': team_id,
                'salary': salary
            },
            database_name=db_name
        )
        
        if insert_response.get('records'):
            league_player_id = insert_response['records'][0][0].get('stringValue')
            logger.info(f"✅ Successfully added player to league with ID: {league_player_id}")
            
            return {
                'success': True,
                'league_player_id': league_player_id,
                'mlb_player_id': mlb_player_id,
                'league_id': league_id
            }
        else:
            raise Exception("Failed to insert player into league")
            
    except Exception as e:
        logger.error(f"Error adding player to league: {str(e)}")
        raise

def drop_league_database(league_id: str) -> dict:
    """
    Drop a PostgreSQL database for a league using RDS Data API on postgres system database
    """
    try:
        db_name = f"league_{league_id.replace('-', '_')}"
        logger.info(f"Dropping database: {db_name}")
        
        size_sql = f"SELECT pg_database_size('{db_name}') / 1024.0 / 1024.0 as size_mb"
        database_size_mb = 0
        try:
            size_response = execute_sql(size_sql, database_name='postgres')
            if size_response.get('records') and size_response['records'][0]:
                size_mb_value = size_response['records'][0][0]
                if size_mb_value and not size_mb_value.get('isNull'):
                    database_size_mb = size_mb_value.get('doubleValue', 0)
        except Exception as size_error:
            logger.warning(f"Could not get database size: {size_error}")
        
        terminate_sql = f"""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = '{db_name}' AND pid <> pg_backend_pid()
        """
        try:
            execute_sql(terminate_sql, database_name='postgres')
        except Exception as terminate_error:
            logger.warning(f"Could not terminate connections: {terminate_error}")
        
        drop_db_sql = f'DROP DATABASE IF EXISTS "{db_name}"'
        execute_sql(drop_db_sql, database_name='postgres')
        
        logger.info(f"Successfully dropped database: {db_name} - freed {database_size_mb:.2f} MB")
        
        return {
            'success': True,
            'database_name': db_name,
            'league_id': league_id,
            'database_size_freed_mb': database_size_mb
        }
    except Exception as e:
        logger.error(f"Error dropping database for league {league_id}: {str(e)}")
        return {'success': False, 'error': str(e), 'league_id': league_id}

def get_database_info(database_name: str) -> dict:
    """
    Get information about a specific database (execute on postgres system db)
    """
    try:
        info_sql = f"""
            SELECT 
                datname,
                pg_size_pretty(pg_database_size(datname)) as size_pretty,
                pg_database_size(datname) / 1024.0 / 1024.0 as size_mb,
                (SELECT count(*) FROM pg_stat_activity WHERE datname = '{database_name}') as active_connections
            FROM pg_database 
            WHERE datname = '{database_name}'
        """
        response = execute_sql(info_sql, database_name='postgres')
        
        if not response.get('records'):
            return {'exists': False, 'database_name': database_name}
        
        record = response['records'][0]
        return {
            'exists': True,
            'database_name': record[0].get('stringValue'),
            'size_pretty': record[1].get('stringValue'),
            'size_mb': record[2].get('doubleValue'),
            'active_connections': record[3].get('longValue')
        }
    except Exception as e:
        logger.error(f"Error getting database info for {database_name}: {str(e)}")
        return {'exists': False, 'error': str(e), 'database_name': database_name}

def list_league_databases() -> dict:
    """
    List all league databases that exist (for cleanup purposes)
    """
    try:
        logger.info("Listing all league databases for cleanup check")
        list_sql = """
            SELECT datname, pg_size_pretty(pg_database_size(datname)) as size_pretty,
                   pg_database_size(datname) / 1024.0 / 1024.0 as size_mb
            FROM pg_database 
            WHERE datname LIKE 'league_%'
            ORDER BY datname
        """
        response = execute_sql(list_sql, database_name='postgres')
        
        databases = []
        total_size_mb = 0
        
        if response.get('records'):
            for record in response['records']:
                db_info = {
                    'database_name': record[0].get('stringValue'),
                    'size_pretty': record[1].get('stringValue'),
                    'size_mb': record[2].get('doubleValue', 0)
                }
                databases.append(db_info)
                total_size_mb += db_info['size_mb']
        
        logger.info(f"Found {len(databases)} league databases totaling {total_size_mb:.2f} MB")
        
        return {
            'success': True,
            'databases': databases,
            'total_count': len(databases),
            'total_size_mb': total_size_mb
        }
    except Exception as e:
        logger.error(f"Error listing league databases: {str(e)}")
        return {'success': False, 'error': str(e), 'databases': []}

def cleanup_all_league_databases() -> dict:
    """
    Emergency cleanup function to drop all league databases
    USE WITH CAUTION - This will delete ALL league data
    """
    try:
        logger.warning("CLEANUP: Starting emergency cleanup of all league databases")
        
        list_result = list_league_databases()
        if not list_result['success']:
            return list_result
        
        databases = list_result['databases']
        cleaned_up = []
        failed = []
        total_freed_mb = 0
        
        for db_info in databases:
            db_name = db_info['database_name']
            try:
                league_id = db_name.replace('league_', '').replace('_', '-')
                logger.info(f"CLEANUP: Dropping database {db_name} (league: {league_id})")
                cleanup_result = drop_league_database(league_id)
                
                if cleanup_result['success']:
                    freed_mb = cleanup_result.get('database_size_freed_mb', 0)
                    cleaned_up.append({'database_name': db_name, 'league_id': league_id, 'size_freed_mb': freed_mb})
                    total_freed_mb += freed_mb
                else:
                    failed.append({'database_name': db_name, 'league_id': league_id, 'error': cleanup_result.get('error')})
            except Exception as cleanup_error:
                logger.error(f"CLEANUP: Failed to drop {db_name}: {cleanup_error}")
                failed.append({'database_name': db_name, 'error': str(cleanup_error)})
        
        logger.warning(f"CLEANUP COMPLETE: {len(cleaned_up)} databases dropped, {len(failed)} failed, {total_freed_mb:.2f} MB freed")
        
        return {
            'success': True,
            'cleaned_up': cleaned_up,
            'failed': failed,
            'total_dropped': len(cleaned_up),
            'total_failed': len(failed),
            'total_freed_mb': total_freed_mb
        }
    except Exception as e:
        logger.error(f"Error during emergency cleanup: {str(e)}")
        return {'success': False, 'error': str(e)}

def get_league_database_name(league_id: str) -> str:
    """
    Generate standardized database name for a league
    """
    return f"league_{league_id.replace('-', '_')}"

def format_single_record(record, response):
    """Convert single RDS Data API record to clean object"""
    if not record or not response:
        return {}
    
    columns = []
    if 'columnMetadata' in response:
        columns = [col['name'] for col in response['columnMetadata']]
    elif 'resultMetadata' in response and 'columnMetadata' in response['resultMetadata']:
        columns = [col['name'] for col in response['resultMetadata']['columnMetadata']]
    else:
        return {}
    
    if not columns:
        return {}
    
    result = {}
    for j, column in enumerate(columns):
        if j < len(record):
            value = record[j]
            if isinstance(value, dict):
                if 'stringValue' in value:
                    result[column] = value['stringValue']
                elif 'longValue' in value:
                    result[column] = value['longValue']
                elif 'doubleValue' in value:
                    result[column] = value['doubleValue']
                elif 'booleanValue' in value:
                    result[column] = value['booleanValue']
                elif 'isNull' in value and value['isNull']:
                    result[column] = None
                else:
                    result[column] = str(value)
            else:
                result[column] = value
        else:
            result[column] = None
    
    return result

def format_player_data(records, response):
    """Convert RDS Data API response to clean player objects"""
    if not records or not response:
        return []
    
    columns = []
    if 'columnMetadata' in response:
        columns = [col['name'] for col in response['columnMetadata']]
    elif 'resultMetadata' in response and 'columnMetadata' in response['resultMetadata']:
        columns = [col['name'] for col in response['resultMetadata']['columnMetadata']]
    else:
        return []
    
    if not columns:
        return []
    
    players = []
    
    for record in records:
        player = {}
        for j, column in enumerate(columns):
            if j < len(record):
                value = record[j]
                if isinstance(value, dict):
                    if 'stringValue' in value:
                        player[column] = value['stringValue']
                    elif 'longValue' in value:
                        player[column] = value['longValue']
                    elif 'doubleValue' in value:
                        player[column] = value['doubleValue']
                    elif 'booleanValue' in value:
                        player[column] = value['booleanValue']
                    elif 'isNull' in value and value['isNull']:
                        player[column] = None
                    else:
                        player[column] = str(value)
                else:
                    player[column] = value
            else:
                player[column] = None
        players.append(player)
    
    return players

def test_database_connection(database_name=None):
    """Test database connection for health checks"""
    try:
        sql = "SELECT 1 as health_check"
        response = execute_sql(sql, database_name=database_name)
        return bool(response.get('records'))
    except Exception as e:
        logger.error(f"Database health check failed for '{database_name or 'default'}': {str(e)}")
        return False

def get_user_profile(user_id: str):
    """Get user profile from main database"""
    try:
        sql = """
            SELECT user_id, date_of_birth, profile_picture_url, preferences, created_at, updated_at 
            FROM user_profiles 
            WHERE user_id = :user_id
        """
        response = execute_sql(sql, {'user_id': user_id})
        
        if response.get('records'):
            record = response['records'][0]
            return {
                'user_id': record[0].get('stringValue'),
                'date_of_birth': record[1].get('stringValue'),
                'profile_picture_url': record[2].get('stringValue'),
                'preferences': record[3].get('stringValue', '{}'),
                'created_at': record[4].get('stringValue'),
                'updated_at': record[5].get('stringValue')
            }
        return None
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return None

def create_user_profile(user_id: str, date_of_birth: str = None, profile_picture_url: str = None):
    """Create user profile in main database"""
    try:
        if date_of_birth:
            sql = """
                INSERT INTO user_profiles (user_id, date_of_birth) 
                VALUES (:user_id, :date_of_birth) 
                ON CONFLICT (user_id) DO NOTHING
            """
            parameters = {'user_id': user_id, 'date_of_birth': date_of_birth}
        else:
            sql = """
                INSERT INTO user_profiles (user_id) 
                VALUES (:user_id) 
                ON CONFLICT (user_id) DO NOTHING
            """
            parameters = {'user_id': user_id}
            
        execute_sql(sql, parameters)
        return True
    except Exception as e:
        logger.error(f"Error creating user profile: {str(e)}")
        return False

def update_user_profile(user_id: str, date_of_birth: str = None, profile_picture_url: str = None):
    """Update user profile in main database"""
    try:
        logger.info(f"Starting update_user_profile for {user_id} with date_of_birth: {date_of_birth}, profile_picture_url: {profile_picture_url}")
        
        if date_of_birth and profile_picture_url:
            sql = """
                INSERT INTO user_profiles (user_id, date_of_birth, profile_picture_url) 
                VALUES (:user_id, :date_of_birth, :profile_picture_url) 
                ON CONFLICT (user_id) DO UPDATE SET 
                    date_of_birth = EXCLUDED.date_of_birth, 
                    profile_picture_url = EXCLUDED.profile_picture_url, 
                    updated_at = NOW()
            """
            parameters = {
                'user_id': user_id,
                'date_of_birth': date_of_birth,
                'profile_picture_url': profile_picture_url
            }
        elif date_of_birth:
            sql = """
                INSERT INTO user_profiles (user_id, date_of_birth) 
                VALUES (:user_id, :date_of_birth) 
                ON CONFLICT (user_id) DO UPDATE SET 
                    date_of_birth = EXCLUDED.date_of_birth, 
                    updated_at = NOW()
            """
            parameters = {'user_id': user_id, 'date_of_birth': date_of_birth}
        elif profile_picture_url:
            sql = """
                INSERT INTO user_profiles (user_id, profile_picture_url) 
                VALUES (:user_id, :profile_picture_url) 
                ON CONFLICT (user_id) DO UPDATE SET 
                    profile_picture_url = EXCLUDED.profile_picture_url, 
                    updated_at = NOW()
            """
            parameters = {'user_id': user_id, 'profile_picture_url': profile_picture_url}
        else:
            return True  # Nothing to update
            
        logger.info(f"Executing SQL: {sql}")
        response = execute_sql(sql, parameters)
        logger.info(f"SQL response: {response}")
        return True
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return False