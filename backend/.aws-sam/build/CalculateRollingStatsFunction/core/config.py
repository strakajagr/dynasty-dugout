"""
Dynasty Dugout - Centralized Configuration
All configuration settings in one place
"""
import os

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

# FIXED: Database configuration now reads from environment variables
# These are set in the template.yaml for each Lambda function
DATABASE_CONFIG = {
    'resourceArn': os.environ.get('DB_CLUSTER_ARN'),
    'secretArn': os.environ.get('DB_SECRET_ARN'),
    'database': 'postgres' # The default database to connect to
}

# Account Management Configuration
ACCOUNT_CONFIG = {
    'S3_BUCKET_NAME': 'dynasty-dugout-profile-pictures',
    'CLOUDFRONT_DOMAIN': 'https://d20wx6xzxkf84y.cloudfront.net'
}
