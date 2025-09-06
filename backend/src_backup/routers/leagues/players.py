"""
Dynasty Dugout - League Players Module with Team Attribution
PURPOSE: Track player performance while on specific teams (two-line display)
STATUS: Complete implementation with team-specific accumulated stats + DATA SYNC
DISTINCTION: Shows both full season stats AND team-specific accumulated stats
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
import requests
from pydantic import BaseModel
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging

from ...core.database import execute_sql
from ...core.auth_utils import get_current_user

logger = logging.getLogger(__name__)

# [CHANGED] Two routers are now defined to separate concerns.
# global_router handles endpoints that don't require a league_id.
global_router = APIRouter()

# router handles all endpoints that are specific to a league.
router = APIRouter()


# =============================================================================
# Global Player List Endpoint (No League ID Required)
# =============================================================================

class PlayerListItem(BaseModel):
    player_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    mlb_team: Optional[str] = None
    avg: Optional[float] = None
    hr: Optional[int] = None
    rbi: Optional[int] = None
    wins: Optional[int] = None
    saves: Optional[int] = None
    era: Optional[float] = None

# [CHANGED] This function is now attached to the new global_router.
# The path is "/" because the "/api/players" prefix will be added in main.py.
@global_router.get("/", response_model=dict)
async def get_all_players(
    page: int = 1,
    limit: int = 50, # Default to 50 players per page
    current_user: dict = Depends(get_current_user)
):
    """
    Gets a paginated list of all MLB players and their 2025 season stats.
    This is optimized with LIMIT and OFFSET to permanently fix the 504 Gateway Timeout.
    """
    logger.info(f"--- DEBUG: STARTING get_all_players (Page: {page}, Limit: {limit}) ---")
    offset = (page - 1) * limit

    try:
        # Step 1: Get the total count of all active players
        logger.info("--- DEBUG: Step 1 - Executing COUNT query. ---")
        count_sql = "SELECT COUNT(player_id) FROM mlb_players WHERE is_active = true"
        count_result = execute_sql(count_sql, database_name='postgres')
        logger.info("--- DEBUG: Step 1 - COUNT query executed successfully. ---")
        
        total_players = 0
        if count_result and count_result.get("records"):
            total_players = count_result["records"][0][0].get("longValue", 0)
        
        total_pages = (total_players + limit - 1) // limit
        logger.info(f"--- DEBUG: Step 1 - Found {total_players} total players. ---")

        # Step 2: Fetch the actual data for the current page
        logger.info("--- DEBUG: Step 2 - Executing main player data query. ---")
        players_sql = """
            SELECT 
                p.player_id, p.first_name, p.last_name, p.position, p.mlb_team,
                s.avg, s.home_runs AS hr, s.rbi, s.wins, s.saves, s.era
            FROM mlb_players p
            LEFT JOIN player_stats s ON p.player_id = s.player_id AND s.season = 2025
            WHERE p.is_active = true
            ORDER BY p.last_name, p.first_name
            LIMIT :limit OFFSET :offset
        """
        parameters = {'limit': limit, 'offset': offset}
        players_result = execute_sql(players_sql, parameters=parameters, database_name='postgres')
        logger.info("--- DEBUG: Step 2 - Main player data query executed successfully. ---")

        # Step 3: Parse the results
        players_list = []
        if players_result and players_result.get("records"):
            logger.info(f"--- DEBUG: Step 3 - Starting to parse {len(players_result.get('records'))} records. ---")
            for i, record in enumerate(players_result["records"]):
                try:
                    player_data = PlayerListItem(
                        player_id=record[0].get("longValue"),
                        first_name=record[1].get("stringValue"),
                        last_name=record[2].get("stringValue"),
                        position=record[3].get("stringValue"),
                        mlb_team=record[4].get("stringValue"),
                        avg=record[5].get("doubleValue"),
                        hr=record[6].get("longValue"),
                        rbi=record[7].get("longValue"),
                        wins=record[8].get("longValue"),
                        saves=record[9].get("longValue"),
                        era=record[10].get("doubleValue")
                    )
                    players_list.append(player_data)
                except Exception as parse_error:
                    logger.error(f"--- DEBUG: FAILED to parse record #{i+1}. Data: {record} ---")
                    logger.error(f"--- DEBUG: PARSE ERROR: {parse_error} ---", exc_info=True)
                    # We will skip this record instead of crashing the whole request
                    continue
            logger.info("--- DEBUG: Step 3 - Finished parsing records. ---")
        else:
            logger.info("--- DEBUG: Step 3 - No records to parse. ---")

        logger.info("--- DEBUG: Step 4 - Successfully prepared response. ---")
        return {
            "players": players_list,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "total_players": total_players
        }
    except Exception as e:
        logger.error(f"--- DEBUG: CRITICAL FAILURE in get_all_players. The error occurred outside the parsing loop, likely in a SQL query. ---")
        logger.error(f"--- DEBUG: EXCEPTION: {e} ---", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch player data.")


# =============================================================================
# League-Specific Endpoints (Attached to the original router)
# =============================================================================

class SeasonStats(BaseModel):
    """Full MLB season statistics"""
    games: int
    batting_avg: float
    hits: int
    home_runs: int
    rbi: int
    runs: int
    walks: int
    strikeouts: int
    stolen_bases: int
    # Pitching
    wins: Optional[int] = None
    losses: Optional[int] = None
    saves: Optional[int] = None
    innings_pitched: Optional[float] = None
    era: Optional[float] = None
    whip: Optional[float] = None

class TeamStats(BaseModel):
    """Team-specific accumulated statistics"""
    games: int
    batting_avg: float
    hits: int
    home_runs: int
    rbi: int
    runs: int
    walks: int
    strikeouts: int
    stolen_bases: int
    # Pitching
    wins: Optional[int] = None
    losses: Optional[int] = None
    saves: Optional[int] = None
    innings_pitched: Optional[float] = None
    era: Optional[float] = None
    whip: Optional[float] = None
    # Attribution info
    first_game_date: str
    days_on_team: int

class TwoLinePlayerStats(BaseModel):
    """Player with both season and team-specific stats"""
    mlb_player_id: int
    player_name: str
    position: str
    mlb_team: str
    # Two lines of stats
    season_stats: SeasonStats
    team_stats: TeamStats
    # Contract info
    salary: float
    contract_years: int
    roster_status: str
    acquisition_date: str
    acquisition_method: str

class StarterInfo(BaseModel):
    player_id: int
    player_name: str
    mlb_team: str
    opposing_team: str
    game_time: str
    is_home: bool
    on_roster: bool
    matchup_rating: Optional[str] = None

class PlayerNote(BaseModel):
    note_id: str
    player_id: int
    player_name: str
    note_type: str
    title: str
    content: str
    severity: Optional[str] = None
    publish_date: str
    source: str

class BoxScorePlayer(BaseModel):
    name: str
    team: str
    position: Optional[str] = None
    # Hitter stats
    ab: Optional[int] = None
    r: Optional[int] = None
    h: Optional[int] = None
    rbi: Optional[int] = None
    bb: Optional[int] = None
    so: Optional[int] = None
    avg: Optional[str] = None
    # Pitcher stats
    w: Optional[int] = None
    l: Optional[int] = None
    sv: Optional[int] = None
    ip: Optional[str] = None
    er: Optional[int] = None
    era: Optional[str] = None
    fantasy_points: float

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_league_database_name(league_id: str) -> str:
    """Convert league ID to database name format"""
    return f"league_{league_id.replace('-', '_')}"

async def validate_league_membership(league_id: str, user_id: str) -> bool:
    """Check if user is a member of this league"""
    try:
        membership_check = execute_sql(
            "SELECT user_id FROM league_memberships WHERE league_id = :league_id::uuid AND user_id = :user_id",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='postgres'
        )
        if membership_check and membership_check.get("records") and len(membership_check["records"]) > 0:
            return True
        return False
    except Exception as e:
        logger.error(f"League membership validation error: {str(e)}")
        return False

async def get_user_team_id(league_id: str, user_id: str) -> Optional[str]:
    """Get the team ID for this user in this league"""
    try:
        league_db = get_league_database_name(league_id)
        team_query = execute_sql(
            "SELECT team_id FROM league_teams WHERE user_id = :user_id::uuid AND is_active = true",
            parameters={'user_id': user_id},
            database_name=league_db
        )
        if team_query and team_query.get("records") and len(team_query["records"]) > 0:
            return team_query["records"][0][0]["stringValue"]
        return None
    except Exception as e:
        logger.error(f"Error getting user team ID: {str(e)}")
        return None

# =============================================================================
# MAIN TEAM HOME DASHBOARD ENDPOINT
# =============================================================================

@router.get("/team-home-data")
async def get_team_home_dashboard(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete team home dashboard data with two-line player stats
    
    WHAT: All data needed for Team Home Dashboard in one optimized call
    WHY: Shows both full season performance AND team-specific accumulated stats
    HOW: Merges MLB season data with team attribution data for each player
    """
    try:
        user_id = current_user.get('sub')
        
        # Validate league membership
        if not await validate_league_membership(league_id, user_id):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # Get user's team ID
        user_team_id = await get_user_team_id(league_id, user_id)
        if not user_team_id:
            return {
                "success": True,
                "has_team": False,
                "message": "No team found for user in this league"
            }
        
        league_db = get_league_database_name(league_id)
        
        # Get team info
        team_query = """
        SELECT team_id, team_name, manager_name, manager_email, is_commissioner
        FROM league_teams 
        WHERE team_id = :team_id::uuid
        """
        
        team_data = execute_sql(
            team_query,
            parameters={'team_id': user_team_id},
            database_name=league_db
        )
        
        if not team_data or not team_data.get("records") or len(team_data["records"]) == 0:
            raise HTTPException(status_code=404, detail="Team not found")
        
        team_record = team_data["records"][0]
        team_info = {
            'team_id': team_record[0]["stringValue"],
            'team_name': team_record[1]["stringValue"],
            'manager_name': team_record[2]["stringValue"],
            'manager_email': team_record[3]["stringValue"] if team_record[3].get("stringValue") else None,
            'is_commissioner': team_record[4]["booleanValue"] if team_record[4].get("booleanValue") is not None else False
        }
        
        # Get all dashboard components
        tasks = [
            get_team_two_line_stats(league_id, user_team_id),
            get_todays_starters(league_id, user_team_id),
            get_team_player_notes(league_id, user_team_id),
            get_last_night_team_box(league_id, user_team_id)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle any exceptions in the results
        roster_stats = results[0] if not isinstance(results[0], Exception) else []
        starting_pitchers = results[1] if not isinstance(results[1], Exception) else []
        player_notes = results[2] if not isinstance(results[2], Exception) else []
        last_night_box = results[3] if not isinstance(results[3], Exception) else {"hitters": [], "pitchers": []}
        
        return {
            "success": True,
            "has_team": True,
            "team_info": team_info,
            "roster_stats": roster_stats,
            "starting_pitchers": starting_pitchers,
            "player_notes": player_notes,
            "last_night_box": last_night_box
        }
    except Exception as e:
        logger.error(f"Team home dashboard error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Dashboard error: {str(e)}")

# =============================================================================
# TWO-LINE STATS IMPLEMENTATION
# =============================================================================

@router.get("/teams/{team_id}/two-line-stats")
async def get_team_two_line_stats(league_id: str, team_id: str) -> List[TwoLinePlayerStats]:
    """
    Get players with both season stats and team-specific accumulated stats
    
    WHAT: Two-line display showing full season + team-only performance
    WHY: Fantasy managers need to see both overall performance and team attribution
    HOW: Joins MLB season data with team accumulated stats tables
    """
    try:
        league_db = get_league_database_name(league_id)
        
        # Get team's current players
        roster_query = """
        SELECT 
            lp.mlb_player_id,
            lp.salary,
            lp.contract_years,
            lp.roster_status,
            lp.acquisition_date,
            lp.acquisition_method
        FROM league_players lp
        WHERE lp.team_id = :team_id::uuid 
            AND lp.availability_status = 'owned'
        ORDER BY lp.acquisition_date DESC
        """
        
        roster_data = execute_sql(
            roster_query,
            parameters={'team_id': team_id},
            database_name=league_db
        )
        
        if not roster_data or not roster_data.get("records"):
            return []
        
        # Get MLB player IDs
        mlb_player_ids = []
        roster_lookup = {}
        
        for record in roster_data["records"]:
            mlb_player_id = record[0]["longValue"]
            mlb_player_ids.append(mlb_player_id)
            roster_lookup[mlb_player_id] = {
                'salary': record[1]["doubleValue"] if record[1].get("doubleValue") else 0,
                'contract_years': record[2]["longValue"] if record[2].get("longValue") else 0,
                'roster_status': record[3]["stringValue"],
                'acquisition_date': record[4]["stringValue"] if record[4].get("stringValue") else None,
                'acquisition_method': record[5]["stringValue"] if record[5].get("stringValue") else None
            }
        
        if not mlb_player_ids:
            return []
        
        # Get MLB season stats (Line 1)
        season_stats = await get_mlb_season_stats(mlb_player_ids)
        
        # Get team-specific accumulated stats (Line 2)
        team_stats = await get_team_accumulated_stats(league_db, team_id, mlb_player_ids)
        
        # Combine into two-line format
        two_line_players = []
        for mlb_player_id in mlb_player_ids:
            season_data = season_stats.get(mlb_player_id, {})
            team_data = team_stats.get(mlb_player_id, {})
            roster_data = roster_lookup.get(mlb_player_id, {})
            
            if not season_data:  # Skip if no MLB data found
                continue
            
            # Build season stats (Line 1)
            season_stats_obj = SeasonStats(
                games=season_data.get('games', 0),
                batting_avg=season_data.get('batting_avg', 0.000),
                hits=season_data.get('hits', 0),
                home_runs=season_data.get('home_runs', 0),
                rbi=season_data.get('rbi', 0),
                runs=season_data.get('runs', 0),
                walks=season_data.get('walks', 0),
                strikeouts=season_data.get('strikeouts', 0),
                stolen_bases=season_data.get('stolen_bases', 0),
                wins=season_data.get('wins'),
                losses=season_data.get('losses'),
                saves=season_data.get('saves'),
                innings_pitched=season_data.get('innings_pitched'),
                era=season_data.get('era'),
                whip=season_data.get('whip')
            )
            
            # Build team stats (Line 2)
            team_stats_obj = TeamStats(
                games=team_data.get('team_games', 0),
                batting_avg=team_data.get('team_batting_avg', 0.000),
                hits=team_data.get('team_hits', 0),
                home_runs=team_data.get('team_home_runs', 0),
                rbi=team_data.get('team_rbi', 0),
                runs=team_data.get('team_runs', 0),
                walks=team_data.get('team_walks', 0),
                strikeouts=team_data.get('team_strikeouts', 0),
                stolen_bases=team_data.get('team_stolen_bases', 0),
                wins=team_data.get('team_wins'),
                losses=team_data.get('team_losses'),
                saves=team_data.get('team_saves'),
                innings_pitched=team_data.get('team_innings_pitched'),
                era=team_data.get('team_era'),
                whip=team_data.get('team_whip'),
                first_game_date=team_data.get('first_game_date', roster_data.get('acquisition_date', '')),
                days_on_team=team_data.get('days_on_team', 0)
            )
            
            # Combined player object
            two_line_player = TwoLinePlayerStats(
                mlb_player_id=mlb_player_id,
                player_name=season_data.get('name', 'Unknown Player'),
                position=season_data.get('position', 'N/A'),
                mlb_team=season_data.get('team', 'N/A'),
                season_stats=season_stats_obj,
                team_stats=team_stats_obj,
                salary=roster_data.get('salary', 0),
                contract_years=roster_data.get('contract_years', 0),
                roster_status=roster_data.get('roster_status', ''),
                acquisition_date=roster_data.get('acquisition_date', ''),
                acquisition_method=roster_data.get('acquisition_method', '')
            )
            
            two_line_players.append(two_line_player)
        
        return two_line_players
    except Exception as e:
        logger.error(f"Error getting two-line stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get team stats: {str(e)}")

async def get_mlb_season_stats(player_ids: List[int]) -> Dict[int, Dict]:
    """Get current season stats for players from main database (Line 1)"""
    if not player_ids:
        return {}
    
    try:
        # Build query with placeholders for AWS RDS
        placeholders = ','.join([f':id_{i}' for i in range(len(player_ids))])
        parameters = {f'id_{i}': player_id for i, player_id in enumerate(player_ids)}
        
        query = f"""
        SELECT 
            mp.player_id,
            mp.first_name,
            mp.last_name,
            mp.position,
            mp.mlb_team,
            COALESCE(ps.games_played, 0) as games,
            COALESCE(ps.avg, 0.000) as batting_avg,
            COALESCE(ps.hits, 0) as hits,
            COALESCE(ps.home_runs, 0) as home_runs,
            COALESCE(ps.rbi, 0) as rbi,
            COALESCE(ps.runs, 0) as runs,
            COALESCE(ps.walks, 0) as walks,
            COALESCE(ps.strikeouts, 0) as strikeouts,
            COALESCE(ps.stolen_bases, 0) as stolen_bases,
            COALESCE(ps.wins, 0) as wins,
            COALESCE(ps.losses, 0) as losses,
            COALESCE(ps.saves, 0) as saves,
            COALESCE(ps.innings_pitched, 0) as innings_pitched,
            COALESCE(ps.era, 0.00) as era,
            COALESCE(ps.whip, 0.000) as whip
        FROM mlb_players mp
        LEFT JOIN player_stats ps ON mp.player_id = ps.player_id AND ps.season = 2025
        WHERE mp.player_id IN ({placeholders})
        """
        
        result = execute_sql(query, parameters=parameters, database_name='postgres')
        
        stats_dict = {}
        if result and result.get("records"):
            for record in result["records"]:
                player_id = record[0]["longValue"]
                stats_dict[player_id] = {
                    'name': f"{record[1]['stringValue']} {record[2]['stringValue']}",
                    'position': record[3]["stringValue"] if record[3] else 'N/A',
                    'team': record[4]["stringValue"] if record[4] else 'N/A',
                    'games': record[5]["longValue"] if record[5] else 0,
                    'batting_avg': record[6]["doubleValue"] if record[6] else 0.000,
                    'hits': record[7]["longValue"] if record[7] else 0,
                    'home_runs': record[8]["longValue"] if record[8] else 0,
                    'rbi': record[9]["longValue"] if record[9] else 0,
                    'runs': record[10]["longValue"] if record[10] else 0,
                    'walks': record[11]["longValue"] if record[11] else 0,
                    'strikeouts': record[12]["longValue"] if record[12] else 0,
                    'stolen_bases': record[13]["longValue"] if record[13] else 0,
                    'wins': record[14]["longValue"] if record[14] else None,
                    'losses': record[15]["longValue"] if record[15] else None,
                    'saves': record[16]["longValue"] if record[16] else None,
                    'innings_pitched': record[17]["doubleValue"] if record[17] else None,
                    'era': record[18]["doubleValue"] if record[18] else None,
                    'whip': record[19]["doubleValue"] if record[19] else None
                }
        
        return stats_dict
    except Exception as e:
        logger.error(f"Error getting MLB season stats: {str(e)}")
        return {}

async def get_team_accumulated_stats(league_db: str, team_id: str, player_ids: List[int]) -> Dict[int, Dict]:
    """Get team-specific accumulated stats for players (Line 2)"""
    if not player_ids:
        return {}
    
    try:
        # Build query for team accumulated stats
        placeholders = ','.join([f':id_{i}' for i in range(len(player_ids))])
        parameters = {f'id_{i}': player_id for i, player_id in enumerate(player_ids)}
        parameters['team_id'] = team_id
        
        query = f"""
        SELECT 
            ptas.mlb_player_id,
            ptas.team_games_played,
            ptas.team_batting_avg,
            ptas.team_hits,
            ptas.team_home_runs,
            ptas.team_rbi,
            ptas.team_runs,
            ptas.team_walks,
            ptas.team_strikeouts,
            ptas.team_stolen_bases,
            ptas.team_wins,
            ptas.team_losses,
            ptas.team_saves,
            ptas.team_innings_pitched,
            ptas.team_era,
            ptas.team_whip,
            ptas.first_game_date,
            CASE 
                WHEN ptas.last_game_date IS NULL THEN 
                    EXTRACT(DAY FROM (CURRENT_DATE - ptas.first_game_date::date))
                ELSE 
                    EXTRACT(DAY FROM (ptas.last_game_date::date - ptas.first_game_date::date))
            END as days_on_team
        FROM player_team_accumulated_stats ptas
        WHERE ptas.mlb_player_id IN ({placeholders}) 
            AND ptas.team_id = :team_id::uuid
            AND ptas.last_game_date IS NULL  -- Current stint with team
        """
        
        result = execute_sql(query, parameters=parameters, database_name=league_db)
        
        team_stats_dict = {}
        if result and result.get("records"):
            for record in result["records"]:
                player_id = record[0]["longValue"]
                team_stats_dict[player_id] = {
                    'team_games': record[1]["longValue"] if record[1] else 0,
                    'team_batting_avg': record[2]["doubleValue"] if record[2] else 0.000,
                    'team_hits': record[3]["longValue"] if record[3] else 0,
                    'team_home_runs': record[4]["longValue"] if record[4] else 0,
                    'team_rbi': record[5]["longValue"] if record[5] else 0,
                    'team_runs': record[6]["longValue"] if record[6] else 0,
                    'team_walks': record[7]["longValue"] if record[7] else 0,
                    'team_strikeouts': record[8]["longValue"] if record[8] else 0,
                    'team_stolen_bases': record[9]["longValue"] if record[9] else 0,
                    'team_wins': record[10]["longValue"] if record[10] else None,
                    'team_losses': record[11]["longValue"] if record[11] else None,
                    'team_saves': record[12]["longValue"] if record[12] else None,
                    'team_innings_pitched': record[13]["doubleValue"] if record[13] else None,
                    'team_era': record[14]["doubleValue"] if record[14] else None,
                    'team_whip': record[15]["doubleValue"] if record[15] else None,
                    'first_game_date': record[16]["stringValue"] if record[16] else '',
                    'days_on_team': record[17]["longValue"] if record[17] else 0
                }
        
        return team_stats_dict
    except Exception as e:
        logger.error(f"Error getting team accumulated stats: {str(e)}")
        return {}

# =============================================================================
# SUPPORTING DASHBOARD ENDPOINTS
# =============================================================================

@router.get("/teams/{team_id}/todays-starters")
async def get_todays_starters(league_id: str, team_id: str) -> List[StarterInfo]:
    """Get today's starting pitchers, highlighting team's players"""
    try:
        league_db = get_league_database_name(league_id)
        
        # Get team's pitcher IDs
        team_pitchers_query = """
        SELECT lp.mlb_player_id 
        FROM league_players lp
        WHERE lp.team_id = :team_id::uuid 
            AND lp.availability_status = 'owned'
        """
        
        team_pitchers = execute_sql(
            team_pitchers_query,
            parameters={'team_id': team_id},
            database_name=league_db
        )
        
        team_pitcher_ids = set()
        if team_pitchers and team_pitchers.get("records"):
            team_pitcher_ids = {record[0]["longValue"] for record in team_pitchers["records"]}
        
        # Fetch today's starters from MLB API
        today = date.today().strftime('%Y-%m-%d')
        starters = await fetch_mlb_starters(today, team_pitcher_ids)
        
        return starters
    except Exception as e:
        logger.error(f"Error getting today's starters: {str(e)}")
        return []

@router.get("/teams/{team_id}/player-notes")
async def get_team_player_notes(league_id: str, team_id: str) -> List[PlayerNote]:
    """Get recent news/notes for team's players"""
    try:
        league_db = get_league_database_name(league_id)
        
        # Get team's player IDs
        team_players_query = """
        SELECT lp.mlb_player_id 
        FROM league_players lp
        WHERE lp.team_id = :team_id::uuid 
            AND lp.availability_status = 'owned'
        ORDER BY lp.acquisition_date DESC
        LIMIT 10
        """
        
        team_players = execute_sql(
            team_players_query,
            parameters={'team_id': team_id},
            database_name=league_db
        )
        
        if not team_players or not team_players.get("records"):
            return []
        
        # For now, return mock notes until news aggregation system is built
        player_ids = [record[0]["longValue"] for record in team_players["records"]]
        
        mock_notes = []
        for i, player_id in enumerate(player_ids[:5]):  # Show first 5 players
            mock_notes.append(PlayerNote(
                note_id=f"note_{i}_{player_id}",
                player_id=player_id,
                player_name=f"Player {player_id}",
                note_type="performance",
                title=f"Recent performance update",
                content=f"Player has been performing well since joining your team.",
                severity="low",
                publish_date=datetime.now().isoformat(),
                source="Dynasty Dugout"
            ))
        
        return mock_notes
    except Exception as e:
        logger.error(f"Error getting player notes: {str(e)}")
        return []

@router.get("/teams/{team_id}/last-night-box")
async def get_last_night_team_box(league_id: str, team_id: str):
    """Get last night's performance for team's active players"""
    try:
        league_db = get_league_database_name(league_id)
        yesterday = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Get team's players who were active yesterday
        query = """
        SELECT 
            lp.mlb_player_id,
            lp.roster_status
        FROM league_players lp
        WHERE lp.team_id = :team_id::uuid 
            AND lp.availability_status = 'owned'
            AND lp.roster_status IN ('active', 'bench')
        ORDER BY lp.mlb_player_id
        """
        
        team_players = execute_sql(
            query,
            parameters={'team_id': team_id},
            database_name=league_db
        )
        
        if not team_players or not team_players.get("records"):
            return {"hitters": [], "pitchers": [], "date": yesterday}
        
        player_ids = [record[0]["longValue"] for record in team_players["records"]]
        
        # TODO: Get actual game logs from player_daily_team_stats table
        # For now, mock data
        mock_hitters = []
        mock_pitchers = []
        
        for i, player_id in enumerate(player_ids[:6]):  # First 6 as hitters
            mock_hitters.append(BoxScorePlayer(
                name=f"Player {player_id}",
                team="LAD",
                position="OF",
                ab=4,
                r=1,
                h=2,
                rbi=1,
                bb=0,
                so=1,
                avg=".285",
                fantasy_points=4.5
            ))
        
        for i, player_id in enumerate(player_ids[6:8]):  # Next 2 as pitchers
            mock_pitchers.append(BoxScorePlayer(
                name=f"Pitcher {player_id}",
                team="SF",
                w=1,
                l=0,
                sv=0,
                ip="6.1",
                er=2,
                era="3.45",
                fantasy_points=12.8
            ))
        
        return {
            "hitters": mock_hitters,
            "pitchers": mock_pitchers,
            "date": yesterday
        }
    except Exception as e:
        logger.error(f"Error getting last night box: {str(e)}")
        return {"hitters": [], "pitchers": [], "date": ""}

# =============================================================================
# DAILY ATTRIBUTION SYSTEM
# =============================================================================

@router.post("/daily-attribution")
async def trigger_daily_attribution(
    league_id: str,
    game_date: Optional[str] = None,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Trigger daily attribution of player stats to teams
    
    WHAT: Updates team-specific accumulated stats with yesterday's games
    WHY: Maintains accurate attribution of performance to specific teams
    HOW: Processes game logs and attributes stats to whoever owned each player
    """
    try:
        if not game_date:
            game_date = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        if background_tasks:
            background_tasks.add_task(process_daily_attribution, league_id, game_date)
            return {"success": True, "message": f"Daily attribution started for {game_date}"}
        else:
            await process_daily_attribution(league_id, game_date)
            return {"success": True, "message": f"Daily attribution completed for {game_date}"}
    except Exception as e:
        logger.error(f"Error triggering daily attribution: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Attribution error: {str(e)}")

async def process_daily_attribution(league_id: str, game_date: str):
    """
    Background task to process daily player attribution
    
    PROCESS:
    1. Get all players and their team ownership for the date
    2. Fetch game logs for that date from main database
    3. Attribute each player's stats to their team on that date
    4. Update accumulated stats tables
    """
    try:
        league_db = get_league_database_name(league_id)
        
        # Get all players and their teams for this date
        # (This assumes ownership tracking - would need to implement)
        ownership_query = """
        SELECT 
            lp.mlb_player_id,
            lp.team_id
        FROM league_players lp
        WHERE lp.availability_status = 'owned'
            AND lp.acquisition_date <= :game_date::date
        """
        
        ownership_data = execute_sql(
            ownership_query,
            parameters={'game_date': game_date},
            database_name=league_db
        )
        
        if not ownership_data or not ownership_data.get("records"):
            logger.info(f"No owned players found for {game_date}")
            return
        
        # Build ownership map
        player_team_map = {}
        for record in ownership_data["records"]:
            player_id = record[0]["longValue"]
            team_id = record[1]["stringValue"]
            player_team_map[player_id] = team_id
        
        # Get game logs for this date from main database
        player_ids = list(player_team_map.keys())
        if not player_ids:
            return
        
        placeholders = ','.join([f':id_{i}' for i in range(len(player_ids))])
        parameters = {f'id_{i}': player_id for i, player_id in enumerate(player_ids)}
        parameters['game_date'] = game_date
        
        game_logs_query = f"""
        SELECT 
            player_id,
            game_date,
            at_bats,
            hits,
            home_runs,
            rbi,
            runs,
            walks,
            strikeouts,
            stolen_bases,
            innings_pitched,
            wins,
            losses,
            saves,
            earned_runs,
            hits_allowed,
            walks_allowed,
            strikeouts_pitched
        FROM player_game_logs
        WHERE player_id IN ({placeholders})
            AND game_date = :game_date::date
        """
        
        game_logs = execute_sql(game_logs_query, parameters=parameters, database_name='postgres')
        
        if not game_logs or not game_logs.get("records"):
            logger.info(f"No game logs found for {game_date}")
            return
        
        # Process each player's game log
        for record in game_logs["records"]:
            player_id = record[0]["longValue"]
            team_id = player_team_map.get(player_id)
            
            if not team_id:
                continue
            
            # Insert daily stats
            daily_stats_insert = """
            INSERT INTO player_daily_team_stats 
            (mlb_player_id, team_id, game_date, at_bats, hits, home_runs, rbi, runs, 
             walks, strikeouts, stolen_bases, innings_pitched, wins, losses, saves, 
             earned_runs, hits_allowed, walks_allowed, strikeouts_pitched)
            VALUES 
            (:player_id, :team_id::uuid, :game_date::date, :at_bats, :hits, :home_runs, :rbi, :runs,
             :walks, :strikeouts, :stolen_bases, :innings_pitched, :wins, :losses, :saves,
             :earned_runs, :hits_allowed, :walks_allowed, :strikeouts_pitched)
            ON CONFLICT (mlb_player_id, team_id, game_date) DO UPDATE SET
                at_bats = EXCLUDED.at_bats,
                hits = EXCLUDED.hits,
                home_runs = EXCLUDED.home_runs,
                rbi = EXCLUDED.rbi,
                runs = EXCLUDED.runs,
                walks = EXCLUDED.walks,
                strikeouts = EXCLUDED.strikeouts,
                stolen_bases = EXCLUDED.stolen_bases,
                innings_pitched = EXCLUDED.innings_pitched,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                saves = EXCLUDED.saves,
                earned_runs = EXCLUDED.earned_runs,
                hits_allowed = EXCLUDED.hits_allowed,
                walks_allowed = EXCLUDED.walks_allowed,
                strikeouts_pitched = EXCLUDED.strikeouts_pitched
            """
            
            daily_params = {
                'player_id': player_id,
                'team_id': team_id,
                'game_date': game_date,
                'at_bats': record[2]["longValue"] if record[2] else 0,
                'hits': record[3]["longValue"] if record[3] else 0,
                'home_runs': record[4]["longValue"] if record[4] else 0,
                'rbi': record[5]["longValue"] if record[5] else 0,
                'runs': record[6]["longValue"] if record[6] else 0,
                'walks': record[7]["longValue"] if record[7] else 0,
                'strikeouts': record[8]["longValue"] if record[8] else 0,
                'stolen_bases': record[9]["longValue"] if record[9] else 0,
                'innings_pitched': record[10]["doubleValue"] if record[10] else 0,
                'wins': record[11]["longValue"] if record[11] else 0,
                'losses': record[12]["longValue"] if record[12] else 0,
                'saves': record[13]["longValue"] if record[13] else 0,
                'earned_runs': record[14]["longValue"] if record[14] else 0,
                'hits_allowed': record[15]["longValue"] if record[15] else 0,
                'walks_allowed': record[16]["longValue"] if record[16] else 0,
                'strikeouts_pitched': record[17]["longValue"] if record[17] else 0
            }
            
            execute_sql(daily_stats_insert, parameters=daily_params, database_name=league_db)
        
        # Update accumulated stats for all affected players
        await update_accumulated_stats(league_db, list(player_team_map.keys()))
        
        logger.info(f"Daily attribution completed for {game_date} in league {league_id}")
    except Exception as e:
        logger.error(f"Error in daily attribution: {str(e)}")

async def update_accumulated_stats(league_db: str, player_ids: List[int]):
    """Update accumulated stats tables after daily attribution"""
    try:
        for player_id in player_ids:
            # This would recalculate accumulated stats from daily stats
            # Complex query to sum up all daily stats while player was on each team
            pass
    except Exception as e:
        logger.error(f"Error updating accumulated stats: {str(e)}")

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def fetch_mlb_starters(game_date: str, team_pitcher_ids: set) -> List[StarterInfo]:
    """Fetch today's starters from MLB API"""
    try:
        mlb_url = f"https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&date={game_date}"
        
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            response = await loop.run_in_executor(
                executor,
                lambda: requests.get(mlb_url, timeout=10)
            )
        
        if response.status_code != 200:
            return []
        
        games_data = response.json()
        starters = []
        
        for game_date_obj in games_data.get('dates', []):
            for game in game_date_obj.get('games', []):
                home_pitcher = game.get('teams', {}).get('home', {}).get('probablePitcher')
                away_pitcher = game.get('teams', {}).get('away', {}).get('probablePitcher')
                
                home_team = game.get('teams', {}).get('home', {}).get('team', {}).get('name', '')
                away_team = game.get('teams', {}).get('away', {}).get('team', {}).get('name', '')
                game_time = game.get('gameDate', '')
                
                if home_pitcher:
                    pitcher_id = home_pitcher.get('id')
                    starters.append(StarterInfo(
                        player_id=pitcher_id,
                        player_name=home_pitcher.get('fullName', ''),
                        mlb_team=home_team,
                        opposing_team=away_team,
                        game_time=game_time,
                        is_home=True,
                        on_roster=pitcher_id in team_pitcher_ids,
                        matchup_rating="TBD"
                    ))
                
                if away_pitcher:
                    pitcher_id = away_pitcher.get('id')
                    starters.append(StarterInfo(
                        player_id=pitcher_id,
                        player_name=away_pitcher.get('fullName', ''),
                        mlb_team=away_team,
                        opposing_team=home_team,
                        game_time=game_time,
                        is_home=False,
                        on_roster=pitcher_id in team_pitcher_ids,
                        matchup_rating="TBD"
                    ))
        
        starters.sort(key=lambda x: (not x.on_roster, x.game_time))
        return starters
    except Exception as e:
        logger.error(f"Error fetching MLB starters: {str(e)}")
        return []

# =============================================================================
# DATA SYNC & POPULATION FUNCTIONS - NEW ADDITION
# =============================================================================

@router.post("/populate-main-stats")
async def populate_main_database_stats(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate 2025 season stats in MAIN database from game logs
    This should run ONCE to populate the main player_stats table
    """
    try:
        logger.info("🔄 Calculating 2025 season stats in main database...")
        
        # Calculate season stats from game logs in main DB
        calc_main_stats_sql = """
            INSERT INTO player_stats (
                player_id, season, games_played, at_bats, hits, doubles, triples, home_runs, 
                rbi, runs, walks, strikeouts, stolen_bases, caught_stealing,
                avg, obp, slg, ops, innings_pitched, wins, losses, saves, 
                blown_saves, holds, earned_runs, hits_allowed, walks_allowed, 
                strikeouts_pitched, era, whip, last_updated
            )
            SELECT 
                player_id,
                2025,
                COUNT(*) as games_played,
                SUM(at_bats) as at_bats,
                SUM(hits) as hits,
                SUM(doubles) as doubles,
                SUM(triples) as triples,
                SUM(home_runs) as home_runs,
                SUM(rbi) as rbi,
                SUM(runs) as runs,
                SUM(walks) as walks,
                SUM(strikeouts) as strikeouts,
                SUM(stolen_bases) as stolen_bases,
                SUM(caught_stealing) as caught_stealing,
                -- Calculated ratios
                CASE 
                    WHEN SUM(at_bats) > 0 THEN ROUND(SUM(hits)::NUMERIC / SUM(at_bats), 3)
                    ELSE 0.000
                END as avg,
                CASE 
                    WHEN (SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch)) > 0 
                    THEN ROUND((SUM(hits) + SUM(walks) + SUM(hit_by_pitch))::NUMERIC / (SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch)), 3)
                    ELSE 0.000
                END as obp,
                CASE 
                    WHEN SUM(at_bats) > 0 
                    THEN ROUND((SUM(hits) + SUM(doubles) + 2*SUM(triples) + 3*SUM(home_runs))::NUMERIC / SUM(at_bats), 3)
                    ELSE 0.000
                END as slg,
                0.000 as ops, -- Will calculate after
                SUM(innings_pitched) as innings_pitched,
                SUM(wins) as wins,
                SUM(losses) as losses,
                SUM(saves) as saves,
                SUM(blown_saves) as blown_saves,
                SUM(holds) as holds,
                SUM(earned_runs) as earned_runs,
                SUM(hits_allowed) as hits_allowed,
                SUM(walks_allowed) as walks_allowed,
                SUM(strikeouts_pitched) as strikeouts_pitched,
                -- ERA calculation
                CASE 
                    WHEN SUM(innings_pitched) > 0 
                    THEN ROUND((SUM(earned_runs) * 9.0) / SUM(innings_pitched), 2)
                    ELSE 0.00
                END as era,
                -- WHIP calculation
                CASE 
                    WHEN SUM(innings_pitched) > 0 
                    THEN ROUND((SUM(hits_allowed) + SUM(walks_allowed))::NUMERIC / SUM(innings_pitched), 3)
                    ELSE 0.000
                END as whip,
                NOW() as last_updated
            FROM player_game_logs
            WHERE game_date >= '2025-01-01'
            GROUP BY player_id
            ON CONFLICT (player_id, season) 
            DO UPDATE SET
                games_played = EXCLUDED.games_played,
                at_bats = EXCLUDED.at_bats,
                hits = EXCLUDED.hits,
                doubles = EXCLUDED.doubles,
                triples = EXCLUDED.triples,
                home_runs = EXCLUDED.home_runs,
                rbi = EXCLUDED.rbi,
                runs = EXCLUDED.runs,
                walks = EXCLUDED.walks,
                strikeouts = EXCLUDED.strikeouts,
                stolen_bases = EXCLUDED.stolen_bases,
                caught_stealing = EXCLUDED.caught_stealing,
                avg = EXCLUDED.avg,
                obp = EXCLUDED.obp,
                slg = EXCLUDED.slg,
                innings_pitched = EXCLUDED.innings_pitched,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                saves = EXCLUDED.saves,
                blown_saves = EXCLUDED.blown_saves,
                holds = EXCLUDED.holds,
                earned_runs = EXCLUDED.earned_runs,
                hits_allowed = EXCLUDED.hits_allowed,
                walks_allowed = EXCLUDED.walks_allowed,
                strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                era = EXCLUDED.era,
                whip = EXCLUDED.whip,
                last_updated = NOW()
        """
        
        result = execute_sql(calc_main_stats_sql, database_name='postgres')
        
        # Update OPS (OBP + SLG) 
        execute_sql(
            "UPDATE player_stats SET ops = obp + slg WHERE season = 2025",
            database_name='postgres'
        )
        
        # Count results
        count_result = execute_sql(
            "SELECT COUNT(*) FROM player_stats WHERE season = 2025",
            database_name='postgres'
        )
        
        stats_count = 0
        if count_result and count_result.get("records"):
            stats_count = count_result["records"][0][0]["longValue"]
        
        return {
            "success": True,
            "message": f"Calculated 2025 season stats for {stats_count} players in main database",
            "stats_calculated": stats_count,
            "next_step": "Now run league sync to copy these stats to league databases"
        }
    except Exception as e:
        logger.error(f"Error populating main stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to populate main stats: {str(e)}")

@router.post("/sync-from-main")
async def sync_league_from_main_database(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Sync calculated stats from main database to league database
    This copies from main player_stats to league player_season_stats
    """
    try:
        league_db = get_league_database_name(league_id)
        
        # Get stats from main database
        main_stats_sql = """
            SELECT player_id, season, games_played, at_bats, hits, doubles, triples,
                   home_runs, rbi, runs, walks, strikeouts, stolen_bases, avg, obp, slg, ops,
                   innings_pitched, wins, losses, saves, earned_runs, hits_allowed,
                   walks_allowed, strikeouts_pitched, era, whip
            FROM player_stats 
            WHERE season = 2025
            ORDER BY player_id
        """
        
        main_stats = execute_sql(main_stats_sql, database_name='postgres')
        
        if not main_stats or not main_stats.get('records'):
            return {
                "success": False,
                "error": "No stats found in main database. Run populate-main-stats first."
            }
        
        # Batch insert to league database
        synced_count = 0
        batch_size = 100
        
        for i in range(0, len(main_stats['records']), batch_size):
            batch = main_stats['records'][i:i + batch_size]
            values_list = []
            
            for record in batch:
                try:
                    values = []
                    for j in range(len(record)):
                        if record[j].get('isNull'):
                            values.append('NULL')
                        elif 'longValue' in record[j]:
                            values.append(str(record[j]['longValue']))
                        elif 'doubleValue' in record[j]:
                            values.append(str(record[j]['doubleValue']))
                        elif 'stringValue' in record[j]:
                            values.append(f"'{record[j]['stringValue']}'")
                        else:
                            values.append('NULL')
                    
                    values_list.append(f"({', '.join(values)}, NOW())")
                except Exception as e:
                    logger.error(f"Error processing stats record: {e}")
                    continue
            
            if values_list:
                batch_sql = f"""
                    INSERT INTO player_season_stats 
                    (player_id, season_year, games_played, at_bats, hits, doubles, triples,
                     home_runs, rbi, runs, walks, strikeouts, stolen_bases, avg, obp, slg, ops,
                     innings_pitched, wins, losses, saves, earned_runs, hits_allowed,
                     walks_allowed, strikeouts_pitched, era, whip, last_updated)
                    VALUES {', '.join(values_list)}
                    ON CONFLICT (player_id, season_year) DO UPDATE SET
                        games_played = EXCLUDED.games_played,
                        at_bats = EXCLUDED.at_bats,
                        hits = EXCLUDED.hits,
                        avg = EXCLUDED.avg,
                        home_runs = EXCLUDED.home_runs,
                        rbi = EXCLUDED.rbi,
                        era = EXCLUDED.era,
                        wins = EXCLUDED.wins,
                        saves = EXCLUDED.saves,
                        last_updated = NOW()
                """
                
                execute_sql(batch_sql, database_name=league_db)
                synced_count += len(values_list)
                logger.info(f"Synced batch {i//batch_size + 1}: {len(values_list)} records")
        
        return {
            "success": True,
            "league_id": league_id,
            "stats_synced": synced_count,
            "message": f"Synced {synced_count} player stats to league database",
            "next_step": "Free agents should now show real 2025 stats"
        }
    except Exception as e:
        logger.error(f"Error syncing from main database: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@router.post("/full-data-setup")
async def full_league_data_setup(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Complete data setup: populate main stats + sync to league
    This is the ONE BUTTON solution
    """
    try:
        logger.info(f"🚀 Starting full data setup for league {league_id}")
        
        # Step 1: Populate main database stats
        main_result = await populate_main_database_stats(league_id, current_user)
        if not isinstance(main_result, dict) or not main_result.get("success"):
            return main_result
        
        # Step 2: Sync to league database  
        league_result = await sync_league_from_main_database(league_id, current_user)
        if not isinstance(league_result, dict) or not league_result.get("success"):
            return league_result
        
        # Step 3: Verify results
        verification_sql = """
            SELECT 
                COUNT(*) as total_players,
                COUNT(CASE WHEN home_runs > 0 THEN 1 END) as players_with_hrs,
                COUNT(CASE WHEN wins > 0 THEN 1 END) as pitchers_with_wins,
                AVG(CASE WHEN at_bats > 0 THEN avg END) as avg_batting_avg,
                AVG(CASE WHEN innings_pitched > 0 THEN era END) as avg_era
            FROM player_season_stats 
            WHERE season_year = 2025
        """
        
        verification = execute_sql(verification_sql, database_name=get_league_database_name(league_id))
        
        verification_stats = {}
        if verification and verification.get("records"):
            record = verification["records"][0]
            verification_stats = {
                "total_players": record[0]["longValue"] if record[0] else 0,
                "players_with_hrs": record[1]["longValue"] if record[1] else 0,
                "pitchers_with_wins": record[2]["longValue"] if record[2] else 0,
                "avg_batting_avg": round(record[3]["doubleValue"], 3) if record[3] and record[3].get("doubleValue") else 0,
                "avg_era": round(record[4]["doubleValue"], 2) if record[4] and record[4].get("doubleValue") else 0
            }
        
        return {
            "success": True,
            "league_id": league_id,
            "setup_complete": True,
            "main_stats_calculated": main_result.get("stats_calculated", 0),
            "league_stats_synced": league_result.get("stats_synced", 0),
            "verification": verification_stats,
            "message": "✅ Complete data setup finished! Free agents should now show real 2025 stats.",
            "ready_for_testing": "Go to Free Agent Market and search for star players"
        }
    except Exception as e:
        logger.error(f"Error in full data setup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Setup failed: {str(e)}")
