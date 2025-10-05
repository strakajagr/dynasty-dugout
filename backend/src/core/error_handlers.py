"""
Dynasty Dugout - Centralized Error Handling
Provides consistent error responses across all API endpoints
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


# ============================================================================
# Custom Exception Classes
# ============================================================================

class DynastyDugoutException(Exception):
    """Base exception for all Dynasty Dugout errors"""
    def __init__(
        self, 
        message: str, 
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ResourceNotFoundError(DynastyDugoutException):
    """Raised when a requested resource doesn't exist"""
    def __init__(self, resource_type: str, resource_id: Any):
        message = f"{resource_type} with ID '{resource_id}' not found"
        super().__init__(message, status.HTTP_404_NOT_FOUND, {
            "resource_type": resource_type,
            "resource_id": str(resource_id)
        })


class UnauthorizedError(DynastyDugoutException):
    """Raised when user lacks authentication"""
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(DynastyDugoutException):
    """Raised when user lacks permission"""
    def __init__(self, message: str = "You don't have permission to access this resource"):
        super().__init__(message, status.HTTP_403_FORBIDDEN)


class ValidationError(DynastyDugoutException):
    """Raised when input validation fails"""
    def __init__(self, message: str, field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY, details)


class DatabaseError(DynastyDugoutException):
    """Raised when database operations fail"""
    def __init__(self, message: str = "Database operation failed"):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR)


class LeagueNotFoundError(ResourceNotFoundError):
    """Raised when a league doesn't exist"""
    def __init__(self, league_id: Any):
        super().__init__("League", league_id)


class PlayerNotFoundError(ResourceNotFoundError):
    """Raised when a player doesn't exist"""
    def __init__(self, player_id: Any):
        super().__init__("Player", player_id)


class TeamNotFoundError(ResourceNotFoundError):
    """Raised when a team doesn't exist"""
    def __init__(self, team_id: Any):
        super().__init__("Team", team_id)


class DuplicateResourceError(DynastyDugoutException):
    """Raised when trying to create a resource that already exists"""
    def __init__(self, resource_type: str, identifier: str):
        message = f"{resource_type} with identifier '{identifier}' already exists"
        super().__init__(message, status.HTTP_409_CONFLICT, {
            "resource_type": resource_type,
            "identifier": identifier
        })


class SalaryCapError(DynastyDugoutException):
    """Raised when a transaction would violate salary cap rules"""
    def __init__(self, message: str, current_cap: float, attempted_amount: float):
        super().__init__(message, status.HTTP_400_BAD_REQUEST, {
            "current_cap": current_cap,
            "attempted_amount": attempted_amount,
            "overage": attempted_amount - current_cap
        })


class RosterLimitError(DynastyDugoutException):
    """Raised when roster size limits are violated"""
    def __init__(self, message: str, current_size: int, max_size: int):
        super().__init__(message, status.HTTP_400_BAD_REQUEST, {
            "current_roster_size": current_size,
            "max_roster_size": max_size
        })


# ============================================================================
# CORS Helper
# ============================================================================

def get_cors_headers(request: Request) -> Dict[str, str]:
    """
    Get proper CORS headers for error responses.
    Returns specific origin instead of wildcard when credentials are used.
    """
    # List of allowed origins (matching fantasy_api.py CORS config)
    allowed_origins = [
        "https://d3m07ty6v4sik6.cloudfront.net",
        "https://d20wx6xzxkf84y.cloudfront.net",
        "https://d31ij4udqr5ude.cloudfront.net",
        "https://dynasty-dugout.com",
        "https://www.dynasty-dugout.com",
        "http://localhost:3000",
        "http://localhost:3001"
    ]
    
    # Get the origin from the request
    origin = request.headers.get("origin", "")
    
    # If origin is in allowed list, use it; otherwise use first allowed origin as fallback
    if origin in allowed_origins:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*"
        }
    else:
        # Fallback to first allowed origin
        return {
            "Access-Control-Allow-Origin": allowed_origins[3],  # dynasty-dugout.com
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*"
        }


# ============================================================================
# Exception Handlers
# ============================================================================

async def dynasty_dugout_exception_handler(
    request: Request, 
    exc: DynastyDugoutException
) -> JSONResponse:
    """Handle all Dynasty Dugout custom exceptions"""
    
    # Log the error
    logger.error(
        f"DynastyDugout Error: {exc.message}",
        extra={
            "status_code": exc.status_code,
            "details": exc.details,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "type": exc.__class__.__name__,
                "details": exc.details
            }
        },
        headers=get_cors_headers(request)
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
) -> JSONResponse:
    """Handle FastAPI/Pydantic validation errors"""
    
    logger.warning(
        f"Validation Error: {exc.errors()}",
        extra={
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "message": "Validation failed",
                "type": "ValidationError",
                "details": {
                    "errors": exc.errors()
                }
            }
        },
        headers=get_cors_headers(request)
    )


async def generic_exception_handler(
    request: Request,
    exc: Exception
) -> JSONResponse:
    """Handle unexpected exceptions"""
    
    # Log the full exception
    logger.exception(
        f"Unhandled Exception: {str(exc)}",
        extra={
            "path": request.url.path,
            "method": request.method
        }
    )
    
    # Don't expose internal error details in production
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "message": "An unexpected error occurred. Please try again later.",
                "type": "InternalServerError",
                "details": {}
            }
        },
        headers=get_cors_headers(request)
    )


# ============================================================================
# Setup Function
# ============================================================================

def setup_error_handlers(app) -> None:
    """
    Register all error handlers with the FastAPI app
    
    Usage:
        from core.error_handlers import setup_error_handlers
        
        app = FastAPI()
        setup_error_handlers(app)
    """
    
    # Custom Dynasty Dugout exceptions
    app.add_exception_handler(DynastyDugoutException, dynasty_dugout_exception_handler)
    
    # FastAPI validation errors
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    
    # Catch-all for unexpected errors
    app.add_exception_handler(Exception, generic_exception_handler)
    
    logger.info("Error handlers registered successfully")


# ============================================================================
# Helper Functions for Backward Compatibility
# ============================================================================

def format_error_response(message: str, status_code: int = 500, **kwargs) -> Dict[str, Any]:
    """
    Helper to format error responses in the old style if needed
    This maintains backward compatibility while we migrate
    """
    return {
        "success": False,
        "error": message,
        **kwargs
    }
