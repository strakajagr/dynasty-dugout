"""Main transactions router"""
from fastapi import APIRouter
from .free_agents import router as free_agents_router
from .roster import router as roster_router
from .activity import router as activity_router
from .trades import router as trades_router
from .waivers import router as waivers_router

router = APIRouter()

# Include sub-routers with proper prefixes
router.include_router(
    free_agents_router, 
    prefix="/free-agents",
    tags=["free-agents"]
)
router.include_router(
    roster_router,
    tags=["roster"]
)
router.include_router(
    activity_router,
    tags=["activity"]
)
router.include_router(
    trades_router,
    tags=["trades"]
)
router.include_router(
    waivers_router,
    tags=["waivers"]
)