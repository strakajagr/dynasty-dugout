"""
Dynasty Dugout - AWS Clients Management
Centralized AWS client initialization and management
"""

import boto3
import logging

logger = logging.getLogger(__name__)

# Initialize AWS clients
def initialize_aws_clients():
    """Initialize and return all AWS clients"""
    clients = {}
    
    try:
        clients['rds'] = boto3.client('rds-data', region_name='us-east-1')
        clients['cognito'] = boto3.client('cognito-idp', region_name='us-east-1')
        clients['s3'] = boto3.client('s3', region_name='us-east-1')
        logger.info("All AWS clients initialized successfully")
        return clients
    except Exception as e:
        logger.error(f"Failed to initialize AWS clients: {e}")
        return {
            'rds': None,
            'cognito': None,
            's3': None
        }

# Global AWS clients - initialized once
aws_clients = initialize_aws_clients()

# Convenience getters
def get_rds_client():
    return aws_clients.get('rds')

def get_cognito_client():
    return aws_clients.get('cognito')

def get_s3_client():
    return aws_clients.get('s3')