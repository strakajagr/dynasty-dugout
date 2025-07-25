"""
Dynasty Dugout - Main Leagues Router
🎯 MODULAR STRUCTURE: Combines all league sub-modules into one clean router
📁 REPLACES: The massive 1200+ line leagues.py file
🧩 MODULES: lifecycle, management, owners, standings, players, transactions
"""

from fastapi import APIRouter

# Import all modular sub-routers
from . import lifecycle, management, owners, standings
# TODO: Import players and transactions modules when created
# from . import players, transactions

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

# Basic League Operations (management.py)
router.include_router(
    management.router,
    tags=["League Management"],
    responses={
        200: {"description": "Success"},
        404: {"description": "League not found"},
        403: {"description": "Access denied"}
    }
)

# Owner & Team Management (owners.py) - CRITICAL FOR FRONTEND FIX
router.include_router(
    owners.router,
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
    tags=["Standings & Scoring"],
    responses={
        200: {"description": "Success"},
        404: {"description": "League not found"},
        403: {"description": "Access denied"}
    }
)

# TODO: Include additional modules when ready
# router.include_router(
#     players.router,
#     tags=["League Players"],
#     responses={
#         200: {"description": "Success"},
#         404: {"description": "League/Player not found"},
#         403: {"description": "Access denied"}
#     }
# )

# router.include_router(
#     transactions.router,
#     tags=["Transactions"],
#     responses={
#         200: {"description": "Success"},
#         400: {"description": "Invalid transaction"},
#         403: {"description": "Transaction not allowed"}
#     }
# )

# =============================================================================
# MAIN ROUTER METADATA
# =============================================================================

# Add metadata about the modular structure
@router.get("/", include_in_schema=False)
async def leagues_module_info():
    """Information about the modular leagues structure"""
    return {
        "module": "leagues",
        "status": "modular_structure_implemented",
        "description": "Leagues functionality broken into focused modules",
        "modules": {
            "lifecycle": {
                "file": "lifecycle.py",
                "purpose": "League creation, status tracking, deletion",
                "endpoints": ["/create", "/{league_id}/creation-status", "/{league_id}/cleanup"],
                "status": "✅ extracted and operational"
            },
            "management": {
                "file": "management.py", 
                "purpose": "Basic league info, settings, health checks",
                "endpoints": ["/health", "/my-leagues", "/{league_id}", "/{league_id}/settings"],
                "status": "✅ extracted and operational"
            },
            "owners": {
                "file": "owners.py",
                "purpose": "Owner management, team setup, invitations",
                "endpoints": ["/{league_id}/owners", "/{league_id}/setup-team", "/{league_id}/invite-owner"],
                "status": "✅ extracted and operational - FRONTEND SHOULD USE /owners"
            },
            "standings": {
                "file": "standings.py",
                "purpose": "Competitive rankings, points, wins/losses",
                "endpoints": ["/{league_id}/standings", "/{league_id}/scores", "/{league_id}/categories"],
                "status": "✅ extracted and operational - FOR STANDINGS PAGE ONLY"
            },
            "players": {
                "file": "players.py",
                "purpose": "League-specific player management",
                "endpoints": ["/{league_id}/players", "/{league_id}/free-agents", "/{league_id}/my-roster"],
                "status": "🚧 planned - to be created"
            },
            "transactions": {
                "file": "transactions.py",
                "purpose": "Trades, waivers, free agency",
                "endpoints": ["/{league_id}/transactions", "/{league_id}/trades", "/{league_id}/waivers"],
                "status": "🚧 planned - to be created"
            }
        },
        "frontend_fix": {
            "issue": "Owner Management table was calling wrong endpoint",
            "solution": "Call /owners instead of /standings",
            "owners_endpoint": "GET /{league_id}/owners - returns teams + invitations + empty slots",
            "standings_endpoint": "GET /{league_id}/standings - returns competitive rankings only"
        },
        "architecture": {
            "before": "1200+ line leagues.py file (unmaintainable)",
            "after": "6 focused modules (~200-400 lines each)",
            "benefits": ["single responsibility", "easy testing", "team development", "clear separation"]
        },
        "migration_status": "✅ Core modules extracted, old file can be safely replaced"
    }