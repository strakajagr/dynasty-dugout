"""
Dynasty Dugout - Salary Pricing Module
Handle player pricing, pricing data, and price calculations
"""

import logging
import json
import traceback
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from core.auth_utils import get_current_user
from core.database import execute_sql, batch_execute_sql
from core.season_utils import CURRENT_SEASON
from .models import PlayerPrice, SavePricesRequest
from .settings import validate_league_membership, verify_commissioner

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# CATEGORY MAPPING HELPER FUNCTIONS
# =============================================================================

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

# =============================================================================
# PRICING DATA ENDPOINT - USES CACHED STATS FROM LEAGUES DB
# =============================================================================

@router.get("/{league_id}/salaries/pricing-data")
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
        
        # BATCH QUERY: Get stats for ALL players for each year from MAIN DB
        for year in years:
            logger.info(f"Fetching stats for year {year} from main DB...")
            
            # Build dynamic column list based on what the league needs
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
                        
                        # Process each column we queried - handle all value types
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
# PLAYER PRICING ENDPOINTS
# =============================================================================

@router.get("/{league_id}/salaries/prices")
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

@router.post("/{league_id}/salaries/prices")
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
        
        # Single batch operation for all prices
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