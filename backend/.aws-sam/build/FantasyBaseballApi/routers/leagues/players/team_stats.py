"""
Dynasty Dugout - Team Statistics Display
PURPOSE: Three-line stats display for team pages (Season/Accrued/14-day)
FIXED: Corrected transactions query to JOIN with league_players and use proper column names
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
# TEAM STATS WITH 3-LINE DISPLAY
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
    3. 14-day rolling stats (recent performance - from leagues DB)
    
    THIS IS THE CRITICAL ENDPOINT FOR TEAM STATS PAGE
    """
    try:
        # Query combines data all from LEAGUES database (no cross-DB JOIN):
        roster_query = f"""
        SELECT 
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
            paas.active_whip,
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
        LEFT JOIN player_active_accrued_stats paas 
            ON lp.mlb_player_id = paas.mlb_player_id 
            AND paas.team_id = :team_id::uuid
            AND paas.league_id = :league_id::uuid
        LEFT JOIN player_rolling_stats prs 
            ON lp.mlb_player_id = prs.player_id 
            AND prs.period = 'last_14_days' 
            AND prs.as_of_date = CURRENT_DATE
            AND prs.league_id = :league_id::uuid
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
            database_name='leagues'
        )
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Parse season stats (indices 9-38)
                    season_stats = SeasonStats(
                        games_played=get_long_value(record[9]),
                        at_bats=get_long_value(record[10]),
                        runs=get_long_value(record[11]),
                        hits=get_long_value(record[12]),
                        doubles=get_long_value(record[13]),
                        triples=get_long_value(record[14]),
                        home_runs=get_long_value(record[15]),
                        rbi=get_long_value(record[16]),
                        stolen_bases=get_long_value(record[17]),
                        caught_stealing=get_long_value(record[18]),
                        walks=get_long_value(record[19]),
                        strikeouts=get_long_value(record[20]),
                        batting_avg=get_decimal_value(record[21]),
                        obp=get_decimal_value(record[22]),
                        slg=get_decimal_value(record[23]),
                        ops=get_decimal_value(record[24]),
                        games_started=get_long_value(record[25]),
                        wins=get_long_value(record[26]),
                        losses=get_long_value(record[27]),
                        saves=get_long_value(record[28]),
                        innings_pitched=get_decimal_value(record[29]),
                        hits_allowed=get_long_value(record[30]),
                        earned_runs=get_long_value(record[31]),
                        walks_allowed=get_long_value(record[32]),
                        strikeouts_pitched=get_long_value(record[33]),
                        era=get_decimal_value(record[34]),
                        whip=get_decimal_value(record[35]),
                        quality_starts=get_long_value(record[36]),
                        blown_saves=get_long_value(record[37]),
                        holds=get_long_value(record[38])
                    )
                    
                    # Parse accrued stats (indices 39-59)
                    accrued_stats = AccruedStats(
                        first_active_date=get_string_value(record[39]),
                        last_active_date=get_string_value(record[40]),
                        total_active_days=get_long_value(record[41]),
                        active_games_played=get_long_value(record[42]),
                        active_at_bats=get_long_value(record[43]),
                        active_hits=get_long_value(record[44]),
                        active_home_runs=get_long_value(record[45]),
                        active_rbi=get_long_value(record[46]),
                        active_runs=get_long_value(record[47]),
                        active_stolen_bases=get_long_value(record[48]),
                        active_walks=get_long_value(record[49]),
                        active_strikeouts=get_long_value(record[50]),
                        active_batting_avg=get_decimal_value(record[51]),
                        active_innings_pitched=get_decimal_value(record[52]),
                        active_wins=get_long_value(record[53]),
                        active_losses=get_long_value(record[54]),
                        active_saves=get_long_value(record[55]),
                        active_earned_runs=get_long_value(record[56]),
                        active_quality_starts=get_long_value(record[57]),
                        active_era=get_decimal_value(record[58]),
                        active_whip=get_decimal_value(record[59])
                    )
                    
                    # Parse 14-day rolling stats (indices 60-77)
                    rolling_stats = RollingStats(
                        games_played=get_long_value(record[60]),
                        at_bats=get_long_value(record[61]),
                        hits=get_long_value(record[62]),
                        home_runs=get_long_value(record[63]),
                        rbi=get_long_value(record[64]),
                        runs=get_long_value(record[65]),
                        stolen_bases=get_long_value(record[66]),
                        batting_avg=get_decimal_value(record[67]),
                        obp=get_decimal_value(record[68]),
                        slg=get_decimal_value(record[69]),
                        ops=get_decimal_value(record[70]),
                        innings_pitched=get_decimal_value(record[71]),
                        wins=get_long_value(record[72]),
                        losses=get_long_value(record[73]),
                        saves=get_long_value(record[74]),
                        quality_starts=get_long_value(record[75]),
                        era=get_decimal_value(record[76]),
                        whip=get_decimal_value(record[77]),
                        trend=calculate_trend(get_decimal_value(record[67]))
                    )
                    
                    player = ThreeLinePlayerStats(
                        mlb_player_id=get_long_value(record[0]),
                        player_name=get_string_value(record[1]) or "Unknown",
                        position=get_string_value(record[2]) or "UTIL",
                        mlb_team=get_string_value(record[3]) or "FA",
                        roster_status=get_string_value(record[4]),
                        salary=get_decimal_value(record[5]),
                        contract_years=get_long_value(record[6]),
                        season_stats=season_stats,
                        accrued_stats=accrued_stats,
                        rolling_14_day=rolling_stats,
                        acquisition_date=get_string_value(record[7]),
                        acquisition_method=get_string_value(record[8])
                    )
                    
                    players.append(player)
                    
                except Exception as e:
                    logger.error(f"Error parsing player record: {e}")
                    continue
        
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
# TEAM STATS DASHBOARD ENDPOINT - FIXED TRANSACTIONS QUERY
# =============================================================================

@router.get("/team-stats-dashboard/{team_id}")
async def get_team_stats_dashboard(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete team stats dashboard including:
    - Three-line stats for all players
    - Team totals (active players only)
    - Recent transactions
    """
    try:
        # Get three-line stats
        stats = await get_team_three_line_stats(league_id, team_id, current_user)
        
        # Calculate team totals from ACTIVE players only
        team_totals = calculate_team_totals(stats)
        
        # FIXED: Get recent transactions with proper JOIN and column names
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
                    'details': get_string_value(record[3])  # Using 'notes' from DB as 'details'
                })
        
        return {
            "success": True,
            "team_stats": stats,
            "team_totals": team_totals,
            "active_count": len([p for p in stats if p.roster_status == 'active']),
            "bench_count": len([p for p in stats if p.roster_status == 'bench']),
            "injured_count": len([p for p in stats if p.roster_status == 'injured']),
            "recent_transactions": recent_transactions
        }
        
    except Exception as e:
        logger.error(f"Error getting team stats dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))