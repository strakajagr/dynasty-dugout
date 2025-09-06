"""
Dynasty Dugout - Roster Management Module
Enhanced with Commissioner Mode and Team Browsing Support
All roster management related endpoints
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

def verify_commissioner_access(league_id: str, user_id: str) -> bool:
    """Verify if user is a commissioner in this league"""
    try:
        result = execute_sql(
            """SELECT is_commissioner FROM league_teams 
               WHERE league_id = :league_id::uuid AND user_id = :user_id""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'
        )
        
        if result and result.get("records"):
            return result["records"][0][0].get("booleanValue", False)
        return False
    except:
        return False

def get_team_id_for_commissioner_action(league_id: str, user_id: str, target_team_id: str = None) -> str:
    """Get the target team ID for commissioner actions"""
    if target_team_id:
        # Verify target team exists in league
        team_check = execute_sql(
            """SELECT team_id FROM league_teams 
               WHERE league_id = :league_id::uuid AND team_id = :team_id::uuid""",
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
               WHERE league_id = :league_id::uuid AND league_player_id = :league_player_id::uuid""",
            parameters={'league_id': league_id, 'league_player_id': request.league_player_id},
            database_name='leagues'
        )
        
        if not availability_check or not availability_check.get("records"):
            raise HTTPException(status_code=404, detail="Player not found in league")
        
        availability_status = availability_check["records"][0][0]["stringValue"]
        mlb_player_id = int(availability_check["records"][0][1]["longValue"])
        
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
            WHERE league_id = :league_id::uuid AND league_player_id = :league_player_id::uuid
            """,
            parameters={
                'league_id': league_id,
                'team_id': team_id,
                'roster_status': request.roster_status,
                'roster_position': request.roster_position,  # NOW INCLUDED
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
            first_name = player_info["records"][0][0]["stringValue"]
            last_name = player_info["records"][0][1]["stringValue"]
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
            "roster_position": request.roster_position,  # Include in response
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
               WHERE league_id = :league_id::uuid AND league_player_id = :league_player_id::uuid""",
            parameters={'league_id': league_id, 'league_player_id': request.league_player_id},
            database_name='leagues'
        )
        
        if not ownership_check or not ownership_check.get("records"):
            raise HTTPException(status_code=404, detail="Player not found")
        
        player_team_id = ownership_check["records"][0][0]["stringValue"]
        mlb_player_id = int(ownership_check["records"][0][1]["longValue"])
        
        if not is_commissioner_action and player_team_id != team_id:
            raise HTTPException(status_code=403, detail="Player does not belong to your team")
        
        if is_commissioner_action and player_team_id != team_id:
            raise HTTPException(status_code=400, detail="Player does not belong to the specified team")
        
        # End roster status history
        today = date.today()
        execute_sql(
            """UPDATE roster_status_history 
               SET end_date = :today 
               WHERE league_id = :league_id::uuid 
                 AND league_player_id = :player_id::uuid 
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
            WHERE league_id = :league_id::uuid AND league_player_id = :league_player_id::uuid
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
            first_name = player_info["records"][0][0]["stringValue"]
            last_name = player_info["records"][0][1]["stringValue"]
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
               WHERE league_id = :league_id::uuid AND league_player_id = :player_id::uuid""",
            {'league_id': league_id, 'player_id': request.league_player_id},
            database_name='leagues'
        )
        
        if not ownership or ownership['records'][0][0]['stringValue'] != team_id:
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
               WHERE league_id = :league_id::uuid AND league_player_id = :player_id::uuid""",
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

@router.get("/my-roster")
async def get_my_roster(
    league_id: str,
    current_user: dict = Depends(get_current_user),
    target_team_id: Optional[str] = Query(None),
    commissioner_action: Optional[bool] = Query(False)
):
    """Get roster with commissioner mode support"""
    try:
        current_season = CURRENT_SEASON
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Handle commissioner mode
        if commissioner_action and target_team_id:
            if not verify_commissioner_access(league_id, user_id):
                raise HTTPException(status_code=403, detail="Commissioner access required")
            team_id = target_team_id
        else:
            team_id = get_user_team_id(league_id, user_id)
            if not team_id:
                return {
                    "success": True,
                    "team_id": None,
                    "team_name": "No Team",
                    "players": [],
                    "total_salary": 0.0,
                    "roster_spots": {
                        "active": 0,
                        "bench": 0,
                        "injured": 0,
                        "total": 0
                    },
                    "season": current_season
                }
        
        # Get team info from shared database
        team_info = execute_sql(
            """SELECT team_name, manager_name FROM league_teams 
               WHERE league_id = :league_id::uuid AND team_id = :team_id::uuid""",
            parameters={'league_id': league_id, 'team_id': team_id},
            database_name='leagues'
        )
        
        team_name = "Team"
        if team_info and team_info.get("records"):
            team_name = team_info["records"][0][0]["stringValue"]
        
        # Get roster from shared database with CACHED season stats
        league_roster_query = f"""
        SELECT
            lp.league_player_id,
            lp.mlb_player_id,
            lp.roster_status,
            lp.roster_position,
            lp.salary,
            lp.contract_years,
            lp.acquisition_date,
            lp.acquisition_method,
            COALESCE(pss.batting_avg, 0.0) as batting_avg,
            COALESCE(pss.home_runs, 0) as home_runs,
            COALESCE(pss.rbi, 0) as rbi,
            COALESCE(pss.era, 0.0) as era,
            COALESCE(pss.wins, 0) as wins,
            COALESCE(pss.saves, 0) as saves,
            COALESCE(pss.strikeouts_pitched, 0) as strikeouts_pitched,
            COALESCE(pss.innings_pitched, 0.0) as innings_pitched
        FROM league_players lp
        LEFT JOIN player_season_stats pss ON lp.mlb_player_id = pss.player_id
            AND pss.season = {current_season}
            AND pss.league_id = :league_id::uuid
        WHERE lp.league_id = :league_id::uuid AND lp.team_id = :team_id::uuid
        ORDER BY lp.mlb_player_id
        """
        
        league_result = execute_sql(
            league_roster_query,
            parameters={'league_id': league_id, 'team_id': team_id},
            database_name='leagues'
        )
        
        if not league_result or not league_result.get("records"):
            return {
                "success": True,
                "team_id": team_id,
                "team_name": team_name,
                "players": [],
                "total_salary": 0.0,
                "roster_spots": {
                    "active": 0,
                    "bench": 0,
                    "injured": 0,
                    "total": 0
                },
                "season": current_season
            }
        
        # Extract MLB player IDs and create league data lookup
        player_ids = []
        league_roster_lookup = {}
        
        for record in league_result["records"]:
            mlb_player_id = get_value_from_field(record[1], 'long')
            player_ids.append(mlb_player_id)
            
            league_roster_lookup[mlb_player_id] = {
                "league_player_id": get_value_from_field(record[0], 'string'),
                "roster_status": get_value_from_field(record[2], 'string') or "active",
                "roster_position": get_value_from_field(record[3], 'string'),  # NOW INCLUDED
                "salary": get_value_from_field(record[4], 'decimal'),
                "contract_years": get_value_from_field(record[5], 'long'),
                "acquisition_date": get_value_from_field(record[6], 'string'),
                "acquisition_method": get_value_from_field(record[7], 'string'),
                "batting_avg": get_value_from_field(record[8], 'decimal'),
                "home_runs": get_value_from_field(record[9], 'long'),
                "rbi": get_value_from_field(record[10], 'long'),
                "era": get_value_from_field(record[11], 'decimal'),
                "wins": get_value_from_field(record[12], 'long'),
                "saves": get_value_from_field(record[13], 'long'),
                "strikeouts_pitched": get_value_from_field(record[14], 'long'),
                "innings_pitched": get_value_from_field(record[15], 'decimal')
            }
        
        # Get MLB player info from main database
        player_ids_str = ','.join(map(str, player_ids))
        
        mlb_roster_query = f"""
            SELECT
                player_id,
                first_name,
                last_name,
                position,
                mlb_team,
                jersey_number
            FROM mlb_players
            WHERE player_id IN ({player_ids_str})
            ORDER BY position, last_name, first_name
        """
        
        mlb_result = execute_sql(
            mlb_roster_query,
            parameters={},
            database_name="postgres"
        )
        
        # Format roster data
        players = []
        total_salary = 0.0
        roster_spots = {"active": 0, "bench": 0, "injured": 0, "minors": 0}
        
        if mlb_result and mlb_result.get("records"):
            for record in mlb_result["records"]:
                mlb_player_id = get_value_from_field(record[0], 'long')
                league_data = league_roster_lookup.get(mlb_player_id, {})
                
                player = {
                    "league_player_id": league_data.get("league_player_id", ""),
                    "mlb_player_id": mlb_player_id,
                    "first_name": get_value_from_field(record[1], 'string'),
                    "last_name": get_value_from_field(record[2], 'string'),
                    "position": get_value_from_field(record[3], 'string'),
                    "mlb_team": get_value_from_field(record[4], 'string') or "FA",
                    "jersey_number": get_value_from_field(record[5], 'string'),
                    **league_data
                }
                players.append(player)
                total_salary += player["salary"]
                
                # Count roster spots
                status = player["roster_status"]
                if status in roster_spots:
                    roster_spots[status] += 1
        
        roster_spots["total"] = sum(roster_spots.values())
        
        return {
            "success": True,
            "team_id": team_id,
            "team_name": team_name,
            "players": players,
            "total_salary": round(total_salary, 2),
            "roster_spots": roster_spots,
            "season": current_season,
            "data_source": "leagues_db_cached",
            "commissioner_view": commissioner_action and target_team_id
        }
        
    except Exception as e:
        logger.error(f"Error getting roster: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting roster: {str(e)}")

@router.get("/teams/{team_id}/roster")
async def get_team_roster(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get any team's roster (read-only for non-owners)"""
    try:
        current_season = CURRENT_SEASON
        user_id = current_user.get('sub')
        
        # Verify team exists in league
        team_info = execute_sql(
            """SELECT team_name, manager_name, user_id FROM league_teams 
               WHERE league_id = :league_id::uuid AND team_id = :team_id::uuid""",
            parameters={'league_id': league_id, 'team_id': team_id},
            database_name='leagues'
        )
        
        if not team_info or not team_info.get("records"):
            raise HTTPException(status_code=404, detail="Team not found in this league")
        
        team_record = team_info["records"][0]
        team_name = get_value_from_field(team_record[0], 'string')
        manager_name = get_value_from_field(team_record[1], 'string')
        team_user_id = get_value_from_field(team_record[2], 'string')
        
        # Check if user is viewing their own team
        is_own_team = user_id == team_user_id
        
        # Get roster from shared database with CACHED season stats
        league_roster_query = f"""
        SELECT
            lp.league_player_id,
            lp.mlb_player_id,
            lp.roster_status,
            lp.roster_position,
            lp.salary,
            lp.contract_years,
            lp.acquisition_date,
            lp.acquisition_method,
            COALESCE(pss.batting_avg, 0.0) as batting_avg,
            COALESCE(pss.home_runs, 0) as home_runs,
            COALESCE(pss.rbi, 0) as rbi,
            COALESCE(pss.runs, 0) as runs,
            COALESCE(pss.stolen_bases, 0) as stolen_bases,
            COALESCE(pss.era, 0.0) as era,
            COALESCE(pss.wins, 0) as wins,
            COALESCE(pss.saves, 0) as saves,
            COALESCE(pss.strikeouts_pitched, 0) as strikeouts_pitched,
            COALESCE(pss.innings_pitched, 0.0) as innings_pitched
        FROM league_players lp
        LEFT JOIN player_season_stats pss ON lp.mlb_player_id = pss.player_id
            AND pss.season = {current_season}
            AND pss.league_id = :league_id::uuid
        WHERE lp.league_id = :league_id::uuid AND lp.team_id = :team_id::uuid
        ORDER BY lp.mlb_player_id
        """
        
        league_result = execute_sql(
            league_roster_query,
            parameters={'league_id': league_id, 'team_id': team_id},
            database_name='leagues'
        )
        
        if not league_result or not league_result.get("records"):
            return {
                "success": True,
                "team_id": team_id,
                "team_name": team_name,
                "manager_name": manager_name,
                "players": [],
                "total_salary": 0.0,
                "roster_spots": {
                    "active": 0,
                    "bench": 0,
                    "injured": 0,
                    "total": 0
                },
                "season": current_season,
                "is_own_team": is_own_team
            }
        
        # Extract MLB player IDs and create league data lookup
        player_ids = []
        league_roster_lookup = {}
        
        for record in league_result["records"]:
            mlb_player_id = get_value_from_field(record[1], 'long')
            player_ids.append(mlb_player_id)
            
            league_roster_lookup[mlb_player_id] = {
                "league_player_id": get_value_from_field(record[0], 'string'),
                "roster_status": get_value_from_field(record[2], 'string') or "active",
                "roster_position": get_value_from_field(record[3], 'string'),  # NOW INCLUDED
                "salary": get_value_from_field(record[4], 'decimal'),
                "contract_years": get_value_from_field(record[5], 'long'),
                "acquisition_date": get_value_from_field(record[6], 'string'),
                "acquisition_method": get_value_from_field(record[7], 'string'),
                "batting_avg": get_value_from_field(record[8], 'decimal'),
                "home_runs": get_value_from_field(record[9], 'long'),
                "rbi": get_value_from_field(record[10], 'long'),
                "runs": get_value_from_field(record[11], 'long'),
                "stolen_bases": get_value_from_field(record[12], 'long'),
                "era": get_value_from_field(record[13], 'decimal'),
                "wins": get_value_from_field(record[14], 'long'),
                "saves": get_value_from_field(record[15], 'long'),
                "strikeouts_pitched": get_value_from_field(record[16], 'long'),
                "innings_pitched": get_value_from_field(record[17], 'decimal')
            }
        
        # Get MLB player info from main database
        if player_ids:
            player_ids_str = ','.join(map(str, player_ids))
            
            mlb_roster_query = f"""
                SELECT
                    player_id,
                    first_name,
                    last_name,
                    position,
                    mlb_team,
                    jersey_number
                FROM mlb_players
                WHERE player_id IN ({player_ids_str})
                ORDER BY position, last_name, first_name
            """
            
            mlb_result = execute_sql(
                mlb_roster_query,
                parameters={},
                database_name="postgres"
            )
            
            # Format roster data
            players = []
            total_salary = 0.0
            roster_spots = {"active": 0, "bench": 0, "injured": 0, "minors": 0}
            
            if mlb_result and mlb_result.get("records"):
                for record in mlb_result["records"]:
                    mlb_player_id = get_value_from_field(record[0], 'long')
                    league_data = league_roster_lookup.get(mlb_player_id, {})
                    
                    player = {
                        "league_player_id": league_data.get("league_player_id", ""),
                        "mlb_player_id": mlb_player_id,
                        "first_name": get_value_from_field(record[1], 'string'),
                        "last_name": get_value_from_field(record[2], 'string'),
                        "position": get_value_from_field(record[3], 'string'),
                        "mlb_team": get_value_from_field(record[4], 'string') or "FA",
                        "jersey_number": get_value_from_field(record[5], 'string'),
                        **league_data
                    }
                    players.append(player)
                    total_salary += player["salary"]
                    
                    # Count roster spots
                    status = player["roster_status"]
                    if status in roster_spots:
                        roster_spots[status] += 1
            
            roster_spots["total"] = sum(roster_spots.values())
        else:
            players = []
            total_salary = 0.0
            roster_spots = {"active": 0, "bench": 0, "injured": 0, "minors": 0, "total": 0}
        
        return {
            "success": True,
            "team_id": team_id,
            "team_name": team_name,
            "manager_name": manager_name,
            "players": players,
            "total_salary": round(total_salary, 2),
            "roster_spots": roster_spots,
            "season": current_season,
            "is_own_team": is_own_team,
            "data_source": "leagues_db_cached"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting team roster: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting team roster: {str(e)}")

@router.get("/my-roster-enhanced")
async def get_my_roster_with_accrued(
    league_id: str,
    current_user: dict = Depends(get_current_user),
    target_team_id: Optional[str] = Query(None),
    commissioner_action: Optional[bool] = Query(False)
):
    """
    Enhanced roster with 3-row display (supports commissioner mode)
    Row 1: Season stats (from CACHED leagues DB)
    Row 2: Last 14 days rolling stats (from leagues DB)
    Row 3: Accrued while ACTIVE on roster (from leagues DB)
    """
    try:
        # Get basic roster first (with commissioner support)
        basic_result = await get_my_roster(league_id, current_user, target_team_id, commissioner_action)
        
        if not basic_result.get("success") or not basic_result.get("players"):
            return basic_result
        
        players = basic_result["players"]
        team_id = basic_result["team_id"]
        
        # Get player IDs
        player_ids = [p['mlb_player_id'] for p in players]
        
        if player_ids:
            # 1. Get rolling stats from LEAGUES DB
            placeholders = ','.join([f':id_{i}' for i in range(len(player_ids))])
            parameters = {f'id_{i}': pid for i, pid in enumerate(player_ids)}
            parameters['league_id'] = league_id
            
            rolling_result = execute_sql(
                f"""SELECT player_id, games_played, batting_avg, home_runs, rbi, 
                           runs, stolen_bases, era, wins, saves
                    FROM player_rolling_stats
                    WHERE player_id IN ({placeholders})
                      AND period = 'last_14_days'
                      AND as_of_date = CURRENT_DATE
                      AND league_id = :league_id::uuid""",
                parameters=parameters,
                database_name='leagues'
            )
            
            rolling_lookup = {}
            if rolling_result and rolling_result.get('records'):
                for record in rolling_result['records']:
                    player_id = get_value_from_field(record[0], 'long')
                    rolling_lookup[player_id] = {
                        'games': get_value_from_field(record[1], 'long'),
                        'batting_avg': get_value_from_field(record[2], 'decimal'),
                        'home_runs': get_value_from_field(record[3], 'long'),
                        'rbi': get_value_from_field(record[4], 'long'),
                        'runs': get_value_from_field(record[5], 'long'),
                        'stolen_bases': get_value_from_field(record[6], 'long'),
                        'era': get_value_from_field(record[7], 'decimal'),
                        'wins': get_value_from_field(record[8], 'long'),
                        'saves': get_value_from_field(record[9], 'long')
                    }
            
            # 2. Get ACTIVE accrued stats from shared leagues DB
            parameters['team_id'] = team_id
            
            accrued_result = execute_sql(
                f"""SELECT mlb_player_id, total_active_days, active_games_played,
                           active_batting_avg, active_home_runs, active_rbi, active_runs,
                           active_stolen_bases, active_era, active_wins, active_saves,
                           first_active_date, last_active_date
                    FROM player_active_accrued_stats
                    WHERE league_id = :league_id::uuid
                      AND mlb_player_id IN ({placeholders})
                      AND team_id = :team_id::uuid""",
                parameters=parameters,
                database_name='leagues'
            )
            
            accrued_lookup = {}
            if accrued_result and accrued_result.get('records'):
                for record in accrued_result['records']:
                    player_id = get_value_from_field(record[0], 'long')
                    accrued_lookup[player_id] = {
                        'active_days': get_value_from_field(record[1], 'long'),
                        'games': get_value_from_field(record[2], 'long'),
                        'batting_avg': get_value_from_field(record[3], 'decimal'),
                        'home_runs': get_value_from_field(record[4], 'long'),
                        'rbi': get_value_from_field(record[5], 'long'),
                        'runs': get_value_from_field(record[6], 'long'),
                        'stolen_bases': get_value_from_field(record[7], 'long'),
                        'era': get_value_from_field(record[8], 'decimal'),
                        'wins': get_value_from_field(record[9], 'long'),
                        'saves': get_value_from_field(record[10], 'long'),
                        'first_active': get_value_from_field(record[11], 'string'),
                        'last_active': get_value_from_field(record[12], 'string')
                    }
            
            # Add all three rows to each player
            for player in players:
                player_id = player['mlb_player_id']
                
                # Row 1: Season stats (already in player object)
                player['season_stats'] = {
                    'batting_avg': player.get('batting_avg', 0.000),
                    'home_runs': player.get('home_runs', 0),
                    'rbi': player.get('rbi', 0),
                    'runs': player.get('runs', 0),
                    'stolen_bases': player.get('stolen_bases', 0),
                    'era': player.get('era', 0.00),
                    'wins': player.get('wins', 0),
                    'saves': player.get('saves', 0)
                }
                
                # Row 2: Last 14 days
                player['last_14_days'] = rolling_lookup.get(player_id, {})
                
                # Row 3: Accrued while active
                player['active_accrued'] = accrued_lookup.get(player_id, {})
        
        return {
            **basic_result,
            "display_rows": ["Season Stats", "Last 14 Days", "Active on Roster"],
            "data_sources": {
                "season": "leagues_db_cached",
                "rolling": "leagues_db_cached",
                "accrued": "leagues_db"
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting enhanced roster: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/teams/{team_id}/roster-enhanced")
async def get_team_roster_enhanced(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get enhanced team roster with rolling stats (read-only for non-owners)"""
    try:
        # Get basic roster first - FIXED SYNTAX ERROR HERE
        basic_result = await get_team_roster(league_id, team_id, current_user)
        
        if not basic_result.get("success") or not basic_result.get("players"):
            return basic_result
        
        players = basic_result["players"]
        
        # Get player IDs
        player_ids = [p['mlb_player_id'] for p in players]
        
        if player_ids:
            # Get rolling stats from LEAGUES DB
            placeholders = ','.join([f':id_{i}' for i in range(len(player_ids))])
            parameters = {f'id_{i}': pid for i, pid in enumerate(player_ids)}
            parameters['league_id'] = league_id
            
            rolling_result = execute_sql(
                f"""SELECT player_id, games_played, batting_avg, home_runs, rbi, 
                           runs, stolen_bases, era, wins, saves
                    FROM player_rolling_stats
                    WHERE player_id IN ({placeholders})
                      AND period = 'last_14_days'
                      AND as_of_date = CURRENT_DATE
                      AND league_id = :league_id::uuid""",
                parameters=parameters,
                database_name='leagues'
            )
            
            rolling_lookup = {}
            if rolling_result and rolling_result.get('records'):
                for record in rolling_result['records']:
                    player_id = get_value_from_field(record[0], 'long')
                    rolling_lookup[player_id] = {
                        'games': get_value_from_field(record[1], 'long'),
                        'batting_avg': get_value_from_field(record[2], 'decimal'),
                        'home_runs': get_value_from_field(record[3], 'long'),
                        'rbi': get_value_from_field(record[4], 'long'),
                        'runs': get_value_from_field(record[5], 'long'),
                        'stolen_bases': get_value_from_field(record[6], 'long'),
                        'era': get_value_from_field(record[7], 'decimal'),
                        'wins': get_value_from_field(record[8], 'long'),
                        'saves': get_value_from_field(record[9], 'long')
                    }
            
            # Add stats to each player
            for player in players:
                player_id = player['mlb_player_id']
                
                # Season stats (already in player object)
                player['season_stats'] = {
                    'batting_avg': player.get('batting_avg', 0.000),
                    'home_runs': player.get('home_runs', 0),
                    'rbi': player.get('rbi', 0),
                    'runs': player.get('runs', 0),
                    'stolen_bases': player.get('stolen_bases', 0),
                    'era': player.get('era', 0.00),
                    'wins': player.get('wins', 0),
                    'saves': player.get('saves', 0)
                }
                
                # Last 14 days
                player['last_14_days'] = rolling_lookup.get(player_id, {})
        
        return {
            **basic_result,
            "display_rows": ["Season Stats", "Last 14 Days"],
            "data_sources": {
                "season": "leagues_db_cached",
                "rolling": "leagues_db_cached"
            },
            "note": "Accrued stats only available for own team"
        }
        
    except Exception as e:
        logger.error(f"Error getting enhanced team roster: {e}")
        raise HTTPException(status_code=500, detail=str(e))