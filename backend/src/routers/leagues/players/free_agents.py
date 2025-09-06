"""
Dynasty Dugout - Free Agent Management
PURPOSE: Free agent browsing with 2-line stats display
CRITICAL: Shows Season/14-day stats for FA search
UPDATED: Removed cross-database JOINs - uses local league_players data
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import logging

from core.database import execute_sql
from core.auth_utils import get_current_user
from core.season_utils import CURRENT_SEASON
from .models import TwoLinePlayerStats, SeasonStats, RollingStats
from .utils import get_decimal_value, get_long_value, get_string_value

logger = logging.getLogger(__name__)

router = APIRouter()

# =============================================================================
# FREE AGENTS WITH 2-LINE STATS
# =============================================================================

@router.get("/free-agents")
async def get_free_agents_two_line(
    league_id: str,
    position: Optional[str] = None,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    sort_by: str = Query("fantasy_points", regex="^(fantasy_points|batting_avg|home_runs|rbi|era|wins|saves)$"),
    current_user: dict = Depends(get_current_user)
) -> List[TwoLinePlayerStats]:
    """
    Get free agents with TWO lines of stats:
    1. Season stats (from CACHED data in leagues DB)
    2. 14-day rolling stats (from leagues DB)
    
    Enhanced with search and sorting capabilities
    UPDATED: Now uses local league_players data (no cross-DB JOIN)
    """
    try:
        # Build dynamic query conditions
        conditions = ["lp.league_id = :league_id::uuid", "lp.availability_status = 'free_agent'"]
        parameters = {'league_id': league_id, 'limit': limit, 'offset': offset}
        
        if position:
            conditions.append("lp.position = :position")
            parameters['position'] = position
        
        if search:
            conditions.append("(LOWER(lp.player_name) LIKE LOWER(:search) OR LOWER(lp.mlb_team) LIKE LOWER(:search))")
            parameters['search'] = f"%{search}%"
        
        where_clause = " AND ".join(conditions)
        
        # Determine sort column
        sort_columns = {
            'fantasy_points': 'COALESCE(pss.home_runs, 0) + COALESCE(pss.rbi, 0) + COALESCE(pss.runs, 0)',
            'batting_avg': 'COALESCE(pss.batting_avg, 0)',
            'home_runs': 'COALESCE(pss.home_runs, 0)',
            'rbi': 'COALESCE(pss.rbi, 0)',
            'era': 'COALESCE(pss.era, 9999)',  # Higher is worse
            'wins': 'COALESCE(pss.wins, 0)',
            'saves': 'COALESCE(pss.saves, 0)'
        }
        
        sort_order = sort_columns.get(sort_by, sort_columns['fantasy_points'])
        
        # For ERA, sort ascending (lower is better)
        if sort_by == 'era':
            sort_direction = 'ASC'
        else:
            sort_direction = 'DESC'
        
        # UPDATED QUERY: No cross-database JOIN to postgres.mlb_players
        free_agents_query = f"""
        SELECT 
            -- Player info from league_players (0-7)
            lp.mlb_player_id,
            lp.player_name,
            lp.position,
            lp.mlb_team,
            lp.availability_status,
            lp.salary,
            lp.team_id,
            lt.team_name,
            
            -- Season stats from CACHED data in leagues DB (8-37) - CORRECTED ORDER
            pss.games_played,
            pss.at_bats,
            pss.runs,
            pss.hits,
            pss.doubles,
            pss.triples,
            pss.home_runs,
            pss.rbi,
            pss.stolen_bases,
            pss.caught_stealing,
            pss.walks,
            pss.strikeouts,
            pss.batting_avg,
            pss.obp,
            pss.slg,
            pss.ops,
            pss.games_started,
            pss.wins,
            pss.losses,
            pss.saves,
            pss.innings_pitched,
            pss.hits_allowed,
            pss.earned_runs,
            pss.walks_allowed,
            pss.strikeouts_pitched,
            pss.era,
            pss.whip,
            pss.quality_starts,
            pss.blown_saves,
            pss.holds,
            
            -- 14-day rolling stats from leagues DB (38-55)
            prs.games_played as roll_games,
            prs.at_bats as roll_ab,
            prs.hits as roll_hits,
            prs.home_runs as roll_hr,
            prs.rbi as roll_rbi,
            prs.runs as roll_runs,
            prs.stolen_bases as roll_sb,
            prs.batting_avg as roll_avg,
            prs.obp as roll_obp,
            prs.slg as roll_slg,
            prs.ops as roll_ops,
            prs.innings_pitched as roll_ip,
            prs.wins as roll_wins,
            prs.losses as roll_losses,
            prs.saves as roll_saves,
            prs.quality_starts as roll_qs,
            prs.era as roll_era,
            prs.whip as roll_whip
            
        FROM league_players lp
        LEFT JOIN league_teams lt ON lp.team_id = lt.team_id AND lp.league_id = lt.league_id
        LEFT JOIN player_season_stats pss 
            ON lp.mlb_player_id = pss.player_id 
            AND pss.season = {CURRENT_SEASON}
            AND pss.league_id = :league_id::uuid
        LEFT JOIN player_rolling_stats prs 
            ON lp.mlb_player_id = prs.player_id 
            AND prs.period = 'last_14_days' 
            AND prs.as_of_date = CURRENT_DATE
            AND prs.league_id = :league_id::uuid
        WHERE {where_clause}
        ORDER BY {sort_order} {sort_direction}
        LIMIT :limit OFFSET :offset
        """
        
        result = execute_sql(free_agents_query, parameters=parameters, database_name='leagues')
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Parse season stats (8-37) - ENHANCED WITH SAFE PARSING
                    season_stats = SeasonStats(
                        games_played=get_long_value(record[8]),
                        at_bats=get_long_value(record[9]),
                        runs=get_long_value(record[10]),
                        hits=get_long_value(record[11]),
                        doubles=get_long_value(record[12]),
                        triples=get_long_value(record[13]),
                        home_runs=get_long_value(record[14]),
                        rbi=get_long_value(record[15]),
                        stolen_bases=get_long_value(record[16]),
                        caught_stealing=get_long_value(record[17]),
                        walks=get_long_value(record[18]),
                        strikeouts=get_long_value(record[19]),
                        batting_avg=get_decimal_value(record[20]),
                        obp=get_decimal_value(record[21]),
                        slg=get_decimal_value(record[22]),
                        ops=get_decimal_value(record[23]),
                        games_started=get_long_value(record[24]),
                        wins=get_long_value(record[25]),
                        losses=get_long_value(record[26]),
                        saves=get_long_value(record[27]),
                        innings_pitched=get_decimal_value(record[28]),
                        hits_allowed=get_long_value(record[29]),
                        earned_runs=get_long_value(record[30]),
                        walks_allowed=get_long_value(record[31]),
                        strikeouts_pitched=get_long_value(record[32]),
                        era=get_decimal_value(record[33]),
                        whip=get_decimal_value(record[34]),
                        quality_starts=get_long_value(record[35]),
                        blown_saves=get_long_value(record[36]),
                        holds=get_long_value(record[37])
                    )
                    
                    # Parse rolling stats (38-55) - ENHANCED
                    rolling_stats = RollingStats(
                        games_played=get_long_value(record[38]),
                        at_bats=get_long_value(record[39]),
                        hits=get_long_value(record[40]),
                        home_runs=get_long_value(record[41]),
                        rbi=get_long_value(record[42]),
                        runs=get_long_value(record[43]),
                        stolen_bases=get_long_value(record[44]),
                        batting_avg=get_decimal_value(record[45]),
                        obp=get_decimal_value(record[46]),
                        slg=get_decimal_value(record[47]),
                        ops=get_decimal_value(record[48]),
                        innings_pitched=get_decimal_value(record[49]),
                        wins=get_long_value(record[50]),
                        losses=get_long_value(record[51]),
                        saves=get_long_value(record[52]),
                        quality_starts=get_long_value(record[53]),
                        era=get_decimal_value(record[54]),
                        whip=get_decimal_value(record[55])
                    )
                    
                    player = TwoLinePlayerStats(
                        mlb_player_id=get_long_value(record[0]),
                        player_name=get_string_value(record[1]) or "Unknown",
                        position=get_string_value(record[2]) or "UTIL",
                        mlb_team=get_string_value(record[3]) or "FA",
                        availability_status=get_string_value(record[4]),
                        salary=get_decimal_value(record[5]),
                        season_stats=season_stats,
                        rolling_14_day=rolling_stats,
                        owned_by_team_id=get_string_value(record[6]) or None,
                        owned_by_team_name=get_string_value(record[7]) or None
                    )
                    
                    players.append(player)
                    
                except Exception as e:
                    logger.error(f"Error parsing free agent: {e}")
                    continue
        
        return players
        
    except Exception as e:
        logger.error(f"Error getting free agents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get free agents: {str(e)}")

# =============================================================================
# FREE AGENT DETAIL
# =============================================================================

@router.get("/free-agents/{player_id}")
async def get_free_agent_detail(
    league_id: str,
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information for a specific free agent"""
    try:
        # Check if player is actually a free agent
        status_query = """
        SELECT 
            availability_status,
            team_id,
            salary
        FROM league_players
        WHERE league_id = :league_id::uuid AND mlb_player_id = :player_id
        """
        
        status_result = execute_sql(
            status_query,
            parameters={'league_id': league_id, 'player_id': player_id},
            database_name='leagues'
        )
        
        if not status_result or not status_result.get("records"):
            raise HTTPException(status_code=404, detail="Player not found in this league")
        
        record = status_result["records"][0]
        availability = get_string_value(record[0])
        
        if availability != 'free_agent':
            raise HTTPException(status_code=400, detail="Player is not a free agent")
        
        # Get player stats similar to free agents list but for single player
        # UPDATED QUERY: No cross-database JOIN
        player_query = f"""
        SELECT 
            -- Player info
            lp.mlb_player_id,
            lp.player_name,
            lp.position,
            lp.mlb_team,
            lp.availability_status,
            lp.salary,
            
            -- Season stats
            pss.games_played,
            pss.at_bats,
            pss.runs,
            pss.hits,
            pss.doubles,
            pss.triples,
            pss.home_runs,
            pss.rbi,
            pss.stolen_bases,
            pss.caught_stealing,
            pss.walks,
            pss.strikeouts,
            pss.batting_avg,
            pss.obp,
            pss.slg,
            pss.ops,
            pss.games_started,
            pss.wins,
            pss.losses,
            pss.saves,
            pss.innings_pitched,
            pss.hits_allowed,
            pss.earned_runs,
            pss.walks_allowed,
            pss.strikeouts_pitched,
            pss.era,
            pss.whip,
            pss.quality_starts,
            pss.blown_saves,
            pss.holds,
            
            -- Rolling stats
            prs.games_played as roll_games,
            prs.at_bats as roll_ab,
            prs.hits as roll_hits,
            prs.home_runs as roll_hr,
            prs.rbi as roll_rbi,
            prs.runs as roll_runs,
            prs.stolen_bases as roll_sb,
            prs.batting_avg as roll_avg,
            prs.obp as roll_obp,
            prs.slg as roll_slg,
            prs.ops as roll_ops,
            prs.innings_pitched as roll_ip,
            prs.wins as roll_wins,
            prs.losses as roll_losses,
            prs.saves as roll_saves,
            prs.quality_starts as roll_qs,
            prs.era as roll_era,
            prs.whip as roll_whip
            
        FROM league_players lp
        LEFT JOIN player_season_stats pss 
            ON lp.mlb_player_id = pss.player_id 
            AND pss.season = {CURRENT_SEASON}
            AND pss.league_id = :league_id::uuid
        LEFT JOIN player_rolling_stats prs 
            ON lp.mlb_player_id = prs.player_id 
            AND prs.period = 'last_14_days' 
            AND prs.as_of_date = CURRENT_DATE
            AND prs.league_id = :league_id::uuid
        WHERE lp.league_id = :league_id::uuid AND lp.mlb_player_id = :player_id
        """
        
        result = execute_sql(
            player_query,
            parameters={'league_id': league_id, 'player_id': player_id},
            database_name='leagues'
        )
        
        if not result or not result.get("records"):
            raise HTTPException(status_code=404, detail="Player data not found")
        
        record = result["records"][0]
        
        # Parse and return player data
        season_stats = SeasonStats(
            games_played=get_long_value(record[6]),
            at_bats=get_long_value(record[7]),
            runs=get_long_value(record[8]),
            hits=get_long_value(record[9]),
            doubles=get_long_value(record[10]),
            triples=get_long_value(record[11]),
            home_runs=get_long_value(record[12]),
            rbi=get_long_value(record[13]),
            stolen_bases=get_long_value(record[14]),
            caught_stealing=get_long_value(record[15]),
            walks=get_long_value(record[16]),
            strikeouts=get_long_value(record[17]),
            batting_avg=get_decimal_value(record[18]),
            obp=get_decimal_value(record[19]),
            slg=get_decimal_value(record[20]),
            ops=get_decimal_value(record[21]),
            games_started=get_long_value(record[22]),
            wins=get_long_value(record[23]),
            losses=get_long_value(record[24]),
            saves=get_long_value(record[25]),
            innings_pitched=get_decimal_value(record[26]),
            hits_allowed=get_long_value(record[27]),
            earned_runs=get_long_value(record[28]),
            walks_allowed=get_long_value(record[29]),
            strikeouts_pitched=get_long_value(record[30]),
            era=get_decimal_value(record[31]),
            whip=get_decimal_value(record[32]),
            quality_starts=get_long_value(record[33]),
            blown_saves=get_long_value(record[34]),
            holds=get_long_value(record[35])
        )
        
        rolling_stats = RollingStats(
            games_played=get_long_value(record[36]),
            at_bats=get_long_value(record[37]),
            hits=get_long_value(record[38]),
            home_runs=get_long_value(record[39]),
            rbi=get_long_value(record[40]),
            runs=get_long_value(record[41]),
            stolen_bases=get_long_value(record[42]),
            batting_avg=get_decimal_value(record[43]),
            obp=get_decimal_value(record[44]),
            slg=get_decimal_value(record[45]),
            ops=get_decimal_value(record[46]),
            innings_pitched=get_decimal_value(record[47]),
            wins=get_long_value(record[48]),
            losses=get_long_value(record[49]),
            saves=get_long_value(record[50]),
            quality_starts=get_long_value(record[51]),
            era=get_decimal_value(record[52]),
            whip=get_decimal_value(record[53])
        )
        
        return {
            "success": True,
            "player": TwoLinePlayerStats(
                mlb_player_id=get_long_value(record[0]),
                player_name=get_string_value(record[1]) or "Unknown",
                position=get_string_value(record[2]) or "UTIL",
                mlb_team=get_string_value(record[3]) or "FA",
                availability_status=get_string_value(record[4]),
                salary=get_decimal_value(record[5]),
                season_stats=season_stats,
                rolling_14_day=rolling_stats
            )
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting free agent detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# POSITION-SPECIFIC FREE AGENTS
# =============================================================================

@router.get("/free-agents/by-position/{position}")
async def get_free_agents_by_position(
    league_id: str,
    position: str,
    limit: int = Query(25, le=50),
    current_user: dict = Depends(get_current_user)
) -> List[TwoLinePlayerStats]:
    """Get top free agents at a specific position"""
    
    # Validate position
    valid_positions = ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'SP', 'RP', 'P']
    if position not in valid_positions:
        raise HTTPException(status_code=400, detail=f"Invalid position. Must be one of: {', '.join(valid_positions)}")
    
    return await get_free_agents_two_line(
        league_id=league_id,
        position=position,
        limit=limit,
        offset=0,
        sort_by='fantasy_points',
        current_user=current_user
    )