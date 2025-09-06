"""
Dynasty Dugout - Season Management Utilities
Handles dynamic season year determination and historical vs current season logic
"""

from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def get_current_season() -> int:
    """
    Get the current MLB season year.
    MLB season runs April-October, so:
    - Jan-Mar: Previous year's season (offseason)
    - Apr-Dec: Current year's season
    """
    now = datetime.now()
    month = now.month
    year = now.year
    
    # Before April, we're still in last year's season/offseason
    if month < 4:
        return year - 1
    return year

def get_season_start_date(season_year: int = None) -> str:
    """Get the start date for a season (for filtering game logs)"""
    if season_year is None:
        season_year = get_current_season()
    # MLB season typically starts late March/early April
    return f"{season_year}-03-15"

def get_season_end_date(season_year: int = None) -> str:
    """Get the end date for a season (for filtering game logs)"""
    if season_year is None:
        season_year = get_current_season()
    # MLB season ends in October, but include potential November for World Series
    return f"{season_year}-11-30"

# Export for easy access
CURRENT_SEASON = get_current_season()
SEASON_START = get_season_start_date()
SEASON_END = get_season_end_date()

logger.info(f"🗓️ Season Manager initialized: Current season is {CURRENT_SEASON}")