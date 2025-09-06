"""
Dynasty Dugout - League Salary Management Module
PURPOSE: Handle salary caps, player pricing, and contract settings
INCLUDES: Pricing data endpoint that pulls from CACHED league-specific stats
STATUS: Updated for shared database architecture with CACHED stats
UPDATED: Separate price (calculated) from salary (contracted)
ASYNC: Added async save support for large datasets
OPTIMIZED: Batch operations for fast saves
"""

import logging
import json
import boto3
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import uuid4
import asyncio
from concurrent.futures import ThreadPoolExecutor
import traceback

from core.auth_utils import get_current_user
from core.database import execute_sql, batch_execute_sql, execute_transaction
from core.season_utils import CURRENT_SEASON

logger = logging.getLogger(__name__)
router = APIRouter()

# Thread pool for background tasks
executor = ThreadPoolExecutor(max_workers=3)

# Lambda client for invoking background jobs (if in AWS)
lambda_client = None
if os.environ.get('AWS_REGION'):
    lambda_client = boto3.client('lambda', region_name=os.environ.get('AWS_REGION'))

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class SalarySettings(BaseModel):
    use_dual_cap: bool = True
    draft_cap: float = 600.0
    season_cap: float = 200.0
    total_cap: float = 800.0
    salary_cap: float = 800.0
    min_salary: float = 2.0
    salary_increment: float = 2.0
    rookie_price: float = 20.0
    standard_contract_length: int = 2
    draft_cap_usage: float = 0.75
    extension_rules: List[Dict] = []
    pricing_method: Optional[str] = "adaptive"

class PlayerPrice(BaseModel):
    player_id: int
    price: float  # The calculated/generated price
    salary: Optional[float] = None  # The actual contract amount (can differ from price)
    tier: Optional[str] = None
    manual_override: Optional[bool] = False
    contract_years: Optional[int] = None  # How many years left on contract

class SavePricesRequest(BaseModel):
    settings: SalarySettings
    prices: List[PlayerPrice]
    method: str = "adaptive"

class SavePricesAsyncRequest(BaseModel):
    settings: SalarySettings
    prices: List[PlayerPrice]
    method: str = "adaptive"
    job_id: Optional[str] = None

class PriceSaveJobStatus(BaseModel):
    job_id: str
    status: str  # 'pending', 'processing', 'completed', 'failed'
    progress: int  # 0-100
    total_players: int
    processed_players: int
    message: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str

class TeamSalaryInfo(BaseModel):
    team_id: str
    team_name: str
    total_salary: float
    salary_cap_used: float
    draft_cap_used: float
    season_cap_used: float
    cap_space_available: float
    player_count: int
    average_salary: float

class PlayerContract(BaseModel):
    league_player_id: str
    player_id: int
    player_name: str
    position: str
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    salary: float
    contract_years: int
    acquisition_method: Optional[str] = None
    acquisition_date: Optional[str] = None

class ContractExtension(BaseModel):
    league_player_id: str
    new_salary: float
    new_years: int
    extension_type: str  # 'standard', 'franchise', 'rookie'

class BulkContractUpdate(BaseModel):
    contracts: List[PlayerContract]
    update_type: str  # 'salary', 'years', 'both'

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def verify_commissioner(league_id: str, user_id: str) -> bool:
    """Verify user is commissioner of the league"""
    try:
        result = execute_sql(
            "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid",
            {'league_id': league_id},
            database_name='postgres'
        )
        if result and result.get('records'):
            commissioner_id = result['records'][0][0].get('stringValue')
            return commissioner_id == user_id
        return False
    except Exception as e:
        logger.error(f"Error verifying commissioner: {e}")
        return False

async def validate_league_membership(league_id: str, user_id: str) -> bool:
    """Check if user is a member of this league"""
    try:
        membership_check = execute_sql(
            "SELECT user_id FROM league_memberships WHERE league_id = :league_id::uuid AND user_id = :user_id",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='postgres'
        )
        if membership_check and membership_check.get("records") and len(membership_check["records"]) > 0:
            return True
        return False
    except Exception as e:
        logger.error(f"League membership validation error: {str(e)}")
        return False

def map_category_to_columns(category: str, is_pitcher: bool = False) -> List[str]:
    """
    Map a scoring category to the database columns needed to calculate it
    Returns a list of column names required for this category
    """
    cat_lower = category.lower()
    
    # Pitcher-specific mappings
    if is_pitcher:
        pitcher_map = {
            'w': ['wins'],
            'wins': ['wins'],
            'l': ['losses'],
            'losses': ['losses'],
            'qs': ['quality_starts'],
            'quality_starts': ['quality_starts'],
            's': ['saves'],
            'saves': ['saves'],
            'sv': ['saves'],
            'bs': ['blown_saves'],
            'blown_saves': ['blown_saves'],
            'holds': ['holds'],
            'h': ['holds'],
            'k': ['strikeouts_pitched'],
            'strikeouts': ['strikeouts_pitched'],
            'strikeouts_pitched': ['strikeouts_pitched'],
            'so': ['strikeouts_pitched'],
            'era': ['era', 'innings_pitched', 'earned_runs'],
            'whip': ['whip', 'innings_pitched', 'hits_allowed', 'walks_allowed'],
            'k/9': ['strikeouts_pitched', 'innings_pitched'],
            'bb/9': ['walks_allowed', 'innings_pitched'],
            'hr/9': ['home_runs_allowed', 'innings_pitched'],
            'games': ['games_played'],
            'games_started': ['games_started'],
            'gs': ['games_started'],
            'ip': ['innings_pitched'],
            'innings_pitched': ['innings_pitched'],
            'innings': ['innings_pitched']
        }
        return pitcher_map.get(cat_lower, [cat_lower])
    
    # Hitter mappings
    hitter_map = {
        'r': ['runs'],
        'runs': ['runs'],
        'rbi': ['rbi'],
        'hr': ['home_runs'],
        'home_runs': ['home_runs'],
        'homers': ['home_runs'],
        'sb': ['stolen_bases'],
        'stolen_bases': ['stolen_bases'],
        'steals': ['stolen_bases'],
        'cs': ['caught_stealing'],
        'caught_stealing': ['caught_stealing'],
        'avg': ['batting_avg', 'hits', 'at_bats'],
        'batting_avg': ['batting_avg', 'hits', 'at_bats'],
        'ba': ['batting_avg', 'hits', 'at_bats'],
        'ops': ['ops', 'obp', 'slg'],
        'obp': ['obp', 'hits', 'walks', 'hit_by_pitch', 'at_bats'],
        'on_base_percentage': ['obp', 'hits', 'walks', 'hit_by_pitch', 'at_bats'],
        'slg': ['slg', 'hits', 'doubles', 'triples', 'home_runs', 'at_bats'],
        'slugging': ['slg', 'hits', 'doubles', 'triples', 'home_runs', 'at_bats'],
        'slugging_percentage': ['slg', 'hits', 'doubles', 'triples', 'home_runs', 'at_bats'],
        'hits': ['hits'],
        'h': ['hits'],
        'doubles': ['doubles'],
        '2b': ['doubles'],
        'triples': ['triples'],
        '3b': ['triples'],
        'walks': ['walks'],
        'bb': ['walks'],
        'strikeouts': ['strikeouts'],
        'so': ['strikeouts'],
        'k': ['strikeouts'],
        'games': ['games_played'],
        'games_played': ['games_played'],
        'g': ['games_played'],
        'ab': ['at_bats'],
        'at_bats': ['at_bats'],
        'total_bases': ['hits', 'doubles', 'triples', 'home_runs']
    }
    
    return hitter_map.get(cat_lower, [cat_lower])

def get_required_columns_for_categories(categories: List[str], is_pitcher: bool = False) -> List[str]:
    """Get all unique database columns needed for a list of scoring categories"""
    required_columns = set()
    
    # Always include some base columns
    required_columns.add('games_played')
    
    if is_pitcher:
        required_columns.add('games_started')
        required_columns.add('innings_pitched')  # CRITICAL: Always include for pitchers
    else:
        required_columns.add('at_bats')
    
    # Add columns for each category
    for category in categories:
        columns = map_category_to_columns(category, is_pitcher)
        required_columns.update(columns)
    
    return list(required_columns)

def ensure_price_jobs_table():
    """Ensure the price save jobs table exists"""
    try:
        logger.info("Ensuring price_save_jobs table exists...")
        execute_sql("""
            CREATE TABLE IF NOT EXISTS price_save_jobs (
                job_id UUID PRIMARY KEY,
                league_id UUID NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                total_players INTEGER DEFAULT 0,
                processed_players INTEGER DEFAULT 0,
                message TEXT,
                error_message TEXT,
                settings JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """, database_name='postgres')
        logger.info("price_save_jobs table check completed")
    except Exception as e:
        logger.error(f"Could not create price_save_jobs table: {e}")
        logger.error(traceback.format_exc())
        raise  # Re-raise the exception so it fails loudly

# Initialize table on module load
ensure_price_jobs_table()

# =============================================================================
# PRICING DATA ENDPOINT - USES CACHED STATS FROM LEAGUES DB
# =============================================================================

@router.get("/pricing-data")
async def get_pricing_data(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get ALL MLB players with stats from CACHED league database
    Stats are pre-calculated and stored in leagues DB for performance
    """
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        logger.info(f"Getting pricing data for league {league_id}")
        
        # Validate membership
        if not await validate_league_membership(league_id, user_id):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # Get current MLB year dynamically
        current_year = CURRENT_SEASON
        years = [current_year, current_year - 1, current_year - 2]
        
        # Get league's scoring categories from shared database
        categories_query = """
            SELECT setting_value 
            FROM league_settings 
            WHERE league_id = :league_id::uuid 
            AND setting_name = 'scoring_categories'
        """
        
        categories_result = execute_sql(
            categories_query,
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Parse the league's specific categories
        hitting_categories = []
        pitching_categories = []
        
        if categories_result and categories_result.get('records'):
            setting_value = categories_result['records'][0][0].get('stringValue') if categories_result['records'][0][0] else None
            
            if setting_value:
                try:
                    categories_json = json.loads(setting_value)
                    hitting_categories = [c.lower() for c in categories_json.get('hitters', [])]
                    pitching_categories = [c.lower() for c in categories_json.get('pitchers', [])]
                except Exception as e:
                    logger.error(f"Error parsing scoring_categories: {e}")
        
        # If no categories found, this league isn't properly configured
        if not hitting_categories and not pitching_categories:
            logger.error(f"League {league_id} has no scoring categories configured!")
            raise HTTPException(status_code=500, detail="League scoring categories not configured")
        
        logger.info(f"League {league_id} categories - Hitting: {hitting_categories}, Pitching: {pitching_categories}")
        
        # Determine which database columns we need based on the categories
        required_hitting_columns = get_required_columns_for_categories(hitting_categories, is_pitcher=False)
        required_pitching_columns = get_required_columns_for_categories(pitching_categories, is_pitcher=True)
        
        # Get all unique columns needed (combination of hitting and pitching)
        all_required_columns = list(set(required_hitting_columns + required_pitching_columns))
        
        logger.info(f"All required columns: {all_required_columns}")
        logger.info(f"Pitcher columns specifically: {required_pitching_columns}")
        
        # Build the query for players
        players_data = {}
        
        # Get all active players from main database
        players_query = """
            SELECT 
                player_id,
                first_name,
                last_name,
                position,
                mlb_team
            FROM mlb_players
            WHERE is_active = true
            ORDER BY player_id
        """
        
        players_result = execute_sql(players_query, database_name='postgres')
        
        if players_result and players_result.get('records'):
            for record in players_result['records']:
                player_id = record[0].get('longValue')
                position = record[3].get('stringValue', '')
                
                players_data[player_id] = {
                    'player_id': player_id,
                    'player_name': f"{record[1].get('stringValue', '')} {record[2].get('stringValue', '')}".strip(),
                    'first_name': record[1].get('stringValue', ''),
                    'last_name': record[2].get('stringValue', ''),
                    'position': position,
                    'mlb_team': record[4].get('stringValue', 'FA'),
                    'stats_current': {},
                    'stats_prior': {},
                    'stats_two_years_ago': {}
                }
        
        # BATCH QUERY: Get stats for ALL players for each year from CACHED LEAGUES DB
        for year in years:
            logger.info(f"Fetching stats for year {year} from main DB...")
            
            # Build dynamic column list based on what the league needs
            # Always include player_id first
            columns_to_query = ['player_id'] + all_required_columns
            select_columns = ', '.join([f'pss.{col}' for col in columns_to_query])
            
            # Get ALL player stats for this year from main database
            stats_query = f"""
                SELECT {select_columns}
                FROM player_season_stats pss
                WHERE pss.season = {year}
                AND pss.player_id IN (
                    SELECT player_id FROM mlb_players WHERE is_active = true
                )
            """
            
            stats_result = execute_sql(
                stats_query, 
                {},
                database_name='postgres'  # HISTORICAL STATS FROM MAIN DB
            )
            
            if stats_result and stats_result.get('records'):
                for record in stats_result['records']:
                    player_id = record[0].get('longValue')
                    
                    if player_id in players_data:
                        year_stats = {}
                        
                        # Process each column we queried - FIXED to handle all value types
                        for idx, col_name in enumerate(columns_to_query):
                            if idx == 0:  # Skip player_id
                                continue
                            
                            if record[idx]:
                                # Check all possible value types
                                if record[idx].get('longValue') is not None:
                                    year_stats[col_name] = record[idx].get('longValue')
                                elif record[idx].get('doubleValue') is not None:
                                    year_stats[col_name] = record[idx].get('doubleValue')
                                elif record[idx].get('stringValue') is not None:
                                    # Handle numeric strings like "150.5" for innings_pitched
                                    str_val = record[idx].get('stringValue')
                                    try:
                                        if '.' in str_val:
                                            year_stats[col_name] = float(str_val)
                                        else:
                                            year_stats[col_name] = int(str_val)
                                    except (ValueError, TypeError):
                                        # If not numeric, store as string
                                        year_stats[col_name] = str_val
                                else:
                                    year_stats[col_name] = 0
                            else:
                                year_stats[col_name] = 0
                        
                        # Add common aliases
                        if 'at_bats' in year_stats:
                            year_stats['ab'] = year_stats['at_bats']
                        if 'innings_pitched' in year_stats:
                            year_stats['ip'] = year_stats['innings_pitched']
                        if 'games_started' in year_stats:
                            year_stats['gs'] = year_stats['games_started']
                        if 'home_runs' in year_stats:
                            year_stats['hr'] = year_stats['home_runs']
                        if 'stolen_bases' in year_stats:
                            year_stats['sb'] = year_stats['stolen_bases']
                        if 'batting_avg' in year_stats:
                            year_stats['avg'] = year_stats['batting_avg']
                        if 'strikeouts_pitched' in year_stats:
                            year_stats['k'] = year_stats['strikeouts_pitched']
                        if 'saves' in year_stats:
                            year_stats['s'] = year_stats['saves']
                            year_stats['sv'] = year_stats['saves']
                        if 'wins' in year_stats:
                            year_stats['w'] = year_stats['wins']
                        if 'quality_starts' in year_stats:
                            year_stats['qs'] = year_stats['quality_starts']
                        if 'runs' in year_stats:
                            year_stats['r'] = year_stats['runs']
                        
                        # Filter stats based on player position
                        player_position = players_data[player_id]['position'].upper()
                        is_ohtani = 'ohtani' in players_data[player_id]['player_name'].lower()
                        is_pitcher = player_position in ['P', 'SP', 'RP', 'CP', 'CL', 'MR'] and not is_ohtani
                        
                        # If not Ohtani, filter out irrelevant stats
                        if not is_ohtani:
                            if is_pitcher:
                                # Keep only pitching stats
                                filtered_stats = {}
                                for key in year_stats:
                                    if key in required_pitching_columns or key in ['gs', 'ip', 'k', 's', 'sv', 'w', 'qs']:
                                        filtered_stats[key] = year_stats[key]
                                year_stats = filtered_stats
                            else:
                                # Keep only hitting stats
                                filtered_stats = {}
                                for key in year_stats:
                                    if key in required_hitting_columns or key in ['ab', 'hr', 'sb', 'avg', 'r']:
                                        filtered_stats[key] = year_stats[key]
                                year_stats = filtered_stats
                        
                        # Use relative keys instead of hardcoded years
                        if year == current_year:
                            players_data[player_id]['stats_current'] = year_stats
                        elif year == current_year - 1:
                            players_data[player_id]['stats_prior'] = year_stats
                        elif year == current_year - 2:
                            players_data[player_id]['stats_two_years_ago'] = year_stats
            
            logger.info(f"Processed {len(stats_result.get('records', []))} player stats for year {year}")
        
        # Convert to list
        players = list(players_data.values())
        
        logger.info(f"Returning {len(players)} players with league-specific stats")
        
        return {
            "success": True,
            "players": players,
            "total_count": len(players),
            "years": years,
            "scoring_categories": {
                "hitting": hitting_categories,
                "pitching": pitching_categories
            },
            "source": "postgres_main_db",
            "note": "Stats from main postgres database"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pricing data: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to get pricing data: {str(e)}")

# =============================================================================
# SALARY SETTINGS ENDPOINTS
# =============================================================================

@router.get("/{league_id}/salaries/settings")
async def get_salary_settings(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current salary cap and pricing settings for the league"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Validate membership
        if not await validate_league_membership(league_id, user_id):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # Get salary settings
        settings_query = """
            SELECT setting_name, setting_value
            FROM league_settings
            WHERE league_id = :league_id::uuid
            AND setting_name IN (
                'salary_cap', 'draft_cap', 'season_cap', 
                'min_salary', 'salary_increment', 'rookie_price',
                'use_dual_cap', 'standard_contract_length',
                'draft_cap_usage', 'extension_rules', 'pricing_method'
            )
        """
        
        result = execute_sql(
            settings_query,
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        settings = SalarySettings()
        
        if result and result.get('records'):
            for record in result['records']:
                setting_name = record[0].get('stringValue')
                setting_value = record[1].get('stringValue')
                
                if setting_name == 'salary_cap':
                    settings.salary_cap = float(setting_value)
                    settings.total_cap = float(setting_value)
                elif setting_name == 'draft_cap':
                    settings.draft_cap = float(setting_value)
                elif setting_name == 'season_cap':
                    settings.season_cap = float(setting_value)
                elif setting_name == 'min_salary':
                    settings.min_salary = float(setting_value)
                elif setting_name == 'salary_increment':
                    settings.salary_increment = float(setting_value)
                elif setting_name == 'rookie_price':
                    settings.rookie_price = float(setting_value)
                elif setting_name == 'use_dual_cap':
                    settings.use_dual_cap = setting_value.lower() == 'true'
                elif setting_name == 'standard_contract_length':
                    settings.standard_contract_length = int(setting_value)
                elif setting_name == 'draft_cap_usage':
                    settings.draft_cap_usage = float(setting_value)
                elif setting_name == 'extension_rules':
                    try:
                        settings.extension_rules = json.loads(setting_value)
                    except:
                        settings.extension_rules = []
                elif setting_name == 'pricing_method':
                    settings.pricing_method = setting_value
        
        return {
            "success": True,
            "settings": settings.dict()
        }
        
    except Exception as e:
        logger.error(f"Error getting salary settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/settings")
async def update_salary_settings(
    league_id: str,
    settings: SalarySettings,
    current_user: dict = Depends(get_current_user)
):
    """Update salary cap and pricing settings (commissioner only) - OPTIMIZED with batch operations"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update salary settings")
        
        # Prepare batch parameters for all settings
        settings_params = []
        settings_to_update = [
            ('salary_cap', str(settings.salary_cap)),
            ('draft_cap', str(settings.draft_cap)),
            ('season_cap', str(settings.season_cap)),
            ('min_salary', str(settings.min_salary)),
            ('salary_increment', str(settings.salary_increment)),
            ('rookie_price', str(settings.rookie_price)),
            ('use_dual_cap', str(settings.use_dual_cap)),
            ('standard_contract_length', str(settings.standard_contract_length)),
            ('draft_cap_usage', str(settings.draft_cap_usage)),
            ('extension_rules', json.dumps(settings.extension_rules)),
            ('pricing_method', settings.pricing_method or 'adaptive')
        ]
        
        for setting_name, setting_value in settings_to_update:
            settings_params.append({
                'league_id': league_id,
                'setting_name': setting_name,
                'setting_value': setting_value
            })
        
        # Batch update all settings in one operation
        batch_execute_sql(
            """
            INSERT INTO league_settings (league_id, setting_name, setting_value, updated_at)
            VALUES (:league_id::uuid, :setting_name, :setting_value, NOW())
            ON CONFLICT (league_id, setting_name) 
            DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
            """,
            settings_params,
            database_name='leagues'
        )
        
        return {
            "success": True,
            "message": "Salary settings updated successfully",
            "settings": settings.dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating salary settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# PLAYER PRICING ENDPOINTS - OPTIMIZED WITH BATCH OPERATIONS
# =============================================================================

@router.get("/{league_id}/prices")
async def get_player_prices(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all player prices for the league"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Validate membership
        if not await validate_league_membership(league_id, user_id):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # Get player prices
        prices_query = """
            SELECT 
                pp.player_id,
                pp.price,
                pp.tier,
                pp.manual_override,
                pp.pricing_method,
                lp.salary,
                lp.contract_years
            FROM player_prices pp
            LEFT JOIN league_players lp 
                ON pp.player_id = lp.mlb_player_id 
                AND lp.league_id = pp.league_id
            WHERE pp.league_id = :league_id::uuid
            ORDER BY pp.price DESC
        """
        
        result = execute_sql(
            prices_query,
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        prices = []
        if result and result.get('records'):
            for record in result['records']:
                player_price = PlayerPrice(
                    player_id=record[0].get('longValue'),
                    price=float(record[1].get('stringValue') or record[1].get('doubleValue', 0)),
                    tier=record[2].get('stringValue'),
                    manual_override=record[3].get('booleanValue', False)
                )
                
                # Add actual salary if player is on a team
                if record[5]:
                    player_price.salary = float(record[5].get('stringValue') or record[5].get('doubleValue', 0))
                    player_price.contract_years = record[6].get('longValue')
                
                prices.append(player_price)
        
        return {
            "success": True,
            "prices": [p.dict() for p in prices],
            "total_count": len(prices)
        }
        
    except Exception as e:
        logger.error(f"Error getting player prices: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/prices")
async def save_player_prices(
    league_id: str,
    request: SavePricesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save player prices (commissioner only) - OPTIMIZED with batch operations"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update player prices")
        
        logger.info(f"Starting price save for {len(request.prices)} players in league {league_id}")
        
        # Update salary settings first (already optimized with batch)
        await update_salary_settings(league_id, request.settings, current_user)
        
        # Prepare batch parameters for all prices
        batch_params = []
        for player_price in request.prices:
            batch_params.append({
                'league_id': league_id,
                'player_id': player_price.player_id,
                'price': player_price.price,
                'tier': player_price.tier or '',
                'manual_override': player_price.manual_override or False,
                'pricing_method': request.method
            })
        
        # Single batch operation for all prices - THIS IS THE KEY OPTIMIZATION
        logger.info(f"Executing batch insert for {len(batch_params)} player prices")
        
        batch_execute_sql(
            """
            INSERT INTO player_prices (
                league_id, player_id, price, tier, 
                manual_override, pricing_method, updated_at
            ) VALUES (
                :league_id::uuid, :player_id, :price, :tier,
                :manual_override, :pricing_method, NOW()
            )
            ON CONFLICT (league_id, player_id)
            DO UPDATE SET 
                price = EXCLUDED.price,
                tier = EXCLUDED.tier,
                manual_override = EXCLUDED.manual_override,
                pricing_method = EXCLUDED.pricing_method,
                updated_at = NOW()
            """,
            batch_params,
            database_name='leagues'
        )
        
        logger.info(f"Successfully saved {len(request.prices)} player prices in batch operation")
        
        return {
            "success": True,
            "message": f"Saved {len(request.prices)} player prices",
            "saved_count": len(request.prices),
            "method": request.method
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving player prices: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# TEAM SALARY ENDPOINTS
# =============================================================================

@router.get("/{league_id}/teams")
async def get_all_team_salaries(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get salary information for all teams in the league"""
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

@router.get("/{league_id}/teams/{team_id}")
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
        
        # Get team info and contracts
        contracts_query = """
            SELECT 
                lp.league_player_id,
                lp.mlb_player_id,
                mp.first_name || ' ' || mp.last_name as player_name,
                mp.position,
                lt.team_id,
                lt.team_name,
                lp.salary,
                lp.contract_years,
                lp.acquisition_method,
                lp.acquisition_date
            FROM league_players lp
            JOIN postgres.mlb_players mp ON lp.mlb_player_id = mp.player_id
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

# =============================================================================
# CONTRACT MANAGEMENT ENDPOINTS - OPTIMIZED WITH BATCH OPERATIONS
# =============================================================================

@router.post("/{league_id}/contracts/update")
async def update_player_contract(
    league_id: str,
    contract: PlayerContract,
    current_user: dict = Depends(get_current_user)
):
    """Update a player's contract (commissioner only)"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update contracts")
        
        # Update contract
        execute_sql(
            """
            UPDATE league_players
            SET salary = :salary,
                contract_years = :contract_years,
                updated_at = NOW()
            WHERE league_id = :league_id::uuid
                AND league_player_id = :league_player_id::uuid
            """,
            {
                'league_id': league_id,
                'league_player_id': contract.league_player_id,
                'salary': contract.salary,
                'contract_years': contract.contract_years
            },
            database_name='leagues'  # SHARED DATABASE
        )
        
        return {
            "success": True,
            "message": "Contract updated successfully",
            "contract": contract.dict()
        }
        
    except Exception as e:
        logger.error(f"Error updating contract: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/contracts/bulk-update")
async def bulk_update_contracts(
    league_id: str,
    request: BulkContractUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Bulk update multiple player contracts (commissioner only) - OPTIMIZED with batch operations"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update contracts")
        
        # Prepare batch updates based on update type
        if request.update_type == 'salary':
            batch_params = [{
                'league_id': league_id,
                'league_player_id': contract.league_player_id,
                'salary': contract.salary
            } for contract in request.contracts]
            
            batch_execute_sql(
                """
                UPDATE league_players
                SET salary = :salary, updated_at = NOW()
                WHERE league_id = :league_id::uuid
                    AND league_player_id = :league_player_id::uuid
                """,
                batch_params,
                database_name='leagues'
            )
            
        elif request.update_type == 'years':
            batch_params = [{
                'league_id': league_id,
                'league_player_id': contract.league_player_id,
                'contract_years': contract.contract_years
            } for contract in request.contracts]
            
            batch_execute_sql(
                """
                UPDATE league_players
                SET contract_years = :contract_years, updated_at = NOW()
                WHERE league_id = :league_id::uuid
                    AND league_player_id = :league_player_id::uuid
                """,
                batch_params,
                database_name='leagues'
            )
            
        else:  # 'both'
            batch_params = [{
                'league_id': league_id,
                'league_player_id': contract.league_player_id,
                'salary': contract.salary,
                'contract_years': contract.contract_years
            } for contract in request.contracts]
            
            batch_execute_sql(
                """
                UPDATE league_players
                SET salary = :salary,
                    contract_years = :contract_years,
                    updated_at = NOW()
                WHERE league_id = :league_id::uuid
                    AND league_player_id = :league_player_id::uuid
                """,
                batch_params,
                database_name='leagues'
            )
        
        return {
            "success": True,
            "message": f"Updated {len(request.contracts)} contracts",
            "updated_count": len(request.contracts)
        }
        
    except Exception as e:
        logger.error(f"Error bulk updating contracts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/contracts/extend")
async def extend_player_contract(
    league_id: str,
    extension: ContractExtension,
    current_user: dict = Depends(get_current_user)
):
    """Extend a player's contract (commissioner only) - Uses transaction for consistency"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can extend contracts")
        
        # Use transaction to ensure both operations complete
        transaction_statements = [
            {
                'sql': """
                    UPDATE league_players
                    SET salary = :new_salary,
                        contract_years = :new_years,
                        updated_at = NOW()
                    WHERE league_id = :league_id::uuid
                        AND league_player_id = :league_player_id::uuid
                """,
                'parameters': {
                    'league_id': league_id,
                    'league_player_id': extension.league_player_id,
                    'new_salary': extension.new_salary,
                    'new_years': extension.new_years
                }
            },
            {
                'sql': """
                    INSERT INTO contract_extensions (
                        league_id, league_player_id, extension_type,
                        new_salary, new_years, extension_date
                    ) VALUES (
                        :league_id::uuid, :league_player_id::uuid, :extension_type,
                        :new_salary, :new_years, NOW()
                    )
                """,
                'parameters': {
                    'league_id': league_id,
                    'league_player_id': extension.league_player_id,
                    'extension_type': extension.extension_type,
                    'new_salary': extension.new_salary,
                    'new_years': extension.new_years
                }
            }
        ]
        
        execute_transaction(transaction_statements, database_name='leagues')
        
        return {
            "success": True,
            "message": "Contract extended successfully",
            "extension": extension.dict()
        }
        
    except Exception as e:
        logger.error(f"Error extending contract: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# ASYNC PRICE SAVE ENDPOINTS
# =============================================================================

@router.post("/{league_id}/prices/async")
async def save_player_prices_async(
    league_id: str,
    request: SavePricesAsyncRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Start async job to save player prices (for large datasets)"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update player prices")
        
        # Create job ID
        job_id = request.job_id or str(uuid4())
        
        # Debug logging
        logger.info(f"Starting async price save job: job_id={job_id}, league_id={league_id}, user_id={user_id}")
        logger.info(f"Total players to save: {len(request.prices)}")
        logger.info(f"Settings to save: {request.settings.dict()}")
        
        # Serialize settings to JSON string
        settings_json = json.dumps(request.settings.dict())
        logger.info(f"Serialized settings JSON: {settings_json}")
        
        # Insert job record with detailed error handling
        try:
            insert_result = execute_sql(
                """
                INSERT INTO price_save_jobs (
                    job_id, league_id, user_id, status, total_players,
                    settings, created_at, updated_at
                ) VALUES (
                    :job_id::uuid, :league_id::uuid, :user_id, 'pending', :total,
                    :settings::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                {
                    'job_id': job_id,
                    'league_id': league_id,
                    'user_id': user_id,
                    'total': len(request.prices),
                    'settings': settings_json
                },
                database_name='postgres'
            )
            logger.info(f"Job record inserted successfully: {insert_result}")
        except Exception as insert_error:
            logger.error(f"Failed to insert job record: {insert_error}")
            logger.error(f"Insert error traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Failed to start async save job: {str(insert_error)}")
        
        # Add background task
        background_tasks.add_task(
            process_price_save_job,
            job_id,
            league_id,
            request,
            user_id
        )
        
        return {
            "success": True,
            "job_id": job_id,
            "message": f"Started async price save job for {len(request.prices)} players",
            "status_url": f"/api/leagues/{league_id}/salaries/job/{job_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting async price save: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to start async save job: {str(e)}")

@router.get("/{league_id}/job/{job_id}")
async def get_price_save_job_status(
    league_id: str,
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get status of async price save job"""
    try:
        result = execute_sql(
            """
            SELECT 
                status, progress, total_players, processed_players,
                message, error_message, created_at, updated_at
            FROM price_save_jobs
            WHERE job_id = :job_id::uuid AND league_id = :league_id::uuid
            """,
            {'job_id': job_id, 'league_id': league_id},
            database_name='postgres'
        )
        
        if not result or not result.get('records'):
            raise HTTPException(status_code=404, detail="Job not found")
        
        record = result['records'][0]
        
        return PriceSaveJobStatus(
            job_id=job_id,
            status=record[0].get('stringValue'),
            progress=record[1].get('longValue', 0),
            total_players=record[2].get('longValue', 0),
            processed_players=record[3].get('longValue', 0),
            message=record[4].get('stringValue'),
            error=record[5].get('stringValue'),
            created_at=record[6].get('stringValue'),
            updated_at=record[7].get('stringValue')
        ).dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# BACKGROUND TASK PROCESSOR
# =============================================================================

async def process_price_save_job(
    job_id: str,
    league_id: str,
    request: SavePricesAsyncRequest,
    user_id: str
):
    """Process price save job in background - OPTIMIZED with batch operations"""
    try:
        logger.info(f"Processing price save job {job_id} for league {league_id}")
        
        # Update job status to processing
        execute_sql(
            """
            UPDATE price_save_jobs 
            SET status = 'processing', updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id::uuid
            """,
            {'job_id': job_id},
            database_name='postgres'
        )
        
        # Save settings first (already optimized with batch in update_salary_settings)
        settings_params = []
        settings_dict = request.settings.dict()
        for setting_name, setting_value in settings_dict.items():
            if isinstance(setting_value, (list, dict)):
                setting_value = json.dumps(setting_value)
            else:
                setting_value = str(setting_value)
            
            settings_params.append({
                'league_id': league_id,
                'setting_name': setting_name,
                'setting_value': setting_value
            })
        
        # Batch save all settings
        batch_execute_sql(
            """
            INSERT INTO league_settings (league_id, setting_name, setting_value, updated_at)
            VALUES (:league_id::uuid, :setting_name, :setting_value, NOW())
            ON CONFLICT (league_id, setting_name) 
            DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
            """,
            settings_params,
            database_name='leagues'
        )
        
        # Prepare all price parameters for batch operation
        price_params = []
        for player_price in request.prices:
            price_params.append({
                'league_id': league_id,
                'player_id': player_price.player_id,
                'price': player_price.price,
                'tier': player_price.tier or '',
                'manual_override': player_price.manual_override or False,
                'pricing_method': request.method
            })
        
        # Single batch operation for ALL prices
        batch_execute_sql(
            """
            INSERT INTO player_prices (
                league_id, player_id, price, tier, 
                manual_override, pricing_method, updated_at
            ) VALUES (
                :league_id::uuid, :player_id, :price, :tier,
                :manual_override, :pricing_method, NOW()
            )
            ON CONFLICT (league_id, player_id)
            DO UPDATE SET 
                price = EXCLUDED.price,
                tier = EXCLUDED.tier,
                manual_override = EXCLUDED.manual_override,
                pricing_method = EXCLUDED.pricing_method,
                updated_at = NOW()
            """,
            price_params,
            database_name='leagues'
        )
        
        # Mark job as completed
        execute_sql(
            """
            UPDATE price_save_jobs 
            SET status = 'completed', 
                progress = 100,
                processed_players = :total,
                message = 'All player prices saved successfully',
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id::uuid
            """,
            {'job_id': job_id, 'total': len(request.prices)},
            database_name='postgres'
        )
        
        logger.info(f"Successfully completed price save job {job_id}")
        
    except Exception as e:
        logger.error(f"Error in background price save: {str(e)}")
        logger.error(f"Background task traceback: {traceback.format_exc()}")
        
        # Mark job as failed
        execute_sql(
            """
            UPDATE price_save_jobs 
            SET status = 'failed',
                error_message = :error,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id::uuid
            """,
            {'job_id': job_id, 'error': str(e)},
            database_name='postgres'
        )