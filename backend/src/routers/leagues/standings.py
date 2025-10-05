# src/routers/leagues/standings.py - WITH REAL ROTISSERIE CALCULATIONS

"""
Dynasty Dugout - Competitive Standings Module
Now calculates REAL rotisserie standings from player stats
"""

import logging
import json
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any

from core.auth_utils import get_current_user
from core.database import execute_sql

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# ROTISSERIE STANDINGS CALCULATION
# =============================================================================

def calculate_rotisserie_standings(league_id: str, season: int = None) -> Dict[str, Any]:
    """
    Calculate actual rotisserie standings from player statistics
    """
    try:
        # 1. Get scoring categories from league settings
        categories_sql = """
            SELECT setting_value 
            FROM league_settings 
            WHERE league_id = :league_id::uuid 
            AND setting_name = 'scoring_categories'
        """
        
        categories_result = execute_sql(
            categories_sql,
            {'league_id': league_id},
            database_name='leagues'
        )
        
        scoring_categories = {
            'hitting': ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
            'pitching': ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
        }
        
        if categories_result.get('records') and categories_result['records'][0]:
            categories_json = categories_result['records'][0].get('setting_value')
            if categories_json:
                try:
                    parsed = json.loads(categories_json)
                    scoring_categories = {
                        'hitting': parsed.get('hitters', parsed.get('hitting', scoring_categories['hitting'])),
                        'pitching': parsed.get('pitchers', parsed.get('pitching', scoring_categories['pitching']))
                    }
                except:
                    pass
        
        # 2. Get all teams
        teams_sql = """
            SELECT 
                team_id,
                team_name,
                manager_name,
                team_logo_url,
                team_colors,
                user_id
            FROM league_teams 
            WHERE league_id = :league_id::uuid
            ORDER BY team_name
        """
        
        teams_result = execute_sql(
            teams_sql,
            {'league_id': league_id},
            database_name='leagues'
        )
        
        teams = []
        team_stats = {}
        
        if teams_result.get('records'):
            for record in teams_result['records']:
                team_id = record.get('team_id')
                if team_id:
                    team_info = {
                        'team_id': team_id,
                        'team_name': record.get('team_name', 'Unknown Team'),
                        'manager_name': record.get('manager_name'),
                        'team_logo_url': record.get('team_logo_url'),
                        'team_colors': record.get('team_colors'),
                        'user_id': record.get('user_id')
                    }
                    teams.append(team_info)
                    team_stats[team_id] = {
                        'hitting': {},
                        'pitching': {},
                        'totals': {}
                    }
        
        if not teams:
            return {
                'teams': [],
                'categories': scoring_categories,
                'standings_type': 'rotisserie'
            }
        
        # 3. Get active rosters and aggregate player stats
        if not season:
            import datetime
            season = datetime.datetime.now().year
        
        for team in teams:
            team_id = team['team_id']
            
            # Get all active players on this team
            roster_sql = """
                SELECT 
                    lp.mlb_player_id
                FROM league_players lp
                WHERE lp.league_id = :league_id::uuid
                AND lp.team_id = :team_id::uuid
                AND lp.roster_status = 'active'
            """
            
            roster_result = execute_sql(
                roster_sql,
                {'league_id': league_id, 'team_id': team_id},
                database_name='leagues'
            )
            
            player_ids = []
            if roster_result.get('records'):
                for record in roster_result['records']:
                    player_id = record.get('mlb_player_id')
                    if player_id:
                        player_ids.append(player_id)
            
            if not player_ids:
                # Initialize zeros for team with no players
                for cat in scoring_categories['hitting']:
                    team_stats[team_id]['hitting'][cat] = 0.0
                for cat in scoring_categories['pitching']:
                    team_stats[team_id]['pitching'][cat] = 0.0
                continue
            
            # Get aggregated hitting stats
            if scoring_categories['hitting']:
                hitting_columns = []
                for cat in scoring_categories['hitting']:
                    # Map category names to database columns
                    if cat == 'R':
                        hitting_columns.append('SUM(runs) as R')
                    elif cat == 'HR':
                        hitting_columns.append('SUM(home_runs) as HR')
                    elif cat == 'RBI':
                        hitting_columns.append('SUM(rbi) as RBI')
                    elif cat == 'SB':
                        hitting_columns.append('SUM(stolen_bases) as SB')
                    elif cat == 'AVG':
                        hitting_columns.append('CASE WHEN SUM(at_bats) > 0 THEN SUM(hits)::float / SUM(at_bats)::float ELSE 0 END as AVG')
                    elif cat == 'OBP':
                        hitting_columns.append('AVG(obp) as OBP')  # Should be weighted but simplified for now
                    elif cat == 'SLG':
                        hitting_columns.append('AVG(slg) as SLG')
                    elif cat == 'OPS':
                        hitting_columns.append('AVG(ops) as OPS')
                    elif cat == '2B' or cat == 'DBL':
                        hitting_columns.append('SUM(doubles) as DBL')
                    elif cat == '3B' or cat == 'TPL':
                        hitting_columns.append('SUM(triples) as TPL')
                    elif cat == 'BB':
                        hitting_columns.append('SUM(walks) as BB')
                    elif cat == 'K' or cat == 'SO':
                        hitting_columns.append('SUM(strikeouts) as K')
                    else:
                        # Default for unknown categories
                        hitting_columns.append(f'0 as {cat}')
                
                if hitting_columns:
                    player_ids_str = ','.join(str(pid) for pid in player_ids)
                    hitting_sql = f"""
                        SELECT {', '.join(hitting_columns)}
                        FROM player_season_stats
                        WHERE league_id = :league_id::uuid
                        AND player_id IN ({player_ids_str})
                        AND season = :season
                    """
                    
                    hitting_result = execute_sql(
                        hitting_sql,
                        {'league_id': league_id, 'season': season},
                        database_name='leagues'
                    )
                    
                    if hitting_result.get('records') and hitting_result['records'][0]:
                        record = hitting_result['records'][0]
                        for cat in scoring_categories['hitting']:
                            # Access by column alias (e.g., 'R', 'HR', 'AVG') instead of index
                            value = record.get(cat, 0)
                            try:
                                team_stats[team_id]['hitting'][cat] = float(value) if value is not None else 0.0
                            except:
                                team_stats[team_id]['hitting'][cat] = 0.0
            
            # Get aggregated pitching stats
            if scoring_categories['pitching']:
                pitching_columns = []
                for cat in scoring_categories['pitching']:
                    if cat == 'W':
                        pitching_columns.append('SUM(wins) as W')
                    elif cat == 'SV':
                        pitching_columns.append('SUM(saves) as SV')
                    elif cat == 'ERA':
                        pitching_columns.append('CASE WHEN SUM(innings_pitched) > 0 THEN (SUM(earned_runs) * 9.0) / SUM(innings_pitched) ELSE 0 END as ERA')
                    elif cat == 'WHIP':
                        pitching_columns.append('CASE WHEN SUM(innings_pitched) > 0 THEN (SUM(hits_allowed) + SUM(walks_allowed))::float / SUM(innings_pitched) ELSE 0 END as WHIP')
                    elif cat == 'SO' or cat == 'K':
                        pitching_columns.append('SUM(strikeouts_pitched) as SO')
                    elif cat == 'QS':
                        pitching_columns.append('SUM(quality_starts) as QS')
                    elif cat == 'HLD' or cat == 'H':
                        pitching_columns.append('SUM(holds) as HLD')
                    elif cat == 'L':
                        pitching_columns.append('SUM(losses) as L')
                    elif cat == 'BB':
                        pitching_columns.append('SUM(walks_allowed) as BB')
                    elif cat == 'IP':
                        pitching_columns.append('SUM(innings_pitched) as IP')
                    elif cat == 'GS':
                        pitching_columns.append('SUM(games_started) as GS')
                    else:
                        pitching_columns.append(f'0 as {cat}')
                
                if pitching_columns:
                    player_ids_str = ','.join(str(pid) for pid in player_ids)
                    pitching_sql = f"""
                        SELECT {', '.join(pitching_columns)}
                        FROM player_season_stats
                        WHERE league_id = :league_id::uuid
                        AND player_id IN ({player_ids_str})
                        AND season = :season
                    """
                    
                    pitching_result = execute_sql(
                        pitching_sql,
                        {'league_id': league_id, 'season': season},
                        database_name='leagues'
                    )
                    
                    if pitching_result.get('records') and pitching_result['records'][0]:
                        record = pitching_result['records'][0]
                        for cat in scoring_categories['pitching']:
                            # Access by column alias (e.g., 'W', 'SV', 'ERA') instead of index
                            value = record.get(cat, 0)
                            try:
                                team_stats[team_id]['pitching'][cat] = float(value) if value is not None else 0.0
                            except:
                                team_stats[team_id]['pitching'][cat] = 0.0
        
        # 4. Calculate rankings for each category
        all_categories = scoring_categories['hitting'] + scoring_categories['pitching']
        num_teams = len(teams)
        
        for cat in all_categories:
            # Determine if this is a hitting or pitching stat
            is_hitting = cat in scoring_categories['hitting']
            stat_type = 'hitting' if is_hitting else 'pitching'
            
            # Categories where lower is better
            is_reversed = cat in ['ERA', 'WHIP', 'L', 'BB']
            
            # Get all team values for this category
            team_values = []
            for team in teams:
                team_id = team['team_id']
                value = team_stats[team_id][stat_type].get(cat, 0)
                team_values.append((team_id, value))
            
            # Sort teams by value
            if is_reversed:
                team_values.sort(key=lambda x: x[1])  # Lower is better
            else:
                team_values.sort(key=lambda x: x[1], reverse=True)  # Higher is better
            
            # Assign points (rank)
            for rank, (team_id, value) in enumerate(team_values, 1):
                points = num_teams - rank + 1
                if 'category_points' not in team_stats[team_id]:
                    team_stats[team_id]['category_points'] = {}
                team_stats[team_id]['category_points'][cat] = points
                
                # Store the rank too
                if 'category_ranks' not in team_stats[team_id]:
                    team_stats[team_id]['category_ranks'] = {}
                team_stats[team_id]['category_ranks'][cat] = rank
        
        # 5. Calculate total points
        for team in teams:
            team_id = team['team_id']
            total_points = sum(team_stats[team_id].get('category_points', {}).values())
            team_stats[team_id]['total_points'] = total_points
        
        # 6. Format response
        standings = []
        for team in teams:
            team_id = team['team_id']
            standings_entry = {
                **team,
                'stats': {
                    **team_stats[team_id]['hitting'],
                    **team_stats[team_id]['pitching']
                },
                'category_points': team_stats[team_id].get('category_points', {}),
                'category_ranks': team_stats[team_id].get('category_ranks', {}),
                'total_points': team_stats[team_id].get('total_points', 0)
            }
            standings.append(standings_entry)
        
        # Sort by total points
        standings.sort(key=lambda x: x['total_points'], reverse=True)
        
        return {
            'teams': standings,
            'categories': scoring_categories,
            'standings_type': 'rotisserie',
            'season': season
        }
        
    except Exception as e:
        logger.error(f"Error calculating rotisserie standings: {e}")
        raise


# =============================================================================
# COMPETITIVE STANDINGS ENDPOINTS
# =============================================================================

@router.get("/{league_id}/standings")
async def get_league_standings(league_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get current league standings - REAL rotisserie calculations or head-to-head records
    """
    try:
        user_id = current_user.get('sub')
        logger.info(f"🏆 Getting competitive standings for league: {league_id}")
        
        # Verify membership
        membership_sql = """
            SELECT lm.role 
            FROM league_memberships lm
            WHERE lm.league_id = :league_id::uuid 
            AND lm.user_id = :user_id 
            AND lm.is_active = true
        """
        
        membership_result = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        }, database_name='postgres')
        
        if not membership_result.get('records'):
            raise HTTPException(status_code=404, detail="League not found or access denied")
        
        user_role = membership_result['records'][0].get('role')
        
        # Check league type
        league_info_sql = """
            SELECT league_id, league_name 
            FROM user_leagues 
            WHERE league_id = :league_id::uuid
        """
        league_info_result = execute_sql(
            league_info_sql,
            {'league_id': league_id},
            database_name='postgres'
        )
        
        # Get scoring system from league settings
        scoring_system_sql = """
            SELECT setting_value 
            FROM league_settings 
            WHERE league_id = :league_id::uuid 
            AND setting_name = 'scoring_system'
        """
        
        scoring_result = execute_sql(
            scoring_system_sql,
            {'league_id': league_id},
            database_name='leagues'
        )
        
        scoring_system = 'rotisserie_ytd'  # Default
        if scoring_result.get('records') and scoring_result['records'][0]:
            scoring_system = scoring_result['records'][0].get('setting_value', 'rotisserie_ytd')
        
        # For rotisserie leagues, calculate real standings
        if 'rotisserie' in scoring_system or 'roto' in scoring_system:
            logger.info(f"📊 Calculating rotisserie standings for league {league_id}")
            standings_data = calculate_rotisserie_standings(league_id)
            
            return {
                "success": True,
                "standings": standings_data['teams'],
                "teams": standings_data['teams'],
                "categories": standings_data['categories'],
                "standings_type": "rotisserie",
                "scoring_system": scoring_system,
                "user_role": user_role,
                "season": standings_data.get('season')
            }
        
        # For head-to-head leagues, return win/loss records
        else:
            logger.info(f"📊 Getting head-to-head standings for league {league_id}")
            
            # Get all teams
            teams_result = execute_sql(
                """
                SELECT 
                    team_id,
                    team_name,
                    manager_name,
                    team_colors,
                    team_logo_url,
                    user_id,
                    created_at
                FROM league_teams 
                WHERE league_id = :league_id::uuid
                ORDER BY created_at ASC
                """,
                {'league_id': league_id},
                database_name='leagues'
            )
            
            teams = []
            if teams_result.get('records'):
                for i, team_record in enumerate(teams_result['records'], 1):
                    team = {
                        "position": i,
                        "team_id": team_record.get('team_id'),
                        "team_name": team_record.get('team_name', "Unnamed Team"),
                        "manager_name": team_record.get('manager_name'),
                        "team_colors": team_record.get('team_colors'),
                        "team_logo_url": team_record.get('team_logo_url'),
                        "user_id": team_record.get('user_id'),
                        "wins": 0,
                        "losses": 0,
                        "ties": 0,
                        "points": 0,
                        "status": "active"
                    }
                    teams.append(team)
            
            # TODO: Get actual head-to-head records from matchups table
            
            return {
                "success": True,
                "teams": teams,
                "standings": teams,
                "total_teams": len(teams),
                "standings_type": "head_to_head",
                "scoring_system": scoring_system,
                "user_role": user_role
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting competitive standings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get competitive standings: {str(e)}")


@router.get("/{league_id}/rotisserie")
async def get_rotisserie_standings(league_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get detailed rotisserie standings with category breakdowns
    """
    try:
        user_id = current_user.get('sub')
        
        # Verify membership
        membership_check = execute_sql(
            """SELECT user_id FROM league_memberships 
               WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true""",
            {'league_id': league_id, 'user_id': user_id},
            database_name='postgres'
        )
        
        if not membership_check.get('records'):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # Calculate rotisserie standings
        standings = calculate_rotisserie_standings(league_id)
        
        return {
            "success": True,
            **standings
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting rotisserie standings: {e}")
        raise HTTPException(status_code=500, detail="Failed to get rotisserie standings")