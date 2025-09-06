"""
Dynasty Dugout - League Transactions Module
PURPOSE: All player movement within leagues (trades, waivers, free agency)
STATUS: Updated for shared database architecture with CACHED stats
ARCHITECTURE: Current season stats from CACHED leagues DB, rolling from leagues DB, accrued from leagues DB
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, date, timedelta
from core.auth_utils import get_current_user
from core.database import execute_sql
from core.season_utils import get_current_season, CURRENT_SEASON
import uuid
import logging
import traceback

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class TransactionRequest(BaseModel):
    """Transaction request model"""
    transaction_type: str  # 'add', 'drop', 'trade', 'waiver_claim'
    league_player_id: str  # UUID
    salary: float = 1.0
    contract_years: int = 1

class AddPlayerRequest(BaseModel):
    """Add player to team request"""
    league_player_id: str  # UUID from league database
    salary: float = 1.0
    contract_years: int = 1
    roster_status: str = 'active'  # 'active', 'bench', 'injured', 'minors'

class DropPlayerRequest(BaseModel):
    """Drop player from team request"""
    league_player_id: str

class RosterMoveRequest(BaseModel):
    """Move player between roster statuses"""
    league_player_id: str
    new_status: str  # 'active', 'bench', 'injured', 'minors'
    reason: Optional[str] = None

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
            """SELECT team_id FROM league_teams 
               WHERE league_id = :league_id::uuid AND user_id = :user_id""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'  # SHARED DATABASE
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
        # Add league_id to transaction data
        transaction_data['league_id'] = league_id
        
        execute_sql(
            """
            INSERT INTO league_transactions
            (transaction_id, league_id, league_player_id, from_team_id, to_team_id, transaction_type,
             salary, contract_years, transaction_date, notes)
            VALUES (:transaction_id::uuid, :league_id::uuid, :league_player_id::uuid, :from_team_id::uuid, :to_team_id::uuid,
                    :transaction_type, :salary, :contract_years, :transaction_date::timestamp, :notes)
            """,
            parameters=transaction_data,
            database_name='leagues'  # SHARED DATABASE
        )
    except Exception as e:
        logger.error(f"Error logging transaction: {e}", exc_info=True)

def record_roster_status_change(league_id: str, league_player_id: str, team_id: str, 
                               new_status: str, user_id: str, reason: str = None):
    """Record roster status change in history table"""
    try:
        today = date.today()
        
        # End current status period
        execute_sql(
            """UPDATE roster_status_history 
               SET end_date = :yesterday 
               WHERE league_id = :league_id::uuid
                 AND league_player_id = :player_id::uuid 
                 AND end_date IS NULL""",
            {'league_id': league_id, 'player_id': league_player_id, 'yesterday': today - timedelta(days=1)},
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Start new status period
        execute_sql(
            """INSERT INTO roster_status_history 
               (league_id, league_player_id, team_id, roster_status, effective_date, changed_by, change_reason)
               VALUES (:league_id::uuid, :player_id::uuid, :team_id::uuid, :status, :today, :user_id, :reason)""",
            {
                'league_id': league_id,
                'player_id': league_player_id,
                'team_id': team_id,
                'status': new_status,
                'today': today,
                'user_id': user_id,
                'reason': reason
            },
            database_name='leagues'  # SHARED DATABASE
        )
    except Exception as e:
        logger.error(f"Error recording roster status change: {e}")

def get_value_from_field(field, value_type='long'):
    """Helper function to extract values from AWS RDS Data API response fields"""
    if not field:
        return 0 if value_type != 'string' else ""
    
    if value_type == 'long':
        return field.get("longValue", 0) or field.get("intValue", 0)
    elif value_type == 'decimal':
        # DECIMAL/NUMERIC types come as stringValue from AWS RDS Data API
        val = field.get("stringValue")
        if val:
            try:
                return float(val)
            except:
                pass
        # Fallback to doubleValue if exists
        return field.get("doubleValue", 0.0) or field.get("floatValue", 0.0)
    elif value_type == 'string':
        return field.get("stringValue", "")
    return 0

# =============================================================================
# FREE AGENT ENDPOINTS WITH MULTI-ROW DISPLAY
# =============================================================================

@router.get("/free-agents")
async def get_free_agents(
    league_id: str,
    position: Optional[str] = Query(None, description="Filter by position"),
    search: Optional[str] = Query(None, description="Search by player name"),
    limit: int = Query(100, description="Number of results to return"),
    offset: int = Query(0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get ALL MLB players who are free agents (not on any team in this league).
    Returns current season stats from CACHED leagues DB.
    """
    try:
        print(f"DEBUG: Starting free-agents for league {league_id}, position={position}")
        
        current_season = CURRENT_SEASON

        # First, get all players who are OWNED in this league
        owned_query = """
            SELECT mlb_player_id 
            FROM league_players 
            WHERE league_id = :league_id::uuid
            AND (availability_status = 'owned' OR team_id IS NOT NULL)
        """
        
        owned_result = execute_sql(
            owned_query, 
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        owned_player_ids = set()
        if owned_result and owned_result.get("records"):
            for record in owned_result["records"]:
                if record[0] and record[0].get("longValue"):
                    owned_player_ids.add(int(record[0]["longValue"]))
        
        print(f"DEBUG: Found {len(owned_player_ids)} owned players")

        # Build filter conditions
        conditions = []
        params = {}
        
        # Exclude owned players
        if owned_player_ids:
            owned_ids_str = ','.join(map(str, owned_player_ids))
            conditions.append(f"mp.player_id NOT IN ({owned_ids_str})")
        
        # Position filter
        if position:
            if position.lower() == 'hitters':
                conditions.append("mp.position IN ('C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'LF', 'CF', 'RF', 'UT')")
            elif position.lower() == 'pitchers':
                conditions.append("mp.position IN ('P', 'SP', 'RP', 'CL')")
            else:
                conditions.append("mp.position = :position")
                params['position'] = position
        
        # Search filter
        if search:
            conditions.append("(LOWER(mp.first_name) LIKE LOWER(:search) OR LOWER(mp.last_name) LIKE LOWER(:search) OR LOWER(CONCAT(mp.first_name, ' ', mp.last_name)) LIKE LOWER(:search))")
            params['search'] = f"%{search}%"
        
        # Build WHERE clause
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        # Get ALL free agent MLB players from main database
        main_query = f"""
            SELECT 
                mp.player_id,
                mp.first_name,
                mp.last_name,
                mp.position,
                mp.mlb_team,
                mp.jersey_number
            FROM mlb_players mp
            WHERE {where_clause}
            ORDER BY mp.last_name, mp.first_name
            LIMIT :limit OFFSET :offset
        """
        
        params.update({'limit': limit, 'offset': offset})
        
        print(f"DEBUG: Executing query with where_clause: {where_clause}")
        print(f"DEBUG: Query params: {params}")
        
        main_result = execute_sql(main_query, parameters=params, database_name="postgres")
        
        if not main_result or not main_result.get("records"):
            print("DEBUG: Returning empty result - no records found")
            return {
                "success": True,
                "players": [],
                "total_count": 0,
                "limit": limit,
                "offset": offset,
                "has_more": False,
                "season": current_season
            }

        # Extract player data
        players_data = []
        player_ids = []
        
        for idx, record in enumerate(main_result["records"]):
            try:
                # Extract player_id
                player_id = None
                if record[0].get("longValue"):
                    player_id = int(record[0]["longValue"])
                elif record[0].get("intValue"):
                    player_id = int(record[0]["intValue"])
                elif record[0].get("stringValue"):
                    player_id = int(record[0]["stringValue"])
                
                if not player_id:
                    print(f"DEBUG: Could not extract player_id from record[0]: {record[0]}")
                    continue
                    
                player_ids.append(player_id)
                
                # Extract other fields
                first_name = record[1].get("stringValue", "") if record[1] else ""
                last_name = record[2].get("stringValue", "") if record[2] else ""
                position = record[3].get("stringValue", "") if record[3] else ""
                mlb_team = record[4].get("stringValue", "FA") if record[4] else "FA"
                jersey_number = record[5].get("stringValue", "") if record[5] else ""
                
                player_data = {
                    "mlb_player_id": player_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "position": position,
                    "mlb_team": mlb_team,
                    "jersey_number": jersey_number
                }
                
                players_data.append(player_data)
                    
            except Exception as e:
                print(f"DEBUG ERROR: Error processing record {idx}: {e}")
                print(f"DEBUG ERROR: Record was: {record}")
                continue

        print(f"DEBUG: Extracted {len(players_data)} players")

        if not player_ids:
            print("DEBUG: No player IDs extracted, returning player data without stats")
            return {
                "success": True,
                "players": players_data,
                "total_count": len(players_data),
                "limit": limit,
                "offset": offset,
                "has_more": False,
                "season": current_season
            }

        # Get season stats from CACHED LEAGUES DB (NOT postgres!)
        player_ids_str = ','.join(map(str, player_ids))
        
        print(f"DEBUG: Getting CACHED stats for {len(player_ids)} players from leagues DB")
        
        stats_query = f"""
            SELECT
                player_id,
                games_played,
                at_bats,
                hits,
                runs,
                home_runs,
                rbi,
                stolen_bases,
                caught_stealing,
                walks,
                strikeouts,
                batting_avg,
                obp,
                slg,
                ops,
                games_started,
                wins,
                losses,
                saves,
                blown_saves,
                quality_starts,
                innings_pitched,
                earned_runs,
                hits_allowed,
                walks_allowed,
                strikeouts_pitched,
                era,
                whip
            FROM player_season_stats
            WHERE player_id IN ({player_ids_str})
                AND season = {current_season}
                AND league_id = :league_id::uuid
        """
        
        stats_result = execute_sql(
            stats_query, 
            {'league_id': league_id},
            database_name='leagues'  # CACHED STATS IN LEAGUES DB!
        )
        
        print(f"DEBUG: Stats query returned {len(stats_result.get('records', [])) if stats_result else 0} records")
        
        # Build stats lookup
        stats_lookup = {}
        if stats_result and stats_result.get("records"):
            for record in stats_result["records"]:
                try:
                    player_id = get_value_from_field(record[0], 'long')
                    stats_lookup[player_id] = {
                        "games_played": get_value_from_field(record[1], 'long'),
                        "at_bats": get_value_from_field(record[2], 'long'),
                        "hits": get_value_from_field(record[3], 'long'),
                        "runs": get_value_from_field(record[4], 'long'),
                        "home_runs": get_value_from_field(record[5], 'long'),
                        "rbi": get_value_from_field(record[6], 'long'),
                        "stolen_bases": get_value_from_field(record[7], 'long'),
                        "caught_stealing": get_value_from_field(record[8], 'long'),
                        "walks": get_value_from_field(record[9], 'long'),
                        "strikeouts": get_value_from_field(record[10], 'long'),
                        "batting_avg": get_value_from_field(record[11], 'decimal'),
                        "avg": get_value_from_field(record[11], 'decimal'),
                        "obp": get_value_from_field(record[12], 'decimal'),
                        "slg": get_value_from_field(record[13], 'decimal'),
                        "ops": get_value_from_field(record[14], 'decimal'),
                        "games_started": get_value_from_field(record[15], 'long'),
                        "wins": get_value_from_field(record[16], 'long'),
                        "losses": get_value_from_field(record[17], 'long'),
                        "saves": get_value_from_field(record[18], 'long'),
                        "blown_saves": get_value_from_field(record[19], 'long'),
                        "quality_starts": get_value_from_field(record[20], 'long'),
                        "innings_pitched": get_value_from_field(record[21], 'decimal'),
                        "earned_runs": get_value_from_field(record[22], 'long'),
                        "hits_allowed": get_value_from_field(record[23], 'long'),
                        "walks_allowed": get_value_from_field(record[24], 'long'),
                        "strikeouts_pitched": get_value_from_field(record[25], 'long'),
                        "era": get_value_from_field(record[26], 'decimal'),
                        "whip": get_value_from_field(record[27], 'decimal')
                    }
                except Exception as e:
                    print(f"DEBUG ERROR: Error processing stats record: {e}")
                    continue

        print(f"DEBUG: Found stats for {len(stats_lookup)} players")

        # Check which players exist in league_players table
        existing_query = f"""
            SELECT mlb_player_id, league_player_id, salary, contract_years
            FROM league_players 
            WHERE league_id = :league_id::uuid
            AND mlb_player_id IN ({player_ids_str})
        """
        
        existing_result = execute_sql(
            existing_query, 
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        print(f"DEBUG: Existing players query returned {len(existing_result.get('records', [])) if existing_result else 0} records")
        
        league_player_lookup = {}
        if existing_result and existing_result.get("records"):
            for record in existing_result["records"]:
                try:
                    mlb_id = get_value_from_field(record[0], 'long')
                    league_player_lookup[mlb_id] = {
                        "league_player_id": get_value_from_field(record[1], 'string'),
                        "salary": get_value_from_field(record[2], 'decimal'),
                        "contract_years": get_value_from_field(record[3], 'long')
                    }
                except Exception as e:
                    print(f"DEBUG ERROR: Error processing league player record: {e}")
                    continue

        print(f"DEBUG: Found {len(league_player_lookup)} existing league players")

        # Add missing players to league_players as free agents
        added_count = 0
        for player_id in player_ids:
            if player_id not in league_player_lookup:
                try:
                    new_league_player_id = str(uuid.uuid4())
                    add_query = """
                        INSERT INTO league_players (
                            league_player_id, league_id, mlb_player_id, availability_status, 
                            salary, contract_years, created_at
                        ) VALUES (
                            :league_player_id::uuid, :league_id::uuid, :player_id, 'free_agent', 
                            1.0, 1, NOW()
                        )
                    """
                    execute_sql(
                        add_query, 
                        parameters={'league_player_id': new_league_player_id, 'league_id': league_id, 'player_id': player_id},
                        database_name='leagues'  # SHARED DATABASE
                    )
                    league_player_lookup[player_id] = {
                        "league_player_id": new_league_player_id,
                        "salary": 1.0,
                        "contract_years": 1
                    }
                    added_count += 1
                except Exception as e:
                    print(f"DEBUG: Could not add player {player_id} to league: {e}")

        if added_count > 0:
            print(f"DEBUG: Added {added_count} new players to league_players")

        # Combine all data
        final_players = []
        for player_data in players_data:
            player_id = player_data["mlb_player_id"]
            
            # Get stats with defaults
            player_stats = stats_lookup.get(player_id, {
                "games_played": 0,
                "at_bats": 0,
                "hits": 0,
                "runs": 0,
                "home_runs": 0,
                "rbi": 0,
                "stolen_bases": 0,
                "caught_stealing": 0,
                "walks": 0,
                "strikeouts": 0,
                "batting_avg": 0.0,
                "avg": 0.0,
                "obp": 0.0,
                "slg": 0.0,
                "ops": 0.0,
                "era": 0.0,
                "wins": 0,
                "saves": 0,
                "innings_pitched": 0.0,
                "strikeouts_pitched": 0,
                "whip": 0.0
            })
            
            # Get league info with defaults
            league_info = league_player_lookup.get(player_id, {
                "league_player_id": "",
                "salary": 1.0,
                "contract_years": 1
            })
            
            # Combine everything
            final_player = {
                **player_data,
                **player_stats,
                **league_info,
                "availability_status": "free_agent"
            }
            
            final_players.append(final_player)

        # Get total count
        count_query = f"""
            SELECT COUNT(*)
            FROM mlb_players mp
            WHERE {where_clause}
        """
        
        count_params = {k: v for k, v in params.items() if k not in ['limit', 'offset']}
        count_result = execute_sql(count_query, parameters=count_params, database_name="postgres")
        
        total_count = 0
        if count_result and count_result.get("records"):
            try:
                total_count = int(count_result["records"][0][0]["longValue"]) if count_result["records"][0][0].get("longValue") else int(count_result["records"][0][0].get("intValue", 0))
            except:
                total_count = len(final_players)

        print(f"DEBUG: Returning {len(final_players)} players with total count {total_count}")

        return {
            "success": True,
            "players": final_players,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(final_players) < total_count,
            "season": current_season,
            "data_source": "leagues_db_cached"
        }
        
    except Exception as e:
        print(f"DEBUG ERROR: Error in get_free_agents: {e}")
        print(f"DEBUG ERROR: Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error getting free agents: {str(e)}")

@router.get("/free-agents-enhanced")
async def get_free_agents_with_rolling(
    league_id: str,
    position: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(1000),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user)
):
    """
    Free agents with 2-row display - SIMPLIFIED AND ROBUST VERSION
    """
    try:
        # Step 1: Get basic free agents first
        logger.info(f"Getting enhanced free agents for league {league_id}")
        
        # Just call the basic endpoint first
        basic_result = await get_free_agents(
            league_id=league_id,
            position=position,
            search=search,
            limit=limit,
            offset=offset,
            current_user=current_user
        )
        
        # If basic call failed or no players, return as-is
        if not basic_result.get("success") or not basic_result.get("players"):
            logger.info("No players from basic free agents, returning empty")
            return basic_result
        
        players = basic_result.get("players", [])
        
        # Step 2: Extract player IDs
        player_ids = []
        for player in players:
            player_id = player.get('mlb_player_id') or player.get('player_id')
            if player_id:
                player_ids.append(player_id)
        
        if not player_ids:
            logger.info("No player IDs found, returning basic result")
            return basic_result
        
        logger.info(f"Enhancing {len(player_ids)} players with rolling stats")
        
        # Step 3: Try to get rolling stats from LEAGUES DB (not postgres!)
        rolling_lookup = {}
        try:
            player_ids_str = ','.join(map(str, player_ids))
            
            # Get rolling stats from CACHED leagues database
            rolling_query = f"""
                SELECT 
                    player_id,
                    games_played,
                    at_bats,
                    hits,
                    home_runs,
                    rbi,
                    runs,
                    stolen_bases,
                    batting_avg,
                    era,
                    wins,
                    saves,
                    innings_pitched,
                    whip,
                    strikeouts_pitched
                FROM player_rolling_stats
                WHERE player_id IN ({player_ids_str})
                  AND period = 'last_14_days'
                  AND as_of_date = CURRENT_DATE
                  AND league_id = :league_id::uuid
            """
            
            rolling_result = execute_sql(
                rolling_query, 
                {'league_id': league_id},
                database_name='leagues'  # CACHED IN LEAGUES DB!
            )
            
            if rolling_result and rolling_result.get('records'):
                for record in rolling_result['records']:
                    try:
                        player_id = get_value_from_field(record[0], 'long')
                        if player_id:
                            rolling_lookup[player_id] = {
                                'games_played': get_value_from_field(record[1], 'long'),
                                'at_bats': get_value_from_field(record[2], 'long'),
                                'hits': get_value_from_field(record[3], 'long'),
                                'home_runs': get_value_from_field(record[4], 'long'),
                                'rbi': get_value_from_field(record[5], 'long'),
                                'runs': get_value_from_field(record[6], 'long'),
                                'stolen_bases': get_value_from_field(record[7], 'long'),
                                'avg': get_value_from_field(record[8], 'decimal'),
                                'era': get_value_from_field(record[9], 'decimal'),
                                'wins': get_value_from_field(record[10], 'long'),
                                'saves': get_value_from_field(record[11], 'long'),
                                'innings_pitched': get_value_from_field(record[12], 'decimal'),
                                'whip': get_value_from_field(record[13], 'decimal'),
                                'strikeouts_pitched': get_value_from_field(record[14], 'long'),
                                'batting_avg': get_value_from_field(record[8], 'decimal'),
                                'strikeouts': get_value_from_field(record[14], 'long')
                            }
                    except Exception as e:
                        logger.warning(f"Error processing rolling stats for player {player_id}: {e}")
                        continue
                        
                logger.info(f"Got rolling stats for {len(rolling_lookup)} players")
            else:
                logger.info("No rolling stats found")
                
        except Exception as e:
            logger.warning(f"Could not get rolling stats (non-fatal): {e}")
        
        # Step 4: Add rolling stats to players
        for player in players:
            player_id = player.get('mlb_player_id') or player.get('player_id')
            
            # Ensure we have the basic stat fields
            if 'avg' not in player and 'batting_avg' in player:
                player['avg'] = player['batting_avg']
            if 'batting_avg' not in player and 'avg' in player:
                player['batting_avg'] = player['avg']
                
            # Add last_14_days data if available
            if player_id and player_id in rolling_lookup:
                player['last_14_days'] = rolling_lookup[player_id]
                logger.debug(f"Added rolling stats for player {player_id}")
            else:
                player['last_14_days'] = None
        
        # Step 5: Return enhanced result
        enhanced_result = {
            **basic_result,
            "display_rows": ["Season Stats", "Last 14 Days"],
            "enhanced": True,
            "data_source": "leagues_db_cached"
        }
        
        logger.info(f"Successfully enhanced {len(players)} players")
        return enhanced_result
        
    except Exception as e:
        logger.error(f"Error in get_free_agents_with_rolling: {e}", exc_info=True)
        
        # If all else fails, try to return basic free agents
        try:
            logger.info("Falling back to basic free agents")
            return await get_free_agents(
                league_id=league_id,
                position=position,
                search=search,
                limit=limit,
                offset=offset,
                current_user=current_user
            )
        except Exception as fallback_error:
            logger.error(f"Even fallback failed: {fallback_error}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to get free agents: {str(e)}"
            )

# =============================================================================
# ROSTER MANAGEMENT WITH ACCRUED STATS
# =============================================================================

@router.post("/add-player")
async def add_player_to_team(
    league_id: str,
    request: AddPlayerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a free agent player to user's team"""
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        team_id = get_user_team_id(league_id, user_id)
        if not team_id:
            raise HTTPException(status_code=404, detail="User team not found in this league")
        
        # Check if player is available as free agent
        availability_check = execute_sql(
            """SELECT availability_status, mlb_player_id FROM league_players 
               WHERE league_id = :league_id::uuid AND league_player_id = :league_player_id::uuid""",
            parameters={'league_id': league_id, 'league_player_id': request.league_player_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        if not availability_check or not availability_check.get("records"):
            raise HTTPException(status_code=404, detail="Player not found in league")
        
        availability_status = availability_check["records"][0][0]["stringValue"]
        mlb_player_id = int(availability_check["records"][0][1]["longValue"])
        
        if availability_status != 'free_agent':
            raise HTTPException(status_code=400, detail="Player is not available as a free agent")
        
        # Add player to team
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
            WHERE league_id = :league_id::uuid AND league_player_id = :league_player_id::uuid
            """,
            parameters={
                'league_id': league_id,
                'team_id': team_id,
                'roster_status': request.roster_status,
                'salary': request.salary,
                'contract_years': request.contract_years,
                'acquisition_date': datetime.now(timezone.utc).isoformat(),
                'league_player_id': request.league_player_id
            },
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Record initial roster status
        record_roster_status_change(
            league_id, request.league_player_id, team_id, 
            request.roster_status, user_id, "Added from free agency"
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
            "contract_years": request.contract_years,
            "roster_status": request.roster_status
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
    """Drop a player from user's team"""
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        team_id = get_user_team_id(league_id, user_id)
        if not team_id:
            raise HTTPException(status_code=404, detail="User team not found in this league")
        
        # Verify player belongs to user's team
        ownership_check = execute_sql(
            """SELECT team_id, mlb_player_id FROM league_players 
               WHERE league_id = :league_id::uuid AND league_player_id = :league_player_id::uuid""",
            parameters={'league_id': league_id, 'league_player_id': request.league_player_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        if not ownership_check or not ownership_check.get("records"):
            raise HTTPException(status_code=404, detail="Player not found")
        
        player_team_id = ownership_check["records"][0][0]["stringValue"]
        mlb_player_id = int(ownership_check["records"][0][1]["longValue"])
        
        if player_team_id != team_id:
            raise HTTPException(status_code=403, detail="Player does not belong to your team")
        
        # End roster status history
        today = date.today()
        execute_sql(
            """UPDATE roster_status_history 
               SET end_date = :today 
               WHERE league_id = :league_id::uuid 
                 AND league_player_id = :player_id::uuid 
                 AND end_date IS NULL""",
            {'league_id': league_id, 'player_id': request.league_player_id, 'today': today},
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Drop player (release to free agency)
        execute_sql(
            """
            UPDATE league_players
            SET team_id = NULL,
                availability_status = 'free_agent',
                roster_status = NULL,
                acquisition_date = NULL,
                acquisition_method = NULL
            WHERE league_id = :league_id::uuid AND league_player_id = :league_player_id::uuid
            """,
            parameters={'league_id': league_id, 'league_player_id': request.league_player_id},
            database_name='leagues'  # SHARED DATABASE
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
            database_name='leagues'  # SHARED DATABASE
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
            database_name='leagues'  # SHARED DATABASE
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
    current_user: dict = Depends(get_current_user)
):
    """Get current user's roster with CURRENT season stats from CACHED leagues DB."""
    try:
        current_season = CURRENT_SEASON
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
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
            database_name='leagues'  # SHARED DATABASE
        )
        
        team_name = "My Team"
        if team_info and team_info.get("records"):
            team_name = team_info["records"][0][0]["stringValue"]
        
        # Get roster from shared database with CACHED season stats
        league_roster_query = f"""
        SELECT
            lp.league_player_id,
            lp.mlb_player_id,
            lp.roster_status,
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
            database_name='leagues'  # CACHED STATS IN LEAGUES DB!
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
                "salary": get_value_from_field(record[3], 'decimal'),
                "contract_years": get_value_from_field(record[4], 'long'),
                "acquisition_date": get_value_from_field(record[5], 'string'),
                "acquisition_method": get_value_from_field(record[6], 'string'),
                "batting_avg": get_value_from_field(record[7], 'decimal'),
                "home_runs": get_value_from_field(record[8], 'long'),
                "rbi": get_value_from_field(record[9], 'long'),
                "era": get_value_from_field(record[10], 'decimal'),
                "wins": get_value_from_field(record[11], 'long'),
                "saves": get_value_from_field(record[12], 'long'),
                "strikeouts_pitched": get_value_from_field(record[13], 'long'),
                "innings_pitched": get_value_from_field(record[14], 'decimal')
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
            "data_source": "leagues_db_cached"
        }
        
    except Exception as e:
        logger.error(f"Error getting roster: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting roster: {str(e)}")

@router.get("/my-roster-enhanced")
async def get_my_roster_with_accrued(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Team roster with 3-row display:
    Row 1: Season stats (from CACHED leagues DB)
    Row 2: Last 14 days rolling stats (from leagues DB)
    Row 3: Accrued while ACTIVE on roster (from leagues DB)
    """
    try:
        # Get basic roster first
        basic_result = await get_my_roster(league_id, current_user)
        
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
                database_name='leagues'  # CACHED IN LEAGUES DB!
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
                database_name='leagues'  # SHARED DATABASE
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

# =============================================================================
# TRANSACTION HISTORY
# =============================================================================

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

# =============================================================================
# PLACEHOLDER ENDPOINTS (FOR FUTURE IMPLEMENTATION)
# =============================================================================

@router.post("/trades")
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

@router.get("/trades")
async def get_trade_proposals(league_id: str, current_user: dict = Depends(get_current_user)):
    """Get pending trade proposals"""
    return {
        "success": False,
        "message": "Trade proposals endpoint not yet implemented",
        "todo": "Return trades involving user's team"
    }

@router.get("/waivers")
async def get_waiver_wire(league_id: str, current_user: dict = Depends(get_current_user)):
    """Get waiver wire players"""
    return {
        "success": False,
        "message": "Waiver wire endpoint not yet implemented",
        "todo": "Return players with availability_status = 'waiver'"
    }

@router.post("/waivers/{player_id}/claim")
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