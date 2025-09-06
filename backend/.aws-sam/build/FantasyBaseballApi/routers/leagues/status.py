"""
Dynasty Dugout - League Status Management Module
Handles league status progression and enforcement
UPDATED: For shared database architecture
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from datetime import datetime
import logging
import json
from core.database import execute_sql
from core.auth_utils import get_current_user
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# Valid status transitions (including backward transitions for corrections)
VALID_STATUS_TRANSITIONS = {
    'setup': ['pricing'],
    'pricing': ['setup', 'draft_ready'],  # Can go back to setup or forward to draft_ready
    'draft_ready': ['pricing', 'drafting'],  # Can go back to pricing or forward to drafting
    'drafting': ['draft_ready', 'active'],  # Can go back to draft_ready or forward to active
    'active': ['drafting', 'completed', 'paused'],  # Can go back to drafting for corrections
    'paused': ['active'],
    'completed': []
}

# Transaction permissions by status
TRANSACTION_PERMISSIONS = {
    'setup': [],
    'pricing': [],
    'draft_ready': ['add_player', 'drop_player'],
    'drafting': ['draft_player'],
    'active': ['add_player', 'drop_player', 'trade', 'waiver_claim'],
    'paused': [],
    'completed': []
}

class StatusUpdate(BaseModel):
    league_status: str
    
class DraftTypeUpdate(BaseModel):
    draft_type: str
    
class OwnerNotification(BaseModel):
    subject: str
    message: str
    notification_type: str = 'general'

class TransactionLog(BaseModel):
    transaction_type: str
    player_id: Optional[int] = None
    team_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = {}

def verify_commissioner(league_id: str, user_id: str) -> bool:
    """Verify user is commissioner of the league"""
    try:
        # Check if user has commissioner flag in league_teams (shared database)
        result = execute_sql(
            """SELECT COUNT(*) FROM league_teams 
               WHERE league_id = :league_id::uuid 
               AND user_id = :user_id 
               AND is_commissioner = true""",
            {'league_id': league_id, 'user_id': user_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        if result and result.get('records'):
            count = result['records'][0][0].get('longValue', 0)
            if count > 0:
                return True
        
        # Fallback to original commissioner check in main database
        result = execute_sql(
            "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid",
            {'league_id': league_id},
            database_name='postgres'
        )
        if result and result.get('records'):
            commissioner_id = result['records'][0][0].get('stringValue')
            return commissioner_id == user_id
        
        return False
    except Exception as e:
        logger.error(f"Error verifying commissioner: {e}")
        return False

@router.get("/{league_id}/status")
async def get_league_status(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current league status and related information"""
    try:
        logger.info(f"Getting league status for {league_id}")
        
        # Get current status from settings in shared database
        result = execute_sql(
            "SELECT setting_value FROM league_settings WHERE league_id = :league_id::uuid AND setting_name = 'league_status'",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        current_status = 'setup'
        if result and result.get('records') and result['records'][0][0]:
            current_status = result['records'][0][0].get('stringValue', 'setup')
        
        # Get additional status info from shared database
        info = execute_sql(
            """SELECT setting_name, setting_value 
               FROM league_settings
               WHERE league_id = :league_id::uuid 
               AND setting_name IN ('draft_type', 'prices_generated_at', 'season_started_at')""",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        draft_type = None
        prices_generated_at = None
        season_started_at = None
        
        if info and info.get('records'):
            for record in info['records']:
                if record[0] and record[1]:
                    name = record[0].get('stringValue')
                    value = record[1].get('stringValue')
                    if name == 'draft_type':
                        draft_type = value
                    elif name == 'prices_generated_at':
                        prices_generated_at = value
                    elif name == 'season_started_at':
                        season_started_at = value
        
        # Check if prices are set in shared database
        price_check = execute_sql(
            """SELECT COUNT(*) FROM league_players 
               WHERE league_id = :league_id::uuid
               AND (salary > 0 OR generated_price > 0 OR manual_price_override > 0)""",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        prices_set = False
        if price_check and price_check.get('records'):
            count = price_check['records'][0][0].get('longValue', 0)
            prices_set = count > 0
        
        # Get valid next statuses
        valid_next = VALID_STATUS_TRANSITIONS.get(current_status, [])
        
        # Get allowed transactions
        allowed_transactions = TRANSACTION_PERMISSIONS.get(current_status, [])
        if current_status == 'draft_ready' and not prices_set:
            allowed_transactions = []
        
        return {
            "success": True,
            "league_status": current_status,
            "draft_type": draft_type,
            "prices_set": prices_set,
            "prices_generated_at": prices_generated_at,
            "season_started_at": season_started_at,
            "valid_next_statuses": valid_next,
            "allowed_transactions": allowed_transactions,
            "can_transition": len(valid_next) > 0
        }
        
    except Exception as e:
        logger.error(f"Error getting league status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{league_id}/price-status")
async def check_price_status(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if prices have been set for the league"""
    try:
        logger.info(f"Checking price status for league {league_id}")
        
        # Check if any players have prices set in shared database
        price_check = execute_sql(
            """SELECT COUNT(*) FROM league_players 
               WHERE league_id = :league_id::uuid
               AND (salary > 0 OR generated_price > 0 OR manual_price_override > 0)""",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        prices_set = False
        player_count = 0
        
        if price_check and price_check.get('records'):
            player_count = price_check['records'][0][0].get('longValue', 0)
            prices_set = player_count > 0
        
        # Get price generation timestamp if available
        timestamp_result = execute_sql(
            """SELECT setting_value FROM league_settings 
               WHERE league_id = :league_id::uuid AND setting_name = 'prices_generated_at'""",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        prices_generated_at = None
        if timestamp_result and timestamp_result.get('records') and timestamp_result['records'][0][0]:
            prices_generated_at = timestamp_result['records'][0][0].get('stringValue')
        
        return {
            "success": True,
            "prices_set": prices_set,
            "players_with_prices": player_count,
            "prices_generated_at": prices_generated_at
        }
        
    except Exception as e:
        logger.error(f"Error checking price status: {e}", exc_info=True)
        return {
            "success": True,
            "prices_set": False,
            "players_with_prices": 0,
            "prices_generated_at": None
        }

@router.put("/{league_id}/status")
async def update_league_status(
    league_id: str,
    status_update: StatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update league status (commissioner only)"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        logger.info(f"Updating league {league_id} status to {status_update.league_status}")
        
        # Check commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can change league status")
        
        new_status = status_update.league_status
        
        # Get current status from shared database
        result = execute_sql(
            "SELECT setting_value FROM league_settings WHERE league_id = :league_id::uuid AND setting_name = 'league_status'",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        current_status = 'setup'
        if result and result.get('records') and result['records'][0][0]:
            current_status = result['records'][0][0].get('stringValue', 'setup')
        
        # Determine if this is a backward transition
        status_order = ['setup', 'pricing', 'draft_ready', 'drafting', 'active', 'completed']
        is_backward = False
        if current_status in status_order and new_status in status_order:
            is_backward = status_order.index(new_status) < status_order.index(current_status)
        
        # Validate transition
        valid_transitions = VALID_STATUS_TRANSITIONS.get(current_status, [])
        if new_status not in valid_transitions:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot transition from {current_status} to {new_status}"
            )
        
        # Additional validation for forward transition to draft_ready
        if new_status == 'draft_ready' and not is_backward:
            price_result = execute_sql(
                """SELECT COUNT(*) FROM league_players 
                   WHERE league_id = :league_id::uuid
                   AND (salary > 0 OR generated_price > 0 OR manual_price_override > 0)""",
                {'league_id': league_id},
                database_name='leagues'  # SHARED DATABASE
            )
            if price_result and price_result.get('records'):
                count = price_result['records'][0][0].get('longValue', 0)
                if count == 0:
                    raise HTTPException(status_code=400, detail="Cannot move to draft_ready without setting prices")
        
        # Update status in shared database
        execute_sql(
            """INSERT INTO league_settings (league_id, setting_name, setting_value, setting_type)
               VALUES (:league_id::uuid, 'league_status', :status, 'string')
               ON CONFLICT (league_id, setting_name) 
               DO UPDATE SET setting_value = :status, updated_at = NOW()""",
            {'league_id': league_id, 'status': new_status},
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Update main database
        execute_sql(
            """UPDATE user_leagues 
               SET league_status = :status, status_last_updated_at = NOW()
               WHERE league_id = :league_id::uuid""",
            {'status': new_status, 'league_id': league_id},
            database_name='postgres'
        )
        
        # Log the status change
        logger.info(f"League {league_id} status {'REVERTED' if is_backward else 'updated'} from {current_status} to {new_status} by {user_id}")
        
        return {
            "success": True,
            "previous_status": current_status,
            "league_status": new_status,
            "message": f"League status {'reverted' if is_backward else 'updated'} to {new_status}",
            "is_backward_transition": is_backward
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating league status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{league_id}/draft-type")
async def set_draft_type(
    league_id: str,
    draft_update: DraftTypeUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Set draft type for the league (commissioner only)"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        logger.info(f"Setting draft type for league {league_id} to {draft_update.draft_type}")
        
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can set draft type")
        
        draft_type = draft_update.draft_type
        
        # Validate draft type
        valid_types = ['snake', 'auction', 'offline']
        if draft_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid draft type: {draft_type}")
        
        # Update draft type in shared database
        execute_sql(
            """INSERT INTO league_settings (league_id, setting_name, setting_value, setting_type)
               VALUES (:league_id::uuid, 'draft_type', :type, 'string')
               ON CONFLICT (league_id, setting_name) 
               DO UPDATE SET setting_value = :type, updated_at = NOW()""",
            {'league_id': league_id, 'type': draft_type},
            database_name='leagues'  # SHARED DATABASE
        )
        
        return {
            "success": True,
            "draft_type": draft_type,
            "message": f"Draft type set to {draft_type}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting draft type: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/start-season")
async def start_season(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start the league season (commissioner only)"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        logger.info(f"Starting season for league {league_id}")
        
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can start the season")
        
        # Update to active status in shared database
        execute_sql(
            """INSERT INTO league_settings (league_id, setting_name, setting_value, setting_type)
               VALUES (:league_id::uuid, 'league_status', 'active', 'string')
               ON CONFLICT (league_id, setting_name) 
               DO UPDATE SET setting_value = 'active', updated_at = NOW()""",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Record season start time in shared database
        execute_sql(
            """INSERT INTO league_settings (league_id, setting_name, setting_value, setting_type)
               VALUES (:league_id::uuid, 'season_started_at', :timestamp, 'timestamp')
               ON CONFLICT (league_id, setting_name) 
               DO UPDATE SET setting_value = :timestamp, updated_at = NOW()""",
            {'league_id': league_id, 'timestamp': datetime.utcnow().isoformat()},
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Update main database
        execute_sql(
            """UPDATE user_leagues 
               SET league_status = 'active', status_last_updated_at = NOW()
               WHERE league_id = :league_id::uuid""",
            {'league_id': league_id},
            database_name='postgres'
        )
        
        return {
            "success": True,
            "message": "Season started successfully",
            "league_status": "active",
            "season_started_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting season: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/notify-owners")
async def notify_owners(
    league_id: str,
    notification: OwnerNotification,
    current_user: dict = Depends(get_current_user)
):
    """Send notification to all league owners (commissioner only)"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can send notifications")
        
        # Get all owners from shared database
        owners = execute_sql(
            """SELECT DISTINCT user_id, manager_email, team_name 
               FROM league_teams 
               WHERE league_id = :league_id::uuid AND is_active = true""",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        owner_count = 0
        if owners and owners.get('records'):
            for record in owners['records']:
                if record[0] and not record[0].get('isNull'):
                    owner_id = record[0].get('stringValue')
                    message_content = f"[{notification.notification_type.upper()}] {notification.subject}: {notification.message}"
                    
                    # Insert into shared database
                    execute_sql(
                        """INSERT INTO league_messages 
                           (league_id, user_id, message_text, created_at)
                           VALUES (:league_id::uuid, :user_id, :message, NOW())""",
                        {
                            'league_id': league_id,
                            'user_id': owner_id,
                            'message': message_content
                        },
                        database_name='leagues'  # SHARED DATABASE
                    )
                    owner_count += 1
        
        return {
            "success": True,
            "message": f"Notification sent to {owner_count} owners",
            "owners_notified": owner_count,
            "notification_type": notification.notification_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending notifications: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/log-transaction")
async def log_transaction(
    league_id: str,
    transaction: TransactionLog,
    current_user: dict = Depends(get_current_user)
):
    """Log a PLAYER transaction to the league history"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Get current league status from shared database
        result = execute_sql(
            "SELECT setting_value FROM league_settings WHERE league_id = :league_id::uuid AND setting_name = 'league_status'",
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        current_status = 'setup'
        if result and result.get('records') and result['records'][0][0]:
            current_status = result['records'][0][0].get('stringValue', 'setup')
        
        # Check if transaction type is allowed in current status
        allowed_transactions = TRANSACTION_PERMISSIONS.get(current_status, [])
        if transaction.transaction_type not in allowed_transactions:
            raise HTTPException(
                status_code=403, 
                detail=f"Transaction type '{transaction.transaction_type}' not allowed in status '{current_status}'"
            )
        
        # Log the player transaction properly (this would normally insert into a transactions table)
        # For now, just log it
        logger.info(f"Player transaction logged: {transaction.transaction_type} by {user_id} for league {league_id}")
        
        return {
            "success": True,
            "message": f"Transaction logged: {transaction.transaction_type}",
            "league_status": current_status,
            "transaction_type": transaction.transaction_type,
            "player_id": transaction.player_id,
            "team_id": transaction.team_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging transaction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))