"""
Dynasty Dugout - Global Player Statistics (NO AUTH VERSION)
PURPOSE: ALL player endpoints in one place - the single source of truth
INCLUDES: Search, basic info, complete data, career stats, game logs, recent performance, analytics
NOTE: Authentication removed from public data endpoints
UPDATED: Tile analytics endpoints now accept optional league_id for league benchmarks
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime

from core.database import execute_sql
from core.auth_utils import get_current_user
from core.season_utils import get_current_season
from .analytics import PlayerAnalytics
from .utils import (
    calculate_career_totals
)

logger = logging.getLogger(__name__)


# Temporary helper functions until we refactor to dictionary access
def get_long_value(val):
    """Get long/int value from record field"""
    if val is None:
        return 0
    if isinstance(val, dict):
        if 'longValue' in val:
            return val['longValue']
        elif 'isNull' in val and val['isNull']:
            return 0
    return int(val) if val else 0

def get_decimal_value(val):
    """Get decimal/float value from record field"""
    if val is None:
        return 0.0
    if isinstance(val, dict):
        if 'doubleValue' in val:
            return val['doubleValue']
        elif 'isNull' in val and val['isNull']:
            return 0.0
    return float(val) if val else 0.0

def get_string_value(val):
    """Get string value from record field"""
    if val is None:
        return ''
    if isinstance(val, dict):
        if 'stringValue' in val:
            return val['stringValue']
        elif 'isNull' in val and val['isNull']:
            return ''
    return str(val) if val else ''

def get_boolean_value(val):
    """Get boolean value from record field"""
    if val is None:
        return False
    if isinstance(val, dict):
        if 'booleanValue' in val:
            return val['booleanValue']
        elif 'isNull' in val and val['isNull']:
            return False
    return bool(val) if val else False


router = APIRouter()

# =============================================================================
# PLAYER SEARCH - NO AUTH NEEDED (Public MLB data)
# =============================================================================

@router.get("/search")
async def search_players(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, le=50),
    position: Optional[str] = None,
    mlb_team: Optional[str] = None
):
    """
    Search for players across all MLB
    This is for the main dashboard player search feature
    NO AUTH NEEDED - Public MLB data
    """
    try:
        current_season = get_current_season()
        
        # Build search conditions
        conditions = []
        parameters = {'query': f'%{q}%', 'limit': limit}
        
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
            ps.saves,
            ps.strikeouts_pitched
        FROM mlb_players p
        LEFT JOIN player_season_stats ps 
            ON p.player_id = ps.player_id 
            AND ps.season = {current_season}
        WHERE {where_clause}
        ORDER BY 
            CASE 
                WHEN LOWER(p.first_name || ' ' || p.last_name) = LOWER(:exact) THEN 1
                WHEN LOWER(p.last_name) = LOWER(:exact) THEN 2
                ELSE 3
            END,
            COALESCE(ps.home_runs, 0) + COALESCE(ps.rbi, 0) DESC
        LIMIT :limit
        """
        
        # Add the exact match parameter
        parameters['exact'] = q
        
        result = execute_sql(search_query, parameters=parameters, database_name='postgres')
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                player_data = {
                    'player_id': get_long_value(record[0]),
                    'first_name': get_string_value(record[1]),
                    'last_name': get_string_value(record[2]),
                    'full_name': f"{get_string_value(record[1])} {get_string_value(record[2])}",
                    'position': get_string_value(record[3]),
                    'mlb_team': get_string_value(record[4]),
                    'is_active': get_boolean_value(record[5]),
                    'stats': {
                        'batting_avg': get_decimal_value(record[6]),
                        'home_runs': get_long_value(record[7]),
                        'rbi': get_long_value(record[8]),
                        'ops': get_decimal_value(record[9]),
                        'era': get_decimal_value(record[10]),
                        'wins': get_long_value(record[11]),
                        'saves': get_long_value(record[12]),
                        'strikeouts': get_long_value(record[13])
                    }
                }
                players.append(player_data)
        
        return {
            "success": True,
            "count": len(players),
            "players": players
        }
        
    except Exception as e:
        logger.error(f"Error searching players: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# BASIC PLAYER INFO - NO AUTH NEEDED (Public MLB data)
# =============================================================================

@router.get("/{player_id}")
async def get_player_info(
    player_id: int
):
    """Get basic player information from main database
    NO AUTH NEEDED - Public MLB data"""
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
# COMPLETE PLAYER DATA - THE MAIN ENDPOINT - NO AUTH FOR PUBLIC DATA
# =============================================================================

@router.get("/{player_id}/complete")
async def get_complete_player_data(
    player_id: int,
    league_id: Optional[str] = Query(None),
    season: Optional[int] = Query(None)
    # REMOVED: current_user: dict = Depends(get_current_user)
):
    """
    Get COMPLETE player data including stats, analytics, game logs, and contract info
    This is the main endpoint used by PlayerProfile
    NO AUTH NEEDED for public MLB data
    League-specific contract info only returned if league_id provided
    """
    try:
        # Use dynamic season or override
        current_season = season or get_current_season()
        logger.info(f"Getting complete data for player {player_id}, league {league_id}, season {current_season}")
        
        # STEP 1: Get basic player info
        basic_query = """
            SELECT 
                player_id, first_name, last_name, position, mlb_team,
                jersey_number, is_active, height_inches, weight_pounds, birthdate,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate)) as age
            FROM mlb_players 
            WHERE player_id = :player_id
        """
        
        basic_result = execute_sql(basic_query, parameters={'player_id': player_id}, database_name='postgres')
        
        if not basic_result or not basic_result.get("records") or len(basic_result["records"]) == 0:
            raise HTTPException(status_code=404, detail="Player not found")
        
        basic_record = basic_result["records"][0]
        position = get_string_value(basic_record[3])
        is_pitcher = position in ['P', 'SP', 'RP', 'CP', 'CL']
        
        # STEP 2: Get current season stats
        season_query = """
            SELECT 
                games_played, at_bats, runs, hits, doubles, triples, home_runs, rbi,
                stolen_bases, caught_stealing, walks, strikeouts, batting_avg, obp, slg, ops,
                games_started, wins, losses, saves, innings_pitched, hits_allowed, earned_runs,
                walks_allowed, strikeouts_pitched, era, whip, quality_starts, blown_saves, holds,
                hit_by_pitch, home_runs_allowed, plate_appearances
            FROM player_season_stats
            WHERE player_id = :player_id AND season = :season
        """
        
        season_result = execute_sql(
            season_query, 
            parameters={'player_id': player_id, 'season': current_season},
            database_name='postgres'
        )
        
        season_stats = None
        if season_result and season_result.get("records") and len(season_result["records"]) > 0:
            record = season_result["records"][0]
            
            # Build base stats
            season_stats = {
                'season': current_season,
                'games_played': get_long_value(record[0]) or 0,
                'games': get_long_value(record[0]) or 0,  # Alias for compatibility
                'at_bats': get_long_value(record[1]) or 0,
                'runs': get_long_value(record[2]) or 0,
                'hits': get_long_value(record[3]) or 0,
                'doubles': get_long_value(record[4]) or 0,
                'triples': get_long_value(record[5]) or 0,
                'home_runs': get_long_value(record[6]) or 0,
                'rbi': get_long_value(record[7]) or 0,
                'stolen_bases': get_long_value(record[8]) or 0,
                'caught_stealing': get_long_value(record[9]) or 0,
                'walks': get_long_value(record[10]) or 0,
                'strikeouts': get_long_value(record[11]) or 0,
                'batting_avg': get_decimal_value(record[12]) or 0,
                'obp': get_decimal_value(record[13]) or 0,
                'slg': get_decimal_value(record[14]) or 0,
                'ops': get_decimal_value(record[15]) or 0,
                'hit_by_pitch': get_long_value(record[30]) if len(record) > 30 else 0,
                'plate_appearances': get_long_value(record[32]) if len(record) > 32 else 0
            }
            
            # Add pitching stats if pitcher
            if is_pitcher:
                season_stats.update({
                    'games_started': get_long_value(record[16]) or 0,
                    'wins': get_long_value(record[17]) or 0,
                    'losses': get_long_value(record[18]) or 0,
                    'saves': get_long_value(record[19]) or 0,
                    'innings_pitched': get_decimal_value(record[20]) or 0,
                    'hits_allowed': get_long_value(record[21]) or 0,
                    'earned_runs': get_long_value(record[22]) or 0,
                    'walks_allowed': get_long_value(record[23]) or 0,
                    'strikeouts_pitched': get_long_value(record[24]) or 0,
                    'era': get_decimal_value(record[25]) or 0,
                    'whip': get_decimal_value(record[26]) or 0,
                    'quality_starts': get_long_value(record[27]) or 0,
                    'blown_saves': get_long_value(record[28]) or 0,
                    'holds': get_long_value(record[29]) if len(record) > 29 else 0,
                    'home_runs_allowed': get_long_value(record[31]) if len(record) > 31 else 0
                })
                
                # Also add nested pitching object for compatibility
                season_stats['pitching'] = {
                    'games_started': season_stats['games_started'],
                    'wins': season_stats['wins'],
                    'losses': season_stats['losses'],
                    'saves': season_stats['saves'],
                    'innings_pitched': season_stats['innings_pitched'],
                    'hits_allowed': season_stats['hits_allowed'],
                    'earned_runs': season_stats['earned_runs'],
                    'walks_allowed': season_stats['walks_allowed'],
                    'strikeouts_pitched': season_stats['strikeouts_pitched'],
                    'era': season_stats['era'],
                    'whip': season_stats['whip'],
                    'quality_starts': season_stats['quality_starts'],
                    'blown_saves': season_stats['blown_saves'],
                    'holds': season_stats['holds'],
                    'home_runs_allowed': season_stats['home_runs_allowed']
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
        
        rolling_14_day = None
        if rolling_result and rolling_result.get("records") and len(rolling_result["records"]) > 0:
            record = rolling_result["records"][0]
            
            rolling_14_day = {
                'games': get_long_value(record[0]) or 0,
                'at_bats': get_long_value(record[1]) or 0,
                'hits': get_long_value(record[2]) or 0,
                'home_runs': get_long_value(record[3]) or 0,
                'rbi': get_long_value(record[4]) or 0,
                'runs': get_long_value(record[5]) or 0,
                'stolen_bases': get_long_value(record[6]) or 0,
                'walks': get_long_value(record[7]) or 0,
                'strikeouts': get_long_value(record[8]) or 0,
                'batting_avg': get_decimal_value(record[9]) or 0,
                'obp': get_decimal_value(record[10]) or 0,
                'slg': get_decimal_value(record[11]) or 0,
                'ops': get_decimal_value(record[12]) or 0,
                'caught_stealing': get_long_value(record[23]) or 0,
            }
            
            # Add pitching stats if pitcher
            if is_pitcher:
                rolling_14_day.update({
                    'games_started': get_long_value(record[13]) or 0,
                    'innings_pitched': get_decimal_value(record[14]) or 0,
                    'wins': get_long_value(record[15]) or 0,
                    'losses': get_long_value(record[16]) or 0,
                    'saves': get_long_value(record[17]) or 0,
                    'earned_runs': get_long_value(record[18]) or 0,
                    'era': get_decimal_value(record[19]) or 0,
                    'whip': get_decimal_value(record[20]) or 0,
                    'quality_starts': get_long_value(record[21]) or 0,
                    'strikeouts_pitched': get_long_value(record[22]) or 0,
                    'blown_saves': get_long_value(record[24]) or 0,
                    'hits_allowed': get_long_value(record[25]) or 0,
                    'walks_allowed': get_long_value(record[26]) or 0
                })
                
                # Also add nested pitching object for compatibility
                rolling_14_day['pitching'] = {
                    'games_started': rolling_14_day['games_started'],
                    'innings_pitched': rolling_14_day['innings_pitched'],
                    'wins': rolling_14_day['wins'],
                    'losses': rolling_14_day['losses'],
                    'saves': rolling_14_day['saves'],
                    'earned_runs': rolling_14_day['earned_runs'],
                    'era': rolling_14_day['era'],
                    'whip': rolling_14_day['whip'],
                    'quality_starts': rolling_14_day['quality_starts'],
                    'strikeouts_pitched': rolling_14_day['strikeouts_pitched'],
                    'blown_saves': rolling_14_day['blown_saves'],
                    'hits_allowed': rolling_14_day['hits_allowed'],
                    'walks_allowed': rolling_14_day['walks_allowed']
                }

        # STEP 4: Get career history - FIXED WITH mlb_team
        career_query = """
            SELECT 
                season, mlb_team, games_played, at_bats, runs, hits, doubles, triples, home_runs, rbi,
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
                    'season': get_long_value(record[0]),
                    'mlb_team': get_string_value(record[1]),  # FIXED - now at correct index
                    'games_played': get_long_value(record[2]),
                    'at_bats': get_long_value(record[3]),
                    'runs': get_long_value(record[4]),
                    'hits': get_long_value(record[5]),
                    'doubles': get_long_value(record[6]),
                    'triples': get_long_value(record[7]),
                    'home_runs': get_long_value(record[8]),
                    'rbi': get_long_value(record[9]),
                    'stolen_bases': get_long_value(record[10]),
                    'caught_stealing': get_long_value(record[11]),
                    'walks': get_long_value(record[12]),
                    'strikeouts': get_long_value(record[13]),
                    'batting_avg': get_decimal_value(record[14]),
                    'obp': get_decimal_value(record[15]),
                    'slg': get_decimal_value(record[16]),
                    'ops': get_decimal_value(record[17]),
                    'games_started': get_long_value(record[18]),
                    'wins': get_long_value(record[19]),
                    'losses': get_long_value(record[20]),
                    'saves': get_long_value(record[21]),
                    'innings_pitched': get_decimal_value(record[22]),
                    'hits_allowed': get_long_value(record[23]),
                    'earned_runs': get_long_value(record[24]),
                    'walks_allowed': get_long_value(record[25]),
                    'strikeouts_pitched': get_long_value(record[26]),
                    'era': get_decimal_value(record[27]),
                    'whip': get_decimal_value(record[28]),
                    'quality_starts': get_long_value(record[29]),
                    'blown_saves': get_long_value(record[30]) if len(record) > 30 else 0,
                    'holds': get_long_value(record[31]) if len(record) > 31 else 0
                })

        # STEP 5: Get game logs - FIXED WITH mlb_team and quality_starts
        game_logs_query = """
            SELECT 
                game_date, opponent, mlb_team, home_away,
                at_bats, hits, doubles, triples, home_runs, rbi, runs,
                walks, strikeouts, stolen_bases, caught_stealing, hit_by_pitch,
                innings_pitched, wins, losses, saves, blown_saves, holds, earned_runs,
                hits_allowed, walks_allowed, strikeouts_pitched, quality_starts, was_starter
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND EXTRACT(YEAR FROM game_date) = :season
            ORDER BY game_date DESC
            LIMIT 50
        """
        
        game_logs_result = execute_sql(
            game_logs_query, 
            parameters={'player_id': player_id, 'season': current_season},
            database_name='postgres'
        )
        
        game_logs = []
        if game_logs_result and game_logs_result.get("records"):
            for record in game_logs_result["records"]:
                game_log = {
                    'game_date': get_string_value(record[0]),
                    'opponent': get_string_value(record[1]),
                    'mlb_team': get_string_value(record[2]),  # FIXED - now included
                    'home_away': get_string_value(record[3]),
                    'at_bats': get_long_value(record[4]),
                    'hits': get_long_value(record[5]),
                    'doubles': get_long_value(record[6]),
                    'triples': get_long_value(record[7]),
                    'home_runs': get_long_value(record[8]),
                    'rbi': get_long_value(record[9]),
                    'runs': get_long_value(record[10]),
                    'walks': get_long_value(record[11]),
                    'strikeouts': get_long_value(record[12]),
                    'stolen_bases': get_long_value(record[13]),
                    'caught_stealing': get_long_value(record[14]),
                    'hit_by_pitch': get_long_value(record[15]),
                    'innings_pitched': get_decimal_value(record[16]),
                    'wins': get_long_value(record[17]),
                    'losses': get_long_value(record[18]),
                    'saves': get_long_value(record[19]),
                    'blown_saves': get_long_value(record[20]),
                    'holds': get_long_value(record[21]),
                    'earned_runs': get_long_value(record[22]),
                    'hits_allowed': get_long_value(record[23]),
                    'walks_allowed': get_long_value(record[24]),
                    'strikeouts_pitched': get_long_value(record[25]),
                    'quality_starts': get_long_value(record[26]),  # FIXED - use long_value not boolean
                    'was_starter': get_boolean_value(record[27]) if len(record) > 27 else False
                }
                
                # Calculate batting average for the game
                if game_log['at_bats'] > 0:
                    game_log['batting_avg'] = round(game_log['hits'] / game_log['at_bats'], 3)
                else:
                    game_log['batting_avg'] = 0
                    
                # Calculate ERA for the game if pitcher
                if game_log['innings_pitched'] and game_log['innings_pitched'] > 0:
                    game_log['era'] = round((game_log['earned_runs'] * 9) / game_log['innings_pitched'], 2)
                    game_log['whip'] = round((game_log['hits_allowed'] + game_log['walks_allowed']) / game_log['innings_pitched'], 3)
                
                game_logs.append(game_log)

        # STEP 6: Get contract info if league_id provided (NO AUTH CHECK)
        contract_info = None
        if league_id:
            contract_query = """
                SELECT 
                    lp.salary, lp.contract_years, lp.roster_status,
                    lt.team_name, lt.manager_name, lp.team_id
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
                    'owner_name': get_string_value(record[4]) or 'Available',
                    'team_id': get_string_value(record[5])
                }

        # STEP 7: Calculate analytics
        analytics = {}
        try:
            logger.info(f"Calculating analytics for player {player_id}")
            analytics_calculator = PlayerAnalytics(player_id, league_id)
            analytics = analytics_calculator.get_comprehensive_analytics()
            logger.info(f"Analytics calculated: {list(analytics.keys())}")
        except Exception as e:
            logger.error(f"Error calculating analytics: {e}")
            analytics = {}

        # STEP 8: Calculate career totals
        career_totals = calculate_career_totals(career_stats, position) if career_stats else None

        # STEP 9: Build and return complete response
        response = {
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
            "age": get_long_value(basic_record[10]) if len(basic_record) > 10 else None,
            
            # All the data fields
            "season_stats": season_stats,
            "rolling_14_day": rolling_14_day,
            "career_stats": career_stats,
            "career_totals": career_totals,
            "game_logs": game_logs,
            "contract_info": contract_info,
            "analytics": analytics
        }
        
        logger.info(f"Returning complete player data with {len(response)} fields")
        logger.info(f"Game logs: {len(game_logs)}, Analytics: {bool(analytics)}, Career stats: {len(career_stats)}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting complete player data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get player data: {str(e)}")

# =============================================================================
# CAREER STATISTICS - NO AUTH NEEDED (Public MLB data)
# =============================================================================

@router.get("/{player_id}/career-stats")
async def get_player_career_stats(
    player_id: int
    # REMOVED: current_user: dict = Depends(get_current_user)
):
    """Get player's career statistics from main database
    NO AUTH NEEDED - Public MLB data"""
    try:
        query = """
            SELECT 
                season,
                mlb_team,
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
                    "mlb_team": get_string_value(record[1]),
                    "games_played": get_long_value(record[2]),
                    "at_bats": get_long_value(record[3]),
                    "runs": get_long_value(record[4]),
                    "hits": get_long_value(record[5]),
                    "doubles": get_long_value(record[6]),
                    "triples": get_long_value(record[7]),
                    "home_runs": get_long_value(record[8]),
                    "rbi": get_long_value(record[9]),
                    "stolen_bases": get_long_value(record[10]),
                    "caught_stealing": get_long_value(record[11]),
                    "walks": get_long_value(record[12]),
                    "strikeouts": get_long_value(record[13]),
                    "batting_avg": get_decimal_value(record[14]),
                    "obp": get_decimal_value(record[15]),
                    "slg": get_decimal_value(record[16]),
                    "ops": get_decimal_value(record[17]),
                    "games_started": get_long_value(record[18]),
                    "wins": get_long_value(record[19]),
                    "losses": get_long_value(record[20]),
                    "saves": get_long_value(record[21]),
                    "innings_pitched": get_decimal_value(record[22]),
                    "hits_allowed": get_long_value(record[23]),
                    "earned_runs": get_long_value(record[24]),
                    "walks_allowed": get_long_value(record[25]),
                    "strikeouts_pitched": get_long_value(record[26]),
                    "era": get_decimal_value(record[27]),
                    "whip": get_decimal_value(record[28]),
                    "quality_starts": get_long_value(record[29]),
                    "blown_saves": get_long_value(record[30]) if len(record) > 30 else 0,
                    "holds": get_long_value(record[31]) if len(record) > 31 else 0
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
# GAME LOGS - NO AUTH NEEDED (Public MLB data)
# =============================================================================

@router.get("/{player_id}/game-logs")
async def get_player_game_logs(
    player_id: int,
    limit: int = Query(50, ge=1, le=100),
    season: Optional[int] = Query(None),
    days: Optional[int] = Query(None, description="Filter to last N days")
    # REMOVED: current_user: dict = Depends(get_current_user)
):
    """Get individual game logs
    NO AUTH NEEDED - Public MLB data"""
    try:
        current_season = season or get_current_season()
        
        date_filter = ""
        params = {'player_id': player_id, 'limit': limit, 'season': current_season}
        
        if days:
            date_filter = "AND game_date >= CURRENT_DATE - INTERVAL :days DAY"
            params['days'] = days
        else:
            date_filter = "AND EXTRACT(YEAR FROM game_date) = :season"
        
        sql = f"""
        SELECT 
            game_date, opponent, mlb_team, home_away,
            at_bats, hits, doubles, triples, home_runs, rbi, runs,
            walks, strikeouts, stolen_bases, caught_stealing, hit_by_pitch,
            innings_pitched, wins, losses, saves, earned_runs, 
            hits_allowed, walks_allowed, strikeouts_pitched, quality_starts,
            blown_saves, holds
        FROM player_game_logs 
        WHERE player_id = :player_id 
        {date_filter}
        ORDER BY game_date DESC
        LIMIT :limit
        """
        
        response = execute_sql(sql, parameters=params, database_name='postgres')
        
        game_logs = []
        if response and response.get('records'):
            for record in response['records']:
                game = {
                    'game_date': get_string_value(record[0]),
                    'opponent': get_string_value(record[1]),
                    'mlb_team': get_string_value(record[2]),
                    'home_away': get_string_value(record[3]),
                    'at_bats': get_long_value(record[4]),
                    'hits': get_long_value(record[5]),
                    'doubles': get_long_value(record[6]),
                    'triples': get_long_value(record[7]),
                    'home_runs': get_long_value(record[8]),
                    'rbi': get_long_value(record[9]),
                    'runs': get_long_value(record[10]),
                    'walks': get_long_value(record[11]),
                    'strikeouts': get_long_value(record[12]),
                    'stolen_bases': get_long_value(record[13]),
                    'caught_stealing': get_long_value(record[14]),
                    'hit_by_pitch': get_long_value(record[15]),
                    'innings_pitched': get_decimal_value(record[16]),
                    'wins': get_long_value(record[17]),
                    'losses': get_long_value(record[18]),
                    'saves': get_long_value(record[19]),
                    'earned_runs': get_long_value(record[20]),
                    'hits_allowed': get_long_value(record[21]),
                    'walks_allowed': get_long_value(record[22]),
                    'strikeouts_pitched': get_long_value(record[23]),
                    'quality_starts': get_long_value(record[24]),
                    'blown_saves': get_long_value(record[25]) if len(record) > 25 else 0,
                    'holds': get_long_value(record[26]) if len(record) > 26 else 0
                }
                
                # Calculate batting average for the game
                if game['at_bats'] > 0:
                    game['batting_avg'] = round(game['hits'] / game['at_bats'], 3)
                
                # Calculate ERA and WHIP for the game if pitcher
                if game['innings_pitched'] and game['innings_pitched'] > 0:
                    game['era'] = round((game['earned_runs'] * 9) / game['innings_pitched'], 2)
                    game['whip'] = round((game['hits_allowed'] + game['walks_allowed']) / game['innings_pitched'], 3)
                
                game_logs.append(game)
        
        return {
            "success": True,
            "player_id": player_id,
            "game_logs": game_logs,
            "total_games": len(game_logs)
        }
        
    except Exception as e:
        logger.error(f"Error fetching game logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch game logs")

# =============================================================================
# RECENT PERFORMANCE - NO AUTH NEEDED (Public MLB data)
# =============================================================================

@router.get("/{player_id}/recent-performance")
async def get_player_recent_performance(
    player_id: int,
    days: int = Query(7, ge=1, le=30, description="Number of days to look back")
    # REMOVED: current_user: dict = Depends(get_current_user)
):
    """Get aggregated recent performance stats
    NO AUTH NEEDED - Public MLB data"""
    try:
        sql = """
        SELECT 
            COUNT(*) as games,
            SUM(at_bats) as at_bats,
            SUM(hits) as hits,
            SUM(runs) as runs,
            SUM(rbi) as rbi,
            SUM(home_runs) as home_runs,
            SUM(stolen_bases) as stolen_bases,
            SUM(walks) as walks,
            SUM(strikeouts) as strikeouts,
            SUM(doubles) as doubles,
            SUM(triples) as triples,
            -- Pitching
            SUM(innings_pitched) as innings_pitched,
            SUM(wins) as wins,
            SUM(losses) as losses,
            SUM(saves) as saves,
            SUM(earned_runs) as earned_runs,
            SUM(strikeouts_pitched) as strikeouts_pitched,
            SUM(hits_allowed) as hits_allowed,
            SUM(walks_allowed) as walks_allowed,
            SUM(quality_starts) as quality_starts,
            SUM(blown_saves) as blown_saves,
            SUM(holds) as holds
        FROM player_game_logs
        WHERE player_id = :player_id
            AND game_date >= CURRENT_DATE - INTERVAL :days DAY
        """
        
        response = execute_sql(
            sql,
            parameters={'player_id': player_id, 'days': days},
            database_name='postgres'
        )
        
        if not response or not response.get('records'):
            return {
                "player_id": player_id,
                "days": days,
                "games": 0,
                "batting": {},
                "pitching": {}
            }
        
        record = response['records'][0]
        
        games = get_long_value(record[0])
        at_bats = get_long_value(record[1])
        hits = get_long_value(record[2])
        
        performance = {
            "player_id": player_id,
            "days": days,
            "games": games,
            "batting": {
                "at_bats": at_bats,
                "hits": hits,
                "runs": get_long_value(record[3]),
                "rbi": get_long_value(record[4]),
                "home_runs": get_long_value(record[5]),
                "stolen_bases": get_long_value(record[6]),
                "walks": get_long_value(record[7]),
                "strikeouts": get_long_value(record[8]),
                "doubles": get_long_value(record[9]),
                "triples": get_long_value(record[10])
            }
        }
        
        # Calculate batting average
        if at_bats > 0:
            performance['batting']['avg'] = round(hits / at_bats, 3)
        
        # Add pitching if applicable
        innings = get_decimal_value(record[11])
        if innings and innings > 0:
            earned_runs = get_long_value(record[15])
            hits_allowed = get_long_value(record[17])
            walks_allowed = get_long_value(record[18])
            
            performance['pitching'] = {
                "innings_pitched": innings,
                "wins": get_long_value(record[12]),
                "losses": get_long_value(record[13]),
                "saves": get_long_value(record[14]),
                "earned_runs": earned_runs,
                "strikeouts": get_long_value(record[16]),
                "hits_allowed": hits_allowed,
                "walks_allowed": walks_allowed,
                "quality_starts": get_long_value(record[19]),
                "blown_saves": get_long_value(record[20]),
                "holds": get_long_value(record[21]),
                "era": round((earned_runs * 9) / innings, 2),
                "whip": round((hits_allowed + walks_allowed) / innings, 3)
            }
        
        return performance
        
    except Exception as e:
        logger.error(f"Error fetching recent performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recent performance")

# =============================================================================
# ANALYTICS ENDPOINT - NO AUTH NEEDED (Public MLB data)
# =============================================================================

@router.get("/{player_id}/analytics")
async def get_player_analytics(
    player_id: int,
    league_id: Optional[str] = Query(None)
    # REMOVED: current_user: dict = Depends(get_current_user)
):
    """Get comprehensive analytics for a player
    NO AUTH NEEDED - Public MLB data"""
    try:
        logger.info(f"Getting analytics for player {player_id}")
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
# TILE ANALYTICS ENDPOINTS - UPDATED TO ACCEPT LEAGUE_ID
# =============================================================================

@router.get("/{player_id}/pitcher-tile-analytics")
async def get_pitcher_tile_analytics(
    player_id: int,
    league_id: Optional[str] = Query(None, description="Optional league ID for league benchmarks")
):
    """
    Get pitcher analytics for game log tiles
    Includes 30-day performance benchmarking
    League benchmarks included only if league_id provided
    """
    try:
        logger.info(f"Getting pitcher tile analytics for player {player_id}, league {league_id}")
        analytics = PlayerAnalytics(player_id, league_id)
        return analytics.get_pitcher_tile_analytics()
    except Exception as e:
        logger.error(f"Error getting pitcher tile analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{player_id}/hitter-tile-analytics")  
async def get_hitter_tile_analytics(
    player_id: int,
    league_id: Optional[str] = Query(None, description="Optional league ID for league benchmarks")
):
    """
    Get hitter analytics for game log tiles
    League benchmarks included only if league_id provided
    """
    try:
        logger.info(f"Getting hitter tile analytics for player {player_id}, league {league_id}")
        analytics = PlayerAnalytics(player_id, league_id)
        return analytics.get_hitter_tile_analytics()
    except Exception as e:
        logger.error(f"Error getting hitter tile analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))