"""
Dynasty Dugout - All League Players Search
PURPOSE: Return ALL players in a league (owned + free agents) for search functionality
PATTERN: Similar to free_agents.py but includes owned players
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
# ALL LEAGUE PLAYERS WITH 2-LINE STATS
# =============================================================================

@router.get("/all-league-players")
async def get_all_league_players(
    league_id: str,
    position: Optional[str] = None,
    limit: int = Query(12, le=50),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    sort_by: str = Query("fantasy_points", regex="^(fantasy_points|batting_avg|home_runs|rbi|era|wins|saves|at_bats|games_played|strikeouts|runs|stolen_bases|whip)$"),
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Get ALL players in the league with TWO lines of stats:
    1. Season stats (from CACHED data in leagues DB)
    2. 14-day rolling stats (from leagues DB)
    
    Returns both free agents AND owned players for search/trade functionality
    Enhanced with search and sorting capabilities
    """
    try:
        # Build dynamic query conditions - NO availability_status filter
        conditions = ["lp.league_id = :league_id::uuid"]
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
        
        # Query returns ALL league players (owned + free agents)
        all_players_query = f"""
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
            
            -- Season stats from CACHED data in leagues DB (8-37)
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
        
        result = execute_sql(all_players_query, parameters=parameters, database_name='leagues')
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Parse season stats
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
                    
                    # Parse rolling stats (use defaults for NULL values)
                    rolling_stats = RollingStats(
                        games_played=record.get('roll_games') or 0,
                        at_bats=record.get('roll_ab') or 0,
                        hits=record.get('roll_hits') or 0,
                        home_runs=record.get('roll_hr') or 0,
                        rbi=record.get('roll_rbi') or 0,
                        runs=record.get('roll_runs') or 0,
                        stolen_bases=record.get('roll_sb') or 0,
                        batting_avg=record.get('roll_avg') or 0.0,
                        obp=record.get('roll_obp') or 0.0,
                        slg=record.get('roll_slg') or 0.0,
                        ops=record.get('roll_ops') or 0.0,
                        innings_pitched=record.get('roll_ip') or 0.0,
                        wins=record.get('roll_wins') or 0,
                        losses=record.get('roll_losses') or 0,
                        saves=record.get('roll_saves') or 0,
                        quality_starts=record.get('roll_qs') or 0,
                        era=record.get('roll_era') or 0.0,
                        whip=record.get('roll_whip') or 0.0
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
                    logger.error(f"Error parsing league player: {e}")
                    continue
        
        return {
            "success": True,
            "players": players,
            "count": len(players)
        }
        
    except Exception as e:
        logger.error(f"Error getting all league players: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get league players: {str(e)}")