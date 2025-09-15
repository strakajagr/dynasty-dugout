"""
Dynasty Dugout - Basic League Management Module - ENHANCED WITH FULL ROSTER CONFIGURATION
ENHANCED with Teams List Endpoint for Team Browsing
ENHANCED with Public Leagues endpoint for discovery
EXTRACTED FROM: The massive leagues.py file (basic CRUD operations)
PURPOSE: Simple league info retrieval, settings, health checks, teams management
STATUS: Updated for shared database architecture with complete roster configuration support
"""

import logging
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends

from core.auth_utils import get_current_user
from core.database import execute_sql
from core.season_utils import get_current_season, CURRENT_SEASON, SEASON_START

logger = logging.getLogger(__name__)

# Two routers to separate global vs. league-specific routes
global_router = APIRouter()  # For routes without a league_id prefix
router = APIRouter()  # For routes that require a league_id prefix

def get_value_from_field(field, value_type='string', default=None):
    """Safely extract value from RDS Data API field"""
    if not field or field.get('isNull'):
        return default
    
    if value_type == 'string':
        return field.get('stringValue', default)
    elif value_type == 'long':
        return field.get('longValue', default or 0)
    elif value_type == 'decimal':
        # Handle decimal values that come as stringValue
        if 'stringValue' in field:
            try:
                return float(field['stringValue'])
            except:
                return default or 0.0
        return field.get('doubleValue', default or 0.0)
    elif value_type == 'boolean':
        return field.get('booleanValue', default or False)
    else:
        return field.get('stringValue', default)

def parse_league_settings(settings_records):
    """Parse league settings from database records into organized structure"""
    settings = {}
    
    for record in settings_records:
        setting_name = get_value_from_field(record[0], 'string')
        setting_value = get_value_from_field(record[1], 'string')
        setting_type = get_value_from_field(record[2], 'string', 'string')
        
        if not setting_name or not setting_value:
            continue
            
        # Convert based on type
        try:
            if setting_type == 'boolean':
                settings[setting_name] = setting_value.lower() == 'true'
            elif setting_type == 'integer':
                settings[setting_name] = int(setting_value)
            elif setting_type == 'float':
                settings[setting_name] = float(setting_value)
            elif setting_type == 'json':
                settings[setting_name] = json.loads(setting_value)
            else:
                settings[setting_name] = setting_value
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to parse setting {setting_name} with value {setting_value}: {e}")
            settings[setting_name] = setting_value
    
    return settings

# =============================================================================
# GLOBAL ENDPOINTS (Handled by global_router)
# =============================================================================

@global_router.get("/public")
async def get_public_leagues():
    """Get all public leagues that are accepting new teams"""
    try:
        logger.info("📢 Fetching public leagues for discovery")
        
        # Get public leagues from phone book with team counts
        sql = """
            SELECT 
                ul.league_id,
                ul.league_name,
                ul.commissioner_user_id,
                ul.created_at,
                ul.invite_code,
                COUNT(DISTINCT lm.user_id) as current_teams
            FROM user_leagues ul
            LEFT JOIN league_memberships lm ON ul.league_id = lm.league_id AND lm.is_active = true
            WHERE ul.is_public = true 
              AND ul.creation_status = 'completed'
              AND ul.status != 'archived'
            GROUP BY ul.league_id, ul.league_name, ul.commissioner_user_id, ul.created_at, ul.invite_code
            ORDER BY ul.created_at DESC
        """
        
        response = execute_sql(sql, database_name='postgres')
        
        leagues = []
        if response.get('records'):
            for record in response['records']:
                league_id = get_value_from_field(record[0], 'string')
                
                # Get detailed settings from leagues database
                settings_sql = """
                    SELECT setting_name, setting_value, setting_type
                    FROM league_settings 
                    WHERE league_id = :league_id::uuid
                      AND setting_name IN ('max_teams', 'scoring_system', 'salary_cap', 'commissioner_name')
                """
                settings_response = execute_sql(
                    settings_sql, 
                    {'league_id': league_id}, 
                    database_name='leagues'
                )
                
                # Parse settings with defaults
                max_teams = 12
                scoring_system = 'rotisserie_ytd'
                salary_cap = 800.0
                commissioner_name = 'Commissioner'
                
                if settings_response.get('records'):
                    parsed = parse_league_settings(settings_response['records'])
                    max_teams = parsed.get('max_teams', max_teams)
                    scoring_system = parsed.get('scoring_system', scoring_system)
                    salary_cap = parsed.get('salary_cap', salary_cap)
                    commissioner_name = parsed.get('commissioner_name', commissioner_name)
                
                current_teams = get_value_from_field(record[5], 'long', 0)
                
                # Only include leagues with open spots
                if current_teams < max_teams:
                    leagues.append({
                        'league_id': league_id,
                        'league_name': get_value_from_field(record[1], 'string'),
                        'commissioner_user_id': get_value_from_field(record[2], 'string'),
                        'commissioner_name': commissioner_name,
                        'created_at': get_value_from_field(record[3], 'string'),
                        'current_teams': current_teams,
                        'max_teams': max_teams,
                        'scoring_system': scoring_system,
                        'salary_cap': salary_cap,
                        'spots_available': max_teams - current_teams
                    })
        
        logger.info(f"✅ Found {len(leagues)} public leagues with open spots")
        
        return {
            "success": True,
            "leagues": leagues,
            "count": len(leagues)
        }
        
    except Exception as e:
        logger.error(f"Error fetching public leagues: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@global_router.post("/join-private")
async def join_private_league(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Join a private league using an invite code"""
    try:
        invite_code = request.get('invite_code', '').upper().strip()
        user_id = current_user.get('sub')
        
        if not invite_code:
            raise HTTPException(status_code=400, detail="Invite code is required")
        
        logger.info(f"User {user_id} attempting to join with code: {invite_code}")
        
        # Find league by invite code
        result = execute_sql(
            """SELECT league_id, league_name, is_public
               FROM user_leagues 
               WHERE invite_code = :code 
                 AND creation_status = 'completed'
                 AND status != 'archived'""",
            {'code': invite_code},
            database_name='postgres'
        )
        
        if not result.get('records'):
            raise HTTPException(status_code=404, detail="Invalid or expired invite code")
        
        league_id = result['records'][0][0].get('stringValue')
        league_name = result['records'][0][1].get('stringValue')
        
        # Check if user is already a member
        membership_check = execute_sql(
            """SELECT user_id FROM league_memberships 
               WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true""",
            {'league_id': league_id, 'user_id': user_id},
            database_name='postgres'
        )
        
        if membership_check.get('records'):
            return {
                "success": True,
                "league_id": league_id,
                "league_name": league_name,
                "already_member": True,
                "message": "You are already a member of this league"
            }
        
        # Return league info for join flow
        return {
            "success": True,
            "league_id": league_id,
            "league_name": league_name,
            "already_member": False,
            "message": "League found! Redirecting to team setup..."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining league with code: {e}")
        raise HTTPException(status_code=500, detail="Failed to join league")

@global_router.get("/my-leagues")
async def get_my_leagues(current_user: dict = Depends(get_current_user)):
    """Get all leagues for the current user with configuration details"""
    try:
        user_id = current_user.get('sub')
        
        sql = """
            SELECT 
                ul.league_id, ul.league_name, ul.created_at, lm.role,
                ul.commissioner_user_id, ul.is_public, ul.invite_code
            FROM user_leagues ul
            JOIN league_memberships lm ON ul.league_id = lm.league_id
            WHERE lm.user_id = :user_id AND lm.is_active = true
            ORDER BY ul.created_at DESC
        """
        
        response = execute_sql(sql, {'user_id': user_id})
        
        leagues = []
        if response.get('records'):
            for record in response['records']:
                # Basic league info from phone book
                league_id = record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None
                commissioner_user_id = record[4].get('stringValue') if record[4] and not record[4].get('isNull') else None
                is_public = record[5].get('booleanValue', True) if record[5] and not record[5].get('isNull') else True
                invite_code = record[6].get('stringValue') if record[6] and not record[6].get('isNull') else None
                
                league = {
                    'league_id': league_id,
                    'league_name': record[1].get('stringValue') if record[1] and not record[1].get('isNull') else None,
                    'database_name': 'leagues',  # Always shared database
                    'created_at': record[2].get('stringValue') if record[2] and not record[2].get('isNull') else None,
                    'role': record[3].get('stringValue') if record[3] and not record[3].get('isNull') else 'member',
                    'status': 'active',
                    'current_season': CURRENT_SEASON,
                    'is_commissioner': user_id == commissioner_user_id,
                    'is_public': is_public,
                    'invite_code': invite_code if not is_public else None,
                    # Default values for missing config
                    'scoring_system': 'rotisserie_ytd',
                    'player_pool': 'american_national',
                    'max_teams': 12,
                    'salary_cap': 200.0,
                    'league_status': 'setup',
                    'prices_set': False
                }
                
                # Try to get detailed config from shared leagues database
                try:
                    settings_sql = """
                        SELECT setting_name, setting_value, setting_type
                        FROM league_settings 
                        WHERE league_id = :league_id::uuid
                    """
                    settings_response = execute_sql(settings_sql, {'league_id': league_id}, database_name='leagues')
                    
                    if settings_response.get('records'):
                        parsed_settings = parse_league_settings(settings_response['records'])
                        league.update(parsed_settings)
                                    
                    # Check if prices are set
                    price_check = execute_sql(
                        """SELECT COUNT(*) FROM league_players 
                           WHERE league_id = :league_id::uuid 
                           AND (salary > 0 OR generated_price > 0 OR manual_price_override > 0)""",
                        {'league_id': league_id},
                        database_name='leagues'
                    )
                    if price_check and price_check.get('records'):
                        count = price_check['records'][0][0].get('longValue', 0)
                        league['prices_set'] = count > 0
                        
                except Exception as settings_error:
                    logger.warning(f"Could not get settings for league {league['league_id']}: {settings_error}")
                
                leagues.append(league)
        
        return {
            "success": True,
            "leagues": leagues,
            "count": len(leagues),
            "current_season": CURRENT_SEASON,
            "note": "Phone book + complete league settings including roster configuration",
            "architecture": "Shared database architecture"
        }
        
    except Exception as e:
        logger.error(f"Error getting user leagues: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve leagues")

# =============================================================================
# LEAGUE-SPECIFIC ENDPOINTS (Handled by the original router)
# =============================================================================

@router.get("/health")
async def league_health_check():
    """Health check for league services"""
    try:
        current_season = get_current_season()
        sql = "SELECT COUNT(*) FROM mlb_players"
        response = execute_sql(sql)
        
        player_count = 0
        if response.get('records') and response['records'][0]:
            player_count = response['records'][0][0].get('longValue', 0)
        
        return {
            "status": "healthy",
            "service": "leagues",
            "current_season": current_season,
            "mlb_players_available": player_count,
            "services": {
                "lifecycle": "operational (creation/deletion)",
                "management": "operational (FULL roster configuration support)",
                "owners": "operational (owner management)",
                "standings": "operational (competitive rankings)",
                "players": "operational (league-specific players)",
                "transactions": "operational (trades/waivers)",
                "database_provisioning": "operational (shared database)",
                "async_creation": "operational",
                "modular_structure": "✅ REORGANIZED INTO FOCUSED MODULES!",
                "data_pipeline": "operational (main DB stats)",
                "season_management": f"✅ Dynamic season support ({current_season})",
                "team_browsing": "✅ Enhanced with cross-team roster viewing",
                "roster_configuration": "✅ Dynamic position requirements, bench/DL/minor slots",
                "public_private_leagues": "✅ Public/private league support with invite codes"
            },
            "architecture": {
                "main_database": "Single source of truth (all MLB stats)",
                "leagues_database": "Shared database for all league data",
                "modular_routers": "Focused, maintainable modules",
                "roster_configuration": "Fully dynamic based on league settings"
            },
            "performance": "Improved with shared database",
            "file_organization": "1200+ line file broken into 6 focused modules",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"League health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "service": "leagues",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@router.get("/{league_id}")
async def get_league(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get league details - ENHANCED WITH FULL ROSTER CONFIGURATION FOR MYROSTER"""
    try:
        user_id = current_user.get('sub')
        
        league_sql = """
            SELECT 
                ul.league_id, ul.league_name, ul.commissioner_user_id, 
                ul.created_at, lm.role, ul.creation_status,
                ul.is_public, ul.invite_code
            FROM user_leagues ul
            LEFT JOIN league_memberships lm ON ul.league_id = lm.league_id AND lm.user_id = :user_id
            WHERE ul.league_id = :league_id::uuid
        """
        
        league_response = execute_sql(league_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not league_response.get('records'):
            raise HTTPException(status_code=404, detail="League not found or access denied")
        
        record = league_response['records'][0]
        
        def safe_get(record_item, value_type, default=None):
            if not record_item or record_item.get('isNull'):
                return default
            return record_item.get(value_type, default)
        
        commissioner_user_id = safe_get(record[2], 'stringValue')
        creation_status = safe_get(record[5], 'stringValue', 'unknown')
        is_public = safe_get(record[6], 'booleanValue', True)
        invite_code = safe_get(record[7], 'stringValue')
        
        # Get current season dynamically
        current_season = get_current_season()
        
        # Build initial league object with ALL fields including ROSTER CONFIGURATION
        league = {
            'league_id': safe_get(record[0], 'stringValue'),
            'league_name': safe_get(record[1], 'stringValue'),
            'commissioner_user_id': commissioner_user_id,
            'database_name': 'leagues',  # Always shared database
            'status': 'active',
            'created_at': safe_get(record[3], 'stringValue'),
            'role': safe_get(record[4], 'stringValue'),
            'creation_status': creation_status,
            'current_week': "Week 17",
            'season': current_season,  # DYNAMIC!
            'is_public': is_public,
            'invite_code': invite_code if not is_public and safe_get(record[4], 'stringValue') == 'commissioner' else None,
            
            # Basic league info
            'league_status': 'setup',
            'is_commissioner': user_id == commissioner_user_id,
            'prices_set': False,
            'draft_type': None,
            'max_teams': 12,
            'current_teams': 0,
            
            # Financial defaults
            'use_salaries': True,
            'use_contracts': True,
            'use_dual_cap': True,
            'salary_cap': 800.0,
            'draft_cap': 600.0,
            'season_cap': 200.0,
            'min_salary': 2.0,
            'salary_increment': 2.0,
            'rookie_price': 20.0,
            'standard_contract_length': 2,
            'draft_cap_usage': 0.75,
            
            # ROSTER CONFIGURATION DEFAULTS - CRITICAL FOR MYROSTER
            'position_requirements': {
                'C': {'slots': 2},
                '1B': {'slots': 1},
                '2B': {'slots': 1},
                '3B': {'slots': 1},
                'SS': {'slots': 1},
                'OF': {'slots': 4},
                'MI': {'slots': 1},
                'CI': {'slots': 1},
                'UTIL': {'slots': 1},
                'P': {'slots': 10}
            },
            'max_players_total': 23,
            'min_hitters': 13,
            'max_pitchers': 10,
            'min_pitchers': 10,
            'bench_slots': 5,
            'dl_slots': 0,
            'minor_league_slots': 0,
            
            # Scoring defaults
            'scoring_system': 'rotisserie_ytd',
            'scoring_categories': {
                'hitters': ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
                'pitchers': ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
            },
            
            # Advanced defaults
            'player_pool': 'american_national',
            'include_minor_leagues': False,
            'transaction_deadline': 'monday',
            'use_waivers': False,
            'season_start_date': f'{current_season}-03-28',  # DYNAMIC!
            'season_end_date': f'{current_season}-09-28',    # DYNAMIC!
            'season_started_at': None
        }
        
        # If creation isn't complete, return defaults
        if creation_status != 'completed':
            return {
                "success": True,
                "league": league,
                "source": "management module (basic league info with defaults)",
                "note": "League creation not complete - using default roster configuration"
            }
        
        # Get COMPLETE config from shared leagues database including ROSTER SETTINGS
        try:
            settings_sql = """
                SELECT setting_name, setting_value, setting_type
                FROM league_settings 
                WHERE league_id = :league_id::uuid
                ORDER BY setting_name
            """
            settings_response = execute_sql(settings_sql, {'league_id': league_id}, database_name='leagues')
            
            if settings_response.get('records'):
                logger.info(f"[{league_id[:8]}] Found {len(settings_response['records'])} league settings")
                
                # Parse all settings using the helper function
                parsed_settings = parse_league_settings(settings_response['records'])
                
                # Update league object with parsed settings
                league.update(parsed_settings)
                
                # Log roster configuration for debugging
                if 'position_requirements' in parsed_settings:
                    logger.info(f"[{league_id[:8]}] Roster config loaded: {len(parsed_settings['position_requirements'])} positions")
                    
                # Special handling for legacy fields or missing data
                if 'roster_positions' in parsed_settings and 'position_requirements' not in parsed_settings:
                    # Handle legacy format if needed
                    league['position_requirements'] = parsed_settings['roster_positions']
            
            # Enhanced commissioner check (multi-commissioner support)
            comm_check = execute_sql(
                """SELECT COUNT(*) FROM league_teams 
                   WHERE league_id = :league_id::uuid 
                   AND user_id = :user_id 
                   AND is_commissioner = true""",
                {'league_id': league_id, 'user_id': user_id},
                database_name='leagues'
            )
            if comm_check and comm_check.get('records'):
                count = comm_check['records'][0][0].get('longValue', 0)
                if count > 0:
                    league['is_commissioner'] = True
            
            # Check if prices are set
            price_check = execute_sql(
                """SELECT COUNT(*) FROM league_players 
                   WHERE league_id = :league_id::uuid 
                   AND (salary > 0 OR generated_price > 0 OR manual_price_override > 0)""",
                {'league_id': league_id},
                database_name='leagues'
            )
            if price_check and price_check.get('records'):
                count = price_check['records'][0][0].get('longValue', 0)
                league['prices_set'] = count > 0
            
            # Get current team count
            team_count_result = execute_sql(
                "SELECT COUNT(*) FROM league_teams WHERE league_id = :league_id::uuid",
                {'league_id': league_id},
                database_name='leagues'
            )
            if team_count_result and team_count_result.get('records'):
                league['current_teams'] = team_count_result['records'][0][0].get('longValue', 0)
        
        except Exception as settings_error:
            logger.warning(f"Could not get league settings: {settings_error}")
        
        # Calculate roster totals for MyRoster
        if isinstance(league.get('position_requirements'), dict):
            total_active_slots = sum(pos.get('slots', 0) for pos in league['position_requirements'].values())
            league['total_active_slots'] = total_active_slots
            league['total_roster_slots'] = (
                total_active_slots + 
                league.get('bench_slots', 0) + 
                league.get('dl_slots', 0) + 
                league.get('minor_league_slots', 0)
            )
        
        return {
            "success": True,
            "league": league,
            "source": "management module (complete league configuration including roster)",
            "roster_config_loaded": 'position_requirements' in league and bool(league['position_requirements']),
            "debug_info": {
                "settings_found": len(parsed_settings) if 'parsed_settings' in locals() else 0,
                "position_requirements_type": type(league.get('position_requirements')).__name__,
                "total_active_slots": league.get('total_active_slots', 'not calculated')
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting league details: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve league details")

@router.get("/{league_id}/teams")
async def get_league_teams(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all teams in the league for team browsing and commissioner mode"""
    try:
        user_id = current_user.get('sub')
        
        # Simple query - just get teams with basic info
        teams_sql = """
            SELECT 
                lt.team_id,
                lt.team_name,
                lt.user_id,
                lt.is_commissioner,
                lt.manager_name,
                COALESCE(salary_summary.total_salary, 0) as salary_used,
                COALESCE(salary_summary.player_count, 0) as total_players
            FROM league_teams lt
            LEFT JOIN (
                SELECT 
                    team_id,
                    SUM(salary) as total_salary,
                    COUNT(*) as player_count
                FROM league_players 
                WHERE league_id = :league_id::uuid
                  AND team_id IS NOT NULL
                  AND availability_status = 'owned'
                GROUP BY team_id
            ) salary_summary ON lt.team_id = salary_summary.team_id
            WHERE lt.league_id = :league_id::uuid
            ORDER BY lt.team_name ASC
        """
        
        teams_result = execute_sql(
            teams_sql,
            parameters={'league_id': league_id},
            database_name='leagues'
        )
        
        if not teams_result or not teams_result.get("records"):
            return {
                "success": True,
                "teams": [],
                "count": 0,
                "league_id": league_id,
                "message": "No teams found in this league"
            }
        
        teams = []
        user_team_found = False
        
        for record in teams_result["records"]:
            team_user_id = get_value_from_field(record[2], 'string')
            is_user_team = user_id == team_user_id
            
            if is_user_team:
                user_team_found = True
            
            team = {
                "team_id": get_value_from_field(record[0], 'string'),
                "team_name": get_value_from_field(record[1], 'string') or "Unnamed Team",
                "user_id": team_user_id,
                "is_commissioner": get_value_from_field(record[3], 'boolean', False),
                "is_user_team": is_user_team,
                "manager_name": get_value_from_field(record[4], 'string') or "Unknown Manager",
                "salary_used": get_value_from_field(record[5], 'decimal', 0.0),
                "total_players": get_value_from_field(record[6], 'long', 0),
                "salary_cap": 800.0  # Default value
            }
            
            teams.append(team)
        
        # Sort teams: user's team first, then alphabetically
        teams.sort(key=lambda t: (not t["is_user_team"], t["team_name"]))
        
        return {
            "success": True,
            "teams": teams,
            "count": len(teams),
            "league_id": league_id,
            "user_has_team": user_team_found,
            "season": CURRENT_SEASON,
            "data_source": "leagues_db"
        }
        
    except Exception as e:
        logger.error(f"Error getting league teams: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting league teams: {str(e)}")

@router.get("/{league_id}/settings")
async def get_league_settings(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get league settings including UI feature toggles AND COMPLETE ROSTER CONFIGURATION"""
    try:
        # Get all league settings from shared database
        settings_sql = """
            SELECT setting_name, setting_value, setting_type
            FROM league_settings
            WHERE league_id = :league_id::uuid
            ORDER BY setting_name
        """
        
        result = execute_sql(
            settings_sql,
            parameters={'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Parse all settings
        settings = {}
        ui_features = {}
        roster_config = {}
        
        if result and result.get("records"):
            parsed_settings = parse_league_settings(result["records"])
            settings.update(parsed_settings)
            
            # Extract UI feature toggles
            for key, value in parsed_settings.items():
                if key.startswith('use_') or key.startswith('show_'):
                    ui_features[key] = value
                elif key in ['position_requirements', 'bench_slots', 'dl_slots', 'minor_league_slots', 'max_players_total']:
                    roster_config[key] = value
        
        # Get privacy info from main database
        privacy_sql = """
            SELECT is_public, invite_code
            FROM user_leagues
            WHERE league_id = :league_id::uuid
        """
        privacy_result = execute_sql(privacy_sql, {'league_id': league_id}, database_name='postgres')
        
        if privacy_result and privacy_result.get('records'):
            record = privacy_result['records'][0]
            settings['is_public'] = get_value_from_field(record[0], 'boolean', True)
            settings['invite_code'] = get_value_from_field(record[1], 'string')
        
        return {
            "success": True,
            "league_id": league_id,
            "settings": settings,
            "ui_features": ui_features,
            "roster_configuration": roster_config,
            "current_season": CURRENT_SEASON,
            "feature_summary": {
                "contracts_enabled": settings.get('use_contracts', True),
                "salaries_enabled": settings.get('use_salaries', True),
                "waivers_enabled": settings.get('use_waivers', False),
                "team_attribution_enabled": settings.get('use_team_attribution', True),
                "transactions_enabled": settings.get('use_transactions', True),
                "advanced_stats_enabled": settings.get('show_advanced_stats', True),
                "team_browsing_enabled": True,
                "dynamic_roster_enabled": True,  # Always enabled now
                "public_private_leagues": True
            },
            "roster_summary": {
                "total_positions": len(roster_config.get('position_requirements', {})),
                "bench_slots": roster_config.get('bench_slots', 0),
                "dl_slots": roster_config.get('dl_slots', 0),
                "minor_league_slots": roster_config.get('minor_league_slots', 0),
                "max_players_total": roster_config.get('max_players_total', 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting league settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting league settings: {str(e)}")

@router.put("/{league_id}/settings")
async def update_league_settings(
    league_id: str,
    settings_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update league settings (commissioner only)"""
    try:
        user_id = current_user.get('sub')
        
        # Check if user is commissioner (multi-commissioner support)
        comm_check = execute_sql(
            """SELECT COUNT(*) FROM league_teams 
               WHERE league_id = :league_id::uuid 
               AND user_id = :user_id 
               AND is_commissioner = true""",
            {'league_id': league_id, 'user_id': user_id},
            database_name='leagues'
        )
        
        is_commissioner = False
        if comm_check and comm_check.get('records'):
            count = comm_check['records'][0][0].get('longValue', 0)
            is_commissioner = count > 0
        
        # Fallback to original commissioner check
        if not is_commissioner:
            result = execute_sql(
                "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid",
                {'league_id': league_id},
                database_name='postgres'
            )
            if result and result.get('records'):
                commissioner_id = result['records'][0][0].get('stringValue')
                is_commissioner = commissioner_id == user_id
        
        if not is_commissioner:
            raise HTTPException(status_code=403, detail="Only commissioners can update league settings")
        
        # Process each setting
        for setting_name, setting_value in settings_data.items():
            # Skip empty values
            if setting_value is None:
                continue
            
            # Determine setting type
            setting_type = 'string'
            stored_value = str(setting_value)
            
            if isinstance(setting_value, bool):
                setting_type = 'boolean'
                stored_value = 'true' if setting_value else 'false'
            elif isinstance(setting_value, int):
                setting_type = 'integer'
                stored_value = str(setting_value)
            elif isinstance(setting_value, float):
                setting_type = 'float'
                stored_value = str(setting_value)
            elif isinstance(setting_value, dict) or isinstance(setting_value, list):
                setting_type = 'json'
                stored_value = json.dumps(setting_value)
            
            # Update league_settings table
            execute_sql(
                """INSERT INTO league_settings (league_id, setting_name, setting_value, setting_type)
                   VALUES (:league_id::uuid, :setting_name, :setting_value, :setting_type)
                   ON CONFLICT (league_id, setting_name) 
                   DO UPDATE SET setting_value = :setting_value, updated_at = NOW()""",
                {
                    'league_id': league_id,
                    'setting_name': setting_name,
                    'setting_value': stored_value,
                    'setting_type': setting_type
                },
                database_name='leagues'
            )
            
            # Special handling for league_name - also update main database
            if setting_name == 'league_name':
                execute_sql(
                    "UPDATE user_leagues SET league_name = :league_name WHERE league_id = :league_id::uuid",
                    {'league_name': setting_value, 'league_id': league_id},
                    database_name='postgres'
                )
                logger.info(f"Updated league name to '{setting_value}' for league {league_id}")
            
            # Special handling for is_public - also update main database
            if setting_name == 'is_public':
                execute_sql(
                    "UPDATE user_leagues SET is_public = :is_public WHERE league_id = :league_id::uuid",
                    {'is_public': setting_value, 'league_id': league_id},
                    database_name='postgres'
                )
                logger.info(f"Updated is_public to '{setting_value}' for league {league_id}")
            
            # Special handling for invite_code - also update main database
            if setting_name == 'invite_code':
                execute_sql(
                    "UPDATE user_leagues SET invite_code = :invite_code WHERE league_id = :league_id::uuid",
                    {'invite_code': setting_value, 'league_id': league_id},
                    database_name='postgres'
                )
                logger.info(f"Updated invite_code to '{setting_value}' for league {league_id}")
            
            logger.debug(f"Updated setting {setting_name} = {stored_value} (type: {setting_type})")
        
        logger.info(f"✅ Successfully updated {len(settings_data)} settings for league {league_id}")
        
        return {
            "success": True,
            "message": f"Successfully updated {len(settings_data)} settings",
            "settings_updated": list(settings_data.keys())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating league settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

@router.post("/{league_id}/check-stats")
async def check_league_stats(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if stats are available for the league (in main database)"""
    try:
        # Verify commissioner permissions
        user_id = current_user.get('sub')
        team_check = execute_sql(
            """SELECT is_commissioner FROM league_teams 
               WHERE league_id = :league_id::uuid AND user_id = :user_id""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'
        )
        
        if not team_check or not team_check.get("records") or not team_check["records"][0][0]["booleanValue"]:
            raise HTTPException(status_code=403, detail="Only commissioners can check stats")
        
        # Check if stats exist in main database for current season
        stats_check = execute_sql(
            f"""SELECT COUNT(*) FROM player_season_stats 
                WHERE season = {CURRENT_SEASON}""",
            database_name='postgres'
        )
        
        stats_count = 0
        if stats_check and stats_check.get('records'):
            stats_count = stats_check['records'][0][0].get('longValue', 0)
        
        # Get some sample players with stats
        sample_sql = f"""
            SELECT mp.first_name, mp.last_name, mp.position, 
                   pss.batting_avg, pss.home_runs, pss.rbi, pss.era, pss.wins, pss.saves
            FROM player_season_stats pss
            JOIN mlb_players mp ON pss.player_id = mp.player_id
            WHERE pss.season = {CURRENT_SEASON}
              AND (pss.home_runs > 0 OR pss.wins > 0 OR pss.saves > 0)
            ORDER BY pss.home_runs DESC, pss.wins DESC, pss.saves DESC
            LIMIT 5
        """
        
        sample_result = execute_sql(sample_sql, database_name='postgres')
        sample_players = []
        
        if sample_result and sample_result.get('records'):
            for record in sample_result['records']:
                sample_players.append({
                    "name": f"{record[0]['stringValue']} {record[1]['stringValue']}",
                    "position": record[2]['stringValue'],
                    "avg": record[3]['doubleValue'] if record[3].get('doubleValue') else 0,
                    "home_runs": record[4]['longValue'] if record[4].get('longValue') else 0,
                    "wins": record[7]['longValue'] if record[7].get('longValue') else 0
                })
        
        return {
            "success": True,
            "league_id": league_id,
            "season": CURRENT_SEASON,
            "stats_available": stats_count > 0,
            "player_count": stats_count,
            "sample_players": sample_players,
            "message": f"{stats_count} players have {CURRENT_SEASON} season stats available",
            "note": "Stats are stored in main database and shared across all leagues"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking league stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error checking stats: {str(e)}")
    
@router.get("/{league_id}/my-team")
async def get_my_team(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user's team in this league"""
    try:
        user_id = current_user.get('sub')
        
        result = execute_sql(
            "SELECT team_id, team_name, team_logo_url, team_colors, team_motto, manager_name FROM league_teams WHERE league_id = :league_id::uuid AND user_id = :user_id",
            {'league_id': league_id, 'user_id': user_id},
            database_name='leagues'
        )
        
        if not result or not result.get('records'):
            raise HTTPException(status_code=404, detail="Team not found")
        
        team = result['records'][0]
        return {
            "success": True,
            "team_id": team[0].get('stringValue'),
            "team_name": team[1].get('stringValue'),
            "team_logo_url": team[2].get('stringValue') if team[2] and not team[2].get('isNull') else '',
            "team_colors": json.loads(team[3].get('stringValue', '{}')) if team[3] and not team[3].get('isNull') else {},
            "team_motto": team[4].get('stringValue') if team[4] and not team[4].get('isNull') else '',
            "manager_name": team[5].get('stringValue') if team[5] and not team[5].get('isNull') else ''
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user team: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting team: {str(e)}")

@router.get("/{league_id}/roster-configuration")
async def get_roster_configuration(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed roster configuration for dynamic roster generation"""
    try:
        # Get roster-specific settings
        settings_sql = """
            SELECT setting_name, setting_value, setting_type
            FROM league_settings
            WHERE league_id = :league_id::uuid
            AND setting_name IN (
                'position_requirements', 'bench_slots', 'dl_slots', 'minor_league_slots',
                'max_players_total', 'min_hitters', 'max_pitchers', 'min_pitchers'
            )
        """
        
        result = execute_sql(
            settings_sql,
            parameters={'league_id': league_id},
            database_name='leagues'
        )
        
        roster_config = {
            'position_requirements': {
                'C': {'slots': 2}, '1B': {'slots': 1}, '2B': {'slots': 1}, 
                '3B': {'slots': 1}, 'SS': {'slots': 1}, 'OF': {'slots': 4},
                'MI': {'slots': 1}, 'CI': {'slots': 1}, 'UTIL': {'slots': 1}, 'P': {'slots': 10}
            },
            'bench_slots': 5,
            'dl_slots': 0,
            'minor_league_slots': 0,
            'max_players_total': 23
        }
        
        if result and result.get("records"):
            parsed_settings = parse_league_settings(result["records"])
            roster_config.update(parsed_settings)
        
        # Calculate totals
        total_active = sum(pos.get('slots', 0) for pos in roster_config['position_requirements'].values())
        total_roster = (
            total_active + 
            roster_config.get('bench_slots', 0) + 
            roster_config.get('dl_slots', 0) + 
            roster_config.get('minor_league_slots', 0)
        )
        
        return {
            "success": True,
            "league_id": league_id,
            "roster_configuration": roster_config,
            "calculated_totals": {
                "total_active_slots": total_active,
                "total_roster_slots": total_roster,
                "batters": sum(pos.get('slots', 0) for k, pos in roster_config['position_requirements'].items() if k != 'P'),
                "pitchers": roster_config['position_requirements'].get('P', {}).get('slots', 0)
            },
            "data_source": "leagues_db_settings",
            "note": "This configuration powers the dynamic MyRoster screen generation"
        }
        
    except Exception as e:
        logger.error(f"Error getting roster configuration: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting roster configuration: {str(e)}")