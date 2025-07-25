#!/usr/bin/env python3
"""
Dynasty Dugout FastAPI Application - Main App
Modular enterprise architecture with separate router modules
"""

import logging
from fastapi import FastAPI

# Import all router modules including leagues and invitations
from routers import auth, account, players, analytics, utilities, invitations
from routers.leagues import router as leagues_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Dynasty Dugout API", 
    version="6.0.0",  # Bumped version for invitation system
    description="Complete fantasy baseball platform with league management and invitation system"
)

# Include all routers with prefixes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(account.router, prefix="/api/auth", tags=["Account Management"]) 
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(leagues_router, prefix="/api/leagues", tags=["League Management"])
app.include_router(invitations.router, prefix="/api/leagues", tags=["League Invitations"])  # FIXED: Added prefix
app.include_router(utilities.router, prefix="/api", tags=["Utilities"])

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Dynasty Dugout API v6.0 - Complete League Management with Invitations",
        "features": [
            "Modular Router Architecture",
            "Secure Cookie Authentication",
            "Real MLB Player Database",  
            "Career Statistics (4,497+ seasons)",
            "Game Logs (34,628+ individual games)",
            "Account Management",
            "League-Specific Player Pools",
            "Dynasty League Management",
            "Contract & Salary Systems",
            "Secure League Invitations with JWT",
            "Email Invitation System with AWS SES",
            "Multi-user League Management",
            "Hot/Cold Performance Analysis",
            "Recent Performance Tracking",
            "Trending Player Detection"
        ],
        "modules": {
            "auth": "Authentication & user management", 
            "account": "Profile & account settings",
            "players": "Player data & details",
            "analytics": "Performance analytics",
            "leagues": "League creation & management",
            "invitations": "League invitation system with email integration",
            "utilities": "Helper endpoints"
        },
        "architecture": "League-Specific Player Pools with Secure Invitation System - Enterprise Ready"
    }

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    from core.database import test_database_connection
    
    health_status = {
        "status": "healthy",
        "service": "Dynasty Dugout API",
        "version": "6.0.0",
        "architecture": "modular",
        "modules": ["auth", "account", "players", "analytics", "leagues", "invitations", "utilities"],
        "database": "checking..."
    }
    
    # Test database connection
    try:
        if test_database_connection():
            health_status["database"] = "connected"
        else:
            health_status["database"] = "no_response"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    return health_status

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)