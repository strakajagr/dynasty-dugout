"""
Dynasty Dugout - Owner Management Module (League-Specific Admin Functions)
HYBRID APPROACH: League admin functions only - public endpoints in separate invitations.py
PURPOSE: Team ownership, setup, league-specific invitation management
FIXED: JWT consistency and VARCHAR user ID handling throughout
"""

import logging
import json
import jwt
import uuid
import os
import re
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
from typing import Optional
import boto3
from botocore.exceptions import ClientError

from core.auth_utils import get_current_user
from core.database import execute_sql

logger = logging.getLogger(__name__)
router = APIRouter()
logger.info("🚨 MODULE LOADED: owners.py loaded successfully at startup")

# Configuration from environment variables
SES_REGION = os.getenv('SES_REGION', 'us-east-1')
VERIFIED_SENDER = os.getenv('VERIFIED_SENDER', 'tonyragano@gmail.com')
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-super-secret-jwt-key-change-this-in-production')
JWT_ALGORITHM = "HS256"
INVITATION_EXPIRY_HOURS = int(os.getenv('INVITATION_EXPIRY_HOURS', '72'))  # 3 days
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'https://d20wx6xzxkf84y.cloudfront.net')

# Initialize AWS SES client
try:
    ses_client = boto3.client('ses', region_name=SES_REGION)
    logger.info(f"✅ SES client initialized successfully in region: {SES_REGION}")
except Exception as e:
    logger.error(f"❌ Failed to initialize SES client: {e}")
    ses_client = None

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def validate_email(email: str) -> bool:
    """Simple email validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def create_invitation_token(league_id: str, email: str, owner_name: str, target_slot: Optional[int] = None) -> str:
    """Create a secure JWT invitation token with expiration"""
    payload = {
        'league_id': league_id,
        'email': email,
        'owner_name': owner_name,
        'target_slot': target_slot,
        'invitation_type': 'league_join',
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRY_HOURS),
        'jti': str(uuid.uuid4())  # Unique token identifier
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def generate_invitation_email_html(
    owner_name: str,
    league_name: str,
    commissioner_name: str,
    invitation_token: str,
    personal_message: str = "",
    target_slot: Optional[int] = None
) -> str:
    """Generate professional HTML email template for league invitation"""
    join_url = f"{FRONTEND_BASE_URL}/join-league?token={invitation_token}"
    slot_info = f" as the owner of Team {target_slot}" if target_slot else ""
    
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dynasty Dugout League Invitation</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #1c1917 0%, #292524 100%); color: #eab308; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }}
            .header h1 {{ margin: 0 0 10px 0; font-size: 28px; font-weight: bold; }}
            .header h2 {{ margin: 0; font-size: 20px; font-weight: normal; opacity: 0.9; }}
            .content {{ background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
            .greeting {{ font-size: 18px; margin-bottom: 20px; }}
            .invitation-details {{ background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #eab308; }}
            .cta-button {{ display: inline-block; background: #eab308; color: #000000; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 25px 0; }}
            .cta-button:hover {{ background: #d97706; }}
            .personal-message {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0; font-style: italic; }}
            .security-notice {{ background: #e3f2fd; border: 1px solid #90caf9; padding: 20px; border-radius: 8px; margin: 25px 0; }}
            .footer {{ text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666; }}
            .warning {{ background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 25px 0; }}
            .highlight {{ background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; word-break: break-all; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏆 Dynasty Dugout</h1>
                <h2>You're Invited to Join a League!</h2>
            </div>
            
            <div class="content">
                <div class="greeting">Hi {owner_name},</div>
                
                <div class="invitation-details">
                    <strong>{commissioner_name}</strong> has invited you to join "<strong>{league_name}</strong>"{slot_info} in Dynasty Dugout!
                </div>
                
                {f'<div class="personal-message"><strong>Personal message from {commissioner_name}:</strong><br>"{personal_message}"</div>' if personal_message else ''}
                
                <h3>🎯 What is Dynasty Dugout?</h3>
                <p>Dynasty Dugout is a premium fantasy baseball platform where you can:</p>
                <ul>
                    <li>Build and manage your dream team with advanced statistics</li>
                    <li>Compete with salary cap management and strategic trading</li>
                    <li>Track real-time performance with comprehensive analytics</li>
                    <li>Enjoy a professional fantasy experience built for serious players</li>
                </ul>
                
                <h3>🚀 Getting Started</h3>
                <p>Ready to join? Click the button below to accept your invitation. If you don't have a Dynasty Dugout account yet, we'll guide you through a quick signup process.</p>
                
                <div style="text-align: center;">
                    <a href="{join_url}" class="cta-button">Accept Invitation & Join League</a>
                </div>
                
                <div class="warning">
                    ⏰ <strong>Important:</strong> This invitation expires in {INVITATION_EXPIRY_HOURS} hours for security reasons.
                </div>
                
                <div class="security-notice">
                    <h4>🔐 Security Notice</h4>
                    <p>This invitation link is unique and secure. Do not share it with others. If you didn't expect this invitation from {commissioner_name}, you can safely ignore this email.</p>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
                
                <p><strong>Trouble with the button?</strong> Copy and paste this link into your browser:</p>
                <div class="highlight">{join_url}</div>
            </div>
            
            <div class="footer">
                <p><strong>Dynasty Dugout</strong> - Premium Fantasy Baseball</p>
                <p>This email was sent because {commissioner_name} invited you to join their league.</p>
                <p>© 2025 Dynasty Dugout. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

def generate_invitation_email_text(
    owner_name: str,
    league_name: str,
    commissioner_name: str,
    invitation_token: str,
    personal_message: str = "",
    target_slot: Optional[int] = None
) -> str:
    """Generate plain text email for league invitation (fallback for HTML)"""
    join_url = f"{FRONTEND_BASE_URL}/join-league?token={invitation_token}"
    slot_info = f" as the owner of Team {target_slot}" if target_slot else ""
    
    return f"""
DYNASTY DUGOUT - LEAGUE INVITATION

Hi {owner_name},

{commissioner_name} has invited you to join "{league_name}"{slot_info} in Dynasty Dugout!

{f'Personal message from {commissioner_name}: "{personal_message}"' if personal_message else ''}

WHAT IS DYNASTY DUGOUT?
Dynasty Dugout is a premium fantasy baseball platform where you can build and manage your dream team with advanced statistics, salary cap management, and competitive leagues.

TO ACCEPT YOUR INVITATION:
Click this link: {join_url}

If you don't have an account yet, you'll be guided through a quick signup process first.

IMPORTANT: This invitation expires in {INVITATION_EXPIRY_HOURS} hours for security reasons.

SECURITY NOTICE:
This invitation link is unique and secure. Do not share it with others. If you didn't expect this invitation from {commissioner_name}, you can safely ignore this email.

---
Dynasty Dugout - Premium Fantasy Baseball
This email was sent because {commissioner_name} invited you to join their league.
© 2025 Dynasty Dugout. All rights reserved.
    """

async def send_invitation_email(
    recipient_email: str,
    owner_name: str,
    league_name: str,
    commissioner_name: str,
    invitation_token: str,
    personal_message: str = "",
    target_slot: Optional[int] = None
) -> bool:
    """Send invitation email using AWS SES"""
    if not ses_client:
        logger.error("❌ SES client not initialized")
        raise HTTPException(status_code=500, detail="Email service unavailable")
    
    try:
        subject = f"🏆 You're invited to join {league_name} in Dynasty Dugout!"
        
        html_body = generate_invitation_email_html(
            owner_name, league_name, commissioner_name, 
            invitation_token, personal_message, target_slot
        )
        
        text_body = generate_invitation_email_text(
            owner_name, league_name, commissioner_name,
            invitation_token, personal_message, target_slot
        )
        
        logger.info(f"📧 Sending invitation email to {recipient_email}")
        logger.info(f"🔧 DEBUG: SES client initialized: {ses_client is not None}")
        
        # Send email using SES
        logger.info(f"🔧 DEBUG: About to call ses_client.send_email...")
        response = ses_client.send_email(
            Source=VERIFIED_SENDER,
            Destination={'ToAddresses': [recipient_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'},
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'}
                }
            },
            Tags=[
                {'Name': 'EmailType', 'Value': 'LeagueInvitation'},
                {'Name': 'Application', 'Value': 'DynastyDugout'}
            ]
        )
        
        logger.info(f"✅ Invitation email sent successfully to {recipient_email}. MessageId: {response['MessageId']}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"❌ SES error sending invitation to {recipient_email}: {error_code}")
        
        if error_code == 'MessageRejected':
            raise HTTPException(status_code=400, detail="Email address is invalid or blocked")
        elif error_code == 'SendingPausedException':
            raise HTTPException(status_code=503, detail="Email sending is temporarily paused. Please try again later.")
        else:
            raise HTTPException(status_code=500, detail="Failed to send invitation email")
    
    except Exception as e:
        logger.error(f"❌ Unexpected error sending invitation email: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send invitation email")

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class TeamSetupRequest(BaseModel):
    """Team setup request model"""
    team_name: str
    manager_name: str
    team_logo_url: str = None
    team_colors: dict = {}
    team_motto: str = None

class InviteOwnerRequest(BaseModel):
    ownerName: str
    ownerEmail: str
    personalMessage: Optional[str] = ""
    targetSlot: Optional[int] = None
    leagueName: str
    commissionerName: str

    @validator('ownerName')
    def validate_owner_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Owner name must be at least 2 characters')
        return v.strip()

    @validator('ownerEmail')
    def validate_owner_email(cls, v):
        if not v or not validate_email(v.strip()):
            raise ValueError('Invalid email address')
        return v.strip().lower()

    @validator('personalMessage')
    def validate_personal_message(cls, v):
        if v and len(v) > 1000:
            raise ValueError('Personal message cannot exceed 1000 characters')
        return v.strip() if v else ""

# =============================================================================
# OWNER MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/{league_id}/owners")
async def get_league_owners(league_id: str, current_user: dict = Depends(get_current_user)):
    """
    🎯 CRITICAL ENDPOINT: Get owner management data for the Owner Management table
    Returns: Active teams + Pending invitations + Empty slots
    This is what the Owner Management UI should call instead of /standings
    """
    try:
        user_id = current_user.get('sub')
        logger.info(f"👥 Getting owner management data for league: {league_id}")
        
        # Get league info first to verify access and get database name
        league_sql = """
            SELECT ul.database_name, ul.commissioner_user_id, lm.role 
            FROM user_leagues ul
            JOIN league_memberships lm ON ul.league_id = lm.league_id
            WHERE ul.league_id = :league_id::uuid 
            AND lm.user_id = :user_id 
            AND lm.is_active = true
        """
        
        league_result = execute_sql(league_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not league_result.get('records'):
            raise HTTPException(status_code=404, detail="League not found or access denied")
        
        database_name = league_result['records'][0][0].get('stringValue')
        commissioner_user_id = league_result['records'][0][1].get('stringValue')
        user_role = league_result['records'][0][2].get('stringValue')
        
        if not database_name:
            raise HTTPException(status_code=500, detail="League database not found")
        
        logger.info(f"🗄️ Fetching owner data from database: {database_name}")
        
        # Get max teams from league settings
        max_teams = 12
        try:
            settings_sql = "SELECT setting_value FROM league_settings WHERE league_id = :league_id::uuid AND setting_name = 'max_teams'"
            settings_result = execute_sql(settings_sql, {'league_id': league_id}, database_name=database_name)
            if settings_result.get('records') and settings_result['records'][0]:
                max_teams = int(settings_result['records'][0][0].get('stringValue', 12))
        except Exception as settings_error:
            logger.warning(f"Could not get max_teams setting: {settings_error}")
        
        # Get active teams from league database
        teams_result = execute_sql(
            """
            SELECT 
                team_id,
                team_name,
                manager_name,
                manager_email,
                user_id,
                created_at
            FROM league_teams 
            ORDER BY created_at ASC
            """,
            database_name=database_name
        )
        
        # Get pending invitations from league database  
        invitations_result = execute_sql(
            """
            SELECT 
                invitation_id,
                email,
                owner_name,
                target_slot,
                invited_at
            FROM league_invitations 
            WHERE status = 'pending'
            ORDER BY invited_at ASC
            """,
            database_name=database_name
        )
        
        logger.info(f"🔍 Found {len(teams_result.get('records', []))} active teams and {len(invitations_result.get('records', []))} pending invitations")
        
        # Build owner management data
        owners = []
        used_slots = set()
        
        # Add active teams first
        if teams_result.get('records'):
            for i, team_record in enumerate(teams_result['records'], 1):
                team_user_id = team_record[4].get('stringValue') if team_record[4] and not team_record[4].get('isNull') else None
                is_commissioner = team_user_id == commissioner_user_id
                
                owner = {
                    "slot": i,
                    "owner_name": team_record[2].get('stringValue') if team_record[2] and not team_record[2].get('isNull') else "Manager",
                    "owner_email": team_record[3].get('stringValue') if team_record[3] and not team_record[3].get('isNull') else "N/A",
                    "team_name": team_record[1].get('stringValue') if team_record[1] and not team_record[1].get('isNull') else "Unnamed Team",
                    "status": "Active",
                    "actions": ["Edit"] if is_commissioner else [],
                    "team_id": team_record[0].get('stringValue') if team_record[0] and not team_record[0].get('isNull') else None,
                    "is_commissioner": is_commissioner
                }
                owners.append(owner)
                used_slots.add(i)
        
        # Add pending invitations next
        if invitations_result.get('records'):
            for invitation_record in invitations_result['records']:
                # Find next available slot
                next_slot = None
                for slot_num in range(1, max_teams + 1):
                    if slot_num not in used_slots:
                        next_slot = slot_num
                        used_slots.add(slot_num)
                        break
                
                if next_slot:
                    owner = {
                        "slot": next_slot,
                        "owner_name": invitation_record[2].get('stringValue') if invitation_record[2] and not invitation_record[2].get('isNull') else "Invited Owner",
                        "owner_email": invitation_record[1].get('stringValue') if invitation_record[1] and not invitation_record[1].get('isNull') else "unknown@email.com",
                        "team_name": f"Team {next_slot} (Pending)",
                        "status": "Pending",
                        "actions": ["Cancel"] if user_role == 'commissioner' else [],
                        "invitation_id": invitation_record[0].get('stringValue') if invitation_record[0] and not invitation_record[0].get('isNull') else None,
                        "is_commissioner": False
                    }
                    owners.append(owner)
        
        # Fill remaining slots with "Awaiting Owner"
        for slot_num in range(1, max_teams + 1):
            if slot_num not in used_slots:
                owner = {
                    "slot": slot_num,
                    "owner_name": "Awaiting Owner",
                    "owner_email": "N/A",
                    "team_name": "Awaiting New Owner",
                    "status": "Open",
                    "actions": ["Invite"] if user_role == 'commissioner' else [],
                    "team_id": None,
                    "is_commissioner": False
                }
                owners.append(owner)
        
        # Sort by slot number
        owners.sort(key=lambda x: x["slot"])
        
        logger.info(f"✅ Returning {len(owners)} owner management entries (max: {max_teams})")
        
        return {
            "success": True,
            "owners": owners,
            "total_active_teams": len(teams_result.get('records', [])),
            "total_pending_invitations": len(invitations_result.get('records', [])),
            "max_teams": max_teams,
            "user_role": user_role,
            "available_slots": max_teams - len(owners)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting league owners: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get owner management data: {str(e)}")

@router.post("/{league_id}/setup-team")
async def setup_team(
    league_id: str,
    team_data: TeamSetupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Setup team details after league creation"""
    try:
        user_id = current_user.get('sub')
        
        # Get league database name from phone book
        league_sql = "SELECT database_name FROM user_leagues WHERE league_id = :league_id::uuid"
        league_response = execute_sql(league_sql, {'league_id': league_id})
        
        if not league_response.get('records'):
            raise HTTPException(status_code=404, detail="League not found")
        
        database_name = league_response['records'][0][0].get('stringValue')
        
        # Verify user has a team in this league database
        team_sql = """
            SELECT team_id FROM league_teams 
            WHERE league_id = :league_id::uuid AND user_id = :user_id
        """
        
        team_response = execute_sql(team_sql, {
            'league_id': league_id,
            'user_id': user_id
        }, database_name=database_name)
        
        if not team_response.get('records'):
            raise HTTPException(status_code=404, detail="Team not found in this league")
        
        team_id = team_response['records'][0][0].get('stringValue')
        
        # Update team details in league database
        update_sql = """
            UPDATE league_teams 
            SET 
                team_name = :team_name,
                manager_name = :manager_name,
                team_logo_url = :team_logo_url,
                team_colors = :team_colors::jsonb,
                team_motto = :team_motto
            WHERE team_id = :team_id::uuid
        """
        
        execute_sql(update_sql, {
            'team_id': team_id,
            'team_name': team_data.team_name,
            'manager_name': team_data.manager_name,  
            'team_logo_url': team_data.team_logo_url,
            'team_colors': json.dumps(team_data.team_colors),
            'team_motto': team_data.team_motto
        }, database_name=database_name)
        
        return {
            "success": True,
            "team_id": team_id,
            "message": "Team setup completed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting up team: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to setup team")

# =============================================================================
# LEAGUE-SPECIFIC INVITATION MANAGEMENT ENDPOINTS
# =============================================================================

@router.post("/{league_id}/invite-owner")
async def invite_owner(
    league_id: str,
    request_data: InviteOwnerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send an invitation to join a league as a team owner - EMAIL-FIRST PATTERN"""
    logger.info(f"🚨 FUNCTION START: invite_owner called for league {league_id}")
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user authentication")
        
        logger.info(f"📧 Sending invitation for league: {league_id}")
        
        # Verify the user is the commissioner of this league
        commissioner_check = execute_sql(
            "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name='postgres'
        )
        
        if not commissioner_check.get("records") or len(commissioner_check["records"]) == 0:
            raise HTTPException(status_code=404, detail="League not found")
        
        actual_commissioner = commissioner_check["records"][0][0]["stringValue"]
        
        if current_user['sub'] != actual_commissioner:
            raise HTTPException(status_code=403, detail="Only the commissioner can send invitations")
        
        # Convert hyphens to underscores for database name
        database_name = f"league_{league_id.replace('-', '_')}"
        
        # Check if email already has a pending invitation
        existing_invitation = execute_sql(
            "SELECT invitation_id FROM league_invitations WHERE league_id = :league_id::uuid AND email = :email AND status = 'pending'",
            parameters={'league_id': league_id, 'email': request_data.ownerEmail},
            database_name=database_name
        )
        
        if existing_invitation and existing_invitation.get("records") and len(existing_invitation["records"]) > 0:
            raise HTTPException(status_code=400, detail="This email address already has a pending invitation for this league")
        
        # Check if email already belongs to a team in this league
        existing_team = execute_sql(
            "SELECT team_id FROM league_teams WHERE league_id = :league_id::uuid AND manager_email = :email",
            parameters={'league_id': league_id, 'email': request_data.ownerEmail},
            database_name=database_name
        )
        
        if existing_team and existing_team.get("records") and len(existing_team["records"]) > 0:
            raise HTTPException(status_code=400, detail="This email address already owns a team in this league")
        
        # Create secure invitation token
        invitation_token = create_invitation_token(
            league_id=league_id,
            email=request_data.ownerEmail,
            owner_name=request_data.ownerName,
            target_slot=request_data.targetSlot
        )
        
        # Generate unique invitation ID
        invitation_id = str(uuid.uuid4())
        
        # 🎯 EMAIL-FIRST PATTERN: Send invitation email FIRST (synchronous)
        logger.info(f"📧 EMAIL-FIRST: Sending email before database save")
        logger.info(f"🚨 ABOUT TO CALL: send_invitation_email function")
        await send_invitation_email(
            recipient_email=request_data.ownerEmail,
            owner_name=request_data.ownerName,
            league_name=request_data.leagueName,
            commissioner_name=request_data.commissionerName,
            invitation_token=invitation_token,
            personal_message=request_data.personalMessage,
            target_slot=request_data.targetSlot
        )
        
        # Only store invitation in database if email succeeds
        logger.info(f"✅ Email sent successfully, now saving to database")
        # ✅ FIXED: No UUID casting for user ID (invited_by is now VARCHAR)
        execute_sql(
            """INSERT INTO league_invitations 
               (invitation_id, league_id, email, owner_name, personal_message, target_slot, 
                invitation_token, status, invited_by, invited_at, expires_at)
               VALUES (:invitation_id::uuid, :league_id::uuid, :email, :owner_name, :personal_message, 
                       :target_slot, :invitation_token, 'pending', :invited_by, :invited_at::timestamptz, :expires_at::timestamptz)""",
            parameters={
                'invitation_id': invitation_id,
                'league_id': league_id,
                'email': request_data.ownerEmail,
                'owner_name': request_data.ownerName,
                'personal_message': request_data.personalMessage,
                'target_slot': request_data.targetSlot,
                'invitation_token': invitation_token,
                'invited_by': user_id,  # ✅ FIXED: No UUID casting - user_id is VARCHAR from JWT
                'invited_at': datetime.now(timezone.utc).isoformat(),
                'expires_at': (datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRY_HOURS)).isoformat()
            },
            database_name=database_name
        )
        
        logger.info(f"✅ League invitation created: {invitation_id} for {request_data.ownerEmail} to league {league_id}")
        
        return {
            "success": True,
            "message": f"Invitation sent successfully to {request_data.ownerName} ({request_data.ownerEmail})",
            "invitation_id": invitation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating invitation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send invitation")

@router.get("/{league_id}/invitations")
async def get_pending_invitations(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all pending invitations for league (commissioner only)"""
    try:
        user_id = current_user.get('sub')
        
        # Verify user is the commissioner
        commissioner_check = execute_sql(
            "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name='postgres'
        )
        
        if not commissioner_check.get("records") or len(commissioner_check["records"]) == 0:
            raise HTTPException(status_code=404, detail="League not found")
        
        actual_commissioner = commissioner_check["records"][0][0]["stringValue"]
        
        if current_user['sub'] != actual_commissioner:
            raise HTTPException(status_code=403, detail="Only the commissioner can view invitations")
        
        # Convert hyphens to underscores for database name
        database_name = f"league_{league_id.replace('-', '_')}"
        
        # Get pending invitations
        invitations_result = execute_sql(
            """SELECT invitation_id, email, owner_name, personal_message, target_slot, 
                      invited_at, expires_at, status
               FROM league_invitations 
               WHERE league_id = :league_id::uuid AND status = 'pending'
               ORDER BY invited_at DESC""",
            parameters={'league_id': league_id},
            database_name=database_name
        )
        
        invitations = []
        if invitations_result.get('records'):
            for record in invitations_result['records']:
                invitation = {
                    'invitation_id': record[0].get('stringValue'),
                    'email': record[1].get('stringValue'),
                    'owner_name': record[2].get('stringValue'),
                    'personal_message': record[3].get('stringValue') if not record[3].get('isNull') else '',
                    'target_slot': record[4].get('longValue') if not record[4].get('isNull') else None,
                    'invited_at': record[5].get('stringValue'),
                    'expires_at': record[6].get('stringValue'),
                    'status': record[7].get('stringValue')
                }
                invitations.append(invitation)
        
        return {
            'success': True,
            'invitations': invitations
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching invitations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch invitations")

@router.delete("/{league_id}/invitations/{invitation_id}")
async def cancel_invitation(
    league_id: str,
    invitation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a pending invitation (commissioner only) - ENHANCED WITH DEBUGGING"""
    try:
        user_id = current_user.get('sub')
        
        logger.info(f"🚨 CANCEL START: cancel_invitation called for invitation {invitation_id} in league {league_id}")
        
        # Verify the user is the commissioner of this league
        commissioner_check = execute_sql(
            "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name='postgres'
        )
        
        if not commissioner_check.get("records") or len(commissioner_check["records"]) == 0:
            raise HTTPException(status_code=404, detail="League not found")
        
        actual_commissioner = commissioner_check["records"][0][0]["stringValue"]
        
        if current_user['sub'] != actual_commissioner:
            raise HTTPException(status_code=403, detail="Only the commissioner can cancel invitations")
        
        # Convert hyphens to underscores for database name
        database_name = f"league_{league_id.replace('-', '_')}"
        logger.info(f"🔍 Using database: {database_name}")
        
        # Check if invitation exists and get details
        invitation_check = execute_sql(
            "SELECT invitation_id, status, email FROM league_invitations WHERE invitation_id = :invitation_id::uuid",
            parameters={'invitation_id': invitation_id},
            database_name=database_name
        )
        
        if not invitation_check.get("records") or len(invitation_check["records"]) == 0:
            logger.error(f"❌ Invitation {invitation_id} not found in database {database_name}")
            raise HTTPException(status_code=404, detail="Invitation not found")
        
        invitation_status = invitation_check["records"][0][1]["stringValue"]
        invitation_email = invitation_check["records"][0][2]["stringValue"]
        
        logger.info(f"✅ Found invitation: {invitation_id}, status: {invitation_status}, email: {invitation_email}")
        
        if invitation_status != 'pending':
            raise HTTPException(status_code=400, detail=f"Cannot cancel invitation with status: {invitation_status}")
        
        # Cancel the invitation with detailed debugging
        logger.info(f"🔍 DEBUG: About to delete invitation_id: {invitation_id}")
        logger.info(f"🔍 DEBUG: From database: {database_name}")
        logger.info(f"🔍 DEBUG: Target email: {invitation_email}")
        
        delete_result = execute_sql(
            """DELETE FROM league_invitations
               WHERE invitation_id = :invitation_id::uuid""",
            parameters={
                'invitation_id': invitation_id
            },
            database_name=database_name
        )
        
        logger.info(f"🔍 DEBUG: Delete operation completed")
        logger.info(f"🔍 DEBUG: Delete result: {delete_result}")
        logger.info(f"🔍 DEBUG: Number of records updated: {delete_result.get('numberOfRecordsUpdated', 'unknown')}")
        
        # Verify the deletion worked
        verification_check = execute_sql(
            "SELECT invitation_id FROM league_invitations WHERE invitation_id = :invitation_id::uuid",
            parameters={'invitation_id': invitation_id},
            database_name=database_name
        )
        
        if verification_check.get("records") and len(verification_check["records"]) > 0:
            logger.error(f"❌ DELETION FAILED: Invitation {invitation_id} still exists after DELETE operation")
            raise HTTPException(status_code=500, detail="Failed to delete invitation - record still exists")
        
        logger.info(f"✅ DELETION VERIFIED: Invitation {invitation_id} successfully removed from database")
        logger.info(f"✅ Invitation to {invitation_email} cancelled successfully")

        return {
            "success": True,
            "message": f"Invitation to {invitation_email} has been cancelled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error cancelling invitation {invitation_id} for league {league_id}: {str(e)}")
        logger.error(f"❌ Exception type: {type(e).__name__}")
        logger.error(f"❌ Exception details: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel invitation")

@router.post("/{league_id}/invitations/{invitation_id}/resend")
async def resend_invitation(
    league_id: str,
    invitation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Resend an invitation email (commissioner only) - EMAIL-FIRST PATTERN"""
    try:
        user_id = current_user.get('sub')
        
        # Verify user is the commissioner
        commissioner_check = execute_sql(
            "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name='postgres'
        )
        
        if not commissioner_check.get("records") or len(commissioner_check["records"]) == 0:
            raise HTTPException(status_code=404, detail="League not found")
        
        actual_commissioner = commissioner_check["records"][0][0]["stringValue"]
        
        if current_user['sub'] != actual_commissioner:
            raise HTTPException(status_code=403, detail="Only the commissioner can resend invitations")
        
        # Convert hyphens to underscores for database name
        database_name = f"league_{league_id.replace('-', '_')}"
        
        # Get invitation details and league name
        invitation_result = execute_sql(
            """SELECT i.invitation_id, i.email, i.owner_name, i.personal_message, 
                      i.target_slot, i.invitation_token, i.status
               FROM league_invitations i
               WHERE i.invitation_id = :invitation_id::uuid 
               AND i.league_id = :league_id::uuid""",
            parameters={'invitation_id': invitation_id, 'league_id': league_id},
            database_name=database_name
        )
        
        if not invitation_result.get("records") or len(invitation_result["records"]) == 0:
            raise HTTPException(status_code=404, detail="Invitation not found")
        
        invitation_record = invitation_result["records"][0]
        invitation_status = invitation_record[6]["stringValue"]
        
        if invitation_status != 'pending':
            raise HTTPException(status_code=400, detail="Can only resend pending invitations")
        
        # Get league name from main database
        league_name_result = execute_sql(
            "SELECT league_name FROM user_leagues WHERE league_id = :league_id::uuid",
            parameters={'league_id': league_id},
            database_name='postgres'
        )
        
        league_name = "Unknown League"
        if league_name_result.get("records") and len(league_name_result["records"]) > 0:
            league_name = league_name_result["records"][0][0]["stringValue"]
        
        # ✅ FIXED: Get commissioner name from JWT token instead of database
        commissioner_first_name = current_user.get('given_name', 'Commissioner')
        commissioner_last_name = current_user.get('family_name', '')
        commissioner_name = f"{commissioner_first_name} {commissioner_last_name}".strip()
        if not commissioner_name or commissioner_name == 'Commissioner':
            commissioner_name = "Commissioner"
        
        # 🎯 EMAIL-FIRST PATTERN: Send email synchronously
        logger.info(f"📧 EMAIL-FIRST: Resending email for invitation {invitation_id}")
        await send_invitation_email(
            recipient_email=invitation_record[1]["stringValue"],
            owner_name=invitation_record[2]["stringValue"],
            league_name=league_name,
            commissioner_name=commissioner_name,
            invitation_token=invitation_record[5]["stringValue"],
            personal_message=invitation_record[3]["stringValue"] if not invitation_record[3].get('isNull') else "",
            target_slot=invitation_record[4]["longValue"] if not invitation_record[4].get('isNull') else None
        )
        
        # Update the invitation with new resend timestamp only after email succeeds
        execute_sql(
            "UPDATE league_invitations SET updated_at = :updated_at::timestamptz WHERE invitation_id = :invitation_id::uuid",
            parameters={
                'invitation_id': invitation_id,
                'updated_at': datetime.now(timezone.utc).isoformat()
            },
            database_name=database_name
        )
        
        logger.info(f"✅ Invitation {invitation_id} resent to {invitation_record[1]['stringValue']}")
        
        return {
            'success': True,
            'message': f"Invitation resent successfully to {invitation_record[2]['stringValue']} ({invitation_record[1]['stringValue']})"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error resending invitation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to resend invitation")