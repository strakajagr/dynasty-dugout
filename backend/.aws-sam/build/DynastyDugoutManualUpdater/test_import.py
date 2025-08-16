import sys
import os

# Add src to sys.path to mimic Lambda's /var/task behavior
# This is crucial for local testing if your imports are relative
# e.g., from routers import auth
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

print("Attempting to import fantasy_api.py...")

try:
    from fantasy_api import app # Use 'app' as per your fantasy_api.py
    print("SUCCESS: Imported fantasy_api.py successfully!")
    # Optionally, try to access a route to further test
    # from fastapi.testclient import TestClient
    # client = TestClient(app)
    # response = client.get("/api/health")
    # print(f"Health check response: {response.json()}")

except ImportError as e:
    print(f"ERROR: ImportError caught! Message: {e}")
    print("--- Full Traceback ---")
    import traceback
    traceback.print_exc()
    print("--- End Traceback ---")
except Exception as e:
    print(f"ERROR: General Exception caught during import! Message: {e}")
    print("--- Full Traceback ---")
    import traceback
    traceback.print_exc()
    print("--- End Traceback ---")

print("test_import.py finished.")