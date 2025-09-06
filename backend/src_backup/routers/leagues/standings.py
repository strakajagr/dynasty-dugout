# src/routers/leagues/standings.py (Corrected properly, no code removed)

"""
Dynasty Dugout - Competitive Standings Module
EXTRACTED FROM: The massive leagues.py file (standings functionality)
PURPOSE: Competitive rankings, points, wins/losses - NOT owner management
DISTINCTION: This is for the "Standings" page, owners.py is for "Owner Management" page
"""

import logging
from fastapi import APIRouter, HTTPException, Depends

from ...core.auth_utils import get_current_user
from ...core.database import execute_sql

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# COMPETITIVE STANDINGS ENDPOINTS
# =============================================================================

@router.get("/standings")
async def get_league_standings(league_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get current league standings showing competitive rankings
    PURPOSE: This is for the Standings PAGE - shows wins/losses/points
    NOT FOR: Owner management (use /owners endpoint for that)
    """
    try:
        user_id = current_user.get('sub')
        logger.info(f"🏆 Getting competitive standings for league: {league_id}")
        
        # [FIXED] Restructured the SQL query to resolve a database execution error.
        # This version joins from memberships to leagues, which can be more stable.
        league_sql = """
            SELECT ul.database_name, lm.role 
            FROM league_memberships lm
            JOIN user_leagues ul ON lm.league_id = ul.league_id
            WHERE lm.league_id = :league_id::uuid 
            AND lm.user_id = :user_id::uuid 
            AND lm.is_active = true
        """
        
        league_result = execute_sql(league_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not league_result.get('records'):
            raise HTTPException(status_code=404, detail="League not found or access denied")
        
        database_name = league_result['records'][0][0].get('stringValue')
        user_role = league_result['records'][0][1].get('stringValue')
        
        if not database_name:
            raise HTTPException(status_code=500, detail="League database not found")
        
        logger.info(f"📊 Fetching teams from database for competitive standings: {database_name}")
        
        # Get all teams from league database
        teams_result = execute_sql(
            """
            SELECT 
                team_id,
                team_name,
                manager_name,
                team_colors,
                user_id,
                created_at
            FROM league_teams 
            ORDER BY created_at ASC
            """,
            database_name=database_name
        )
        
        logger.info(f"🔍 Found {len(teams_result.get('records', []))} teams for competitive standings")
        
        # Get commissioner user ID for comparison
        commissioner_sql = "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid"
        commissioner_result = execute_sql(commissioner_sql, {'league_id': league_id})
        commissioner_user_id = None
        if commissioner_result.get('records') and commissioner_result['records'][0]:
            commissioner_user_id = commissioner_result['records'][0][0].get('stringValue')
        
        # Format teams for competitive standings display
        teams = []
        if teams_result.get('records'):
            for i, team_record in enumerate(teams_result['records'], 1):
                team_user_id = team_record[4].get('stringValue') if team_record[4] and not team_record[4].get('isNull') else None
                is_commissioner = team_user_id == commissioner_user_id
                
                team = {
                    "position": i,
                    "team_id": team_record[0].get('stringValue') if team_record[0] and not team_record[0].get('isNull') else None,
                    "team_name": team_record[1].get('stringValue') if team_record[1] and not team_record[1].get('isNull') else "Unnamed Team",
                    "manager_name": team_record[2].get('stringValue') if team_record[2] and not team_record[2].get('isNull') else "Manager",
                    "colors": team_record[3].get('stringValue') if team_record[3] and not team_record[3].get('isNull') else None,
                    "is_commissioner": is_commissioner,
                    "points": 0,  # TODO: Calculate actual points from league_standings table
                    "wins": 0,    # TODO: Calculate from matchups/transactions
                    "losses": 0,  # TODO: Calculate from matchups/transactions
                    "ties": 0,    # TODO: Calculate from matchups
                    "status": "active"
                }
                teams.append(team)
        
        # Get max teams from league settings
        max_teams = 12
        try:
            settings_sql = "SELECT setting_value FROM league_settings WHERE league_id = :league_id::uuid AND setting_name = 'max_teams'"
            settings_result = execute_sql(settings_sql, {'league_id': league_id}, database_name=database_name)
            if settings_result.get('records') and settings_result['records'][0]:
                max_teams = int(settings_result['records'][0][0].get('stringValue', 12))
        except Exception as settings_error:
            logger.warning(f"Could not get max_teams setting: {settings_error}")
        
        # Fill remaining slots with "Awaiting New Owner" for display purposes
        for i in range(len(teams) + 1, max_teams + 1):
            teams.append({
                "position": i,
                "team_id": None,
                "team_name": "Awaiting New Owner",
                "manager_name": None,
                "colors": None,
                "is_commissioner": False,
                "points": 0,
                "wins": 0,
                "losses": 0,
                "ties": 0,
                "status": "awaiting"
            })
        
        logger.info(f"✅ Returning {len(teams)} competitive standings entries ({len(teams_result.get('records', []))} active teams)")
        
        return {
            "success": True,
            "teams": teams,
            "total_teams": len(teams_result.get('records', [])),
            "max_teams": max_teams,
            "user_role": user_role,
            "standings_type": "competitive",
            "note": "This is competitive standings data - for owner management use /owners endpoint"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting competitive standings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get competitive standings: {str(e)}")

@router.get("/scores")
async def get_latest_scores(league_id: str, current_user: dict = Depends(get_current_user)):
    """Get latest scoring updates for teams (TO BE IMPLEMENTED)"""
    return {
        "success": False,
        "message": "Latest scores endpoint not yet implemented",
        "todo": "Implement scoring calculations from league_standings table"
    }

@router.get("/categories")
async def get_scoring_categories(league_id: str, current_user: dict = Depends(get_current_user)):
    """Get scoring category breakdown for all teams (TO BE IMPLEMENTED)"""
    return {
        "success": False,
        "message": "Scoring categories endpoint not yet implemented",
        "todo": "Implement category-by-category standings display"
    }
