# Save this as test_imports.py in your backend directory
# Run with: python test_imports.py

import sys
import os

# Add src to path (same as Lambda would do)
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

try:
    print("Testing core imports...")
    from core.config import *
    print("✅ core.config imported successfully")
    
    from core.aws_clients import *
    print("✅ core.aws_clients imported successfully")
    
    from core.database import *
    print("✅ core.database imported successfully")
    
    from core.auth_utils import *
    print("✅ core.auth_utils imported successfully")
    
except Exception as e:
    print(f"❌ Core import failed: {e}")

try:
    print("\nTesting router imports...")
    from routers.auth import router as auth_router
    print("✅ routers.auth imported successfully")
    
    from routers.account import router as account_router
    print("✅ routers.account imported successfully")
    
    from routers.players import router as players_router
    print("✅ routers.players imported successfully")
    
    from routers.analytics import router as analytics_router
    print("✅ routers.analytics imported successfully")
    
    from routers.utilities import router as utilities_router
    print("✅ routers.utilities imported successfully")
    
except Exception as e:
    print(f"❌ Router import failed: {e}")

try:
    print("\nTesting main app import...")
    from fantasy_api import app
    print("✅ Main app imported successfully")
    print(f"App type: {type(app)}")
    
except Exception as e:
    print(f"❌ Main app import failed: {e}")

print("\nImport test complete!")