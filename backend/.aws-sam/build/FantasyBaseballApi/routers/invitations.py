"""
Dynasty Dugout - Public Invitation Endpoints
HYBRID APPROACH: Public invitation verification and acceptance only
PURPOSE: Token verification and league joining (no authentication required for verify)
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import jwt
import uuid
import os
from datetime import datetime, timezone
import logging

# Import following your exact patterns from auth.py
from core.database import execute_sql
from core.auth_utils import get_current_user, verify_cognito_token
from core.config import COOKIE_CONFIG

# Configure logging
logger = logging.getLogger(__name__)

# Router without prefix - prefix is added in fantasy_api.py
router = APIRouter(tags=["invitations"])

# Configuration from environment variables
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-super-secret-jwt-key-change-this-in-production')
JWT_ALGORITHM = "HS256"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_current_user_optional(request: Request):
    """
    Optional auth - returns user if authenticated, None if not
    Following the exact pattern from your auth.py status endpoint
    """
    try:
        token = request.cookies.get(COOKIE_CONFIG["name"])
        if token:
            user_claims = verify_cognito_token(token)
            return user_claims
        else:
            return None
    except:
        return None

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
        raise HTTPException(status_code=400, detail="Invitation link has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid invitation link")

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
    try:
        # Decode and verify the JWT token
        payload = verify_invitation_token(token)
        
        league_id = payload['league_id']
        email = payload['email']
        
        # Convert hyphens to underscores for database name
        league_database = f"league_{league_id.replace('-', '_')}"
        
        # Get invitation details from database
        invitation_result = execute_sql(
            """SELECT i.invitation_id, i.league_id, i.email, i.owner_name, i.personal_message, 
                      i.target_slot, i.invited_at, i.expires_at, i.status,
                      ul.league_name
               FROM league_invitations i,
                    user_leagues ul
               WHERE i.invitation_token = :token 
               AND i.status = 'pending'
               AND ul.league_id = i.league_id::text""",
            parameters={'token': token},
            database_name=league_database
        )
        
        if not invitation_result.get("records") or len(invitation_result["records"]) == 0:
            raise HTTPException(status_code=404, detail="Invitation not found or has already been used")
        
        invitation_record = invitation_result["records"][0]
        
        # Check if invitation has expired
        expires_at_str = invitation_record[7].get('stringValue')
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                if expires_at < datetime.now(timezone.utc):
                    # Mark as expired in database
                    execute_sql(
                        "UPDATE league_invitations SET status = 'expired' WHERE invitation_token = :token",
                        parameters={'token': token},
                        database_name=league_database
                    )
                    raise HTTPException(status_code=400, detail="This invitation has expired")
            except Exception as date_error:
                logger.warning(f"Could not parse expiration date: {date_error}")
        
        # Check if user already has a team in this league
        existing_team = execute_sql(
            "SELECT team_id FROM league_teams WHERE league_id = :league_id::uuid AND manager_email = :email",
            parameters={'league_id': league_id, 'email': email},
            database_name=league_database
        )
        
        if existing_team and existing_team.get("records") and len(existing_team["records"]) > 0:
            raise HTTPException(status_code=400, detail="You already have a team in this league")
        
        # Get commissioner name
        commissioner_result = execute_sql(
            "SELECT u.given_name FROM users u, user_leagues ul WHERE ul.league_id = :league_id::uuid AND u.user_id = ul.commissioner_user_id",
            parameters={'league_id': league_id},
            database_name='postgres'
        )
        
        commissioner_name = "Commissioner"
        if commissioner_result.get("records") and len(commissioner_result["records"]) > 0:
            commissioner_name = commissioner_result["records"][0][0]["stringValue"]
        
        return {
            'success': True,
            'invitation': {
                'invitation_id': invitation_record[0].get('stringValue'),
                'league_id': invitation_record[1].get('stringValue'),
                'league_name': invitation_record[9].get('stringValue'),
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
        logger.error(f"Error verifying invitation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to verify invitation")

@router.post("/accept")
async def accept_invitation(
    request_data: AcceptInvitationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Accept an invitation and create a team for the user
    Requires authentication
    """
    try:
        user_id = current_user.get('sub') or current_user.get('user_id')
        user_email = current_user.get('email')
        
        if not user_id or not user_email:
            raise HTTPException(status_code=401, detail="Invalid user authentication")
        
        # Verify the invitation token
        payload = verify_invitation_token(request_data.token)
        
        league_id = payload['league_id']
        invited_email = payload['email']
        owner_name = payload['owner_name']
        target_slot = payload.get('target_slot')
        
        # Convert hyphens to underscores for database name
        league_database = f"league_{league_id.replace('-', '_')}"
        
        # Verify the authenticated user's email matches the invitation
        if user_email.lower() != invited_email.lower():
            raise HTTPException(
                status_code=403, 
                detail="This invitation was sent to a different email address"
            )
        
        # Get invitation details and verify it's still pending
        invitation_result = execute_sql(
            "SELECT invitation_id, status FROM league_invitations WHERE invitation_token = :token",
            parameters={'token': request_data.token},
            database_name=league_database
        )
        
        if not invitation_result.get("records") or len(invitation_result["records"]) == 0:
            raise HTTPException(status_code=404, detail="Invitation not found")
        
        invitation_record = invitation_result["records"][0]
        invitation_status = invitation_record[1].get('stringValue')
        
        if invitation_status != 'pending':
            raise HTTPException(status_code=400, detail="This invitation has already been processed")
        
        # Check if user already has a team in this league
        existing_team = execute_sql(
            "SELECT team_id FROM league_teams WHERE league_id = :league_id::uuid AND manager_email = :email",
            parameters={'league_id': league_id, 'email': user_email},
            database_name=league_database
        )
        
        if existing_team and existing_team.get("records") and len(existing_team["records"]) > 0:
            raise HTTPException(status_code=400, detail="You already have a team in this league")
        
        # Get league details
        league_details = execute_sql(
            "SELECT league_name FROM user_leagues WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name='postgres'
        )
        
        if not league_details.get("records") or len(league_details["records"]) == 0:
            raise HTTPException(status_code=404, detail="League not found")
        
        league_name = league_details["records"][0][0].get('stringValue')
        
        # Get max teams from league settings
        max_teams = 12
        try:
            settings_result = execute_sql(
                "SELECT setting_value FROM league_settings WHERE league_id = :league_id::uuid AND setting_name = 'max_teams'",
                parameters={'league_id': league_id},
                database_name=league_database
            )
            if settings_result.get("records") and len(settings_result["records"]) > 0:
                max_teams = int(settings_result["records"][0][0].get('stringValue', 12))
        except Exception:
            logger.warning("Could not get max_teams setting, using default of 12")
        
        # Check if league is full
        existing_teams_result = execute_sql(
            "SELECT COUNT(*) as team_count FROM league_teams WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name=league_database
        )
        
        team_count = 0
        if existing_teams_result.get("records") and len(existing_teams_result["records"]) > 0:
            team_count = existing_teams_result["records"][0][0].get('longValue', 0)
        
        if team_count >= max_teams:
            raise HTTPException(status_code=400, detail="League is already full")
        
        # Determine team name and slot
        if target_slot:
            # Check if target slot is available
            slot_taken_result = execute_sql(
                "SELECT team_id FROM league_teams WHERE league_id = :league_id::uuid AND slot_number = :slot",
                parameters={'league_id': league_id, 'slot': target_slot},
                database_name=league_database
            )
            
            if slot_taken_result.get("records") and len(slot_taken_result["records"]) > 0:
                # Find next available slot
                used_slots_result = execute_sql(
                    "SELECT slot_number FROM league_teams WHERE league_id = :league_id::uuid ORDER BY slot_number",
                    parameters={'league_id': league_id},
                    database_name=league_database
                )
                
                used_slot_numbers = []
                if used_slots_result.get("records"):
                    for slot_record in used_slots_result["records"]:
                        slot_num = slot_record[0].get('longValue')
                        if slot_num:
                            used_slot_numbers.append(slot_num)
                
                next_slot = None
                for i in range(1, max_teams + 1):
                    if i not in used_slot_numbers:
                        next_slot = i
                        break
                
                if not next_slot:
                    raise HTTPException(status_code=400, detail="No available team slots")
                
                team_slot = next_slot
                team_name = f"Team {next_slot}"
            else:
                team_slot = target_slot
                team_name = f"Team {target_slot}"
        else:
            # Auto-assign next available slot
            used_slots_result = execute_sql(
                "SELECT slot_number FROM league_teams WHERE league_id = :league_id::uuid ORDER BY slot_number",
                parameters={'league_id': league_id},
                database_name=league_database
            )
            
            used_slot_numbers = []
            if used_slots_result.get("records"):
                for slot_record in used_slots_result["records"]:
                    slot_num = slot_record[0].get('longValue')
                    if slot_num:
                        used_slot_numbers.append(slot_num)
            
            next_slot = None
            for i in range(1, max_teams + 1):
                if i not in used_slot_numbers:
                    next_slot = i
                    break
            
            if not next_slot:
                raise HTTPException(status_code=400, detail="No available team slots")
            
            team_slot = next_slot
            team_name = f"Team {next_slot}"
        
        # Create the team
        team_id = str(uuid.uuid4())
        
        execute_sql(
            """INSERT INTO league_teams 
               (team_id, league_id, user_id, manager_name, manager_email, team_name, 
                slot_number, is_commissioner, created_at)
               VALUES (:team_id::uuid, :league_id::uuid, :user_id::uuid, :manager_name, :manager_email, 
                       :team_name, :slot_number, FALSE, :created_at::timestamptz)""",
            parameters={
                'team_id': team_id,
                'league_id': league_id,
                'user_id': user_id,
                'manager_name': owner_name,
                'manager_email': user_email,
                'team_name': team_name,
                'slot_number': team_slot,
                'created_at': datetime.now(timezone.utc).isoformat()
            },
            database_name=league_database
        )
        
        # Add user to league membership
        execute_sql(
            """INSERT INTO league_memberships (league_id, user_id, role, joined_at, is_active)
               VALUES (:league_id::uuid, :user_id::uuid, 'owner', :joined_at::timestamptz, true)
               ON CONFLICT (league_id, user_id) DO UPDATE SET
               role = 'owner', joined_at = :joined_at::timestamptz, is_active = true""",
            parameters={
                'league_id': league_id,
                'user_id': user_id,
                'joined_at': datetime.now(timezone.utc).isoformat()
            },
            database_name='postgres'
        )
        
        # Mark invitation as accepted
        execute_sql(
            """UPDATE league_invitations 
               SET status = 'accepted', accepted_at = :accepted_at::timestamptz, accepted_by_user_id = :user_id::uuid
               WHERE invitation_token = :token""",
            parameters={
                'token': request_data.token,
                'accepted_at': datetime.now(timezone.utc).isoformat(),
                'user_id': user_id
            },
            database_name=league_database
        )
        
        logger.info(f"User {user_id} successfully joined league {league_id} as team {team_id}")
        
        return {
            'success': True,
            'message': f'Successfully joined {league_name}!',
            'team': {
                'team_id': team_id,
                'team_name': team_name,
                'slot_number': team_slot,
                'league_id': league_id,
                'league_name': league_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting invitation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to join league")