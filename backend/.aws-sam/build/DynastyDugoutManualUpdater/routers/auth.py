"""
Dynasty Dugout - Authentication Router
Login, signup, password reset, and user management
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request, Response

from core.auth_utils import get_current_user, verify_cognito_token
from core.aws_clients import get_cognito_client
from core.config import COGNITO_CONFIG, COOKIE_CONFIG

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/signup")
async def signup(user_data: dict):
    """Register a new user with Cognito using standard sign_up method"""
    cognito_client = get_cognito_client()
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

@router.post("/verify-email")
async def verify_email(verification_data: dict):
    """Verify email with confirmation code using standard method"""
    cognito_client = get_cognito_client()
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

@router.post("/resend-verification")
async def resend_verification(email_data: dict):
    """Resend email verification code using standard method"""
    cognito_client = get_cognito_client()
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

@router.post("/forgot-password")
async def forgot_password(email_data: dict):
    """Send password reset email"""
    cognito_client = get_cognito_client()
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

@router.post("/reset-password")
async def reset_password(reset_data: dict):
    """Confirm password reset with code"""
    cognito_client = get_cognito_client()
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
    
@router.post("/login")
async def login(credentials: dict, response: Response):
    """Authenticate user with Cognito and set secure cookie"""
    cognito_client = get_cognito_client()
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

@router.post("/logout")
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

@router.get("/user")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile information"""
    return {
        "email": current_user.get("email"),
        "given_name": current_user.get("given_name"),
        "family_name": current_user.get("family_name"),
        "favorite_team": current_user.get("custom:favorite_team"),
        "user_id": current_user.get("sub")
    }

@router.get("/status")
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