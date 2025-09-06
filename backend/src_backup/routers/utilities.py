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

@router.post("/admin/cleanup-all-leagues")
async def cleanup_all_leagues():
    """
    ADMIN ONLY: Delete all leagues and their databases
    ⚠️ WARNING: This deletes ALL league data!
    """
    try:
        # Get list of registered leagues first
        leagues_query = """
        SELECT league_id, league_name, database_name 
        FROM user_leagues
        """
        leagues_response = execute_sql(leagues_query)
        leagues_records = leagues_response.get('records', [])
        
        league_count = len(leagues_records)
        deleted_databases = []
        errors = []
        
        logger.info(f"Found {league_count} registered leagues to clean up")
        
        # Drop each league database
        for record in leagues_records:
            try:
                database_name = record[2]["stringValue"]
                league_name = record[1]["stringValue"]
                
                if database_name.startswith("league_"):
                    logger.info(f"Dropping database: {database_name} (League: {league_name})")
                    drop_query = f'DROP DATABASE IF EXISTS "{database_name}"'
                    execute_sql(drop_query)
                    deleted_databases.append({
                        "database_name": database_name,
                        "league_name": league_name
                    })
                else:
                    logger.warning(f"Skipping non-league database: {database_name}")
                    
            except Exception as e:
                error_msg = f"Failed to drop {database_name}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Clear registry tables (in proper order for foreign keys)
        logger.info("Clearing league registry tables...")
        try:
            execute_sql("DELETE FROM league_memberships")
            execute_sql("DELETE FROM user_leagues")
            logger.info("Registry tables cleared successfully")
        except Exception as e:
            error_msg = f"Failed to clear registry tables: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
        
        # Check for orphaned league databases
        logger.info("Checking for orphaned league databases...")
        orphan_query = """
        SELECT datname FROM pg_database 
        WHERE datname LIKE 'league_%'
        """
        orphan_response = execute_sql(orphan_query)
        orphan_records = orphan_response.get('records', [])
        
        orphaned_databases = []
        for record in orphan_records:
            try:
                db_name = record[0]["stringValue"]
                logger.info(f"Dropping orphaned database: {db_name}")
                drop_query = f'DROP DATABASE IF EXISTS "{db_name}"'
                execute_sql(drop_query)
                orphaned_databases.append(db_name)
            except Exception as e:
                error_msg = f"Failed to drop orphaned {db_name}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Final verification
        verify_query = """
        SELECT datname FROM pg_database 
        WHERE datname LIKE 'league_%'
        """
        verify_response = execute_sql(verify_query)
        remaining_databases = [record[0]["stringValue"] for record in verify_response.get('records', [])]
        
        verify_leagues_query = "SELECT COUNT(*) FROM user_leagues"
        verify_leagues_response = execute_sql(verify_leagues_query)
        remaining_leagues = 0
        if verify_leagues_response.get('records'):
            remaining_leagues = verify_leagues_response['records'][0][0].get('longValue', 0)
        
        total_dropped = len(deleted_databases) + len(orphaned_databases)
        success = len(remaining_databases) == 0 and remaining_leagues == 0
        
        logger.info(f"Cleanup complete. Dropped {total_dropped} databases, {len(errors)} errors")
        
        return {
            "success": success,
            "summary": {
                "registered_leagues_found": league_count,
                "registered_databases_deleted": deleted_databases,
                "orphaned_databases_deleted": orphaned_databases,
                "total_databases_dropped": total_dropped,
                "remaining_databases": remaining_databases,
                "remaining_leagues_in_registry": remaining_leagues,
                "errors": errors
            },
            "message": "✅ All leagues and databases cleaned up successfully!" if success else "⚠️ Cleanup completed with issues - check errors",
            "next_steps": [
                "Create a fresh test league",
                "Run transaction endpoint tests",
                "Verify all functionality works"
            ] if success else [
                "Check error messages above",
                "Manually verify database state",
                "Retry cleanup if needed"
            ]
        }
        
    except Exception as e:
        logger.error(f"Cleanup failed with exception: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "❌ Failed to cleanup leagues - check logs for details"
        }

@router.get("/admin/league-status")
async def get_league_status():
    """
    Get current status of leagues and databases (safe read-only)
    """
    try:
        # Get registered leagues
        leagues_query = """
        SELECT league_id, league_name, database_name, created_at
        FROM user_leagues
        ORDER BY created_at DESC
        """
        leagues_response = execute_sql(leagues_query)
        leagues = format_player_data(leagues_response.get('records', []), leagues_response)
        
        # Get all league databases
        databases_query = """
        SELECT datname FROM pg_database 
        WHERE datname LIKE 'league_%'
        ORDER BY datname
        """
        databases_response = execute_sql(databases_query)
        databases = [record[0]["stringValue"] for record in databases_response.get('records', [])]
        
        # Get memberships count
        memberships_query = "SELECT COUNT(*) FROM league_memberships"
        memberships_response = execute_sql(memberships_query)
        memberships_count = 0
        if memberships_response.get('records'):
            memberships_count = memberships_response['records'][0][0].get('longValue', 0)
        
        return {
            "success": True,
            "status": {
                "registered_leagues": len(leagues),
                "league_databases": len(databases),
                "total_memberships": memberships_count
            },
            "leagues": leagues,
            "databases": databases,
            "clean_state": len(leagues) == 0 and len(databases) == 0 and memberships_count == 0
        }
        
    except Exception as e:
        logger.error(f"Status check failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to get league status"
        }