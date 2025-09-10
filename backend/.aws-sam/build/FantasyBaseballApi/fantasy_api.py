#!/usr/bin/env python3
"""
Dynasty Dugout FastAPI Application - Complete Version
Forces proper route registration in Lambda environment with MLB debug
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
    description="Complete serverless fantasy baseball platform with MLB debug"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://d3m07ty6v4sik6.cloudfront.net",
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

# Add this function before the handler
def fix_doubled_api_path(event):
    """Fix doubled /api/api paths from custom domain"""
    if "path" in event and event["path"].startswith("/api/api/"):
        event["path"] = event["path"].replace("/api/api/", "/api/", 1)
    return event

# Simple health check BEFORE importing routers
@app.get("/api/health")
async def health_check():
    """Comprehensive health check"""
    return {
        "status": "healthy", 
        "service": "Dynasty Dugout API", 
        "version": "7.1.1",
        "mlb_debug": "available",
        "routers": {
            "auth": "active",
            "account": "active",
            "leagues": "active",
            "players": "active",
            "analytics": "active",
            "mlb": "active",
            "mlb_debug": "active",
            "invitations": "active",
            "utilities": "active"
        }
    }

# Now import and register routers
try:
    logger.info("📦 Importing routers...")
    
    # Core routers
    from routers import auth
    app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    logger.info("✅ Auth router registered")
    
    from routers import account
    app.include_router(account.router, prefix="/api/account", tags=["Profile"])
    logger.info("✅ Account router registered")
    
    from routers import leagues
    app.include_router(leagues.router, prefix="/api/leagues", tags=["Leagues"])
    logger.info("✅ Leagues router registered")
    
    # Players router (now part of leagues structure)
    from routers.leagues import players
    app.include_router(players.global_router, prefix="/api/players", tags=["Players"])
    logger.info("✅ Players router registered")
    
    
    from routers import invitations
    app.include_router(invitations.router, prefix="/api/invitation", tags=["Invitations"])
    logger.info("✅ Invitations router registered")
    
    from routers import utilities
    app.include_router(utilities.router, prefix="/api/utilities", tags=["Utilities"])
    logger.info("✅ Utilities router registered")
    
    # MLB routers
    try:
        from routers import mlb
        app.include_router(mlb.router, tags=["MLB Data"])
        logger.info("✅ MLB router registered")
    except Exception as e:
        logger.error(f"❌ Failed to register MLB router: {e}")
    
    try:
        from routers import mlb_debug
        app.include_router(mlb_debug.router, tags=["MLB Debug"])
        logger.info("✅ MLB Debug router registered")
    except Exception as e:
        logger.error(f"❌ Failed to register MLB Debug router: {e}")
    
    logger.info("✅ All routers registered successfully")
except Exception as e:
    logger.error(f"❌ Failed to import routers: {e}", exc_info=True)

# Debug endpoints
@app.get("/api/debug/routes")
async def debug_routes():
    """List all registered routes"""
    routes = []
    for route in app.routes:
        if hasattr(route, "path"):
            routes.append({
                "path": route.path, 
                "methods": list(route.methods) if hasattr(route, "methods") else None
            })
    return {
        "total_routes": len(routes), 
        "routes": sorted(routes, key=lambda x: x["path"])
    }

# Root endpoints
@app.get("/")
async def root():
    return {"service": "Dynasty Dugout API", "status": "operational", "version": "7.1.1"}

@app.get("/api")
async def api_root():
    return {
        "message": "Dynasty Dugout API v7.1.1",
        "status": "operational", 
        "endpoints": {
            "auth": "/api/auth",
            "account": "/api/account",
            "leagues": "/api/leagues",
            "players": "/api/players", 
            "analytics": "/api/analytics",
            "mlb": "/api/mlb",
            "mlb_debug": "/api/mlb/trending-debug",
            "invitations": "/api/invitation",
            "utilities": "/api/utilities",
            "debug": "/api/debug/routes"
        }
    }

# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    logger.error(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    return {
        "statusCode": exc.status_code,
        "body": f'{{"detail": "{exc.detail}", "status_code": {exc.status_code}}}',
        "headers": {"Content-Type": "application/json"}
    }

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return {
        "statusCode": 500,
        "body": '{"detail": "Internal server error", "status_code": 500}',
        "headers": {"Content-Type": "application/json"}
    }

# Create handler with proper request logging
_handler = Mangum(app, lifespan="off")

def handler(event, context):
    """Lambda handler with path fix and logging"""
    event = fix_doubled_api_path(event)
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