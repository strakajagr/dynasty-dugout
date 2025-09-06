# file: backend/src/core/auth_utils.py

import json
import jwt
import requests
import logging
from typing import Dict, Any
from fastapi import HTTPException, Depends, Request
from botocore.exceptions import ClientError

# --- UPDATED IMPORTS ---
from .config import COGNITO_CONFIG, COOKIE_CONFIG
from .aws_clients import get_cognito_client

logger = logging.getLogger(__name__)
jwks_cache = None

# --- NEW FUNCTION FOR ACCESS TOKENS ---
def get_user_from_access_token(token: str) -> Dict[str, Any]:
    """
    Validates an Access Token directly with Cognito and returns user attributes.
    This is the secure way to handle Access Tokens for API authorization.
    """
    try:
        cognito_client = get_cognito_client()
        user_info = cognito_client.get_user(AccessToken=token)
        
        # Cognito returns attributes as a list of dicts, parse them into a single dict
        user_attrs = {attr['Name']: attr['Value'] for attr in user_info['UserAttributes']}
        user_attrs['sub'] = user_info['Username'] # Add the user's unique ID
        # user_attrs['sub'] = user_info['Username']  # Don't overwrite sub - it already has the UUID
        return user_attrs
    except ClientError as e:
        if e.response['Error']['Code'] in ['NotAuthorizedException', 'ResourceNotFoundException']:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        else:
            logger.error(f"Cognito get_user error: {e}")
            raise HTTPException(status_code=500, detail="Authentication service error")

# --- UPDATED DEPENDENCY FUNCTION ---
def get_current_user(request: Request) -> Dict[str, Any]:
    """Dependency to get current authenticated user from the Access Token cookie."""
    token = request.cookies.get(COOKIE_CONFIG["name"])
    
    if not token:
        # Fallback for local testing with 'sam local invoke'
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        else:
            raise HTTPException(status_code=401, detail="Authentication required")
    
    # Use the new, correct validation method for Access Tokens
    return get_user_from_access_token(token)

# --- ORIGINAL ID TOKEN VERIFICATION (Still needed by /login endpoint) ---
def get_jwks():
    """Get JSON Web Key Set from Cognito"""
    global jwks_cache
    if not jwks_cache:
        try:
            response = requests.get(COGNITO_CONFIG["jwks_url"], timeout=10)
            response.raise_for_status()
            jwks_cache = response.json()
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
    return jwks_cache

def verify_cognito_token(token: str) -> Dict[str, Any]:
    """
    Verify a Cognito ID TOKEN (not Access Token). 
    Used by the /login endpoint to get user details for the immediate response.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header['kid']
        
        jwks = get_jwks()
        key = next((jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk)) for jwk in jwks['keys'] if jwk['kid'] == kid), None)
        
        if not key:
            raise HTTPException(status_code=401, detail="Invalid token - key not found")
        
        return jwt.decode(
            token, key, algorithms=['RS256'],
            audience=COGNITO_CONFIG["client_id"],
            issuer=f"https://cognito-idp.{COGNITO_CONFIG['region']}.amazonaws.com/{COGNITO_CONFIG['user_pool_id']}"
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"ID Token verification error: {str(e)}")
        raise HTTPException(status_code=401, detail="ID Token verification failed")