"""
Dynasty Dugout - Player Endpoints (Canonical Version)
Uses canonical player data structure for consistent responses
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from core.auth_utils import get_current_user
from core.database import execute_sql
from core.cache import cached
from core.canonical_player import (
    CanonicalPlayerQueries,
    PlayerDataFormatter,
    get_player_across_user_leagues
)
from core.season_utils import CURRENT_SEASON
# from models import PlayerSearchResponse  # TODO: Update this model for canonical structure
from core.error_handlers import PlayerNotFoundError
from routers.leagues.players.analytics import PlayerAnalytics

router = APIRouter()


# =================================================================
# Global Player Search (No League Context)
# =================================================================

@router.get("/search")  # TODO: Update response model to match canonical structure
@cached(ttl_seconds=300, key_prefix='player_search', key_params=['q', 'limit'])
async def search_players_global(
    q: str = Query(..., min_length=2, description="Search query (name)"),
    limit: int = Query(10, ge=1, le=100, description="Results limit"),
    current_user: dict = Depends(get_current_user)
):
    """
    Search for MLB players globally (no league context).
    Returns basic MLB data + current season stats.
    
    CACHED: 5 minute TTL - Search results cached by query
    
    Use this for:
    - Main dashboard search
    - General player lookup
    - Before user selects a league
    """
    
    # Execute canonical query
    result = execute_sql(
        CanonicalPlayerQueries.SEARCH_MLB_PLAYERS,
        {
            "search": f"%{q}%",
            "limit": limit
        },
        "postgres"
    )
    
    if not result.get("records"):
        return {
            "success": True,
            "players": [],
            "count": 0,
            "query": q
        }
    
    # DEBUG: Log what fields we actually got back
    if result["records"]:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Player search returned fields: {list(result['records'][0].keys())}")
        logger.info(f"Sample record: {result['records'][0]}")
    
    # Data is already formatted by execute_sql()
    # Format results using canonical formatter
    players = [
        PlayerDataFormatter.format_search_result(row)
        for row in result["records"]
    ]
    
    return {
        "success": True,
        "players": players,
        "count": len(players),
        "query": q
    }


# =================================================================
# Player in Specific League Context
# =================================================================

@router.get("/leagues/{league_id}/players/{player_id}")
@cached(ttl_seconds=300, key_prefix='player_league', key_params=['league_id', 'player_id'])
async def get_player_in_league(
    league_id: str,
    player_id: int,  # MLB player ID
    current_user: dict = Depends(get_current_user)
):
    """
    Get player data with specific league context.
    Shows ownership, contracts, roster status in THIS league.
    
    CACHED: 5 minute TTL
    
    Use this for:
    - Player profile modal (when inside a league)
    - Free agent details
    - Roster player cards
    """
    
    user_id = current_user["sub"]
    
    # Get league database name
    league_info = execute_sql(
        "SELECT database_name FROM user_leagues WHERE league_id = :league_id::uuid",
        {"league_id": league_id},
        "postgres"
    )
    
    if not league_info.get("records"):
        raise HTTPException(status_code=404, detail="League not found")
    
    db_name = league_info["records"][0]["database_name"]
    
    # Execute canonical query for this league
    result = execute_sql(
        CanonicalPlayerQueries.PLAYER_IN_LEAGUE_CONTEXT,
        {
            "mlb_player_id": player_id,
            "league_id": league_id
        },
        db_name
    )
    
    if not result.get("records"):
        raise PlayerNotFoundError(player_id)
    
    # Format result
    player_data = PlayerDataFormatter.format_league_player(
        result["records"][0],
        user_id=user_id,
        league_id=league_id
    )
    
    return {
        "success": True,
        "player": player_data
    }


# =================================================================
# Player Across All User's Leagues (Multi-League View)
# =================================================================

@router.get("/players/{player_id}/my-leagues")
async def get_player_across_my_leagues(
    player_id: int,  # MLB player ID
    current_user: dict = Depends(get_current_user)
):
    """
    Get player's status across ALL leagues the current user is in.
    
    Use this for:
    - "Where is this player in my leagues?" feature
    - Multi-league comparison
    - Trade analysis across leagues
    
    Returns:
    {
        "ids": {"mlb": 12345},
        "info": {...},
        "stats": {...},
        "league_contexts": [
            {"league_id": 1, "status": "owned", ...},
            {"league_id": 2, "status": "available", ...}
        ],
        "summary": {
            "total_leagues": 5,
            "owned_in": 2,
            "available_in": 3
        }
    }
    """
    
    user_id = current_user["sub"]
    
    # Use the multi-league function
    player_data = get_player_across_user_leagues(
        mlb_player_id=player_id,
        user_id=user_id,
        execute_sql_func=execute_sql
    )
    
    return {
        "success": True,
        **player_data
    }


# =================================================================
# Free Agents in League (Canonical)
# =================================================================

@router.get("/leagues/{league_id}/free-agents")
async def get_free_agents_in_league(
    league_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    position: Optional[str] = Query(None, description="Filter by position"),
    sort_by: str = Query("batting_avg", description="Sort field"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get available free agents in a specific league.
    Returns players not on any team.
    
    Use this for:
    - Free agent search page
    - Add player flow
    - Waiver wire
    """
    
    # Get league database name
    league_info = execute_sql(
        "SELECT database_name FROM user_leagues WHERE league_id = :league_id::uuid",
        {"league_id": league_id},
        "postgres"
    )
    
    if not league_info.get("records"):
        raise HTTPException(status_code=404, detail="League not found")
    
    db_name = league_info["records"][0]["database_name"]
    
    # Build base query - uses league_players table only (no cross-DB JOIN)
    base_query = """
        SELECT 
            lp.league_player_id,
            lp.mlb_player_id as mlb_id,
            lp.player_name,
            lp.position,
            lp.mlb_team,
            
            -- Market pricing
            lp.salary as market_price,
            
            -- Season stats
            s.games_played,
            s.at_bats,
            s.runs,
            s.hits,
            s.doubles,
            s.triples,
            s.home_runs,
            s.rbi,
            s.stolen_bases,
            s.caught_stealing,
            s.walks,
            s.strikeouts,
            s.batting_avg,
            s.obp,
            s.slg,
            s.ops,
            s.games_started,
            s.wins,
            s.losses,
            s.saves,
            s.innings_pitched,
            s.hits_allowed,
            s.earned_runs,
            s.walks_allowed,
            s.strikeouts_pitched,
            s.era,
            s.whip,
            s.quality_starts,
            s.blown_saves,
            s.holds,
            
            -- 14-day rolling stats
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
        LEFT JOIN player_season_stats s 
            ON lp.mlb_player_id = s.player_id 
            AND s.season = EXTRACT(YEAR FROM CURRENT_DATE)
            AND s.league_id = :league_id::uuid
        LEFT JOIN player_rolling_stats prs 
            ON lp.mlb_player_id = prs.player_id 
            AND prs.period = 'last_14_days' 
            AND prs.as_of_date = CURRENT_DATE
            AND prs.league_id = :league_id::uuid
            
        WHERE 
            lp.league_id = :league_id::uuid
            AND lp.team_id IS NULL
            AND lp.availability_status = 'free_agent'
    """
    
    # Add position filter if provided
    if position:
        if position.lower() == 'hitters':
            base_query += " AND lp.position IN ('C', '1B', '2B', '3B', 'SS', 'OF', 'DH')"
        elif position.lower() == 'pitchers':
            base_query += " AND lp.position IN ('SP', 'RP', 'P')"
        else:
            base_query += " AND lp.position = :position"
    
    # Build ORDER BY clause dynamically (safe because sort_by comes from our endpoint, not user input directly)
    # Map valid sort fields to prevent SQL injection
    valid_sort_fields = {
        'batting_avg': 's.avg',
        'home_runs': 's.home_runs',
        'rbi': 's.rbi',
        'stolen_bases': 's.stolen_bases',
        'at_bats': 's.at_bats',
        'era': 's.era',
        'wins': 's.wins',
        'saves': 's.saves',
        'whip': 's.whip'
    }
    
    sort_field = valid_sort_fields.get(sort_by, 's.at_bats')  # Default to at_bats if invalid
    
    # Add ORDER BY with proper NULL handling
    base_query += f"""
        ORDER BY {sort_field} DESC NULLS LAST
        LIMIT :limit
        OFFSET :offset
    """
    
    params = {
        "league_id": league_id,
        "limit": limit,
        "offset": offset
    }
    
    if position and position not in ['hitters', 'pitchers']:
        params["position"] = position
    
    result = execute_sql(base_query, params, db_name)
    
    if not result.get("records"):
        return {
            "success": True,
            "players": [],
            "count": 0,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "has_more": False
            }
        }
    
    # Format results (simplified for free agents)
    players = []
    for row in result["records"]:
        # Parse player_name into first/last (simple split on space)
        player_name = row.get("player_name") or "Unknown Player"
        name_parts = player_name.split(" ", 1)
        first_name = name_parts[0] if len(name_parts) > 0 else "Unknown"
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        players.append({
            "ids": {
                "mlb": row["mlb_id"],
                "league_player": row.get("league_player_id")
            },
            "info": {
                "first_name": first_name,
                "last_name": last_name,
                "full_name": player_name,
                "position": row["position"],
                "mlb_team": row["mlb_team"]
            },
            "financial": {
                "market_price": float(row["market_price"]) if row.get("market_price") else None
            },
            "stats": {
                "season": {
                    "games_played": row.get("games_played"),
                    "at_bats": row.get("at_bats"),
                    "runs": row.get("runs"),
                    "hits": row.get("hits"),
                    "doubles": row.get("doubles"),
                    "triples": row.get("triples"),
                    "home_runs": row.get("home_runs"),
                    "rbi": row.get("rbi"),
                    "stolen_bases": row.get("stolen_bases"),
                    "caught_stealing": row.get("caught_stealing"),
                    "walks": row.get("walks"),
                    "strikeouts": row.get("strikeouts"),
                    "batting_avg": float(row["batting_avg"]) if row.get("batting_avg") else None,
                    "obp": float(row["obp"]) if row.get("obp") else None,
                    "slg": float(row["slg"]) if row.get("slg") else None,
                    "ops": float(row["ops"]) if row.get("ops") else None,
                    "games_started": row.get("games_started"),
                    "wins": row.get("wins"),
                    "losses": row.get("losses"),
                    "saves": row.get("saves"),
                    "innings_pitched": float(row["innings_pitched"]) if row.get("innings_pitched") else None,
                    "hits_allowed": row.get("hits_allowed"),
                    "earned_runs": row.get("earned_runs"),
                    "walks_allowed": row.get("walks_allowed"),
                    "strikeouts_pitched": row.get("strikeouts_pitched"),
                    "era": float(row["era"]) if row.get("era") else None,
                    "whip": float(row["whip"]) if row.get("whip") else None,
                    "quality_starts": row.get("quality_starts"),
                    "blown_saves": row.get("blown_saves"),
                    "holds": row.get("holds")
                },
                "rolling_14_day": {
                    "games_played": row.get("roll_games"),
                    "at_bats": row.get("roll_ab"),
                    "hits": row.get("roll_hits"),
                    "home_runs": row.get("roll_hr"),
                    "rbi": row.get("roll_rbi"),
                    "runs": row.get("roll_runs"),
                    "stolen_bases": row.get("roll_sb"),
                    "batting_avg": float(row["roll_avg"]) if row.get("roll_avg") else None,
                    "obp": float(row["roll_obp"]) if row.get("roll_obp") else None,
                    "slg": float(row["roll_slg"]) if row.get("roll_slg") else None,
                    "ops": float(row["roll_ops"]) if row.get("roll_ops") else None,
                    "innings_pitched": float(row["roll_ip"]) if row.get("roll_ip") else None,
                    "wins": row.get("roll_wins"),
                    "losses": row.get("roll_losses"),
                    "saves": row.get("roll_saves"),
                    "quality_starts": row.get("roll_qs"),
                    "era": float(row["roll_era"]) if row.get("roll_era") else None,
                    "whip": float(row["roll_whip"]) if row.get("roll_whip") else None
                } if row.get("roll_games") else None
            }
        })
    
    return {
        "success": True,
        "players": players,
        "count": len(players),
        "pagination": {
            "limit": limit,
            "offset": offset,
            "has_more": len(players) == limit
        }
    }


# =================================================================
# My Roster in League (Canonical)
# =================================================================

@router.get("/leagues/{league_id}/my-roster")
async def get_my_roster_in_league(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get current user's roster in a specific league.
    Includes team attribution stats.
    
    FIXED: Split into two queries to avoid cross-database JOIN
    Query 1: league_players + accrued stats from leagues DB
    Query 2: mlb_players from postgres DB
    Query 3: season_stats from postgres DB
    
    Use this for:
    - My Roster page
    - Team management
    - Lineup setting
    """
    
    user_id = current_user["sub"]
    
    # STEP 1: Get user's team_id first from leagues DB
    team_query = """
        SELECT team_id 
        FROM league_teams
        WHERE user_id::text = :user_id
          AND league_id::text = :league_id
    """
    
    team_result = execute_sql(
        team_query,
        {
            "user_id": user_id,
            "league_id": league_id
        },
        "leagues"
    )
    
    if not team_result or not team_result.get("records"):
        return {
            "success": True,
            "players": [],
            "count": 0,
            "team_info": None
        }
    
    team_id = team_result["records"][0]["team_id"]
    
    # STEP 2: Get roster from leagues DB (NO cross-DB JOIN)
    roster_query = """
        SELECT 
            lp.league_player_id,
            lp.mlb_player_id,
            lp.salary as contract_salary,
            lp.contract_years,
            lp.roster_status,
            lp.roster_position,
            lp.acquisition_date,
            
            -- Market price (from salary engine or manual override)
            COALESCE(lp.manual_price_override, lp.generated_price) as market_price,
            
            -- Active accrued stats (from league DB)
            aas.active_batting_avg as team_batting_avg,
            aas.active_home_runs as team_home_runs,
            aas.active_rbi as team_rbi,
            0 as fantasy_points_for_team
            
        FROM league_players lp
        LEFT JOIN player_active_accrued_stats aas
            ON lp.mlb_player_id = aas.mlb_player_id
            AND lp.team_id = aas.team_id
            AND lp.league_id = aas.league_id
            
        WHERE 
            lp.team_id::text = :team_id
            AND lp.league_id::text = :league_id
    """
    
    result = execute_sql(
        roster_query,
        {
            "team_id": team_id,
            "league_id": league_id
        },
        "leagues"
    )
    
    if not result.get("records"):
        return {
            "success": True,
            "players": [],
            "count": 0,
            "team_info": None
        }
    
    # Extract player IDs and build lookup
    player_ids = []
    roster_lookup = {}
    
    for row in result["records"]:
        mlb_id = row["mlb_player_id"]
        player_ids.append(mlb_id)
        roster_lookup[mlb_id] = {
            "league_player_id": row["league_player_id"],
            "contract_salary": float(row["contract_salary"]) if row.get("contract_salary") else 0.0,
            "contract_years": row.get("contract_years"),
            "roster_status": row["roster_status"],
            "roster_position": row.get("roster_position"),
            "acquisition_date": row.get("acquisition_date"),
            "market_price": float(row["market_price"]) if row.get("market_price") else None,
            "team_batting_avg": float(row["team_batting_avg"]) if row.get("team_batting_avg") else None,
            "team_home_runs": row.get("team_home_runs"),
            "team_rbi": row.get("team_rbi"),
            "fantasy_points_for_team": float(row["fantasy_points_for_team"]) if row.get("fantasy_points_for_team") else None
        }
    
    # STEP 2: Get MLB player info from postgres DB
    if not player_ids:
        return {
            "success": True,
            "players": [],
            "count": 0,
            "team_info": None
        }
    
    placeholders = ','.join([f':id_{i}' for i in range(len(player_ids))])
    params = {f'id_{i}': pid for i, pid in enumerate(player_ids)}
    
    mlb_query = f"""
        SELECT 
            player_id as mlb_id,
            first_name,
            last_name,
            position,
            mlb_team
        FROM mlb_players
        WHERE player_id IN ({placeholders})
        ORDER BY 
            CASE position
                WHEN 'C' THEN 1
                WHEN '1B' THEN 2
                WHEN '2B' THEN 3
                WHEN 'SS' THEN 4
                WHEN '3B' THEN 5
                WHEN 'OF' THEN 6
                WHEN 'DH' THEN 7
                WHEN 'SP' THEN 8
                WHEN 'RP' THEN 9
                ELSE 10
            END,
            last_name
    """
    
    mlb_result = execute_sql(mlb_query, params, "postgres")
    
    # STEP 3: Get season stats from postgres DB - COMPLETE STAT SET (35+ fields)
    params['season'] = CURRENT_SEASON
    
    stats_query = f"""
        SELECT 
            player_id,
            -- Batting stats (complete set)
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
            hit_by_pitch,
            -- Pitching stats (complete set)
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
        WHERE player_id IN ({placeholders})
            AND season = :season
    """
    
    stats_result = execute_sql(stats_query, params, "postgres")
    
    # Build stats lookup - COMPLETE STAT SET
    stats_lookup = {}
    if stats_result and stats_result.get("records"):
        for row in stats_result["records"]:
            stats_lookup[row["player_id"]] = {
                # Batting stats
                "games_played": row.get("games_played"),
                "at_bats": row.get("at_bats"),
                "runs": row.get("runs"),
                "hits": row.get("hits"),
                "doubles": row.get("doubles"),
                "triples": row.get("triples"),
                "home_runs": row.get("home_runs"),
                "rbi": row.get("rbi"),
                "stolen_bases": row.get("stolen_bases"),
                "caught_stealing": row.get("caught_stealing"),
                "walks": row.get("walks"),
                "strikeouts": row.get("strikeouts"),
                "batting_avg": float(row["batting_avg"]) if row.get("batting_avg") else None,
                "obp": float(row["obp"]) if row.get("obp") else None,
                "slg": float(row["slg"]) if row.get("slg") else None,
                "ops": float(row["ops"]) if row.get("ops") else None,
                "hit_by_pitch": row.get("hit_by_pitch"),
                # Pitching stats
                "games_started": row.get("games_started"),
                "wins": row.get("wins"),
                "losses": row.get("losses"),
                "saves": row.get("saves"),
                "innings_pitched": float(row["innings_pitched"]) if row.get("innings_pitched") else None,
                "hits_allowed": row.get("hits_allowed"),
                "earned_runs": row.get("earned_runs"),
                "walks_allowed": row.get("walks_allowed"),
                "strikeouts_pitched": row.get("strikeouts_pitched"),
                "era": float(row["era"]) if row.get("era") else None,
                "whip": float(row["whip"]) if row.get("whip") else None,
                "quality_starts": row.get("quality_starts"),
                "blown_saves": row.get("blown_saves"),
                "holds": row.get("holds")
            }
    
    # STEP 4: Get 14-day rolling stats from postgres DB
    rolling_query = f"""
        SELECT 
            player_id,
            games_played,
            batting_avg,
            home_runs,
            rbi,
            runs,
            stolen_bases,
            obp,
            slg,
            ops,
            era,
            wins,
            saves,
            whip,
            innings_pitched,
            strikeouts_pitched,
            quality_starts
        FROM player_rolling_stats
        WHERE player_id IN ({placeholders})
            AND period = 'last_14_days'
            AND as_of_date = (SELECT MAX(as_of_date) FROM player_rolling_stats WHERE period = 'last_14_days')
    """
    
    rolling_result = execute_sql(rolling_query, params, "postgres")
    
    # Build rolling stats lookup
    rolling_lookup = {}
    if rolling_result and rolling_result.get("records"):
        for row in rolling_result["records"]:
            rolling_lookup[row["player_id"]] = {
                "games_played": row.get("games_played"),
                "batting_avg": float(row["batting_avg"]) if row.get("batting_avg") else None,
                "home_runs": row.get("home_runs"),
                "rbi": row.get("rbi"),
                "runs": row.get("runs"),
                "stolen_bases": row.get("stolen_bases"),
                "obp": float(row["obp"]) if row.get("obp") else None,
                "slg": float(row["slg"]) if row.get("slg") else None,
                "ops": float(row["ops"]) if row.get("ops") else None,
                "era": float(row["era"]) if row.get("era") else None,
                "wins": row.get("wins"),
                "saves": row.get("saves"),
                "whip": float(row["whip"]) if row.get("whip") else None,
                "innings_pitched": float(row["innings_pitched"]) if row.get("innings_pitched") else None,
                "strikeouts_pitched": row.get("strikeouts_pitched"),
                "quality_starts": row.get("quality_starts")
            }
    
    # STEP 5: Combine all data
    players = []
    if mlb_result and mlb_result.get("records"):
        for row in mlb_result["records"]:
            mlb_id = row["mlb_id"]
            league_data = roster_lookup.get(mlb_id, {})
            season_stats = stats_lookup.get(mlb_id, {})
            rolling_stats = rolling_lookup.get(mlb_id, {})
            
            players.append({
                "ids": {
                    "mlb": mlb_id,
                    "league_player": league_data.get("league_player_id")
                },
                "info": {
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "full_name": f"{row['first_name']} {row['last_name']}",
                    "position": row["position"],
                    "mlb_team": row["mlb_team"]
                },
                "roster": {
                    "status": league_data.get("roster_status"),
                    "position": league_data.get("roster_position"),
                    "acquisition_date": league_data.get("acquisition_date")
                },
                "financial": {
                    "contract_salary": league_data.get("contract_salary"),
                    "contract_years": league_data.get("contract_years"),
                    "market_price": league_data.get("market_price")
                },
                "stats": {
                    "season": season_stats,
                    "rolling_14_day": rolling_stats,
                    "team_attribution": {
                        "batting_avg": league_data.get("team_batting_avg"),
                        "home_runs": league_data.get("team_home_runs"),
                        "rbi": league_data.get("team_rbi"),
                        "fantasy_points": league_data.get("fantasy_points_for_team")
                    }
                }
            })
    
    return {
        "success": True,
        "players": players,
        "count": len(players)
    }


# =================================================================
# Team Roster in League (Canonical) - View ANY Team's Roster
# =================================================================

@router.get("/leagues/{league_id}/teams/{team_id}/roster")
async def get_team_roster_in_league(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get ANY team's roster in a specific league (for viewing other teams).
    Includes team attribution stats.
    
    Use this for:
    - Viewing opponent rosters
    - Scouting other teams
    - Commissioner viewing any team
    """
    
    # Get league database name
    league_info = execute_sql(
        "SELECT database_name FROM user_leagues WHERE league_id = :league_id::uuid",
        {"league_id": league_id},
        "postgres"
    )
    
    if not league_info.get("records"):
        raise HTTPException(status_code=404, detail="League not found")
    
    db_name = league_info["records"][0]["database_name"]
    
    # FIXED: Split into multiple queries to avoid cross-database JOIN
    # STEP 1: Get roster from leagues DB
    roster_query = """
        SELECT 
            lp.league_player_id,
            lp.mlb_player_id,
            lp.salary as contract_salary,
            lp.contract_years,
            lp.roster_status,
            lp.roster_position,
            lp.acquisition_date,
            t.team_name,
            
            -- Market price (from salary engine or manual override)
            COALESCE(lp.manual_price_override, lp.generated_price) as market_price,
            
            -- Active accrued stats (from league DB)
            aas.active_batting_avg as team_batting_avg,
            aas.active_home_runs as team_home_runs,
            aas.active_rbi as team_rbi,
            0 as fantasy_points_for_team
            
        FROM league_players lp
        INNER JOIN league_teams t ON lp.team_id = t.team_id
        LEFT JOIN player_active_accrued_stats aas
            ON lp.mlb_player_id = aas.mlb_player_id
            AND lp.team_id = aas.team_id
            AND lp.league_id = aas.league_id
            
        WHERE 
            lp.team_id::text = :team_id
            AND lp.league_id::text = :league_id
    """
    
    result = execute_sql(
        roster_query,
        {
            "team_id": team_id,
            "league_id": league_id
        },
        "leagues"
    )
    
    if not result.get("records"):
        return {
            "success": True,
            "players": [],
            "count": 0,
            "team_id": team_id,
            "team_name": None
        }
    
    # Extract player IDs and build lookup
    player_ids = []
    roster_lookup = {}
    team_name = result["records"][0].get("team_name") if result["records"] else None
    
    for row in result["records"]:
        mlb_id = row["mlb_player_id"]
        player_ids.append(mlb_id)
        roster_lookup[mlb_id] = {
            "league_player_id": row["league_player_id"],
            "contract_salary": float(row["contract_salary"]) if row.get("contract_salary") else 0.0,
            "contract_years": row.get("contract_years"),
            "roster_status": row["roster_status"],
            "roster_position": row.get("roster_position"),
            "acquisition_date": row.get("acquisition_date"),
            "market_price": float(row["market_price"]) if row.get("market_price") else None,
            "team_batting_avg": float(row["team_batting_avg"]) if row.get("team_batting_avg") else None,
            "team_home_runs": row.get("team_home_runs"),
            "team_rbi": row.get("team_rbi"),
            "fantasy_points_for_team": float(row["fantasy_points_for_team"]) if row.get("fantasy_points_for_team") else None
        }
    
    # STEP 2: Get MLB player info from postgres DB
    if not player_ids:
        return {
            "success": True,
            "players": [],
            "count": 0,
            "team_id": team_id,
            "team_name": team_name
        }
    
    placeholders = ','.join([f':id_{i}' for i in range(len(player_ids))])
    params = {f'id_{i}': pid for i, pid in enumerate(player_ids)}
    
    mlb_query = f"""
        SELECT 
            player_id as mlb_id,
            first_name,
            last_name,
            position,
            mlb_team
        FROM mlb_players
        WHERE player_id IN ({placeholders})
        ORDER BY 
            CASE position
                WHEN 'C' THEN 1
                WHEN '1B' THEN 2
                WHEN '2B' THEN 3
                WHEN 'SS' THEN 4
                WHEN '3B' THEN 5
                WHEN 'OF' THEN 6
                WHEN 'DH' THEN 7
                WHEN 'SP' THEN 8
                WHEN 'RP' THEN 9
                ELSE 10
            END,
            last_name
    """
    
    mlb_result = execute_sql(mlb_query, params, "postgres")
    
    # STEP 3: Get season stats from postgres DB - COMPLETE STAT SET (35+ fields)
    params['season'] = CURRENT_SEASON
    
    stats_query = f"""
        SELECT 
            player_id,
            -- Batting stats (complete set)
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
            hit_by_pitch,
            -- Pitching stats (complete set)
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
        WHERE player_id IN ({placeholders})
            AND season = :season
    """
    
    stats_result = execute_sql(stats_query, params, "postgres")
    
    # Build stats lookup
    stats_lookup = {}
    if stats_result and stats_result.get("records"):
        for row in stats_result["records"]:
            stats_lookup[row["player_id"]] = {
                "batting_avg": float(row["batting_avg"]) if row.get("batting_avg") else None,
                "home_runs": row.get("home_runs"),
                "rbi": row.get("rbi"),
                "stolen_bases": row.get("stolen_bases"),
                "era": float(row["era"]) if row.get("era") else None,
                "wins": row.get("wins"),
                "saves": row.get("saves"),
                "whip": float(row["whip"]) if row.get("whip") else None
            }
    
    # STEP 4: Combine all data
    players = []
    if mlb_result and mlb_result.get("records"):
        for row in mlb_result["records"]:
            mlb_id = row["mlb_id"]
            league_data = roster_lookup.get(mlb_id, {})
            season_stats = stats_lookup.get(mlb_id, {})
            
            players.append({
                "ids": {
                    "mlb": mlb_id,
                    "league_player": league_data.get("league_player_id")
                },
                "info": {
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "full_name": f"{row['first_name']} {row['last_name']}",
                    "position": row["position"],
                    "mlb_team": row["mlb_team"]
                },
                "roster": {
                    "status": league_data.get("roster_status"),
                    "position": league_data.get("roster_position"),
                    "acquisition_date": league_data.get("acquisition_date")
                },
                "financial": {
                    "contract_salary": league_data.get("contract_salary"),
                    "contract_years": league_data.get("contract_years"),
                    "market_price": league_data.get("market_price")
                },
                "stats": {
                    "season": season_stats,
                    "team_attribution": {
                        "batting_avg": league_data.get("team_batting_avg"),
                        "home_runs": league_data.get("team_home_runs"),
                        "rbi": league_data.get("team_rbi"),
                        "fantasy_points": league_data.get("fantasy_points_for_team")
                    }
                }
            })
    
    return {
        "success": True,
        "players": players,
        "count": len(players),
        "team_id": team_id,
        "team_name": team_name
    }


# =================================================================
# =================================================================
# GENERAL MLB PLAYER ENDPOINTS (No League Context Required)
# These endpoints return canonical player data without league-specific info
# =================================================================
# =================================================================


# =================================================================
# PLAYER COMPLETE PROFILE (General MLB Data - No League Context)
# =================================================================

@router.get("/{player_id}")
@router.get("/{player_id}/complete")
@cached(ttl_seconds=600, key_prefix='player_complete', key_params=['player_id'])
async def get_player_complete(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete player profile with season stats and rolling 14-day performance.
    Returns canonical structure with NO league context.
    
    CACHED: 10 minute TTL - This is an expensive query!
    
    Use this for:
    - Player modal (general MLB view)
    - Player research outside of league
    - Dashboard player cards
    """
    
    # Get basic info and current season stats
    sql = """
    SELECT 
        p.player_id as mlb_id,
        p.first_name,
        p.last_name,
        p.position,
        p.mlb_team,
        p.jersey_number,
        p.height_inches,
        p.weight_pounds,
        p.birthdate,
        p.is_active as active,
        -- Current season batting stats
        ps.games_played,
        ps.at_bats,
        ps.hits,
        ps.runs,
        ps.rbi,
        ps.home_runs,
        ps.doubles,
        ps.triples,
        ps.stolen_bases,
        ps.walks,
        ps.strikeouts,
        ps.batting_avg,
        ps.obp,
        ps.slg,
        ps.ops,
        ps.hit_by_pitch,
        -- Pitching stats
        ps.innings_pitched,
        ps.wins,
        ps.losses,
        ps.saves,
        ps.era,
        ps.whip,
        ps.strikeouts_pitched,
        ps.quality_starts,
        ps.blown_saves,
        ps.holds
    FROM mlb_players p
    LEFT JOIN player_season_stats ps ON p.player_id = ps.player_id 
        AND ps.season = :season
    WHERE p.player_id = :player_id
    """
    
    response = execute_sql(
        sql,
        {'player_id': player_id, 'season': CURRENT_SEASON},
        'postgres'
    )
    
    if not response or not response.get('records'):
        raise HTTPException(status_code=404, detail="Player not found")
    
    record = response['records'][0]
    
    # Build canonical structure
    player_data = {
        "ids": {
            "mlb": record["mlb_id"]
        },
        "info": {
            "first_name": record["first_name"],
            "last_name": record["last_name"],
            "full_name": f"{record['first_name']} {record['last_name']}",
            "position": record["position"],
            "mlb_team": record["mlb_team"],
            "active": record["active"],
            "jersey_number": record.get("jersey_number"),
            "height_inches": record.get("height_inches"),
            "weight_pounds": record.get("weight_pounds"),
            "birthdate": record.get("birthdate")
        },
        "stats": {
            "season": {
                "games_played": record.get("games_played"),
                "at_bats": record.get("at_bats"),
                "hits": record.get("hits"),
                "runs": record.get("runs"),
                "rbi": record.get("rbi"),
                "home_runs": record.get("home_runs"),
                "doubles": record.get("doubles"),
                "triples": record.get("triples"),
                "stolen_bases": record.get("stolen_bases"),
                "walks": record.get("walks"),
                "strikeouts": record.get("strikeouts"),
                "batting_avg": float(record["batting_avg"]) if record.get("batting_avg") else None,
                "obp": float(record["obp"]) if record.get("obp") else None,
                "slg": float(record["slg"]) if record.get("slg") else None,
                "ops": float(record["ops"]) if record.get("ops") else None,
                "hit_by_pitch": record.get("hit_by_pitch"),
                # Pitching stats
                "innings_pitched": float(record["innings_pitched"]) if record.get("innings_pitched") else None,
                "wins": record.get("wins"),
                "losses": record.get("losses"),
                "saves": record.get("saves"),
                "era": float(record["era"]) if record.get("era") else None,
                "whip": float(record["whip"]) if record.get("whip") else None,
                "strikeouts_pitched": record.get("strikeouts_pitched"),
                "quality_starts": record.get("quality_starts"),
                "blown_saves": record.get("blown_saves"),
                "holds": record.get("holds")
            }
        }
    }
    
    # Get rolling 14-day stats
    rolling_sql = """
    SELECT 
        COUNT(*) as games,
        SUM(at_bats) as at_bats,
        SUM(hits) as hits,
        SUM(runs) as runs,
        SUM(rbi) as rbi,
        SUM(home_runs) as home_runs,
        SUM(doubles) as doubles,
        SUM(triples) as triples,
        SUM(stolen_bases) as stolen_bases,
        SUM(walks) as walks,
        SUM(strikeouts) as strikeouts,
        SUM(innings_pitched) as innings_pitched,
        SUM(earned_runs) as earned_runs,
        SUM(strikeouts_pitched) as strikeouts_pitched,
        SUM(wins) as wins,
        SUM(saves) as saves,
        SUM(quality_starts) as quality_starts,
        SUM(hits_allowed) as hits_allowed,
        SUM(walks_allowed) as walks_allowed,
        SUM(losses) as losses,
        SUM(blown_saves) as blown_saves,
        SUM(holds) as holds
    FROM player_game_logs
    WHERE player_id = :player_id
        AND game_date >= CURRENT_DATE - INTERVAL '14' DAY
    """
    
    rolling_response = execute_sql(
        rolling_sql,
        {'player_id': player_id},
        'postgres'
    )
    
    if rolling_response and rolling_response.get('records'):
        rolling_record = rolling_response['records'][0]
        games = rolling_record.get("games") or 0
        
        if games > 0:
            at_bats = int(rolling_record.get("at_bats") or 0)
            hits = int(rolling_record.get("hits") or 0)
            doubles = int(rolling_record.get("doubles") or 0)
            triples = int(rolling_record.get("triples") or 0)
            home_runs = int(rolling_record.get("home_runs") or 0)
            walks = int(rolling_record.get("walks") or 0)
            innings = float(rolling_record.get("innings_pitched") or 0)  # Convert to float
            earned_runs = float(rolling_record.get("earned_runs") or 0)  # Convert to float
            
            player_data["stats"]["rolling_14_day"] = {
                "games": games,
                "at_bats": at_bats,
                "hits": hits,
                "runs": rolling_record.get("runs"),
                "rbi": rolling_record.get("rbi"),
                "home_runs": home_runs,
                "doubles": doubles,
                "triples": triples,
                "stolen_bases": rolling_record.get("stolen_bases"),
                "walks": walks,
                "strikeouts": rolling_record.get("strikeouts"),
                "batting_avg": round(hits / at_bats, 3) if at_bats > 0 else 0,
                "innings_pitched": innings,
                "earned_runs": earned_runs,
                "era": round((earned_runs * 9) / innings, 2) if innings > 0 else 0,
                "strikeouts_pitched": rolling_record.get("strikeouts_pitched"),
                "wins": rolling_record.get("wins"),
                "saves": rolling_record.get("saves"),
                "quality_starts": rolling_record.get("quality_starts"),
                "hits_allowed": rolling_record.get("hits_allowed"),
                "walks_allowed": rolling_record.get("walks_allowed"),
                "losses": rolling_record.get("losses"),
                "blown_saves": rolling_record.get("blown_saves"),
                "holds": rolling_record.get("holds")
            }
            
            # Calculate advanced stats
            if at_bats > 0:
                player_data["stats"]["rolling_14_day"]["obp"] = round(
                    (hits + walks) / (at_bats + walks), 3
                ) if (at_bats + walks) > 0 else 0
                
                singles = hits - doubles - triples - home_runs
                total_bases = singles + (2 * doubles) + (3 * triples) + (4 * home_runs)
                player_data["stats"]["rolling_14_day"]["slg"] = round(total_bases / at_bats, 3)
                player_data["stats"]["rolling_14_day"]["ops"] = round(
                    player_data["stats"]["rolling_14_day"]["obp"] + 
                    player_data["stats"]["rolling_14_day"]["slg"], 3
                )
            
            if innings > 0:
                hits_allowed = rolling_record.get("hits_allowed") or 0
                walks_allowed = rolling_record.get("walks_allowed") or 0
                player_data["stats"]["rolling_14_day"]["whip"] = round(
                    (hits_allowed + walks_allowed) / innings, 3
                )
    
    # Get career stats (year-by-year)
    career_sql = """
    SELECT 
        season, mlb_team, games_played, at_bats, runs, hits, doubles, triples, home_runs, rbi,
        stolen_bases, walks, strikeouts, batting_avg, obp, slg, ops,
        innings_pitched, wins, losses, saves, era, whip, strikeouts_pitched, quality_starts
    FROM player_season_stats
    WHERE player_id = :player_id
    ORDER BY season DESC
    """
    
    career_response = execute_sql(
        career_sql,
        {'player_id': player_id},
        'postgres'
    )
    
    career_stats = []
    if career_response and career_response.get('records'):
        for record in career_response['records']:
            career_stats.append({
                "season": record["season"],
                "mlb_team": record["mlb_team"],
                "games_played": record.get("games_played"),
                "at_bats": record.get("at_bats"),
                "runs": record.get("runs"),
                "hits": record.get("hits"),
                "doubles": record.get("doubles"),
                "triples": record.get("triples"),
                "home_runs": record.get("home_runs"),
                "rbi": record.get("rbi"),
                "stolen_bases": record.get("stolen_bases"),
                "walks": record.get("walks"),
                "strikeouts": record.get("strikeouts"),
                "batting_avg": float(record["batting_avg"]) if record.get("batting_avg") else None,
                "obp": float(record["obp"]) if record.get("obp") else None,
                "slg": float(record["slg"]) if record.get("slg") else None,
                "ops": float(record["ops"]) if record.get("ops") else None,
                "innings_pitched": float(record["innings_pitched"]) if record.get("innings_pitched") else None,
                "wins": record.get("wins"),
                "losses": record.get("losses"),
                "saves": record.get("saves"),
                "era": float(record["era"]) if record.get("era") else None,
                "whip": float(record["whip"]) if record.get("whip") else None,
                "strikeouts_pitched": record.get("strikeouts_pitched"),
                "quality_starts": record.get("quality_starts")
            })
    
    # Calculate career totals
    career_totals = None
    if career_stats:
        career_totals = {
            "games_played": sum(s.get("games_played", 0) or 0 for s in career_stats),
            "at_bats": sum(s.get("at_bats", 0) or 0 for s in career_stats),
            "runs": sum(s.get("runs", 0) or 0 for s in career_stats),
            "hits": sum(s.get("hits", 0) or 0 for s in career_stats),
            "doubles": sum(s.get("doubles", 0) or 0 for s in career_stats),
            "triples": sum(s.get("triples", 0) or 0 for s in career_stats),
            "home_runs": sum(s.get("home_runs", 0) or 0 for s in career_stats),
            "rbi": sum(s.get("rbi", 0) or 0 for s in career_stats),
            "stolen_bases": sum(s.get("stolen_bases", 0) or 0 for s in career_stats),
            "walks": sum(s.get("walks", 0) or 0 for s in career_stats),
            "strikeouts": sum(s.get("strikeouts", 0) or 0 for s in career_stats),
            "innings_pitched": sum(s.get("innings_pitched", 0) or 0 for s in career_stats),
            "wins": sum(s.get("wins", 0) or 0 for s in career_stats),
            "losses": sum(s.get("losses", 0) or 0 for s in career_stats),
            "saves": sum(s.get("saves", 0) or 0 for s in career_stats),
            "strikeouts_pitched": sum(s.get("strikeouts_pitched", 0) or 0 for s in career_stats),
            "quality_starts": sum(s.get("quality_starts", 0) or 0 for s in career_stats)
        }
        
        # Calculate career averages
        total_ab = career_totals["at_bats"]
        if total_ab > 0:
            career_totals["batting_avg"] = round(career_totals["hits"] / total_ab, 3)
            singles = career_totals["hits"] - career_totals["doubles"] - career_totals["triples"] - career_totals["home_runs"]
            total_bases = singles + (2 * career_totals["doubles"]) + (3 * career_totals["triples"]) + (4 * career_totals["home_runs"])
            career_totals["slg"] = round(total_bases / total_ab, 3)
        
        total_pa = total_ab + career_totals["walks"]
        if total_pa > 0:
            career_totals["obp"] = round((career_totals["hits"] + career_totals["walks"]) / total_pa, 3)
        
        if career_totals.get("obp") and career_totals.get("slg"):
            career_totals["ops"] = round(career_totals["obp"] + career_totals["slg"], 3)
    
    player_data["career_stats"] = career_stats
    player_data["career_totals"] = career_totals
    
    # Calculate analytics using PlayerAnalytics
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Calculating analytics for player {player_id}")
        analytics_calculator = PlayerAnalytics(player_id, None)  # No league_id in general endpoint
        analytics = analytics_calculator.get_comprehensive_analytics()
        logger.info(f"Analytics calculated successfully: {list(analytics.keys()) if analytics else 'empty'}")
        player_data["analytics"] = analytics
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error calculating analytics for player {player_id}: {e}", exc_info=True)
        player_data["analytics"] = {}
    
    return {
        "success": True,
        "player": player_data
    }


# =================================================================
# CAREER STATS (Year-by-Year)
# =================================================================

@router.get("/{player_id}/career-stats")
@cached(ttl_seconds=3600, key_prefix='player_career', key_params=['player_id'])
async def get_player_career_stats(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Get career year-by-year statistics.
    Returns canonical structure.
    
    CACHED: 1 hour TTL - Career stats don't change often
    
    Use this for:
    - Career history view
    - Player comparison
    - Contract evaluation
    """
    
    sql = """
    SELECT 
        season, mlb_team, games_played, games_started, at_bats, hits, runs, rbi, home_runs, 
        doubles, triples, stolen_bases, walks, strikeouts, 
        batting_avg, obp, slg, ops,
        innings_pitched, wins, losses, saves, era, whip, strikeouts_pitched, quality_starts
    FROM player_season_stats 
    WHERE player_id = :player_id
    ORDER BY season DESC
    """
    
    response = execute_sql(
        sql,
        {'player_id': player_id},
        'postgres'
    )
    
    career_years = []
    if response and response.get('records'):
        for record in response['records']:
            year_data = {
                "season": record["season"],
                "mlb_team": record["mlb_team"],
                "games_played": record.get("games_played"),
                "games_started": (1 if record.get("was_starter") else 0),
                "at_bats": record.get("at_bats"),
                "hits": record.get("hits"),
                "runs": record.get("runs"),
                "rbi": record.get("rbi"),
                "home_runs": record.get("home_runs"),
                "doubles": record.get("doubles"),
                "triples": record.get("triples"),
                "stolen_bases": record.get("stolen_bases"),
                "walks": record.get("walks"),
                "strikeouts": record.get("strikeouts"),
                "batting_avg": float(record["batting_avg"]) if record.get("batting_avg") else None,
                "obp": float(record["obp"]) if record.get("obp") else None,
                "slg": float(record["slg"]) if record.get("slg") else None,
                "ops": float(record["ops"]) if record.get("ops") else None,
                # Pitching
                "innings_pitched": float(record["innings_pitched"]) if record.get("innings_pitched") else None,
                "wins": record.get("wins"),
                "losses": record.get("losses"),
                "saves": record.get("saves"),
                "era": float(record["era"]) if record.get("era") else None,
                "whip": float(record["whip"]) if record.get("whip") else None,
                "strikeouts_pitched": record.get("strikeouts_pitched"),
                "quality_starts": record.get("quality_starts")
            }
            career_years.append(year_data)
    
    # Calculate career totals
    career_totals = None
    if career_years:
        totals = {
            "season": "Career",
            "mlb_team": "Career",
            "games_played": sum(y.get("games_played", 0) for y in career_years),
            "games_started": sum(y.get("games_started", 0) for y in career_years),
            "at_bats": sum(y.get("at_bats", 0) for y in career_years),
            "hits": sum(y.get("hits", 0) for y in career_years),
            "runs": sum(y.get("runs", 0) for y in career_years),
            "rbi": sum(y.get("rbi", 0) for y in career_years),
            "home_runs": sum(y.get("home_runs", 0) for y in career_years),
            "doubles": sum(y.get("doubles", 0) for y in career_years),
            "triples": sum(y.get("triples", 0) for y in career_years),
            "stolen_bases": sum(y.get("stolen_bases", 0) for y in career_years),
            "walks": sum(y.get("walks", 0) for y in career_years),
            "strikeouts": sum(y.get("strikeouts", 0) for y in career_years),
            "innings_pitched": sum(y.get("innings_pitched", 0) or 0 for y in career_years),
            "wins": sum(y.get("wins", 0) for y in career_years),
            "losses": sum(y.get("losses", 0) for y in career_years),
            "saves": sum(y.get("saves", 0) for y in career_years),
            "strikeouts_pitched": sum(y.get("strikeouts_pitched", 0) for y in career_years),
            "quality_starts": sum(y.get("quality_starts", 0) for y in career_years)
        }
        
        # Calculate career averages
        total_ab = totals["at_bats"]
        if total_ab > 0:
            totals["batting_avg"] = round(totals["hits"] / total_ab, 3)
            singles = totals["hits"] - totals["doubles"] - totals["triples"] - totals["home_runs"]
            total_bases = singles + (2 * totals["doubles"]) + (3 * totals["triples"]) + (4 * totals["home_runs"])
            totals["slg"] = round(total_bases / total_ab, 3)
        
        total_pa = total_ab + totals["walks"]
        if total_pa > 0:
            totals["obp"] = round((totals["hits"] + totals["walks"]) / total_pa, 3)
        
        if totals.get("obp") and totals.get("slg"):
            totals["ops"] = round(totals["obp"] + totals["slg"], 3)
        
        career_totals = totals
    
    return {
        "success": True,
        "ids": {"mlb": player_id},
        "career": {
            "years": career_years,
            "totals": career_totals,
            "total_seasons": len(career_years)
        }
    }


# =================================================================
# GAME LOGS
# =================================================================

@router.get("/{player_id}/game-logs")
async def get_player_game_logs(
    player_id: int,
    limit: int = Query(20, ge=1, le=100),
    days: Optional[int] = Query(None, description="Filter to last N days"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get individual game-by-game logs.
    Returns canonical structure.
    
    Use this for:
    - Recent performance analysis
    - Hot/cold streak identification
    - Game-level detail view
    """
    
    date_filter = ""
    params = {'player_id': player_id, 'limit': limit}
    
    if days:
        date_filter = "AND game_date >= CURRENT_DATE - INTERVAL ':days' DAY"
        params['days'] = days
    
    sql = f"""
    SELECT 
        game_date, mlb_team, opponent, home_away,
        -- Batting stats
        at_bats, hits, runs, rbi, home_runs, doubles, triples,
        stolen_bases, walks, strikeouts, hit_by_pitch,
        -- Pitching stats
        innings_pitched, wins, losses, saves, earned_runs, 
        hits_allowed, walks_allowed, strikeouts_pitched,
        quality_starts, blown_saves, holds, was_starter
    FROM player_game_logs 
    WHERE player_id = :player_id 
        AND (innings_pitched > 0 OR at_bats > 0)
    {date_filter}
    ORDER BY game_date DESC
    LIMIT :limit
    """
    
    response = execute_sql(sql, params, 'postgres')
    
    games = []
    if response and response.get('records'):
        for record in response['records']:
            game = {
                "game_date": record["game_date"],
                "mlb_team": record.get("mlb_team", ""),
                "opponent": record["opponent"],
                "home_away": record["home_away"],
                "batting": {
                    "at_bats": record.get("at_bats"),
                    "hits": record.get("hits"),
                    "runs": record.get("runs"),
                    "rbi": record.get("rbi"),
                    "home_runs": record.get("home_runs"),
                    "doubles": record.get("doubles"),
                    "triples": record.get("triples"),
                    "stolen_bases": record.get("stolen_bases"),
                    "walks": record.get("walks"),
                    "strikeouts": record.get("strikeouts"),
                    "hit_by_pitch": record.get("hit_by_pitch")
                }
            }
            
            # Calculate batting avg for this game
            at_bats = record.get("at_bats") or 0
            hits = record.get("hits") or 0
            if at_bats > 0:
                game["batting"]["avg"] = round(hits / at_bats, 3)
            
            # Add pitching if applicable
            innings_pitched = float(record.get("innings_pitched") or 0)
            if innings_pitched > 0:
                er = float(record.get("earned_runs") or 0)
                hits_allowed = record.get("hits_allowed") or 0
                walks_allowed = record.get("walks_allowed") or 0
                
                game["pitching"] = {
                    "innings_pitched": innings_pitched,
                    "wins": record.get("wins") or 0,
                    "losses": record.get("losses") or 0,
                    "saves": record.get("saves") or 0,
                    "earned_runs": int(er),
                    "hits_allowed": hits_allowed,
                    "walks_allowed": walks_allowed,
                    "strikeouts": record.get("strikeouts_pitched") or 0,
                    "quality_starts": record.get("quality_starts") or 0,
                    "games_started": 1 if record.get("was_starter") else 0,
                    "blown_saves": record.get("blown_saves") or 0,
                    "holds": record.get("holds") or 0,
                    "era": round((er * 9) / innings_pitched, 2) if innings_pitched > 0 else 0,
                    "whip": round((hits_allowed + walks_allowed) / innings_pitched, 3) if innings_pitched > 0 else 0
                }
            
            games.append(game)
    
    return {
        "success": True,
        "ids": {"mlb": player_id},
        "game_logs": games,
        "count": len(games)
    }


# =================================================================
# RECENT PERFORMANCE (Aggregated Rolling Stats)
# =================================================================

@router.get("/{player_id}/recent-performance")
async def get_player_recent_performance(
    player_id: int,
    days: int = Query(7, ge=1, le=30, description="Number of days to look back"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get aggregated recent performance stats (rolling window).
    Returns canonical structure.
    
    Use this for:
    - Hot/cold streaks
    - Recent form analysis
    - Short-term performance trends
    """
    
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
        SUM(innings_pitched) as innings_pitched,
        SUM(wins) as wins,
        SUM(losses) as losses,
        SUM(saves) as saves,
        SUM(earned_runs) as earned_runs,
        SUM(strikeouts_pitched) as strikeouts_pitched
    FROM player_game_logs
    WHERE player_id = :player_id
        AND game_date >= CURRENT_DATE - INTERVAL ':days' DAY
    """
    
    response = execute_sql(
        sql,
        {'player_id': player_id, 'days': days},
        'postgres'
    )
    
    if not response or not response.get('records'):
        return {
            "success": True,
            "ids": {"mlb": player_id},
            "period_days": days,
            "games": 0,
            "stats": {}
        }
    
    record = response['records'][0]
    games = int(record.get("games") or 0)
    at_bats = int(record.get("at_bats") or 0)
    hits = int(record.get("hits") or 0)
    innings = float(record.get("innings_pitched") or 0)
    earned_runs = float(record.get("earned_runs") or 0)
    
    performance = {
        "success": True,
        "ids": {"mlb": player_id},
        "period_days": days,
        "games": games,
        "stats": {
            "batting": {
                "at_bats": at_bats,
                "hits": hits,
                "runs": record.get("runs"),
                "rbi": record.get("rbi"),
                "home_runs": record.get("home_runs"),
                "stolen_bases": record.get("stolen_bases"),
                "walks": record.get("walks"),
                "strikeouts": record.get("strikeouts"),
                "avg": round(hits / at_bats, 3) if at_bats > 0 else 0
            }
        }
    }
    
    # Add pitching if applicable
    if innings > 0:
        performance["stats"]["pitching"] = {
            "innings_pitched": innings,
            "wins": record.get("wins"),
            "losses": record.get("losses"),
            "saves": record.get("saves"),
            "earned_runs": earned_runs,
            "strikeouts": record.get("strikeouts_pitched"),
            "era": round((earned_runs * 9) / innings, 2) if innings > 0 else 0
        }
    
    return performance


# =================================================================
# TILE ANALYTICS ENDPOINTS (For PlayerGameLogsTab)
# =================================================================

@router.get("/{player_id}/pitcher-tile-analytics")
async def get_pitcher_tile_analytics(
    player_id: int,
    league_id: Optional[str] = Query(None, description="Optional league context"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get pitcher analytics for game log tiles.
    Returns 30-day performance benchmarking and other pitcher-specific metrics.
    
    Use this for:
    - PlayerGameLogsTab pitcher analytics tiles
    - Performance comparisons vs MLB/league benchmarks
    """
    
    try:
        # Instantiate PlayerAnalytics with player_id and optional league_id
        analytics = PlayerAnalytics(player_id=player_id, league_id=league_id)
        
        # Call the pitcher tile analytics method
        tile_data = analytics.get_pitcher_tile_analytics()
        
        # Return data at top level for frontend compatibility
        return {
            "success": True,
            "ids": {"mlb": player_id},
            **tile_data  # Spread the tile data at the top level
        }
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching pitcher tile analytics: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "analytics": {
                "performance_30d": {"error": str(e)},
                "trend_vs_starters": {},
                "quality_starts_rate": {},
                "command_metrics": {}
            }
        }


@router.get("/{player_id}/hitter-tile-analytics")
async def get_hitter_tile_analytics(
    player_id: int,
    league_id: Optional[str] = Query(None, description="Optional league context"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get hitter analytics for game log tiles.
    Returns batting trends, power metrics, and streak indicators.
    
    Use this for:
    - PlayerGameLogsTab hitter analytics tiles
    - Batting performance analysis
    """
    
    try:
        # Instantiate PlayerAnalytics with player_id and optional league_id
        analytics = PlayerAnalytics(player_id=player_id, league_id=league_id)
        
        # Call the hitter tile analytics method
        tile_data = analytics.get_hitter_tile_analytics()
        
        # Return data at top level for frontend compatibility
        return {
            "success": True,
            "ids": {"mlb": player_id},
            **tile_data  # Spread the tile data at the top level
        }
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching hitter tile analytics: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "analytics": {
                "batting_trend": {"error": str(e)},
                "power_metrics": {"error": str(e)},
                "clutch_performance": {"error": str(e)},
                "streak_indicator": {"error": str(e)}
            }
        }
