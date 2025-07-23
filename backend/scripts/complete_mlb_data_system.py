#!/usr/bin/env python3
"""
COMPREHENSIVE MLB Data System
Fetches ALL available data from MLB Stats API:
1. Current season stats (enhances your existing system)
2. Complete career history (year-by-year) 
3. Individual game logs (for recent performance calculations)

This builds on your existing populate_stats.py without breaking anything!
"""

import boto3
import json
import requests
from datetime import datetime, timedelta
import time

# Database configuration - SAME as your existing system
DATABASE_CONFIG = {
    'resourceArn': 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball',
    'secretArn': 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-db-credentials-MoEtfC',
    'database': 'postgres'
}

def execute_sql(sql, parameters=None):
    """Execute SQL using RDS Data API - SAME as your existing system"""
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

def create_new_tables():
    """Create the new tables for career stats and game logs"""
    print("🗄️  Creating new database tables...")
    
    # 1. Career stats table (year-by-year)
    career_table_sql = """
    CREATE TABLE IF NOT EXISTS player_career_stats (
        career_stat_id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL,
        season_year INTEGER NOT NULL,
        league VARCHAR(10),
        team_abbreviation VARCHAR(10),
        team_name VARCHAR(100),
        age INTEGER,
        level VARCHAR(20) DEFAULT 'MLB',
        is_playoff BOOLEAN DEFAULT false,
        
        -- Hitting stats
        games_played INTEGER DEFAULT 0,
        at_bats INTEGER DEFAULT 0,
        hits INTEGER DEFAULT 0,
        runs INTEGER DEFAULT 0,
        rbis INTEGER DEFAULT 0,
        home_runs INTEGER DEFAULT 0,
        doubles INTEGER DEFAULT 0,
        triples INTEGER DEFAULT 0,
        stolen_bases INTEGER DEFAULT 0,
        caught_stealing INTEGER DEFAULT 0,
        walks INTEGER DEFAULT 0,
        strikeouts INTEGER DEFAULT 0,
        hit_by_pitch INTEGER DEFAULT 0,
        sacrifice_flies INTEGER DEFAULT 0,
        sacrifice_hits INTEGER DEFAULT 0,
        intentional_walks INTEGER DEFAULT 0,
        grounded_into_double_plays INTEGER DEFAULT 0,
        avg DECIMAL(5,3) DEFAULT 0.000,
        obp DECIMAL(5,3) DEFAULT 0.000,
        slg DECIMAL(5,3) DEFAULT 0.000,
        ops DECIMAL(5,3) DEFAULT 0.000,
        
        -- Pitching stats
        innings_pitched DECIMAL(6,1) DEFAULT 0.0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0,
        holds INTEGER DEFAULT 0,
        blown_saves INTEGER DEFAULT 0,
        games_started INTEGER DEFAULT 0,
        complete_games INTEGER DEFAULT 0,
        shutouts INTEGER DEFAULT 0,
        quality_starts INTEGER DEFAULT 0,
        earned_runs INTEGER DEFAULT 0,
        hits_allowed INTEGER DEFAULT 0,
        home_runs_allowed INTEGER DEFAULT 0,
        walks_allowed INTEGER DEFAULT 0,
        strikeouts_pitched INTEGER DEFAULT 0,
        hit_batsmen INTEGER DEFAULT 0,
        wild_pitches INTEGER DEFAULT 0,
        balks INTEGER DEFAULT 0,
        era DECIMAL(5,2) DEFAULT 0.00,
        whip DECIMAL(5,3) DEFAULT 0.000,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Constraints
        UNIQUE(player_id, season_year, is_playoff),
        FOREIGN KEY (player_id) REFERENCES mlb_players(player_id)
    );
    """
    
    # 2. Game logs table (individual games)
    game_logs_table_sql = """
    CREATE TABLE IF NOT EXISTS player_game_logs (
        game_log_id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL,
        game_date DATE NOT NULL,
        season_year INTEGER NOT NULL,
        team_abbreviation VARCHAR(10),
        opponent_abbreviation VARCHAR(10),
        home_away VARCHAR(4), -- 'HOME' or 'AWAY'
        game_number INTEGER, -- for doubleheaders
        
        -- Hitting stats (game-specific)
        games_played INTEGER DEFAULT 0,
        at_bats INTEGER DEFAULT 0,
        hits INTEGER DEFAULT 0,
        runs INTEGER DEFAULT 0,
        rbis INTEGER DEFAULT 0,
        home_runs INTEGER DEFAULT 0,
        doubles INTEGER DEFAULT 0,
        triples INTEGER DEFAULT 0,
        stolen_bases INTEGER DEFAULT 0,
        caught_stealing INTEGER DEFAULT 0,
        walks INTEGER DEFAULT 0,
        strikeouts INTEGER DEFAULT 0,
        hit_by_pitch INTEGER DEFAULT 0,
        sacrifice_flies INTEGER DEFAULT 0,
        sacrifice_hits INTEGER DEFAULT 0,
        intentional_walks INTEGER DEFAULT 0,
        left_on_base INTEGER DEFAULT 0,
        
        -- Pitching stats (game-specific)
        innings_pitched DECIMAL(4,1) DEFAULT 0.0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0,
        holds INTEGER DEFAULT 0,
        blown_saves INTEGER DEFAULT 0,
        earned_runs INTEGER DEFAULT 0,
        hits_allowed INTEGER DEFAULT 0,
        home_runs_allowed INTEGER DEFAULT 0,
        walks_allowed INTEGER DEFAULT 0,
        strikeouts_pitched INTEGER DEFAULT 0,
        hit_batsmen INTEGER DEFAULT 0,
        wild_pitches INTEGER DEFAULT 0,
        balks INTEGER DEFAULT 0,
        pitches_thrown INTEGER DEFAULT 0,
        strikes INTEGER DEFAULT 0,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Constraints
        UNIQUE(player_id, game_date, game_number),
        FOREIGN KEY (player_id) REFERENCES mlb_players(player_id)
    );
    """
    
    # 3. Create indexes for performance
    indexes_sql = [
        "CREATE INDEX IF NOT EXISTS idx_career_stats_player_year ON player_career_stats(player_id, season_year);",
        "CREATE INDEX IF NOT EXISTS idx_career_stats_year ON player_career_stats(season_year);",
        "CREATE INDEX IF NOT EXISTS idx_game_logs_player_date ON player_game_logs(player_id, game_date);",
        "CREATE INDEX IF NOT EXISTS idx_game_logs_date ON player_game_logs(game_date);"
    ]
    
    try:
        execute_sql(career_table_sql)
        print("✅ Created player_career_stats table")
        
        execute_sql(game_logs_table_sql)
        print("✅ Created player_game_logs table")
        
        for index_sql in indexes_sql:
            execute_sql(index_sql)
        print("✅ Created performance indexes")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

def get_all_players():
    """Get ALL active players - SAME as your existing system"""
    print("🔍 Fetching ALL active players from database...")
    
    sql = """
    SELECT player_id, mlb_id, first_name, last_name, position 
    FROM mlb_players 
    WHERE is_active = true
    ORDER BY last_name, first_name
    """
    
    response = execute_sql(sql)
    
    players = []
    for record in response.get('records', []):
        players.append({
            'player_id': record[0]['longValue'],
            'mlb_id': record[1]['longValue'] if record[1].get('longValue') else record[0]['longValue'],
            'first_name': record[2]['stringValue'] if record[2].get('stringValue') else '',
            'last_name': record[3]['stringValue'] if record[3].get('stringValue') else '',
            'position': record[4]['stringValue'] if record[4].get('stringValue') else ''
        })
    
    print(f"📊 Found {len(players)} total active players to process")
    return players

def fetch_mlb_career_stats(mlb_id):
    """Fetch year-by-year career stats from MLB API"""
    try:
        url = f"https://statsapi.mlb.com/api/v1/people/{mlb_id}/stats"
        params = {
            'stats': 'yearByYear',
            'group': 'hitting,pitching'
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            return None
            
    except requests.RequestException as e:
        print(f"  ❌ Error fetching career stats: {e}")
        return None

def fetch_mlb_game_logs(mlb_id, season_year=2025):
    """Fetch individual game logs from MLB API"""
    try:
        url = f"https://statsapi.mlb.com/api/v1/people/{mlb_id}/stats"
        params = {
            'stats': 'gameLog',
            'season': str(season_year)
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            return None
            
    except requests.RequestException as e:
        print(f"  ❌ Error fetching game logs: {e}")
        return None

def process_career_stats(player):
    """Process career stats for a player - FIXED to handle two-way players"""
    try:
        player_id = player['player_id']
        mlb_id = player['mlb_id']
        
        # Delete existing career stats
        delete_sql = "DELETE FROM player_career_stats WHERE player_id = :player_id"
        delete_params = [{'name': 'player_id', 'value': {'longValue': player_id}}]
        execute_sql(delete_sql, delete_params)
        
        career_data = fetch_mlb_career_stats(mlb_id)
        if not career_data:
            return 0
        
        inserted_seasons = 0
        
        # Group stats by season to handle two-way players
        seasons_data = {}
        
        for stat_group in career_data.get('stats', []):
            group_type = stat_group.get('group', {}).get('displayName', '')
            
            for split in stat_group.get('splits', []):
                season = split.get('season', '')
                team = split.get('team', {})
                league = split.get('league', {})
                stat = split.get('stat', {})
                
                # Only process MLB regular season for now
                if split.get('sport', {}).get('id') != 1:  # MLB = sport ID 1
                    continue
                
                if not season:
                    continue
                
                season_key = f"{season}_{team.get('abbreviation', '')}_{league.get('abbreviation', '')}"
                
                if season_key not in seasons_data:
                    seasons_data[season_key] = {
                        'season': season,
                        'team': team,
                        'league': league,
                        'hitting': None,
                        'pitching': None
                    }
                
                if group_type.lower() == 'hitting':
                    seasons_data[season_key]['hitting'] = stat
                elif group_type.lower() == 'pitching':
                    seasons_data[season_key]['pitching'] = stat
        
        # Now insert one record per season, combining hitting and pitching stats
        for season_key, season_data in seasons_data.items():
            try:
                hitting_stat = season_data['hitting']
                pitching_stat = season_data['pitching']
                team = season_data['team']
                league = season_data['league']
                season = season_data['season']
                
                # Use UPSERT to handle potential duplicates
                sql = """
                INSERT INTO player_career_stats (
                    player_id, season_year, league, team_abbreviation, team_name,
                    games_played, 
                    -- Hitting stats
                    at_bats, hits, runs, rbis, home_runs, doubles, triples,
                    stolen_bases, walks, strikeouts, avg, obp, slg, ops,
                    -- Pitching stats
                    innings_pitched, wins, losses, saves, era, whip,
                    earned_runs, hits_allowed, walks_allowed, strikeouts_pitched
                ) VALUES (
                    :player_id, :season_year, :league, :team_abbr, :team_name,
                    :games_played,
                    :at_bats, :hits, :runs, :rbis, :home_runs, :doubles, :triples,
                    :stolen_bases, :walks, :strikeouts, :avg, :obp, :slg, :ops,
                    :innings_pitched, :wins, :losses, :saves, :era, :whip,
                    :earned_runs, :hits_allowed, :walks_allowed, :strikeouts_pitched
                )
                ON CONFLICT (player_id, season_year, is_playoff) 
                DO UPDATE SET
                    league = EXCLUDED.league,
                    team_abbreviation = EXCLUDED.team_abbreviation,
                    team_name = EXCLUDED.team_name,
                    games_played = EXCLUDED.games_played,
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
                    avg = EXCLUDED.avg,
                    obp = EXCLUDED.obp,
                    slg = EXCLUDED.slg,
                    ops = EXCLUDED.ops,
                    innings_pitched = EXCLUDED.innings_pitched,
                    wins = EXCLUDED.wins,
                    losses = EXCLUDED.losses,
                    saves = EXCLUDED.saves,
                    era = EXCLUDED.era,
                    whip = EXCLUDED.whip,
                    earned_runs = EXCLUDED.earned_runs,
                    hits_allowed = EXCLUDED.hits_allowed,
                    walks_allowed = EXCLUDED.walks_allowed,
                    strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                    updated_at = CURRENT_TIMESTAMP
                """
                
                # Determine games played (use max of hitting/pitching games)
                games_played = 0
                if hitting_stat:
                    games_played = max(games_played, hitting_stat.get('gamesPlayed', 0))
                if pitching_stat:
                    games_played = max(games_played, pitching_stat.get('gamesPlayed', 0))
                
                parameters = [
                    {'name': 'player_id', 'value': {'longValue': player_id}},
                    {'name': 'season_year', 'value': {'longValue': int(season)}},
                    {'name': 'league', 'value': {'stringValue': league.get('abbreviation', '')}},
                    {'name': 'team_abbr', 'value': {'stringValue': team.get('abbreviation', '')}},
                    {'name': 'team_name', 'value': {'stringValue': team.get('name', '')}},
                    {'name': 'games_played', 'value': {'longValue': games_played}},
                    
                    # Hitting stats (0 if no hitting data)
                    {'name': 'at_bats', 'value': {'longValue': hitting_stat.get('atBats', 0) if hitting_stat else 0}},
                    {'name': 'hits', 'value': {'longValue': hitting_stat.get('hits', 0) if hitting_stat else 0}},
                    {'name': 'runs', 'value': {'longValue': hitting_stat.get('runs', 0) if hitting_stat else 0}},
                    {'name': 'rbis', 'value': {'longValue': hitting_stat.get('rbi', 0) if hitting_stat else 0}},
                    {'name': 'home_runs', 'value': {'longValue': hitting_stat.get('homeRuns', 0) if hitting_stat else 0}},
                    {'name': 'doubles', 'value': {'longValue': hitting_stat.get('doubles', 0) if hitting_stat else 0}},
                    {'name': 'triples', 'value': {'longValue': hitting_stat.get('triples', 0) if hitting_stat else 0}},
                    {'name': 'stolen_bases', 'value': {'longValue': hitting_stat.get('stolenBases', 0) if hitting_stat else 0}},
                    {'name': 'walks', 'value': {'longValue': hitting_stat.get('baseOnBalls', 0) if hitting_stat else 0}},
                    {'name': 'strikeouts', 'value': {'longValue': hitting_stat.get('strikeOuts', 0) if hitting_stat else 0}},
                    {'name': 'avg', 'value': {'doubleValue': float(hitting_stat.get('avg', '0')) if hitting_stat else 0.0}},
                    {'name': 'obp', 'value': {'doubleValue': float(hitting_stat.get('obp', '0')) if hitting_stat else 0.0}},
                    {'name': 'slg', 'value': {'doubleValue': float(hitting_stat.get('slg', '0')) if hitting_stat else 0.0}},
                    {'name': 'ops', 'value': {'doubleValue': float(hitting_stat.get('ops', '0')) if hitting_stat else 0.0}},
                    
                    # Pitching stats (0 if no pitching data)
                    {'name': 'innings_pitched', 'value': {'doubleValue': float(pitching_stat.get('inningsPitched', '0')) if pitching_stat else 0.0}},
                    {'name': 'wins', 'value': {'longValue': pitching_stat.get('wins', 0) if pitching_stat else 0}},
                    {'name': 'losses', 'value': {'longValue': pitching_stat.get('losses', 0) if pitching_stat else 0}},
                    {'name': 'saves', 'value': {'longValue': pitching_stat.get('saves', 0) if pitching_stat else 0}},
                    {'name': 'era', 'value': {'doubleValue': float(pitching_stat.get('era', '0')) if pitching_stat else 0.0}},
                    {'name': 'whip', 'value': {'doubleValue': float(pitching_stat.get('whip', '0')) if pitching_stat else 0.0}},
                    {'name': 'earned_runs', 'value': {'longValue': pitching_stat.get('earnedRuns', 0) if pitching_stat else 0}},
                    {'name': 'hits_allowed', 'value': {'longValue': pitching_stat.get('hits', 0) if pitching_stat else 0}},
                    {'name': 'walks_allowed', 'value': {'longValue': pitching_stat.get('baseOnBalls', 0) if pitching_stat else 0}},
                    {'name': 'strikeouts_pitched', 'value': {'longValue': pitching_stat.get('strikeOuts', 0) if pitching_stat else 0}}
                ]
                
                execute_sql(sql, parameters)
                inserted_seasons += 1
                
            except Exception as season_error:
                print(f"    ⚠️ Error processing season {season}: {season_error}")
                continue
        
        return inserted_seasons
        
    except Exception as e:
        print(f"  ❌ Error processing career stats: {e}")
        return 0

def process_game_logs(player):
    """Process 2025 game logs for a player"""
    try:
        player_id = player['player_id']
        mlb_id = player['mlb_id']
        
        # Delete existing 2025 game logs
        delete_sql = "DELETE FROM player_game_logs WHERE player_id = :player_id AND season_year = 2025"
        delete_params = [{'name': 'player_id', 'value': {'longValue': player_id}}]
        execute_sql(delete_sql, delete_params)
        
        game_data = fetch_mlb_game_logs(mlb_id, 2025)
        if not game_data:
            return 0
        
        inserted_games = 0
        
        for stat_group in game_data.get('stats', []):
            for split in stat_group.get('splits', []):
                date_str = split.get('date', '')
                team = split.get('team', {})
                opponent = split.get('opponent', {})
                stat = split.get('stat', {})
                
                if not date_str:
                    continue
                
                # Convert date string to proper format
                try:
                    game_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                except:
                    continue
                
                # Determine if hitting or pitching game
                is_hitting_game = stat.get('atBats', 0) > 0 or stat.get('plateAppearances', 0) > 0
                is_pitching_game = float(stat.get('inningsPitched', '0')) > 0
                
                if is_hitting_game:
                    # Insert hitting game log
                    sql = """
                    INSERT INTO player_game_logs (
                        player_id, game_date, season_year, team_abbreviation, opponent_abbreviation,
                        games_played, at_bats, hits, runs, rbis, home_runs, doubles, triples,
                        stolen_bases, walks, strikeouts, hit_by_pitch
                    ) VALUES (
                        :player_id, :game_date, 2025, :team_abbr, :opponent_abbr,
                        :games_played, :at_bats, :hits, :runs, :rbis, :home_runs, :doubles, :triples,
                        :stolen_bases, :walks, :strikeouts, :hit_by_pitch
                    )
                    ON CONFLICT (player_id, game_date, game_number) DO NOTHING
                    """
                    
                    parameters = [
                        {'name': 'player_id', 'value': {'longValue': player_id}},
                        {'name': 'game_date', 'value': {'stringValue': str(game_date)}, 'typeHint': 'DATE'},
                        {'name': 'team_abbr', 'value': {'stringValue': team.get('abbreviation', '')}},
                        {'name': 'opponent_abbr', 'value': {'stringValue': opponent.get('abbreviation', '')}},
                        {'name': 'games_played', 'value': {'longValue': 1}},
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
                    inserted_games += 1
                    
                elif is_pitching_game:
                    # Insert pitching game log
                    sql = """
                    INSERT INTO player_game_logs (
                        player_id, game_date, season_year, team_abbreviation, opponent_abbreviation,
                        games_played, innings_pitched, wins, losses, saves, earned_runs,
                        hits_allowed, walks_allowed, strikeouts_pitched
                    ) VALUES (
                        :player_id, :game_date, 2025, :team_abbr, :opponent_abbr,
                        :games_played, :innings_pitched, :wins, :losses, :saves, :earned_runs,
                        :hits_allowed, :walks_allowed, :strikeouts_pitched
                    )
                    ON CONFLICT (player_id, game_date, game_number) DO NOTHING
                    """
                    
                    parameters = [
                        {'name': 'player_id', 'value': {'longValue': player_id}},
                        {'name': 'game_date', 'value': {'stringValue': str(game_date)}, 'typeHint': 'DATE'},
                        {'name': 'team_abbr', 'value': {'stringValue': team.get('abbreviation', '')}},
                        {'name': 'opponent_abbr', 'value': {'stringValue': opponent.get('abbreviation', '')}},
                        {'name': 'games_played', 'value': {'longValue': 1}},
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
                    inserted_games += 1
        
        return inserted_games
        
    except Exception as e:
        print(f"  ❌ Error processing game logs: {e}")
        return 0

def main():
    """Main execution function - COMPREHENSIVE DATA POPULATION"""
    start_time = datetime.now()
    print("🚀 Starting COMPREHENSIVE MLB Data Population...")
    print("💪 Building complete analytics platform with career stats + game logs")
    print()
    
    try:
        # Step 1: Create new tables
        if not create_new_tables():
            print("❌ Failed to create tables. Exiting.")
            return
        
        print()
        
        # Step 2: Get all players
        players = get_all_players()
        
        if not players:
            print("❌ No players found in database")
            return
        
        processed = 0
        errors = 0
        total_career_seasons = 0
        total_game_logs = 0
        
        print("📈 Phase 1: Processing Career Statistics...")
        print("=" * 60)
        
        for i, player in enumerate(players):
            print(f"[{i+1}/{len(players)}] {player['first_name']} {player['last_name']} ({player['position']})")
            
            try:
                # Process career stats
                career_seasons = process_career_stats(player)
                total_career_seasons += career_seasons
                
                if career_seasons > 0:
                    print(f"  ✅ CAREER: {career_seasons} seasons processed")
                else:
                    print(f"  ⚠️  No career data available")
                
                processed += 1
                    
            except Exception as e:
                print(f"  ❌ Failed to process career: {e}")
                errors += 1
            
            # Rate limiting
            if i < len(players) - 1:
                time.sleep(0.3)  # Faster than your existing script
        
        print()
        print("📊 Phase 2: Processing 2025 Game Logs...")
        print("=" * 60)
        
        for i, player in enumerate(players):
            print(f"[{i+1}/{len(players)}] {player['first_name']} {player['last_name']} - Game Logs")
            
            try:
                # Process game logs
                game_logs = process_game_logs(player)
                total_game_logs += game_logs
                
                if game_logs > 0:
                    print(f"  ✅ GAMES: {game_logs} individual games processed")
                else:
                    print(f"  ⚠️  No 2025 game logs available")
                    
            except Exception as e:
                print(f"  ❌ Failed to process game logs: {e}")
                errors += 1
            
            # Rate limiting
            if i < len(players) - 1:
                time.sleep(0.3)
        
        duration = datetime.now() - start_time
        print()
        print("🎉 COMPREHENSIVE MLB Data Population Complete!")
        print("=" * 60)
        print(f"✅ Players processed: {processed}")
        print(f"❌ Errors: {errors}")
        print(f"📈 Career seasons: {total_career_seasons}")
        print(f"📊 Game logs: {total_game_logs}")
        print(f"⏱️  Total duration: {duration}")
        print()
        print("🔥 Your system now has:")
        print("   • Complete career histories")
        print("   • Individual game-by-game logs")  
        print("   • Hot/cold streak detection capability")
        print("   • Recent performance analytics")
        print("   • Professional-grade baseball data!")
        
    except Exception as e:
        print(f"❌ Script failed: {e}")

if __name__ == "__main__":
    main()