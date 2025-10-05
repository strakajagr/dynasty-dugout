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
    sort_by: str = Query("fantasy_points", regex="^(fantasy_points|batting_avg|home_runs|rbi|era|wins|saves|at_bats|games_played|strikeouts|runs|stolen_bases|whip)$"),
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
            'at_bats': 'COALESCE(pss.at_bats, 0)',
            'games_played': 'COALESCE(pss.games_played, 0)',
            'runs': 'COALESCE(pss.runs, 0)',
            'stolen_bases': 'COALESCE(pss.stolen_bases, 0)',
            'strikeouts': 'COALESCE(pss.strikeouts_pitched, 0)',
            'era': 'COALESCE(pss.era, 9999)',  # Higher is worse
            'wins': 'COALESCE(pss.wins, 0)',
            'saves': 'COALESCE(pss.saves, 0)',
            'whip': 'COALESCE(pss.whip, 9999)'  # Higher is worse
        }
        
        sort_order = sort_columns.get(sort_by, sort_columns['fantasy_points'])
        
        # For ERA and WHIP, sort ascending (lower is better)
        if sort_by in ['era', 'whip']:
            sort_direction = 'ASC'
        else:
            sort_direction = 'DESC'
        
        # UPDATED QUERY: No cross-database JOIN to postgres.mlb_players
        free_agents_query = f"""
        SELECT 
            -- Player info from league_players (0-8)
            lp.league_player_id,
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
            ON lp.mlb_player_id::integer = pss.player_id::integer 
            AND pss.season = {CURRENT_SEASON}
            AND pss.league_id = :league_id::uuid
        LEFT JOIN player_rolling_stats prs 
            ON lp.mlb_player_id::integer = prs.player_id::integer 
            AND prs.period = 'last_14_days' 
            AND prs.as_of_date = CURRENT_DATE
            AND prs.league_id = :league_id::uuid
        WHERE {where_clause}
        ORDER BY {sort_order} {sort_direction}
        LIMIT :limit OFFSET :offset
        """
        
        result = execute_sql(free_agents_query, parameters=parameters, database_name='leagues')
        
        # Fix missing player names by fetching from mlb_players
        if result and result.get("records"):
            # Collect mlb_player_ids that have missing names
            missing_name_ids = []
            for record in result["records"]:
                player_name = record.get('player_name')
                mlb_id = record.get('mlb_player_id')
                if mlb_id and (not player_name or player_name.strip() == '' or player_name == 'Unknown Player'):
                    missing_name_ids.append(mlb_id)
            
            # Fetch names from postgres.mlb_players if any are missing
            name_lookup = {}
            if missing_name_ids:
                ids_str = ','.join(str(id) for id in missing_name_ids)
                name_query = f"""
                SELECT player_id, first_name, last_name, position, mlb_team
                FROM mlb_players
                WHERE player_id IN ({ids_str})
                """
                name_result = execute_sql(name_query, database_name='postgres')
                if name_result and name_result.get("records"):
                    for name_rec in name_result["records"]:
                        player_id = name_rec.get('player_id')
                        first = name_rec.get('first_name', '').strip()
                        last = name_rec.get('last_name', '').strip()
                        if first and last:
                            name_lookup[player_id] = f"{first} {last}"
                        # Also update position and mlb_team if missing
                        if name_rec.get('position'):
                            name_lookup[f"{player_id}_position"] = name_rec.get('position')
                        if name_rec.get('mlb_team'):
                            name_lookup[f"{player_id}_team"] = name_rec.get('mlb_team')
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Fix missing player name from lookup
                    mlb_id = record.get('mlb_player_id')
                    if mlb_id in name_lookup:
                        record['player_name'] = name_lookup[mlb_id]
                    # Fix missing position
                    if f"{mlb_id}_position" in name_lookup and not record.get('position'):
                        record['position'] = name_lookup[f"{mlb_id}_position"]
                    # Fix missing mlb_team  
                    if f"{mlb_id}_team" in name_lookup and not record.get('mlb_team'):
                        record['mlb_team'] = name_lookup[f"{mlb_id}_team"]
                    
                    # Parse season stats using dictionary keys
                    season_stats = SeasonStats(
                        games_played=record.get('games_played'),
                        at_bats=record.get('at_bats'),
                        runs=record.get('runs'),
                        hits=record.get('hits'),
                        doubles=record.get('doubles'),
                        triples=record.get('triples'),
                        home_runs=record.get('home_runs'),
                        rbi=record.get('rbi'),
                        stolen_bases=record.get('stolen_bases'),
                        caught_stealing=record.get('caught_stealing'),
                        walks=record.get('walks'),
                        strikeouts=record.get('strikeouts'),
                        batting_avg=record.get('batting_avg'),
                        obp=record.get('obp'),
                        slg=record.get('slg'),
                        ops=record.get('ops'),
                        games_started=record.get('games_started'),
                        wins=record.get('wins'),
                        losses=record.get('losses'),
                        saves=record.get('saves'),
                        innings_pitched=record.get('innings_pitched'),
                        hits_allowed=record.get('hits_allowed'),
                        earned_runs=record.get('earned_runs'),
                        walks_allowed=record.get('walks_allowed'),
                        strikeouts_pitched=record.get('strikeouts_pitched'),
                        era=record.get('era'),
                        whip=record.get('whip'),
                        quality_starts=record.get('quality_starts'),
                        blown_saves=record.get('blown_saves'),
                        holds=record.get('holds')
                    )
                    
                    # Parse rolling stats using dictionary keys
                    rolling_stats = RollingStats(
                        games_played=record.get('roll_games'),
                        at_bats=record.get('roll_ab'),
                        hits=record.get('roll_hits'),
                        home_runs=record.get('roll_hr'),
                        rbi=record.get('roll_rbi'),
                        runs=record.get('roll_runs'),
                        stolen_bases=record.get('roll_sb'),
                        batting_avg=record.get('roll_avg'),
                        obp=record.get('roll_obp'),
                        slg=record.get('roll_slg'),
                        ops=record.get('roll_ops'),
                        innings_pitched=record.get('roll_ip'),
                        wins=record.get('roll_wins'),
                        losses=record.get('roll_losses'),
                        saves=record.get('roll_saves'),
                        quality_starts=record.get('roll_qs'),
                        era=record.get('roll_era'),
                        whip=record.get('roll_whip')
                    )
                    
                    player = TwoLinePlayerStats(
                        league_player_id=record.get('league_player_id') or '',
                        mlb_player_id=record.get('mlb_player_id'),
                        player_name=record.get('player_name') or "Unknown",
                        position=record.get('position') or "UTIL",
                        mlb_team=record.get('mlb_team') or "FA",
                        availability_status=record.get('availability_status'),
                        salary=record.get('salary'),
                        season_stats=season_stats,
                        rolling_14_day=rolling_stats,
                        owned_by_team_id=record.get('team_id'),
                        owned_by_team_name=record.get('team_name')
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
        availability = record.get('availability_status')
        
        if availability != 'free_agent':
            raise HTTPException(status_code=400, detail="Player is not a free agent")
        
        # Get player stats similar to free agents list but for single player
        # UPDATED QUERY: No cross-database JOIN
        player_query = f"""
        SELECT 
            -- Player info
            lp.league_player_id,
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
            ON lp.mlb_player_id::integer = pss.player_id::integer 
            AND pss.season = {CURRENT_SEASON}
            AND pss.league_id = :league_id::uuid
        LEFT JOIN player_rolling_stats prs 
            ON lp.mlb_player_id::integer = prs.player_id::integer 
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
        
        # Parse and return player data using dictionary keys
        season_stats = SeasonStats(
            games_played=record.get('games_played'),
            at_bats=record.get('at_bats'),
            runs=record.get('runs'),
            hits=record.get('hits'),
            doubles=record.get('doubles'),
            triples=record.get('triples'),
            home_runs=record.get('home_runs'),
            rbi=record.get('rbi'),
            stolen_bases=record.get('stolen_bases'),
            caught_stealing=record.get('caught_stealing'),
            walks=record.get('walks'),
            strikeouts=record.get('strikeouts'),
            batting_avg=record.get('batting_avg'),
            obp=record.get('obp'),
            slg=record.get('slg'),
            ops=record.get('ops'),
            games_started=record.get('games_started'),
            wins=record.get('wins'),
            losses=record.get('losses'),
            saves=record.get('saves'),
            innings_pitched=record.get('innings_pitched'),
            hits_allowed=record.get('hits_allowed'),
            earned_runs=record.get('earned_runs'),
            walks_allowed=record.get('walks_allowed'),
            strikeouts_pitched=record.get('strikeouts_pitched'),
            era=record.get('era'),
            whip=record.get('whip'),
            quality_starts=record.get('quality_starts'),
            blown_saves=record.get('blown_saves'),
            holds=record.get('holds')
        )
        
        rolling_stats = RollingStats(
            games_played=record.get('roll_games'),
            at_bats=record.get('roll_ab'),
            hits=record.get('roll_hits'),
            home_runs=record.get('roll_hr'),
            rbi=record.get('roll_rbi'),
            runs=record.get('roll_runs'),
            stolen_bases=record.get('roll_sb'),
            batting_avg=record.get('roll_avg'),
            obp=record.get('roll_obp'),
            slg=record.get('roll_slg'),
            ops=record.get('roll_ops'),
            innings_pitched=record.get('roll_ip'),
            wins=record.get('roll_wins'),
            losses=record.get('roll_losses'),
            saves=record.get('roll_saves'),
            quality_starts=record.get('roll_qs'),
            era=record.get('roll_era'),
            whip=record.get('roll_whip')
        )
        
        return {
            "success": True,
            "player": TwoLinePlayerStats(
                league_player_id=record.get('league_player_id') or '',
                mlb_player_id=record.get('mlb_player_id'),
                player_name=record.get('player_name') or "Unknown",
                position=record.get('position') or "UTIL",
                mlb_team=record.get('mlb_team') or "FA",
                availability_status=record.get('availability_status'),
                salary=record.get('salary'),
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