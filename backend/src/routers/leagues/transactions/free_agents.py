"""
Dynasty Dugout - Free Agents Module - FIXED ARCHITECTURE
Separates queries: postgres (mlb_players) + leagues (stats/ownership)
All free agent related endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from core.auth_utils import get_current_user
from core.database import execute_sql
from core.season_utils import CURRENT_SEASON
from .helpers import get_value_from_field
import logging
import traceback
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_free_agents(
    league_id: str,
    position: Optional[str] = Query(None, description="Filter by position"),
    search: Optional[str] = Query(None, description="Search by player name"),
    limit: int = Query(100, description="Number of results to return"),
    offset: int = Query(0, description="Number of results to skip"),
    show_all: bool = Query(False, description="Show ALL players (owned + free agents)"),
    current_user: dict = Depends(get_current_user)
):
    """
    FIXED: Get free agents with separated database queries
    Step 1: Get basic player info from postgres.mlb_players
    Step 2: Get league data from leagues database  
    Step 3: Combine results
    """
    try:
        logger.info(f"Starting {'all-players' if show_all else 'free-agents'} for league {league_id}")
        current_season = CURRENT_SEASON

        # STEP 1: Get basic player info from POSTGRES database
        conditions = []
        player_params = {'limit': limit, 'offset': offset}
        
        # Position filter
        if position:
            if position.lower() == 'hitters':
                conditions.append("position IN ('C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'LF', 'CF', 'RF', 'UT')")
            elif position.lower() == 'pitchers':
                conditions.append("position IN ('P', 'SP', 'RP', 'CL')")
            else:
                conditions.append("position = :position")
                player_params['position'] = position
        
        # Search filter
        if search:
            conditions.append("(LOWER(first_name) LIKE LOWER(:search) OR LOWER(last_name) LIKE LOWER(:search) OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE LOWER(:search))")
            player_params['search'] = f"%{search}%"

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        # Query basic player info from postgres
        players_query = f"""
            SELECT 
                player_id,
                first_name,
                last_name,
                position,
                mlb_team,
                jersey_number
            FROM mlb_players 
            WHERE {where_clause}
            ORDER BY last_name, first_name
            LIMIT :limit OFFSET :offset
        """
        
        logger.info(f"Querying basic player info from postgres with params: {player_params}")
        players_result = execute_sql(players_query, parameters=player_params, database_name="postgres")
        
        if not players_result or not players_result.get("records"):
            return {
                "success": True,
                "players": [],
                "total_count": 0,
                "limit": limit,
                "offset": offset,
                "has_more": False,
                "season": current_season,
                "show_all": show_all
            }

        # Extract player IDs
        player_ids = []
        basic_players = {}
        
        for record in players_result["records"]:
            player_id = get_value_from_field(record[0], 'long')
            if player_id:
                player_ids.append(player_id)
                basic_players[player_id] = {
                    "mlb_player_id": player_id,
                    "first_name": get_value_from_field(record[1], 'string'),
                    "last_name": get_value_from_field(record[2], 'string'),
                    "position": get_value_from_field(record[3], 'string'),
                    "mlb_team": get_value_from_field(record[4], 'string') or 'FA',
                    "jersey_number": get_value_from_field(record[5], 'string')
                }

        if not player_ids:
            return {
                "success": True,
                "players": [],
                "total_count": 0,
                "limit": limit,
                "offset": offset,
                "has_more": False,
                "season": current_season,
                "show_all": show_all
            }

        # STEP 2: Get league-specific data from LEAGUES database
        # Build player IDs list for IN clause
        player_ids_str = ','.join(map(str, player_ids))
        
        # FIXED: Only select columns that exist in leagues database
        league_query = f"""
            SELECT 
                lp.mlb_player_id,
                lp.league_player_id,
                COALESCE(lp.salary, 1.0) as salary,
                COALESCE(lp.contract_years, 1) as contract_years,
                COALESCE(lp.availability_status, 'free_agent') as availability_status,
                lp.team_id,
                t.team_name,
                -- Season stats (only columns that exist)
                COALESCE(pss.games_played, 0) as games_played,
                COALESCE(pss.at_bats, 0) as at_bats,
                COALESCE(pss.hits, 0) as hits,
                COALESCE(pss.runs, 0) as runs,
                COALESCE(pss.doubles, 0) as doubles,
                COALESCE(pss.triples, 0) as triples,
                COALESCE(pss.home_runs, 0) as home_runs,
                COALESCE(pss.rbi, 0) as rbi,
                COALESCE(pss.stolen_bases, 0) as stolen_bases,
                COALESCE(pss.caught_stealing, 0) as caught_stealing,
                COALESCE(pss.walks, 0) as walks,
                COALESCE(pss.strikeouts, 0) as strikeouts,
                COALESCE(pss.batting_avg, 0.0) as batting_avg,
                COALESCE(pss.obp, 0.0) as obp,
                COALESCE(pss.slg, 0.0) as slg,
                COALESCE(pss.ops, 0.0) as ops,
                -- Pitcher stats (only columns that exist)
                COALESCE(pss.games_started, 0) as games_started,
                COALESCE(pss.wins, 0) as wins,
                COALESCE(pss.losses, 0) as losses,
                COALESCE(pss.saves, 0) as saves,
                COALESCE(pss.blown_saves, 0) as blown_saves,
                COALESCE(pss.holds, 0) as holds,
                COALESCE(pss.quality_starts, 0) as quality_starts,
                COALESCE(pss.innings_pitched, 0.0) as innings_pitched,
                COALESCE(pss.hits_allowed, 0) as hits_allowed,
                COALESCE(pss.earned_runs, 0) as earned_runs,
                COALESCE(pss.home_runs_allowed, 0) as home_runs_allowed,
                COALESCE(pss.walks_allowed, 0) as walks_allowed,
                COALESCE(pss.strikeouts_pitched, 0) as strikeouts_pitched,
                COALESCE(pss.era, 0.0) as era,
                COALESCE(pss.whip, 0.0) as whip,
                -- Pricing
                COALESCE(pp.price, 1.0) as price
            FROM (
                SELECT UNNEST(ARRAY[{player_ids_str}]) as player_id
            ) player_list
            LEFT JOIN league_players lp ON player_list.player_id = lp.mlb_player_id 
                AND lp.league_id = :league_id::uuid
            LEFT JOIN league_teams t ON lp.team_id = t.team_id 
                AND t.league_id = :league_id::uuid
            LEFT JOIN player_season_stats pss ON player_list.player_id = pss.player_id 
                AND pss.league_id = :league_id::uuid 
                AND pss.season = :current_season
            LEFT JOIN player_prices pp ON player_list.player_id = pp.player_id 
                AND pp.league_id = :league_id::uuid
        """
        
        league_params = {
            'league_id': league_id,
            'current_season': current_season
        }
        
        logger.info(f"Querying league data from leagues database")
        league_result = execute_sql(league_query, parameters=league_params, database_name="leagues")
        
        # STEP 3: Combine results - FIXED field indices
        league_data = {}
        if league_result and league_result.get("records"):
            for record in league_result["records"]:
                player_id = get_value_from_field(record[0], 'long')
                if player_id:
                    league_data[player_id] = {
                        "league_player_id": get_value_from_field(record[1], 'string'),
                        "salary": get_value_from_field(record[2], 'decimal') or 1.0,
                        "contract_years": get_value_from_field(record[3], 'long') or 1,
                        "availability_status": get_value_from_field(record[4], 'string') or 'free_agent',
                        "team_id": get_value_from_field(record[5], 'string'),
                        "team_name": get_value_from_field(record[6], 'string'),
                        # Stats - adjusted indices
                        "games_played": get_value_from_field(record[7], 'long'),
                        "at_bats": get_value_from_field(record[8], 'long'),
                        "hits": get_value_from_field(record[9], 'long'),
                        "runs": get_value_from_field(record[10], 'long'),
                        "doubles": get_value_from_field(record[11], 'long'),
                        "triples": get_value_from_field(record[12], 'long'),
                        "home_runs": get_value_from_field(record[13], 'long'),
                        "rbi": get_value_from_field(record[14], 'long'),
                        "stolen_bases": get_value_from_field(record[15], 'long'),
                        "caught_stealing": get_value_from_field(record[16], 'long'),
                        "walks": get_value_from_field(record[17], 'long'),
                        "strikeouts": get_value_from_field(record[18], 'long'),
                        "batting_avg": get_value_from_field(record[19], 'decimal'),
                        "obp": get_value_from_field(record[20], 'decimal'),
                        "slg": get_value_from_field(record[21], 'decimal'),
                        "ops": get_value_from_field(record[22], 'decimal'),
                        # Pitcher stats - adjusted indices
                        "games_started": get_value_from_field(record[23], 'long'),
                        "wins": get_value_from_field(record[24], 'long'),
                        "losses": get_value_from_field(record[25], 'long'),
                        "saves": get_value_from_field(record[26], 'long'),
                        "blown_saves": get_value_from_field(record[27], 'long'),
                        "holds": get_value_from_field(record[28], 'long'),
                        "quality_starts": get_value_from_field(record[29], 'long'),
                        "innings_pitched": get_value_from_field(record[30], 'decimal'),
                        "hits_allowed": get_value_from_field(record[31], 'long'),
                        "earned_runs": get_value_from_field(record[32], 'long'),
                        "home_runs_allowed": get_value_from_field(record[33], 'long'),
                        "walks_allowed": get_value_from_field(record[34], 'long'),
                        "strikeouts_pitched": get_value_from_field(record[35], 'long'),
                        "era": get_value_from_field(record[36], 'decimal'),
                        "whip": get_value_from_field(record[37], 'decimal'),
                        "price": get_value_from_field(record[38], 'decimal') or 1.0
                    }

        # STEP 4: Filter based on ownership and build final result
        final_players = []
        players_to_insert = []
        
        for player_id, basic_info in basic_players.items():
            league_info = league_data.get(player_id, {})
            
            # Apply ownership filter
            if not show_all:
                availability_status = league_info.get('availability_status', 'free_agent')
                team_id = league_info.get('team_id')
                
                # Skip owned players (unless free agent)
                if team_id and availability_status != 'free_agent':
                    continue
            
            # Generate league_player_id if needed
            league_player_id = league_info.get('league_player_id')
            if not league_player_id:
                league_player_id = str(uuid.uuid4())
                players_to_insert.append({
                    'league_player_id': league_player_id,
                    'league_id': league_id,
                    'mlb_player_id': player_id
                })
            
            # Combine basic + league info - set missing fields to 0 defaults
            combined_player = {
                **basic_info,
                "league_player_id": league_player_id,
                "salary": league_info.get('salary', 1.0),
                "contract_years": league_info.get('contract_years', 1),
                "availability_status": league_info.get('availability_status', 'free_agent'),
                "team_id": league_info.get('team_id'),
                "team_name": league_info.get('team_name'),
                "price": league_info.get('price', 1.0),
                # Stats with defaults
                "games_played": league_info.get('games_played', 0),
                "at_bats": league_info.get('at_bats', 0),
                "hits": league_info.get('hits', 0),
                "runs": league_info.get('runs', 0),
                "doubles": league_info.get('doubles', 0),
                "triples": league_info.get('triples', 0),
                "home_runs": league_info.get('home_runs', 0),
                "rbi": league_info.get('rbi', 0),
                "stolen_bases": league_info.get('stolen_bases', 0),
                "caught_stealing": league_info.get('caught_stealing', 0),
                "walks": league_info.get('walks', 0),
                "strikeouts": league_info.get('strikeouts', 0),
                # Missing fields set to 0 defaults
                "hit_by_pitch": 0,
                "sacrifice_hits": 0, 
                "sacrifice_flies": 0,
                "batting_avg": league_info.get('batting_avg', 0.0),
                "avg": league_info.get('batting_avg', 0.0),  # Alias
                "obp": league_info.get('obp', 0.0),
                "slg": league_info.get('slg', 0.0),
                "ops": league_info.get('ops', 0.0),
                # Pitcher stats
                "games_started": league_info.get('games_started', 0),
                # Missing fields set to 0 defaults
                "complete_games": 0,
                "shutouts": 0,
                "wins": league_info.get('wins', 0),
                "losses": league_info.get('losses', 0),
                "saves": league_info.get('saves', 0),
                "blown_saves": league_info.get('blown_saves', 0),
                "holds": league_info.get('holds', 0),
                "quality_starts": league_info.get('quality_starts', 0),
                "innings_pitched": league_info.get('innings_pitched', 0.0),
                "hits_allowed": league_info.get('hits_allowed', 0),
                # Missing fields set to 0 defaults
                "runs_allowed": 0,
                "earned_runs": league_info.get('earned_runs', 0),
                "home_runs_allowed": league_info.get('home_runs_allowed', 0),
                "walks_allowed": league_info.get('walks_allowed', 0),
                "strikeouts_pitched": league_info.get('strikeouts_pitched', 0),
                # Missing fields set to 0 defaults
                "hit_batters": 0,
                "wild_pitches": 0,
                "balks": 0,
                "era": league_info.get('era', 0.0),
                "whip": league_info.get('whip', 0.0)
            }
            
            final_players.append(combined_player)

        # STEP 5: Insert new players to league if needed
        if players_to_insert:
            logger.info(f"Adding {len(players_to_insert)} new players to league")
            for player_to_insert in players_to_insert:
                try:
                    add_query = """
                        INSERT INTO league_players (
                            league_player_id, league_id, mlb_player_id, availability_status, 
                            salary, contract_years, created_at
                        ) VALUES (
                            :league_player_id::uuid, :league_id::uuid, :mlb_player_id, 'free_agent', 
                            1.0, 1, NOW()
                        )
                        ON CONFLICT (league_id, mlb_player_id) DO NOTHING
                    """
                    execute_sql(add_query, parameters=player_to_insert, database_name='leagues')
                except Exception as e:
                    logger.warning(f"Could not add player to league: {e}")

        # STEP 6: Get total count (simplified for now)
        count_params = {k: v for k, v in player_params.items() if k not in ['limit', 'offset']}
        count_query = f"""
            SELECT COUNT(*) 
            FROM mlb_players 
            WHERE {where_clause}
        """
        
        count_result = execute_sql(count_query, parameters=count_params, database_name="postgres")
        total_count = 0
        if count_result and count_result.get("records"):
            total_count = get_value_from_field(count_result["records"][0][0], 'long')

        logger.info(f"Returning {len(final_players)} players with total count {total_count}")

        return {
            "success": True,
            "players": final_players,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(final_players) < total_count,
            "season": current_season,
            "show_all": show_all,
            "data_source": "separated_queries"
        }
        
    except Exception as e:
        logger.error(f"Error in get_free_agents: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error getting {'all players' if show_all else 'free agents'}: {str(e)}")


@router.get("-enhanced")
async def get_free_agents_with_rolling(
    league_id: str,
    position: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(1000),
    offset: int = Query(0),
    show_all: bool = Query(False, description="Show ALL players (owned + free agents)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Enhanced free agents with rolling stats - separated database queries
    """
    try:
        logger.info(f"Getting enhanced {'all players' if show_all else 'free agents'} for league {league_id}")
        
        # Get basic results first
        basic_result = await get_free_agents(
            league_id=league_id,
            position=position,
            search=search,
            limit=limit,
            offset=offset,
            show_all=show_all,
            current_user=current_user
        )
        
        if not basic_result["players"]:
            basic_result["enhanced"] = True
            basic_result["display_rows"] = ["Season Stats", "Last 14 Days"]
            return basic_result

        # Get player IDs from basic result
        player_ids = [p["mlb_player_id"] for p in basic_result["players"]]
        player_ids_str = ','.join(map(str, player_ids))
        
        # Query rolling stats from leagues database
        rolling_query = f"""
            SELECT 
                prs.player_id,
                COALESCE(prs.games_played, 0) as l14_games_played,
                COALESCE(prs.at_bats, 0) as l14_at_bats,
                COALESCE(prs.hits, 0) as l14_hits,
                COALESCE(prs.home_runs, 0) as l14_home_runs,
                COALESCE(prs.rbi, 0) as l14_rbi,
                COALESCE(prs.runs, 0) as l14_runs,
                COALESCE(prs.stolen_bases, 0) as l14_stolen_bases,
                COALESCE(prs.batting_avg, 0.0) as l14_batting_avg,
                COALESCE(prs.obp, 0.0) as l14_obp,
                COALESCE(prs.slg, 0.0) as l14_slg,
                COALESCE(prs.ops, 0.0) as l14_ops,
                COALESCE(prs.era, 0.0) as l14_era,
                COALESCE(prs.wins, 0) as l14_wins,
                COALESCE(prs.saves, 0) as l14_saves,
                COALESCE(prs.innings_pitched, 0.0) as l14_innings_pitched,
                COALESCE(prs.whip, 0.0) as l14_whip,
                COALESCE(prs.strikeouts_pitched, 0) as l14_strikeouts_pitched
            FROM player_rolling_stats prs
            WHERE prs.player_id IN ({player_ids_str})
                AND prs.league_id = :league_id::uuid
                AND prs.period = 'last_14_days'
                AND prs.as_of_date = (
                    SELECT MAX(as_of_date) 
                    FROM player_rolling_stats 
                    WHERE league_id = :league_id::uuid 
                    AND period = 'last_14_days'
                )
        """
        
        rolling_params = {'league_id': league_id}
        rolling_result = execute_sql(rolling_query, parameters=rolling_params, database_name="leagues")
        
        # Build rolling stats lookup
        rolling_data = {}
        if rolling_result and rolling_result.get("records"):
            for record in rolling_result["records"]:
                player_id = get_value_from_field(record[0], 'long')
                if player_id:
                    rolling_data[player_id] = {
                        'games_played': get_value_from_field(record[1], 'long'),
                        'at_bats': get_value_from_field(record[2], 'long'),
                        'hits': get_value_from_field(record[3], 'long'),
                        'home_runs': get_value_from_field(record[4], 'long'),
                        'rbi': get_value_from_field(record[5], 'long'),
                        'runs': get_value_from_field(record[6], 'long'),
                        'stolen_bases': get_value_from_field(record[7], 'long'),
                        'avg': get_value_from_field(record[8], 'decimal'),
                        'batting_avg': get_value_from_field(record[8], 'decimal'),
                        'obp': get_value_from_field(record[9], 'decimal'),
                        'slg': get_value_from_field(record[10], 'decimal'),
                        'ops': get_value_from_field(record[11], 'decimal'),
                        'era': get_value_from_field(record[12], 'decimal'),
                        'wins': get_value_from_field(record[13], 'long'),
                        'saves': get_value_from_field(record[14], 'long'),
                        'innings_pitched': get_value_from_field(record[15], 'decimal'),
                        'whip': get_value_from_field(record[16], 'decimal'),
                        'strikeouts_pitched': get_value_from_field(record[17], 'long'),
                        'strikeouts': get_value_from_field(record[17], 'long')  # Alias
                    }

        # Add rolling stats to each player
        for player in basic_result["players"]:
            player_id = player["mlb_player_id"]
            rolling_stats = rolling_data.get(player_id)
            
            # Only add rolling stats if player has recent activity
            if rolling_stats and (rolling_stats['games_played'] > 0 or rolling_stats['at_bats'] > 0):
                player["last_14_days"] = rolling_stats
            else:
                player["last_14_days"] = None

        # Update response metadata
        basic_result["enhanced"] = True
        basic_result["display_rows"] = ["Season Stats", "Last 14 Days"]
        basic_result["data_source"] = "separated_queries_enhanced"
        
        logger.info(f"Successfully enhanced {len(basic_result['players'])} players with rolling stats")
        return basic_result
        
    except Exception as e:
        logger.error(f"Error in enhanced endpoint: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        # Fallback to basic endpoint
        try:
            logger.info("Falling back to basic endpoint")
            fallback_result = await get_free_agents(
                league_id=league_id,
                position=position,
                search=search,
                limit=limit,
                offset=offset,
                show_all=show_all,
                current_user=current_user
            )
            fallback_result["enhanced"] = False
            fallback_result["display_rows"] = ["Season Stats"]
            return fallback_result
        except Exception as fallback_error:
            logger.error(f"Even fallback failed: {fallback_error}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to get {'all players' if show_all else 'free agents'}: {str(e)}"
            )