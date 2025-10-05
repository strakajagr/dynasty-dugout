"""
Dynasty Dugout - Team Salary Management Module
Handle team salary totals and salary cap tracking
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from core.auth_utils import get_current_user
from core.database import execute_sql
from core.cache import cached
from .models import TeamSalaryInfo, PlayerContract
from .settings import validate_league_membership, get_salary_settings

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# TEAM SALARY ENDPOINTS
# =============================================================================

@router.get("/{league_id}/salaries/teams")
@cached(ttl_seconds=600, key_prefix='team_salaries', key_params=['league_id'])
async def get_all_team_salaries(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get salary information for all teams in the league
    
    CACHED: 10 minute TTL
    """
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Validate membership
        if not await validate_league_membership(league_id, user_id):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # Get salary settings
        settings_result = await get_salary_settings(league_id, current_user)
        settings = settings_result['settings']
        
        # Get all teams with salary totals
        teams_query = """
            SELECT 
                lt.team_id,
                lt.team_name,
                COUNT(lp.league_player_id) as player_count,
                COALESCE(SUM(lp.salary), 0) as total_salary,
                COALESCE(SUM(CASE WHEN lp.acquisition_method = 'draft' THEN lp.salary ELSE 0 END), 0) as draft_salary,
                COALESCE(SUM(CASE WHEN lp.acquisition_method != 'draft' OR lp.acquisition_method IS NULL THEN lp.salary ELSE 0 END), 0) as season_salary
            FROM league_teams lt
            LEFT JOIN league_players lp 
                ON lt.team_id = lp.team_id 
                AND lt.league_id = lp.league_id
                AND lp.availability_status = 'owned'
            WHERE lt.league_id = :league_id::uuid
            GROUP BY lt.team_id, lt.team_name
            ORDER BY total_salary DESC
        """
        
        result = execute_sql(
            teams_query,
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        teams = []
        if result and result.get('records'):
            for record in result['records']:
                team_id = record[0].get('stringValue')
                team_name = record[1].get('stringValue')
                player_count = record[2].get('longValue', 0)
                total_salary = float(record[3].get('stringValue') or record[3].get('doubleValue', 0))
                draft_salary = float(record[4].get('stringValue') or record[4].get('doubleValue', 0))
                season_salary = float(record[5].get('stringValue') or record[5].get('doubleValue', 0))
                
                team_info = TeamSalaryInfo(
                    team_id=team_id,
                    team_name=team_name,
                    total_salary=total_salary,
                    salary_cap_used=total_salary,
                    draft_cap_used=draft_salary,
                    season_cap_used=season_salary,
                    cap_space_available=settings['salary_cap'] - total_salary,
                    player_count=player_count,
                    average_salary=total_salary / player_count if player_count > 0 else 0
                )
                
                teams.append(team_info)
        
        return {
            "success": True,
            "teams": [t.dict() for t in teams],
            "league_settings": settings
        }
        
    except Exception as e:
        logger.error(f"Error getting team salaries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{league_id}/salaries/teams/{team_id}")
async def get_team_salary_details(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed salary information for a specific team"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Validate membership
        if not await validate_league_membership(league_id, user_id):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # Get team info and contracts (using cached player data from league_players)
        contracts_query = """
            SELECT 
                lp.league_player_id,
                lp.mlb_player_id,
                lp.player_name,
                lp.position,
                lt.team_id,
                lt.team_name,
                lp.salary,
                lp.contract_years,
                lp.acquisition_method,
                lp.acquisition_date
            FROM league_players lp
            JOIN league_teams lt ON lp.team_id = lt.team_id AND lp.league_id = lt.league_id
            WHERE lp.league_id = :league_id::uuid
                AND lp.team_id = :team_id::uuid
                AND lp.availability_status = 'owned'
            ORDER BY lp.salary DESC
        """
        
        result = execute_sql(
            contracts_query,
            {'league_id': league_id, 'team_id': team_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        contracts = []
        total_salary = 0.0
        
        if result and result.get('records'):
            for record in result['records']:
                contract = PlayerContract(
                    league_player_id=record[0].get('stringValue'),
                    player_id=record[1].get('longValue'),
                    player_name=record[2].get('stringValue'),
                    position=record[3].get('stringValue'),
                    team_id=record[4].get('stringValue'),
                    team_name=record[5].get('stringValue'),
                    salary=float(record[6].get('stringValue') or record[6].get('doubleValue', 0)),
                    contract_years=record[7].get('longValue', 0),
                    acquisition_method=record[8].get('stringValue'),
                    acquisition_date=record[9].get('stringValue')
                )
                contracts.append(contract)
                total_salary += contract.salary
        
        # Get salary settings
        settings_result = await get_salary_settings(league_id, current_user)
        settings = settings_result['settings']
        
        return {
            "success": True,
            "team_id": team_id,
            "contracts": [c.dict() for c in contracts],
            "total_salary": total_salary,
            "cap_space": settings['salary_cap'] - total_salary,
            "player_count": len(contracts),
            "settings": settings
        }
        
    except Exception as e:
        logger.error(f"Error getting team salary details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))