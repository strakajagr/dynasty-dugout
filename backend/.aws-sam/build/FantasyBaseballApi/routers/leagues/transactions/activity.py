"""
Dynasty Dugout - Transaction Activity Module  
Transaction history and league activity endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from core.auth_utils import get_current_user
from core.database import execute_sql
from core.season_utils import CURRENT_SEASON
from .helpers import get_value_from_field
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/transactions")
async def get_transaction_history(
    league_id: str,
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    days_back: int = Query(30, description="Number of days to look back"),
    limit: int = Query(50, description="Number of results to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get transaction history for league"""
    try:
        # Build WHERE clause
        where_conditions = [
            f"lt.league_id = :league_id::uuid",
            f"lt.transaction_date >= (CURRENT_DATE - INTERVAL '{days_back} days')"
        ]
        parameters = {'league_id': league_id, 'limit': limit}
        
        if transaction_type:
            where_conditions.append("lt.transaction_type = :transaction_type")
            parameters['transaction_type'] = transaction_type
        
        where_clause = " AND ".join(where_conditions)
        
        query = f"""
        SELECT
            lt.transaction_id,
            lt.transaction_type,
            lt.transaction_date,
            lt.salary,
            lt.contract_years,
            lt.notes,
            lp.mlb_player_id,
            from_team.team_name as from_team_name,
            to_team.team_name as to_team_name
        FROM league_transactions lt
        JOIN league_players lp ON lt.league_player_id = lp.league_player_id AND lt.league_id = lp.league_id
        LEFT JOIN league_teams from_team ON lt.from_team_id = from_team.team_id AND lt.league_id = from_team.league_id
        LEFT JOIN league_teams to_team ON lt.to_team_id = to_team.team_id AND lt.league_id = to_team.league_id
        WHERE {where_clause}
        ORDER BY lt.transaction_date DESC
        LIMIT :limit
        """
        
        result = execute_sql(
            query,
            parameters=parameters,
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Get all MLB player IDs from transactions
        mlb_player_ids = []
        if result and result.get("records"):
            for record in result["records"]:
                mlb_player_id = get_value_from_field(record[6], 'long')
                if mlb_player_id not in mlb_player_ids:
                    mlb_player_ids.append(mlb_player_id)
        
        # Get player names from main database
        player_names = {}
        if mlb_player_ids:
            player_ids_str = ','.join(map(str, mlb_player_ids))
            name_query = f"""
                SELECT player_id, first_name, last_name, position
                FROM mlb_players
                WHERE player_id IN ({player_ids_str})
            """
            
            name_result = execute_sql(
                name_query,
                parameters={},
                database_name="postgres"
            )
            
            if name_result and name_result.get("records"):
                for record in name_result["records"]:
                    player_id = get_value_from_field(record[0], 'long')
                    first_name = get_value_from_field(record[1], 'string')
                    last_name = get_value_from_field(record[2], 'string')
                    position = get_value_from_field(record[3], 'string')
                    player_names[player_id] = {
                        "name": f"{first_name} {last_name}",
                        "position": position
                    }
        
        # Format transaction data
        transactions = []
        if result and result.get("records"):
            for record in result["records"]:
                mlb_player_id = get_value_from_field(record[6], 'long')
                player_info = player_names.get(mlb_player_id, {"name": "Unknown Player", "position": ""})
                
                transaction = {
                    "transaction_id": get_value_from_field(record[0], 'string'),
                    "transaction_type": get_value_from_field(record[1], 'string'),
                    "transaction_date": get_value_from_field(record[2], 'string'),
                    "salary": get_value_from_field(record[3], 'decimal') if record[3] else None,
                    "contract_years": get_value_from_field(record[4], 'long') if record[4] else None,
                    "notes": get_value_from_field(record[5], 'string'),
                    "player_name": player_info["name"],
                    "position": player_info["position"],
                    "from_team": get_value_from_field(record[7], 'string') or "Free Agency",
                    "to_team": get_value_from_field(record[8], 'string') or "Free Agency"
                }
                transactions.append(transaction)
        
        return {
            "success": True,
            "transactions": transactions,
            "filters": {
                "transaction_type": transaction_type,
                "days_back": days_back
            },
            "season": CURRENT_SEASON
        }
        
    except Exception as e:
        logger.error(f"Error getting transaction history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting transaction history: {str(e)}")

@router.get("/recent-activity")
async def get_recent_league_activity(
    league_id: str,
    hours_back: int = Query(24, description="Hours to look back"),
    limit: int = Query(10, description="Max number of activities"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get recent league activity for ticker display.
    Returns formatted strings ready for ticker consumption.
    """
    try:
        # Get recent transactions with player and team info
        query = f"""
        SELECT
            lt.transaction_type,
            lt.transaction_date,
            lt.salary,
            lt.notes,
            lp.mlb_player_id,
            from_team.team_name as from_team_name,
            to_team.team_name as to_team_name,
            EXTRACT(EPOCH FROM (NOW() - lt.transaction_date))/60 as minutes_ago
        FROM league_transactions lt
        JOIN league_players lp ON lt.league_player_id = lp.league_player_id 
            AND lt.league_id = lp.league_id
        LEFT JOIN league_teams from_team ON lt.from_team_id = from_team.team_id 
            AND lt.league_id = from_team.league_id
        LEFT JOIN league_teams to_team ON lt.to_team_id = to_team.team_id 
            AND lt.league_id = to_team.league_id
        WHERE lt.league_id = :league_id::uuid
            AND lt.transaction_date >= NOW() - INTERVAL '{hours_back} hours'
        ORDER BY lt.transaction_date DESC
        LIMIT :limit
        """
        
        result = execute_sql(
            query,
            {'league_id': league_id, 'limit': limit},
            database_name='leagues'
        )
        
        if not result or not result.get("records"):
            return {"success": True, "activities": []}
        
        # Get player names
        player_ids = []
        for record in result["records"]:
            player_id = get_value_from_field(record[4], 'long')
            if player_id and player_id not in player_ids:
                player_ids.append(player_id)
        
        player_names = {}
        if player_ids:
            player_ids_str = ','.join(map(str, player_ids))
            name_result = execute_sql(
                f"SELECT player_id, first_name, last_name FROM mlb_players WHERE player_id IN ({player_ids_str})",
                database_name="postgres"
            )
            
            if name_result and name_result.get("records"):
                for record in name_result["records"]:
                    pid = get_value_from_field(record[0], 'long')
                    first = get_value_from_field(record[1], 'string')
                    last = get_value_from_field(record[2], 'string')
                    player_names[pid] = f"{first} {last}"
        
        # Format activities for ticker
        activities = []
        for idx, record in enumerate(result["records"]):
            transaction_type = get_value_from_field(record[0], 'string')
            player_id = get_value_from_field(record[4], 'long')
            from_team = get_value_from_field(record[5], 'string')
            to_team = get_value_from_field(record[6], 'string')
            minutes_ago = int(get_value_from_field(record[7], 'decimal') or 0)
            salary = get_value_from_field(record[2], 'decimal')
            
            player_name = player_names.get(player_id, "Unknown Player")
            
            # Format time
            if minutes_ago < 60:
                time_str = f"{minutes_ago}m ago"
            elif minutes_ago < 1440:
                time_str = f"{minutes_ago // 60}h ago"
            else:
                time_str = f"{minutes_ago // 1440}d ago"
            
            # Format message based on transaction type
            if transaction_type == 'add':
                text = f"📝 {to_team} adds {player_name}"
                if salary and salary > 1:
                    text += f" (${salary:.0f}M)"
            elif transaction_type == 'drop':
                text = f"✂️ {from_team} drops {player_name}"
            elif transaction_type == 'trade':
                text = f"🔄 Trade: {player_name} from {from_team} to {to_team}"
            elif transaction_type == 'waiver_claim':
                text = f"📋 {to_team} claims {player_name} off waivers"
            else:
                text = f"📰 {to_team or from_team} - {player_name} ({transaction_type})"
            
            activities.append({
                "id": f"txn-{idx}-{minutes_ago}",
                "text": text,
                "priority": "high" if minutes_ago < 60 else "medium",
                "time_ago": time_str,
                "timestamp": get_value_from_field(record[1], 'string')
            })
        
        return {
            "success": True,
            "activities": activities,
            "total": len(activities)
        }
        
    except Exception as e:
        logger.error(f"Error getting recent activity: {e}")
        return {"success": True, "activities": []}  # Don't fail the ticker