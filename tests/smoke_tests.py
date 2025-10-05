#!/usr/bin/env python3
"""
Dynasty Dugout - Smoke Tests
Run these before AND after any refactoring changes
"""

import requests
import sys
from typing import Dict, Any

# Configuration
API_BASE = "https://13cpdms4x1.execute-api.us-east-1.amazonaws.com/Prod/api"
TEST_USER = {
    "email": "test@dynastydugout.com",
    "password": "TestPassword123!"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

def test_health_check():
    """Test 1: API is reachable"""
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        return True, "Health check passed"
    except Exception as e:
        return False, f"Health check failed: {str(e)}"

def test_player_search():
    """Test 2: Player search works"""
    try:
        response = requests.get(
            f"{API_BASE}/players/search",
            params={"q": "Trout", "limit": 10},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "players" in data
        assert len(data["players"]) > 0
        
        # Verify expected fields exist
        player = data["players"][0]
        required_fields = ["player_id", "first_name", "last_name", "position"]
        for field in required_fields:
            assert field in player, f"Missing field: {field}"
        
        return True, f"Player search returned {len(data['players'])} results"
    except Exception as e:
        return False, f"Player search failed: {str(e)}"

def test_mlb_endpoints():
    """Test 3: MLB data endpoints work"""
    try:
        response = requests.get(f"{API_BASE}/mlb/health", timeout=10)
        assert response.status_code == 200
        return True, "MLB endpoints accessible"
    except Exception as e:
        return False, f"MLB endpoints failed: {str(e)}"

def test_player_complete_endpoint():
    """Test 4: Complete player data works"""
    try:
        # First search for a player
        search_response = requests.get(
            f"{API_BASE}/players/search",
            params={"q": "Ohtani", "limit": 1},
            timeout=10
        )
        players = search_response.json().get("players", [])
        if not players:
            return False, "No players found in search"
        
        player_id = players[0]["player_id"]
        
        # Now get complete data
        response = requests.get(
            f"{API_BASE}/players/{player_id}/complete",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "player_id" in data or "mlb_player_id" in data
        assert "season_stats" in data or "stats" in data
        
        return True, f"Complete player data loaded for player {player_id}"
    except Exception as e:
        return False, f"Complete player endpoint failed: {str(e)}"

def run_all_tests():
    """Run all smoke tests"""
    tests = [
        ("Health Check", test_health_check),
        ("Player Search", test_player_search),
        ("MLB Endpoints", test_mlb_endpoints),
        ("Complete Player Data", test_player_complete_endpoint),
    ]
    
    print("\n" + "="*60)
    print("🧪 DYNASTY DUGOUT - SMOKE TESTS")
    print("="*60 + "\n")
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"Running: {test_name}...", end=" ")
        success, message = test_func()
        
        if success:
            print(f"{Colors.GREEN}✓ PASS{Colors.RESET}")
            print(f"   → {message}")
            passed += 1
        else:
            print(f"{Colors.RED}✗ FAIL{Colors.RESET}")
            print(f"   → {message}")
            failed += 1
        print()
    
    print("="*60)
    print(f"Results: {Colors.GREEN}{passed} passed{Colors.RESET}, {Colors.RED}{failed} failed{Colors.RESET}")
    print("="*60 + "\n")
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
