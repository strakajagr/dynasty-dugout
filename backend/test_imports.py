import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

print("Testing imports...")
try:
    from fantasy_api import app
    print("✅ Main app imported successfully!")
    print(f"App routes: {len(app.routes)} routes found")
    
    # Try to get the app info
    print(f"App title: {app.title}")
    print("✅ All imports working!")
    
except Exception as e:
    print(f"❌ Import failed: {e}")
    import traceback
    traceback.print_exc()
