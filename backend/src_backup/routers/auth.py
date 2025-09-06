import logging
import sys
from fastapi import APIRouter, HTTPException, Depends, Request, Response
import boto3
from botocore.exceptions import ClientError
from pydantic import BaseModel # Import BaseModel
from datetime import datetime, timezone # Added for timestamp handling in logout if needed

# Corrected Imports:
# get_cognito_client comes from core.aws_clients
# verify_cognito_token and get_current_user come from core.auth_utils
# COGNITO_CONFIG and COOKIE_CONFIG come from core.config
from core.aws_clients import get_cognito_client
from core.auth_utils import verify_cognito_token, get_current_user, get_user_from_access_token # ADDED get_user_from_access_token
from core.config import COGNITO_CONFIG, COOKIE_CONFIG

# Configure logging for this module
logging.basicConfig(level=logging.INFO, stream=sys.stdout) # Ensure stream=sys.stdout for CloudWatch
logger = logging.getLogger(__name__)

# Add print statement for auth.py startup
print("--- auth.py: Module Start (Full Version) ---") # Updated message for clarity
logger.info("--- auth.py: Logger configured, full module start ---")

router = APIRouter()

# Define a Pydantic model for the signup request body
class SignupRequest(BaseModel):
    email: str
    password: str
    firstName: str
    lastName: str
    favoriteTeam: str = None # Make optional with a default None

# Define Pydantic models for other endpoints where dict was used, for clarity and validation
class EmailRequest(BaseModel):
    email: str

class VerificationRequest(BaseModel):
    email: str
    code: str = None # Support both 'code' and 'verification_code' via logic
    verification_code: str = None

class PasswordResetRequest(BaseModel):
    email: str
    code: str
    password: str # New password

class LoginRequest(BaseModel):
    email: str
    password: str

# Minimal SES check for debugging, or comment out if it's causing issues
def verify_ses_configuration():
    logger.info("--- auth.py: Checking SES configuration ---")
    try:
        ses_client = boto3.client('ses', region_name='us-east-1')
        verified_emails = ses_client.list_verified_email_addresses()
        if not verified_emails.get('VerifiedEmailAddresses'):
            logger.warning("--- auth.py: SES: No verified email addresses - email verification will fail ---")
            return False
        logger.info("--- auth.py: SES: At least one verified email address found ---")
        return True
    except Exception as e:
        logger.error(f"--- auth.py: SES configuration check FAILED: {e}", exc_info=True)
        return False

@router.post("/signup")
async def signup(user_data: SignupRequest): # Changed 'dict' to 'SignupRequest'
    logger.info(f"--- auth.py: /signup endpoint HIT. Received data: {user_data.model_dump()} ---") # Use .model_dump() for logging Pydantic object
    
    cognito_client = None
    try:
        cognito_client = get_cognito_client()
        if not cognito_client:
            logger.error("--- auth.py: Cognito client not initialized. ---")
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
        logger.info("--- auth.py: Cognito client initialized. ---")
    except Exception as e:
        logger.critical(f"--- auth.py: ERROR getting Cognito client: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Authentication service unavailable due to client error.")

    # Check SES configuration before attempting signup
    ses_configured = verify_ses_configuration()
    if not ses_configured:
        logger.warning("--- auth.py: SES not configured. Signup will attempt but email verification may fail. ---")

    try:
        # Pydantic handles basic validation; additional checks can be here
        email = user_data.email.lower().strip()
        password = user_data.password
        firstName = user_data.firstName.strip()
        lastName = user_data.lastName.strip()
        favoriteTeam = user_data.favoriteTeam.strip() if user_data.favoriteTeam else None

        if '@' not in email or '.' not in email:
            logger.error(f"--- auth.py: Invalid email format: {email} ---")
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Check if user with this email already exists (Cognito user pool filter)
        try:
            response_list_users = cognito_client.list_users(
                UserPoolId=COGNITO_CONFIG['user_pool_id'],
                Filter=f'email = "{email}"'
            )
            if response_list_users.get('Users'):
                user = response_list_users['Users'][0]
                if user.get('UserStatus') == 'CONFIRMED':
                    raise HTTPException(status_code=400, detail="An account with this email already exists and is verified")
                elif user.get('UserStatus') == 'UNCONFIRMED':
                    logger.info(f"--- auth.py: User {email} exists but unconfirmed - allowing resend ---")
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
                        logger.error(f"--- auth.py: Failed to resend verification: {resend_error}", exc_info=True)
                        raise HTTPException(status_code=500, detail="Failed to resend verification email. Please contact support.")
        except HTTPException:
            raise # Re-raise if it's our own HTTPException
        except Exception as filter_error:
            logger.warning(f"--- auth.py: Could not check for existing user: {filter_error}", exc_info=True)
        
        logger.info(f"--- auth.py: All initial validation passed for {email}. Attempting Cognito signup. ---")

        user_attributes = [
            {'Name': 'email', 'Value': email},
            {'Name': 'given_name', 'Value': firstName},
            {'Name': 'family_name', 'Value': lastName},
        ]
        if favoriteTeam: # Conditionally add custom attribute
            user_attributes.append({'Name': 'custom:favorite_team', 'Value': favoriteTeam})
        
        # Use standard sign_up method
        logger.info(f"--- auth.py: Creating Cognito user for {email} with attributes: {user_attributes} ---")
        response = cognito_client.sign_up(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email,
            Password=password,
            UserAttributes=user_attributes
        )
        
        logger.info(f"--- auth.py: Cognito sign_up successful for {email}. UserSub: {response.get('UserSub')} ---")
        
        message = "Account created successfully! Please check your email for a verification code."
        if not ses_configured:
            logger.warning(f"--- auth.py: SES not configured. Email for {email} might not be sent. ---")
            message += " ⚠️ If you don't receive an email, please contact support."
        
        return {
            "success": True, 
            "message": message,
            "requiresVerification": True,
            "userSub": response.get('UserSub')
        }
        
    except HTTPException:
        logger.error(f"--- auth.py: Caught HTTPException during signup for {email}. Re-raising. ---", exc_info=True)
        raise
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"--- auth.py: Cognito ClientError for {email}: {error_code} - {error_message} ---", exc_info=True)
        if error_code == 'UsernameExistsException':
            raise HTTPException(status_code=400, detail="An account with this email already exists")
        elif error_code == 'InvalidPasswordException':
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters with uppercase, lowercase, and numbers")
        else:
            raise HTTPException(status_code=500, detail=f"Registration failed: {error_message}")
    except Exception as e:
        logger.critical(f"--- auth.py: UNEXPECTED ERROR during signup for {email}: {e}", exc_info=True)
        if 'email' in str(e).lower() or 'verification' in str(e).lower():
            raise HTTPException(status_code=500, detail="Account created but email verification failed. Please contact support.")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/verify-email")
async def verify_email(verification_data: VerificationRequest): # Changed to use Pydantic model
    logger.info(f"--- auth.py: /verify-email endpoint HIT. Received data: {verification_data.model_dump()} ---")
    cognito_client = None
    try:
        cognito_client = get_cognito_client()
        if not cognito_client:
            logger.error("--- auth.py: Cognito client not initialized. ---")
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
    except Exception as e:
        logger.critical(f"--- auth.py: ERROR getting Cognito client in verify-email: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Authentication service unavailable due to client error.")
    
    email = verification_data.email.lower().strip()
    code = verification_data.code or verification_data.verification_code # Support both 'code' and 'verification_code'

    if not email or not code: # This check is now redundant if fields are required in BaseModel
        raise HTTPException(status_code=400, detail="Email and verification code are required")

    try:
        logger.info(f"--- auth.py: Email verification attempt for: {email} with code: {code[:3]}... ---") # Log code partially for security
        response = cognito_client.confirm_sign_up(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email,
            ConfirmationCode=code
        )
        logger.info(f"--- auth.py: Email verification successful for: {email} ---")
        return {"success": True, "message": "Email verified successfully! You can now sign in.", "verified": True}
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"--- auth.py: Cognito verification ClientError for {email}: {error_code} - {error_message} ---", exc_info=True)
        if error_code == 'CodeMismatchException':
            raise HTTPException(status_code=400, detail="Invalid verification code. Please check your email and try again.")
        elif error_code == 'ExpiredCodeException':
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
        elif error_code == 'UserNotFoundException':
            raise HTTPException(status_code=404, detail="User not found. Please sign up first.")
        elif error_code == 'NotAuthorizedException':
            raise HTTPException(status_code=400, detail="User is already verified or verification failed.")
        else:
            raise HTTPException(status_code=500, detail=f"Email verification failed: {error_message}")
    except Exception as e:
        logger.critical(f"--- auth.py: UNEXPECTED ERROR during email verification for {email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Email verification failed. Please try again or contact support.")

@router.post("/resend-verification")
async def resend_verification(email_data: EmailRequest): # Changed to use Pydantic model
    """Resend email verification code using standard method"""
    logger.info(f"--- auth.py: /resend-verification endpoint HIT. Received data: {email_data.model_dump()} ---")
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    # Check SES configuration
    ses_configured = verify_ses_configuration()
    
    try:
        email = email_data.email.lower().strip()
        
        logger.info(f"--- auth.py: Resend verification request for: {email} ---")
        
        # Check if user exists and is unconfirmed
        try:
            response_list_users = cognito_client.list_users(
                UserPoolId=COGNITO_CONFIG['user_pool_id'],
                Filter=f'email = "{email}"'
            )
            
            if not response_list_users.get('Users'):
                raise HTTPException(status_code=404, detail="No account found with this email address")
            
            user = response_list_users['Users'][0]
            if user.get('UserStatus') == 'CONFIRMED':
                raise HTTPException(status_code=400, detail="This email is already verified")
                
        except HTTPException:
            raise # Re-raise our own HTTPExceptions
        except Exception as e:
            logger.warning(f"--- auth.py: Could not check user status for {email}: {e}", exc_info=True)
        
        # Use standard resend_confirmation_code method
        cognito_client.resend_confirmation_code(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email
        )
        
        message = "Verification email resent successfully"
        if not ses_configured:
            logger.error(f"--- auth.py: CRITICAL: Verification resent for {email} but SES not configured! ---")
            message += " ⚠️ If you don't receive an email, please contact support."
        
        logger.info(f"--- auth.py: Verification code resent for: {email} ---")
        return {"success": True, "message": message}
        
    except HTTPException:
        raise
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"--- auth.py: Resend verification ClientError for {email}: {error_code} - {error_message} ---", exc_info=True)
        if error_code == 'UserNotFoundException':
            raise HTTPException(status_code=404, detail="No account found with this email address")
        else:
            raise HTTPException(status_code=500, detail="Failed to resend verification email")
    except Exception as e:
        logger.critical(f"--- auth.py: UNEXPECTED ERROR during resend verification for {email}: {e}", exc_info=True)
        if 'email' in str(e).lower():
            raise HTTPException(status_code=500, detail="Email service unavailable. Please contact support.")
        raise HTTPException(status_code=500, detail="Failed to resend verification email")

@router.post("/forgot-password")
async def forgot_password(email_data: EmailRequest): # Changed to use Pydantic model
    """Send password reset email"""
    logger.info(f"--- auth.py: /forgot-password endpoint HIT. Received data: {email_data.model_dump()} ---")
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = email_data.email.lower().strip()
        
        logger.info(f"--- auth.py: Password reset request for: {email} ---")
        
        # Use the standard forgot_password method instead of admin methods
        try:
            cognito_client.forgot_password(
                ClientId=COGNITO_CONFIG['client_id'],
                Username=email
            )
            logger.info(f"--- auth.py: Password reset email sent for: {email} ---")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.error(f"--- auth.py: Forgot password ClientError for {email}: {error_code} - {error_message} ---", exc_info=True)
            if error_code == 'UserNotFoundException':
                logger.info(f"--- auth.py: Password reset requested for non-existent user: {email} ---")
                # Still return success for security
            else:
                logger.error(f"--- auth.py: Password reset error for {email}: {e} ---", exc_info=True)
                # Still return success for security
        except Exception as e:
            logger.error(f"--- auth.py: Password reset error for {email}: {e} ---", exc_info=True)
            # Still return success for security
        
        # Always return success for security (don't reveal if user exists)
        return {"success": True, "message": "If an account exists with this email, password reset instructions have been sent."}
        
    except Exception as e:
        logger.critical(f"--- auth.py: UNEXPECTED ERROR during password reset: {e}", exc_info=True)
        # Return success even on error for security
        return {"success": True, "message": "If an account exists with this email, password reset instructions have been sent."}

@router.post("/reset-password")
async def reset_password(reset_data: PasswordResetRequest): # Changed to use Pydantic model
    """Confirm password reset with code"""
    logger.info(f"--- auth.py: /reset-password endpoint HIT. Received data: {reset_data.model_dump()} ---")
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        email = reset_data.email.lower().strip()
        code = reset_data.code.strip()
        new_password = reset_data.password # Renamed from new_password to password in model

        logger.info(f"--- auth.py: Password reset confirmation for: {email} ---")
        
        cognito_client.confirm_forgot_password(
            ClientId=COGNITO_CONFIG['client_id'],
            Username=email,
            ConfirmationCode=code,
            Password=new_password
        )
        
        logger.info(f"--- auth.py: Password reset successful for: {email} ---")
        return {"success": True, "message": "Password reset successful! You can now sign in with your new password."}
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"--- auth.py: Password reset confirmation ClientError for {email}: {error_code} - {error_message} ---", exc_info=True)
        if error_code == 'CodeMismatchException':
            raise HTTPException(status_code=400, detail="Invalid reset code")
        elif error_code == 'ExpiredCodeException':
            raise HTTPException(status_code=400, detail="Reset code has expired")
        elif error_code == 'InvalidPasswordException':
            raise HTTPException(status_code=400, detail="Password does not meet requirements")
        else:
            raise HTTPException(status_code=500, detail="Password reset failed")
    except Exception as e:
        logger.critical(f"--- auth.py: UNEXPECTED ERROR during password reset confirmation for {email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Password reset failed")
        
@router.post("/login")
async def login(credentials: LoginRequest, response: Response): # Changed to use Pydantic model
    """Authenticate user with Cognito and set secure cookie"""
    logger.info(f"--- auth.py: /login endpoint HIT for {credentials.email} ---")
    cognito_client = get_cognito_client()
    if not cognito_client:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    email = "" # Define email here to be available in the final exception block
    try:
        email = credentials.email.lower().strip()
        password = credentials.password
        
        logger.info(f"--- auth.py: Login attempt for user: {email} ---")
        
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
        
        # --- START OF THE FIX ---
        
        # Get BOTH tokens from the response
        access_token = auth_result['AccessToken']
        id_token = auth_result['IdToken']
        
        # 1. Use the Access Token for the cookie (the "key card")
        response.set_cookie(
            key=COOKIE_CONFIG["name"],
            value=access_token,
            max_age=COOKIE_CONFIG["max_age"],
            httponly=COOKIE_CONFIG["httponly"],
            secure=COOKIE_CONFIG["secure"],
            samesite=COOKIE_CONFIG["samesite"],
            path=COOKIE_CONFIG["path"]
        )
        
        # 2. Use the ID Token to get user details for the immediate response (the "driver's license")
        user_claims = verify_cognito_token(id_token)
        
        # --- END OF THE FIX ---
        
        logger.info(f"--- auth.py: Login successful for: {email} ---")
        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "email": user_claims.get("email"),
                "given_name": user_claims.get("given_name"),
                "family_name": user_claims.get("family_name"),
                "favorite_team": user_claims.get("custom:favorite_team"),
                "user_id": user_claims.get("sub")
            }
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"--- auth.py: Cognito login ClientError for {email}: {error_code} - {error_message} ---", exc_info=True)
        if error_code == 'NotAuthorizedException':
            raise HTTPException(status_code=401, detail="Invalid credentials")
        elif error_code == 'UserNotFoundException':
            raise HTTPException(status_code=404, detail="User not found")
        elif error_code == 'UserNotConfirmedException':
            raise HTTPException(status_code=403, detail="Please verify your email address before signing in")
        else:
            raise HTTPException(status_code=500, detail=f"Login failed: {error_message}")
    except Exception as e:
        logger.critical(f"--- auth.py: UNEXPECTED ERROR during login for {email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@router.post("/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    """Logout user by clearing the authentication cookie"""
    logger.info(f"--- auth.py: /logout endpoint HIT for user {current_user.get('email')} ---")
    response.delete_cookie(
        key=COOKIE_CONFIG["name"],
        path=COOKIE_CONFIG["path"],
        samesite=COOKIE_CONFIG["samesite"],
        secure=COOKIE_CONFIG["secure"]
    )
    
    logger.info(f"--- auth.py: User {current_user.get('email')} logged out successfully ---")
    return {"success": True, "message": "Logged out successfully"}

@router.get("/user")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile information"""
    logger.info(f"--- auth.py: /user endpoint HIT for user {current_user.get('email')} ---")
    return {
        "email": current_user.get("email"),
        "given_name": current_user.get("given_name"),
        "family_name": current_user.get("family_name"),
        "favorite_team": current_user.get("custom:favorite_team"),
        "user_id": current_user.get("sub")
    }

# THIS IS THE ONLY SECTION THAT HAS BEEN REPLACED
@router.get("/status")
async def auth_status(request: Request):
    """
    Checks authentication status using the access token from the cookie.
    This version is hardened to prevent 502 errors and handles exceptions gracefully.
    """
    logger.info("--- auth.py: /status endpoint HIT ---")
    
    try:
        token = request.cookies.get(COOKIE_CONFIG["name"])
        
        if not token:
            logger.info("--- auth.py: Auth status check: Not authenticated (no token) ---")
            return {"authenticated": False, "user": None}
            
        # This function returns a simple dict of claims or raises an HTTPException
        user_claims = get_user_from_access_token(token)
        
        # This is a defensive check. The auth_utils function should raise an
        # exception on failure rather than returning None, but we handle it just in case.
        if not user_claims:
            logger.warning("--- auth.py: Auth status check failed (token was invalid) ---")
            return {"authenticated": False, "user": None}

        email = user_claims.get("email")
        logger.info(f"--- auth.py: Auth status check: Authenticated as {email} ---")
        
        return {
            "authenticated": True,
            "user": {
                "email": email,
                "given_name": user_claims.get("given_name"),
                "family_name": user_claims.get("family_name"),
                "user_id": user_claims.get("sub")
            }
        }
        
    except HTTPException as e:
        # This specifically catches failures from get_user_from_access_token
        # (e.g., 401 Unauthorized) and prevents them from becoming a 502 error.
        logger.warning(f"--- auth.py: Auth status check failed (HTTPException): {e.detail} ---")
        return {"authenticated": False, "user": None}
    except Exception as e:
        # This is a final catch-all for any other unexpected server errors.
        logger.error(f"--- auth.py: Auth status check failed with an unexpected exception: {e} ---", exc_info=True)
        return {"authenticated": False, "user": None}

# Debug endpoint to check email configuration
@router.get("/debug/email-config")
async def debug_email_config():
    """Debug endpoint to check email configuration (remove in production)"""
    logger.info("--- auth.py: /debug/email-config endpoint HIT ---")
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
        logger.critical(f"--- auth.py: DEBUG EMAIL CONFIG FAILED: {e}", exc_info=True)
        return {"error": str(e), "ses_configured": False}

print("--- auth.py: Module End (Full Version) ---")
logger.info("--- auth.py: Full Module End logging ---")