# fantasy_api.py - Secure Cookie Authentication Version

import boto3
import json
import jwt
from fastapi import FastAPI, HTTPException, Depends, Request, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any
import requests
import logging
import traceback
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Fantasy Baseball API", version="3.0.0")

# CORS middleware - UPDATED for cookie support
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://d20wx6xzxkf84y.cloudfront.net",
        "https://fantasy-baseball-frontend-strakajagr.s3-website-us-east-1.amazonaws.com",
        "http://localhost:3000",  # For local development
        "http://127.0.0.1:3000"   # For local development
    ],
    allow_credentials=True,  # CRITICAL: Required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cognito Configuration
COGNITO_CONFIG = {
    "region": "us-east-1",
    "user_pool_id": "us-east-1_OooV5u83w",
    "client_id": "5m9tq9758ad00vtnjobobpfgaq",
    "jwks_url": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OooV5u83w/.well-known/jwks.json"
}

# Cookie Configuration
COOKIE_CONFIG = {
    "name": "fantasy_auth_token",
    "secure": True,      # Only send over HTTPS
    "httponly": True,    # Cannot be accessed by JavaScript
    "samesite": "none",  # Required for cross-origin requests with CloudFront
    "max_age": 3600,     # 1 hour
    "path": "/"
}

# Initialize AWS clients
rds_client = boto3.client('rds-data', region_name='us-east-1')
cognito_client = boto3.client('cognito-idp', region_name='us-east-1')

# Database configuration
DATABASE_CONFIG = {
    'resourceArn': 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball',
    'secretArn': 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-db-credentials-MoEtfC',
    'database': 'postgres'
}

# Cache for JWKS
jwks_cache = None

def get_jwks():
    """Get JSON Web Key Set from Cognito"""
    global jwks_cache
    if not jwks_cache:
        try:
            logger.info(f"Fetching JWKS from: {COGNITO_CONFIG['jwks_url']}")
            response = requests.get(COGNITO_CONFIG["jwks_url"], timeout=10)
            response.raise_for_status()
            jwks_cache = response.json()
            logger.info("JWKS cached successfully")
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
    return jwks_cache

def verify_cognito_token(token: str) -> Dict[str, Any]:
    """Verify Cognito JWT token and return user claims"""
    try:
        logger.info("Starting token verification...")
        
        # Get the kid from token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header['kid']
        logger.info(f"Token kid: {kid}")
        
        # Get JWKS and find the right key
        jwks = get_jwks()
        key = None
        for jwk in jwks['keys']:
            if jwk['kid'] == kid:
                key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
                logger.info(f"Found matching JWKS key for kid: {kid}")
                break
        
        if not key:
            logger.error(f"No matching key found for kid: {kid}")
            raise HTTPException(status_code=401, detail="Invalid token - key not found")
        
        # Verify token
        logger.info("Verifying JWT token...")
        payload = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            audience=COGNITO_CONFIG["client_id"],
            issuer=f"https://cognito-idp.{COGNITO_CONFIG['region']}.amazonaws.com/{COGNITO_CONFIG['user_pool_id']}"
        )
        
        logger.info(f"Token verified successfully for user: {payload.get('email', 'unknown')}")
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        logger.error(f"Token verification traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=401, detail="Token verification failed")

def get_current_user(request: Request):
    """Dependency to get current authenticated user from cookie"""
    # Get token from cookie
    token = request.cookies.get(COOKIE_CONFIG["name"])
    
    if not token:
        logger.warning("No authentication cookie found")
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Verify token and return user claims
    user_claims = verify_cognito_token(token)
    return user_claims

def execute_sql(sql: str, parameters=None):
    """Execute SQL query using RDS Data API"""
    try:
        params = {
            'resourceArn': DATABASE_CONFIG['resourceArn'],
            'secretArn': DATABASE_CONFIG['secretArn'],
            'database': DATABASE_CONFIG['database'],
            'sql': sql
        }
        
        if parameters:
            params['parameters'] = parameters
            
        response = rds_client.execute_statement(**params)
        return response
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error")

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/api/auth/signup")
async def signup(user_data: dict):
    """Register a new user with Cognito"""
    try:
        logger.info(f"Signup attempt for user: {user_data.get('email')}")
        
        # Extract user attributes
        user_attributes = [
            {'Name': 'email', 'Value': user_data['email']},
            {'Name': 'given_name', 'Value': user_data['firstName']},
            {'Name': 'family_name', 'Value': user_data['lastName']}
        ]
        
        # Add optional attributes
        if user_data.get('favoriteTeam'):
            user_attributes.append({
                'Name': 'custom:favorite_team', 
                'Value': user_data['favoriteTeam']
            })
        
        if user_data.get('experienceLevel'):
            user_attributes.append({
                'Name': 'custom:experience_level', 
                'Value': user_data['experienceLevel']
            })
        
        # Create user in Cognito
        logger.info("Creating user in Cognito...")
        response = cognito_client.admin_create_user(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            Username=user_data['email'],
            UserAttributes=user_attributes,
            TemporaryPassword=user_data['password'],
            MessageAction='SUPPRESS'  # Don't send welcome email
        )
        
        # Set permanent password
        logger.info("Setting permanent password...")
        cognito_client.admin_set_user_password(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            Username=user_data['email'],
            Password=user_data['password'],
            Permanent=True
        )
        
        logger.info(f"User {user_data['email']} created successfully")
        return {"success": True, "message": "User created successfully"}
        
    except cognito_client.exceptions.UsernameExistsException:
        logger.error(f"User already exists: {user_data.get('email')}")
        raise HTTPException(status_code=400, detail="User already exists")
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        logger.error(f"Signup traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/auth/login")
async def login(credentials: dict, response: Response):
    """Authenticate user with Cognito and set secure cookie"""
    try:
        logger.info(f"Login attempt for user: {credentials.get('email')}")
        
        # Authenticate with Cognito
        logger.info("Attempting Cognito authentication...")
        auth_response = cognito_client.admin_initiate_auth(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            ClientId=COGNITO_CONFIG['client_id'],
            AuthFlow='ADMIN_NO_SRP_AUTH',
            AuthParameters={
                'USERNAME': credentials['email'],
                'PASSWORD': credentials['password']
            }
        )
        
        logger.info("Cognito authentication successful!")
        auth_result = auth_response['AuthenticationResult']
        id_token = auth_result['IdToken']  # ← CHANGED: Use IdToken instead of AccessToken
        
        logger.info(f"Received ID token, length: {len(id_token)}")
        
        # Set secure httpOnly cookie with the ID token
        logger.info("Setting secure cookie...")
        response.set_cookie(
            key=COOKIE_CONFIG["name"],
            value=id_token,  # ← CHANGED: Use IdToken
            max_age=COOKIE_CONFIG["max_age"],
            httponly=COOKIE_CONFIG["httponly"],
            secure=COOKIE_CONFIG["secure"],
            samesite=COOKIE_CONFIG["samesite"],
            path=COOKIE_CONFIG["path"]
        )
        
        logger.info(f"Cookie set successfully for {credentials['email']}")
        
        # Return user info (without tokens)
        logger.info("Verifying token to get user claims...")
        user_claims = verify_cognito_token(id_token)  # ← CHANGED: Use IdToken
        
        logger.info("Token verification successful, preparing response...")
        
        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "email": user_claims.get("email"),
                "given_name": user_claims.get("given_name"),
                "family_name": user_claims.get("family_name"),
                "favorite_team": user_claims.get("custom:favorite_team"),
                "experience_level": user_claims.get("custom:experience_level")
            }
        }
        
    except cognito_client.exceptions.NotAuthorizedException as e:
        logger.error(f"Cognito auth failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except cognito_client.exceptions.UserNotFoundException as e:
        logger.error(f"User not found: {str(e)}")
        raise HTTPException(status_code=404, detail="User not found")
    except HTTPException as e:
        # This catches errors from verify_cognito_token
        logger.error(f"HTTP Exception during login: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected login error: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")
    
@app.post("/api/auth/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    """Logout user by clearing the authentication cookie"""
    try:
        # Clear the authentication cookie
        response.delete_cookie(
            key=COOKIE_CONFIG["name"],
            path=COOKIE_CONFIG["path"],
            samesite=COOKIE_CONFIG["samesite"],
            secure=COOKIE_CONFIG["secure"]
        )
        
        logger.info(f"User {current_user.get('email')} logged out successfully")
        
        return {"success": True, "message": "Logged out successfully"}
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        raise HTTPException(status_code=500, detail="Logout failed")

@app.get("/api/auth/user")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile information"""
    return {
        "email": current_user.get("email"),
        "given_name": current_user.get("given_name"),
        "family_name": current_user.get("family_name"),
        "favorite_team": current_user.get("custom:favorite_team"),
        "experience_level": current_user.get("custom:experience_level"),
        "user_id": current_user.get("sub")
    }

@app.get("/api/auth/status")
async def auth_status(request: Request):
    """Check authentication status without requiring login"""
    try:
        token = request.cookies.get(COOKIE_CONFIG["name"])
        if token:
            user_claims = verify_cognito_token(token)
            return {
                "authenticated": True,
                "user": {
                    "email": user_claims.get("email"),
                    "given_name": user_claims.get("given_name"),
                    "family_name": user_claims.get("family_name")
                }
            }
        else:
            return {"authenticated": False}
    except:
        return {"authenticated": False}

# ==================== PLAYER DATA ENDPOINTS ====================

@app.get("/api/players")
async def get_players(
    limit: int = 100,
    offset: int = 0,
    position: Optional[str] = None,
    team: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)  # Require authentication
):
    """Get MLB players with filtering options"""
    try:
        logger.info(f"Fetching players for user: {current_user.get('email')}")
        
        # Try to fetch from database, fall back to mock data
        try:
            # Build SQL query
            sql = """
            SELECT player_id, first_name, last_name, position, jersey_number, 
                   bats, throws, team, height_inches, weight_pounds, birthdate
            FROM mlb_players
            WHERE 1=1
            """
            
            parameters = []
            
            if position:
                sql += " AND position = ?"
                parameters.append({'name': 'position', 'value': {'stringValue': position}})
            
            if team:
                sql += " AND team = ?"
                parameters.append({'name': 'team', 'value': {'stringValue': team}})
            
            if search:
                sql += " AND (first_name ILIKE ? OR last_name ILIKE ?)"
                search_param = f"%{search}%"
                parameters.extend([
                    {'name': 'search1', 'value': {'stringValue': search_param}},
                    {'name': 'search2', 'value': {'stringValue': search_param}}
                ])
            
            sql += " ORDER BY last_name, first_name LIMIT ? OFFSET ?"
            parameters.extend([
                {'name': 'limit', 'value': {'longValue': limit}},
                {'name': 'offset', 'value': {'longValue': offset}}
            ])
            
            response = execute_sql(sql, parameters)
            
            # Process results
            players = []
            if 'records' in response and response['records']:
                for record in response['records']:
                    player = {}
                    for i, field in enumerate(['player_id', 'first_name', 'last_name', 'position', 
                                             'jersey_number', 'bats', 'throws', 'team', 
                                             'height_inches', 'weight_pounds', 'birthdate']):
                        if i < len(record):
                            value = record[i]
                            if 'stringValue' in value:
                                player[field] = value['stringValue']
                            elif 'longValue' in value:
                                player[field] = value['longValue']
                            elif 'isNull' in value:
                                player[field] = None
                    players.append(player)
            
        except Exception as db_error:
            logger.warning(f"Database query failed, using mock data: {db_error}")
            players = []
        
        # If no data from database, return mock data
        if not players:
            logger.info("No data in database, returning mock data for testing")
            players = [
                {
                    "player_id": 1,
                    "first_name": "Mike",
                    "last_name": "Trout",
                    "team": "LAA",
                    "position": "OF",
                    "jersey_number": "27",
                    "bats": "R",
                    "throws": "R",
                    "height_inches": 74,
                    "weight_pounds": 235,
                    "birthdate": "1991-08-07"
                },
                {
                    "player_id": 2,
                    "first_name": "Ronald",
                    "last_name": "Acuna Jr.",
                    "team": "ATL",
                    "position": "OF",
                    "jersey_number": "13",
                    "bats": "R",
                    "throws": "R",
                    "height_inches": 72,
                    "weight_pounds": 205,
                    "birthdate": "1997-12-18"
                },
                {
                    "player_id": 3,
                    "first_name": "Jacob",
                    "last_name": "deGrom",
                    "team": "TEX",
                    "position": "P",
                    "jersey_number": "48",
                    "bats": "L",
                    "throws": "R",
                    "height_inches": 76,
                    "weight_pounds": 180,
                    "birthdate": "1988-06-19"
                },
                {
                    "player_id": 4,
                    "first_name": "Gerrit",
                    "last_name": "Cole",
                    "team": "NYY",
                    "position": "P",
                    "jersey_number": "45",
                    "bats": "R",
                    "throws": "R",
                    "height_inches": 76,
                    "weight_pounds": 220,
                    "birthdate": "1990-09-08"
                },
                {
                    "player_id": 5,
                    "first_name": "Juan",
                    "last_name": "Soto",
                    "team": "NYY",
                    "position": "OF",
                    "jersey_number": "22",
                    "bats": "L",
                    "throws": "L",
                    "height_inches": 73,
                    "weight_pounds": 224,
                    "birthdate": "1998-10-25"
                },
                {
                    "player_id": 6,
                    "first_name": "Shohei",
                    "last_name": "Ohtani",
                    "team": "LAD",
                    "position": "DH",
                    "jersey_number": "17",
                    "bats": "L",
                    "throws": "R",
                    "height_inches": 76,
                    "weight_pounds": 210,
                    "birthdate": "1994-07-05"
                },
                {
                    "player_id": 7,
                    "first_name": "Aaron",
                    "last_name": "Judge",
                    "team": "NYY",
                    "position": "OF",
                    "jersey_number": "99",
                    "bats": "R",
                    "throws": "R",
                    "height_inches": 79,
                    "weight_pounds": 282,
                    "birthdate": "1992-04-26"
                },
                {
                    "player_id": 8,
                    "first_name": "Francisco",
                    "last_name": "Lindor",
                    "team": "NYM",
                    "position": "SS",
                    "jersey_number": "12",
                    "bats": "S",
                    "throws": "R",
                    "height_inches": 71,
                    "weight_pounds": 190,
                    "birthdate": "1993-11-14"
                }
            ]
        
        return {
            "players": players,
            "total": len(players),
            "limit": limit,
            "offset": offset,
            "authenticated_user": current_user.get('email'),
            "data_source": "mock"  # Will be "database" when Aurora has data
        }
        
    except Exception as e:
        logger.error(f"Get players error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch players")

@app.get("/api/players/{player_id}")
async def get_player_details(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information for a specific player"""
    try:
        sql = """
        SELECT * FROM mlb_players WHERE player_id = ?
        """
        
        parameters = [{'name': 'player_id', 'value': {'longValue': player_id}}]
        response = execute_sql(sql, parameters)
        
        if not response.get('records'):
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Process player data (simplified for example)
        record = response['records'][0]
        player = {
            "player_id": record[0].get('longValue'),
            "first_name": record[1].get('stringValue'),
            "last_name": record[2].get('stringValue'),
            # Add more fields as needed
        }
        
        return player
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get player details error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch player details")

# ==================== USER-SPECIFIC ENDPOINTS ====================

@app.get("/api/user/watchlist")
async def get_user_watchlist(current_user: dict = Depends(get_current_user)):
    """Get user's watchlist of players"""
    user_id = current_user.get("sub")
    
    # This would query a user_watchlist table
    # For now, return empty list
    return {"watchlist": [], "user_id": user_id}

@app.post("/api/user/watchlist/{player_id}")
async def add_to_watchlist(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Add player to user's watchlist"""
    user_id = current_user.get("sub")
    
    # Implementation would insert into user_watchlist table
    return {"success": True, "message": f"Player {player_id} added to watchlist"}

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint (no authentication required)"""
    return {
        "status": "healthy",
        "service": "Fantasy Baseball API",
        "version": "3.0.0",
        "authentication": "secure_cookies",
        "cognito_configured": True,
        "user_pool_id": COGNITO_CONFIG["user_pool_id"],
        "client_id": COGNITO_CONFIG["client_id"],
        "cookie_config": {
            "name": COOKIE_CONFIG["name"],
            "secure": COOKIE_CONFIG["secure"],
            "httponly": COOKIE_CONFIG["httponly"],
            "samesite": COOKIE_CONFIG["samesite"]
        }
    }

# ==================== ROOT ENDPOINT ====================

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Fantasy Baseball API v3.0 - Secure Cookie Authentication",
        "features": [
            "Secure Cookie Authentication",
            "Cognito Integration",
            "User Profile Management", 
            "MLB Player Data",
            "Personal Watchlists",
            "Cross-Tab Compatibility"
        ],
        "documentation": "/docs",
        "health_check": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)