"""
Dynasty Dugout - League Transactions Module  
PURPOSE: All player movement within leagues (trades, waivers, free agency)
STATUS: FIXED - Now uses league_player_id for all transactions
ARCHITECTURE: 2025 stats from league DB, historical stats from main DB
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from core.auth_utils import get_current_user
from core.database import execute_sql
import uuid
import logging
logger = logging.getLogger(__name__)
from datetime import datetime, timezone

router = APIRouter()

# =============================================================================
# PYDANTIC MODELS - FIXED
# =============================================================================

class TransactionRequest(BaseModel):
    """Transaction request model"""
    transaction_type: str  # 'add', 'drop', 'trade', 'waiver_claim'
    league_player_id: str  # UUID - FIXED
    salary: float = 1.0
    contract_years: int = 1

class AddPlayerRequest(BaseModel):
    """Add player to team request - FIXED"""
    league_player_id: str  # UUID from league database - FIXED
    salary: float = 1.0
    contract_years: int = 1
    roster_status: str = 'active'  # 'active', 'bench', 'injured'

class DropPlayerRequest(BaseModel):
    """Drop player from team request"""
    league_player_id: str

class TradeProposal(BaseModel):
    """Trade proposal model"""
    to_team_id: str
    from_players: List[str] = []  # league_player_ids
    to_players: List[str] = []    # league_player_ids
    notes: str = ""

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_user_team_id(league_id: str, user_id: str) -> Optional[str]:
    """Get the team ID for a user in a specific league"""
    try:
        result = execute_sql(
            "SELECT team_id FROM league_teams WHERE user_id = :user_id",
            parameters={'user_id': user_id},
            database_name=f"league_{league_id.replace('-', '_')}"
        )
        
        if result and result.get("records") and len(result["records"]) > 0:
            return result["records"][0][0]["stringValue"]
        return None
    except Exception as e:
        logger.error(f"Error getting user team ID: {e}", exc_info=True)
        return None

def log_transaction(league_id: str, transaction_data: dict):
    """Log a transaction to the league_transactions table"""
    try:
        execute_sql(
            """
            INSERT INTO league_transactions 
            (transaction_id, league_player_id, from_team_id, to_team_id, transaction_type, 
             salary, contract_years, transaction_date, notes)
            VALUES (:transaction_id::uuid, :league_player_id::uuid, :from_team_id::uuid, :to_team_id::uuid, 
                    :transaction_type, :salary, :contract_years, :transaction_date::timestamp, :notes)
            """,
            parameters=transaction_data,
            database_name=f"league_{league_id.replace('-', '_')}"
        )
    except Exception as e:
        logger.error(f"Error logging transaction: {e}", exc_info=True)

# =============================================================================
# FREE AGENT ENDPOINTS - FIXED TO QUERY LEAGUE DB
# =============================================================================

@router.get("/{league_id}/free-agents")
async def get_free_agents(
    league_id: str,
    position: Optional[str] = Query(None, description="Filter by position (C, 1B, 2B, 3B, SS, OF, DH, SP, RP)"),
    search: Optional[str] = Query(None, description="Search by player name"),
    limit: int = Query(100, description="Number of results to return"),
    offset: int = Query(0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get available free agents for the league
    FIXED: Uses two-query approach to avoid cross-database JOINs
    """
    try:
        league_db_name = f"league_{league_id.replace('-', '_')}"

        # STEP 1: Get league players and their stats from LEAGUE database
        league_query = """
            SELECT 
                lp.league_player_id,
                lp.mlb_player_id,
                lp.salary,
                lp.contract_years,
                -- 2025 season stats from LEAGUE DB (calculated from game logs)
                COALESCE(pss.avg, 0.0) as batting_avg,
                COALESCE(pss.home_runs, 0) as home_runs,
                COALESCE(pss.rbi, 0) as rbi,
                COALESCE(pss.runs, 0) as runs,
                COALESCE(pss.hits, 0) as hits,
                COALESCE(pss.doubles, 0) as doubles,
                COALESCE(pss.triples, 0) as triples,
                COALESCE(pss.stolen_bases, 0) as stolen_bases,
                COALESCE(pss.walks, 0) as walks,
                COALESCE(pss.strikeouts, 0) as strikeouts,
                COALESCE(pss.obp, 0.0) as obp,
                COALESCE(pss.slg, 0.0) as slg,
                COALESCE(pss.ops, 0.0) as ops,
                -- Pitching stats
                COALESCE(pss.era, 0.0) as era,
                COALESCE(pss.whip, 0.0) as whip,
                COALESCE(pss.wins, 0) as wins,
                COALESCE(pss.losses, 0) as losses,
                COALESCE(pss.saves, 0) as saves,
                COALESCE(pss.holds, 0) as holds,
                COALESCE(pss.strikeouts_pitched, 0) as strikeouts_pitched,
                COALESCE(pss.innings_pitched, 0.0) as innings_pitched,
                COALESCE(pss.games_played, 0) as games_played,
                COALESCE(pss.games_started, 0) as games_started
            FROM league_players lp
            LEFT JOIN player_season_stats pss ON lp.mlb_player_id = pss.player_id 
                AND pss.season_year = 2025
            WHERE lp.availability_status = 'free_agent'
            ORDER BY lp.mlb_player_id
            LIMIT :limit OFFSET :offset
        """
        
        # Execute query 1 on LEAGUE database
        league_results = execute_sql(
            sql=league_query,
            parameters={'limit': limit, 'offset': offset},
            database_name=league_db_name
        )
        
        if not league_results or not league_results.get("records"):
            return {
                "success": True,
                "players": [],
                "total_count": 0,
                "limit": limit,
                "offset": offset,
                "has_more": False,
                "data_source": "league_db_2025_stats"
            }

        # Extract player IDs and create league data lookup
        player_ids = []
        league_data_lookup = {}
        
        for record in league_results["records"]:
            mlb_player_id = int(record[1]["longValue"])
            player_ids.append(mlb_player_id)
            
            league_data_lookup[mlb_player_id] = {
                "league_player_id": record[0]["stringValue"],
                "salary": float(record[2]["doubleValue"]) if record[2].get("doubleValue") else 1.0,
                "contract_years": int(record[3]["longValue"]) if record[3].get("longValue") else 1,
                # Hitting stats
                "batting_avg": float(record[4]["doubleValue"]) if record[4].get("doubleValue") else 0.0,
                "home_runs": int(record[5]["longValue"]) if record[5].get("longValue") else 0,
                "rbi": int(record[6]["longValue"]) if record[6].get("longValue") else 0,
                "runs": int(record[7]["longValue"]) if record[7].get("longValue") else 0,
                "hits": int(record[8]["longValue"]) if record[8].get("longValue") else 0,
                "doubles": int(record[9]["longValue"]) if record[9].get("longValue") else 0,
                "triples": int(record[10]["longValue"]) if record[10].get("longValue") else 0,
                "stolen_bases": int(record[11]["longValue"]) if record[11].get("longValue") else 0,
                "walks": int(record[12]["longValue"]) if record[12].get("longValue") else 0,
                "strikeouts": int(record[13]["longValue"]) if record[13].get("longValue") else 0,
                "obp": float(record[14]["doubleValue"]) if record[14].get("doubleValue") else 0.0,
                "slg": float(record[15]["doubleValue"]) if record[15].get("doubleValue") else 0.0,
                "ops": float(record[16]["doubleValue"]) if record[16].get("doubleValue") else 0.0,
                # Pitching stats
                "era": float(record[17]["doubleValue"]) if record[17].get("doubleValue") else 0.0,
                "whip": float(record[18]["doubleValue"]) if record[18].get("doubleValue") else 0.0,
                "wins": int(record[19]["longValue"]) if record[19].get("longValue") else 0,
                "losses": int(record[20]["longValue"]) if record[20].get("longValue") else 0,
                "saves": int(record[21]["longValue"]) if record[21].get("longValue") else 0,
                "holds": int(record[22]["longValue"]) if record[22].get("longValue") else 0,
                "strikeouts_pitched": int(record[23]["longValue"]) if record[23].get("longValue") else 0,
                "innings_pitched": float(record[24]["doubleValue"]) if record[24].get("doubleValue") else 0.0,
                "games_played": int(record[25]["longValue"]) if record[25].get("longValue") else 0,
                "games_started": int(record[26]["longValue"]) if record[26].get("longValue") else 0
            }

        # STEP 2: Get MLB player info from MAIN database
        # Convert to comma-separated string for SQL IN clause
        player_ids_str = ','.join(map(str, player_ids))
        
        mlb_query = f"""
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
        
        # Execute query 2 on MAIN database
        mlb_results = execute_sql(
            sql=mlb_query,
            parameters={},
            database_name="postgres"  # Main database
        )
        
        # STEP 3: Combine results and apply filters
        players = []
        
        if mlb_results and mlb_results.get("records"):
            for record in mlb_results["records"]:
                mlb_player_id = int(record[0]["longValue"])
                first_name = record[1]["stringValue"]
                last_name = record[2]["stringValue"]
                player_position = record[3]["stringValue"]
                mlb_team = record[4].get("stringValue", "FA")
                jersey_number = record[5].get("stringValue", "")
                
                # Apply position filter
                if position and player_position != position:
                    continue
                
                # Apply search filter
                if search:
                    full_name = f"{first_name} {last_name}".lower()
                    if search.lower() not in full_name:
                        continue
                
                # Get league data for this player
                league_data = league_data_lookup.get(mlb_player_id, {})
                
                player_data = {
                    "league_player_id": league_data.get("league_player_id", ""),
                    "mlb_player_id": mlb_player_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "position": player_position,
                    "mlb_team": mlb_team,
                    "jersey_number": jersey_number,
                    "availability_status": "free_agent",
                    **league_data  # Merge all the stats and contract data
                }
                players.append(player_data)

        # Get total count for pagination (from league database only)
        count_query = """
            SELECT COUNT(*)
            FROM league_players lp
            WHERE lp.availability_status = 'free_agent'
        """
        
        count_result = execute_sql(
            sql=count_query,
            parameters={},
            database_name=league_db_name
        )
        
        total_count = 0
        if count_result and count_result.get("records"):
            total_count = int(count_result["records"][0][0]["longValue"])

        return {
            "success": True,
            "players": players,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(players) < total_count,
            "data_source": "league_db_2025_stats",  # For debugging
            "query_method": "two_query_application_join"  # For debugging
        }
        
    except Exception as e:
        logger.error(f"Error getting free agents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting free agents: {str(e)}")

@router.post("/{league_id}/add-player")
async def add_player_to_team(
    league_id: str,
    request: AddPlayerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a free agent player to user's team - FIXED"""
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Get user's team ID
        team_id = get_user_team_id(league_id, user_id)
        if not team_id:
            raise HTTPException(status_code=404, detail="User team not found in this league")
        
        # Check if player is available as free agent using league_player_id
        availability_check = execute_sql(
            "SELECT availability_status, mlb_player_id FROM league_players WHERE league_player_id = :league_player_id::uuid",
            parameters={'league_player_id': request.league_player_id},
            database_name=f"league_{league_id.replace('-', '_')}"
        )
        
        if not availability_check or not availability_check.get("records"):
            raise HTTPException(status_code=404, detail="Player not found in league")
        
        availability_status = availability_check["records"][0][0]["stringValue"]
        mlb_player_id = int(availability_check["records"][0][1]["longValue"])
        
        if availability_status != 'free_agent':
            raise HTTPException(status_code=400, detail="Player is not available as a free agent")
        
        # Add player to team using league_player_id
        execute_sql(
            """
            UPDATE league_players 
            SET team_id = :team_id::uuid,
                availability_status = 'owned',
                roster_status = :roster_status,
                salary = :salary,
                contract_years = :contract_years,
                acquisition_date = :acquisition_date::timestamp,
                acquisition_method = 'free_agent'
            WHERE league_player_id = :league_player_id::uuid
            """,
            parameters={
                'team_id': team_id,
                'roster_status': request.roster_status,
                'salary': request.salary,
                'contract_years': request.contract_years,
                'acquisition_date': datetime.now(timezone.utc).isoformat(),
                'league_player_id': request.league_player_id
            },
            database_name=f"league_{league_id.replace('-', '_')}"
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
            'notes': f"Added from free agency - ${request.salary}M for {request.contract_years} years"
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
            "contract_years": request.contract_years
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding player: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error adding player: {str(e)}")

@router.post("/{league_id}/drop-player")
async def drop_player_from_team(
    league_id: str,
    request: DropPlayerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Drop a player from user's team"""
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Get user's team ID
        team_id = get_user_team_id(league_id, user_id)
        if not team_id:
            raise HTTPException(status_code=404, detail="User team not found in this league")
        
        # Verify player belongs to user's team
        ownership_check = execute_sql(
            "SELECT team_id, mlb_player_id FROM league_players WHERE league_player_id = :league_player_id::uuid",
            parameters={'league_player_id': request.league_player_id},
            database_name=f"league_{league_id.replace('-', '_')}"
        )
        
        if not ownership_check or not ownership_check.get("records"):
            raise HTTPException(status_code=404, detail="Player not found")
        
        player_team_id = ownership_check["records"][0][0]["stringValue"]
        mlb_player_id = int(ownership_check["records"][0][1]["longValue"])
        
        if player_team_id != team_id:
            raise HTTPException(status_code=403, detail="Player does not belong to your team")
        
        # Drop player (release to free agency)
        execute_sql(
            """
            UPDATE league_players 
            SET team_id = NULL,
                availability_status = 'free_agent',
                roster_status = NULL,
                acquisition_date = NULL,
                acquisition_method = NULL
            WHERE league_player_id = :league_player_id::uuid
            """,
            parameters={'league_player_id': request.league_player_id},
            database_name=f"league_{league_id.replace('-', '_')}"
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
            'notes': "Released to free agency"
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
            "player_name": player_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dropping player: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error dropping player: {str(e)}")

@router.get("/{league_id}/my-roster")
async def get_my_roster(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get current user's roster
    FIXED: Now queries league DB for 2025 season stats
    """
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Get user's team ID
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
                }
            }
        
        # Get team info
        team_info = execute_sql(
            "SELECT team_name, manager_name FROM league_teams WHERE team_id = :team_id::uuid",
            parameters={'team_id': team_id},
            database_name=f"league_{league_id.replace('-', '_')}"
        )
        
        team_name = "My Team"
        if team_info and team_info.get("records"):
            team_name = team_info["records"][0][0]["stringValue"]
        
        # FIXED: Get roster with 2025 stats from league DB using two-query approach
        # STEP 1: Get players from league DB
        league_roster_query = """
        SELECT 
            lp.league_player_id,
            lp.mlb_player_id,
            lp.roster_status,
            lp.salary,
            lp.contract_years,
            lp.acquisition_date,
            lp.acquisition_method,
            -- 2025 stats from league DB
            COALESCE(pss.avg, 0.0) as batting_avg,
            COALESCE(pss.home_runs, 0) as home_runs,
            COALESCE(pss.rbi, 0) as rbi,
            COALESCE(pss.era, 0.0) as era,
            COALESCE(pss.wins, 0) as wins,
            COALESCE(pss.saves, 0) as saves,
            COALESCE(pss.strikeouts_pitched, 0) as strikeouts_pitched,
            COALESCE(pss.innings_pitched, 0.0) as innings_pitched
        FROM league_players lp
        LEFT JOIN player_season_stats pss ON lp.mlb_player_id = pss.player_id 
            AND pss.season_year = 2025
        WHERE lp.team_id = :team_id::uuid
        ORDER BY lp.mlb_player_id
        """
        
        league_result = execute_sql(
            league_roster_query,
            parameters={'team_id': team_id},
            database_name=f"league_{league_id.replace('-', '_')}"
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
                }
            }
        
        # Extract MLB player IDs and create league data lookup
        player_ids = []
        league_roster_lookup = {}
        
        for record in league_result["records"]:
            mlb_player_id = int(record[1]["longValue"])
            player_ids.append(mlb_player_id)
            
            league_roster_lookup[mlb_player_id] = {
                "league_player_id": record[0]["stringValue"],
                "roster_status": record[2]["stringValue"] if record[2].get("stringValue") else "active",
                "salary": float(record[3]["doubleValue"]) if record[3].get("doubleValue") else 1.0,
                "contract_years": int(record[4]["longValue"]) if record[4].get("longValue") else 1,
                "acquisition_date": record[5]["stringValue"] if record[5].get("stringValue") else "",
                "acquisition_method": record[6]["stringValue"] if record[6].get("stringValue") else "",
                "batting_avg": float(record[7]["doubleValue"]) if record[7].get("doubleValue") else 0.0,
                "home_runs": int(record[8]["longValue"]) if record[8].get("longValue") else 0,
                "rbi": int(record[9]["longValue"]) if record[9].get("longValue") else 0,
                "era": float(record[10]["doubleValue"]) if record[10].get("doubleValue") else 0.0,
                "wins": int(record[11]["longValue"]) if record[11].get("longValue") else 0,
                "saves": int(record[12]["longValue"]) if record[12].get("longValue") else 0,
                "strikeouts_pitched": int(record[13]["longValue"]) if record[13].get("longValue") else 0,
                "innings_pitched": float(record[14]["doubleValue"]) if record[14].get("doubleValue") else 0.0
            }
        
        # STEP 2: Get MLB player info from main database
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
        roster_spots = {"active": 0, "bench": 0, "injured": 0}
        
        if mlb_result and mlb_result.get("records"):
            for record in mlb_result["records"]:
                mlb_player_id = int(record[0]["longValue"])
                league_data = league_roster_lookup.get(mlb_player_id, {})
                
                player = {
                    "league_player_id": league_data.get("league_player_id", ""),
                    "mlb_player_id": mlb_player_id,
                    "first_name": record[1]["stringValue"],
                    "last_name": record[2]["stringValue"],
                    "position": record[3]["stringValue"],
                    "mlb_team": record[4]["stringValue"] if record[4].get("stringValue") else "FA",
                    "jersey_number": record[5]["stringValue"] if record[5].get("stringValue") else "",
                    **league_data  # Merge all the league-specific data
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
            "data_source": "league_db_2025_stats"  # For debugging
        }
        
    except Exception as e:
        logger.error(f"Error getting roster: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting roster: {str(e)}")

# =============================================================================
# TRANSACTION HISTORY
# =============================================================================

@router.get("/{league_id}/transactions")
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
            "lt.transaction_date >= (CURRENT_DATE - INTERVAL ':days_back days')"
        ]
        parameters = {'days_back': days_back, 'limit': limit}
        
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
        JOIN league_players lp ON lt.league_player_id = lp.league_player_id
        LEFT JOIN league_teams from_team ON lt.from_team_id = from_team.team_id
        LEFT JOIN league_teams to_team ON lt.to_team_id = to_team.team_id
        WHERE {where_clause}
        ORDER BY lt.transaction_date DESC
        LIMIT :limit
        """
        
        result = execute_sql(
            query,
            parameters=parameters,
            database_name=f"league_{league_id.replace('-', '_')}"
        )
        
        # Get all MLB player IDs from transactions
        mlb_player_ids = []
        if result and result.get("records"):
            for record in result["records"]:
                mlb_player_id = int(record[6]["longValue"])
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
                    player_id = int(record[0]["longValue"])
                    first_name = record[1]["stringValue"]
                    last_name = record[2]["stringValue"]
                    position = record[3]["stringValue"]
                    player_names[player_id] = {
                        "name": f"{first_name} {last_name}",
                        "position": position
                    }
        
        # Format transaction data
        transactions = []
        if result and result.get("records"):
            for record in result["records"]:
                mlb_player_id = int(record[6]["longValue"])
                player_info = player_names.get(mlb_player_id, {"name": "Unknown Player", "position": ""})
                
                transaction = {
                    "transaction_id": record[0]["stringValue"],
                    "transaction_type": record[1]["stringValue"],
                    "transaction_date": record[2]["stringValue"],
                    "salary": float(record[3]["doubleValue"]) if record[3].get("doubleValue") else None,
                    "contract_years": int(record[4]["longValue"]) if record[4].get("longValue") else None,
                    "notes": record[5]["stringValue"] if record[5].get("stringValue") else "",
                    "player_name": player_info["name"],
                    "position": player_info["position"],
                    "from_team": record[7]["stringValue"] if record[7].get("stringValue") else "Free Agency",
                    "to_team": record[8]["stringValue"] if record[8].get("stringValue") else "Free Agency"
                }
                transactions.append(transaction)
        
        return {
            "success": True,
            "transactions": transactions,
            "filters": {
                "transaction_type": transaction_type,
                "days_back": days_back
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting transaction history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting transaction history: {str(e)}")

# =============================================================================
# PLACEHOLDER ENDPOINTS (FOR FUTURE IMPLEMENTATION)
# =============================================================================

@router.post("/{league_id}/trades")
async def propose_trade(
    league_id: str,
    trade: TradeProposal,
    current_user: dict = Depends(get_current_user)
):
    """Propose a trade to another team"""
    return {
        "success": False,
        "message": "Trade proposal endpoint not yet implemented",
        "todo": "Create trade proposal system with acceptance/rejection workflow"
    }

@router.get("/{league_id}/trades")
async def get_trade_proposals(league_id: str, current_user: dict = Depends(get_current_user)):
    """Get pending trade proposals"""
    return {
        "success": False,
        "message": "Trade proposals endpoint not yet implemented",
        "todo": "Return trades involving user's team"
    }

@router.get("/{league_id}/waivers")
async def get_waiver_wire(league_id: str, current_user: dict = Depends(get_current_user)):
    """Get waiver wire players"""
    return {
        "success": False,
        "message": "Waiver wire endpoint not yet implemented",
        "todo": "Return players with availability_status = 'waiver'"
    }

@router.post("/{league_id}/waivers/{player_id}/claim")
async def claim_waiver_player(
    league_id: str,
    player_id: str,  # This should be league_player_id
    current_user: dict = Depends(get_current_user)
):
    """Submit waiver claim for player"""
    return {
        "success": False,
        "message": "Waiver claim endpoint not yet implemented",
        "todo": "Implement waiver priority system and claim processing"
    }