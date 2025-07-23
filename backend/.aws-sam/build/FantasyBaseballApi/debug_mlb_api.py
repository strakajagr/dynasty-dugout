#!/usr/bin/env python3
"""
Debug MLB API to understand the actual response structure
"""

import requests
import json
from datetime import date, timedelta

def debug_mlb_api():
    """Debug what the MLB API actually returns"""
    
    # Try a known date when games definitely happened (2024 season)
    test_date = "2024-07-20"  # Middle of 2024 season
    
    print(f"🔍 Testing MLB API for {test_date}...")
    
    try:
        url = "https://statsapi.mlb.com/api/v1/schedule"
        params = {
            'date': test_date,
            'sportId': 1,  # MLB
            'hydrate': 'boxscore'
        }
        
        response = requests.get(url, params=params, timeout=15)
        
        print(f"📡 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print("📋 Full API Response Structure:")
            print("=" * 50)
            print(json.dumps(data, indent=2)[:2000] + "..." if len(str(data)) > 2000 else json.dumps(data, indent=2))
            print("=" * 50)
            
            # Analyze the structure
            print(f"🔧 Analysis:")
            print(f"   - dates array length: {len(data.get('dates', []))}")
            
            for date_entry in data.get('dates', []):
                games = date_entry.get('games', [])
                print(f"   - games on {date_entry.get('date', 'unknown')}: {len(games)}")
                
                if games:
                    game = games[0]  # Look at first game
                    print(f"   - sample game structure:")
                    print(f"     * gamePk: {game.get('gamePk')}")
                    print(f"     * status: {game.get('status', {})}")
                    print(f"     * teams structure: {type(game.get('teams', {}))}")
                    
                    if 'teams' in game:
                        teams = game['teams']
                        print(f"     * home team structure: {teams.get('home', {}).keys()}")
                        print(f"     * away team structure: {teams.get('away', {}).keys()}")
                        
                        if 'home' in teams and 'team' in teams['home']:
                            home_team = teams['home']['team']
                            print(f"     * home team fields: {home_team.keys()}")
                            print(f"     * home team sample: {home_team}")
                            
                        if 'away' in teams and 'team' in teams['away']:
                            away_team = teams['away']['team']
                            print(f"     * away team fields: {away_team.keys()}")
                            print(f"     * away team sample: {away_team}")
                    
                    break  # Just analyze first game
                
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

def test_current_season():
    """Test what's available for current season"""
    current_date = date.today()
    
    # Try recent dates in 2024 (last completed season)
    test_dates = [
        "2024-10-01",  # End of 2024 season
        "2024-09-15",  # Late 2024 season
        "2024-07-15",  # Mid 2024 season
    ]
    
    for test_date in test_dates:
        print(f"\n🗓️ Testing {test_date}...")
        
        try:
            url = "https://statsapi.mlb.com/api/v1/schedule"
            params = {
                'date': test_date,
                'sportId': 1
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                total_games = sum(len(d.get('games', [])) for d in data.get('dates', []))
                print(f"   ✅ {total_games} games found")
            else:
                print(f"   ❌ Status: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    debug_mlb_api()
    test_current_season()