"""
Dynasty Dugout - Team Statistics Display FIXED
PURPOSE: Three-line stats display for team pages (Season/Accrued/14-day)
FIXED: Using dictionary access pattern instead of array indexing
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
import logging

from core.database import execute_sql
from core.auth_utils import get_current_user
from core.season_utils import CURRENT_SEASON
from .models import ThreeLinePlayerStats, SeasonStats, AccruedStats, RollingStats
from .utils import calculate_trend, calculate_team_totals, safe_int, safe_float

logger = logging.getLogger(__name__)

router = APIRouter()

# =============================================================================
# TEAM STATS WITH 3-LINE DISPLAY - USING DICTIONARY ACCESS
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
            pss.games_played as season_games,
            pss.at_bats as season_at_bats,
            pss.runs as season_runs,
            pss.hits as season_hits,
            pss.doubles as season_doubles,
            pss.triples as season_triples,
            pss.home_runs as season_hr,
            pss.rbi as season_rbi,
            pss.stolen_bases as season_sb,
            pss.caught_stealing as season_cs,
            pss.walks as season_walks,
            pss.strikeouts as season_strikeouts,
            pss.batting_avg as season_avg,
            pss.obp as season_obp,
            pss.slg as season_slg,
            pss.ops as season_ops,
            pss.games_started as season_gs,
            pss.wins as season_wins,
            pss.losses as season_losses,
            pss.saves as season_saves,
            pss.innings_pitched as season_ip,
            pss.hits_allowed as season_ha,
            pss.earned_runs as season_er,
            pss.walks_allowed as season_bb,
            pss.strikeouts_pitched as season_k,
            pss.era as season_era,
            pss.whip as season_whip,
            pss.quality_starts as season_qs,
            pss.blown_saves as season_bs,
            pss.holds as season_holds,
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
            database_name='leagues'
        )
        
        players = []
        player_ids = []
        
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Use dictionary access
                    mlb_player_id = safe_int(record.get('mlb_player_id'))
                    if mlb_player_id:
                        player_ids.append(mlb_player_id)
                    
                    # Parse season stats
                    season_stats = SeasonStats(
                        games_played=safe_int(record.get('season_games')),
                        at_bats=safe_int(record.get('season_at_bats')),
                        runs=safe_int(record.get('season_runs')),
                        hits=safe_int(record.get('season_hits')),
                        doubles=safe_int(record.get('season_doubles')),
                        triples=safe_int(record.get('season_triples')),
                        home_runs=safe_int(record.get('season_hr')),
                        rbi=safe_int(record.get('season_rbi')),
                        stolen_bases=safe_int(record.get('season_sb')),
                        caught_stealing=safe_int(record.get('season_cs')),
                        walks=safe_int(record.get('season_walks')),
                        strikeouts=safe_int(record.get('season_strikeouts')),
                        batting_avg=safe_float(record.get('season_avg')),
                        obp=safe_float(record.get('season_obp')),
                        slg=safe_float(record.get('season_slg')),
                        ops=safe_float(record.get('season_ops')),
                        games_started=safe_int(record.get('season_gs')),
                        wins=safe_int(record.get('season_wins')),
                        losses=safe_int(record.get('season_losses')),
                        saves=safe_int(record.get('season_saves')),
                        innings_pitched=safe_float(record.get('season_ip')),
                        hits_allowed=safe_int(record.get('season_ha')),
                        earned_runs=safe_int(record.get('season_er')),
                        walks_allowed=safe_int(record.get('season_bb')),
                        strikeouts_pitched=safe_int(record.get('season_k')),
                        era=safe_float(record.get('season_era')),
                        whip=safe_float(record.get('season_whip')),
                        quality_starts=safe_int(record.get('season_qs')),
                        blown_saves=safe_int(record.get('season_bs')),
                        holds=safe_int(record.get('season_holds'))
                    )
                    
                    # Parse accrued stats
                    accrued_stats = AccruedStats(
                        first_active_date=record.get('first_active_date', ''),
                        last_active_date=record.get('last_active_date', ''),
                        total_active_days=safe_int(record.get('total_active_days')),
                        active_games_played=safe_int(record.get('active_games_played')),
                        active_at_bats=safe_int(record.get('active_at_bats')),
                        active_hits=safe_int(record.get('active_hits')),
                        active_home_runs=safe_int(record.get('active_home_runs')),
                        active_rbi=safe_int(record.get('active_rbi')),
                        active_runs=safe_int(record.get('active_runs')),
                        active_stolen_bases=safe_int(record.get('active_stolen_bases')),
                        active_walks=safe_int(record.get('active_walks')),
                        active_strikeouts=safe_int(record.get('active_strikeouts')),
                        active_batting_avg=safe_float(record.get('active_batting_avg')),
                        active_innings_pitched=safe_float(record.get('active_innings_pitched')),
                        active_wins=safe_int(record.get('active_wins')),
                        active_losses=safe_int(record.get('active_losses')),
                        active_saves=safe_int(record.get('active_saves')),
                        active_earned_runs=safe_int(record.get('active_earned_runs')),
                        active_quality_starts=safe_int(record.get('active_quality_starts')),
                        active_era=safe_float(record.get('active_era')),
                        active_whip=safe_float(record.get('active_whip'))
                    )
                    
                    # Create player object
                    player = ThreeLinePlayerStats(
                        league_player_id=record.get('league_player_id', ''),
                        mlb_player_id=mlb_player_id,
                        player_name=record.get('player_name', 'Unknown'),
                        position=record.get('position', 'UTIL'),
                        mlb_team=record.get('mlb_team', 'FA'),
                        roster_status=record.get('roster_status', 'bench'),
                        salary=safe_float(record.get('salary')),
                        contract_years=safe_int(record.get('contract_years')),
                        season_stats=season_stats,
                        accrued_stats=accrued_stats,
                        rolling_14_day=RollingStats(),  # Will be populated later
                        acquisition_date=record.get('acquisition_date', ''),
                        acquisition_method=record.get('acquisition_method', '')
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
                database_name='postgres'
            )
            
            # Create lookup dictionary for rolling stats
            rolling_lookup = {}
            if rolling_result and rolling_result.get("records"):
                for record in rolling_result["records"]:
                    player_id = safe_int(record.get('player_id'))
                    batting_avg = safe_float(record.get('batting_avg'))
                    rolling_lookup[player_id] = RollingStats(
                        games_played=safe_int(record.get('games_played')),
                        at_bats=safe_int(record.get('at_bats')),
                        hits=safe_int(record.get('hits')),
                        home_runs=safe_int(record.get('home_runs')),
                        rbi=safe_int(record.get('rbi')),
                        runs=safe_int(record.get('runs')),
                        stolen_bases=safe_int(record.get('stolen_bases')),
                        batting_avg=batting_avg,
                        obp=safe_float(record.get('obp')),
                        slg=safe_float(record.get('slg')),
                        ops=safe_float(record.get('ops')),
                        innings_pitched=safe_float(record.get('innings_pitched')),
                        wins=safe_int(record.get('wins')),
                        losses=safe_int(record.get('losses')),
                        saves=safe_int(record.get('saves')),
                        quality_starts=safe_int(record.get('quality_starts')),
                        era=safe_float(record.get('era')),
                        whip=safe_float(record.get('whip')),
                        trend=calculate_trend(batting_avg)
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
        
        team_id = team_query["records"][0].get('team_id', '')
        
        # Get stats
        return await get_team_three_line_stats(league_id, team_id, current_user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting my team stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# TEAM STATS DASHBOARD ENDPOINT
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
                    'type': record.get('transaction_type', ''),
                    'player': record.get('player_name', 'Unknown Player'),
                    'date': record.get('transaction_date', ''),
                    'details': record.get('notes', '')
                })
        
        # Prepare response with CANONICAL STRUCTURE
        response_data = {
            "success": True,
            "team_stats": []
        }
        
        # Convert player objects to CANONICAL format with ALL stats
        for player in stats:
            player_dict = {
                # CANONICAL IDS
                "ids": {
                    "mlb": player.mlb_player_id,
                    "league_player": player.league_player_id
                },
                
                # CANONICAL INFO
                "info": {
                    "player_name": player.player_name,
                    "position": player.position,
                    "mlb_team": player.mlb_team
                },
                
                # CANONICAL STATS - ALL FIELDS FROM PYDANTIC MODELS (35+ stats each)
                "stats": {
                    "season": player.season_stats.dict(),
                    "rolling_14_day": player.rolling_14_day.dict(),
                    "team_attribution": player.accrued_stats.dict()
                },
                
                # CANONICAL LEAGUE CONTEXT
                "league_context": {
                    "roster_status": player.roster_status,
                    "salary": player.salary,
                    "contract_years": player.contract_years,
                    "acquisition_date": player.acquisition_date,
                    "acquisition_method": player.acquisition_method
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
