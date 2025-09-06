import logging
import sys
import json
import jwt
import uuid
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from typing import Optional

# Core imports
from core.database import execute_sql
from core.auth_utils import get_current_user, verify_cognito_token

# Configure logging for this module
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)

# Router without prefix - prefix is added in fantasy_api.py
router = APIRouter(tags=["invitations"])

# Configuration from environment variables
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-super-secret-jwt-key-change-this-in-production')
JWT_ALGORITHM = "HS256"
INVITATION_EXPIRY_HOURS = int(os.getenv('INVITATION_EXPIRY_HOURS', '72'))  # 3 days
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'https://d20wx6xzxkf84y.cloudfront.net')

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def verify_invitation_token(token: str) -> dict:
    """
    Verify and decode invitation token
    Returns payload if valid, raises exception if invalid/expired
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        # Additional security check - ensure it's an invitation token
        if payload.get('invitation_type') != 'league_join':
            raise jwt.InvalidTokenError("Invalid token type")

        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Invitation token expired.", exc_info=True)
        raise HTTPException(status_code=400, detail="Invitation link has expired")
    except jwt.InvalidTokenError:
        logger.warning("Invalid invitation token.", exc_info=True)
        raise HTTPException(status_code=400, detail="Invalid invitation link")
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal token verification error.")

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class AcceptInvitationRequest(BaseModel):
    token: str

# =============================================================================
# PUBLIC INVITATION ENDPOINTS
# =============================================================================

@router.get("/verify")
async def verify_invitation_token_endpoint(token: str, request: Request):
    """
    Verify an invitation token and return invitation details
    Public endpoint - no authentication required
    """
    logger.info(f"--- invitations.py: /verify endpoint HIT. Token received: {token[:10]}... ---")
    try:
        # Decode and verify the JWT token
        payload = verify_invitation_token(token)
        logger.info(f"--- invitations.py: Token verified. Payload: {json.dumps(payload)} ---")

        league_id = payload['league_id']
        email = payload['email']

        # Convert hyphens to underscores for database name
        league_database = f"league_{league_id.replace('-', '_')}"
        logger.info(f"--- invitations.py: League database name: {league_database} ---")

        # STEP 1: Get invitation details from league database
        invitation_result = execute_sql(
            """SELECT invitation_id, league_id, email, owner_name, personal_message,
                      target_slot, invited_at, expires_at, status
               FROM league_invitations
               WHERE invitation_token = :token
               AND status = 'pending'""",
            parameters={'token': token},
            database_name=league_database
        )
        logger.info(f"--- invitations.py: Invitation DB query result (verify): {json.dumps(invitation_result)} ---")

        if not invitation_result.get("records") or len(invitation_result["records"]) == 0:
            logger.warning("--- invitations.py: Invitation not found or not pending. ---")
            raise HTTPException(status_code=404, detail="Invitation not found or has already been used")

        invitation_record = invitation_result["records"][0]
        logger.info(f"--- invitations.py: Invitation record found: {json.dumps(invitation_record)} ---")

        # Check if invitation has expired
        expires_at_str = invitation_record[7].get('stringValue')
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                if expires_at < datetime.now(timezone.utc):
                    logger.warning(f"--- invitations.py: Invitation {invitation_record[0].get('stringValue')} expired. ---")
                    # Mark as expired in database
                    execute_sql(
                        "UPDATE league_invitations SET status = 'expired' WHERE invitation_token = :token",
                        parameters={'token': token},
                        database_name=league_database
                    )
                    raise HTTPException(status_code=400, detail="This invitation has expired")
            except Exception as date_error:
                logger.warning(f"--- invitations.py: Could not parse expiration date for invitation {invitation_record[0].get('stringValue')}: {date_error}", exc_info=True)

        # STEP 2: Get league name from main postgres database (separate query)
        league_name_result = execute_sql(
            "SELECT league_name FROM user_leagues WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name='postgres'  # CORRECT - user_leagues is in main database
        )
        logger.info(f"--- invitations.py: League name DB query result (verify): {json.dumps(league_name_result)} ---")

        league_name = "Unknown League"
        if league_name_result.get("records") and len(league_name_result["records"]) > 0:
            league_name = league_name_result["records"][0][0]["stringValue"]

        # STEP 3: Check if user already has a team in this league
        existing_team = execute_sql(
            "SELECT team_id FROM league_teams WHERE league_id = :league_id::uuid AND manager_email = :email",
            parameters={'league_id': league_id, 'email': email},
            database_name=league_database
        )
        logger.info(f"--- invitations.py: Existing team check result (verify): {json.dumps(existing_team)} ---")

        if existing_team and existing_team.get("records") and len(existing_team["records"]) > 0:
            logger.warning(f"--- invitations.py: User {email} already has team in league {league_id}. ---")
            raise HTTPException(status_code=400, detail="You already have a team in this league")

        # STEP 4: Get commissioner name from league database directly
        commissioner_result = execute_sql(
            "SELECT manager_name FROM league_teams WHERE league_id = :league_id::uuid AND is_commissioner = true",
            parameters={'league_id': league_id},
            database_name=league_database  # FIXED - Query league database directly
        )
        logger.info(f"--- invitations.py: Commissioner name DB query result (verify): {json.dumps(commissioner_result)} ---")

        commissioner_name = "Commissioner"
        if commissioner_result.get("records") and len(commissioner_result["records"]) > 0:
            commissioner_name = commissioner_result["records"][0][0]["stringValue"]

        logger.info(f"--- invitations.py: Verification successful for token to league {league_id} ---")
        return {
            'success': True,
            'invitation': {
                'invitation_id': invitation_record[0].get('stringValue'),
                'league_id': invitation_record[1].get('stringValue'),
                'league_name': league_name,  # From separate query
                'email': invitation_record[2].get('stringValue'),
                'owner_name': invitation_record[3].get('stringValue'),
                'personal_message': invitation_record[4].get('stringValue') if not invitation_record[4].get('isNull') else '',
                'target_slot': invitation_record[5].get('longValue') if not invitation_record[5].get('isNull') else None,
                'commissioner_name': commissioner_name,
                'invited_at': invitation_record[6].get('stringValue'),
                'expires_at': invitation_record[7].get('stringValue')
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"--- invitations.py: Error verifying invitation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to verify invitation")

@router.post("/accept")
async def accept_invitation(
    request_data: AcceptInvitationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Accept an invitation and create a team for the user
    Requires authentication - FIXED: Consistent JWT usage and VARCHAR user ID handling
    """
    logger.info(f"--- invitations.py: /accept endpoint HIT. Request data: {request_data.model_dump()} ---")

    try:
        # ✅ FIXED: Get user data from JWT token consistently
        user_id = current_user.get('sub')  # This is the Cognito User ID (VARCHAR)
        user_email = current_user.get('email')
        user_first_name = current_user.get('given_name', 'User')
        user_last_name = current_user.get('family_name', '')

        if not user_id or not user_email:
            logger.warning("--- invitations.py: User not authenticated for accept_invitation. ---")
            raise HTTPException(status_code=401, detail="Invalid user authentication")
        logger.info(f"--- invitations.py: User authenticated: {user_email}, UserID: {user_id} ---")

        # Verify the invitation token
        payload = verify_invitation_token(request_data.token)
        logger.info(f"--- invitations.py: Token verified for accept. Payload: {json.dumps(payload)} ---")

        league_id = payload['league_id']
        invited_email = payload['email']
        target_slot = payload.get('target_slot')

        # Convert hyphens to underscores for database name
        league_database = f"league_{league_id.replace('-', '_')}"
        logger.info(f"--- invitations.py: League database name for accept: {league_database} ---")

        # Verify the authenticated user's email matches the invitation
        if user_email.lower() != invited_email.lower():
            logger.warning(f"--- invitations.py: Email mismatch: Auth user {user_email} vs Invite {invited_email}. ---")
            raise HTTPException(
                status_code=403,
                detail="This invitation was sent to a different email address"
            )
        logger.info(f"--- invitations.py: Email match confirmed. ---")

        # STEP 1: Get invitation details and verify it's still pending (league database)
        invitation_result = execute_sql(
            "SELECT invitation_id, status FROM league_invitations WHERE invitation_token = :token",
            parameters={'token': request_data.token},
            database_name=league_database
        )
        logger.info(f"--- invitations.py: Invitation DB query result (accept step 1): {json.dumps(invitation_result)} ---")

        if not invitation_result.get("records") or len(invitation_result["records"]) == 0:
            logger.warning("--- invitations.py: Invitation not found or already processed (accept step 1). ---")
            raise HTTPException(status_code=404, detail="Invitation not found or has already been used")

        invitation_record = invitation_result["records"][0]
        invitation_status = invitation_record[1].get('stringValue')

        if invitation_status != 'pending':
            logger.warning(f"--- invitations.py: Invitation status is not pending: {invitation_status}. ---")
            raise HTTPException(status_code=400, detail="This invitation has already been processed")
        logger.info(f"--- invitations.py: Invitation status confirmed pending. ---")

        # STEP 2: Check if user already has a team in this league (league database)
        existing_team = execute_sql(
            "SELECT team_id FROM league_teams WHERE league_id = :league_id::uuid AND user_id = :user_id",  # Check user_id
            parameters={'league_id': league_id, 'user_id': user_id},  # Use user_id
            database_name=league_database
        )
        logger.info(f"--- invitations.py: Existing team check result (accept step 2): {json.dumps(existing_team)} ---")

        if existing_team and existing_team.get("records") and len(existing_team["records"]) > 0:
            logger.warning(f"--- invitations.py: User {user_email} already has a team in league {league_id}. ---")
            raise HTTPException(status_code=400, detail="You already have a team in this league")
        logger.info(f"--- invitations.py: User does not have existing team in league. ---")

        # STEP 3: Get league details from main database
        league_details = execute_sql(
            "SELECT league_name FROM user_leagues WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name='postgres'  # CORRECT - user_leagues is in main database
        )
        logger.info(f"--- invitations.py: League details result (accept step 3): {json.dumps(league_details)} ---")

        if not league_details.get("records") or len(league_details["records"]) == 0:
            logger.error(f"--- invitations.py: League {league_id} not found in main DB (accept step 3). ---")
            raise HTTPException(status_code=404, detail="League not found")

        league_name = league_details["records"][0][0].get('stringValue')
        logger.info(f"--- invitations.py: League name: {league_name} ---")

        # STEP 4: Get max teams from league settings (league database)
        max_teams = 12
        try:
            settings_result = execute_sql(
                "SELECT setting_value FROM league_settings WHERE league_id = :league_id::uuid AND setting_name = 'max_teams'",
                parameters={'league_id': league_id},
                database_name=league_database
            )
            if settings_result.get("records") and len(settings_result["records"]) > 0:
                max_teams = int(settings_result["records"][0][0].get('stringValue', 12))
            logger.info(f"--- invitations.py: Max teams setting: {max_teams} ---")
        except Exception as settings_error:
            logger.warning(f"--- invitations.py: Could not get max_teams setting, using default of 12: {settings_error}", exc_info=True)

        # STEP 5: Check if league is full (league database)
        existing_teams_result = execute_sql(
            "SELECT COUNT(*) as team_count FROM league_teams WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name=league_database
        )
        logger.info(f"--- invitations.py: Existing teams count result (accept step 5): {json.dumps(existing_teams_result)} ---")

        team_count = 0
        if existing_teams_result.get("records") and len(existing_teams_result["records"]) > 0:
            team_count = existing_teams_result["records"][0][0].get('longValue', 0)

        if team_count >= max_teams:
            logger.warning(f"--- invitations.py: League is full ({team_count}/{max_teams}). ---")
            raise HTTPException(status_code=400, detail="League is already full")
        logger.info(f"--- invitations.py: League has available slots. ---")

        # STEP 6: Determine team name and slot (league database)
        team_slot = None
        
        # ✅ FIXED: Use JWT token data consistently for user display name
        manager_display_name = f"{user_first_name} {user_last_name}".strip()
        if not manager_display_name or manager_display_name == 'User':  # Fallback if first/last name are empty
            manager_display_name = user_email.split('@')[0]
        team_name_final = f"{manager_display_name}'s Team"

        if target_slot:
            # Check if target slot is available
            slot_taken_result = execute_sql(
                "SELECT team_id FROM league_teams WHERE league_id = :league_id::uuid AND slot_number = :slot_number",
                parameters={'league_id': league_id, 'slot_number': target_slot},
                database_name=league_database
            )
            logger.info(f"--- invitations.py: Target slot {target_slot} check result: {json.dumps(slot_taken_result)} ---")

            if slot_taken_result.get("records") and len(slot_taken_result["records"]) > 0:
                # Target slot taken, find next available
                used_slots_query = execute_sql(
                    "SELECT slot_number FROM league_teams WHERE league_id = :league_id::uuid ORDER BY slot_number",
                    parameters={'league_id': league_id},
                    database_name=league_database
                )
                used_slot_numbers = [r[0].get('longValue') for r in used_slots_query.get("records", []) if r[0] and not r[0].get('isNull')]

                next_available_slot = None
                for i in range(1, max_teams + 1):
                    if i not in used_slot_numbers:
                        next_available_slot = i
                        break

                if not next_available_slot:
                    logger.warning(f"--- invitations.py: No available team slots after target slot {target_slot} taken. ---")
                    raise HTTPException(status_code=400, detail="No available team slots")

                team_slot = next_available_slot
                logger.info(f"--- invitations.py: Target slot {target_slot} taken, assigned to next available: {team_slot} ---")
            else:
                team_slot = target_slot
                logger.info(f"--- invitations.py: Assigned to target slot: {team_slot} ---")
        else:
            # Auto-assign next available slot
            used_slots_query = execute_sql(
                "SELECT slot_number FROM league_teams WHERE league_id = :league_id::uuid ORDER BY slot_number",
                parameters={'league_id': league_id},
                database_name=league_database
            )
            used_slot_numbers = [r[0].get('longValue') for r in used_slots_query.get("records", []) if r[0] and not r[0].get('isNull')]

            next_available_slot = None
            for i in range(1, max_teams + 1):
                if i not in used_slot_numbers:
                    next_available_slot = i
                    break

            if not next_available_slot:
                logger.warning(f"--- invitations.py: No available team slots when auto-assigning. ---")
                raise HTTPException(status_code=400, detail="No available team slots")

            team_slot = next_available_slot
            logger.info(f"--- invitations.py: Auto-assigned to slot: {team_slot} ---")

        # STEP 7: Create the team (league database) - INCLUDING SLOT_NUMBER
        team_id = str(uuid.uuid4())
        logger.info(f"--- invitations.py: Creating new team {team_id} for user {user_id} in league {league_id} at slot {team_slot} ---")
        execute_sql(
            """INSERT INTO league_teams
                (team_id, league_id, user_id, manager_name, manager_email, team_name,
                 is_commissioner, created_at, slot_number)
                VALUES (:team_id::uuid, :league_id::uuid, :user_id, :manager_name, :manager_email,
                        :team_name, FALSE, :created_at::timestamptz, :slot_number)""",
            parameters={
                'team_id': team_id,
                'league_id': league_id,
                'user_id': user_id,  # ✅ FIXED: This is VARCHAR from JWT (sub)
                'manager_name': manager_display_name,  # ✅ FIXED: From JWT token
                'manager_email': user_email,  # ✅ FIXED: From JWT token
                'team_name': team_name_final,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'slot_number': team_slot  # NEW COLUMN for slot_number
            },
            database_name=league_database
        )
        logger.info(f"--- invitations.py: Team {team_id} created in league database. ---")

        # STEP 8: Add user to league membership (main database)
        logger.info(f"--- invitations.py: Adding user {user_id} to league_memberships in main database. ---")
        execute_sql(
            """INSERT INTO league_memberships (league_id, user_id, role, joined_at, is_active)
               VALUES (:league_id::uuid, :user_id, 'owner', :joined_at::timestamptz, true)
               ON CONFLICT (league_id, user_id) DO UPDATE SET
               role = 'owner', joined_at = :joined_at::timestamptz, is_active = true""",
            parameters={
                'league_id': league_id,
                'user_id': user_id,  # ✅ FIXED: VARCHAR from JWT
                'joined_at': datetime.now(timezone.utc).isoformat()
            },
            database_name='postgres'  # CORRECT - league_memberships is in main database
        )
        logger.info(f"--- invitations.py: User {user_id} added/updated in league_memberships. ---")

        # STEP 9: Mark invitation as accepted (league database)
        logger.info(f"--- invitations.py: Marking invitation {invitation_record[0].get('stringValue')} as accepted. ---")
        # ✅ FIXED: No UUID casting for accepted_by_user_id (now VARCHAR)
        execute_sql(
            """UPDATE league_invitations
               SET status = 'accepted', accepted_at = :accepted_at::timestamptz, accepted_by_user_id = :user_id::uuid
               WHERE invitation_token = :token""",
            parameters={
                'token': request_data.token,
                'accepted_at': datetime.now(timezone.utc).isoformat(),
                'user_id': user_id  # ✅ FIXED: No UUID casting - accepted_by_user_id is now VARCHAR
            },
            database_name=league_database
        )
        logger.info(f"--- invitations.py: Invitation marked as accepted in database. ---")

        logger.info(f"--- invitations.py: User {user_id} successfully joined league {league_id} as team {team_id} ---")

        return {
            'success': True,
            'message': f'Successfully joined {league_name}!',
            'team': {
                'team_id': team_id,
                'team_name': team_name_final,
                'league_id': league_id,
                'league_name': league_name,
                'slot_number': team_slot,
                'manager_name': manager_display_name,  # ✅ ADDED: Return display name
                'manager_email': user_email  # ✅ ADDED: Return email
            }
        }

    except HTTPException:
        logger.error("--- invitations.py: Caught HTTPException in accept_invitation. Re-raising. ---", exc_info=True)
        raise
    except Exception as e:
        logger.critical(f"--- invitations.py: CRITICAL UNEXPECTED ERROR IN accept_invitation: {str(e)} ---", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to join league")