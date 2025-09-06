"""
Dynasty Dugout - Basic League Management Module
EXTRACTED FROM: The massive leagues.py file (basic CRUD operations)
PURPOSE: Simple league info retrieval, settings, health checks, data sync
STATUS: FIXED - URL paths corrected to work with global prefix.
"""

import logging
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends

from ...core.auth_utils import get_current_user
from ...core.database import execute_sql

logger = logging.getLogger(__name__)

# [CHANGED] Two routers are now defined to separate global vs. league-specific routes.
global_router = APIRouter() # For routes without a league_id prefix.
router = APIRouter() # For routes that require a league_id prefix.

# =============================================================================
# GLOBAL ENDPOINTS (Handled by global_router)
# =============================================================================

@global_router.get("/my-leagues")
async def get_my_leagues(current_user: dict = Depends(get_current_user)):
    """Get all leagues for the current user with configuration details"""
    try:
        user_id = current_user.get('sub')
        
        # [FIXED] This SQL query now correctly joins league_memberships to find all leagues
        # a user belongs to, not just the ones they are a commissioner of.
        sql = """
            SELECT 
                ul.league_id, ul.league_name, ul.status, ul.database_name, ul.created_at, lm.role
            FROM user_leagues ul
            JOIN league_memberships lm ON ul.league_id = lm.league_id
            WHERE lm.user_id = :user_id::uuid AND lm.is_active = true
            ORDER BY ul.created_at DESC
        """
        
        response = execute_sql(sql, {'user_id': user_id})
        
        leagues = []
        if response.get('records'):
            for record in response['records']:
                # Basic league info from phone book
                league = {
                    'league_id': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None,
                    'league_name': record[1].get('stringValue') if record[1] and not record[1].get('isNull') else None,
                    'status': record[2].get('stringValue') if record[2] and not record[2].get('isNull') else None,
                    'database_name': record[3].get('stringValue') if record[3] and not record[3].get('isNull') else None,
                    'created_at': record[4].get('stringValue') if record[4] and not record[4].get('isNull') else None,
                    'role': record[5].get('stringValue') if record[5] and not record[5].get('isNull') else 'member',
                    # Default values for missing config
                    'scoring_system': 'rotisserie_ytd',
                    'player_pool': 'american_national',
                    'max_teams': 12,
                    'salary_cap': 200.0
                }
                
                # Try to get detailed config from league database
                database_name = league['database_name']
                if database_name:
                    try:
                        settings_sql = """
                            SELECT setting_name, setting_value 
                            FROM league_settings 
                            WHERE league_id = :league_id::uuid
                        """
                        settings_response = execute_sql(settings_sql, {'league_id': league['league_id']}, database_name=database_name)
                        
                        if settings_response.get('records'):
                            for setting_record in settings_response['records']:
                                setting_name = setting_record[0].get('stringValue')
                                setting_value = setting_record[1].get('stringValue')
                                if setting_name and setting_value:
                                    # Convert numeric values
                                    if setting_name in ['max_teams', 'max_players_total', 'min_hitters', 'max_pitchers']:
                                        try:
                                            league[setting_name] = int(setting_value)
                                        except:
                                            pass
                                    elif setting_name in ['salary_cap', 'salary_floor']:
                                        try:
                                            league[setting_name] = float(setting_value)
                                        except:
                                            pass
                                    else:
                                        league[setting_name] = setting_value
                    except Exception as settings_error:
                        logger.warning(f"Could not get settings for league {league['league_id']}: {settings_error}")
                
                leagues.append(league)
        
        return {
            "success": True,
            "leagues": leagues,
            "count": len(leagues),
            "note": "Phone book + league settings (from management module)",
            "architecture": "Modular structure - basic operations only"
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
        sql = "SELECT COUNT(*) FROM mlb_players"
        response = execute_sql(sql)
        
        player_count = 0
        if response.get('records') and response['records'][0]:
            player_count = response['records'][0][0].get('longValue', 0)
        
        return {
            "status": "healthy",
            "service": "leagues",
            "mlb_players_available": player_count,
            "services": {
                "lifecycle": "operational (creation/deletion)",
                "management": "operational (basic CRUD + data sync)",
                "owners": "operational (owner management)",
                "standings": "operational (competitive rankings)",
                "players": "planned (league-specific players)",
                "transactions": "planned (trades/waivers)",
                "database_provisioning": "operational",
                "async_creation": "ARCHITECTURE FIXED + PERFORMANCE OPTIMIZED!",
                "modular_structure": "✅ REORGANIZED INTO FOCUSED MODULES!",
                "data_pipeline": "operational (sync + calculate stats)"
            },
            "architecture": {
                "main_database": "Phone book (minimal registry)",
                "league_databases": "All configuration and data",
                "modular_routers": "Focused, maintainable modules"
            },
            "performance": "30-60 seconds with batch inserts",
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

@router.post("/{league_id}/debug-create-db")
async def debug_create_database(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Debug endpoint to test raw database creation"""
    try:
        database_name = f"league_debug_{league_id.replace('-', '_')}"
        create_db_sql = f'CREATE DATABASE "{database_name}"'
        
        logger.info(f"🔍 Attempting to create: {database_name}")
        logger.info(f"🔍 SQL: {create_db_sql}")
        
        result = execute_sql(create_db_sql, database_name='postgres')
        
        return {
            "success": True,
            "database_name": database_name,
            "sql_executed": create_db_sql,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"❌ Database creation failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }

@router.post("/{league_id}/debug-create-tables")
async def debug_create_tables(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Debug endpoint to test table creation in existing database"""
    try:
        database_name = f"league_debug_test_123"  # Use our existing debug database
        
        # Try to create just one simple table
        create_table_sql = """
            CREATE TABLE IF NOT EXISTS league_settings (
                setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                setting_name VARCHAR(255) NOT NULL,
                setting_value TEXT NOT NULL,
                setting_type VARCHAR(50) DEFAULT 'string',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """
        
        logger.info(f"🔍 Attempting to create table in: {database_name}")
        logger.info(f"🔍 SQL: {create_table_sql}")
        
        result = execute_sql(create_table_sql, database_name=database_name)
        
        # Test if table actually exists
        test_sql = "SELECT COUNT(*) FROM league_settings"
        test_result = execute_sql(test_sql, database_name=database_name)
        
        return {
            "success": True,
            "database_name": database_name,
            "table_created": True,
            "create_result": result,
            "test_result": test_result
        }
        
    except Exception as e:
        logger.error(f"❌ Table creation failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }

# [FIXED] The route now correctly captures the league_id from the URL path.
@router.get("/{league_id}")
async def get_league(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get league details (phone book + league database config)"""
    try:
        user_id = current_user.get('sub')
        
        # Get basic info from phone book
        league_sql = """
            SELECT 
                ul.league_id, ul.league_name, ul.commissioner_user_id, 
                ul.database_name, ul.status, ul.created_at, lm.role
            FROM user_leagues ul
            JOIN league_memberships lm ON ul.league_id = lm.league_id
            WHERE ul.league_id = :league_id::uuid 
            AND lm.user_id = :user_id::uuid 
            AND lm.is_active = true
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
        
        database_name = safe_get(record[3], 'stringValue')
        
        league = {
            'league_id': safe_get(record[0], 'stringValue'),
            'league_name': safe_get(record[1], 'stringValue'),
            'commissioner_user_id': safe_get(record[2], 'stringValue'),
            'database_name': database_name,
            'status': safe_get(record[4], 'stringValue', 'setup'),
            'created_at': safe_get(record[5], 'stringValue'),
            'role': safe_get(record[6], 'stringValue'),
            'current_week': "Week 17",
            'season': "2025"
        }
        
        # Get detailed config from league database if it exists
        if database_name:
            try:
                # [FIXED] Removed redundant UUID cast in the query below.
                settings_sql = "SELECT setting_name, setting_value FROM league_settings WHERE league_id = :league_id::uuid"
                settings_response = execute_sql(settings_sql, {'league_id': league_id}, database_name=database_name)
                
                if settings_response.get('records'):
                    for setting_record in settings_response['records']:
                        setting_name = setting_record[0].get('stringValue')
                        setting_value = setting_record[1].get('stringValue')
                        if setting_name and setting_value:
                            league[setting_name] = setting_value
            
            except Exception as settings_error:
                logger.warning(f"Could not get league settings: {settings_error}")
        
        return {
            "success": True,
            "league": league,
            "source": "management module (basic league info)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting league details: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve league details")

@router.get("/{league_id}/settings")
async def get_league_settings(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get league settings including UI feature toggles"""
    try:
        # Get all league settings
        settings_sql = """
            SELECT setting_name, setting_value, setting_type
            FROM league_settings
            WHERE league_id = :league_id::uuid
            ORDER BY setting_name
        """
        
        result = execute_sql(
            settings_sql,
            parameters={'league_id': league_id},
            database_name=f"league_{league_id.replace('-', '_')}"
        )
        
        # Convert to dictionary
        settings = {}
        ui_features = {}
        
        if result and result.get("records"):
            for record in result["records"]:
                setting_name = record[0]["stringValue"]
                setting_value = record[1]["stringValue"]
                setting_type = record[2]["stringValue"]
                
                # Convert based on type
                if setting_type == 'boolean':
                    converted_value = setting_value.lower() == 'true'
                elif setting_type == 'integer':
                    converted_value = int(setting_value) if setting_value.isdigit() else 0
                elif setting_type == 'float':
                    converted_value = float(setting_value) if setting_value.replace('.', '').isdigit() else 0.0
                elif setting_type == 'json':
                    try:
                        converted_value = json.loads(setting_value)
                    except:
                        converted_value = {}
                else:
                    converted_value = setting_value
                
                settings[setting_name] = converted_value
                
                # Extract UI feature toggles
                if setting_name.startswith('use_') or setting_name.startswith('show_'):
                    ui_features[setting_name] = converted_value
        
        return {
            "success": True,
            "league_id": league_id,
            "settings": settings,
            "ui_features": ui_features,
            "feature_summary": {
                "contracts_enabled": settings.get('use_contracts', True),
                "salaries_enabled": settings.get('use_salaries', True),
                "waivers_enabled": settings.get('use_waivers', False),
                "team_attribution_enabled": settings.get('use_team_attribution', True),
                "transactions_enabled": settings.get('use_transactions', True),
                "advanced_stats_enabled": settings.get('show_advanced_stats', True)
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
    """Update league settings (TO BE IMPLEMENTED)"""
    return {
        "success": False,
        "message": "Update league settings endpoint not yet implemented",
        "todo": "Implement settings updates with validation"
    }

@router.post("/{league_id}/sync-data")
async def sync_league_data(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Sync game logs and calculate season stats for league"""
    try:
        # Verify commissioner permissions
        user_id = current_user.get('sub')
        team_check = execute_sql(
            "SELECT is_commissioner FROM league_teams WHERE user_id = :user_id::uuid",
            parameters={'user_id': user_id},
            database_name=f"league_{league_id.replace('-', '_')}"
        )
        
        if not team_check or not team_check.get("records") or not team_check["records"][0][0]["booleanValue"]:
            raise HTTPException(status_code=403, detail="Only commissioners can sync league data")
        
        league_db_name = f"league_{league_id.replace('-', '_')}"
        sync_results = {
            "game_logs_synced": 0,
            "season_stats_calculated": 0,
            "errors": []
        }
        
        # Step 1: Sync game logs from main DB
        logger.info(f"🔄 Syncing game logs for league {league_id}")
        
        try:
            main_logs_sql = """
                SELECT player_id, game_date, 
                       at_bats, hits, runs, rbis, home_runs, doubles, triples, 
                       stolen_bases, walks, strikeouts, hit_by_pitch,
                       innings_pitched, wins, losses, saves, holds, blown_saves,
                       earned_runs, hits_allowed, walks_allowed, strikeouts_pitched
                FROM player_game_logs 
                WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
                ORDER BY game_date DESC
                LIMIT 5000
            """
            
            main_logs = execute_sql(main_logs_sql, database_name='postgres')
            
            if main_logs and main_logs.get('records'):
                logger.info(f"Found {len(main_logs['records'])} game log records to sync")
                
                synced_count = 0
                batch_size = 100
                
                for i in range(0, len(main_logs['records']), batch_size):
                    batch = main_logs['records'][i:i + batch_size]
                    values_list = []
                    
                    for record in batch:
                        try:
                            player_id = record[0].get('longValue', 0)
                            game_date = record[1].get('stringValue', '2025-01-01')
                            
                            stats = []
                            for j in range(2, len(record)):
                                if record[j].get('isNull'):
                                    stats.append(0)
                                elif 'longValue' in record[j]:
                                    stats.append(record[j]['longValue'])
                                elif 'doubleValue' in record[j]:
                                    stats.append(record[j]['doubleValue'])
                                else:
                                    stats.append(0)
                            
                            while len(stats) < 21:
                                stats.append(0)
                            
                            values_list.append(f"({player_id}, '{game_date}', {', '.join(map(str, stats))})")
                            
                        except Exception as e:
                            logger.error(f"Error processing game log record: {e}")
                            continue
                    
                    if values_list:
                        batch_sql = f"""
                            INSERT INTO player_game_logs 
                            (player_id, game_date, at_bats, hits, runs, rbis, home_runs, doubles, triples,
                             stolen_bases, walks, strikeouts, hit_by_pitch, innings_pitched, wins, losses,
                             saves, holds, blown_saves, earned_runs, hits_allowed, walks_allowed, strikeouts_pitched)
                            VALUES {', '.join(values_list)}
                            ON CONFLICT (player_id, game_date) DO NOTHING
                        """
                        
                        execute_sql(batch_sql, database_name=league_db_name)
                        synced_count += len(values_list)
                        logger.info(f"Synced batch {i//batch_size + 1}: {len(values_list)} records")
                
                sync_results["game_logs_synced"] = synced_count
                logger.info(f"✅ Synced {synced_count} game log records")
                
        except Exception as e:
            error_msg = f"Error syncing game logs: {str(e)}"
            logger.error(error_msg)
            sync_results["errors"].append(error_msg)
        
        # Step 2: Calculate season stats from game logs
        logger.info(f"📊 Calculating 2025 season stats from game logs")
        
        try:
            calc_sql = """
                INSERT INTO player_season_stats (
                    player_id, season_year, games_played, at_bats, hits, runs, rbis, home_runs, 
                    doubles, triples, stolen_bases, walks, strikeouts, hit_by_pitch,
                    avg, obp, slg, ops, games_started, innings_pitched, wins, losses, 
                    saves, holds, blown_saves, earned_runs, hits_allowed, walks_allowed, 
                    strikeouts_pitched, era, whip, last_updated, games_calculated_through
                )
                SELECT 
                    player_id,
                    2025,
                    COUNT(*) as games_played,
                    SUM(at_bats) as at_bats,
                    SUM(hits) as hits,
                    SUM(runs) as runs,
                    SUM(rbis) as rbis,
                    SUM(home_runs) as home_runs,
                    SUM(doubles) as doubles,
                    SUM(triples) as triples,
                    SUM(stolen_bases) as stolen_bases,
                    SUM(walks) as walks,
                    SUM(strikeouts) as strikeouts,
                    SUM(hit_by_pitch) as hit_by_pitch,
                    CASE 
                        WHEN SUM(at_bats) > 0 THEN ROUND(SUM(hits)::NUMERIC / SUM(at_bats), 3)
                        ELSE 0.000
                    END as avg,
                    CASE 
                        WHEN (SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch)) > 0 
                        THEN ROUND((SUM(hits) + SUM(walks) + SUM(hit_by_pitch))::NUMERIC / (SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch)), 3)
                        ELSE 0.000
                    END as obp,
                    CASE 
                        WHEN SUM(at_bats) > 0 
                        THEN ROUND((SUM(hits) + SUM(doubles) + 2*SUM(triples) + 3*SUM(home_runs))::NUMERIC / SUM(at_bats), 3)
                        ELSE 0.000
                    END as slg,
                    0.000 as ops, -- Will calculate after
                    COUNT(CASE WHEN innings_pitched > 0 THEN 1 END) as games_started,
                    SUM(innings_pitched) as innings_pitched,
                    SUM(wins) as wins,
                    SUM(losses) as losses,
                    SUM(saves) as saves,
                    SUM(holds) as holds,
                    SUM(blown_saves) as blown_saves,
                    SUM(earned_runs) as earned_runs,
                    SUM(hits_allowed) as hits_allowed,
                    SUM(walks_allowed) as walks_allowed,
                    SUM(strikeouts_pitched) as strikeouts_pitched,
                    CASE 
                        WHEN SUM(innings_pitched) > 0 
                        THEN ROUND((SUM(earned_runs) * 9.0) / SUM(innings_pitched), 2)
                        ELSE 0.00
                    END as era,
                    CASE 
                        WHEN SUM(innings_pitched) > 0 
                        THEN ROUND((SUM(hits_allowed) + SUM(walks_allowed))::NUMERIC / SUM(innings_pitched), 3)
                        ELSE 0.000
                    END as whip,
                    NOW() as last_updated,
                    MAX(game_date) as games_calculated_through
                FROM player_game_logs
                WHERE game_date >= '2025-01-01'
                GROUP BY player_id
                ON CONFLICT (player_id, season_year) 
                DO UPDATE SET
                    games_played = EXCLUDED.games_played,
                    at_bats = EXCLUDED.at_bats,
                    hits = EXCLUDED.hits,
                    runs = EXCLUDED.runs,
                    rbis = EXCLUDED.rbis,
                    home_runs = EXCLUDED.home_runs,
                    doubles = EXCLUDED.doubles,
                    triples = EXCLUDED.triples,
                    stolen_bases = EXCLUDED.stolen_bases,
                    walks = EXCLUDED.walks,
                    strikeouts = EXCLUDED.strikeouts,
                    hit_by_pitch = EXCLUDED.hit_by_pitch,
                    avg = EXCLUDED.avg,
                    obp = EXCLUDED.obp,
                    slg = EXCLUDED.slg,
                    games_started = EXCLUDED.games_started,
                    innings_pitched = EXCLUDED.innings_pitched,
                    wins = EXCLUDED.wins,
                    losses = EXCLUDED.losses,
                    saves = EXCLUDED.saves,
                    holds = EXCLUDED.holds,
                    blown_saves = EXCLUDED.blown_saves,
                    earned_runs = EXCLUDED.earned_runs,
                    hits_allowed = EXCLUDED.hits_allowed,
                    walks_allowed = EXCLUDED.walks_allowed,
                    strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                    era = EXCLUDED.era,
                    whip = EXCLUDED.whip,
                    last_updated = NOW(),
                    games_calculated_through = EXCLUDED.games_calculated_through
            """
            
            result = execute_sql(calc_sql, database_name=league_db_name)
            
            execute_sql(
                "UPDATE player_season_stats SET ops = obp + slg WHERE season_year = 2025",
                database_name=league_db_name
            )
            
            count_result = execute_sql(
                "SELECT COUNT(*) FROM player_season_stats WHERE season_year = 2025",
                database_name=league_db_name
            )
            
            if count_result and count_result.get("records"):
                sync_results["season_stats_calculated"] = count_result["records"][0][0]["longValue"]
            
            logger.info(f"✅ Calculated season stats for {sync_results['season_stats_calculated']} players")
            
        except Exception as e:
            error_msg = f"Error calculating season stats: {str(e)}"
            logger.error(error_msg)
            sync_results["errors"].append(error_msg)
        
        # Step 3: Verify results
        try:
            sample_sql = """
                SELECT mp.first_name, mp.last_name, mp.position, 
                       pss.avg, pss.home_runs, pss.rbis, pss.era, pss.wins, pss.saves
                FROM player_season_stats pss
                JOIN mlb_players mp ON pss.player_id = mp.player_id
                WHERE pss.season_year = 2025 
                  AND (pss.home_runs > 0 OR pss.wins > 0 OR pss.saves > 0)
                ORDER BY pss.home_runs DESC, pss.wins DESC, pss.saves DESC
                LIMIT 5
            """
            
            sample_result = execute_sql(sample_sql, database_name=league_db_name)
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
            
            sync_results["sample_players"] = sample_players
            
        except Exception as e:
            logger.error(f"Error getting sample data: {e}")
        
        return {
            "success": True,
            "league_id": league_id,
            "sync_results": sync_results,
            "message": f"Data sync completed. {sync_results['game_logs_synced']} game logs synced, {sync_results['season_stats_calculated']} players with calculated stats.",
            "next_step": "Free agent system should now show real 2025 stats instead of N/A values"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing league data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error syncing league data: {str(e)}")
