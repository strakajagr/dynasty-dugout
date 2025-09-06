"""
Dynasty Dugout - Salary Module Utilities
PURPOSE: Shared helper functions for salary management
"""

import logging
import traceback
from typing import List
from core.database import execute_sql

logger = logging.getLogger(__name__)


# =============================================================================
# AUTHORIZATION HELPERS
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


# =============================================================================
# STATS COLUMN MAPPING
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
# DATABASE TABLE MANAGEMENT
# =============================================================================

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