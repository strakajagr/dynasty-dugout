"""
Dynasty Dugout - Main Leagues Router
🎯 MODULAR STRUCTURE: Combines all league sub-modules into one clean router
📁 REPLACES: The massive 1200+ line leagues.py file
🧩 MODULES: lifecycle, management, owners, standings, players, transactions
STATUS: All league-specific modules now have consistent URL prefixes to prevent routing conflicts.
"""

from fastapi import APIRouter
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# EXPLICIT DEBUGGING BLOCK FOR 'owners.py'
# This block will force the application to crash if 'owners.py' fails to
# import for any reason, printing the exact error to the CloudWatch logs.
# =============================================================================
try:
    from . import owners
    logger.warning("✅✅✅ DEBUG: Successfully imported owners.py module.")
except Exception:
    logger.critical("❌❌❌ DEBUG: FAILED TO IMPORT owners.py. See traceback below.", exc_info=True)
    raise  # This forces the app to crash and show the error

# =============================================================================
# Import all other modular sub-routers
# =============================================================================
from . import lifecycle, management, standings, players
from . import transactions

# Create main router
router = APIRouter()

# =============================================================================
# INCLUDE ALL SUB-ROUTERS WITH CLEAR ORGANIZATION
# =============================================================================

# League Creation & Destruction (lifecycle.py)
router.include_router(
    lifecycle.router,
    tags=["League Lifecycle"],
    responses={
        200: {"description": "Success"},
        404: {"description": "League not found"},
        500: {"description": "Internal server error"}
    }
)

# [FIXED] The redundant prefix has been removed. The routes inside management.py
# already contain the correct paths (e.g., "/{league_id}").
router.include_router(
    management.router,
    tags=["League Management"],
    responses={
        200: {"description": "Success"},
        404: {"description": "League not found"},
        403: {"description": "Access denied"}
    }
)

# Owner & Team Management (owners.py)
router.include_router(
    owners.router,
    prefix="/{league_id}",
    tags=["Owner Management"],
    responses={
        200: {"description": "Success"},
        404: {"description": "League not found"},
        403: {"description": "Access denied"}
    }
)

# Competitive Standings & Scoring (standings.py)
router.include_router(
    standings.router,
    prefix="/{league_id}",
    tags=["Standings & Scoring"],
    responses={
        200: {"description": "Success"},
        404: {"description": "League not found"},
        403: {"description": "Access denied"}
    }
)

# League-Specific Player Data (players.py)
router.include_router(
    players.router,
    prefix="/{league_id}",
    tags=["League Players & Rosters"],
    responses={
        200: {"description": "Success"},
        404: {"description": "League/Player not found"},
        403: {"description": "Access denied"}
    }
)

# Transactions (trades, waivers, free agency)
router.include_router(
    transactions.router,
    prefix="/{league_id}",
    tags=["Transactions"],
    responses={
        200: {"description": "Success"},
        400: {"description": "Invalid transaction"},
        403: {"description": "Transaction not allowed"}
    }
)

# =============================================================================
# MAIN ROUTER METADATA & STATUS
# =============================================================================

@router.get("/", include_in_schema=False)
async def leagues_module_info():
    """Information about the modular leagues structure"""
    return {
        "module": "leagues",
        "status": "modular_structure_complete_with_players",
        "description": "Leagues functionality broken into focused modules",
        "modules": {
            "lifecycle": {
                "file": "lifecycle.py",
                "purpose": "League creation, status tracking, deletion",
                "endpoints": ["/create", "/{league_id}/creation-status", "/{league_id}/cleanup"],
                "status": "✅ extracted and operational",
                "lines": "~657"
            },
            "management": {
                "file": "management.py",
                "purpose": "Basic league info, settings, health checks",
                "endpoints": ["/{league_id}", "/{league_id}/settings"],
                "status": "✅ ROUTING FIXED",
                "lines": "~262"
            },
            "owners": {
                "file": "owners.py",
                "purpose": "Owner management, team setup, invitations",
                "endpoints": ["/{league_id}/owners", "/{league_id}/setup-team", "/{league_id}/invite-owner"],
                "status": "✅ ROUTING FIXED",
                "lines": "~500+"
            },
            "standings": {
                "file": "standings.py",
                "purpose": "Competitive rankings, points, wins/losses",
                "endpoints": ["/{league_id}/standings", "/{league_id}/scores", "/{league_id}/categories"],
                "status": "✅ ROUTING FIXED",
                "lines": "~174"
            },
            "players": {
                "file": "players.py",
                "purpose": "League-specific player management with team attribution",
                "endpoints": [
                    "/{league_id}/team-home-data",
                    "/{league_id}/players",
                    "/{league_id}/free-agents",
                    "/{league_id}/my-roster",
                    "/{league_id}/teams/{team_id}/two-line-stats"
                ],
                "status": "✅ COMPLETE - TEAM HOME DASHBOARD READY!",
                "lines": "~1000+",
                "features": [
                    "Two-line player display (season vs team stats)",
                    "Team attribution system",
                    "Daily stats accumulation",
                    "Starting pitchers integration",
                    "Complete Team Home Dashboard API"
                ]
            },
            "transactions": {
                "file": "transactions.py",
                "purpose": "Trades, waivers, free agency",
                "endpoints": ["/{league_id}/transactions", "/{league_id}/trades", "/{league_id}/waivers"],
                "status": "✅ ROUTING FIXED",
                "lines": "~107 (placeholder)"
            }
        },
        "frontend_integration": {
            "team_home_dashboard": {
                "status": "✅ READY TO DEPLOY",
                "endpoint": "GET /{league_id}/team-home-data",
                "purpose": "Complete dashboard data in one API call",
                "returns": [
                    "team_info (name, manager, etc.)",
                    "roster_stats (two-line player display)",
                    "starting_pitchers (today's games)",
                    "player_notes (news updates)",
                    "last_night_box (yesterday's performance)"
                ]
            },
            "owner_management": {
                "endpoint": "GET /{league_id}/owners",
                "purpose": "Owner management table data",
                "returns": "teams + invitations + empty slots"
            },
            "standings_display": {
                "endpoint": "GET /{league_id}/standings",
                "purpose": "Competitive rankings only",
                "returns": "wins/losses/points data"
            }
        },
        "architecture": {
            "before": "1200+ line leagues.py file (unmaintainable)",
            "after": "6 focused modules (~2,500+ lines total)",
            "benefits": [
                "single responsibility",
                "easy testing",
                "team development",
                "clear separation",
                "sophisticated player attribution system"
            ]
        },
        "deployment_status": {
            "core_modules": "✅ extracted and operational",
            "team_home_system": "✅ complete and ready",
            "two_line_stats": "✅ implemented with team attribution",
            "migration_safe": "✅ old file can be safely replaced"
        }
    }

# =============================================================================
# ROOT LEAGUE ENDPOINTS - TODO
# =============================================================================

@router.get("/search")
async def search_leagues():
    """Search for public leagues to join"""
    return {
        "success": False,
        "message": "League search endpoint not yet implemented",
        "todo": "Search public leagues with filters (name, sport, etc.)"
    }
