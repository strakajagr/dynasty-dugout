"""
Dynasty Dugout - Database Operations
Centralized database connection and query execution
FIXED: Robust boolean parameter handling for RDS Data API
"""
import logging
from fastapi import HTTPException
from .aws_clients import get_rds_client
from .config import DATABASE_CONFIG

logger = logging.getLogger(__name__)

def execute_sql(sql: str, parameters=None):
    """
    Execute SQL query using RDS Data API with improved error handling
    FIXED: Robust parameter type conversion, especially for booleans
    """
    rds_client = get_rds_client()
    
    if not rds_client:
        raise HTTPException(status_code=500, detail="Database client not initialized")
    
    try:
        logger.info(f"Executing SQL: {sql[:100]}...")
        
        params = {
            'resourceArn': DATABASE_CONFIG['resourceArn'],
            'secretArn': DATABASE_CONFIG['secretArn'],
            'database': DATABASE_CONFIG['database'],
            'sql': sql,
            'includeResultMetadata': True
        }
        
        # FIXED: Robust parameter conversion with explicit boolean handling
        if parameters:
            if isinstance(parameters, dict):
                # Convert from dict format: {'key': value} to RDS format
                rds_parameters = []
                for key, value in parameters.items():
                    param = {'name': key}
                    
                    # FIXED: Explicit type checking with better boolean handling
                    if value is None:
                        param['value'] = {'isNull': True}
                    elif isinstance(value, bool):
                        # CRITICAL: Handle booleans BEFORE int check (bool is subclass of int in Python)
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
                
                # Log parameters for debugging
                logger.info(f"Converted parameters: {rds_parameters}")
                params['parameters'] = rds_parameters
                
            elif isinstance(parameters, list):
                # Already in RDS format
                params['parameters'] = parameters
            
        response = rds_client.execute_statement(**params)
        logger.info(f"SQL executed successfully, returned {len(response.get('records', []))} records")
        return response
        
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        logger.error(f"SQL: {sql}")
        logger.error(f"Parameters: {parameters}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

def format_player_data(records, response):
    """Convert RDS Data API response to clean player objects"""
    if not records or not response:
        return []
    
    # Get column metadata
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

def test_database_connection():
    """Test database connection for health checks"""
    try:
        sql = "SELECT 1 as health_check"
        response = execute_sql(sql)
        return bool(response.get('records'))
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return False

# User Profile Database Functions - FIXED: Use parameterized queries

def get_user_profile(user_id: str):
    """Get user profile from database"""
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
                'user_id': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None,
                'date_of_birth': record[1].get('stringValue') if record[1] and not record[1].get('isNull') else None,
                'profile_picture_url': record[2].get('stringValue') if record[2] and not record[2].get('isNull') else None,
                'preferences': record[3].get('stringValue', '{}') if record[3] and not record[3].get('isNull') else '{}',
                'created_at': record[4].get('stringValue') if record[4] and not record[4].get('isNull') else None,
                'updated_at': record[5].get('stringValue') if record[5] and not record[5].get('isNull') else None
            }
        return None
        
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return None

def create_user_profile(user_id: str, date_of_birth: str = None, profile_picture_url: str = None):
    """Create user profile in database"""
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
    """Update user profile in database"""
    try:
        logger.info(f"Starting update_user_profile for {user_id} with date_of_birth: {date_of_birth}, profile_picture_url: {profile_picture_url}")
        
        # FIXED: Use parameterized queries
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