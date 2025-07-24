"""
Dynasty Dugout - Authentication Router
Login, signup, password reset, and user management
FIXED: Enhanced email verification with proper error handling
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request, Response
import boto3

from core.auth_utils import get_current_user, verify_cognito_token
from core.aws_clients import get_cognito_client
from core.config import COGNITO_CONFIG, COOKIE_CONFIG

logger = logging.getLogger(__name__)
router = APIRouter()

def verify_ses_configuration():
    """Check if SES is properly configured for sending emails"""
    try:
        ses_client = boto3.client('ses', region_name='us-east-1')
        verified_emails = ses_client.list_verified_email_addresses()
        
        if not verified_emails.get('VerifiedEmailAddresses'):
            logger.warning("⚠️ SES has no verified email addresses - email verification will fail")
            return False
        
        return True
    except Exception as e:
        logger.error(f"SES configuration check failed: {e}")
        return False

@router.post("/signup")
async def signup(user_data: dict):
    """Register a new user with Cognito using standard sign_up method"""
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    # Check SES configuration before attempting signup
    ses_configured = verify_ses_configuration()
    if not ses_configured:
        logger.error("🚨 SES not configured - signup will fail at email verification step")
    
    try:
        logger.info(f"🔐 Signup attempt for user: {user_data.get('email')}")
        
        # Validate required fields
        required_fields = ['email', 'firstName', 'lastName', 'password']
        for field in required_fields:
            if not user_data.get(field):
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Validate email format
        email = user_data['email'].lower().strip()
        if '@' not in email or '.' not in email:
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Check if user with this email already exists
        try:
            response = cognito_client.list_users(
                UserPoolId=COGNITO_CONFIG['user_pool_id'],
                Filter=f'email = "{email}"'
            )
            if response.get('Users'):
                # Check if user is already verified
                user = response['Users'][0]
                if user.get('UserStatus') == 'CONFIRMED':
                    raise HTTPException(status_code=400, detail="An account with this email already exists and is verified")
                elif user.get('UserStatus') == 'UNCONFIRMED':
                    # User exists but not verified - allow resend
                    logger.info(f"User {email} exists but unconfirmed - allowing resend")
                    try:
                        cognito_client.resend_confirmation_code(
                            ClientId=COGNITO_CONFIG['client_id'],
                            Username=email
                        )
                        return {
                            "success": True,
                            "message": "Account already exists. Verification email resent! Please check your email.",
                            "requiresVerification": True
                        }
                    except Exception as resend_error:
                        logger.error(f"Failed to resend verification: {resend_error}")
                        raise HTTPException(status_code=500, detail="Failed to resend verification email. Please contact support.")
        except HTTPException:
            raise
        except Exception as filter_error:
            logger.warning(f"Could not check for existing user: {filter_error}")
        
        # Build user attributes for standard signup
        user_attributes = [
            {'Name': 'email', 'Value': email},
            {'Name': 'given_name', 'Value': user_data['firstName'].strip()},
            {'Name': 'family_name', 'Value': user_data['lastName'].strip()}
        ]
        
        if user_data.get('favoriteTeam'):
            user_attributes.append({
                'Name': 'custom:favorite_team', 
                'Value': user_data['favoriteTeam']
            })
        
        # Use standard sign_up method instead of admin_create_user
        logger.info(f"📧 Creating Cognito user for {email}")
        response = cognito_client.sign_up(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email,
            Password=user_data['password'],
            UserAttributes=user_attributes
        )
        
        logger.info(f"✅ User {email} created successfully. UserSub: {response.get('UserSub')}")
        
        # Additional SES warning if not configured
        message = "Account created successfully! Please check your email for a verification code."
        if not ses_configured:
            logger.error(f"🚨 CRITICAL: User {email} created but SES not configured - verification email won't be sent!")
            message += " ⚠️ If you don't receive an email, please contact support."
        
        return {
            "success": True, 
            "message": message,
            "requiresVerification": True,
            "userSub": response.get('UserSub')
        }
        
    except HTTPException:
        raise
    except cognito_client.exceptions.UsernameExistsException:
        logger.warning(f"Username exists exception for {user_data.get('email')}")
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    except cognito_client.exceptions.InvalidPasswordException as e:
        logger.warning(f"Invalid password for {user_data.get('email')}: {e}")
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters with uppercase, lowercase, and numbers")
    except Exception as e:
        logger.error(f"💥 Signup error for {user_data.get('email')}: {str(e)}")
        # Check if it's an SES related error
        if 'email' in str(e).lower() or 'verification' in str(e).lower():
            raise HTTPException(status_code=500, detail="Account created but email verification failed. Please contact support.")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/verify-email")
async def verify_email(verification_data: dict):
    """Verify email with confirmation code using standard method"""
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = verification_data.get('email', '').lower().strip()
        code = verification_data.get('code', '').strip()
        
        if not email or not code:
            raise HTTPException(status_code=400, detail="Email and verification code are required")
        
        logger.info(f"📧 Email verification attempt for: {email}")
        
        # Use standard confirm_sign_up method
        response = cognito_client.confirm_sign_up(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email,
            ConfirmationCode=code
        )
        
        logger.info(f"✅ Email verified successfully for: {email}")
        return {"success": True, "message": "Email verified successfully! You can now sign in."}
        
    except cognito_client.exceptions.CodeMismatchException:
        logger.warning(f"Invalid verification code for {email}")
        raise HTTPException(status_code=400, detail="Invalid verification code")
    except cognito_client.exceptions.ExpiredCodeException:
        logger.warning(f"Expired verification code for {email}")
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
    except cognito_client.exceptions.UserNotFoundException:
        logger.warning(f"User not found during verification: {email}")
        raise HTTPException(status_code=404, detail="User not found. Please sign up first.")
    except Exception as e:
        logger.error(f"💥 Email verification error for {email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Email verification failed. Please try again or contact support.")

@router.post("/resend-verification")
async def resend_verification(email_data: dict):
    """Resend email verification code using standard method"""
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    # Check SES configuration
    ses_configured = verify_ses_configuration()
    
    try:
        email = email_data.get('email', '').lower().strip()
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        logger.info(f"📧 Resend verification request for: {email}")
        
        # Check if user exists and is unconfirmed
        try:
            response = cognito_client.list_users(
                UserPoolId=COGNITO_CONFIG['user_pool_id'],
                Filter=f'email = "{email}"'
            )
            
            if not response.get('Users'):
                raise HTTPException(status_code=404, detail="No account found with this email address")
            
            user = response['Users'][0]
            if user.get('UserStatus') == 'CONFIRMED':
                raise HTTPException(status_code=400, detail="This email is already verified")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Could not check user status: {e}")
        
        # Use standard resend_confirmation_code method
        cognito_client.resend_confirmation_code(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email
        )
        
        message = "Verification email resent successfully"
        if not ses_configured:
            logger.error(f"🚨 CRITICAL: Verification resent for {email} but SES not configured!")
            message += " ⚠️ If you don't receive an email, please contact support."
        
        logger.info(f"✅ Verification code resent for: {email}")
        return {"success": True, "message": message}
        
    except HTTPException:
        raise
    except cognito_client.exceptions.UserNotFoundException:
        raise HTTPException(status_code=404, detail="No account found with this email address")
    except Exception as e:
        logger.error(f"💥 Resend verification error for {email}: {str(e)}")
        if 'email' in str(e).lower():
            raise HTTPException(status_code=500, detail="Email service unavailable. Please contact support.")
        raise HTTPException(status_code=500, detail="Failed to resend verification email")

@router.post("/forgot-password")
async def forgot_password(email_data: dict):
    """Send password reset email"""
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = email_data.get('email', '').lower().strip()
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        logger.info(f"🔑 Password reset request for: {email}")
        
        # Use the standard forgot_password method instead of admin methods
        try:
            cognito_client.forgot_password(
                ClientId=COGNITO_CONFIG['client_id'],
                Username=email
            )
            logger.info(f"✅ Password reset email sent for: {email}")
        except cognito_client.exceptions.UserNotFoundException:
            logger.info(f"Password reset requested for non-existent user: {email}")
            # Still return success for security
        except Exception as e:
            logger.error(f"Password reset error for {email}: {e}")
            # Still return success for security
        
        # Always return success for security (don't reveal if user exists)
        return {"success": True, "message": "If an account exists with this email, password reset instructions have been sent."}
        
    except Exception as e:
        logger.error(f"💥 Password reset error: {str(e)}")
        # Return success even on error for security
        return {"success": True, "message": "If an account exists with this email, password reset instructions have been sent."}

@router.post("/reset-password")
async def reset_password(reset_data: dict):
    """Confirm password reset with code"""
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = reset_data.get('email', '').lower().strip()
        code = reset_data.get('code', '').strip()
        new_password = reset_data.get('password', '')
        
        if not all([email, code, new_password]):
            raise HTTPException(status_code=400, detail="Email, verification code, and new password are required")
        
        logger.info(f"🔑 Password reset confirmation for: {email}")
        
        cognito_client.confirm_forgot_password(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email,
            ConfirmationCode=code,
            Password=new_password
        )
        
        logger.info(f"✅ Password reset successful for: {email}")
        return {"success": True, "message": "Password reset successful! You can now sign in with your new password."}
        
    except cognito_client.exceptions.CodeMismatchException:
        logger.warning(f"Invalid reset code for {email}")
        raise HTTPException(status_code=400, detail="Invalid reset code")
    except cognito_client.exceptions.ExpiredCodeException:
        logger.warning(f"Expired reset code for {email}")
        raise HTTPException(status_code=400, detail="Reset code has expired")
    except cognito_client.exceptions.InvalidPasswordException:
        logger.warning(f"Invalid password format for {email}")
        raise HTTPException(status_code=400, detail="Password does not meet requirements")
    except Exception as e:
        logger.error(f"💥 Password reset confirmation error for {email}: {str(e)}")
        raise HTTPException(status_code=400, detail="Password reset failed")
    
@router.post("/login")
async def login(credentials: dict, response: Response):
    """Authenticate user with Cognito and set secure cookie"""
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = credentials.get('email', '').lower().strip()
        password = credentials.get('password', '')
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password are required")
        
        logger.info(f"🔐 Login attempt for user: {email}")
        
        auth_response = cognito_client.admin_initiate_auth(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            ClientId=COGNITO_CONFIG['client_id'],
            AuthFlow='ADMIN_NO_SRP_AUTH',
            AuthParameters={
                'USERNAME': email,
                'PASSWORD': password
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
        
        logger.info(f"✅ Login successful for: {email}")
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
        logger.warning(f"Invalid credentials for: {credentials.get('email')}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except cognito_client.exceptions.UserNotFoundException:
        logger.warning(f"User not found: {credentials.get('email')}")
        raise HTTPException(status_code=404, detail="User not found")
    except cognito_client.exceptions.UserNotConfirmedException:
        logger.warning(f"User not verified: {credentials.get('email')}")
        raise HTTPException(status_code=403, detail="Please verify your email address before signing in")
    except Exception as e:
        logger.error(f"💥 Login error for {credentials.get('email')}: {str(e)}")
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
    
    logger.info(f"👋 User {current_user.get('email')} logged out successfully")
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

# Debug endpoint to check email configuration
@router.get("/debug/email-config")
async def debug_email_config():
    """Debug endpoint to check email configuration (remove in production)"""
    try:
        ses_configured = verify_ses_configuration()
        
        ses_client = boto3.client('ses', region_name='us-east-1')
        verified_emails = ses_client.list_verified_email_addresses()
        quota = ses_client.get_send_quota()
        
        return {
            "ses_configured": ses_configured,
            "verified_emails": verified_emails.get('VerifiedEmailAddresses', []),
            "send_quota": quota,
            "region": "us-east-1"
        }
    except Exception as e:
        return {"error": str(e), "ses_configured": False}