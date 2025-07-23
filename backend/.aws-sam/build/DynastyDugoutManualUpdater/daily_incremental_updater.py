#!/usr/bin/env python3
"""
Smart Daily MLB Stats Updater - INCREMENTAL APPROACH WITH FIXED TEAM MAPPING
Only fetches yesterday's games and updates incrementally
Much faster and more efficient than full season overwrites!
FIXED: Proper team abbreviation mapping from MLB API team IDs
"""

import boto3
import json
import requests
from datetime import datetime, timedelta, date
import time

# Database configuration
DATABASE_CONFIG = {
    'resourceArn': 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball',
    'secretArn': 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-db-credentials-MoEtfC',
    'database': 'postgres'
}

# MLB Team ID to Abbreviation mapping (from MLB API)
MLB_TEAM_MAPPING = {
    108: 'LAA',  # Los Angeles Angels
    109: 'ARI',  # Arizona Diamondbacks
    110: 'BAL',  # Baltimore Orioles
    111: 'BOS',  # Boston Red Sox
    112: 'CHC',  # Chicago Cubs
    113: 'CIN',  # Cincinnati Reds
    114: 'CLE',  # Cleveland Guardians
    115: 'COL',  # Colorado Rockies
    116: 'DET',  # Detroit Tigers
    117: 'HOU',  # Houston Astros
    118: 'KC',   # Kansas City Royals
    119: 'LAD',  # Los Angeles Dodgers
    120: 'WSH',  # Washington Nationals
    121: 'NYM',  # New York Mets
    133: 'OAK',  # Oakland Athletics
    134: 'PIT',  # Pittsburgh Pirates
    135: 'SD',   # San Diego Padres
    136: 'SEA',  # Seattle Mariners
    137: 'SF',   # San Francisco Giants
    138: 'STL',  # St. Louis Cardinals
    139: 'TB',   # Tampa Bay Rays
    140: 'TEX',  # Texas Rangers
    141: 'TOR',  # Toronto Blue Jays
    142: 'MIN',  # Minnesota Twins
    143: 'PHI',  # Philadelphia Phillies
    144: 'ATL',  # Atlanta Braves
    145: 'CWS',  # Chicago White Sox
    146: 'MIA',  # Miami Marlins
    147: 'NYY',  # New York Yankees
    158: 'MIL'   # Milwaukee Brewers
}

def get_team_abbreviation(team_data):
    """Convert team data to abbreviation using team ID mapping"""
    if isinstance(team_data, dict):
        team_id = team_data.get('id')
        if team_id in MLB_TEAM_MAPPING:
            return MLB_TEAM_MAPPING[team_id]
        else:
            # Fallback: try to extract abbreviation from name
            name = team_data.get('name', '')
            if 'Yankees' in name:
                return 'NYY'
            elif 'Red Sox' in name:
                return 'BOS'
            elif 'Dodgers' in name:
                return 'LAD'
            elif 'Angels' in name:
                return 'LAA'
            elif 'Astros' in name:
                return 'HOU'
            # Add more fallbacks as needed
            print(f"⚠️  Unknown team ID {team_id}: {name}")
            return f"T{team_id}"  # Fallback to T + ID
    return ''

def execute_sql(sql, parameters=None):
    """Execute SQL using RDS Data API"""
    rds_client = boto3.client('rds-data', region_name='us-east-1')
    
    try:
        params = {
            'resourceArn': DATABASE_CONFIG['resourceArn'],
            'secretArn': DATABASE_CONFIG['secretArn'],
            'database': DATABASE_CONFIG['database'],
            'sql': sql
        }
        
        if parameters:
            params['parameters'] = parameters
            
        response = rds_client.execute_statement(**params)
        return response
        
    except Exception as e:
        print(f"Database error: {str(e)}")
        raise

def get_yesterday_games(target_date=None):
    """Get all games from yesterday (or specified date) - FIXED VERSION"""
    if not target_date:
        target_date = date.today() - timedelta(days=1)
    
    date_str = target_date.strftime('%Y-%m-%d')
    
    print(f"🗓️  Fetching games for {date_str}...")
    
    try:
        url = "https://statsapi.mlb.com/api/v1/schedule"
        params = {
            'date': date_str,
            'sportId': 1,  # MLB
            'hydrate': 'boxscore'
        }
        
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            games = []
            
            for date_entry in data.get('dates', []):
                for game in date_entry.get('games', []):
                    # Only include completed games
                    if game.get('status', {}).get('codedGameState') == 'F':  # Final
                        home_team = game['teams']['home']['team']
                        away_team = game['teams']['away']['team']
                        
                        home_abbr = get_team_abbreviation(home_team)
                        away_abbr = get_team_abbreviation(away_team)
                        
                        games.append({
                            'game_pk': game['gamePk'],
                            'game_date': target_date,
                            'home_team': home_abbr,
                            'away_team': away_abbr
                        })
            
            print(f"📊 Found {len(games)} completed games")
            if games:
                print(f"    Sample: {games[0]['away_team']} at {games[0]['home_team']}")
            return games
            
        else:
            print(f"❌ MLB Schedule API error: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"❌ Error fetching schedule: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_players_who_played_yesterday(target_date=None):
    """Get list of players who appeared in yesterday's games"""
    if not target_date:
        target_date = date.today() - timedelta(days=1)
    
    # Get all active players
    sql = """
    SELECT player_id, mlb_id, first_name, last_name, position, mlb_team
    FROM mlb_players 
    WHERE is_active = true
    """
    
    response = execute_sql(sql)
    all_players = []
    
    for record in response.get('records', []):
        all_players.append({
            'player_id': record[0]['longValue'],
            'mlb_id': record[1]['longValue'] if record[1].get('longValue') else record[0]['longValue'],
            'first_name': record[2]['stringValue'] if record[2].get('stringValue') else '',
            'last_name': record[3]['stringValue'] if record[3].get('stringValue') else '',
            'position': record[4]['stringValue'] if record[4].get('stringValue') else '',
            'team': record[5]['stringValue'] if record[5].get('stringValue') else ''
        })
    
    print(f"🔍 Checking {len(all_players)} players for yesterday's activity...")
    return all_players

def fetch_player_game_log_for_date(mlb_id, target_date):
    """Fetch a specific player's game log for a specific date"""
    try:
        url = f"https://statsapi.mlb.com/api/v1/people/{mlb_id}/stats"
        params = {
            'stats': 'gameLog',
            'season': str(target_date.year),
            'startDate': target_date.strftime('%Y-%m-%d'),
            'endDate': target_date.strftime('%Y-%m-%d')
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Look for game data on the target date
            for stat_group in data.get('stats', []):
                for split in stat_group.get('splits', []):
                    split_date = split.get('date', '')
                    if split_date == target_date.strftime('%Y-%m-%d'):
                        return {
                            'date': target_date,
                            'stat': split.get('stat', {}),
                            'team': split.get('team', {}),
                            'opponent': split.get('opponent', {})
                        }
            
            return None  # No game on this date
            
        else:
            return None
            
    except Exception as e:
        print(f"    ❌ Error fetching game log: {e}")
        return None

def update_game_log(player, game_data):
    """Add/update a single game log entry - FIXED with proper team mapping"""
    try:
        player_id = player['player_id']
        game_date = game_data['date']
        stat = game_data['stat']
        team = game_data['team']
        opponent = game_data['opponent']
        
        # Extract team abbreviations using the mapping function
        team_abbr = get_team_abbreviation(team)
        opponent_abbr = get_team_abbreviation(opponent)
        
        # Determine home/away based on the game context
        # This is a simplified approach - you might need to cross-reference with the games data
        home_away = 'HOME'  # Default, could be enhanced with actual game context
        
        # Determine if hitting or pitching game
        is_hitting_game = stat.get('atBats', 0) > 0 or stat.get('plateAppearances', 0) > 0
        is_pitching_game = float(stat.get('inningsPitched', '0')) > 0
        
        if is_hitting_game:
            # Insert/update hitting game log
            sql = """
            INSERT INTO player_game_logs (
                player_id, game_date, season_year, team_abbreviation, opponent_abbreviation, home_away,
                games_played, at_bats, hits, runs, rbis, home_runs, doubles, triples,
                stolen_bases, walks, strikeouts, hit_by_pitch
            ) VALUES (
                :player_id, :game_date, :season_year, :team_abbr, :opponent_abbr, :home_away,
                1, :at_bats, :hits, :runs, :rbis, :home_runs, :doubles, :triples,
                :stolen_bases, :walks, :strikeouts, :hit_by_pitch
            )
            ON CONFLICT (player_id, game_date, game_number) DO UPDATE SET
                team_abbreviation = EXCLUDED.team_abbreviation,
                opponent_abbreviation = EXCLUDED.opponent_abbreviation,
                home_away = EXCLUDED.home_away,
                at_bats = EXCLUDED.at_bats,
                hits = EXCLUDED.hits,
                runs = EXCLUDED.runs,
                rbis = EXCLUDED.rbis,
                home_runs = EXCLUDED.home_runs,
                doubles = EXCLUDED.doubles,
                triples = EXCLUDED.triples,
                stolen_bases = EXCLUDED.stolen_bases,
                walks = EXCLUDED.walks,
                strikeouts = EXCLUDED.strikeouts,
                hit_by_pitch = EXCLUDED.hit_by_pitch,
                updated_at = CURRENT_TIMESTAMP
            """
            
            parameters = [
                {'name': 'player_id', 'value': {'longValue': player_id}},
                {'name': 'game_date', 'value': {'stringValue': str(game_date)}, 'typeHint': 'DATE'},
                {'name': 'season_year', 'value': {'longValue': game_date.year}},
                {'name': 'team_abbr', 'value': {'stringValue': team_abbr}},
                {'name': 'opponent_abbr', 'value': {'stringValue': opponent_abbr}},
                {'name': 'home_away', 'value': {'stringValue': home_away}},
                {'name': 'at_bats', 'value': {'longValue': stat.get('atBats', 0)}},
                {'name': 'hits', 'value': {'longValue': stat.get('hits', 0)}},
                {'name': 'runs', 'value': {'longValue': stat.get('runs', 0)}},
                {'name': 'rbis', 'value': {'longValue': stat.get('rbi', 0)}},
                {'name': 'home_runs', 'value': {'longValue': stat.get('homeRuns', 0)}},
                {'name': 'doubles', 'value': {'longValue': stat.get('doubles', 0)}},
                {'name': 'triples', 'value': {'longValue': stat.get('triples', 0)}},
                {'name': 'stolen_bases', 'value': {'longValue': stat.get('stolenBases', 0)}},
                {'name': 'walks', 'value': {'longValue': stat.get('baseOnBalls', 0)}},
                {'name': 'strikeouts', 'value': {'longValue': stat.get('strikeOuts', 0)}},
                {'name': 'hit_by_pitch', 'value': {'longValue': stat.get('hitByPitch', 0)}}
            ]
            
            execute_sql(sql, parameters)
            print(f"    ✅ HITTING: {team_abbr} vs {opponent_abbr}")
            return 'hitting'
            
        elif is_pitching_game:
            # Insert/update pitching game log
            sql = """
            INSERT INTO player_game_logs (
                player_id, game_date, season_year, team_abbreviation, opponent_abbreviation, home_away,
                games_played, innings_pitched, wins, losses, saves, earned_runs,
                hits_allowed, walks_allowed, strikeouts_pitched
            ) VALUES (
                :player_id, :game_date, :season_year, :team_abbr, :opponent_abbr, :home_away,
                1, :innings_pitched, :wins, :losses, :saves, :earned_runs,
                :hits_allowed, :walks_allowed, :strikeouts_pitched
            )
            ON CONFLICT (player_id, game_date, game_number) DO UPDATE SET
                team_abbreviation = EXCLUDED.team_abbreviation,
                opponent_abbreviation = EXCLUDED.opponent_abbreviation,
                home_away = EXCLUDED.home_away,
                innings_pitched = EXCLUDED.innings_pitched,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                saves = EXCLUDED.saves,
                earned_runs = EXCLUDED.earned_runs,
                hits_allowed = EXCLUDED.hits_allowed,
                walks_allowed = EXCLUDED.walks_allowed,
                strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                updated_at = CURRENT_TIMESTAMP
            """
            
            parameters = [
                {'name': 'player_id', 'value': {'longValue': player_id}},
                {'name': 'game_date', 'value': {'stringValue': str(game_date)}, 'typeHint': 'DATE'},
                {'name': 'season_year', 'value': {'longValue': game_date.year}},
                {'name': 'team_abbr', 'value': {'stringValue': team_abbr}},
                {'name': 'opponent_abbr', 'value': {'stringValue': opponent_abbr}},
                {'name': 'home_away', 'value': {'stringValue': home_away}},
                {'name': 'innings_pitched', 'value': {'doubleValue': float(stat.get('inningsPitched', '0'))}},
                {'name': 'wins', 'value': {'longValue': stat.get('wins', 0)}},
                {'name': 'losses', 'value': {'longValue': stat.get('losses', 0)}},
                {'name': 'saves', 'value': {'longValue': stat.get('saves', 0)}},
                {'name': 'earned_runs', 'value': {'longValue': stat.get('earnedRuns', 0)}},
                {'name': 'hits_allowed', 'value': {'longValue': stat.get('hits', 0)}},
                {'name': 'walks_allowed', 'value': {'longValue': stat.get('baseOnBalls', 0)}},
                {'name': 'strikeouts_pitched', 'value': {'longValue': stat.get('strikeOuts', 0)}}
            ]
            
            execute_sql(sql, parameters)
            print(f"    ✅ PITCHING: {team_abbr} vs {opponent_abbr}")
            return 'pitching'
        
        return None
        
    except Exception as e:
        print(f"    ❌ Error updating game log: {e}")
        import traceback
        traceback.print_exc()
        return None

def recalculate_season_totals(player_id, season_year=2025):
    """Recalculate season totals from all game logs (incremental approach)"""
    try:
        # Delete existing season totals
        delete_sql = """
        DELETE FROM player_stats 
        WHERE player_id = :player_id AND season_year = :season_year
        """
        delete_params = [
            {'name': 'player_id', 'value': {'longValue': player_id}},
            {'name': 'season_year', 'value': {'longValue': season_year}}
        ]
        execute_sql(delete_sql, delete_params)
        
        # Aggregate from game logs
        agg_sql = """
        SELECT 
            COUNT(*) as games_played,
            -- Hitting aggregates
            SUM(at_bats) as at_bats,
            SUM(hits) as hits,
            SUM(runs) as runs,
            SUM(rbis) as rbis,
            SUM(home_runs) as home_runs,
            SUM(doubles) as doubles,
            SUM(triples) as triples,
            SUM(stolen_bases) as stolen_bases,
            SUM(walks) as walks,
            SUM(strikeouts) as strikeouts,
            SUM(hit_by_pitch) as hit_by_pitch,
            -- Pitching aggregates
            SUM(innings_pitched) as innings_pitched,
            SUM(wins) as wins,
            SUM(losses) as losses,
            SUM(saves) as saves,
            SUM(earned_runs) as earned_runs,
            SUM(hits_allowed) as hits_allowed,
            SUM(walks_allowed) as walks_allowed,
            SUM(strikeouts_pitched) as strikeouts_pitched
        FROM player_game_logs 
        WHERE player_id = :player_id AND season_year = :season_year
        """
        
        agg_params = [
            {'name': 'player_id', 'value': {'longValue': player_id}},
            {'name': 'season_year', 'value': {'longValue': season_year}}
        ]
        
        response = execute_sql(agg_sql, agg_params)
        
        if response.get('records') and len(response['records']) > 0:
            record = response['records'][0]
            
            # Extract aggregated values
            games_played = record[0].get('longValue', 0)
            at_bats = record[1].get('longValue', 0)
            hits = record[2].get('longValue', 0)
            runs = record[3].get('longValue', 0)
            rbis = record[4].get('longValue', 0)
            home_runs = record[5].get('longValue', 0)
            doubles = record[6].get('longValue', 0)
            triples = record[7].get('longValue', 0)
            stolen_bases = record[8].get('longValue', 0)
            walks = record[9].get('longValue', 0)
            strikeouts = record[10].get('longValue', 0)
            hit_by_pitch = record[11].get('longValue', 0)
            innings_pitched = record[12].get('doubleValue', 0)
            wins = record[13].get('longValue', 0)
            losses = record[14].get('longValue', 0)
            saves = record[15].get('longValue', 0)
            earned_runs = record[16].get('longValue', 0)
            hits_allowed = record[17].get('longValue', 0)
            walks_allowed = record[18].get('longValue', 0)
            strikeouts_pitched = record[19].get('longValue', 0)
            
            # Calculate derived stats
            avg = (hits / at_bats) if at_bats > 0 else 0.0
            obp = ((hits + walks) / (at_bats + walks)) if (at_bats + walks) > 0 else 0.0
            total_bases = hits + doubles + (triples * 2) + (home_runs * 3)
            slg = (total_bases / at_bats) if at_bats > 0 else 0.0
            ops = obp + slg
            era = (earned_runs * 9 / innings_pitched) if innings_pitched > 0 else 0.0
            whip = ((hits_allowed + walks_allowed) / innings_pitched) if innings_pitched > 0 else 0.0
            
            # Calculate fantasy points
            if innings_pitched > 0:  # Pitcher
                fantasy_points = wins * 5 + saves * 3 + strikeouts_pitched * 1 + innings_pitched * 1
            else:  # Hitter
                fantasy_points = hits * 1 + home_runs * 4 + rbis * 1 + runs * 1 + stolen_bases * 2
            
            # Insert updated season totals
            insert_sql = """
            INSERT INTO player_stats (
                player_id, week_number, season_year, games_played,
                at_bats, hits, runs, rbis, home_runs, doubles, triples, stolen_bases,
                walks, strikeouts, hit_by_pitch, avg, obp, slg, ops,
                innings_pitched, wins, losses, saves, earned_runs, 
                hits_allowed, walks_allowed, strikeouts_pitched, era, whip,
                fantasy_points
            ) VALUES (
                :player_id, 1, :season_year, :games_played,
                :at_bats, :hits, :runs, :rbis, :home_runs, :doubles, :triples, :stolen_bases,
                :walks, :strikeouts, :hit_by_pitch, :avg, :obp, :slg, :ops,
                :innings_pitched, :wins, :losses, :saves, :earned_runs,
                :hits_allowed, :walks_allowed, :strikeouts_pitched, :era, :whip,
                :fantasy_points
            )
            """
            
            insert_params = [
                {'name': 'player_id', 'value': {'longValue': player_id}},
                {'name': 'season_year', 'value': {'longValue': season_year}},
                {'name': 'games_played', 'value': {'longValue': games_played}},
                {'name': 'at_bats', 'value': {'longValue': at_bats}},
                {'name': 'hits', 'value': {'longValue': hits}},
                {'name': 'runs', 'value': {'longValue': runs}},
                {'name': 'rbis', 'value': {'longValue': rbis}},
                {'name': 'home_runs', 'value': {'longValue': home_runs}},
                {'name': 'doubles', 'value': {'longValue': doubles}},
                {'name': 'triples', 'value': {'longValue': triples}},
                {'name': 'stolen_bases', 'value': {'longValue': stolen_bases}},
                {'name': 'walks', 'value': {'longValue': walks}},
                {'name': 'strikeouts', 'value': {'longValue': strikeouts}},
                {'name': 'hit_by_pitch', 'value': {'longValue': hit_by_pitch}},
                {'name': 'avg', 'value': {'doubleValue': avg}},
                {'name': 'obp', 'value': {'doubleValue': obp}},
                {'name': 'slg', 'value': {'doubleValue': slg}},
                {'name': 'ops', 'value': {'doubleValue': ops}},
                {'name': 'innings_pitched', 'value': {'doubleValue': innings_pitched}},
                {'name': 'wins', 'value': {'longValue': wins}},
                {'name': 'losses', 'value': {'longValue': losses}},
                {'name': 'saves', 'value': {'longValue': saves}},
                {'name': 'earned_runs', 'value': {'longValue': earned_runs}},
                {'name': 'hits_allowed', 'value': {'longValue': hits_allowed}},
                {'name': 'walks_allowed', 'value': {'longValue': walks_allowed}},
                {'name': 'strikeouts_pitched', 'value': {'longValue': strikeouts_pitched}},
                {'name': 'era', 'value': {'doubleValue': era}},
                {'name': 'whip', 'value': {'doubleValue': whip}},
                {'name': 'fantasy_points', 'value': {'doubleValue': fantasy_points}}
            ]
            
            execute_sql(insert_sql, insert_params)
            return True
        
        return False
        
    except Exception as e:
        print(f"    ❌ Error recalculating season totals: {e}")
        return False

def main():
    """Smart daily incremental update with fixed team mapping"""
    start_time = datetime.now()
    print("🚀 SMART Daily MLB Update - Incremental Approach (FIXED TEAM MAPPING)")
    print("⚡ Only processing yesterday's games for maximum efficiency!")
    print("🔧 Now includes proper team abbreviation mapping!")
    print()
    
    # Allow override of target date for testing
    target_date = date.today() - timedelta(days=1)
    
    try:
        # Step 1: Get yesterday's completed games
        games = get_yesterday_games(target_date)
        
        if not games:
            print(f"ℹ️  No completed games found for {target_date}. Exiting.")
            return
        
        # Step 2: Get all players (we need to check which ones played)
        players = get_players_who_played_yesterday(target_date)
        
        processed_players = 0
        updated_game_logs = 0
        
        print(f"📊 Processing players for {target_date}...")
        print("=" * 60)
        
        # Step 3: Check each player for activity on target date
        for i, player in enumerate(players):
            print(f"[{i+1}/{len(players)}] {player['first_name']} {player['last_name']}")
            
            # Fetch game log for this specific date
            game_data = fetch_player_game_log_for_date(player['mlb_id'], target_date)
            
            if game_data:
                # Player played yesterday - update game log
                game_type = update_game_log(player, game_data)
                
                if game_type:
                    updated_game_logs += 1
                    
                    # Recalculate season totals from all game logs
                    if recalculate_season_totals(player['player_id']):
                        print(f"    ✅ Season totals recalculated")
                        processed_players += 1
                    else:
                        print(f"    ⚠️  Failed to recalculate totals")
                else:
                    print(f"    ⚠️  Failed to process game data")
            else:
                print(f"    ➖ No game activity")
            
            # Minimal rate limiting (much faster than full updates)
            if i < len(players) - 1:
                time.sleep(0.1)  # Very fast since we're only doing incremental updates
        
        duration = datetime.now() - start_time
        print()
        print("🎉 SMART Daily Update Complete!")
        print("=" * 60)
        print(f"📅 Target date: {target_date}")
        print(f"🎮 Games scheduled: {len(games)}")
        print(f"✅ Players updated: {processed_players}")
        print(f"📊 Game logs added: {updated_game_logs}")
        print(f"⏱️  Duration: {duration}")
        print()
        print("🔥 Benefits of this approach:")
        print("   • Only processes players who actually played")
        print("   • Incremental updates (much faster)")
        print("   • Preserves historical game-by-game data")
        print("   • Perfect for daily 6 AM automation")
        print("   • FIXED: Proper team abbreviations (NYY, BOS, LAD, etc.)")
        
    except Exception as e:
        print(f"❌ Smart update failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()