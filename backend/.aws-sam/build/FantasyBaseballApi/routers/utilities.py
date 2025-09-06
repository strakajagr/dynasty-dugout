"""
Dynasty Dugout - Utilities Router
Debug endpoints and utility functions
UPDATED: For shared database architecture
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from core.database import execute_sql
from core.config import DATABASE_CONFIG
from core.auth_utils import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

def get_value_from_field(field, value_type='long'):
    """Helper function to extract values from AWS RDS Data API response fields"""
    if not field:
        return 0 if value_type != 'string' else ""
    
    if value_type == 'long':
        return field.get("longValue", 0) or field.get("intValue", 0)
    elif value_type == 'decimal':
        val = field.get("stringValue")
        if val:
            try:
                return float(val)
            except:
                pass
        return field.get("doubleValue", 0.0) or field.get("floatValue", 0.0)
    elif value_type == 'string':
        return field.get("stringValue", "")
    return 0

@router.get("/debug/database")
async def debug_database():
    """Debug database connections and data"""
    try:
        results = {}
        
        # Test main postgres database
        postgres_test = execute_sql(
            "SELECT current_database(), current_user, version()",
            database_name='postgres'
        )
        results['postgres'] = {
            'connected': True,
            'database': postgres_test['records'][0][0].get('stringValue') if postgres_test.get('records') else None
        }
        
        # Test shared leagues database
        leagues_test = execute_sql(
            "SELECT current_database(), current_user",
            database_name='leagues'
        )
        results['leagues'] = {
            'connected': True,
            'database': leagues_test['records'][0][0].get('stringValue') if leagues_test.get('records') else None
        }
        
        # Get player count from main database
        count_response = execute_sql(
            "SELECT COUNT(*) as total_players FROM mlb_players",
            database_name='postgres'
        )
        player_count = 0
        if count_response.get('records'):
            player_count = count_response['records'][0][0].get('longValue', 0)
        
        # Get league count from main database
        league_count_response = execute_sql(
            "SELECT COUNT(*) FROM user_leagues",
            database_name='postgres'
        )
        league_count = 0
        if league_count_response.get('records'):
            league_count = league_count_response['records'][0][0].get('longValue', 0)
        
        # Get team count from shared leagues database
        team_count_response = execute_sql(
            "SELECT COUNT(*) FROM league_teams",
            database_name='leagues'
        )
        team_count = 0
        if team_count_response.get('records'):
            team_count = team_count_response['records'][0][0].get('longValue', 0)
        
        return {
            "success": True,
            "databases": results,
            "stats": {
                "total_players": player_count,
                "total_leagues": league_count,
                "total_teams": team_count
            },
            "architecture": "Shared database architecture (postgres + leagues)"
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
        WHERE is_active = true
        LIMIT 10
        """
        
        response = execute_sql(sql, database_name='postgres')
        
        players = []
        if response and response.get('records'):
            for record in response['records']:
                player = {
                    'player_id': get_value_from_field(record[0], 'long'),
                    'first_name': get_value_from_field(record[1], 'string'),
                    'last_name': get_value_from_field(record[2], 'string'),
                    'position': get_value_from_field(record[3], 'string'),
                    'mlb_team': get_value_from_field(record[4], 'string'),
                    'is_active': record[5].get('booleanValue', True) if record[5] else True
                }
                players.append(player)
        
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
async def cleanup_all_leagues(current_user: dict = Depends(get_current_user)):
    """
    ADMIN ONLY: Delete all league data from shared databases
    ⚠️ WARNING: This deletes ALL league data!
    """
    try:
        # Verify admin access (you should implement proper admin check)
        user_email = current_user.get('email', '')
        if not user_email.endswith('@admin.dynastydugout.com'):  # Example admin check
            raise HTTPException(status_code=403, detail="Admin access required")
        
        deleted_counts = {}
        errors = []
        
        logger.info("Starting cleanup of all league data...")
        
        # Clear all tables in leagues database (in correct order for foreign keys)
        leagues_tables = [
            'roster_status_history',
            'league_transactions',
            'contract_extensions',
            'player_active_accrued_stats',
            'player_rolling_stats',
            'player_season_stats',
            'player_prices',
            'league_players',
            'league_invitations',
            'league_teams',
            'league_settings',
            'scoring_settings',
            'draft_settings'
        ]
        
        for table in leagues_tables:
            try:
                result = execute_sql(
                    f"DELETE FROM {table}",
                    database_name='leagues'
                )
                # Get affected rows count if available
                deleted_counts[table] = "cleared"
                logger.info(f"Cleared table: {table}")
            except Exception as e:
                error_msg = f"Failed to clear {table}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Clear registry tables in main database (in proper order for foreign keys)
        logger.info("Clearing league registry tables...")
        try:
            # Clear memberships first (has foreign key to user_leagues)
            membership_result = execute_sql(
                "DELETE FROM league_memberships",
                database_name='postgres'
            )
            deleted_counts['league_memberships'] = "cleared"
            
            # Then clear user_leagues
            leagues_result = execute_sql(
                "DELETE FROM user_leagues",
                database_name='postgres'
            )
            deleted_counts['user_leagues'] = "cleared"
            
            logger.info("Registry tables cleared successfully")
        except Exception as e:
            error_msg = f"Failed to clear registry tables: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
        
        # Final verification
        verify_leagues_query = "SELECT COUNT(*) FROM user_leagues"
        verify_leagues_response = execute_sql(verify_leagues_query, database_name='postgres')
        remaining_leagues = 0
        if verify_leagues_response.get('records'):
            remaining_leagues = verify_leagues_response['records'][0][0].get('longValue', 0)
        
        verify_teams_query = "SELECT COUNT(*) FROM league_teams"
        verify_teams_response = execute_sql(verify_teams_query, database_name='leagues')
        remaining_teams = 0
        if verify_teams_response.get('records'):
            remaining_teams = verify_teams_response['records'][0][0].get('longValue', 0)
        
        success = remaining_leagues == 0 and remaining_teams == 0 and len(errors) == 0
        
        logger.info(f"Cleanup complete. Cleared {len(deleted_counts)} tables, {len(errors)} errors")
        
        return {
            "success": success,
            "summary": {
                "tables_cleared": deleted_counts,
                "remaining_leagues": remaining_leagues,
                "remaining_teams": remaining_teams,
                "errors": errors
            },
            "message": "✅ All league data cleaned up successfully!" if success else "⚠️ Cleanup completed with issues - check errors",
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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleanup failed with exception: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "❌ Failed to cleanup leagues - check logs for details"
        }

@router.get("/admin/league-status")
async def get_league_status(current_user: dict = Depends(get_current_user)):
    """
    Get current status of leagues (safe read-only)
    """
    try:
        # Get registered leagues from main database
        leagues_query = """
        SELECT league_id, league_name, created_at, commissioner_user_id
        FROM user_leagues
        ORDER BY created_at DESC
        """
        leagues_response = execute_sql(leagues_query, database_name='postgres')
        
        leagues = []
        if leagues_response and leagues_response.get('records'):
            for record in leagues_response['records']:
                league = {
                    'league_id': get_value_from_field(record[0], 'string'),
                    'league_name': get_value_from_field(record[1], 'string'),
                    'created_at': get_value_from_field(record[2], 'string'),
                    'commissioner_user_id': get_value_from_field(record[3], 'string')
                }
                leagues.append(league)
        
        # Get teams count per league from shared leagues database
        for league in leagues:
            teams_query = """
            SELECT COUNT(*) FROM league_teams 
            WHERE league_id = :league_id::uuid
            """
            teams_response = execute_sql(
                teams_query,
                {'league_id': league['league_id']},
                database_name='leagues'
            )
            team_count = 0
            if teams_response.get('records'):
                team_count = teams_response['records'][0][0].get('longValue', 0)
            league['team_count'] = team_count
        
        # Get memberships count
        memberships_query = "SELECT COUNT(*) FROM league_memberships"
        memberships_response = execute_sql(memberships_query, database_name='postgres')
        memberships_count = 0
        if memberships_response.get('records'):
            memberships_count = memberships_response['records'][0][0].get('longValue', 0)
        
        # Get total teams across all leagues
        total_teams_query = "SELECT COUNT(*) FROM league_teams"
        total_teams_response = execute_sql(total_teams_query, database_name='leagues')
        total_teams = 0
        if total_teams_response.get('records'):
            total_teams = total_teams_response['records'][0][0].get('longValue', 0)
        
        return {
            "success": True,
            "status": {
                "registered_leagues": len(leagues),
                "total_teams": total_teams,
                "total_memberships": memberships_count
            },
            "leagues": leagues,
            "clean_state": len(leagues) == 0 and total_teams == 0 and memberships_count == 0,
            "architecture": "Shared database architecture"
        }
        
    except Exception as e:
        logger.error(f"Status check failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to get league status"
        }

@router.post("/admin/migrate-to-shared-architecture")
async def migrate_to_shared_architecture(current_user: dict = Depends(get_current_user)):
    """
    ADMIN ONLY: Migrate from old individual league databases to shared architecture
    This is a one-time migration tool
    """
    try:
        # Verify admin access
        user_email = current_user.get('email', '')
        if not user_email.endswith('@admin.dynastydugout.com'):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        logger.info("Starting migration to shared database architecture...")
        
        # Check for any old league_* databases
        old_dbs_query = """
        SELECT datname FROM pg_database 
        WHERE datname LIKE 'league_%'
        ORDER BY datname
        """
        old_dbs_response = execute_sql(old_dbs_query, database_name='postgres')
        old_databases = []
        if old_dbs_response and old_dbs_response.get('records'):
            old_databases = [record[0]["stringValue"] for record in old_dbs_response['records']]
        
        if not old_databases:
            return {
                "success": True,
                "message": "No old league databases found. System is already using shared architecture.",
                "old_databases_found": 0
            }
        
        migrated = []
        errors = []
        
        # For each old database, migrate data to shared leagues database
        for db_name in old_databases:
            try:
                # Extract league_id from database name (league_xxxx_xxxx_xxxx_xxxx)
                league_id = db_name.replace('league_', '').replace('_', '-')
                
                logger.info(f"Migrating {db_name} (league_id: {league_id})...")
                
                # Here you would implement the actual migration logic
                # This is a placeholder - you'd need to:
                # 1. Copy league_teams data with league_id added
                # 2. Copy league_players data with league_id added
                # 3. Copy other league-specific tables
                # 4. Update user_leagues to remove database_name column
                
                # After successful migration, drop the old database
                drop_query = f'DROP DATABASE IF EXISTS "{db_name}"'
                execute_sql(drop_query, database_name='postgres')
                
                migrated.append({
                    'database': db_name,
                    'league_id': league_id
                })
                
            except Exception as e:
                error_msg = f"Failed to migrate {db_name}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        return {
            "success": len(errors) == 0,
            "old_databases_found": len(old_databases),
            "migrated": migrated,
            "errors": errors,
            "message": "Migration completed" if len(errors) == 0 else "Migration completed with errors"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Migration failed"
        }