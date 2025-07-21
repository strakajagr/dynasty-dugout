#!/usr/bin/env python3
"""
MLB Stats API Research Script
Explores the MLB Stats API to understand data structure for schema design
"""

import statsapi
import json
from pprint import pprint

def explore_teams():
    """Explore team data structure"""
    print("=" * 50)
    print("EXPLORING TEAMS")
    print("=" * 50)
    
    try:
        # Get all teams
        teams = statsapi.get('teams', {'sportId': 1})  # MLB = sport ID 1
        
        print(f"Found {len(teams['teams'])} teams")
        print("\nSample team data structure:")
        if teams['teams']:
            pprint(teams['teams'][0])
            
        return teams['teams']
    except Exception as e:
        print(f"Error exploring teams: {e}")
        return []

def explore_players():
    """Explore player data structure"""
    print("\n" + "=" * 50)
    print("EXPLORING PLAYERS")
    print("=" * 50)
    
    try:
        # Get some well-known players
        famous_players = {
            'Mike Trout': 545361,
            'Mookie Betts': 605141,
            'Aaron Judge': 592450,
            'Shohei Ohtani': 660271
        }
        
        for name, player_id in famous_players.items():
            print(f"\n--- {name} (ID: {player_id}) ---")
            
            # Get player info
            player_data = statsapi.get('people', {'personIds': player_id})
            
            if player_data.get('people'):
                player = player_data['people'][0]
                print("Player data fields:")
                pprint(player)
                break  # Just show one detailed example
                
        return famous_players
    except Exception as e:
        print(f"Error exploring players: {e}")
        return {}

def explore_player_stats():
    """Explore player statistics structure"""
    print("\n" + "=" * 50)
    print("EXPLORING PLAYER STATISTICS")
    print("=" * 50)
    
    try:
        # Get Mike Trout's 2024 stats
        mike_trout_id = 545361
        
        # Get season stats
        print("--- Season Stats Structure ---")
        season_stats = statsapi.get('people', {
            'personIds': mike_trout_id,
            'hydrate': 'stats(group=[hitting,pitching,fielding],type=[season])'
        })
        
        if season_stats.get('people'):
            player = season_stats['people'][0]
            if 'stats' in player:
                print("Available stat groups:")
                for stat_group in player['stats']:
                    print(f"Group: {stat_group.get('group', {}).get('displayName', 'Unknown')}")
                    print(f"Type: {stat_group.get('type', {}).get('displayName', 'Unknown')}")
                    
                    if 'splits' in stat_group and stat_group['splits']:
                        print("Sample stat fields:")
                        stats = stat_group['splits'][0]['stat']
                        for field, value in stats.items():
                            print(f"  {field}: {value}")
                    print()
        
        return season_stats
    except Exception as e:
        print(f"Error exploring player stats: {e}")
        return {}

def explore_game_data():
    """Explore game and live data structure"""
    print("\n" + "=" * 50)
    print("EXPLORING GAME DATA")
    print("=" * 50)
    
    try:
        # Get recent games
        print("--- Recent Games ---")
        schedule = statsapi.schedule(date='2024-07-01')  # Sample date
        
        if schedule:
            print(f"Found {len(schedule)} games on sample date")
            game = schedule[0]
            print("Sample game data structure:")
            pprint(game)
        
        return schedule
    except Exception as e:
        print(f"Error exploring games: {e}")
        return []

def analyze_data_for_schema():
    """Analyze findings and suggest schema changes"""
    print("\n" + "=" * 50)
    print("SCHEMA ANALYSIS & RECOMMENDATIONS")
    print("=" * 50)
    
    print("""
    Based on MLB Stats API exploration, here are key findings:
    
    PLAYER FIELDS TO ADD:
    - MLB API uses 'id' as primary identifier (not mlb_id)
    - fullName, firstName, lastName (consistent naming)
    - primaryPosition (object with name, type, abbreviation)
    - batSide, pitchHand (more detailed than our bats/throws)
    - birthDate, birthCity, birthStateProvince, birthCountry
    - height, weight (string format like "6' 2\"", "210 lbs")
    - mlbDebutDate, lastPlayedDate
    - isActive, isPlayer, isCoach
    - currentTeam (object with id, name, abbreviation)
    
    STATISTICS FIELDS TO ADD:
    - Hitting: avg, obp, slg, ops, plateAppearances, totalBases
    - Pitching: era, whip, strikeoutsPer9Inn, baseOnBallsPer9Inn
    - Advanced: war, babip, iso, woba, xwoba
    
    TEAM FIELDS TO ADD:
    - MLB API team structure has id, name, abbreviation, teamName
    - division, league information
    - venue information
    
    RECOMMENDATIONS:
    1. Add mlb_api_id field to map to their ID system
    2. Expand player_stats table with all available MLB stats
    3. Add raw_api_data JSONB field for future flexibility
    4. Create team mapping table for MLB teams
    """)

def main():
    """Main research function"""
    print("MLB Stats API Research")
    print("Investigating data structure for schema design")
    
    # Test basic connectivity
    try:
        # Simple test
        test = statsapi.get('sports')
        print(f"✅ Connected to MLB Stats API successfully")
        print(f"Available sports: {len(test.get('sports', []))}")
    except Exception as e:
        print(f"❌ Failed to connect to MLB Stats API: {e}")
        return
    
    # Explore different data types
    teams = explore_teams()
    players = explore_players()
    stats = explore_player_stats()
    games = explore_game_data()
    
    # Analyze findings
    analyze_data_for_schema()
    
    print("\n" + "=" * 50)
    print("RESEARCH COMPLETE")
    print("=" * 50)
    print("Review the output above to plan Aurora schema updates")

if __name__ == "__main__":
    main()
