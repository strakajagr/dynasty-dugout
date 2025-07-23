"""
Dynasty Dugout - Account Management Router
Profile updates, password changes, and account settings
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from botocore.exceptions import ClientError

from core.auth_utils import get_current_user
from core.aws_clients import get_cognito_client, get_s3_client
from core.config import COGNITO_CONFIG, ACCOUNT_CONFIG

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/profile")
async def get_user_profile_detailed(current_user: dict = Depends(get_current_user)):
    """Get detailed current user profile information for My Account page"""
    try:
        print(f"DEBUG: Getting detailed profile for user: {current_user.get('email')}")
        logger.info(f"Getting detailed profile for user: {current_user.get('email')}")
        
        cognito_client = get_cognito_client()
        if not cognito_client:
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
        
        # Get fresh user data from Cognito
        response = cognito_client.admin_get_user(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            Username=current_user.get('email')  # Use email as username
        )
        
        user_attributes = {}
        for attr in response['UserAttributes']:
            user_attributes[attr['Name']] = attr['Value']
        
        # Get extended profile from database
        user_id = current_user.get('sub')
        print(f"DEBUG: Getting database profile for user_id: {user_id}")
        
        try:
            from core.database import get_user_profile
            print("DEBUG: Database import successful")
            db_profile = get_user_profile(user_id)
            print(f"DEBUG: Database profile result: {db_profile}")
        except Exception as e:
            print(f"DEBUG: Database import/call error: {e}")
            db_profile = None
        
        profile_data = {
            'email': user_attributes.get('email', ''),
            'given_name': user_attributes.get('given_name', ''),
            'family_name': user_attributes.get('family_name', ''),
            'birthdate': db_profile.get('date_of_birth', '') if db_profile else '',
            'picture': db_profile.get('profile_picture_url', '') if db_profile else user_attributes.get('picture', ''),
            'email_verified': user_attributes.get('email_verified', 'false') == 'true',
            'created_at': response.get('UserCreateDate'),
            'last_modified': response.get('UserLastModifiedDate')
        }
        
        return {
            "success": True,
            "profile": profile_data
        }
        
    except Exception as e:
        print(f"DEBUG: Error getting user profile: {e}")
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")

@router.put("/update-profile")
async def update_user_profile_simple(
    profile_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile - both Cognito and database"""
    
    try:
        print(f"DEBUG: Profile update for user: {current_user.get('email')}")
        print(f"DEBUG: Profile data received: {profile_data}")
        
        cognito_client = get_cognito_client()
        if not cognito_client:
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
        
        firstName = profile_data.get('firstName', '').strip()
        lastName = profile_data.get('lastName', '').strip()
        email = profile_data.get('email', '').strip()
        dateOfBirth = profile_data.get('dateOfBirth', '').strip()
        
        print(f"DEBUG: Extracted dateOfBirth: '{dateOfBirth}'")
        
        # Validate input
        if len(firstName) < 1 or len(firstName) > 100:
            raise HTTPException(status_code=400, detail="First name must be 1-100 characters")
        
        if len(lastName) < 1 or len(lastName) > 100:
            raise HTTPException(status_code=400, detail="Last name must be 1-100 characters")
        
        # Update Cognito with authentication-related fields
        attributes = [
            {'Name': 'given_name', 'Value': firstName},
            {'Name': 'family_name', 'Value': lastName},
            {'Name': 'email', 'Value': email}
        ]
        
        print("DEBUG: Updating Cognito attributes")
        cognito_client.admin_update_user_attributes(
            UserPoolId=COGNITO_CONFIG['user_pool_id'],
            Username=current_user.get('email'),
            UserAttributes=attributes
        )
        print("DEBUG: Cognito update completed")
        
        # Update database with extended profile fields
        db_success = True
        if dateOfBirth:
            user_id = current_user.get('sub')
            print(f"DEBUG: About to update database - user_id: {user_id}, date_of_birth: {dateOfBirth}")
            
            try:
                from core.database import update_user_profile
                print("DEBUG: Database import successful for update")
                db_success = update_user_profile(
                    user_id=user_id, 
                    date_of_birth=dateOfBirth
                )
                print(f"DEBUG: Database update result: {db_success}")
            except Exception as e:
                print(f"DEBUG: Database import/call error: {e}")
                import traceback
                print(f"DEBUG: Full traceback: {traceback.format_exc()}")
                db_success = False
        else:
            print("DEBUG: No dateOfBirth provided, skipping database update")
        
        print(f"DEBUG: Final db_success value: {db_success}")
        
        if db_success:
            return {
                "success": True,
                "message": "Profile updated successfully",
                "changes_made": len(attributes) + (1 if dateOfBirth else 0)
            }
        else:
            return {
                "success": True,
                "message": "Profile partially updated - date of birth may not have been saved",
                "changes_made": len(attributes)
            }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Error updating user profile: {e}")
        import traceback
        print(f"DEBUG: Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/upload-profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload profile picture to S3 and save URL to database"""
    try:
        user_id = current_user.get('sub')
        print(f"DEBUG: Uploading profile picture for user: {user_id}")
        
        # Validate file
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
            
        if file.size and file.size > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File size must be less than 10MB")
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'jpg'
        s3_key = f"profile-pictures/{user_id}.{file_extension}"
        
        print(f"DEBUG: Uploading to S3 key: {s3_key}")
        
        # Upload to S3
        s3_client = get_s3_client()
        if not s3_client:
            raise HTTPException(status_code=500, detail="S3 service unavailable")
            
        # Read file content
        file_content = await file.read()
        
        # Upload to S3
        s3_client.put_object(
            Bucket=ACCOUNT_CONFIG['S3_BUCKET_NAME'],
            Key=s3_key,
            Body=file_content,
            ContentType=file.content_type,
            Metadata={'user_id': user_id}
        )
        
        # Generate S3 URL
        s3_url = f"https://{ACCOUNT_CONFIG['S3_BUCKET_NAME']}.s3.amazonaws.com/{s3_key}"
        print(f"DEBUG: Generated S3 URL: {s3_url}")
        
        # Update database with profile picture URL
        from core.database import update_user_profile
        db_success = update_user_profile(
            user_id=user_id,
            profile_picture_url=s3_url
        )
        
        if db_success:
            return {
                "success": True,
                "message": "Profile picture uploaded successfully",
                "profile_picture_url": s3_url
            }
        else:
            return {
                "success": False,
                "message": "File uploaded but failed to save URL to database"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Error uploading profile picture: {e}")
        import traceback
        print(f"DEBUG: Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to upload profile picture")

@router.put("/change-password")
async def change_user_password(
    password_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Change user password using Cognito"""
    
    try:
        current_password = password_data.get('currentPassword')
        new_password = password_data.get('newPassword')
        
        if not current_password or not new_password:
            raise HTTPException(status_code=400, detail="Both current and new passwords are required")
        
        if len(new_password) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters long")
        
        logger.info(f"Changing password for user: {current_user.get('email')}")
        
        cognito_client = get_cognito_client()
        if not cognito_client:
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
        
        # First, authenticate with current password to get access token
        try:
            auth_response = cognito_client.admin_initiate_auth(
                UserPoolId=COGNITO_CONFIG['user_pool_id'],
                ClientId=COGNITO_CONFIG['client_id'],
                AuthFlow='ADMIN_NO_SRP_AUTH',
                AuthParameters={
                    'USERNAME': current_user.get('email'),
                    'PASSWORD': current_password
                }
            )
            
            access_token = auth_response['AuthenticationResult']['AccessToken']
            
        except cognito_client.exceptions.NotAuthorizedException:
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Change password using the access token
        cognito_client.change_password(
            PreviousPassword=current_password,
            ProposedPassword=new_password,
            AccessToken=access_token
        )
        
        logger.info(f"Password changed successfully for user: {current_user.get('email')}")
        
        return {
            "success": True,
            "message": "Password changed successfully"
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        
        if error_code == 'NotAuthorizedException':
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        elif error_code == 'InvalidPasswordException':
            raise HTTPException(status_code=400, detail="New password does not meet security requirements")
        elif error_code == 'InvalidParameterException':
            raise HTTPException(status_code=400, detail="Invalid password format")
        else:
            logger.error(f"Cognito error changing password: {e}")
            raise HTTPException(status_code=500, detail="Failed to change password")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/account-health")
async def account_health_check():
    """Health check for account management features"""
    
    health_status = {
        "timestamp": datetime.utcnow().isoformat(),
        "account_endpoints": "healthy",
        "services": {}
    }
    
    # Test S3 connection
    try:
        s3_client = get_s3_client()
        if s3_client:
            s3_client.head_bucket(Bucket=ACCOUNT_CONFIG['S3_BUCKET_NAME'])
            health_status["services"]["s3_storage"] = "healthy"
        else:
            health_status["services"]["s3_storage"] = "client_not_initialized"
    except Exception as e:
        health_status["services"]["s3_storage"] = f"unhealthy: {str(e)}"
    
    # Test Cognito connection
    try:
        cognito_client = get_cognito_client()
        if cognito_client:
            cognito_client.describe_user_pool(UserPoolId=COGNITO_CONFIG['user_pool_id'])
            health_status["services"]["cognito_auth"] = "healthy"
        else:
            health_status["services"]["cognito_auth"] = "client_not_initialized"
    except Exception as e:
        health_status["services"]["cognito_auth"] = f"unhealthy: {str(e)}"
    
    return health_status

@router.get("/test-db")
async def test_database():
    """Test database connection"""
    try:
        print("DEBUG: Test endpoint called")
        from core.database import get_user_profile
        print("DEBUG: Database import successful")
        return {"status": "database import works"}
    except Exception as e:
        print(f"DEBUG: Database import failed: {e}")
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}")
        return {"status": "failed", "error": str(e)}