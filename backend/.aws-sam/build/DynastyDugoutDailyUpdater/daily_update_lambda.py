#!/usr/bin/env python3
"""
Dedicated Lambda Function for Dynasty Dugout Daily Updates
Calls the FIXED incremental updater with proper team mapping
"""

import json
import sys
import os
from datetime import datetime, date, timedelta
import logging

# Add the current directory to path
sys.path.append(os.path.dirname(__file__))

# Import the smart updater
try:
    from daily_incremental_updater import main as run_smart_update
    UPDATER_AVAILABLE = True
except ImportError as e:
    logging.error(f"Failed to import daily_incremental_updater: {e}")
    UPDATER_AVAILABLE = False

# Configure logging for Lambda
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """AWS Lambda handler for Dynasty Dugout daily updates"""
    
    logger.info("🚀 Dynasty Dugout Smart Daily Update Lambda started")
    logger.info(f"Event: {json.dumps(event)}")
    
    if not UPDATER_AVAILABLE:
        logger.error("❌ Daily incremental updater not available")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Daily updater module not available',
                'error': 'Import failed for daily_incremental_updater',
                'lambda_request_id': context.aws_request_id,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
    
    try:
        start_time = datetime.utcnow()
        
        # Determine update type from event or environment
        update_type = event.get('update_type', os.environ.get('UPDATE_TYPE', 'scheduled'))
        
        logger.info(f"📊 Running {update_type} update")
        logger.info("🔧 Using FIXED incremental updater with team mapping")
        
        # Run the smart incremental update
        # The main() function handles its own logging and error handling
        result = run_smart_update()
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        logger.info(f"✅ Dynasty Dugout daily update completed in {duration:.1f} seconds")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Dynasty Dugout daily update completed successfully',
                'timestamp': end_time.isoformat(),
                'duration_seconds': duration,
                'lambda_request_id': context.aws_request_id,
                'update_type': 'smart_incremental_with_team_mapping',
                'target_date': (date.today() - timedelta(days=1)).isoformat(),
                'features': [
                    'Fixed team abbreviation mapping',
                    'Proper opponent data',
                    'Smart incremental processing',
                    'MLB API integration'
                ]
            })
        }
        
    except Exception as e:
        logger.error(f"❌ Dynasty Dugout daily update failed: {str(e)}")
        
        # Log full traceback for debugging
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Dynasty Dugout daily update failed',
                'error': str(e),
                'lambda_request_id': context.aws_request_id,
                'timestamp': datetime.utcnow().isoformat(),
                'update_type': 'smart_incremental_failed'
            })
        }

# For local testing
if __name__ == "__main__":
    from types import SimpleNamespace
    mock_context = SimpleNamespace(aws_request_id="local-test-12345")
    
    # Test with different event types
    test_events = [
        {},  # Scheduled update
        {'update_type': 'manual'},  # Manual trigger
        {'update_type': 'backfill'}  # Backfill mode
    ]
    
    for i, test_event in enumerate(test_events):
        print(f"\n🧪 Test {i+1}: {test_event}")
        result = lambda_handler(test_event, mock_context)
        print(json.dumps(result, indent=2))