"""
Dynasty Dugout - Canonical Player Data Structure
Standardizes player representation across all API endpoints and database queries
"""

from typing import Optional, Dict, Any, List
from decimal import Decimal


class PlayerIdentifiers:
    """
    Canonical player identification structure.
    EVERY endpoint must use this to avoid ID confusion.
    """
    
    @staticmethod
    def create(
        mlb_id: int,
        league_player_id: Optional[str] = None,
        league_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create standardized player identifiers.
        
        Args:
            mlb_id: MLB official player ID (from main DB)
            league_player_id: UUID from league_players table (if rostered)
            league_id: Which league we're querying in
            
        Returns:
            {
                "ids": {
                    "mlb": 12345,              # Always present
                    "league_player": "uuid...", # Only if rostered
                    "league": "uuid..."         # Context
                }
            }
        """
        ids = {
            "mlb": mlb_id
        }
        
        if league_player_id:
            ids["league_player"] = league_player_id
            
        if league_id:
            ids["league"] = league_id
            
        return {"ids": ids}


class CanonicalPlayerQueries:
    """
    Standard SQL queries that return consistent player data.
    Use these instead of writing custom queries.
    """
    
    # =================================================================
    # GLOBAL PLAYER SEARCH (No League Context)
    # =================================================================
    
    SEARCH_MLB_PLAYERS = """
        SELECT 
            p.player_id as mlb_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            p.is_active as active,
            
            -- Season stats from main DB
            s.batting_avg,
            s.home_runs,
            s.rbi,
            s.stolen_bases,
            s.era,
            s.wins,
            s.saves,
            s.strikeouts_pitched,
            s.season as stats_season
            
        FROM mlb_players p
        LEFT JOIN player_season_stats s 
            ON p.player_id = s.player_id 
            AND s.season = EXTRACT(YEAR FROM CURRENT_DATE)
            
        WHERE 
            p.is_active = TRUE
            AND (
                LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER(:search)
                OR LOWER(p.last_name) LIKE LOWER(:search)
            )
            
        ORDER BY 
            CASE 
                WHEN LOWER(p.last_name) LIKE LOWER(:search) THEN 0
                ELSE 1
            END,
            p.last_name
            
        LIMIT :limit
    """
    
    # =================================================================
    # LEAGUE PLAYER QUERY (With League Context)
    # =================================================================
    
    PLAYER_IN_LEAGUE_CONTEXT = """
        SELECT 
            -- MLB data (from main DB via RDS Data API cross-database query)
            p.player_id as mlb_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            p.is_active as active,
            
            -- League-specific data
            lp.league_player_id,
            lp.team_id,
            lp.salary as contract_salary,
            lp.contract_years,
            lp.roster_status,
            lp.availability_status,
            
            -- Team ownership (if owned)
            t.team_name,
            t.manager_name,
            t.user_id as owner_user_id,
            
            -- Season stats (from main DB)
            s.games_played,
            s.at_bats,
            s.hits,
            s.home_runs,
            s.rbi,
            s.stolen_bases,
            s.batting_avg,
            s.ops,
            s.wins,
            s.saves,
            s.era,
            s.whip,
            s.strikeouts_pitched
            
        FROM league_players lp
        INNER JOIN postgres.mlb_players p ON lp.mlb_player_id = p.player_id
        LEFT JOIN league_teams t ON lp.team_id = t.team_id
        LEFT JOIN player_season_stats s 
            ON p.player_id = s.player_id 
            AND s.season = EXTRACT(YEAR FROM CURRENT_DATE)
            
        WHERE lp.mlb_player_id = :mlb_player_id
        AND lp.league_id = :league_id
    """
    
    # =================================================================
    # FREE AGENTS IN LEAGUE
    # =================================================================
    
    FREE_AGENTS_IN_LEAGUE = """
        SELECT 
            p.player_id as mlb_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            
            -- Market pricing (could be from league settings or calculated)
            lp.salary as market_price,
            
            -- Season stats
            s.batting_avg,
            s.home_runs,
            s.rbi,
            s.stolen_bases,
            s.era,
            s.wins,
            s.saves,
            s.whip
            
        FROM league_players lp
        INNER JOIN postgres.mlb_players p ON lp.mlb_player_id = p.player_id
        LEFT JOIN player_season_stats s 
            ON p.player_id = s.player_id 
            AND s.season = EXTRACT(YEAR FROM CURRENT_DATE)
            
        WHERE 
            lp.league_id = :league_id
            AND lp.team_id IS NULL
            AND lp.availability_status = 'free_agent'
            AND p.is_active = TRUE
            
        ORDER BY 
            CASE :sort_by
                WHEN 'batting_avg' THEN s.batting_avg
                WHEN 'home_runs' THEN s.home_runs
                WHEN 'era' THEN s.era
                ELSE 0
            END DESC
            
        LIMIT :limit
        OFFSET :offset
    """
    
    # =================================================================
    # MY ROSTER IN LEAGUE
    # =================================================================
    
    # =================================================================
    # PLAYER ACROSS ALL USER'S LEAGUES (Multi-League View)
    # =================================================================
    
    PLAYER_ACROSS_USER_LEAGUES = """
        -- Get player's status in ALL leagues the current user is a member of
        -- This is the "where is this player in my leagues?" query
        
        WITH user_leagues AS (
            -- Get all leagues this user is in
            SELECT DISTINCT league_id, league_name
            FROM postgres.league_memberships lm
            INNER JOIN postgres.user_leagues ul ON lm.league_id = ul.league_id
            WHERE lm.user_id = :user_id
        )
        SELECT
            ul.league_id,
            ul.league_name,
            
            -- Player IDs
            :mlb_player_id as mlb_id,
            lp.league_player_id,
            
            -- Ownership status in THIS league
            CASE
                WHEN lp.team_id IS NULL THEN 'available'
                WHEN t.user_id = :user_id THEN 'owned'
                ELSE 'other_team'
            END as status,
            
            -- Team info (if owned)
            lp.team_id,
            t.team_name,
            t.manager_name,
            t.user_id as owner_user_id,
            
            -- Contract/roster info (if owned)
            lp.salary,
            lp.contract_years,
            lp.roster_status,
            
            -- Stats are same across all leagues (from main DB)
            -- We'll fetch those separately to avoid duplication
            
        FROM user_leagues ul
        
        -- Try to find this player in each league's database
        -- Note: This requires dynamic SQL or multiple queries since each league is a separate DB
        -- For now, we'll need to query each league DB separately
        
        -- This is a template - actual implementation needs to:
        -- 1. Get list of user's leagues from main DB
        -- 2. Query each league DB individually
        -- 3. Combine results
    """
    
    # Helper: Single league portion of multi-league query
    PLAYER_IN_SINGLE_LEAGUE_FOR_MULTI_VIEW = """
        SELECT
            :league_id as league_id,
            :league_name as league_name,
            :mlb_player_id as mlb_id,
            
            lp.league_player_id,
            
            -- Status in this league
            CASE
                WHEN lp.team_id IS NULL THEN 'available'
                WHEN t.user_id = :user_id THEN 'owned'
                ELSE 'other_team'
            END as status,
            
            -- Ownership details
            lp.team_id,
            t.team_name,
            t.manager_name,
            CASE WHEN t.user_id = :user_id THEN TRUE ELSE FALSE END as is_user_team,
            
            -- Financial
            lp.salary as contract_salary,
            lp.contract_years,
            lp.availability_status as market_availability,
            
            -- Roster
            lp.roster_status,
            lp.acquisition_date
            
        FROM league_players lp
        LEFT JOIN league_teams t ON lp.team_id = t.team_id
        WHERE lp.mlb_player_id = :mlb_player_id
        LIMIT 1
    """
    
    TEAM_ROSTER_IN_LEAGUE = """
        SELECT 
            p.player_id as mlb_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            
            -- League context
            lp.league_player_id,
            lp.salary as contract_salary,
            lp.contract_years,
            lp.roster_status,
            lp.roster_position,
            lp.acquisition_date,
            
            -- Team info
            t.team_id,
            t.team_name,
            
            -- Season stats (COMPLETE SET - 35+ fields)
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
            s.hit_by_pitch,
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
            
            -- Active accrued stats (from league DB)
            aas.active_batting_avg as team_batting_avg,
            aas.active_home_runs as team_home_runs,
            aas.active_rbi as team_rbi,
            0 as fantasy_points_for_team
            
        FROM league_players lp
        INNER JOIN postgres.mlb_players p ON lp.mlb_player_id = p.player_id
        INNER JOIN league_teams t ON lp.team_id = t.team_id
        LEFT JOIN player_season_stats s 
            ON lp.mlb_player_id = s.player_id 
            AND lp.league_id = s.league_id
            AND s.season = EXTRACT(YEAR FROM CURRENT_DATE)
        LEFT JOIN player_active_accrued_stats aas
            ON lp.mlb_player_id = aas.mlb_player_id
            AND lp.team_id = aas.team_id
            AND lp.league_id = aas.league_id
            
        WHERE 
            t.team_id = :team_id
            AND lp.league_id = :league_id
            
        ORDER BY 
            CASE p.position
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
            lp.roster_status,
            p.last_name
    """
    
    MY_ROSTER_IN_LEAGUE = """
        SELECT 
            p.player_id as mlb_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            
            -- League context
            lp.league_player_id,
            lp.salary as contract_salary,
            lp.contract_years,
            lp.roster_status,
            lp.acquisition_date,
            
            -- Season stats (COMPLETE SET - 35+ fields)
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
            s.hit_by_pitch,
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
            
            -- Active accrued stats (from league DB)
            aas.active_batting_avg as team_batting_avg,
            aas.active_home_runs as team_home_runs,
            aas.active_rbi as team_rbi,
            0 as fantasy_points_for_team
            
        FROM league_players lp
        INNER JOIN postgres.mlb_players p ON lp.mlb_player_id = p.player_id
        INNER JOIN league_teams t ON lp.team_id = t.team_id
        LEFT JOIN player_season_stats s 
            ON lp.mlb_player_id = s.player_id 
            AND lp.league_id = s.league_id
            AND s.season = EXTRACT(YEAR FROM CURRENT_DATE)
        LEFT JOIN player_active_accrued_stats aas
            ON lp.mlb_player_id = aas.mlb_player_id
            AND lp.team_id = aas.team_id
            AND lp.league_id = aas.league_id
            
        WHERE 
            t.user_id = :user_id
            AND lp.league_id = :league_id
            
        ORDER BY 
            CASE p.position
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
            lp.roster_status,
            p.last_name
    """


class PlayerDataFormatter:
    """
    Format player data into canonical response structure.
    Use after querying with CanonicalPlayerQueries.
    """
    
    @staticmethod
    def format_search_result(row: Dict) -> Dict[str, Any]:
        """
        Format global player search result.
        No league context - just MLB data.
        """
        return {
            "ids": {
                "mlb": row["mlb_id"]
            },
            "info": {
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "full_name": f"{row['first_name']} {row['last_name']}",
                "position": row["position"],
                "mlb_team": row["mlb_team"],
                "active": row["active"]
            },
            "stats": {
                "season": row.get("stats_season"),
                "batting_avg": float(row["batting_avg"]) if row.get("batting_avg") else None,
                "home_runs": row.get("home_runs"),
                "rbi": row.get("rbi"),
                "stolen_bases": row.get("stolen_bases"),
                "era": float(row["era"]) if row.get("era") else None,
                "wins": row.get("wins"),
                "saves": row.get("saves"),
                "strikeouts_pitched": row.get("strikeouts_pitched")
            }
        }
    
    @staticmethod
    def format_league_player(row: Dict, user_id: str, league_id: str) -> Dict[str, Any]:
        """
        Format player with league context.
        Includes ownership, contracts, stats.
        """
        is_owned_by_user = row.get("owner_user_id") == user_id
        is_owned = row.get("team_id") is not None
        
        return {
            "ids": {
                "mlb": row["mlb_id"],
                "league_player": row.get("league_player_id"),
                "league": league_id
            },
            "info": {
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "full_name": f"{row['first_name']} {row['last_name']}",
                "position": row["position"],
                "mlb_team": row["mlb_team"],
                "active": row["active"]
            },
            "league_context": {
                "status": "owned" if is_owned else "available",
                "team": {
                    "team_id": row.get("team_id"),
                    "team_name": row.get("team_name"),
                    "owner_name": row.get("manager_name"),
                    "is_user_team": is_owned_by_user
                } if is_owned else None,
                "roster": {
                    "status": row.get("roster_status"),
                    "position": row.get("position")
                } if is_owned else None,
                "financial": {
                    "contract_salary": float(row["contract_salary"]) if row.get("contract_salary") else None,
                    "contract_years": row.get("contract_years"),
                    "market_price": None  # Calculated elsewhere
                }
            },
            "stats": {
                "season": {
                    "games": row.get("games_played"),
                    "batting_avg": float(row["batting_avg"]) if row.get("batting_avg") else None,
                    "home_runs": row.get("home_runs"),
                    "rbi": row.get("rbi"),
                    "stolen_bases": row.get("stolen_bases"),
                    "ops": float(row["ops"]) if row.get("ops") else None,
                    "era": float(row["era"]) if row.get("era") else None,
                    "wins": row.get("wins"),
                    "saves": row.get("saves"),
                    "whip": float(row["whip"]) if row.get("whip") else None,
                    "strikeouts_pitched": row.get("strikeouts_pitched")
                },
                "team_attribution": {
                    "batting_avg": float(row["team_batting_avg"]) if row.get("team_batting_avg") else None,
                    "home_runs": row.get("team_home_runs"),
                    "rbi": row.get("team_rbi"),
                    "fantasy_points": float(row["fantasy_points_for_team"]) if row.get("fantasy_points_for_team") else None
                } if is_owned_by_user else None
            }
        }


# =================================================================
# Migration Helper Functions
# =================================================================

def migrate_old_response_to_canonical(old_response: Dict) -> Dict:
    """
    Convert old inconsistent responses to new canonical format.
    Use this during migration to maintain backwards compatibility.
    
    Old format might be:
    {"player_id": 123, "first_name": "Mike", ...}
    
    New format:
    {"ids": {"mlb": 123}, "info": {"first_name": "Mike", ...}}
    """
    # Try to extract MLB ID from various old field names
    mlb_id = (
        old_response.get("mlb_player_id") or
        old_response.get("player_id") or
        old_response.get("id")
    )
    
    if not mlb_id:
        raise ValueError("Cannot find MLB player ID in old response")
    
    # Build canonical structure
    canonical = {
        "ids": {
            "mlb": int(mlb_id)
        },
        "info": {
            "first_name": old_response.get("first_name"),
            "last_name": old_response.get("last_name"),
            "full_name": old_response.get("full_name") or f"{old_response.get('first_name')} {old_response.get('last_name')}",
            "position": old_response.get("position"),
            "mlb_team": old_response.get("mlb_team")
        }
    }
    
    # Add league context if present
    if old_response.get("league_player_id"):
        canonical["ids"]["league_player"] = old_response["league_player_id"]
    
    # Add stats if present
    if any(k in old_response for k in ["batting_avg", "home_runs", "era"]):
        canonical["stats"] = {
            "season": {
                "batting_avg": old_response.get("batting_avg") or old_response.get("avg"),
                "home_runs": old_response.get("home_runs"),
                "rbi": old_response.get("rbi"),
                "era": old_response.get("era"),
                "wins": old_response.get("wins"),
                "saves": old_response.get("saves")
            }
        }
    
    return canonical


# =================================================================
# Multi-League Implementation Functions
# =================================================================

def get_player_across_user_leagues(
    mlb_player_id: int,
    user_id: str,
    execute_sql_func  # Your database execute function
) -> Dict[str, Any]:
    """
    Get player's status across ALL leagues the user is a member of.
    
    Since each league is a separate database, we need to:
    1. Query main DB for user's leagues
    2. Query each league DB separately
    3. Combine results
    
    Args:
        mlb_player_id: MLB official player ID
        user_id: Current user's Cognito ID
        execute_sql_func: Function to execute SQL queries
        
    Returns:
        {
            "ids": {"mlb": 12345},
            "info": {...},  # MLB data (same across all leagues)
            "league_contexts": [
                {
                    "league_id": "uuid1",
                    "league_name": "Dynasty League",
                    "status": "owned",
                    "team": {...},
                    "financial": {...}
                },
                {
                    "league_id": "uuid2",
                    "league_name": "Redraft League",
                    "status": "available",
                    "financial": {"market_price": 35.0}
                }
            ]
        }
    """
    
    # Step 1: Get MLB player basic info (from main DB)
    mlb_data_query = """
        SELECT 
            player_id as mlb_id,
            first_name,
            last_name,
            position,
            mlb_team,
            is_active as active
        FROM mlb_players
        WHERE player_id = :mlb_player_id
    """
    
    mlb_result = execute_sql_func(
        "postgres",
        mlb_data_query,
        {"mlb_player_id": mlb_player_id}
    )
    
    if not mlb_result["records"]:
        raise ValueError(f"Player {mlb_player_id} not found")
    
    player_info = mlb_result["records"][0]
    
    # Step 2: Get list of user's leagues (from main DB)
    user_leagues_query = """
        SELECT 
            ul.league_id,
            ul.league_name,
            ul.database_name
        FROM league_memberships lm
        INNER JOIN user_leagues ul ON lm.league_id = ul.league_id
        WHERE lm.user_id = :user_id
    """
    
    leagues_result = execute_sql_func(
        "postgres",
        user_leagues_query,
        {"user_id": user_id}
    )
    
    user_leagues = leagues_result["records"]
    
    # Step 3: Query each league DB for player status
    league_contexts = []
    
    for league in user_leagues:
        league_id = league["league_id"]
        league_name = league["league_name"]
        db_name = league["database_name"]
        
        # Query this specific league's database
        player_status_result = execute_sql_func(
            db_name,
            CanonicalPlayerQueries.PLAYER_IN_SINGLE_LEAGUE_FOR_MULTI_VIEW,
            {
                "league_id": league_id,
                "league_name": league_name,
                "mlb_player_id": mlb_player_id,
                "user_id": user_id
            }
        )
        
        if player_status_result["records"]:
            # Player exists in this league
            league_data = player_status_result["records"][0]
            
            league_contexts.append({
                "league_id": league_id,
                "league_name": league_name,
                "status": league_data["status"],
                "team": {
                    "team_id": league_data.get("team_id"),
                    "team_name": league_data.get("team_name"),
                    "owner_name": league_data.get("manager_name"),
                    "is_user_team": league_data.get("is_user_team", False)
                } if league_data["status"] != "available" else None,
                "roster": {
                    "status": league_data.get("roster_status"),
                    "acquisition_date": league_data.get("acquisition_date")
                } if league_data.get("roster_status") else None,
                "financial": {
                    "contract_salary": float(league_data["contract_salary"]) if league_data.get("contract_salary") else None,
                    "contract_years": league_data.get("contract_years"),
                    "market_availability": league_data.get("market_availability")
                }
            })
        else:
            # Player doesn't exist in this league yet
            # (might not be on any roster or in free agent pool)
            league_contexts.append({
                "league_id": league_id,
                "league_name": league_name,
                "status": "not_in_league",
                "team": None,
                "roster": None,
                "financial": None
            })
    
    # Step 4: Get current season stats (from main DB)
    stats_query = """
        SELECT
            games_played,
            at_bats,
            hits,
            home_runs,
            rbi,
            stolen_bases,
            batting_avg,
            ops,
            wins,
            saves,
            era,
            whip,
            strikeouts_pitched
        FROM player_season_stats
        WHERE player_id = :mlb_player_id
        AND season = EXTRACT(YEAR FROM CURRENT_DATE)
    """
    
    stats_result = execute_sql_func(
        "postgres",
        stats_query,
        {"mlb_player_id": mlb_player_id}
    )
    
    season_stats = stats_result["records"][0] if stats_result["records"] else {}
    
    # Step 5: Build canonical response
    return {
        "ids": {
            "mlb": mlb_player_id
        },
        "info": {
            "first_name": player_info["first_name"],
            "last_name": player_info["last_name"],
            "full_name": f"{player_info['first_name']} {player_info['last_name']}",
            "position": player_info["position"],
            "mlb_team": player_info["mlb_team"],
            "active": player_info["active"]
        },
        "stats": {
            "season": {
                "games": season_stats.get("games_played"),
                "batting_avg": float(season_stats["batting_avg"]) if season_stats.get("batting_avg") else None,
                "home_runs": season_stats.get("home_runs"),
                "rbi": season_stats.get("rbi"),
                "stolen_bases": season_stats.get("stolen_bases"),
                "ops": float(season_stats["ops"]) if season_stats.get("ops") else None,
                "era": float(season_stats["era"]) if season_stats.get("era") else None,
                "wins": season_stats.get("wins"),
                "saves": season_stats.get("saves"),
                "whip": float(season_stats["whip"]) if season_stats.get("whip") else None,
                "strikeouts_pitched": season_stats.get("strikeouts_pitched")
            }
        },
        "league_contexts": league_contexts,
        "summary": {
            "total_leagues": len(user_leagues),
            "owned_in": sum(1 for lc in league_contexts if lc["status"] == "owned"),
            "available_in": sum(1 for lc in league_contexts if lc["status"] == "available"),
            "other_team_in": sum(1 for lc in league_contexts if lc["status"] == "other_team")
        }
    }


# =================================================================
# USAGE EXAMPLES
# =================================================================

"""
EXAMPLE 1: Global Player Search (No League Context)

from core.canonical_player import CanonicalPlayerQueries, PlayerDataFormatter

# Execute query
results = execute_sql(
    "postgres",  # Main DB
    CanonicalPlayerQueries.SEARCH_MLB_PLAYERS,
    {"search": "%trout%", "limit": 10}
)

# Format results
players = [
    PlayerDataFormatter.format_search_result(row)
    for row in results["records"]
]

# Returns:
[{
    "ids": {"mlb": 545361},
    "info": {
        "first_name": "Mike",
        "last_name": "Trout",
        "full_name": "Mike Trout",
        "position": "OF",
        "mlb_team": "LAA"
    },
    "stats": {
        "season": 2025,
        "batting_avg": 0.285,
        "home_runs": 35,
        ...
    }
}]


EXAMPLE 2: Player in League Context

from core.canonical_player import CanonicalPlayerQueries, PlayerDataFormatter

# Execute query
result = execute_sql(
    f"league_{league_id}",  # League DB
    CanonicalPlayerQueries.PLAYER_IN_LEAGUE_CONTEXT,
    {"mlb_player_id": 545361, "league_id": league_id}
)

# Format result
player = PlayerDataFormatter.format_league_player(
    result["records"][0],
    user_id=current_user_id,
    league_id=league_id
)

# Returns:
{
    "ids": {
        "mlb": 545361,
        "league_player": "uuid-here",
        "league": "league-uuid"
    },
    "info": {...},
    "league_context": {
        "status": "owned",
        "team": {
            "team_id": "uuid",
            "team_name": "My Team",
            "owner_name": "John Doe",
            "is_user_team": True
        },
        "roster": {
            "status": "active",
            "position": "OF"
        },
        "financial": {
            "contract_salary": 45.0,
            "contract_years": 3,
            "market_price": 50.0
        }
    },
    "stats": {
        "season": {...},
        "team_attribution": {...}
    }
}
"""
