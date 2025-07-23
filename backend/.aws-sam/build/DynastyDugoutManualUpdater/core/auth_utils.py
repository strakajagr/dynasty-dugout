"""
Dynasty Dugout - Authentication Utilities
JWT token verification and user management
"""

import json
import jwt
import requests
import logging
from typing import Dict, Any
from fastapi import HTTPException, Depends, Request

from .config import COGNITO_CONFIG, COOKIE_CONFIG

logger = logging.getLogger(__name__)

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