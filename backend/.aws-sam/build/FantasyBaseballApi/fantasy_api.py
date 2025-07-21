#!/usr/bin/env python3
"""
Fantasy Baseball FastAPI Application - Complete Rewrite
Secure authentication + Real MLB data from Aurora PostgreSQL via RDS Data API
"""

import boto3
import json
import jwt
from fastapi import FastAPI, HTTPException, Depends, Request, Response, Query
from typing import Optional, Dict, Any, List
import requests
import logging
import traceback
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Fantasy Baseball API", 
    version="4.0.0",
    description="Complete fantasy baseball platform with real MLB data"
)

# ==================== CONFIGURATION ====================

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
    "secure": True,
    "httponly": True,
    "samesite": "none",
    "max_age": 3600,
    "path": "/"
}

# Database configuration - RDS Data API
DATABASE_CONFIG = {
    'resourceArn': 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball',
    'secretArn': 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-db-credentials-MoEtfC',
    'database': 'postgres'
}

# Initialize AWS clients
try:
    rds_client = boto3.client('rds-data', region_name='us-east-1')
    cognito_client = boto3.client('cognito-idp', region_name='us-east-1')
    logger.info("AWS clients initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize AWS clients: {e}")
    rds_client = None
    cognito_client = None

# Cache for JWKS
jwks_cache = None

# ==================== HELPER FUNCTIONS ====================

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
        
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header['kid']
        
        jwks = get_jwks()
        key = None
        for jwk in jwks['keys']:
            if jwk['kid'] == kid:
                key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
                break
        
        if not key:
            raise HTTPException(status_code=401, detail="Invalid token - key not found")
        
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
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        raise HTTPException(status_code=401, detail="Token verification failed")

def get_current_user(request: Request):
    """Dependency to get current authenticated user from cookie"""
    token = request.cookies.get(COOKIE_CONFIG["name"])
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_claims = verify_cognito_token(token)
    return user_claims

def execute_sql(sql: str, parameters=None):
    """Execute SQL query using RDS Data API with improved error handling"""
    if not rds_client:
        raise HTTPException(status_code=500, detail="Database client not initialized")
    
    try:
        logger.info(f"Executing SQL: {sql[:100]}...")
        
        params = {
            'resourceArn': DATABASE_CONFIG['resourceArn'],
            'secretArn': DATABASE_CONFIG['secretArn'],
            'database': DATABASE_CONFIG['database'],
            'sql': sql,
            'includeResultMetadata': True
        }
        
        if parameters:
            params['parameters'] = parameters
            
        response = rds_client.execute_statement(**params)
        logger.info(f"SQL executed successfully, returned {len(response.get('records', []))} records")
        return response
        
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        logger.error(f"SQL: {sql}")
        logger.error(f"Parameters: {parameters}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

def format_player_data(records, response):
    """Convert RDS Data API response to clean player objects - FINAL FIX"""
    print(f"DEBUG format_player_data: records length = {len(records) if records else 'None'}")
    print(f"DEBUG format_player_data: response keys = {list(response.keys()) if response else 'None'}")
    
    if not records or not response:
        print("DEBUG: Returning empty - no records or response")
        return []
    
    # FIXED: columnMetadata is at ROOT level, not in resultMetadata!
    columns = []
    
    # Try multiple locations for column metadata
    if 'columnMetadata' in response:
        columns = [col['name'] for col in response['columnMetadata']]
        print(f"DEBUG: Found columns at root level: {columns}")
    elif 'resultMetadata' in response and 'columnMetadata' in response['resultMetadata']:
        columns = [col['name'] for col in response['resultMetadata']['columnMetadata']]
        print(f"DEBUG: Found columns in resultMetadata: {columns}")
    else:
        print(f"DEBUG: No columnMetadata found. Available keys: {list(response.keys())}")
        return []
    
    if not columns:
        print("DEBUG: No columns extracted, returning empty array")
        return []
    
    players = []
    
    for i, record in enumerate(records):
        if i == 0:  # Only log first record
            print(f"DEBUG: First record = {record}")
        
        player = {}
        for j, column in enumerate(columns):
            if j < len(record):
                value = record[j]
                if isinstance(value, dict):
                    if 'stringValue' in value:
                        player[column] = value['stringValue']
                    elif 'longValue' in value:
                        player[column] = value['longValue']
                    elif 'doubleValue' in value:
                        player[column] = value['doubleValue']
                    elif 'booleanValue' in value:
                        player[column] = value['booleanValue']
                    elif 'isNull' in value and value['isNull']:
                        player[column] = None
                    else:
                        player[column] = str(value)
                else:
                    player[column] = value
            else:
                player[column] = None
        players.append(player)
        
        if i == 0:  # Only log first player
            print(f"DEBUG: First formatted player = {player}")
    
    print(f"DEBUG: Returning {len(players)} players")
    return players

# ==================== AUTHENTICATION ENDPOINTS ====================
@app.post("/api/auth/signup")
async def signup(user_data: dict):
    """Register a new user with Cognito using standard sign_up method"""
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        logger.info(f"Signup attempt for user: {user_data.get('email')}")
        
        # Validate required fields
        required_fields = ['email', 'firstName', 'lastName', 'password']
        for field in required_fields:
            if not user_data.get(field):
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Check if user with this email already exists
        try:
            response = cognito_client.list_users(
                UserPoolId=COGNITO_CONFIG['user_pool_id'],
                Filter=f'email = "{user_data["email"]}"'
            )
            if response.get('Users'):
                raise HTTPException(status_code=400, detail="An account with this email already exists")
        except Exception as filter_error:
            logger.warning(f"Could not check for existing user: {filter_error}")
        
        # Build user attributes for standard signup
        user_attributes = [
            {'Name': 'email', 'Value': user_data['email']},
            {'Name': 'given_name', 'Value': user_data['firstName']},
            {'Name': 'family_name', 'Value': user_data['lastName']}
        ]
        
        if user_data.get('favoriteTeam'):
            user_attributes.append({
                'Name': 'custom:favorite_team', 
                'Value': user_data['favoriteTeam']
            })
        
        # Use standard sign_up method instead of admin_create_user
        response = cognito_client.sign_up(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=user_data['email'],
            Password=user_data['password'],
            UserAttributes=user_attributes
        )
        
        logger.info(f"User {user_data['email']} created successfully")
        return {
            "success": True, 
            "message": "Account created successfully! Please check your email for a verification code.",
            "requiresVerification": True
        }
        
    except HTTPException:
        raise
    except cognito_client.exceptions.UsernameExistsException:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    except cognito_client.exceptions.InvalidPasswordException:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters with uppercase, lowercase, and numbers")
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/auth/verify-email")
async def verify_email(verification_data: dict):
    """Verify email with confirmation code using standard method"""
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = verification_data.get('email')
        code = verification_data.get('code')
        
        if not email or not code:
            raise HTTPException(status_code=400, detail="Email and verification code are required")
        
        # Use standard confirm_sign_up method
        cognito_client.confirm_sign_up(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email,
            ConfirmationCode=code
        )
        
        return {"success": True, "message": "Email verified successfully! You can now sign in."}
        
    except cognito_client.exceptions.CodeMismatchException:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    except cognito_client.exceptions.ExpiredCodeException:
        raise HTTPException(status_code=400, detail="Verification code has expired")
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        raise HTTPException(status_code=500, detail="Email verification failed")

@app.post("/api/auth/resend-verification")
async def resend_verification(email_data: dict):
    """Resend email verification code using standard method"""
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = email_data.get('email')
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        # Use standard resend_confirmation_code method
        cognito_client.resend_confirmation_code(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email
        )
        
        return {"success": True, "message": "Verification email resent successfully"}
        
    except Exception as e:
        logger.error(f"Resend verification error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to resend verification email")

@app.post("/api/auth/forgot-password")
async def forgot_password(email_data: dict):
    """Send password reset email"""
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = email_data.get('email')
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        logger.info(f"Password reset request for: {email}")
        
        # Find user by email
        response = cognito_client.list_users(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            Filter=f'email = "{email}"'
        )
        
        if response.get('Users'):
            username = response['Users'][0]['Username']
            cognito_client.admin_reset_user_password(
                UserPoolId=COGNITO_CONFIG['user_pool_id'],
                Username=username
            )
        
        # Always return success for security (don't reveal if user exists)
        return {"success": True, "message": "If an account exists with this email, password reset instructions have been sent."}
        
    except Exception as e:
        logger.error(f"Password reset error: {str(e)}")
        # Return success even on error for security
        return {"success": True, "message": "If an account exists with this email, password reset instructions have been sent."}

@app.post("/api/auth/reset-password")
async def reset_password(reset_data: dict):
    """Confirm password reset with code"""
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = reset_data.get('email')
        code = reset_data.get('code')
        new_password = reset_data.get('password')
        
        if not all([email, code, new_password]):
            raise HTTPException(status_code=400, detail="Email, verification code, and new password are required")
        
        cognito_client.confirm_forgot_password(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email,
            ConfirmationCode=code,
            Password=new_password
        )
        
        return {"success": True, "message": "Password reset successful! You can now sign in with your new password."}
        
    except cognito_client.exceptions.CodeMismatchException:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    except cognito_client.exceptions.ExpiredCodeException:
        raise HTTPException(status_code=400, detail="Reset code has expired")
    except cognito_client.exceptions.InvalidPasswordException:
        raise HTTPException(status_code=400, detail="Password does not meet requirements")
    except Exception as e:
        logger.error(f"Password reset confirmation error: {str(e)}")
        raise HTTPException(status_code=400, detail="Password reset failed")
    
@app.post("/api/auth/login")
async def login(credentials: dict, response: Response):
    """Authenticate user with Cognito and set secure cookie"""
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        logger.info(f"Login attempt for user: {credentials.get('email')}")
        
        auth_response = cognito_client.admin_initiate_auth(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            ClientId=COGNITO_CONFIG['client_id'],
            AuthFlow='ADMIN_NO_SRP_AUTH',
            AuthParameters={
                'USERNAME': credentials['email'],
                'PASSWORD': credentials['password']
            }
        )
        
        auth_result = auth_response['AuthenticationResult']
        id_token = auth_result['IdToken']
        
        response.set_cookie(
            key=COOKIE_CONFIG["name"],
            value=id_token,
            max_age=COOKIE_CONFIG["max_age"],
            httponly=COOKIE_CONFIG["httponly"],
            secure=COOKIE_CONFIG["secure"],
            samesite=COOKIE_CONFIG["samesite"],
            path=COOKIE_CONFIG["path"]
        )
        
        user_claims = verify_cognito_token(id_token)
        
        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "email": user_claims.get("email"),
                "given_name": user_claims.get("given_name"),
                "family_name": user_claims.get("family_name"),
                "favorite_team": user_claims.get("custom:favorite_team")
            }
        }
        
    except cognito_client.exceptions.NotAuthorizedException:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except cognito_client.exceptions.UserNotFoundException:
        raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@app.post("/api/auth/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    """Logout user by clearing the authentication cookie"""
    response.delete_cookie(
        key=COOKIE_CONFIG["name"],
        path=COOKIE_CONFIG["path"],
        samesite=COOKIE_CONFIG["samesite"],
        secure=COOKIE_CONFIG["secure"]
    )
    
    logger.info(f"User {current_user.get('email')} logged out successfully")
    return {"success": True, "message": "Logged out successfully"}

@app.get("/api/auth/user")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile information"""
    return {
        "email": current_user.get("email"),
        "given_name": current_user.get("given_name"),
        "family_name": current_user.get("family_name"),
        "favorite_team": current_user.get("custom:favorite_team"),
        "user_id": current_user.get("sub")
    }

@app.put("/api/auth/update-profile")
async def update_profile(profile_data: dict, current_user: dict = Depends(get_current_user)):
    """Update user profile information in Cognito"""
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        logger.info(f"Profile update attempt for user: {current_user.get('email')}")
        
        # Build the attributes to update
        user_attributes = []
        
        if profile_data.get('firstName'):
            user_attributes.append({
                'Name': 'given_name',
                'Value': profile_data['firstName']
            })
        
        if profile_data.get('lastName'):
            user_attributes.append({
                'Name': 'family_name',
                'Value': profile_data['lastName']
            })
        
        if profile_data.get('favoriteTeam'):
            user_attributes.append({
                'Name': 'custom:favorite_team',
                'Value': profile_data['favoriteTeam']
            })
        elif 'favoriteTeam' in profile_data and profile_data['favoriteTeam'] == '':
            # Clear favorite team if empty string is sent
            user_attributes.append({
                'Name': 'custom:favorite_team',
                'Value': ''
            })
        
        if not user_attributes:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        # Update user attributes in Cognito
        cognito_client.admin_update_user_attributes(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            Username=current_user.get('email'),  # Use email as username
            UserAttributes=user_attributes
        )
        
        logger.info(f"Profile updated successfully for user: {current_user.get('email')}")
        
        # Return updated profile information
        return {
            "success": True,
            "message": "Profile updated successfully",
            "updated_fields": {
                "firstName": profile_data.get('firstName'),
                "lastName": profile_data.get('lastName'),
                "favoriteTeam": profile_data.get('favoriteTeam')
            }
        }
        
    except cognito_client.exceptions.UserNotFoundException:
        raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        logger.error(f"Profile update error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Profile update failed: {str(e)}")

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
    limit: int = Query(1000, le=2000),  # Increased limit, removed 100 cap
    offset: int = Query(0, ge=0),
    position: Optional[str] = None,
    team: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get MLB players with comprehensive filtering and position-specific data"""
    try:
        logger.info(f"Fetching players for user: {current_user.get('email')}")
        
        # Base query with all essential fields
        base_sql = """
        SELECT 
            player_id,
            mlb_id,
            first_name,
            last_name,
            position,
            mlb_team,
            jersey_number,
            birthdate,
            height_inches,
            weight_pounds,
            bats,
            throws,
            is_active,
            injury_status,
            salary
        FROM mlb_players
        WHERE 1=1
        """
        
        parameters = []
        
        # Apply filters
        if active_only:
            base_sql += " AND is_active = :active"
            parameters.append({
                'name': 'active',
                'value': {'booleanValue': True}
            })
        
        if position:
            base_sql += " AND position = :position"
            parameters.append({
                'name': 'position',
                'value': {'stringValue': position}
            })
        
        if team:
            base_sql += " AND mlb_team = :team"
            parameters.append({
                'name': 'team',
                'value': {'stringValue': team}
            })
        
        if search:
            base_sql += " AND (first_name ILIKE :search OR last_name ILIKE :search)"
            search_param = f"%{search}%"
            parameters.append({
                'name': 'search',
                'value': {'stringValue': search_param}
            })
        
        base_sql += " ORDER BY last_name, first_name LIMIT :limit OFFSET :offset"
        parameters.extend([
            {'name': 'limit', 'value': {'longValue': limit}},
            {'name': 'offset', 'value': {'longValue': offset}}
        ])
        
        # Execute query
        response = execute_sql(base_sql, parameters)
        print(f"DEBUG: Raw database response keys: {list(response.keys()) if response else 'None'}")
        print(f"DEBUG: Number of records: {len(response.get('records', []))}")
        
        # FIXED: Pass the entire response object
        players = format_player_data(
            response.get('records', []), 
            response  # CHANGED: Pass full response instead of response.get('resultMetadata', {})
        )
        
        print(f"DEBUG: Formatted players count: {len(players)}")
        print(f"DEBUG: First player (if any): {players[0] if players else 'None'}")

        # Get total count for pagination
        count_sql = """
        SELECT COUNT(*) as total_count 
        FROM mlb_players 
        WHERE is_active = :active
        """
        count_params = [{'name': 'active', 'value': {'booleanValue': active_only}}]
        
        if position:
            count_sql += " AND position = :position"
            count_params.append({'name': 'position', 'value': {'stringValue': position}})
        
        if team:
            count_sql += " AND mlb_team = :team"
            count_params.append({'name': 'team', 'value': {'stringValue': team}})
        
        if search:
            count_sql += " AND (first_name ILIKE :search OR last_name ILIKE :search)"
            count_params.append({'name': 'search', 'value': {'stringValue': f"%{search}%"}})
        
        count_response = execute_sql(count_sql, count_params)
        total_count = 0
        if count_response.get('records'):
            total_count = count_response['records'][0][0].get('longValue', 0)
        
        return {
            "players": players,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(players) < total_count
            },
            "filters": {
                "position": position,
                "team": team,
                "search": search,
                "active_only": active_only
            },
            "data_source": "database",
            "authenticated_user": current_user.get('email')
        }
        
    except Exception as e:
        logger.error(f"Get players error: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch players: {str(e)}")

# Replace the get_player_details function in your fantasy_api.py with this fixed version:

@app.get("/api/players/{player_id}")
async def get_player_details(
    player_id: int,
    include_stats: bool = True,
    season_year: int = 2025,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information for a specific player including stats"""
    try:
        # Get player basic info
        sql = """
        SELECT 
            player_id, mlb_id, first_name, last_name, position, mlb_team,
            jersey_number, birthdate, height_inches, weight_pounds, bats, throws,
            is_active, injury_status, salary
        FROM mlb_players 
        WHERE player_id = :player_id
        """
        
        parameters = [{'name': 'player_id', 'value': {'longValue': player_id}}]
        response = execute_sql(sql, parameters)
        
        if not response.get('records'):
            raise HTTPException(status_code=404, detail="Player not found")
        
        # FIXED: Pass the entire response object
        players = format_player_data(response['records'], response)
        player = players[0] if players else None
        
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        
        result = {"player": player}
        
        # Get player stats if requested
        if include_stats:
            try:
                # FIXED: Use only columns that actually exist in your database
                stats_sql = """
                SELECT 
                    week_number, season_year, games_played, at_bats, hits, runs, rbis, home_runs,
                    doubles, triples, stolen_bases, walks, strikeouts, hit_by_pitch,
                    innings_pitched, wins, losses, saves, holds, blown_saves, earned_runs,
                    hits_allowed, walks_allowed, strikeouts_pitched, era, whip,
                    avg, obp, slg, ops, fantasy_points
                FROM player_stats 
                WHERE player_id = :player_id AND season_year = :season_year
                ORDER BY week_number DESC
                LIMIT 52
                """
                
                stats_params = [
                    {'name': 'player_id', 'value': {'longValue': player_id}},
                    {'name': 'season_year', 'value': {'longValue': season_year}}
                ]
                
                logger.info(f"Fetching stats for player {player_id}, season {season_year}")
                stats_response = execute_sql(stats_sql, stats_params)
                
                logger.info(f"Stats query returned {len(stats_response.get('records', []))} records")
                
                # FIXED: Pass the entire response object
                stats = format_player_data(
                    stats_response.get('records', []), 
                    stats_response
                )
                
                logger.info(f"Formatted {len(stats)} stat records for player {player_id}")
                
                result["stats"] = stats
                result["season_year"] = season_year
                
            except Exception as stats_error:
                logger.error(f"Could not fetch stats for player {player_id}: {stats_error}")
                logger.error(f"Stats error traceback: {traceback.format_exc()}")
                result["stats"] = []
                result["stats_error"] = str(stats_error)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get player details error: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to fetch player details")

@app.get("/api/players/positions")
async def get_available_positions(current_user: dict = Depends(get_current_user)):
    """Get all available player positions"""
    try:
        sql = """
        SELECT DISTINCT position, COUNT(*) as player_count
        FROM mlb_players 
        WHERE is_active = true
        GROUP BY position
        ORDER BY position
        """
        
        response = execute_sql(sql)
        # FIXED: Pass the entire response object
        positions = format_player_data(response.get('records', []), response)  # CHANGED
        
        return {"positions": positions}
        
    except Exception as e:
        logger.error(f"Get positions error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch positions")

@app.get("/api/players/teams")
async def get_available_teams(current_user: dict = Depends(get_current_user)):
    """Get all MLB teams"""
    try:
        sql = """
        SELECT DISTINCT mlb_team, COUNT(*) as player_count
        FROM mlb_players 
        WHERE is_active = true
        GROUP BY mlb_team
        ORDER BY mlb_team
        """
        
        response = execute_sql(sql)
        # FIXED: Pass the entire response object
        teams = format_player_data(response.get('records', []), response)  # CHANGED
        
        return {"teams": teams}
        
    except Exception as e:
        logger.error(f"Get teams error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch teams")

# ==================== DEBUG ENDPOINTS ====================

@app.get("/api/debug/database")
async def debug_database():
    """Debug database connection and data"""
    try:
        # Test basic connection
        sql = "SELECT current_database(), current_user, version()"
        response = execute_sql(sql)
        
        # FIXED: Pass the entire response object
        connection_info = format_player_data(
            response.get('records', []), 
            response  # CHANGED
        )
        
        # Test player table
        count_sql = "SELECT COUNT(*) as total_players FROM mlb_players"
        count_response = execute_sql(count_sql)
        
        player_count = 0
        if count_response.get('records'):
            player_count = count_response['records'][0][0].get('longValue', 0)
        
        # Test table structure
        structure_sql = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'mlb_players'
        ORDER BY ordinal_position
        """
        structure_response = execute_sql(structure_sql)
        
        # FIXED: Pass the entire response object
        table_structure = format_player_data(
            structure_response.get('records', []), 
            structure_response  # CHANGED
        )
        
        return {
            "success": True,
            "connection_info": connection_info,
            "player_count": player_count,
            "table_structure": table_structure,
            "database_config": {
                "resource_arn": DATABASE_CONFIG['resourceArn'],
                "database": DATABASE_CONFIG['database']
            }
        }
        
    except Exception as e:
        logger.error(f"Database debug error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Database connection failed"
        }

@app.get("/api/debug/sample-players")
async def debug_sample_players():
    """Get a small sample of players for debugging"""
    try:
        sql = """
        SELECT player_id, first_name, last_name, position, mlb_team, is_active
        FROM mlb_players 
        LIMIT 10
        """
        
        response = execute_sql(sql)
        # FIXED: Pass the entire response object
        players = format_player_data(response.get('records', []), response)  # CHANGED
        
        return {
            "success": True,
            "sample_players": players,
            "count": len(players)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "service": "Fantasy Baseball API",
        "version": "4.0.0",
        "authentication": "secure_cookies",
        "database": "checking...",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Test database connection
    try:
        sql = "SELECT 1 as health_check"
        response = execute_sql(sql)
        if response.get('records'):
            health_status["database"] = "connected"
        else:
            health_status["database"] = "no_response"
    except Exception as e:
        health_status["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    return health_status

# ==================== ROOT ENDPOINT ====================

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Fantasy Baseball API v4.0 - Complete MLB Data Platform",
        "features": [
            "Secure Cookie Authentication",
            "Real MLB Player Database",
            "Position-Specific Statistics",
            "Advanced Filtering & Search",
            "User Profile Management",
            "Comprehensive Player Data"
        ],
        "endpoints": {
            "authentication": "/api/auth/*",
            "players": "/api/players",
            "health": "/api/health",
            "debug": "/api/debug/*",
            "documentation": "/docs"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)