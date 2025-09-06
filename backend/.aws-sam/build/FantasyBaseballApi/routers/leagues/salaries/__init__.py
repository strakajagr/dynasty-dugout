import logging
logger = logging.getLogger(__name__)
logger.info("Loading salaries module")
"""
Dynasty Dugout - Salaries Module Router Aggregator
This file combines all salary sub-modules into a single router
MODULAR ARCHITECTURE: Split from 800+ line monolith into focused modules
STATUS: Complete with all salary functionality
"""

from fastapi import APIRouter
import logging

logger = logging.getLogger(__name__)

# Import all modular sub-routers
from .settings import router as settings_router
from .pricing import router as pricing_router
from .teams import router as teams_router
from .contracts import router as contracts_router
from .jobs import router as jobs_router

# Create main router that will be imported by leagues/__init__.py
router = APIRouter()

# =============================================================================
# INCLUDE ALL SUB-ROUTERS
# =============================================================================

# Salary Settings - league configuration
# Routes: /{league_id}/salaries/settings
router.include_router(
    settings_router,
    tags=["Salary Settings"]
)

# Pricing Engine - player prices and pricing data
# Routes: /{league_id}/salaries/pricing-data, /{league_id}/salaries/prices
router.include_router(
    pricing_router,
    tags=["Player Pricing"]
)

# Team Salary Management - cap tracking and team totals
# Routes: /{league_id}/salaries/teams, /{league_id}/salaries/teams/{team_id}
router.include_router(
    teams_router,
    tags=["Team Salaries"]
)

# Contract Management - individual and bulk contract operations
# Routes: /{league_id}/salaries/contracts/*
router.include_router(
    contracts_router,
    tags=["Contract Management"]
)

# Async Job Processing - large dataset saves with background processing
# Routes: /{league_id}/salaries/prices/async, /{league_id}/salaries/job/{job_id}
router.include_router(
    jobs_router,
    tags=["Async Jobs"]
)

# =============================================================================
# MODULE INFO ENDPOINT
# =============================================================================

@router.get("/salaries/module-info", include_in_schema=False)
async def salaries_module_info():
    """Information about the modular salaries structure"""
    return {
        "module": "salaries",
        "status": "complete_modular_implementation",
        "description": "Salary management with modular architecture",
        "original_size": "800+ lines (monolithic)",
        "current_structure": {
            "models.py": {
                "lines": "~50",
                "purpose": "All Pydantic models",
                "models": [
                    "SalarySettings", "PlayerPrice", "SavePricesRequest",
                    "TeamSalaryInfo", "PlayerContract", "ContractExtension",
                    "BulkContractUpdate", "PriceSaveJobStatus"
                ]
            },
            "settings.py": {
                "lines": "~150", 
                "purpose": "Salary cap & league settings",
                "endpoints": [
                    "GET /{league_id}/salaries/settings",
                    "POST /{league_id}/salaries/settings"
                ]
            },
            "pricing.py": {
                "lines": "~250",
                "purpose": "Player pricing & pricing data",
                "endpoints": [
                    "GET /{league_id}/salaries/pricing-data",
                    "GET /{league_id}/salaries/prices", 
                    "POST /{league_id}/salaries/prices"
                ],
                "note": "Contains the massive pricing-data endpoint"
            },
            "teams.py": {
                "lines": "~150",
                "purpose": "Team salary totals & constraints",
                "endpoints": [
                    "GET /{league_id}/salaries/teams",
                    "GET /{league_id}/salaries/teams/{team_id}"
                ]
            },
            "contracts.py": {
                "lines": "~200",
                "purpose": "Individual contract management",
                "endpoints": [
                    "POST /{league_id}/salaries/contracts/update",
                    "POST /{league_id}/salaries/contracts/bulk-update",
                    "POST /{league_id}/salaries/contracts/extend"
                ]
            },
            "jobs.py": {
                "lines": "~100",
                "purpose": "Async price save jobs",
                "endpoints": [
                    "POST /{league_id}/salaries/prices/async",
                    "GET /{league_id}/salaries/job/{job_id}"
                ]
            }
        },
        "benefits": {
            "maintainability": "Each file has single responsibility",
            "testability": "Unit tests per module",
            "scalability": "Add features without touching other modules", 
            "performance": "Smaller import footprint",
            "collaboration": "Multiple developers can work simultaneously"
        },
        "route_fixes": {
            "issue": "Frontend calls /{league_id}/salaries/settings but routes were inconsistent",
            "solution": "All routes now include full /{league_id}/salaries/* paths",
            "status": "✅ Fixed - all routes properly prefixed"
        },
        "optimization_features": {
            "batch_operations": "All price saves use batch_execute_sql for performance",
            "async_processing": "Large datasets processed in background",
            "transaction_safety": "Contract extensions use database transactions",
            "caching_ready": "Stats fetched from cached leagues database"
        },
        "deployment_status": "✅ Ready for production - maintains exact API compatibility"
    }