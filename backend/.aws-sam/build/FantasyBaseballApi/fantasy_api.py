#!/usr/bin/env python3
"""
Dynasty Dugout FastAPI Application - Fixed Handler
Forces proper route registration in Lambda environment
"""
import logging
import sys
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from typing import Optional, List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, stream=sys.stdout, force=True)
logger = logging.getLogger(__name__)

logger.info("🚀 Starting FastAPI app initialization")

# --- Early Database Setup ---
from core.database import execute_sql, test_database_connection

# Create app FIRST before any imports that might use it
app = FastAPI(
    title="Dynasty Dugout API",
    version="7.1.1",
    description="Fixed serverless fantasy baseball platform"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://d3m07ty6v4sik6.cloudfront.net",  # ADD THIS LINE
        "https://d20wx6xzxkf84y.cloudfront.net",
        "https://d31ij4udqr5ude.cloudfront.net",
        "https://dynasty-dugout.com",
        "https://www.dynasty-dugout.com",
        "http://localhost:3000",
        "http://localhost:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple health check BEFORE importing routers
@app.get("/api/health")
async def health_check():
    """Simple health check"""
    return {"status": "healthy", "service": "Dynasty Dugout API", "version": "7.1.1"}

# Now import and register routers
try:
    logger.info("📦 Importing routers...")
    from routers import auth
    app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    logger.info("✅ Auth router registered")
    
    from routers import account
    app.include_router(account.router, prefix="/api/account", tags=["Profile"])
    logger.info("✅ Account router registered")
    
    from routers import leagues
    app.include_router(leagues.router, prefix="/api/leagues", tags=["Leagues"])
    logger.info("✅ Leagues router registered")
    
    from routers.leagues import players
    app.include_router(players.global_router, prefix="/api/players", tags=["Players"])
    logger.info("✅ Players router registered")
    
    from routers import analytics
    app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
    
    from routers import invitations
    app.include_router(invitations.router, prefix="/api/invitation", tags=["Invitations"])
    
    from routers import utilities
    app.include_router(utilities.router, prefix="/api/utilities", tags=["Utilities"])
    
    logger.info("✅ All routers registered successfully")
except Exception as e:
    logger.error(f"❌ Failed to import routers: {e}", exc_info=True)

# Debug endpoint
@app.get("/api/debug/routes")
async def debug_routes():
    """List all registered routes"""
    routes = []
    for route in app.routes:
        if hasattr(route, "path"):
            routes.append({"path": route.path, "methods": list(route.methods) if hasattr(route, "methods") else None})
    return {"total_routes": len(routes), "routes": sorted(routes, key=lambda x: x["path"])}

# Root endpoints
@app.get("/")
async def root():
    return {"service": "Dynasty Dugout API", "status": "operational"}

@app.get("/api")
async def api_root():
    return {"message": "Dynasty Dugout API", "endpoints": "Use /api/debug/routes to see all"}

# Create handler with proper request logging
_handler = Mangum(app, lifespan="off")

def handler(event, context):
    """Lambda handler with path fix"""
    event = fix_doubled_api_path(event)
    """Lambda handler with logging"""
    logger.info(f"📨 Request: {event.get('httpMethod')} {event.get('path')}")
    try:
        response = _handler(event, context)
        logger.info(f"✅ Response status: {response.get('statusCode')}")
        return response
    except Exception as e:
        logger.error(f"❌ Handler error: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "body": '{"error": "Internal server error"}',
            "headers": {"Content-Type": "application/json"}
        }

logger.info("🎯 Handler ready")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fantasy_api:app", host="0.0.0.0", port=8000, reload=True)

# Add this function before the handler
def fix_doubled_api_path(event):
    """Fix doubled /api/api paths from custom domain"""
    if "path" in event and event["path"].startswith("/api/api/"):
        event["path"] = event["path"].replace("/api/api/", "/api/", 1)
    return event
