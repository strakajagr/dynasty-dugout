#!/usr/bin/env python3
"""
Quick test to check which routers are failing to import
"""
import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

print("Testing Dynasty Dugout Router Imports...")
print("=" * 50)

def test_import(module_name):
    """Test if a module can be imported"""
    try:
        if module_name == "leagues":
            from routers import leagues
        elif module_name == "mlb":
            from routers import mlb
        elif module_name == "players_canonical":
            from routers import players_canonical
        elif module_name == "auth":
            from routers import auth
        elif module_name == "account":
            from routers import account
        print(f"✅ {module_name} imports OK")
        return True
    except Exception as e:
        print(f"❌ {module_name} FAILED:")
        print(f"   {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# Test critical routers
results = []
results.append(test_import("auth"))
results.append(test_import("account"))
results.append(test_import("leagues"))
results.append(test_import("mlb"))
results.append(test_import("players_canonical"))

print("=" * 50)
if all(results):
    print("✅ ALL ROUTERS IMPORT SUCCESSFULLY!")
    sys.exit(0)
else:
    print("❌ SOME ROUTERS FAILED - FIX BEFORE DEPLOYING")
    sys.exit(1)
