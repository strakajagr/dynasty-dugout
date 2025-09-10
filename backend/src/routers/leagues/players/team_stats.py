"""
Dynasty Dugout - Team Statistics Display FIXED
PURPOSE: Three-line stats display for team pages (Season/Accrued/14-day)
FIXED: Rolling stats query from correct database (postgres)
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
import logging

from core.database import execute_sql
from core.auth_utils import get_current_user
from core.season_utils import CURRENT_SEASON
from .models import ThreeLinePlayerStats, SeasonStats, AccruedStats, RollingStats
from .utils import (
    get_decimal_value, get_long_value, get_string_value,
    calculate_trend, calculate_team_totals
)

logger = logging.getLogger(__name__)

router = APIRouter()

# =============================================================================
# TEAM STATS WITH 3-LINE DISPLAY - FIXED DATABASE ISSUE
# =============================================================================

@router.get("/teams/{team_id}/stats")
async def get_team_three_line_stats(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
) -> List[ThreeLinePlayerStats]:
    """
    Get team statistics with THREE lines of data per player:
    1. Season stats (from CACHED data in leagues DB)
    2. Accrued stats (only while in active lineup - from leagues DB)  
    3. 14-day rolling stats (recent performance - from POSTGRES DB)
    
    FIXED: Rolling stats now correctly query from postgres DB
    """
    try:
        # STEP 1: Get roster and season stats from LEAGUES database
        roster_query = f"""
        SELECT 
            lp.league_player_id,
            lp.mlb_player_id,
            lp.player_name,
            lp.position,
            lp.mlb_team,
            lp.roster_status,
            lp.salary,
            lp.contract_years,
            lp.acquisition_date,
            lp.acquisition_method,
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
            paas.first_active_date,
            paas.last_active_date,
            paas.total_active_days,
            paas.active_games_played,
            paas.active_at_bats,
            paas.active_hits,
            paas.active_home_runs,
            paas.active_rbi,
            paas.active_runs,
            paas.active_stolen_bases,
            paas.active_walks,
            paas.active_strikeouts,
            paas.active_batting_avg,
            paas.active_innings_pitched,
            paas.active_wins,
            paas.active_losses,
            paas.active_saves,
            paas.active_earned_runs,
            paas.active_quality_starts,
            paas.active_era,
            paas.active_whip
            
        FROM league_players lp
        LEFT JOIN player_season_stats pss 
            ON lp.mlb_player_id = pss.player_id 
            AND pss.season = {CURRENT_SEASON}
            AND pss.league_id = :league_id::uuid
        LEFT JOIN player_active_accrued_stats paas 
            ON lp.mlb_player_id = paas.mlb_player_id 
            AND paas.team_id = :team_id::uuid
            AND paas.league_id = :league_id::uuid
        WHERE lp.league_id = :league_id::uuid
            AND lp.team_id = :team_id::uuid 
            AND lp.availability_status = 'owned'
        ORDER BY 
            CASE lp.roster_status 
                WHEN 'active' THEN 1 
                WHEN 'bench' THEN 2 
                WHEN 'injured' THEN 3 
                ELSE 4 
            END,
            lp.position,
            lp.player_name
        """
        
        result = execute_sql(
            roster_query,
            parameters={'team_id': team_id, 'league_id': league_id},
            database_name='leagues'  # Season and accrued stats are in leagues DB
        )
        
        players = []
        player_ids = []
        
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Get MLB player ID for rolling stats query
                    mlb_player_id = get_long_value(record[1])
                    if mlb_player_id:
                        player_ids.append(mlb_player_id)
                    
                    # Parse season stats (indices 10-39)
                    season_stats = SeasonStats(
                        games_played=get_long_value(record[10]),
                        at_bats=get_long_value(record[11]),
                        runs=get_long_value(record[12]),
                        hits=get_long_value(record[13]),
                        doubles=get_long_value(record[14]),
                        triples=get_long_value(record[15]),
                        home_runs=get_long_value(record[16]),
                        rbi=get_long_value(record[17]),
                        stolen_bases=get_long_value(record[18]),
                        caught_stealing=get_long_value(record[19]),
                        walks=get_long_value(record[20]),
                        strikeouts=get_long_value(record[21]),
                        batting_avg=get_decimal_value(record[22]),
                        obp=get_decimal_value(record[23]),
                        slg=get_decimal_value(record[24]),
                        ops=get_decimal_value(record[25]),
                        games_started=get_long_value(record[26]),
                        wins=get_long_value(record[27]),
                        losses=get_long_value(record[28]),
                        saves=get_long_value(record[29]),
                        innings_pitched=get_decimal_value(record[30]),
                        hits_allowed=get_long_value(record[31]),
                        earned_runs=get_long_value(record[32]),
                        walks_allowed=get_long_value(record[33]),
                        strikeouts_pitched=get_long_value(record[34]),
                        era=get_decimal_value(record[35]),
                        whip=get_decimal_value(record[36]),
                        quality_starts=get_long_value(record[37]),
                        blown_saves=get_long_value(record[38]),
                        holds=get_long_value(record[39])
                    )
                    
                    # Parse accrued stats (indices 40-60)
                    accrued_stats = AccruedStats(
                        first_active_date=get_string_value(record[40]),
                        last_active_date=get_string_value(record[41]),
                        total_active_days=get_long_value(record[42]),
                        active_games_played=get_long_value(record[43]),
                        active_at_bats=get_long_value(record[44]),
                        active_hits=get_long_value(record[45]),
                        active_home_runs=get_long_value(record[46]),
                        active_rbi=get_long_value(record[47]),
                        active_runs=get_long_value(record[48]),
                        active_stolen_bases=get_long_value(record[49]),
                        active_walks=get_long_value(record[50]),
                        active_strikeouts=get_long_value(record[51]),
                        active_batting_avg=get_decimal_value(record[52]),
                        active_innings_pitched=get_decimal_value(record[53]),
                        active_wins=get_long_value(record[54]),
                        active_losses=get_long_value(record[55]),
                        active_saves=get_long_value(record[56]),
                        active_earned_runs=get_long_value(record[57]),
                        active_quality_starts=get_long_value(record[58]),
                        active_era=get_decimal_value(record[59]),
                        active_whip=get_decimal_value(record[60])
                    )
                    
                    # Create player object (rolling stats will be added later)
                    player = ThreeLinePlayerStats(
                        league_player_id=get_string_value(record[0]),
                        mlb_player_id=mlb_player_id,
                        player_name=get_string_value(record[2]) or "Unknown",
                        position=get_string_value(record[3]) or "UTIL",
                        mlb_team=get_string_value(record[4]) or "FA",
                        roster_status=get_string_value(record[5]),
                        salary=get_decimal_value(record[6]),
                        contract_years=get_long_value(record[7]),
                        season_stats=season_stats,
                        accrued_stats=accrued_stats,
                        rolling_14_day=RollingStats(),  # Will be populated from separate query
                        acquisition_date=get_string_value(record[8]),
                        acquisition_method=get_string_value(record[9])
                    )
                    
                    players.append(player)
                    
                except Exception as e:
                    logger.error(f"Error parsing player record: {e}")
                    continue
        
        # STEP 2: Get rolling stats from POSTGRES database
        if player_ids:
            placeholders = ','.join([f':id_{i}' for i in range(len(player_ids))])
            parameters = {f'id_{i}': pid for i, pid in enumerate(player_ids)}
            
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
                obp,
                slg,
                ops,
                innings_pitched,
                wins,
                losses,
                saves,
                quality_starts,
                era,
                whip
            FROM player_rolling_stats
            WHERE player_id IN ({placeholders})
              AND period = 'last_14_days'
              AND as_of_date = (SELECT MAX(as_of_date) FROM player_rolling_stats WHERE period = 'last_14_days')
            """
            
            rolling_result = execute_sql(
                rolling_query,
                parameters=parameters,
                database_name='postgres'  # FIXED: Rolling stats are in postgres DB!
            )
            
            # Create lookup dictionary for rolling stats
            rolling_lookup = {}
            if rolling_result and rolling_result.get("records"):
                for record in rolling_result["records"]:
                    player_id = get_long_value(record[0])
                    rolling_lookup[player_id] = RollingStats(
                        games_played=get_long_value(record[1]),
                        at_bats=get_long_value(record[2]),
                        hits=get_long_value(record[3]),
                        home_runs=get_long_value(record[4]),
                        rbi=get_long_value(record[5]),
                        runs=get_long_value(record[6]),
                        stolen_bases=get_long_value(record[7]),
                        batting_avg=get_decimal_value(record[8]),
                        obp=get_decimal_value(record[9]),
                        slg=get_decimal_value(record[10]),
                        ops=get_decimal_value(record[11]),
                        innings_pitched=get_decimal_value(record[12]),
                        wins=get_long_value(record[13]),
                        losses=get_long_value(record[14]),
                        saves=get_long_value(record[15]),
                        quality_starts=get_long_value(record[16]),
                        era=get_decimal_value(record[17]),
                        whip=get_decimal_value(record[18]),
                        trend=calculate_trend(get_decimal_value(record[8]))
                    )
            
            # Merge rolling stats into players
            for player in players:
                if player.mlb_player_id in rolling_lookup:
                    player.rolling_14_day = rolling_lookup[player.mlb_player_id]
        
        return players
        
    except Exception as e:
            logger.error(f"Error getting team stats: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to get team stats: {str(e)}")

# =============================================================================
# MY TEAM STATS ENDPOINT
# =============================================================================

@router.get("/my-team-stats")
async def get_my_team_stats(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's team statistics with 3-line display"""
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
            
        team_query = execute_sql(
            """SELECT team_id FROM teams 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'
        )
        
        if not team_query or not team_query.get("records"):
            raise HTTPException(status_code=404, detail="Team not found")
        
        team_id = get_string_value(team_query["records"][0][0])
        
        # Get stats
        return await get_team_three_line_stats(league_id, team_id, current_user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting my team stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# TEAM STATS DASHBOARD ENDPOINT - FIXED
# =============================================================================

@router.get("/team-stats-dashboard/{team_id}")
async def get_team_stats_dashboard(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete team stats dashboard including:
    - Three-line stats for all players (with fixed rolling stats)
    - Team totals (active players only)
    - Recent transactions
    """
    try:
        # Get three-line stats (now with properly sourced rolling stats)
        stats = await get_team_three_line_stats(league_id, team_id, current_user)
        
        # Calculate team totals from ACTIVE players only
        team_totals = calculate_team_totals(stats)
        
        # Get recent transactions
        transactions_query = """
        SELECT 
            lt.transaction_type,
            lp.player_name,
            lt.transaction_date,
            lt.notes
        FROM league_transactions lt
        LEFT JOIN league_players lp ON lt.league_player_id = lp.league_player_id
        WHERE lt.league_id = :league_id::uuid 
            AND (lt.from_team_id = :team_id::uuid OR lt.to_team_id = :team_id::uuid)
        ORDER BY lt.transaction_date DESC
        LIMIT 10
        """
        
        trans_result = execute_sql(
            transactions_query,
            parameters={'league_id': league_id, 'team_id': team_id},
            database_name='leagues'
        )
        
        recent_transactions = []
        if trans_result and trans_result.get("records"):
            for record in trans_result["records"]:
                recent_transactions.append({
                    'type': get_string_value(record[0]),
                    'player': get_string_value(record[1]) or 'Unknown Player',
                    'date': get_string_value(record[2]),
                    'details': get_string_value(record[3])
                })
        
        # Prepare response
        response_data = {
            "success": True,
            "team_stats": []
        }
        
        # Convert player objects to dictionaries for JSON response
        for player in stats:
            player_dict = {
                "league_player_id": player.league_player_id,
                "mlb_player_id": player.mlb_player_id,
                "player_name": player.player_name,
                "position": player.position,
                "mlb_team": player.mlb_team,
                "roster_status": player.roster_status,
                "salary": player.salary,
                "contract_years": player.contract_years,
                "acquisition_date": player.acquisition_date,
                "acquisition_method": player.acquisition_method,
                "season_stats": {
                    "games_played": player.season_stats.games_played,
                    "batting_avg": player.season_stats.batting_avg,
                    "home_runs": player.season_stats.home_runs,
                    "rbi": player.season_stats.rbi,
                    "runs": player.season_stats.runs,
                    "stolen_bases": player.season_stats.stolen_bases,
                    "era": player.season_stats.era,
                    "wins": player.season_stats.wins,
                    "saves": player.season_stats.saves,
                    "strikeouts_pitched": player.season_stats.strikeouts_pitched
                },
                "rolling_14_day": {
                    "games_played": player.rolling_14_day.games_played,
                    "batting_avg": player.rolling_14_day.batting_avg,
                    "home_runs": player.rolling_14_day.home_runs,
                    "rbi": player.rolling_14_day.rbi,
                    "runs": player.rolling_14_day.runs,
                    "stolen_bases": player.rolling_14_day.stolen_bases,
                    "era": player.rolling_14_day.era,
                    "wins": player.rolling_14_day.wins,
                    "saves": player.rolling_14_day.saves
                },
                "accrued_stats": {
                    "total_active_days": player.accrued_stats.total_active_days,
                    "active_games_played": player.accrued_stats.active_games_played,
                    "active_batting_avg": player.accrued_stats.active_batting_avg,
                    "active_home_runs": player.accrued_stats.active_home_runs,
                    "active_rbi": player.accrued_stats.active_rbi,
                    "active_runs": player.accrued_stats.active_runs,
                    "active_stolen_bases": player.accrued_stats.active_stolen_bases,
                    "active_era": player.accrued_stats.active_era,
                    "active_wins": player.accrued_stats.active_wins,
                    "active_saves": player.accrued_stats.active_saves
                }
            }
            response_data["team_stats"].append(player_dict)
        
        response_data["team_totals"] = team_totals
        response_data["active_count"] = len([p for p in stats if p.roster_status == 'active'])
        response_data["bench_count"] = len([p for p in stats if p.roster_status == 'bench'])
        response_data["injured_count"] = len([p for p in stats if p.roster_status == 'injured'])
        response_data["recent_transactions"] = recent_transactions
        response_data["data_sources"] = {
            "season_stats": "leagues_db",
            "accrued_stats": "leagues_db",
            "rolling_stats": "postgres_db"
        }
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error getting team stats dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))