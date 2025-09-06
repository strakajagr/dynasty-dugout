"""
Dynasty Dugout - Global Player Statistics
PURPOSE: Player endpoints that don't require league context
INCLUDES: Basic info, career stats, complete data with analytics
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, Dict, Any, List
import logging

from core.database import execute_sql
from core.auth_utils import get_current_user
from core.season_utils import CURRENT_SEASON
from .analytics import PlayerAnalytics
from .utils import (
    get_decimal_value, get_long_value, get_string_value, get_boolean_value,
    calculate_career_totals
)

logger = logging.getLogger(__name__)

router = APIRouter()

# =============================================================================
# BASIC PLAYER INFORMATION
# =============================================================================

@router.get("/search")
async def search_players(
    query: str = Query(..., min_length=2),
    limit: int = Query(20, le=50),
    position: Optional[str] = None,
    mlb_team: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Search for players across all MLB
    This is for the main dashboard player search feature
    """
    try:
        # Build search conditions
        conditions = []
        parameters = {'query': f'%{query}%', 'limit': limit}
        
        conditions.append("""
            (LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER(:query)
            OR LOWER(p.first_name) LIKE LOWER(:query)
            OR LOWER(p.last_name) LIKE LOWER(:query))
        """)
        
        if position:
            conditions.append("p.position = :position")
            parameters['position'] = position
        
        if mlb_team:
            conditions.append("p.mlb_team = :team")
            parameters['team'] = mlb_team
        
        where_clause = " AND ".join(conditions)
        
        search_query = f"""
        SELECT 
            p.player_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            p.is_active,
            ps.batting_avg,
            ps.home_runs,
            ps.rbi,
            ps.ops,
            ps.era,
            ps.wins,
            ps.saves
        FROM mlb_players p
        LEFT JOIN player_season_stats ps 
            ON p.player_id = ps.player_id 
            AND ps.season = {CURRENT_SEASON}
        WHERE {where_clause}
        ORDER BY 
            CASE 
                WHEN LOWER(p.first_name || ' ' || p.last_name) = LOWER(:query) THEN 1
                WHEN LOWER(p.last_name) = LOWER(:query) THEN 2
                ELSE 3
            END,
            COALESCE(ps.home_runs, 0) + COALESCE(ps.rbi, 0) DESC
        LIMIT :limit
        """
        
        result = execute_sql(search_query, parameters=parameters, database_name='postgres')
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                players.append({
                    'player_id': get_long_value(record[0]),
                    'first_name': get_string_value(record[1]),
                    'last_name': get_string_value(record[2]),
                    'full_name': f"{get_string_value(record[1])} {get_string_value(record[2])}",
                    'position': get_string_value(record[3]),
                    'mlb_team': get_string_value(record[4]),
                    'is_active': get_boolean_value(record[5]),
                    'current_season': {
                        'batting_avg': get_decimal_value(record[6]),
                        'home_runs': get_long_value(record[7]),
                        'rbi': get_long_value(record[8]),
                        'ops': get_decimal_value(record[9]),
                        'era': get_decimal_value(record[10]),
                        'wins': get_long_value(record[11]),
                        'saves': get_long_value(record[12])
                    }
                })
        
        return {
            "success": True,
            "count": len(players),
            "players": players
        }
        
    except Exception as e:
        logger.error(f"Error searching players: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# ANALYTICS ENDPOINT
# =============================================================================

@router.get("/{player_id}")
async def get_player_info(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get basic player information from main database"""
    try:
        query = """
            SELECT 
                player_id,
                first_name,
                last_name,
                position,
                mlb_team,
                jersey_number,
                is_active,
                height_inches,
                weight_pounds,
                birthdate
            FROM mlb_players
            WHERE player_id = :player_id
        """
        
        result = execute_sql(
            query,
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        if not result or not result.get("records"):
            raise HTTPException(status_code=404, detail="Player not found")
        
        record = result["records"][0]
        
        return {
            "success": True,
            "player": {
                "player_id": get_long_value(record[0]),
                "first_name": get_string_value(record[1]),
                "last_name": get_string_value(record[2]),
                "position": get_string_value(record[3]),
                "mlb_team": get_string_value(record[4]),
                "jersey_number": get_string_value(record[5]),
                "is_active": get_boolean_value(record[6]),
                "height_inches": get_long_value(record[7]) if len(record) > 7 else None,
                "weight_pounds": get_long_value(record[8]) if len(record) > 8 else None,
                "birthdate": get_string_value(record[9]) if len(record) > 9 else None
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting player info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# CAREER STATISTICS
# =============================================================================

@router.get("/{player_id}/career-stats")
async def get_player_career_stats(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get player's career statistics from main database"""
    try:
        query = """
            SELECT 
                season,
                games_played,
                at_bats,
                runs,
                hits,
                doubles,
                triples,
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
                innings_pitched,
                hits_allowed,
                earned_runs,
                walks_allowed,
                strikeouts_pitched,
                era,
                whip,
                quality_starts,
                blown_saves,
                holds
            FROM player_season_stats
            WHERE player_id = :player_id
            ORDER BY season DESC
        """
        
        result = execute_sql(
            query,
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        seasons = []
        if result and result.get("records"):
            for record in result["records"]:
                seasons.append({
                    "season": get_long_value(record[0]),
                    "games_played": get_long_value(record[1]),
                    "at_bats": get_long_value(record[2]),
                    "runs": get_long_value(record[3]),
                    "hits": get_long_value(record[4]),
                    "doubles": get_long_value(record[5]),
                    "triples": get_long_value(record[6]),
                    "home_runs": get_long_value(record[7]),
                    "rbi": get_long_value(record[8]),
                    "stolen_bases": get_long_value(record[9]),
                    "caught_stealing": get_long_value(record[10]),
                    "walks": get_long_value(record[11]),
                    "strikeouts": get_long_value(record[12]),
                    "batting_avg": get_decimal_value(record[13]),
                    "obp": get_decimal_value(record[14]),
                    "slg": get_decimal_value(record[15]),
                    "ops": get_decimal_value(record[16]),
                    "games_started": get_long_value(record[17]),
                    "wins": get_long_value(record[18]),
                    "losses": get_long_value(record[19]),
                    "saves": get_long_value(record[20]),
                    "innings_pitched": get_decimal_value(record[21]),
                    "hits_allowed": get_long_value(record[22]),
                    "earned_runs": get_long_value(record[23]),
                    "walks_allowed": get_long_value(record[24]),
                    "strikeouts_pitched": get_long_value(record[25]),
                    "era": get_decimal_value(record[26]),
                    "whip": get_decimal_value(record[27]),
                    "quality_starts": get_long_value(record[28]),
                    "blown_saves": get_long_value(record[29]),
                    "holds": get_long_value(record[30])
                })
        
        return {
            "success": True,
            "player_id": player_id,
            "career_stats": seasons
        }
        
    except Exception as e:
        logger.error(f"Error getting career stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# COMPLETE PLAYER DATA ENDPOINT - WITH ENHANCED ANALYTICS
# =============================================================================

@router.get("/{player_id}/complete")
async def get_complete_player_data(
    player_id: int,
    league_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Get COMPLETE player data including stats, analytics, and contract info
    """
    try:
        logger.info(f"Getting complete data for player {player_id}, league {league_id}")
        
        # STEP 1: Get basic player info
        basic_query = """
            SELECT 
                player_id, first_name, last_name, position, mlb_team,
                jersey_number, is_active, height_inches, weight_pounds, birthdate
            FROM mlb_players 
            WHERE player_id = :player_id
        """
        
        basic_result = execute_sql(basic_query, parameters={'player_id': player_id}, database_name='postgres')
        
        if not basic_result or not basic_result.get("records") or len(basic_result["records"]) == 0:
            raise HTTPException(status_code=404, detail="Player not found")
        
        basic_record = basic_result["records"][0]
        
        # STEP 2: Get 2025 season stats from main DB
        season_query = """
            SELECT 
                games_played, at_bats, runs, hits, doubles, triples, home_runs, rbi,
                stolen_bases, caught_stealing, walks, strikeouts, batting_avg, obp, slg, ops,
                games_started, wins, losses, saves, innings_pitched, hits_allowed, earned_runs,
                walks_allowed, strikeouts_pitched, era, whip, quality_starts, blown_saves, holds,
                hit_by_pitch, home_runs_allowed
            FROM player_season_stats
            WHERE player_id = :player_id AND season = :season
        """
        
        season_result = execute_sql(
            season_query, 
            parameters={'player_id': player_id, 'season': CURRENT_SEASON},
            database_name='postgres'
        )
        
        season_stats = None
        if season_result and season_result.get("records") and len(season_result["records"]) > 0:
            record = season_result["records"][0]
            season_stats = {
                'games_played': get_long_value(record[0]),
                'at_bats': get_long_value(record[1]),
                'runs': get_long_value(record[2]),
                'hits': get_long_value(record[3]),
                'doubles': get_long_value(record[4]),
                'triples': get_long_value(record[5]),
                'home_runs': get_long_value(record[6]),
                'rbi': get_long_value(record[7]),
                'stolen_bases': get_long_value(record[8]),
                'caught_stealing': get_long_value(record[9]),
                'walks': get_long_value(record[10]),
                'strikeouts': get_long_value(record[11]),
                'batting_avg': get_decimal_value(record[12]),
                'obp': get_decimal_value(record[13]),
                'slg': get_decimal_value(record[14]),
                'ops': get_decimal_value(record[15]),
                'games_started': get_long_value(record[16]),
                'wins': get_long_value(record[17]),
                'losses': get_long_value(record[18]),
                'saves': get_long_value(record[19]),
                'innings_pitched': get_decimal_value(record[20]),
                'hits_allowed': get_long_value(record[21]),
                'earned_runs': get_long_value(record[22]),
                'walks_allowed': get_long_value(record[23]),
                'strikeouts_pitched': get_long_value(record[24]),
                'era': get_decimal_value(record[25]),
                'whip': get_decimal_value(record[26]),
                'quality_starts': get_long_value(record[27]),
                'blown_saves': get_long_value(record[28]),
                'holds': get_long_value(record[29]),
                'hit_by_pitch': get_long_value(record[30]),
                'home_runs_allowed': get_long_value(record[31])
            }

        # STEP 3: Get 14-day rolling stats
        rolling_query = """
            SELECT 
                games_played, at_bats, hits, home_runs, rbi, runs, stolen_bases, walks, strikeouts,
                batting_avg, obp, slg, ops, games_started, innings_pitched, wins, losses, saves,
                earned_runs, era, whip, quality_starts, strikeouts_pitched, caught_stealing,
                blown_saves, hits_allowed, walks_allowed
            FROM player_rolling_stats 
            WHERE player_id = :player_id 
                AND period = 'last_14_days' 
                AND as_of_date = CURRENT_DATE
        """
        
        rolling_result = execute_sql(
            rolling_query, 
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        rolling_stats = None
        if rolling_result and rolling_result.get("records") and len(rolling_result["records"]) > 0:
            record = rolling_result["records"][0]
            rolling_stats = {
                'games_played': get_long_value(record[0]),
                'at_bats': get_long_value(record[1]),
                'hits': get_long_value(record[2]),
                'home_runs': get_long_value(record[3]),
                'rbi': get_long_value(record[4]),
                'runs': get_long_value(record[5]),
                'stolen_bases': get_long_value(record[6]),
                'walks': get_long_value(record[7]),
                'strikeouts': get_long_value(record[8]),
                'batting_avg': get_decimal_value(record[9]),
                'obp': get_decimal_value(record[10]),
                'slg': get_decimal_value(record[11]),
                'ops': get_decimal_value(record[12]),
                'games_started': get_long_value(record[13]),
                'innings_pitched': get_decimal_value(record[14]),
                'wins': get_long_value(record[15]),
                'losses': get_long_value(record[16]),
                'saves': get_long_value(record[17]),
                'earned_runs': get_long_value(record[18]),
                'era': get_decimal_value(record[19]),
                'whip': get_decimal_value(record[20]),
                'quality_starts': get_long_value(record[21]),
                'strikeouts_pitched': get_long_value(record[22]),
                'caught_stealing': get_long_value(record[23]),
                'blown_saves': get_long_value(record[24]),
                'hits_allowed': get_long_value(record[25]),
                'walks_allowed': get_long_value(record[26])
            }

        # STEP 4: Get career history
        career_query = """
            SELECT 
                season, games_played, at_bats, runs, hits, doubles, triples, home_runs, rbi,
                stolen_bases, caught_stealing, walks, strikeouts, batting_avg, obp, slg, ops,
                games_started, wins, losses, saves, innings_pitched, hits_allowed, earned_runs,
                walks_allowed, strikeouts_pitched, era, whip, quality_starts, blown_saves, holds
            FROM player_season_stats
            WHERE player_id = :player_id
            ORDER BY season DESC
        """
        
        career_result = execute_sql(
            career_query, 
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        career_stats = []
        if career_result and career_result.get("records"):
            for record in career_result["records"]:
                career_stats.append({
                    'season_year': get_long_value(record[0]),
                    'games_played': get_long_value(record[1]),
                    'at_bats': get_long_value(record[2]),
                    'runs': get_long_value(record[3]),
                    'hits': get_long_value(record[4]),
                    'doubles': get_long_value(record[5]),
                    'triples': get_long_value(record[6]),
                    'home_runs': get_long_value(record[7]),
                    'rbi': get_long_value(record[8]),
                    'stolen_bases': get_long_value(record[9]),
                    'caught_stealing': get_long_value(record[10]),
                    'walks': get_long_value(record[11]),
                    'strikeouts': get_long_value(record[12]),
                    'batting_avg': get_decimal_value(record[13]),
                    'obp': get_decimal_value(record[14]),
                    'slg': get_decimal_value(record[15]),
                    'ops': get_decimal_value(record[16]),
                    'games_started': get_long_value(record[17]),
                    'wins': get_long_value(record[18]),
                    'losses': get_long_value(record[19]),
                    'saves': get_long_value(record[20]),
                    'innings_pitched': get_decimal_value(record[21]),
                    'hits_allowed': get_long_value(record[22]),
                    'earned_runs': get_long_value(record[23]),
                    'walks_allowed': get_long_value(record[24]),
                    'strikeouts_pitched': get_long_value(record[25]),
                    'era': get_decimal_value(record[26]),
                    'whip': get_decimal_value(record[27]),
                    'quality_starts': get_long_value(record[28]),
                    'blown_saves': get_long_value(record[29]),
                    'holds': get_long_value(record[30])
                })

        # STEP 5: Get 2025 game logs
        game_logs_query = """
            SELECT 
                game_date, opponent, at_bats, hits, doubles, triples, home_runs, rbi, runs,
                walks, strikeouts, stolen_bases, caught_stealing, hit_by_pitch,
                innings_pitched, wins, losses, saves, blown_saves, holds, earned_runs,
                hits_allowed, walks_allowed, strikeouts_pitched, quality_start
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND EXTRACT(YEAR FROM game_date) = :season
            ORDER BY game_date DESC
            LIMIT 50
        """
        
        game_logs_result = execute_sql(
            game_logs_query, 
            parameters={'player_id': player_id, 'season': CURRENT_SEASON},
            database_name='postgres'
        )
        
        game_logs = []
        if game_logs_result and game_logs_result.get("records"):
            for record in game_logs_result["records"]:
                game_logs.append({
                    'game_date': get_string_value(record[0]),
                    'opponent': get_string_value(record[1]),
                    'at_bats': get_long_value(record[2]),
                    'hits': get_long_value(record[3]),
                    'doubles': get_long_value(record[4]),
                    'triples': get_long_value(record[5]),
                    'home_runs': get_long_value(record[6]),
                    'rbi': get_long_value(record[7]),
                    'runs': get_long_value(record[8]),
                    'walks': get_long_value(record[9]),
                    'strikeouts': get_long_value(record[10]),
                    'stolen_bases': get_long_value(record[11]),
                    'caught_stealing': get_long_value(record[12]),
                    'hit_by_pitch': get_long_value(record[13]),
                    'innings_pitched': get_decimal_value(record[14]),
                    'wins': get_long_value(record[15]),
                    'losses': get_long_value(record[16]),
                    'saves': get_long_value(record[17]),
                    'blown_saves': get_long_value(record[18]),
                    'holds': get_long_value(record[19]),
                    'earned_runs': get_long_value(record[20]),
                    'hits_allowed': get_long_value(record[21]),
                    'walks_allowed': get_long_value(record[22]),
                    'strikeouts_pitched': get_long_value(record[23]),
                    'quality_start': get_boolean_value(record[24])
                })

        # STEP 6: Get contract info if league_id provided
        contract_info = None
        if league_id:
            contract_query = """
                SELECT 
                    lp.salary, lp.contract_years, lp.roster_status,
                    lt.team_name, lt.manager_name
                FROM league_players lp
                LEFT JOIN league_teams lt ON lp.team_id = lt.team_id AND lp.league_id = lt.league_id
                WHERE lp.league_id = :league_id::uuid 
                    AND lp.mlb_player_id = :player_id
            """
            
            contract_result = execute_sql(
                contract_query,
                parameters={'league_id': league_id, 'player_id': player_id},
                database_name='leagues'
            )
            
            if contract_result and contract_result.get("records") and len(contract_result["records"]) > 0:
                record = contract_result["records"][0]
                contract_info = {
                    'salary': get_decimal_value(record[0]),
                    'contract_years': get_long_value(record[1]),
                    'roster_status': get_string_value(record[2]),
                    'team_name': get_string_value(record[3]) or 'Free Agent',
                    'owner_name': get_string_value(record[4]) or 'Available'
                }

        # STEP 7: Calculate COMPREHENSIVE analytics using the enhanced module
        analytics_calculator = PlayerAnalytics(player_id, league_id)
        analytics = analytics_calculator.get_comprehensive_analytics()

        # STEP 8: Calculate career totals
        position = get_string_value(basic_record[3])
        career_totals = calculate_career_totals(career_stats, position) if career_stats else None

        # STEP 9: Build and return complete response
        return {
            "success": True,
            "player_id": player_id,
            "first_name": get_string_value(basic_record[1]),
            "last_name": get_string_value(basic_record[2]),
            "position": position,
            "mlb_team": get_string_value(basic_record[4]),
            "jersey_number": get_string_value(basic_record[5]),
            "is_active": get_boolean_value(basic_record[6]),
            "height_inches": get_long_value(basic_record[7]) if len(basic_record) > 7 else None,
            "weight_pounds": get_long_value(basic_record[8]) if len(basic_record) > 8 else None,
            "birthdate": get_string_value(basic_record[9]) if len(basic_record) > 9 else None,
            "season_2025_stats": season_stats,
            "rolling_14_day_stats": rolling_stats,
            "career_stats": career_stats,
            "career_totals": career_totals,
            "game_logs_2025": game_logs,
            "contract_info": contract_info,
            "analytics": analytics
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting complete player data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get player data: {str(e)}")

# =============================================================================
# PLAYER SEARCH (for main dashboard)
# =============================================================================

@router.get("/{player_id}/analytics")
async def get_player_analytics(
    player_id: int,
    league_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive analytics for a player"""
    try:
        analytics_calculator = PlayerAnalytics(player_id, league_id)
        analytics = analytics_calculator.get_comprehensive_analytics()
        
        return {
            "success": True,
            "player_id": player_id,
            "analytics": analytics
        }
        
    except Exception as e:
        logger.error(f"Error getting player analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# DEBUG ENDPOINT (remove in production)
# =============================================================================

@router.get("/debug/leagues-schema")
async def debug_leagues_schema():
    """Check league_teams columns"""
    result = execute_sql(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'league_teams' ORDER BY ordinal_position",
        database_name='leagues'
    )
    if result and result.get("records"):
        return {"columns": [r[0].get('stringValue') for r in result["records"]]}
    return {"error": "No results"}