#!/usr/bin/env python3
"""
Dynasty Dugout FastAPI Application - Main App
Modular enterprise architecture with separate router modules
"""
import logging
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

# --- Early Imports for Migrations ---
from core.database import execute_sql, test_database_connection

# Configure logging
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)


# =============================================================================
# DATABASE MIGRATIONS
# =============================================================================

def run_db_migrations():
    """
    Ensure all required columns exist in the database.
    This handles the async league creation pattern requirements.
    """
    logger.info("--- Checking database schema migrations... ---")
    migrations = [
        # Add columns for async league creation status tracking
        "ALTER TABLE user_leagues ADD COLUMN IF NOT EXISTS creation_status VARCHAR(50) DEFAULT 'completed'",
        "ALTER TABLE user_leagues ADD COLUMN IF NOT EXISTS creation_error_message TEXT",
        "ALTER TABLE user_leagues ADD COLUMN IF NOT EXISTS status_last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
    ]
    
    for migration_sql in migrations:
        try:
            execute_sql(migration_sql, database_name='postgres')
        except Exception as e:
            # Log but don't fail - this is expected if the column already exists
            logger.info(f"Migration note: {str(e)[:100]}")
    
    logger.info("✅ Database schema migrations check complete.")

# --- Run Migrations on Cold Start ---
run_db_migrations()


# =============================================================================
# MAIN APP INITIALIZATION
# =============================================================================

logger.info("--- FastAPI App (main.py): Starting initialization ---")

# Import all router modules
try:
    from routers import auth
    from routers import account
    from routers import analytics
    from routers import utilities
    from routers import invitations
    from routers.leagues import router as leagues_router
    from routers.leagues.management import global_router as league_management_router
    from routers.leagues.players import global_router as global_players_router

    logger.info("--- FastAPI App (main.py): All routers imported. ---")
except Exception as e:
    logger.critical(f"--- FastAPI App (main.py): FAILED to import a router: {e}", exc_info=True)
    sys.exit(1)

# Create FastAPI app
app = FastAPI(
    title="Dynasty Dugout API",
    version="6.0.0",
    description="Complete fantasy baseball platform with league management and invitation system"
)

# --- Middleware & Routers ---

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://d20wx6xzxkf84y.cloudfront.net", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(account.router, prefix="/api/account", tags=["Account Management"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(invitations.router, prefix="/api/invitation", tags=["League Invitations"])
app.include_router(utilities.router, prefix="/api", tags=["Utilities"])
app.include_router(league_management_router, prefix="/api/leagues", tags=["Leagues"])
app.include_router(leagues_router, prefix="/api/leagues", tags=["Leagues"])
app.include_router(global_players_router, prefix="/api/players", tags=["Global Players"])

# --- API Endpoints ---

@app.get("/")
async def root():
    logger.info("--- FastAPI App (main.py): Root endpoint hit ---")
    return {
        "message": "Dynasty Dugout API v6.0 - Complete League Management with Invitations",
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        logger.info("--- FastAPI App (main.py): Testing DB connection in health check. ---")
        health_status = {
            "status": "healthy",
            "service": "Dynasty Dugout API",
            "version": "6.0.0",
            "database": "checking..."
        }
        
        if test_database_connection():
            health_status["database"] = "connected"
        else:
            health_status["database"] = "no_response"
            health_status["status"] = "degraded"
        
        return health_status
    except Exception as e:
        logger.critical(f"--- FastAPI App (main.py): HEALTH CHECK FAILED: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Health check failed due to internal error.")

# --- Mangum Handler ---
handler = Mangum(app)

logger.info("--- FastAPI App (main.py): Initialization complete ---")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fantasy_api:app", host="0.0.0.0", port=8000, reload=True)