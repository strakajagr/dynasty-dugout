"""
Dynasty Dugout - Team Roster Management
PURPOSE: Team roster endpoints with 3-line stats display for team pages
CRITICAL: Shows Season/Accrued/14-day stats for team dashboard
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
# TEAM ROSTER WITH 3-LINE STATS - CRITICAL FOR TEAM PAGE
# =============================================================================

@router.get("/teams/{team_id}/roster-three-line")
async def get_team_roster_three_line_stats(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
) -> List[ThreeLinePlayerStats]:
    """
    Get team roster with THREE lines of stats:
    1. Season stats (from CACHED data in leagues DB)
    2. Accrued stats (only while in active lineup - from leagues DB)
    3. 14-day rolling stats (recent performance - from leagues DB)
    
    THIS IS THE CRITICAL ENDPOINT FOR TEAM PAGES
    """
    try:
        # Query combines data all from LEAGUES database:
        # - league_players (roster info)
        # - player_season_stats (CACHED current season stats)
        # - player_active_accrued_stats (accrued while active)
        # - player_rolling_stats (14-day rolling)
        
        roster_query = f"""
        SELECT 
            lp.mlb_player_id,
            COALESCE(mp.first_name || ' ' || mp.last_name, lp.player_name) as player_name,
            COALESCE(mp.position, lp.position) as position,
            COALESCE(mp.mlb_team, lp.mlb_team) as mlb_team,
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
        LEFT JOIN postgres.mlb_players mp ON lp.mlb_player_id = mp.player_id
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
            player_name
        """
        
        # Execute query - ALL DATA FROM LEAGUES DB
        result = execute_sql(
            roster_query,
            parameters={'team_id': team_id, 'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE with CACHED stats
        )
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Parse season stats (indices 9-37) - ENHANCED WITH SAFE PARSING
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
                    
                    # Parse accrued stats (indices 38-58) - ENHANCED
                    accrued_stats = AccruedStats(
                        first_active_date=get_string_value(record[38]),
                        last_active_date=get_string_value(record[39]),
                        total_active_days=get_long_value(record[40]),
                        active_games_played=get_long_value(record[41]),
                        active_at_bats=get_long_value(record[42]),
                        active_hits=get_long_value(record[43]),
                        active_home_runs=get_long_value(record[44]),
                        active_rbi=get_long_value(record[45]),
                        active_runs=get_long_value(record[46]),
                        active_stolen_bases=get_long_value(record[47]),
                        active_walks=get_long_value(record[48]),
                        active_strikeouts=get_long_value(record[49]),
                        active_batting_avg=get_decimal_value(record[50]),
                        active_innings_pitched=get_decimal_value(record[51]),
                        active_wins=get_long_value(record[52]),
                        active_losses=get_long_value(record[53]),
                        active_saves=get_long_value(record[54]),
                        active_earned_runs=get_long_value(record[55]),
                        active_quality_starts=get_long_value(record[56]),
                        active_era=get_decimal_value(record[57]),
                        active_whip=get_decimal_value(record[58])
                    )
                    
                    # Parse 14-day rolling stats (indices 59-76) - ENHANCED
                    rolling_stats = RollingStats(
                        games_played=get_long_value(record[59]),
                        at_bats=get_long_value(record[60]),
                        hits=get_long_value(record[61]),
                        home_runs=get_long_value(record[62]),
                        rbi=get_long_value(record[63]),
                        runs=get_long_value(record[64]),
                        stolen_bases=get_long_value(record[65]),
                        batting_avg=get_decimal_value(record[66]),
                        obp=get_decimal_value(record[67]),
                        slg=get_decimal_value(record[68]),
                        ops=get_decimal_value(record[69]),
                        innings_pitched=get_decimal_value(record[70]),
                        wins=get_long_value(record[71]),
                        losses=get_long_value(record[72]),
                        saves=get_long_value(record[73]),
                        quality_starts=get_long_value(record[74]),
                        era=get_decimal_value(record[75]),
                        whip=get_decimal_value(record[76]),
                        trend=calculate_trend(get_decimal_value(record[66]))
                    )
                    
                    player = ThreeLinePlayerStats(
                        mlb_player_id=get_long_value(record[0]),
                        player_name=get_string_value(record[1]) or "Unknown",
                        position=get_string_value(record[2]),
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
            logger.error(f"Error getting three-line stats: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to get roster stats: {str(e)}")

# =============================================================================
# TEAM DASHBOARD ENDPOINT
# =============================================================================

@router.get("/team-dashboard/{team_id}")
async def get_team_dashboard_data(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete team dashboard data including:
    - Three-line roster stats
    - Team totals (active players only)
    - Recent transactions
    """
    try:
        # Get three-line roster
        roster = await get_team_roster_three_line_stats(league_id, team_id, current_user)
        
        # Calculate team totals from ACTIVE players only
        team_totals = calculate_team_totals(roster)
        
        # Get recent transactions
        transactions_query = """
        SELECT 
            transaction_type,
            player_name,
            transaction_date,
            details
        FROM league_transactions
        WHERE league_id = :league_id::uuid 
            AND team_id = :team_id::uuid
        ORDER BY transaction_date DESC
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
                    'player': get_string_value(record[1]),
                    'date': get_string_value(record[2]),
                    'details': get_string_value(record[3])
                })
        
        return {
            "success": True,
            "roster": roster,
            "team_totals": team_totals,
            "active_count": len([p for p in roster if p.roster_status == 'active']),
            "bench_count": len([p for p in roster if p.roster_status == 'bench']),
            "injured_count": len([p for p in roster if p.roster_status == 'injured']),
            "recent_transactions": recent_transactions
        }
        
    except Exception as e:
        logger.error(f"Error getting team dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# MY ROSTER ENDPOINT
# =============================================================================

@router.get("/my-roster")
async def get_my_roster(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's roster with 3-line stats"""
    try:
        # Get user's team ID
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
            
        team_query = execute_sql(
            """SELECT team_id FROM league_teams 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'
        )
        
        if not team_query or not team_query.get("records"):
            raise HTTPException(status_code=404, detail="Team not found")
        
        team_id = get_string_value(team_query["records"][0][0])
        
        # Get roster
        return await get_team_roster_three_line_stats(league_id, team_id, current_user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting my roster: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))