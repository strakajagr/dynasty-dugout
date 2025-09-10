"""
Dynasty Dugout - League Lifecycle Management Module - SHARED DATABASE VERSION
Creates new leagues using an asynchronous pattern to avoid API Gateway timeouts.
Now includes public/private league support with invite codes
FIXED: Pydantic model now includes ALL roster configuration fields
"""

import logging
import json
import os
import boto3
import random
import string
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from core.auth_utils import get_current_user
from core.database import execute_sql
from core.season_utils import get_current_season, CURRENT_SEASON

logger = logging.getLogger(__name__)
router = APIRouter()

# AWS Lambda Client
lambda_client = boto3.client('lambda')
LEAGUE_WORKER_LAMBDA_NAME = os.environ.get('LEAGUE_WORKER_LAMBDA_NAME', 'league-creation-worker')

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_invite_code(length=8):
    """Generate a unique invite code for private leagues"""
    # Use uppercase letters and numbers, avoiding confusing characters (0, O, I, 1)
    characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        code = ''.join(random.choices(characters, k=length))
        
        # Check if code already exists
        check_result = execute_sql(
            "SELECT league_id FROM user_leagues WHERE invite_code = :code",
            {'code': code},
            database_name='postgres'
        )
        
        if not check_result.get('records'):
            return code
        
        logger.info(f"Invite code collision detected: {code}, generating new one")

# =============================================================================
# PYDANTIC MODELS - FIXED WITH ALL ROSTER CONFIGURATION FIELDS + PRIVACY
# =============================================================================

class LeagueCreateRequest(BaseModel):
    # Basic Info
    league_name: str = Field(..., min_length=3, max_length=255)
    max_teams: int = Field(default=12, ge=4, le=20)
    player_pool: str = Field(default='american_national')
    include_minor_leagues: bool = Field(default=False)
    
    # Privacy Settings - NEW
    is_public: bool = Field(default=True, description="Whether league appears in public listings")
    
    # Scoring Configuration
    scoring_system: str = Field(default='rotisserie_ytd')
    scoring_categories: dict = Field(default_factory=lambda: {
        'hitters': ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
        'pitchers': ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
    })
    
    # ROSTER CONFIGURATION - CRITICAL FOR MYROSTER (ALL FIELDS INCLUDED)
    max_players_total: int = Field(default=23, ge=15, le=40)
    min_hitters: int = Field(default=13, ge=8, le=20)
    max_pitchers: int = Field(default=10, ge=5, le=15)
    min_pitchers: int = Field(default=10, ge=5, le=15)
    position_requirements: dict = Field(default_factory=lambda: {
        'C': {'slots': 2},
        '1B': {'slots': 1},
        '2B': {'slots': 1},
        '3B': {'slots': 1},
        'SS': {'slots': 1},
        'OF': {'slots': 4},
        'MI': {'slots': 1},
        'CI': {'slots': 1},
        'UTIL': {'slots': 1},
        'P': {'slots': 10}
    })
    # CRITICAL FIX: These fields were missing from Pydantic model
    bench_slots: int = Field(default=5, ge=0, le=15)
    dl_slots: int = Field(default=0, ge=0, le=5)
    minor_league_slots: int = Field(default=0, ge=0, le=15)
    
    # Financial Configuration
    use_salaries: bool = Field(default=True)
    use_contracts: bool = Field(default=True)
    use_dual_cap: bool = Field(default=True)
    draft_cap: float = Field(default=600.0, ge=100.0, le=2000.0)
    season_cap: float = Field(default=200.0, ge=50.0, le=1000.0)
    salary_cap: float = Field(default=800.0, ge=200.0, le=2000.0)
    min_salary: float = Field(default=2.0, ge=1.0, le=10.0)
    salary_increment: float = Field(default=2.0, ge=1.0, le=5.0)
    rookie_price: float = Field(default=20.0, ge=5.0, le=50.0)
    standard_contract_length: int = Field(default=2, ge=1, le=6)
    draft_cap_usage: float = Field(default=0.75, ge=0.5, le=1.0)
    
    # Advanced Configuration
    transaction_deadline: str = Field(default='monday')
    use_waivers: bool = Field(default=False)
    season_start_date: str = Field(default='2025-03-28')
    season_end_date: str = Field(default='2025-09-28')

# =============================================================================
# ASYNCHRONOUS API ENDPOINTS
# =============================================================================

@router.post("/create", status_code=202)
async def create_league_async(league_data: LeagueCreateRequest, current_user: dict = Depends(get_current_user)):
    """
    Initiates league creation. Creates an immediate record and triggers a background worker.
    Returns a 202 Accepted response with a URL to poll for status.
    Now includes public/private support with invite codes for private leagues.
    """
    logger.info("🚀 CREATE LEAGUE ENDPOINT HIT")
    logger.info(f"League data received: {league_data.league_name}")
    logger.info(f"Privacy setting: {'PUBLIC' if league_data.is_public else 'PRIVATE'}")
    logger.info(f"Roster config: {league_data.position_requirements}")
    logger.info(f"Bench slots: {league_data.bench_slots}")
    logger.info(f"DL slots: {league_data.dl_slots}")
    logger.info(f"Minor slots: {league_data.minor_league_slots}")
    logger.info(f"Current user: {current_user.get('sub')}")
    
    user_id = current_user.get('sub')
    league_id = str(uuid4())
    
    # Generate invite code for private leagues
    invite_code = None if league_data.is_public else generate_invite_code()

    logger.info(f"[{league_id[:8]}] Initiating async league creation for '{league_data.league_name}'")
    if invite_code:
        logger.info(f"[{league_id[:8]}] Private league - Invite code: {invite_code}")
    logger.info(f"[{league_id[:8]}] Worker Lambda Name: {LEAGUE_WORKER_LAMBDA_NAME}")

    # 1. Create the "phone book" entry with 'pending' status and privacy settings
    try:
        execute_sql(
            """INSERT INTO user_leagues (
                league_id, league_name, commissioner_user_id, 
                creation_status, status, is_public, invite_code
               )
               VALUES (
                :league_id::uuid, :league_name, :user_id, 
                'pending', 'creating', :is_public, :invite_code
               )""",
            {
                'league_id': league_id, 
                'league_name': league_data.league_name, 
                'user_id': user_id,
                'is_public': league_data.is_public,
                'invite_code': invite_code
            },
            database_name='postgres'
        )
        # Explicitly set is_active to true for the new membership record
        execute_sql(
            """INSERT INTO league_memberships (league_id, user_id, role, is_active)
               VALUES (:league_id::uuid, :user_id, 'commissioner', true)""",
            {'league_id': league_id, 'user_id': user_id}, 
            database_name='postgres'
        )
        logger.info(f"[{league_id[:8]}] ✅ Phone book entry created with privacy settings")
        
    except Exception as e:
        logger.error(f"[{league_id[:8]}] Failed to create initial league record: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate league creation")

    # 2. Trigger the background worker Lambda with COMPLETE roster configuration
    payload = {
        'league_id': league_id,
        'user_id': user_id,
        'league_data': league_data.model_dump(),  # Now includes is_public
        'current_season': CURRENT_SEASON,
        'invite_code': invite_code  # Pass to worker for settings table
    }
    
    # Log the complete payload being sent to worker for debugging
    logger.info(f"[{league_id[:8]}] Worker payload includes:")
    logger.info(f"  - is_public: {payload['league_data'].get('is_public', True)}")
    logger.info(f"  - invite_code: {payload.get('invite_code', 'N/A')}")
    logger.info(f"  - position_requirements: {payload['league_data'].get('position_requirements', 'MISSING')}")
    logger.info(f"  - bench_slots: {payload['league_data'].get('bench_slots', 'MISSING')}")
    logger.info(f"  - dl_slots: {payload['league_data'].get('dl_slots', 'MISSING')}")
    logger.info(f"  - minor_league_slots: {payload['league_data'].get('minor_league_slots', 'MISSING')}")

    try:
        logger.info(f"[{league_id[:8]}] Invoking worker Lambda: {LEAGUE_WORKER_LAMBDA_NAME}")
        response = lambda_client.invoke(
            FunctionName=LEAGUE_WORKER_LAMBDA_NAME,
            InvocationType='Event',  # Asynchronous invocation
            Payload=json.dumps(payload)
        )
        logger.info(f"[{league_id[:8]}] ✅ Worker Lambda invoked with status: {response.get('StatusCode')}")
        
    except Exception as e:
        logger.error(f"[{league_id[:8]}] Failed to invoke worker Lambda: {e}")
        # Clean up phone book entry
        try:
            execute_sql("DELETE FROM user_leagues WHERE league_id = :league_id::uuid", 
                        {'league_id': league_id}, 'postgres')
            execute_sql("DELETE FROM league_memberships WHERE league_id = :league_id::uuid", 
                        {'league_id': league_id}, 'postgres')
        except:
            pass
        raise HTTPException(status_code=500, detail="Failed to start league creation")

    status_url = f"/api/leagues/{league_id}/creation-status"
    
    response_data = {
        "success": True,
        "league_id": league_id,
        "status": "pending",
        "message": "League creation has started. Poll the status URL for updates.",
        "status_url": status_url,
        "is_public": league_data.is_public,
        "roster_config_included": {
            "position_requirements": bool(league_data.position_requirements),
            "bench_slots": league_data.bench_slots,
            "dl_slots": league_data.dl_slots,
            "minor_league_slots": league_data.minor_league_slots
        }
    }
    
    # Include invite code in response for private leagues
    if invite_code:
        response_data["invite_code"] = invite_code
        response_data["message"] += f" Share invite code '{invite_code}' with players to join."
    
    return JSONResponse(
        status_code=202,
        content=response_data
    )

@router.get("/{league_id}/creation-status")
async def get_league_creation_status(league_id: str, current_user: dict = Depends(get_current_user)):
    """Check status of league creation job."""
    logger.info(f"[{league_id[:8]}] Status check requested")
    user_id = current_user.get('sub')
    
    # Verify user is member
    membership = execute_sql(
        "SELECT user_id FROM league_memberships WHERE league_id = :league_id::uuid AND user_id = :user_id",
        {'league_id': league_id, 'user_id': user_id}, 'postgres'
    )
    
    if not membership.get('records'):
        raise HTTPException(status_code=404, detail="League not found")

    # Get status from the now-guaranteed-to-exist columns
    result = execute_sql(
        """SELECT creation_status, creation_error_message, is_public, invite_code 
           FROM user_leagues WHERE league_id = :league_id::uuid""",
        {'league_id': league_id}, 'postgres'
    )
    
    if not result.get('records'):
        raise HTTPException(status_code=404, detail="League status record not found")

    record = result['records'][0]
    status = record[0].get('stringValue', 'unknown')
    error_message = record[1].get('stringValue') if len(record) > 1 and not record[1].get('isNull') else None
    is_public = record[2].get('booleanValue', True) if len(record) > 2 else True
    invite_code = record[3].get('stringValue') if len(record) > 3 and not record[3].get('isNull') else None
    
    logger.info(f"[{league_id[:8]}] Status: {status}, Public: {is_public}")
    
    response = {
        "league_id": league_id,
        "status": status,
        "error_message": error_message,
        "is_public": is_public
    }
    
    if invite_code and not is_public:
        response["invite_code"] = invite_code
    
    return response

# =============================================================================
# PUBLIC/PRIVATE LEAGUE ENDPOINTS
# =============================================================================

@router.get("/public")
async def get_public_leagues():
    """Get all public leagues that are accepting new teams"""
    try:
        logger.info("📢 Fetching public leagues")
        
        # Get public leagues from phone book with team counts
        sql = """
            SELECT 
                ul.league_id,
                ul.league_name,
                ul.commissioner_user_id,
                ul.created_at,
                ul.invite_code,
                COUNT(DISTINCT lm.user_id) as current_teams
            FROM user_leagues ul
            LEFT JOIN league_memberships lm ON ul.league_id = lm.league_id AND lm.is_active = true
            WHERE ul.is_public = true 
              AND ul.creation_status = 'completed'
              AND ul.status != 'archived'
            GROUP BY ul.league_id, ul.league_name, ul.commissioner_user_id, ul.created_at, ul.invite_code
            ORDER BY ul.created_at DESC
        """
        
        response = execute_sql(sql, database_name='postgres')
        
        leagues = []
        if response.get('records'):
            for record in response['records']:
                league_id = record[0].get('stringValue')
                
                # Get detailed settings from leagues database
                settings_sql = """
                    SELECT setting_name, setting_value, setting_type
                    FROM league_settings 
                    WHERE league_id = :league_id::uuid
                      AND setting_name IN ('max_teams', 'scoring_system', 'salary_cap', 'commissioner_name')
                """
                settings_response = execute_sql(
                    settings_sql, 
                    {'league_id': league_id}, 
                    database_name='leagues'
                )
                
                # Parse settings
                max_teams = 12
                scoring_system = 'rotisserie_ytd'
                salary_cap = 800
                commissioner_name = 'Commissioner'
                
                if settings_response.get('records'):
                    for setting_record in settings_response['records']:
                        setting_name = setting_record[0].get('stringValue')
                        setting_value = setting_record[1].get('stringValue')
                        
                        if setting_name == 'max_teams':
                            max_teams = int(setting_value)
                        elif setting_name == 'scoring_system':
                            scoring_system = setting_value
                        elif setting_name == 'salary_cap':
                            salary_cap = float(setting_value)
                        elif setting_name == 'commissioner_name':
                            commissioner_name = setting_value
                
                current_teams = record[5].get('longValue', 0)
                
                # Only include leagues with open spots
                if current_teams < max_teams:
                    leagues.append({
                        'league_id': league_id,
                        'league_name': record[1].get('stringValue'),
                        'commissioner_user_id': record[2].get('stringValue'),
                        'commissioner_name': commissioner_name,
                        'created_at': record[3].get('stringValue'),
                        'current_teams': current_teams,
                        'max_teams': max_teams,
                        'scoring_system': scoring_system,
                        'salary_cap': salary_cap,
                        'spots_available': max_teams - current_teams
                    })
        
        logger.info(f"✅ Found {len(leagues)} public leagues with open spots")
        
        return {
            "success": True,
            "leagues": leagues,
            "count": len(leagues)
        }
        
    except Exception as e:
        logger.error(f"Error fetching public leagues: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch public leagues")

@router.post("/join-with-code")
async def join_league_with_code(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Join a private league using an invite code"""
    try:
        invite_code = request.get('invite_code', '').upper()
        user_id = current_user.get('sub')
        
        if not invite_code:
            raise HTTPException(status_code=400, detail="Invite code is required")
        
        logger.info(f"User {user_id} attempting to join with code: {invite_code}")
        
        # Find league by invite code
        result = execute_sql(
            """SELECT league_id, league_name 
               FROM user_leagues 
               WHERE invite_code = :code AND creation_status = 'completed'""",
            {'code': invite_code},
            database_name='postgres'
        )
        
        if not result.get('records'):
            raise HTTPException(status_code=404, detail="Invalid invite code")
        
        league_id = result['records'][0][0].get('stringValue')
        league_name = result['records'][0][1].get('stringValue')
        
        # Check if user is already a member
        membership_check = execute_sql(
            """SELECT user_id FROM league_memberships 
               WHERE league_id = :league_id::uuid AND user_id = :user_id""",
            {'league_id': league_id, 'user_id': user_id},
            database_name='postgres'
        )
        
        if membership_check.get('records'):
            return {
                "success": True,
                "league_id": league_id,
                "league_name": league_name,
                "message": "You are already a member of this league"
            }
        
        # TODO: Add logic to create team and add member
        # For now, just return the league info for the join flow
        
        return {
            "success": True,
            "league_id": league_id,
            "league_name": league_name,
            "message": "League found! Redirecting to team setup..."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining league with code: {e}")
        raise HTTPException(status_code=500, detail="Failed to join league")

# =============================================================================
# DESTRUCTIVE OPERATIONS (Retained for admin/cleanup purposes)
# =============================================================================

@router.delete("/{league_id}")
async def delete_league(league_id: str, current_user: dict = Depends(get_current_user)):
    """
    Deletes a league and all its associated data from the shared database.
    No longer drops databases since we use shared 'leagues' database.
    """
    user_id = current_user.get('sub')
    logger.info(f"[{league_id[:8]}] Received request to delete league")
    
    try:
        # Verify user is commissioner
        membership_result = execute_sql(
            "SELECT role FROM league_memberships WHERE league_id = :league_id::uuid AND user_id = :user_id",
            {'league_id': league_id, 'user_id': user_id}, 
            database_name='postgres'
        )
        if not membership_result.get('records') or membership_result['records'][0][0].get('stringValue') != 'commissioner':
            raise HTTPException(status_code=403, detail="Only the commissioner can delete this league.")

        # Delete all league data from shared 'leagues' database
        logger.info(f"[{league_id[:8]}] Deleting league data from shared database...")
        
        # Delete in order to respect foreign key constraints
        tables_to_clean = [
            'price_change_history',
            'league_invitations',
            'league_messages',
            'league_standings',
            'player_active_accrued_stats',
            'roster_status_history',
            'player_team_accumulated_stats',
            'player_daily_team_stats',
            'player_rolling_stats',
            'player_season_stats',
            'league_transactions',
            'league_players',
            'league_teams',
            'league_settings'
        ]
        
        total_rows_deleted = 0
        for table in tables_to_clean:
            try:
                result = execute_sql(
                    f"DELETE FROM {table} WHERE league_id = :league_id::uuid",
                    {'league_id': league_id}, 
                    database_name='leagues'
                )
                rows_deleted = result.get('numberOfRecordsUpdated', 0)
                total_rows_deleted += rows_deleted
                logger.info(f"[{league_id[:8]}] Cleaned {rows_deleted} rows from {table}")
            except Exception as e:
                logger.warning(f"[{league_id[:8]}] Could not clean table {table}: {e}")
        
        # Delete phone book entries
        logger.info(f"[{league_id[:8]}] Deleting phone book entries...")
        execute_sql("DELETE FROM league_memberships WHERE league_id = :league_id::uuid", 
                   {'league_id': league_id}, database_name='postgres')
        execute_sql("DELETE FROM user_leagues WHERE league_id = :league_id::uuid", 
                   {'league_id': league_id}, database_name='postgres')
        
        logger.info(f"[{league_id[:8]}] ✅ League deleted successfully. Removed {total_rows_deleted} total rows from shared database")
        return {
            "success": True, 
            "message": "League deleted successfully.",
            "rows_deleted": total_rows_deleted
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete league {league_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

# =============================================================================
# EMERGENCY CLEANUP (Admin only)
# =============================================================================

@router.post("/admin/cleanup-orphaned-data")
async def cleanup_orphaned_league_data(current_user: dict = Depends(get_current_user)):
    """
    Admin endpoint to clean up orphaned league data in shared database
    This finds league data that exists in 'leagues' database but has no phone book entry
    """
    # TODO: Add admin check here
    logger.warning("Starting orphaned league data cleanup in shared database")
    
    try:
        # Find all league_ids in shared database
        league_ids_query = "SELECT DISTINCT league_id FROM league_settings"
        league_ids_result = execute_sql(league_ids_query, database_name='leagues')
        
        if not league_ids_result.get('records'):
            return {"message": "No leagues found in shared database", "cleaned": 0}
        
        league_ids_in_db = [rec[0].get('stringValue') for rec in league_ids_result['records']]
        
        # Find which ones exist in phone book
        phonebook_query = "SELECT league_id FROM user_leagues"
        phonebook_result = execute_sql(phonebook_query, database_name='postgres')
        
        valid_league_ids = set()
        if phonebook_result.get('records'):
            valid_league_ids = {rec[0].get('stringValue') for rec in phonebook_result['records']}
        
        # Find orphaned leagues
        orphaned_leagues = [lid for lid in league_ids_in_db if lid not in valid_league_ids]
        
        if not orphaned_leagues:
            return {"message": "No orphaned leagues found", "cleaned": 0}
        
        # Clean up orphaned data
        tables_to_clean = [
            'price_change_history',
            'league_invitations',
            'league_messages',
            'league_standings',
            'player_active_accrued_stats',
            'roster_status_history',
            'player_team_accumulated_stats',
            'player_daily_team_stats',
            'player_rolling_stats',
            'player_season_stats',
            'league_transactions',
            'league_players',
            'league_teams',
            'league_settings'
        ]
        
        total_cleaned = 0
        for league_id in orphaned_leagues:
            for table in tables_to_clean:
                try:
                    result = execute_sql(
                        f"DELETE FROM {table} WHERE league_id = :league_id::uuid",
                        {'league_id': league_id},
                        database_name='leagues'
                    )
                    total_cleaned += result.get('numberOfRecordsUpdated', 0)
                except Exception as e:
                    logger.warning(f"Could not clean {table} for orphaned league {league_id}: {e}")
        
        logger.info(f"Cleaned {total_cleaned} orphaned rows from {len(orphaned_leagues)} leagues")
        return {
            "success": True,
            "orphaned_leagues": orphaned_leagues,
            "rows_cleaned": total_cleaned
        }
        
    except Exception as e:
        logger.error(f"Error during orphaned data cleanup: {e}")
        raise HTTPException(status_code=500, detail=str(e))