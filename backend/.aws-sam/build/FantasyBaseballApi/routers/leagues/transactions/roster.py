"""
Dynasty Dugout - Roster Management Module FIXED
Enhanced with Commissioner Mode and Team Browsing Support
FIXED: Added height/weight/birthdate fields and corrected rolling stats DB
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, date, timedelta
from core.auth_utils import get_current_user
from core.database import execute_sql
from core.season_utils import CURRENT_SEASON
from .models import AddPlayerRequest, DropPlayerRequest, RosterMoveRequest
from .helpers import get_user_team_id, log_transaction, record_roster_status_change, get_value_from_field
import uuid
import logging
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

def safe_float(value, default=0.0):
    """Safely convert to float, return default if None or conversion fails"""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value, default=0):
    """Safely convert to int, return default if None or conversion fails"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def verify_commissioner_access(league_id: str, user_id: str) -> bool:
    """Verify if user is a commissioner in this league"""
    try:
        result = execute_sql(
            """SELECT is_commissioner FROM league_teams 
               WHERE league_id::text = :league_id AND user_id = :user_id""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'
        )
        
        if result and result.get("records"):
            return result["records"][0].get("is_commissioner", False)
        return False
    except:
        return False

def get_team_id_for_commissioner_action(league_id: str, user_id: str, target_team_id: str = None) -> str:
    """Get the target team ID for commissioner actions"""
    if target_team_id:
        # Verify target team exists in league
        team_check = execute_sql(
            """SELECT team_id FROM league_teams 
               WHERE league_id::text = :league_id AND team_id::text = :team_id""",
            parameters={'league_id': league_id, 'team_id': target_team_id},
            database_name='leagues'
        )
        if team_check and team_check.get("records"):
            return target_team_id
        else:
            raise HTTPException(status_code=404, detail="Target team not found")
    else:
        # Default to user's own team
        return get_user_team_id(league_id, user_id)

@router.post("/add-player")
async def add_player_to_team(
    league_id: str,
    request: AddPlayerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a free agent player to team (supports commissioner mode)"""
    try:
        user_id = current_user.get('sub')
        logger.info(f"extracted user_id: {user_id}")
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Check for commissioner action
        is_commissioner_action = getattr(request, 'commissioner_action', False)
        target_team_id = getattr(request, 'target_team_id', None)
        
        if is_commissioner_action:
            if not verify_commissioner_access(league_id, user_id):
                raise HTTPException(status_code=403, detail="Commissioner access required")
            team_id = get_team_id_for_commissioner_action(league_id, user_id, target_team_id)
        else:
            team_id = get_user_team_id(league_id, user_id)
            if not team_id:
                raise HTTPException(status_code=404, detail="User team not found in this league")
        
        # Check if player is available as free agent
        availability_check = execute_sql(
            """SELECT availability_status, mlb_player_id FROM league_players 
               WHERE league_id::text = :league_id AND league_player_id::text = :league_player_id""",
            parameters={'league_id': league_id, 'league_player_id': request.league_player_id},
            database_name='leagues'
        )
        
        if not availability_check or not availability_check.get("records"):
            raise HTTPException(status_code=404, detail="Player not found in league")
        
        availability_status = availability_check["records"][0].get("availability_status")
        mlb_player_id = availability_check["records"][0].get("mlb_player_id")
        
        if availability_status != 'free_agent':
            raise HTTPException(status_code=400, detail="Player is not available as a free agent")
        
        # Add player to team - NOW INCLUDING roster_position
        execute_sql(
            """
            UPDATE league_players
            SET team_id = :team_id::uuid,
                availability_status = 'owned',
                roster_status = :roster_status,
                roster_position = :roster_position,
                salary = :salary,
                contract_years = :contract_years,
                acquisition_date = :acquisition_date::timestamp,
                acquisition_method = :acquisition_method
            WHERE league_id::text = :league_id AND league_player_id::text = :league_player_id
            """,
            parameters={
                'league_id': league_id,
                'team_id': team_id,
                'roster_status': request.roster_status,
                'roster_position': request.roster_position,
                'salary': request.salary,
                'contract_years': request.contract_years,
                'acquisition_date': datetime.now(timezone.utc).isoformat(),
                'acquisition_method': 'commissioner_add' if is_commissioner_action else 'free_agent',
                'league_player_id': request.league_player_id
            },
            database_name='leagues'
        )
        
        # Record initial roster status
        record_roster_status_change(
            league_id, request.league_player_id, team_id, 
            request.roster_status, user_id, 
            "Commissioner added from free agency" if is_commissioner_action else "Added from free agency"
        )
        
        # Log the transaction
        transaction_data = {
            'transaction_id': str(uuid.uuid4()),
            'league_player_id': request.league_player_id,
            'from_team_id': None,
            'to_team_id': team_id,
            'transaction_type': 'add',
            'salary': request.salary,
            'contract_years': request.contract_years,
            'transaction_date': datetime.now(timezone.utc).isoformat(),
            'notes': f"{'Commissioner action: ' if is_commissioner_action else ''}Added from free agency - ${request.salary}M for {request.contract_years} years"
        }
        log_transaction(league_id, transaction_data)
        
        # Get player name for response
        player_info = execute_sql(
            "SELECT first_name, last_name FROM mlb_players WHERE player_id = :mlb_player_id",
            parameters={'mlb_player_id': mlb_player_id},
            database_name="postgres"
        )
        
        player_name = "Unknown Player"
        if player_info and player_info.get("records"):
            first_name = player_info["records"][0].get("first_name")
            last_name = player_info["records"][0].get("last_name")
            player_name = f"{first_name} {last_name}"
        
        return {
            "success": True,
            "message": f"{player_name} added to team successfully",
            "league_player_id": request.league_player_id,
            "transaction_id": transaction_data['transaction_id'],
            "player_name": player_name,
            "salary": request.salary,
            "contract_years": request.contract_years,
            "roster_status": request.roster_status,
            "roster_position": request.roster_position,
            "commissioner_action": is_commissioner_action
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding player: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error adding player: {str(e)}")

@router.post("/drop-player")
async def drop_player_from_team(
    league_id: str,
    request: DropPlayerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Drop a player from team (supports commissioner mode)"""
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Check for commissioner action
        is_commissioner_action = getattr(request, 'commissioner_action', False)
        target_team_id = getattr(request, 'target_team_id', None)
        
        if is_commissioner_action:
            if not verify_commissioner_access(league_id, user_id):
                raise HTTPException(status_code=403, detail="Commissioner access required")
            team_id = get_team_id_for_commissioner_action(league_id, user_id, target_team_id)
        else:
            team_id = get_user_team_id(league_id, user_id)
            if not team_id:
                raise HTTPException(status_code=404, detail="User team not found in this league")
        
        # Verify player belongs to the target team
        ownership_check = execute_sql(
            """SELECT team_id, mlb_player_id FROM league_players 
               WHERE league_id::text = :league_id AND league_player_id::text = :league_player_id""",
            parameters={'league_id': league_id, 'league_player_id': request.league_player_id},
            database_name='leagues'
        )
        
        if not ownership_check or not ownership_check.get("records"):
            raise HTTPException(status_code=404, detail="Player not found")
        
        player_team_id = ownership_check["records"][0].get("team_id")
        mlb_player_id = ownership_check["records"][0].get("mlb_player_id")
        
        if not is_commissioner_action and player_team_id != team_id:
            raise HTTPException(status_code=403, detail="Player does not belong to your team")
        
        if is_commissioner_action and player_team_id != team_id:
            raise HTTPException(status_code=400, detail="Player does not belong to the specified team")
        
        # End roster status history
        today = date.today()
        execute_sql(
            """UPDATE roster_status_history 
               SET end_date = :today 
               WHERE league_id::text = :league_id 
                 AND league_player_id::text = :player_id 
                 AND end_date IS NULL""",
            {'league_id': league_id, 'player_id': request.league_player_id, 'today': today},
            database_name='leagues'
        )
        
        # Drop player (release to free agency) - ALSO clear roster_position
        execute_sql(
            """
            UPDATE league_players
            SET team_id = NULL,
                availability_status = 'free_agent',
                roster_status = NULL,
                roster_position = NULL,
                acquisition_date = NULL,
                acquisition_method = NULL
            WHERE league_id::text = :league_id AND league_player_id::text = :league_player_id
            """,
            parameters={'league_id': league_id, 'league_player_id': request.league_player_id},
            database_name='leagues'
        )
        
        # Log the transaction
        transaction_data = {
            'transaction_id': str(uuid.uuid4()),
            'league_player_id': request.league_player_id,
            'from_team_id': team_id,
            'to_team_id': None,
            'transaction_type': 'drop',
            'salary': None,
            'contract_years': None,
            'transaction_date': datetime.now(timezone.utc).isoformat(),
            'notes': f"{'Commissioner action: ' if is_commissioner_action else ''}Released to free agency"
        }
        log_transaction(league_id, transaction_data)
        
        # Get player name for response
        player_info = execute_sql(
            "SELECT first_name, last_name FROM mlb_players WHERE player_id = :mlb_player_id",
            parameters={'mlb_player_id': mlb_player_id},
            database_name="postgres"
        )
        
        player_name = "Unknown Player"
        if player_info and player_info.get("records"):
            first_name = player_info["records"][0].get("first_name")
            last_name = player_info["records"][0].get("last_name")
            player_name = f"{first_name} {last_name}"
        
        return {
            "success": True,
            "message": f"{player_name} dropped successfully",
            "transaction_id": transaction_data['transaction_id'],
            "player_name": player_name,
            "commissioner_action": is_commissioner_action
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dropping player: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error dropping player: {str(e)}")

@router.post("/roster-move")
async def move_player_roster_status(
    league_id: str,
    request: RosterMoveRequest,
    current_user: dict = Depends(get_current_user)
):
    """Move player between active/bench/injured/minors"""
    try:
        user_id = current_user.get('sub')
        team_id = get_user_team_id(league_id, user_id)
        
        if not team_id:
            raise HTTPException(status_code=404, detail="Team not found")
        
        # Verify player belongs to team
        ownership = execute_sql(
            """SELECT team_id FROM league_players 
               WHERE league_id::text = :league_id AND league_player_id::text = :player_id""",
            {'league_id': league_id, 'player_id': request.league_player_id},
            database_name='leagues'
        )
        
        if not ownership or ownership['records'][0].get('team_id') != team_id:
            raise HTTPException(status_code=403, detail="Player not on your team")
        
        # Record the roster status change
        record_roster_status_change(
            league_id, request.league_player_id, team_id,
            request.new_status, user_id, request.reason
        )
        
        # Update current status in league_players
        execute_sql(
            """UPDATE league_players 
               SET roster_status = :status 
               WHERE league_id::text = :league_id AND league_player_id::text = :player_id""",
            {'league_id': league_id, 'player_id': request.league_player_id, 'status': request.new_status},
            database_name='leagues'
        )
        
        return {
            "success": True,
            "message": f"Player moved to {request.new_status}",
            "effective_date": str(date.today())
        }
        
    except Exception as e:
        logger.error(f"Error moving player: {e}")
        raise HTTPException(status_code=500, detail=str(e))



