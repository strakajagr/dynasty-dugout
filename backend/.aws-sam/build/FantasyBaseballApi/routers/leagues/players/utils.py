"""
Dynasty Dugout - Player Module Utilities
PURPOSE: Helper functions for data parsing, validation, and common operations
"""

import logging
from typing import Optional, Dict, Any
from core.database import execute_sql
from core.season_utils import CURRENT_SEASON

logger = logging.getLogger(__name__)

# =============================================================================
# DATA PARSING HELPERS - REMOVED (now using dictionary access)
# =============================================================================

# Safe conversion functions for dictionary values
def safe_int(value, default=0):
    """Safely convert a value to integer"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_float(value, default=0.0):
    """Safely convert a value to float"""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

# =============================================================================
# VALIDATION HELPERS
# =============================================================================

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

async def get_user_team_id(league_id: str, user_id: str) -> Optional[str]:
    """Get the team ID for this user in this league"""
    try:
        team_query = execute_sql(
            """SELECT team_id FROM league_teams 
               WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'  # SHARED DATABASE
        )
        if team_query and team_query.get("records") and len(team_query["records"]) > 0:
            # Changed from array indexing to dictionary access
            return team_query["records"][0].get('team_id', '')
        return None
    except Exception as e:
        logger.error(f"Error getting user team ID: {str(e)}")
        return None

# =============================================================================
# CALCULATION HELPERS
# =============================================================================

def calculate_trend(recent_avg: float) -> str:
    """Calculate if player is hot, cold, or steady"""
    if recent_avg >= 0.300:
        return "hot"
    elif recent_avg <= 0.200:
        return "cold"
    else:
        return "steady"

def calculate_career_totals(career_stats: list, position: str) -> Optional[Dict[str, Any]]:
    """Calculate career totals from historical data"""
    if not career_stats:
        return None
        
    totals = {}
    for season in career_stats:
        for stat, value in season.items():
            if stat in ['season_year', 'team_abbreviation', 'batting_avg', 'obp', 'slg', 'ops', 'era', 'whip']:
                continue
            if isinstance(value, (int, float)):
                totals[stat] = totals.get(stat, 0) + value
    
    # Calculate rate stats
    if totals.get('at_bats', 0) > 0:
        totals['batting_avg'] = round(totals.get('hits', 0) / totals['at_bats'], 3)
        
    if totals.get('innings_pitched', 0) > 0:
        totals['era'] = round((totals.get('earned_runs', 0) * 9) / totals['innings_pitched'], 2)
        totals['whip'] = round((totals.get('hits_allowed', 0) + totals.get('walks_allowed', 0)) / totals['innings_pitched'], 3)
    
    totals['season_year'] = 'CAREER'
    return totals

# =============================================================================
# COLUMN MAPPING
# =============================================================================

def map_category_to_column(category: str) -> str:
    """Map scoring category names to database column names"""
    category_lower = category.lower()
    mapping = {
        'r': 'runs',
        'runs': 'runs',
        'rbi': 'rbi',
        'hr': 'home_runs',
        'home_runs': 'home_runs',
        'sb': 'stolen_bases',
        'stolen_bases': 'stolen_bases',
        'avg': 'batting_avg',
        'batting_avg': 'batting_avg',
        'ops': 'ops',
        'obp': 'obp',
        'slg': 'slg',
        'w': 'wins',
        'wins': 'wins',
        'qs': 'quality_starts',
        'quality_starts': 'quality_starts',
        's': 'saves',
        'saves': 'saves',
        'sv': 'saves',
        'k': 'strikeouts_pitched',
        'strikeouts': 'strikeouts_pitched',
        'strikeouts_pitched': 'strikeouts_pitched',
        'era': 'era',
        'whip': 'whip'
    }
    return mapping.get(category_lower, category_lower)

# =============================================================================
# STAT PARSING HELPERS - REMOVED (now using dictionary access)
# =============================================================================

# =============================================================================
# TEAM CALCULATION HELPERS
# =============================================================================

def calculate_team_totals(roster: list) -> Dict[str, Any]:
    """Calculate team totals from active players only"""
    active_roster = [p for p in roster if p.roster_status == 'active']
    
    if not active_roster:
        return {
            "season": {},
            "accrued": {},
            "rolling_14d": {}
        }
    
    return {
        "season": {
            "batting_avg": sum(p.season_stats.batting_avg for p in active_roster) / len(active_roster),
            "home_runs": sum(p.season_stats.home_runs for p in active_roster),
            "rbi": sum(p.season_stats.rbi for p in active_roster),
            "runs": sum(p.season_stats.runs for p in active_roster),
            "stolen_bases": sum(p.season_stats.stolen_bases for p in active_roster),
            "wins": sum(p.season_stats.wins for p in active_roster),
            "saves": sum(p.season_stats.saves for p in active_roster),
            "era": sum(p.season_stats.era for p in active_roster) / len(active_roster)
        },
        "accrued": {
            "batting_avg": sum(p.accrued_stats.active_batting_avg for p in active_roster) / len(active_roster),
            "home_runs": sum(p.accrued_stats.active_home_runs for p in active_roster),
            "rbi": sum(p.accrued_stats.active_rbi for p in active_roster),
            "runs": sum(p.accrued_stats.active_runs for p in active_roster),
            "stolen_bases": sum(p.accrued_stats.active_stolen_bases for p in active_roster),
            "wins": sum(p.accrued_stats.active_wins for p in active_roster),
            "saves": sum(p.accrued_stats.active_saves for p in active_roster),
            "era": sum(p.accrued_stats.active_era for p in active_roster) / len(active_roster)
        },
        "rolling_14d": {
            "batting_avg": sum(p.rolling_14_day.batting_avg for p in active_roster) / len(active_roster),
            "home_runs": sum(p.rolling_14_day.home_runs for p in active_roster),
            "rbi": sum(p.rolling_14_day.rbi for p in active_roster),
            "runs": sum(p.rolling_14_day.runs for p in active_roster),
            "stolen_bases": sum(p.rolling_14_day.stolen_bases for p in active_roster),
            "wins": sum(p.rolling_14_day.wins for p in active_roster),
            "saves": sum(p.rolling_14_day.saves for p in active_roster),
            "era": sum(p.rolling_14_day.era for p in active_roster) / len(active_roster)
        }
    }