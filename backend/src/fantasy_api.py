#!/usr/bin/env python3
"""
Dynasty Dugout FastAPI Application - Main App
Modular enterprise architecture with separate router modules
"""

import logging
import sys # Keep sys for logging stdout
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure logging for this file
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)

logger.info("--- FastAPI App (fantasy_api.py): Starting initialization ---")

# Import all router modules with individual try-except blocks for debugging
try:
    from routers import auth
    logger.info("--- FastAPI App (fantasy_api.py): Imported auth router. ---")
except Exception as e:
    logger.critical(f"--- FastAPI App (fantasy_api.py): FAILED to import auth router: {e}", exc_info=True)
    sys.exit(1) # Crash early if this critical import fails

try:
    from routers import account
    logger.info("--- FastAPI App (fantasy_api.py): Imported account router. ---")
except Exception as e:
    logger.critical(f"--- FastAPI App (fantasy_api.py): FAILED to import account router: {e}", exc_info=True)
    sys.exit(1)

try:
    from routers import players
    logger.info("--- FastAPI App (fantasy_api.py): Imported players router. ---")
except Exception as e:
    logger.critical(f"--- FastAPI App (fantasy_api.py): FAILED to import players router: {e}", exc_info=True)
    sys.exit(1)

try:
    from routers import analytics
    logger.info("--- FastAPI App (fantasy_api.py): Imported analytics router. ---")
except Exception as e:
    logger.critical(f"--- FastAPI App (fantasy_api.py): FAILED to import analytics router: {e}", exc_info=True)
    sys.exit(1)

try:
    from routers import utilities
    logger.info("--- FastAPI App (fantasy_api.py): Imported utilities router. ---")
except Exception as e:
    logger.critical(f"--- FastAPI App (fantasy_api.py): FAILED to import utilities router: {e}", exc_info=True)
    sys.exit(1)

try:
    from routers import invitations
    logger.info("--- FastAPI App (fantasy_api.py): Imported invitations router. ---")
except Exception as e:
    logger.critical(f"--- FastAPI App (fantasy_api.py): FAILED to import invitations router: {e}", exc_info=True)
    sys.exit(1)

try:
    from routers.leagues import router as leagues_router
    logger.info("--- FastAPI App (fantasy_api.py): Imported leagues router. ---")
except Exception as e:
    logger.critical(f"--- FastAPI App (fantasy_api.py): FAILED to import leagues router: {e}", exc_info=True)
    sys.exit(1)

# Create FastAPI app
app = FastAPI(
    title="Dynasty Dugout API",
    version="6.0.0",
    description="Complete fantasy baseball platform with league management and invitation system"
)

# Configure CORS (assuming this is needed for your frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers with prefixes
# Use individual try-except for app.include_router if desired, but import is usually the issue
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(account.router, prefix="/api/auth", tags=["Account Management"])
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(leagues_router, prefix="/api/leagues", tags=["League Management"])
app.include_router(invitations.router, prefix="/api/invitation", tags=["League Invitations"])
app.include_router(utilities.router, prefix="/api", tags=["Utilities"])

# Root endpoint
@app.get("/")
async def root():
    logger.info("--- FastAPI App (fantasy_api.py): Root endpoint hit ---")
    return {
        "message": "Dynasty Dugout API v6.0 - Complete League Management with Invitations",
        # ... (rest of your root endpoint return) ...
    }

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        from core.database import test_database_connection # <--- Check this import
        logger.info("--- FastAPI App (fantasy_api.py): Testing DB connection in health check. ---")
        health_status = {
            "status": "healthy",
            "service": "Dynasty Dugout API",
            "version": "6.0.0",
            "architecture": "modular",
            "modules": ["auth", "account", "players", "analytics", "leagues", "invitations", "utilities"],
            "database": "checking..."
        }
        
        if test_database_connection():
            health_status["database"] = "connected"
        else:
            health_status["database"] = "no_response"
            health_status["status"] = "degraded"
        
        return health_status
    except Exception as e:
        logger.critical(f"--- FastAPI App (fantasy_api.py): HEALTH CHECK FAILED: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Health check failed due to internal error.")


logger.info("--- FastAPI App (fantasy_api.py): Initialization complete ---")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)