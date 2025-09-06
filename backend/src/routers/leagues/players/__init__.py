"""
Dynasty Dugout - Players Module Router Aggregation
PURPOSE: Combines all player sub-modules into clean routers
UPDATED: Renamed roster to team_stats for clarity
"""

from fastapi import APIRouter
import logging

logger = logging.getLogger(__name__)

# Import sub-modules with RENAMED team_stats
from . import team_stats, free_agents, global_stats

# Create routers matching the original structure
router = APIRouter()
global_router = APIRouter()

# =============================================================================
# INCLUDE GLOBAL ENDPOINTS (No league_id required)
# =============================================================================

global_router.include_router(
    global_stats.router,
    tags=["Global Player Stats"]
)

# =============================================================================
# INCLUDE LEAGUE-SPECIFIC ENDPOINTS
# =============================================================================

# Team statistics display (3-line stats for team pages)
router.include_router(
    team_stats.router,
    tags=["Team Statistics"]
)

# Free agent management (2-line stats for FA browsing)
router.include_router(
    free_agents.router,
    tags=["Free Agents"]
)

# =============================================================================
# MODULE INFO
# =============================================================================

@router.get("/module-info", include_in_schema=False)
async def players_module_info():
    """Information about the players module structure"""
    return {
        "module": "players",
        "status": "refactored_modular",
        "structure": {
            "models.py": "Pydantic models for stats (SeasonStats, AccruedStats, RollingStats)",
            "analytics.py": "PlayerAnalytics class with comprehensive analysis",
            "utils.py": "Helper functions for data parsing and validation",
            "team_stats.py": "Team statistics endpoints with 3-line display (Season/Accrued/14-day)",
            "free_agents.py": "Free agent browsing with 2-line stats",
            "global_stats.py": "Player info, career stats, complete data (no league required)"
        },
        "features": {
            "three_line_display": "Season/Accrued/14-day for team stats pages",
            "two_line_display": "Season/14-day for free agents",
            "cached_stats": "Uses league DB cached current season data",
            "comprehensive_analytics": "Z-scores, hot/cold, trends, consistency",
            "no_cross_db_joins": "Fixed to use only leagues database"
        },
        "endpoints": {
            "team_stats": [
                "/teams/{team_id}/stats - Get team 3-line statistics",
                "/my-team-stats - Get current user's team stats",
                "/team-stats-dashboard/{team_id} - Full dashboard with totals"
            ],
            "roster_management": [
                "/my-roster - Basic roster for management (from transactions module)",
                "/teams/{team_id}/roster - View any team's roster"
            ]
        }
    }