import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def handler(event, context):
    logger.info("🚨 SIMPLE TEST: Handler called successfully!")
    logger.info(f"🚨 SIMPLE TEST: Event method: {event.get('httpMethod', 'unknown')}")
    logger.info(f"🚨 SIMPLE TEST: Event path: {event.get('path', 'unknown')}")
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'message': 'Simple test handler working',
            'success': True,
            'timestamp': str(context.aws_request_id)
        })
    }
