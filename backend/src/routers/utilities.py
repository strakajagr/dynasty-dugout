"""
Dynasty Dugout - Utilities Router
Debug endpoints and utility functions
"""

import logging
from fastapi import APIRouter
from core.database import execute_sql, format_player_data
from core.config import DATABASE_CONFIG

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/debug/database")
async def debug_database():
    """Debug database connection and data"""
    try:
        # Test basic connection
        sql = "SELECT current_database(), current_user, version()"
        response = execute_sql(sql)
        connection_info = format_player_data(response.get('records', []), response)
        
        # Test player table
        count_sql = "SELECT COUNT(*) as total_players FROM mlb_players"
        count_response = execute_sql(count_sql)
        
        player_count = 0
        if count_response.get('records'):
            player_count = count_response['records'][0][0].get('longValue', 0)
        
        # Test table structure
        structure_sql = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'mlb_players'
        ORDER BY ordinal_position
        """
        structure_response = execute_sql(structure_sql)
        table_structure = format_player_data(structure_response.get('records', []), structure_response)
        
        return {
            "success": True,
            "connection_info": connection_info,
            "player_count": player_count,
            "table_structure": table_structure,
            "database_config": {
                "resource_arn": DATABASE_CONFIG['resourceArn'],
                "database": DATABASE_CONFIG['database']
            }
        }
        
    except Exception as e:
        logger.error(f"Database debug error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Database connection failed"
        }

@router.get("/debug/sample-players")
async def debug_sample_players():
    """Get a small sample of players for debugging"""
    try:
        sql = """
        SELECT player_id, first_name, last_name, position, mlb_team, is_active
        FROM mlb_players 
        LIMIT 10
        """
        
        response = execute_sql(sql)
        players = format_player_data(response.get('records', []), response)
        
        return {
            "success": True,
            "sample_players": players,
            "count": len(players)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }