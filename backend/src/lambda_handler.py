import logging
import sys
from mangum import Mangum
import os
import json # Added for fallback_handler

# Configure logging as early as possible, directing to stdout for immediate CloudWatch visibility
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)

# Add this print statement FIRST
print("--- Lambda Handler Script Start (Version 3) ---") # Changed message again for clear new version
logger.info("🚨 LAMBDA HANDLER: Script started, attempting import of fantasy_api")

app = None # Initialize app to None

try:
    # Print sys.path to debug import issues
    print(f"--- sys.path: {sys.path} ---") # Added this line

    # Assuming fantasy_api.py exports 'app'
    from fantasy_api import app as fantasy_app_instance # Alias it to avoid confusion
    app = fantasy_app_instance
    logger.info("🚨 LAMBDA HANDLER: Successfully imported fantasy_api")
except ImportError as e: # <--- CHANGED: Specifically catch ImportError
    logger.critical(f"🚨 CRITICAL IMPORT ERROR: Failed to import fantasy_api or its dependencies. Error: {e}", exc_info=True)
    app = None
except Exception as e: # <--- Catch any other general exceptions during import
    logger.critical(f"🚨 CRITICAL UNEXPECTED ERROR during fantasy_api import: {e}", exc_info=True)
    app = None


if app:
    # Create the Lambda handler
    handler = Mangum(app)
    logger.info("🚨 LAMBDA HANDLER: Mangum handler created successfully")
else:
    logger.critical("🚨 LAMBDA HANDLER: FastAPI app was NOT imported. Mangum handler not created. Check fantasy_api.py or its dependencies.")
    handler = None

# If the handler is not created due to import failure, return a dummy handler that immediately logs/raises
# This ensures that even if app import fails, Mangum doesn't get a None and can log something.
if handler is None:
    def fallback_handler(event, context):
        logger.error("🚨 FALLBACK HANDLER: FastAPI app failed to initialize. Check logs for import errors.")
        return {
            'statusCode': 500,
            'headers': { 'Content-Type': 'application/json' },
            'body': json.dumps({"detail": "Internal Server Error: Application failed to start"})
        }
    handler = fallback_handler