"""
Dynasty Dugout - Transactions Module Router Aggregator
This file combines all transaction sub-modules into a single router
FIXED: Only imports modules that actually exist to prevent import errors
STATUS: Working with free_agents and roster, ready for expansion
"""

from fastapi import APIRouter
import logging

logger = logging.getLogger(__name__)

# Import only the modules that exist and are working
from .free_agents import router as free_agents_router
from .roster import router as roster_router

# TODO: Add these imports when modules are created:
from .activity import router as activity_router      # Transaction history
# from .trades import router as trades_router          # Trade proposals/acceptance  
# from .waivers import router as waivers_router        # Waiver claims/processing

# Create main router that will be imported by leagues/__init__.py
router = APIRouter()

# =============================================================================
# WORKING MODULES - ACTIVE
# =============================================================================

# Free agents endpoints - WORKING
# Routes created: /{league_id}/free-agents/ and /{league_id}/free-agents-enhanced
router.include_router(
    free_agents_router, 
    prefix="/free-agents", 
    tags=["Free Agents"]
)

# Roster management endpoints - WORKING
# Routes created: /{league_id}/add-player, /{league_id}/drop-player, etc.
router.include_router(
    roster_router,
    tags=["Roster Management"]
)

# =============================================================================
# FUTURE MODULES - COMMENTED OUT UNTIL IMPLEMENTED
# =============================================================================

# TODO: Activity and history endpoints
# Will provide: /{league_id}/transactions, /{league_id}/recent-activity
router.include_router(
    activity_router,
    tags=["Transaction Activity"]
)

# TODO: Trade endpoints  
# Will provide: /{league_id}/trades/propose, /{league_id}/trades/accept, etc.
# router.include_router(
#     trades_router,
#     prefix="/trades",
#     tags=["Trades"]  
# )

# TODO: Waiver endpoints
# Will provide: /{league_id}/waivers/claim, /{league_id}/waivers/process, etc.
# router.include_router(
#     waivers_router,
#     prefix="/waivers",
#     tags=["Waivers"]
# )

# =============================================================================
# MODULE INFO ENDPOINT
# =============================================================================

@router.get("/module-info", include_in_schema=False)
async def transactions_module_info():
    """Information about the modular transactions structure"""
    return {
        "module": "transactions",
        "status": "partial_implementation",
        "description": "Transaction functionality with modular architecture",
        "active_modules": {
            "free_agents": {
                "file": "free_agents.py", 
                "status": "✅ Working",
                "endpoints": ["/{league_id}/free-agents/", "/{league_id}/free-agents-enhanced"]
            },
            "roster": {
                "file": "roster.py",
                "status": "✅ Working", 
                "endpoints": ["/{league_id}/add-player", "/{league_id}/drop-player", "/{league_id}/my-roster", "/{league_id}/my-roster-enhanced"]
            }
        },
        "pending_modules": {
            "activity": {
                "file": "activity.py",
                "status": "⏳ Not implemented",
                "planned_endpoints": ["/{league_id}/transactions", "/{league_id}/recent-activity"]
            },
            "trades": {
                "file": "trades.py", 
                "status": "⏳ Not implemented",
                "planned_endpoints": ["/{league_id}/trades/propose", "/{league_id}/trades/accept"]
            },
            "waivers": {
                "file": "waivers.py",
                "status": "⏳ Not implemented", 
                "planned_endpoints": ["/{league_id}/waivers/claim", "/{league_id}/waivers/process"]
            }
        },
        "expansion_ready": "✅ Just uncomment imports and router.include_router calls when modules are ready"
    }