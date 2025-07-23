"""
Dynasty Dugout - Centralized Configuration
All configuration settings in one place
"""

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

# Database configuration - RDS Data API (Updated to use RDS-managed secret)
DATABASE_CONFIG = {
    'resourceArn': 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball',
    'secretArn': 'arn:aws:secretsmanager:us-east-1:584812014683:secret:rds!cluster-a4ca625a-7cb4-484a-8707-80f27e403c70-pwORGg',
    'database': 'postgres'
}

# Account Management Configuration
ACCOUNT_CONFIG = {
    'S3_BUCKET_NAME': 'dynasty-dugout-profile-pictures',
    'CLOUDFRONT_DOMAIN': 'https://d20wx6xzxkf84y.cloudfront.net'
}