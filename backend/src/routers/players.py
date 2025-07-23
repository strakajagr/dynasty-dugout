"""
Dynasty Dugout - Players Router
Player data, details, and basic stats endpoints
"""

import logging
import traceback
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from core.auth_utils import get_current_user
from core.database import execute_sql, format_player_data

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("")
async def get_players(
    limit: int = Query(1000, le=2000),
    offset: int = Query(0, ge=0),
    position: Optional[str] = None,
    team: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get MLB players with comprehensive filtering and position-specific data"""
    try:
        logger.info(f"Fetching players for user: {current_user.get('email')}")
        
        # Base query with all essential fields
        base_sql = """
        SELECT 
            player_id,
            mlb_id,
            first_name,
            last_name,
            position,
            mlb_team,
            jersey_number,
            birthdate,
            height_inches,
            weight_pounds,
            bats,
            throws,
            is_active,
            injury_status,
            salary
        FROM mlb_players
        WHERE 1=1
        """
        
        parameters = []
        
        # Apply filters
        if active_only:
            base_sql += " AND is_active = :active"
            parameters.append({
                'name': 'active',
                'value': {'booleanValue': True}
            })
        
        if position:
            base_sql += " AND position = :position"
            parameters.append({
                'name': 'position',
                'value': {'stringValue': position}
            })
        
        if team:
            base_sql += " AND mlb_team = :team"
            parameters.append({
                'name': 'team',
                'value': {'stringValue': team}
            })
        
        if search:
            base_sql += " AND (first_name ILIKE :search OR last_name ILIKE :search)"
            search_param = f"%{search}%"
            parameters.append({
                'name': 'search',
                'value': {'stringValue': search_param}
            })
        
        base_sql += " ORDER BY last_name, first_name LIMIT :limit OFFSET :offset"
        parameters.extend([
            {'name': 'limit', 'value': {'longValue': limit}},
            {'name': 'offset', 'value': {'longValue': offset}}
        ])
        
        # Execute query
        response = execute_sql(base_sql, parameters)
        players = format_player_data(response.get('records', []), response)

        # Get total count for pagination
        count_sql = """
        SELECT COUNT(*) as total_count 
        FROM mlb_players 
        WHERE is_active = :active
        """
        count_params = [{'name': 'active', 'value': {'booleanValue': active_only}}]
        
        if position:
            count_sql += " AND position = :position"
            count_params.append({'name': 'position', 'value': {'stringValue': position}})
        
        if team:
            count_sql += " AND mlb_team = :team"
            count_params.append({'name': 'team', 'value': {'stringValue': team}})
        
        if search:
            count_sql += " AND (first_name ILIKE :search OR last_name ILIKE :search)"
            count_params.append({'name': 'search', 'value': {'stringValue': f"%{search}%"}})
        
        count_response = execute_sql(count_sql, count_params)
        total_count = 0
        if count_response.get('records'):
            total_count = count_response['records'][0][0].get('longValue', 0)
        
        return {
            "players": players,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(players) < total_count
            },
            "filters": {
                "position": position,
                "team": team,
                "search": search,
                "active_only": active_only
            },
            "data_source": "database",
            "authenticated_user": current_user.get('email')
        }
        
    except Exception as e:
        logger.error(f"Get players error: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch players: {str(e)}")

@router.get("/{player_id}")
async def get_player_details(
    player_id: int,
    include_stats: bool = True,
    season_year: int = 2025,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information for a specific player including stats"""
    try:
        # Get player basic info
        sql = """
        SELECT 
            player_id, mlb_id, first_name, last_name, position, mlb_team,
            jersey_number, birthdate, height_inches, weight_pounds, bats, throws,
            is_active, injury_status, salary
        FROM mlb_players 
        WHERE player_id = :player_id
        """
        
        parameters = [{'name': 'player_id', 'value': {'longValue': player_id}}]
        response = execute_sql(sql, parameters)
        
        if not response.get('records'):
            raise HTTPException(status_code=404, detail="Player not found")
        
        players = format_player_data(response['records'], response)
        player = players[0] if players else None
        
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        
        result = {"player": player}
        
        # Get player stats if requested
        if include_stats:
            try:
                stats_sql = """
                SELECT 
                    week_number, season_year, games_played, at_bats, hits, runs, rbis, home_runs,
                    doubles, triples, stolen_bases, walks, strikeouts, hit_by_pitch,
                    innings_pitched, wins, losses, saves, holds, blown_saves, earned_runs,
                    hits_allowed, walks_allowed, strikeouts_pitched, era, whip,
                    avg, obp, slg, ops, fantasy_points
                FROM player_stats 
                WHERE player_id = :player_id AND season_year = :season_year
                ORDER BY week_number DESC
                LIMIT 52
                """
                
                stats_params = [
                    {'name': 'player_id', 'value': {'longValue': player_id}},
                    {'name': 'season_year', 'value': {'longValue': season_year}}
                ]
                
                stats_response = execute_sql(stats_sql, stats_params)
                stats = format_player_data(stats_response.get('records', []), stats_response)
                
                result["stats"] = stats
                result["season_year"] = season_year
                
            except Exception as stats_error:
                logger.error(f"Could not fetch stats for player {player_id}: {stats_error}")
                result["stats"] = []
                result["stats_error"] = str(stats_error)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get player details error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch player details")

@router.get("/positions")
async def get_available_positions(current_user: dict = Depends(get_current_user)):
    """Get all available player positions"""
    try:
        sql = """
        SELECT DISTINCT position, COUNT(*) as player_count
        FROM mlb_players 
        WHERE is_active = true
        GROUP BY position
        ORDER BY position
        """
        
        response = execute_sql(sql)
        positions = format_player_data(response.get('records', []), response)
        
        return {"positions": positions}
        
    except Exception as e:
        logger.error(f"Get positions error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch positions")

@router.get("/teams")
async def get_available_teams(current_user: dict = Depends(get_current_user)):
    """Get all MLB teams"""
    try:
        sql = """
        SELECT DISTINCT mlb_team, COUNT(*) as player_count
        FROM mlb_players 
        WHERE is_active = true
        GROUP BY mlb_team
        ORDER BY mlb_team
        """
        
        response = execute_sql(sql)
        teams = format_player_data(response.get('records', []), response)
        
        return {"teams": teams}
        
    except Exception as e:
        logger.error(f"Get teams error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch teams")