# master_daily_updater.py
"""
Master Daily Updater Lambda - COMPLETE VERSION
Includes MLB API ingestion, new player discovery, all stat calculations
Rebuilt from fragments after corruption incident
"""
import json
import logging
import boto3
import os
import requests
import uuid
from datetime import datetime, date, timedelta
import time
from typing import Dict, List, Optional, Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Database configuration
DB_CLUSTER_ARN = os.environ.get('DB_CLUSTER_ARN')
DB_SECRET_ARN = os.environ.get('DB_SECRET_ARN')
rds_client = boto3.client('rds-data', region_name='us-east-1')

# MLB Team ID to Abbreviation mapping (critical for game logs)
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

def get_current_season():
    """Get current MLB season year"""
    now = datetime.now()
    return now.year if now.month >= 4 else now.year - 1

CURRENT_SEASON = get_current_season()
SEASON_START = f"{CURRENT_SEASON}-03-28"

def execute_sql(sql, params=None, database_name='postgres'):
    """Execute SQL using RDS Data API"""
    try:
        request = {
            'resourceArn': DB_CLUSTER_ARN,
            'secretArn': DB_SECRET_ARN,
            'database': database_name,
            'sql': sql
        }
        if params:
            # Handle both dictionary and list parameter formats
            if isinstance(params, dict):
                request['parameters'] = [
                    {'name': k, 'value': {'longValue': v} if isinstance(v, int) 
                     else {'doubleValue': v} if isinstance(v, float)
                     else {'booleanValue': v} if isinstance(v, bool)
                     else {'stringValue': str(v)}}
                    for k, v in params.items()
                ]
            else:
                request['parameters'] = params
        return rds_client.execute_statement(**request)
    except Exception as e:
        logger.error(f"SQL Error: {e}")
        raise

def get_team_abbreviation(team_data):
    """Convert team data to abbreviation using team ID mapping"""
    if isinstance(team_data, dict):
        team_id = team_data.get('id')
        if team_id in MLB_TEAM_MAPPING:
            return MLB_TEAM_MAPPING[team_id]
        else:
            name = team_data.get('name', '')
            logger.warning(f"Unknown team ID {team_id}: {name}")
            return f"T{team_id}"
    return ''

# ============================================================================
# SECTION 1: MLB API INGESTION
# ============================================================================

def fetch_yesterdays_games(target_date=None):
    """Fetch all completed games from yesterday"""
    if not target_date:
        target_date = date.today() - timedelta(days=1)
    
    date_str = target_date.strftime('%Y-%m-%d')
    logger.info(f"📅 Fetching games for {date_str}")
    
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
                    if game.get('status', {}).get('codedGameState') == 'F':  # Final
                        home_team = game['teams']['home']['team']
                        away_team = game['teams']['away']['team']
                        
                        games.append({
                            'game_pk': game['gamePk'],
                            'game_date': target_date,
                            'home_team': get_team_abbreviation(home_team),
                            'away_team': get_team_abbreviation(away_team),
                            'home_score': game['teams']['home'].get('score', 0),
                            'away_score': game['teams']['away'].get('score', 0)
                        })
            
            logger.info(f"Found {len(games)} completed games")
            return games
        else:
            logger.error(f"MLB Schedule API error: {response.status_code}")
            return []
    except Exception as e:
        logger.error(f"Error fetching schedule: {e}")
        return []

def fetch_player_game_log(mlb_id, target_date):
    """Fetch a specific player's game log for a date"""
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
            return None
        else:
            return None
    except Exception as e:
        logger.error(f"Error fetching game log for player {mlb_id}: {e}")
        return None

def discover_new_player(mlb_id):
    """Discover and add a new player from MLB API"""
    try:
        url = f"https://statsapi.mlb.com/api/v1/people/{mlb_id}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            people = data.get('people', [])
            
            if people:
                player = people[0]
                
                # Insert new player into mlb_players table (player_id IS the MLB ID)
                sql = """
                INSERT INTO mlb_players (
                    player_id, first_name, last_name, 
                    position, mlb_team, jersey_number, 
                    birthdate, height_inches, weight_pounds,
                    is_active, created_at
                ) VALUES (
                    :player_id, :first_name, :last_name,
                    :position, :mlb_team, :jersey_number,
                    :birthdate, :height_inches, :weight_pounds,
                    true, NOW()
                )
                ON CONFLICT (player_id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    position = EXCLUDED.position,
                    mlb_team = EXCLUDED.mlb_team,
                    jersey_number = EXCLUDED.jersey_number,
                    is_active = true,
                    updated_at = NOW()
                """
                
                # Calculate height in inches
                height_str = player.get('height', '0\' 0"')
                feet, inches = height_str.replace('"', '').split("'")
                height_inches = int(feet.strip()) * 12 + int(inches.strip())
                
                params = {
                    'player_id': mlb_id,  # player_id IS the MLB ID
                    'first_name': player.get('firstName', ''),
                    'last_name': player.get('lastName', ''),
                    'position': player.get('primaryPosition', {}).get('abbreviation', ''),
                    'mlb_team': get_team_abbreviation(player.get('currentTeam', {})),
                    'jersey_number': player.get('primaryNumber', ''),
                    'birthdate': player.get('birthDate', None),
                    'height_inches': height_inches,
                    'weight_pounds': player.get('weight', 0)
                }
                
                execute_sql(sql, params, 'postgres')
                logger.info(f"✅ Added new player: {params['first_name']} {params['last_name']}")
                return True
        
        return False
    except Exception as e:
        logger.error(f"Error discovering player {mlb_id}: {e}")
        return False

def update_game_log(player_id, mlb_id, game_data):
    """Insert/update a game log entry"""
    try:
        game_date = game_data['date']
        stat = game_data['stat']
        team = game_data['team']
        opponent = game_data['opponent']
        
        team_abbr = get_team_abbreviation(team)
        opponent_abbr = get_team_abbreviation(opponent)
        
        # Determine if hitting or pitching game
        is_hitting = stat.get('atBats', 0) > 0 or stat.get('plateAppearances', 0) > 0
        is_pitching = float(stat.get('inningsPitched', '0') or 0) > 0
        
        # Common parameters
        base_params = {
            'player_id': player_id,
            'game_date': str(game_date),
            'team': team_abbr,
            'opponent': opponent_abbr,
            'games_played': 1
        }
        
        if is_hitting:
            # Insert hitting stats
            sql = """
            INSERT INTO player_game_logs (
                player_id, game_date, mlb_team, opponent,
                games_played, at_bats, hits, runs, rbi, home_runs, 
                doubles, triples, stolen_bases, caught_stealing,
                walks, strikeouts, batting_avg
            ) VALUES (
                :player_id, :game_date::date, :team, :opponent,
                1, :at_bats, :hits, :runs, :rbi, :home_runs,
                :doubles, :triples, :stolen_bases, :caught_stealing,
                :walks, :strikeouts, :batting_avg
            )
            ON CONFLICT (player_id, game_date) DO UPDATE SET
                at_bats = EXCLUDED.at_bats,
                hits = EXCLUDED.hits,
                runs = EXCLUDED.runs,
                rbi = EXCLUDED.rbi,
                home_runs = EXCLUDED.home_runs,
                doubles = EXCLUDED.doubles,
                triples = EXCLUDED.triples,
                stolen_bases = EXCLUDED.stolen_bases,
                caught_stealing = EXCLUDED.caught_stealing,
                walks = EXCLUDED.walks,
                strikeouts = EXCLUDED.strikeouts,
                batting_avg = EXCLUDED.batting_avg,
                updated_at = NOW()
            """
            
            ab = stat.get('atBats', 0)
            h = stat.get('hits', 0)
            avg = (h / ab) if ab > 0 else 0.0
            
            params = {**base_params, **{
                'at_bats': stat.get('atBats', 0),
                'hits': stat.get('hits', 0),
                'runs': stat.get('runs', 0),
                'rbi': stat.get('rbi', 0),
                'home_runs': stat.get('homeRuns', 0),
                'doubles': stat.get('doubles', 0),
                'triples': stat.get('triples', 0),
                'stolen_bases': stat.get('stolenBases', 0),
                'caught_stealing': stat.get('caughtStealing', 0),
                'walks': stat.get('baseOnBalls', 0),
                'strikeouts': stat.get('strikeOuts', 0),
                'batting_avg': avg
            }}
            
            execute_sql(sql, params, 'postgres')
            return 'hitting'
            
        elif is_pitching:
            # Insert pitching stats WITH quality_starts calculation
            sql = """
            INSERT INTO player_game_logs (
                player_id, game_date, mlb_team, opponent,
                games_played, innings_pitched, wins, losses, saves,
                earned_runs, hits_allowed, walks_allowed, strikeouts_pitched,
                era, whip, quality_starts, blown_saves, holds
            ) VALUES (
                :player_id, :game_date::date, :team, :opponent,
                1, :innings_pitched, :wins, :losses, :saves,
                :earned_runs, :hits_allowed, :walks_allowed, :strikeouts_pitched,
                :era, :whip, :quality_starts, :blown_saves, :holds
            )
            ON CONFLICT (player_id, game_date) DO UPDATE SET
                innings_pitched = EXCLUDED.innings_pitched,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                saves = EXCLUDED.saves,
                earned_runs = EXCLUDED.earned_runs,
                hits_allowed = EXCLUDED.hits_allowed,
                walks_allowed = EXCLUDED.walks_allowed,
                strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                era = EXCLUDED.era,
                whip = EXCLUDED.whip,
                quality_starts = EXCLUDED.quality_starts,
                blown_saves = EXCLUDED.blown_saves,
                holds = EXCLUDED.holds,
                updated_at = NOW()
            """
            
            ip = float(stat.get('inningsPitched', '0') or 0)
            er = stat.get('earnedRuns', 0)
            ha = stat.get('hits', 0)
            wa = stat.get('baseOnBalls', 0)
            
            era = (er * 9 / ip) if ip > 0 else 0.0
            whip = ((ha + wa) / ip) if ip > 0 else 0.0
            
            # CRITICAL: Calculate Quality Start (6+ IP, 3 or fewer ER)
            quality_start = 1 if ip >= 6.0 and er <= 3 else 0
            
            params = {**base_params, **{
                'innings_pitched': ip,
                'wins': stat.get('wins', 0),
                'losses': stat.get('losses', 0),
                'saves': stat.get('saves', 0),
                'earned_runs': er,
                'hits_allowed': ha,
                'walks_allowed': wa,
                'strikeouts_pitched': stat.get('strikeOuts', 0),
                'era': era,
                'whip': whip,
                'quality_starts': quality_start,  # STORING QS!
                'blown_saves': stat.get('blownSaves', 0),
                'holds': stat.get('holds', 0)
            }}
            
            execute_sql(sql, params, 'postgres')
            return 'pitching'
        
        return None
        
    except Exception as e:
        logger.error(f"Error updating game log: {e}")
        return None

def ingest_mlb_game_logs(target_date=None):
    """Main MLB API ingestion process"""
    if not target_date:
        target_date = date.today() - timedelta(days=1)
    
    logger.info(f"🎮 Starting MLB game log ingestion for {target_date}")
    
    # Get yesterday's games
    games = fetch_yesterdays_games(target_date)
    if not games:
        logger.info("No games to process")
        return {'games': 0, 'players_updated': 0, 'new_players': 0}
    
    # Get all active players (no mlb_id column, player_id IS the MLB ID)
    sql = """
    SELECT player_id, first_name, last_name
    FROM mlb_players 
    WHERE is_active = true
    """
    
    result = execute_sql(sql, database_name='postgres')
    existing_players = {}
    
    for record in result.get('records', []):
        player_id = record[0].get('longValue')
        existing_players[player_id] = {
            'player_id': player_id,
            'mlb_id': player_id,  # player_id IS the MLB ID
            'name': f"{record[1].get('stringValue', '')} {record[2].get('stringValue', '')}"
        }
    
    players_updated = 0
    new_players_added = 0
    players_checked = set()
    
    # Process each game's box score to get player appearances
    for game in games:
        try:
            # Get detailed box score
            url = f"https://statsapi.mlb.com/api/v1.1/game/{game['game_pk']}/feed/live"
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200:
                game_data = response.json()
                
                # Process all players in the game
                all_players = game_data.get('liveData', {}).get('boxscore', {}).get('teams', {})
                
                for team_type in ['home', 'away']:
                    team_players = all_players.get(team_type, {}).get('players', {})
                    
                    for player_key, player_info in team_players.items():
                        mlb_id = player_info.get('person', {}).get('id')
                        
                        if mlb_id and mlb_id not in players_checked:
                            players_checked.add(mlb_id)
                            
                            # Check if player exists
                            if mlb_id not in existing_players:
                                # New player discovered!
                                if discover_new_player(mlb_id):
                                    new_players_added += 1
                                    existing_players[mlb_id] = {
                                        'player_id': mlb_id,
                                        'mlb_id': mlb_id
                                    }
                            
                            # Get player's game log
                            if mlb_id in existing_players:
                                game_log = fetch_player_game_log(mlb_id, target_date)
                                if game_log:
                                    player_id = existing_players[mlb_id]['player_id']
                                    if update_game_log(player_id, mlb_id, game_log):
                                        players_updated += 1
                
                # Small delay between games
                time.sleep(0.5)
                
        except Exception as e:
            logger.error(f"Error processing game {game['game_pk']}: {e}")
            continue
    
    logger.info(f"✅ MLB ingestion complete: {len(games)} games, {players_updated} players updated, {new_players_added} new players")
    
    return {
        'games': len(games),
        'players_updated': players_updated,
        'new_players': new_players_added
    }

# ============================================================================
# SECTION 2: SEASON STATS CALCULATION
# ============================================================================

def calculate_season_stats():
    """Calculate season stats from game logs"""
    try:
        logger.info("📊 Calculating season stats from game logs")
        
        # IMPORTANT: quality_starts is now stored in game logs and aggregated here
        sql = f"""
        INSERT INTO player_season_stats (
            player_id, season, games_played, at_bats, runs, hits, 
            doubles, triples, home_runs, rbi, stolen_bases, caught_stealing,
            walks, strikeouts, batting_avg, obp, slg, ops,
            games_started, wins, losses, saves, innings_pitched,
            hits_allowed, earned_runs, walks_allowed, strikeouts_pitched,
            era, whip, quality_starts, blown_saves, holds
        )
        SELECT 
            player_id,
            {CURRENT_SEASON} as season,
            COUNT(*) as games_played,
            COALESCE(SUM(at_bats), 0) as at_bats,
            COALESCE(SUM(runs), 0) as runs,
            COALESCE(SUM(hits), 0) as hits,
            COALESCE(SUM(doubles), 0) as doubles,
            COALESCE(SUM(triples), 0) as triples,
            COALESCE(SUM(home_runs), 0) as home_runs,
            COALESCE(SUM(rbi), 0) as rbi,
            COALESCE(SUM(stolen_bases), 0) as stolen_bases,
            COALESCE(SUM(caught_stealing), 0) as caught_stealing,
            COALESCE(SUM(walks), 0) as walks,
            COALESCE(SUM(strikeouts), 0) as strikeouts,
            -- Batting average
            CASE WHEN SUM(at_bats) > 0 
                THEN ROUND(SUM(hits)::NUMERIC / SUM(at_bats), 3)
                ELSE 0.000 
            END as batting_avg,
            -- OBP
            CASE WHEN (SUM(at_bats) + SUM(walks)) > 0 
                THEN ROUND((SUM(hits) + SUM(walks))::NUMERIC / 
                          (SUM(at_bats) + SUM(walks)), 3)
                ELSE 0.000 
            END as obp,
            -- SLG
            CASE WHEN SUM(at_bats) > 0 
                THEN ROUND((SUM(hits) + SUM(doubles) + 2*SUM(triples) + 3*SUM(home_runs))::NUMERIC / 
                          SUM(at_bats), 3)
                ELSE 0.000 
            END as slg,
            0.000 as ops, -- Will be calculated after
            -- Pitching stats
            SUM(CASE WHEN innings_pitched > 0 THEN 1 ELSE 0 END) as games_started,
            COALESCE(SUM(wins), 0) as wins,
            COALESCE(SUM(losses), 0) as losses,
            COALESCE(SUM(saves), 0) as saves,
            COALESCE(SUM(innings_pitched), 0) as innings_pitched,
            COALESCE(SUM(hits_allowed), 0) as hits_allowed,
            COALESCE(SUM(earned_runs), 0) as earned_runs,
            COALESCE(SUM(walks_allowed), 0) as walks_allowed,
            COALESCE(SUM(strikeouts_pitched), 0) as strikeouts_pitched,
            -- ERA
            CASE WHEN SUM(innings_pitched) > 0 
                THEN ROUND((SUM(earned_runs) * 9.0) / SUM(innings_pitched), 2)
                ELSE 0.00 
            END as era,
            -- WHIP
            CASE WHEN SUM(innings_pitched) > 0 
                THEN ROUND((SUM(hits_allowed) + SUM(walks_allowed))::NUMERIC / 
                          SUM(innings_pitched), 3)
                ELSE 0.000 
            END as whip,
            -- Quality Starts - now summing from stored values in game logs!
            COALESCE(SUM(quality_starts), 0) as quality_starts,
            COALESCE(SUM(blown_saves), 0) as blown_saves,
            COALESCE(SUM(holds), 0) as holds
        FROM player_game_logs
        WHERE EXTRACT(YEAR FROM game_date) = {CURRENT_SEASON}
        GROUP BY player_id
        ON CONFLICT (player_id, season) 
        DO UPDATE SET
            games_played = EXCLUDED.games_played,
            at_bats = EXCLUDED.at_bats,
            runs = EXCLUDED.runs,
            hits = EXCLUDED.hits,
            doubles = EXCLUDED.doubles,
            triples = EXCLUDED.triples,
            home_runs = EXCLUDED.home_runs,
            rbi = EXCLUDED.rbi,
            stolen_bases = EXCLUDED.stolen_bases,
            caught_stealing = EXCLUDED.caught_stealing,
            walks = EXCLUDED.walks,
            strikeouts = EXCLUDED.strikeouts,
            batting_avg = EXCLUDED.batting_avg,
            obp = EXCLUDED.obp,
            slg = EXCLUDED.slg,
            games_started = EXCLUDED.games_started,
            wins = EXCLUDED.wins,
            losses = EXCLUDED.losses,
            saves = EXCLUDED.saves,
            innings_pitched = EXCLUDED.innings_pitched,
            hits_allowed = EXCLUDED.hits_allowed,
            earned_runs = EXCLUDED.earned_runs,
            walks_allowed = EXCLUDED.walks_allowed,
            strikeouts_pitched = EXCLUDED.strikeouts_pitched,
            era = EXCLUDED.era,
            whip = EXCLUDED.whip,
            quality_starts = EXCLUDED.quality_starts,
            blown_saves = EXCLUDED.blown_saves,
            holds = EXCLUDED.holds,
            last_updated = NOW()
        """
        
        execute_sql(sql, database_name='postgres')
        
        # Update OPS
        execute_sql(f"""
            UPDATE player_season_stats 
            SET ops = obp + slg 
            WHERE season = {CURRENT_SEASON}
        """, database_name='postgres')
        
        logger.info("✅ Season stats calculated successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error calculating season stats: {e}")
        return False

def sync_stats_to_leagues():
    """Sync season stats to all active leagues"""
    try:
        logger.info("🔄 Syncing stats to league databases")
        
        # First get all season stats from postgres
        stats_query = f"""
        SELECT 
            player_id, games_played, at_bats, runs, hits, 
            doubles, triples, home_runs, rbi, stolen_bases, caught_stealing,
            walks, strikeouts, batting_avg, obp, slg, ops,
            games_started, wins, losses, saves, innings_pitched,
            hits_allowed, earned_runs, walks_allowed, strikeouts_pitched,
            era, whip, quality_starts, blown_saves, holds
        FROM player_season_stats
        WHERE season = {CURRENT_SEASON}
        """
        
        stats_result = execute_sql(stats_query, database_name='postgres')
        
        if not stats_result or not stats_result.get('records'):
            logger.warning("No season stats to sync")
            return 0
        
        # Get active leagues from leagues database
        leagues_query = """
        SELECT league_id, league_name 
        FROM leagues 
        WHERE is_active = true
        """
        
        leagues_result = execute_sql(leagues_query, database_name='leagues')
        
        if not leagues_result or not leagues_result.get('records'):
            logger.warning("No active leagues found")
            return 0
        
        leagues_synced = 0
        
        # Process each league
        for league_record in leagues_result['records']:
            league_id = league_record[0].get('stringValue')
            league_name = league_record[1].get('stringValue', 'Unknown')
            
            try:
                # Batch insert stats for this league
                batch_size = 100
                total_inserted = 0
                
                for i in range(0, len(stats_result['records']), batch_size):
                    batch = stats_result['records'][i:i+batch_size]
                    
                    for stat_record in batch:
                        # Insert each player's stats for this league
                        insert_sql = f"""
                        INSERT INTO player_season_stats (
                            player_id, league_id, season, games_played, at_bats, runs, hits,
                            doubles, triples, home_runs, rbi, stolen_bases, caught_stealing,
                            walks, strikeouts, batting_avg, obp, slg, ops,
                            games_started, wins, losses, saves, innings_pitched,
                            hits_allowed, earned_runs, walks_allowed, strikeouts_pitched,
                            era, whip, quality_starts, blown_saves, holds
                        ) VALUES (
                            :player_id, :league_id::uuid, {CURRENT_SEASON}, :games_played, :at_bats, :runs, :hits,
                            :doubles, :triples, :home_runs, :rbi, :stolen_bases, :caught_stealing,
                            :walks, :strikeouts, :batting_avg, :obp, :slg, :ops,
                            :games_started, :wins, :losses, :saves, :innings_pitched,
                            :hits_allowed, :earned_runs, :walks_allowed, :strikeouts_pitched,
                            :era, :whip, :quality_starts, :blown_saves, :holds
                        )
                        ON CONFLICT (player_id, league_id, season)
                        DO UPDATE SET
                            games_played = EXCLUDED.games_played,
                            at_bats = EXCLUDED.at_bats,
                            runs = EXCLUDED.runs,
                            hits = EXCLUDED.hits,
                            doubles = EXCLUDED.doubles,
                            triples = EXCLUDED.triples,
                            home_runs = EXCLUDED.home_runs,
                            rbi = EXCLUDED.rbi,
                            stolen_bases = EXCLUDED.stolen_bases,
                            caught_stealing = EXCLUDED.caught_stealing,
                            walks = EXCLUDED.walks,
                            strikeouts = EXCLUDED.strikeouts,
                            batting_avg = EXCLUDED.batting_avg,
                            obp = EXCLUDED.obp,
                            slg = EXCLUDED.slg,
                            ops = EXCLUDED.ops,
                            games_started = EXCLUDED.games_started,
                            wins = EXCLUDED.wins,
                            losses = EXCLUDED.losses,
                            saves = EXCLUDED.saves,
                            innings_pitched = EXCLUDED.innings_pitched,
                            hits_allowed = EXCLUDED.hits_allowed,
                            earned_runs = EXCLUDED.earned_runs,
                            walks_allowed = EXCLUDED.walks_allowed,
                            strikeouts_pitched = EXCLUDED.strikeouts_pitched,
                            era = EXCLUDED.era,
                            whip = EXCLUDED.whip,
                            quality_starts = EXCLUDED.quality_starts,
                            blown_saves = EXCLUDED.blown_saves,
                            holds = EXCLUDED.holds,
                            last_updated = NOW()
                        """
                        
                        params = {
                            'player_id': stat_record[0].get('longValue'),
                            'league_id': league_id,
                            'games_played': stat_record[1].get('longValue', 0),
                            'at_bats': stat_record[2].get('longValue', 0),
                            'runs': stat_record[3].get('longValue', 0),
                            'hits': stat_record[4].get('longValue', 0),
                            'doubles': stat_record[5].get('longValue', 0),
                            'triples': stat_record[6].get('longValue', 0),
                            'home_runs': stat_record[7].get('longValue', 0),
                            'rbi': stat_record[8].get('longValue', 0),
                            'stolen_bases': stat_record[9].get('longValue', 0),
                            'caught_stealing': stat_record[10].get('longValue', 0),
                            'walks': stat_record[11].get('longValue', 0),
                            'strikeouts': stat_record[12].get('longValue', 0),
                            'batting_avg': stat_record[13].get('doubleValue', 0.0),
                            'obp': stat_record[14].get('doubleValue', 0.0),
                            'slg': stat_record[15].get('doubleValue', 0.0),
                            'ops': stat_record[16].get('doubleValue', 0.0),
                            'games_started': stat_record[17].get('longValue', 0),
                            'wins': stat_record[18].get('longValue', 0),
                            'losses': stat_record[19].get('longValue', 0),
                            'saves': stat_record[20].get('longValue', 0),
                            'innings_pitched': stat_record[21].get('doubleValue', 0.0),
                            'hits_allowed': stat_record[22].get('longValue', 0),
                            'earned_runs': stat_record[23].get('longValue', 0),
                            'walks_allowed': stat_record[24].get('longValue', 0),
                            'strikeouts_pitched': stat_record[25].get('longValue', 0),
                            'era': stat_record[26].get('doubleValue', 0.0),
                            'whip': stat_record[27].get('doubleValue', 0.0),
                            'quality_starts': stat_record[28].get('longValue', 0),
                            'blown_saves': stat_record[29].get('longValue', 0),
                            'holds': stat_record[30].get('longValue', 0)
                        }
                        
                        execute_sql(insert_sql, params, database_name='leagues')
                        total_inserted += 1
                
                logger.info(f"  ✅ Synced {total_inserted} players to league: {league_name}")
                leagues_synced += 1
                
            except Exception as e:
                logger.error(f"  ❌ Failed to sync league {league_name}: {e}")
                continue
        
        logger.info(f"✅ Synced stats to {leagues_synced} leagues")
        return leagues_synced
        
    except Exception as e:
        logger.error(f"Error syncing to leagues: {e}")
        return 0

def sync_new_players_to_leagues():
    """Sync new players to league databases"""
    try:
        logger.info("👥 Syncing new players to leagues")
        
        # Get all players from postgres
        postgres_players_query = """
        SELECT player_id, first_name, last_name, position, mlb_team, 
               jersey_number, birthdate, height_inches, weight_pounds, is_active
        FROM mlb_players
        WHERE is_active = true
        """
        
        postgres_result = execute_sql(postgres_players_query, database_name='postgres')
        
        if not postgres_result or not postgres_result.get('records'):
            logger.warning("No players found in postgres")
            return False
        
        # Get existing players from leagues database
        leagues_players_query = """
        SELECT DISTINCT mlb_player_id 
        FROM league_players
        """
        
        leagues_result = execute_sql(leagues_players_query, database_name='leagues')
        
        existing_player_ids = set()
        if leagues_result and leagues_result.get('records'):
            for record in leagues_result['records']:
                player_id = record[0].get('longValue')
                if player_id:
                    existing_player_ids.add(player_id)
        
        # Find new players
        new_players = []
        for record in postgres_result['records']:
            player_id = record[0].get('longValue')
            if player_id and player_id not in existing_player_ids:
                new_players.append({
                    'player_id': player_id,
                    'first_name': record[1].get('stringValue', ''),
                    'last_name': record[2].get('stringValue', ''),
                    'position': record[3].get('stringValue', ''),
                    'mlb_team': record[4].get('stringValue', ''),
                    'jersey_number': record[5].get('stringValue', ''),
                    'birthdate': record[6].get('stringValue'),
                    'height_inches': record[7].get('longValue', 0),
                    'weight_pounds': record[8].get('longValue', 0)
                })
        
        if new_players:
            logger.info(f"Found {len(new_players)} new players to sync")
            
            # Get all active leagues
            leagues_query = "SELECT league_id FROM leagues WHERE is_active = true"
            leagues_result = execute_sql(leagues_query, database_name='leagues')
            
            if leagues_result and leagues_result.get('records'):
                for league_record in leagues_result['records']:
                    league_id = league_record[0].get('stringValue')
                    
                    # Add new players to league_players table for each league
                    for player in new_players:
                        try:
                            insert_sql = """
                            INSERT INTO league_players (
                                league_player_id, league_id, mlb_player_id, 
                                player_name, position, mlb_team,
                                availability_status, created_at
                            ) VALUES (
                                :league_player_id::uuid, :league_id::uuid, :mlb_player_id,
                                :player_name, :position, :mlb_team,
                                'free_agent', NOW()
                            )
                            ON CONFLICT (league_id, mlb_player_id) DO NOTHING
                            """
                            
                            params = {
                                'league_player_id': str(uuid.uuid4()),
                                'league_id': league_id,
                                'mlb_player_id': player['player_id'],
                                'player_name': f"{player['first_name']} {player['last_name']}",
                                'position': player['position'],
                                'mlb_team': player['mlb_team']
                            }
                            
                            execute_sql(insert_sql, params, database_name='leagues')
                            
                        except Exception as e:
                            logger.error(f"Error adding player {player['player_id']} to league {league_id}: {e}")
                            continue
                
                logger.info(f"✅ Added {len(new_players)} new players to leagues")
        else:
            logger.info("No new players to sync")
        
        return True
        
    except Exception as e:
        logger.error(f"Error syncing new players: {e}")
        return False

# ============================================================================
# SECTION 3: IMPORT SUB-HANDLERS
# ============================================================================

# Import the sub-handlers we already created
try:
    from calculate_rolling_stats import lambda_handler as calculate_rolling_stats
    from update_active_accrued_stats import lambda_handler as update_accrued_stats
except ImportError as e:
    logger.warning(f"Could not import sub-handlers: {e}")
    calculate_rolling_stats = None
    update_accrued_stats = None

# ============================================================================
# SECTION 4: CLEANUP AND MAINTENANCE
# ============================================================================

def clean_old_data():
    """Clean up old data from various tables"""
    try:
        logger.info("🧹 Cleaning up old data")
        
        # Keep rolling stats for 45 days
        cleanup_date = date.today() - timedelta(days=45)
        
        # Clean rolling stats
        execute_sql(f"""
            DELETE FROM player_rolling_stats 
            WHERE as_of_date < '{cleanup_date}'
        """, database_name='postgres')
        
        # Keep game logs for 2 seasons
        execute_sql(f"""
            DELETE FROM player_game_logs 
            WHERE game_date < '{CURRENT_SEASON - 1}-01-01'
        """, database_name='postgres')
        
        logger.info("✅ Old data cleanup complete")
        return True
        
    except Exception as e:
        logger.error(f"Error cleaning old data: {e}")
        return False

def handle_season_transition():
    """Handle season transition (March each year)"""
    try:
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        # Check if we're in the transition period (March)
        if current_month == 3:
            logger.info("🔄 Season transition check")
            
            last_season = current_year - 1
            
            # Archive last season's data in postgres
            archive_sql = f"""
            INSERT INTO archived_season_stats (
                player_id, season, games_played, at_bats, runs, hits,
                doubles, triples, home_runs, rbi, stolen_bases,
                batting_avg, ops, era, whip, quality_starts,
                archived_date
            )
            SELECT 
                player_id, season, games_played, at_bats, runs, hits,
                doubles, triples, home_runs, rbi, stolen_bases,
                batting_avg, ops, era, whip, quality_starts,
                CURRENT_DATE
            FROM player_season_stats
            WHERE season = {last_season}
            ON CONFLICT (player_id, season) DO NOTHING
            """
            
            try:
                execute_sql(archive_sql, database_name='postgres')
                logger.info(f"✅ Archived {last_season} season stats")
            except Exception as e:
                logger.error(f"Error archiving season stats: {e}")
            
            # Clear old season data from leagues database
            # This needs to be done separately for leagues DB
            try:
                leagues_cleanup_sql = f"""
                DELETE FROM player_season_stats 
                WHERE season < {current_year}
                """
                execute_sql(leagues_cleanup_sql, database_name='leagues')
                logger.info(f"✅ Cleared old season data from leagues")
            except Exception as e:
                logger.error(f"Error clearing league season data: {e}")
            
            # Reset contract years for new season
            try:
                contract_update_sql = """
                UPDATE league_players 
                SET contract_years = contract_years - 1
                WHERE contract_years > 0
                """
                execute_sql(contract_update_sql, database_name='leagues')
                
                # Mark expired contracts
                expired_sql = """
                UPDATE league_players
                SET availability_status = 'free_agent',
                    team_id = NULL,
                    roster_status = NULL,
                    roster_position = NULL
                WHERE contract_years <= 0
                  AND availability_status = 'owned'
                """
                execute_sql(expired_sql, database_name='leagues')
                logger.info("✅ Updated contract years for new season")
                
            except Exception as e:
                logger.error(f"Error updating contracts: {e}")
            
            # Initialize new season stats table entries
            try:
                init_season_sql = f"""
                INSERT INTO player_season_stats (player_id, season, games_played)
                SELECT DISTINCT player_id, {current_year}, 0
                FROM mlb_players
                WHERE is_active = true
                ON CONFLICT (player_id, season) DO NOTHING
                """
                execute_sql(init_season_sql, database_name='postgres')
                logger.info(f"✅ Initialized {current_year} season stats")
                
            except Exception as e:
                logger.error(f"Error initializing new season: {e}")
            
            logger.info(f"✅ Season transition completed for {current_year}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error handling season transition: {e}")
        return False

# ============================================================================
# MAIN LAMBDA HANDLER
# ============================================================================

def lambda_handler(event, context):
    """
    Master daily updater Lambda handler
    Orchestrates all daily stat calculations and MLB data ingestion
    """
    try:
        start_time = datetime.now()
        today = date.today()
        
        logger.info(f"""
        ╔════════════════════════════════════════╗
        ║  MASTER DAILY UPDATER - {today}        ║
        ║  Season: {CURRENT_SEASON}              ║
        ╚════════════════════════════════════════╝
        """)
        
        results = {
            'date': str(today),
            'season': CURRENT_SEASON,
            'tasks': {},
            'success': True,
            'errors': []
        }
        
        # Task 1: MLB API Game Log Ingestion
        logger.info("🎮 Task 1: MLB API Game Log Ingestion...")
        try:
            ingestion_result = ingest_mlb_game_logs()
            results['tasks']['mlb_ingestion'] = {
                'success': True,
                'games': ingestion_result['games'],
                'players_updated': ingestion_result['players_updated'],
                'new_players': ingestion_result['new_players'],
                'completed_at': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"MLB ingestion failed: {e}")
            results['tasks']['mlb_ingestion'] = {'success': False, 'error': str(e)}
            results['errors'].append(f"MLB ingestion: {e}")
        
        # Task 2: Calculate Season Stats from Game Logs
        logger.info("📊 Task 2: Calculating Season Stats...")
        try:
            if calculate_season_stats():
                results['tasks']['season_stats'] = {
                    'success': True,
                    'completed_at': datetime.now().isoformat()
                }
            else:
                results['tasks']['season_stats'] = {'success': False}
        except Exception as e:
            logger.error(f"Season stats calculation failed: {e}")
            results['tasks']['season_stats'] = {'success': False, 'error': str(e)}
            results['errors'].append(f"Season stats: {e}")
        
        # Task 3: Calculate Rolling Stats
        logger.info("📈 Task 3: Calculating Rolling Stats...")
        if calculate_rolling_stats:
            try:
                rolling_result = calculate_rolling_stats(event, context)
                results['tasks']['rolling_stats'] = {
                    'success': rolling_result.get('statusCode') == 200,
                    'result': json.loads(rolling_result.get('body', '{}')),
                    'completed_at': datetime.now().isoformat()
                }
            except Exception as e:
                logger.error(f"Rolling stats calculation failed: {e}")
                results['tasks']['rolling_stats'] = {'success': False, 'error': str(e)}
                results['errors'].append(f"Rolling stats: {e}")
        else:
            results['tasks']['rolling_stats'] = {'success': False, 'error': 'Module not available'}
        
        # Task 4: Update Active Accrued Stats
        logger.info("📋 Task 4: Updating Active Accrued Stats...")
        if update_accrued_stats:
            try:
                accrued_result = update_accrued_stats(event, context)
                results['tasks']['accrued_stats'] = {
                    'success': accrued_result.get('statusCode') == 200,
                    'result': json.loads(accrued_result.get('body', '{}')),
                    'completed_at': datetime.now().isoformat()
                }
            except Exception as e:
                logger.error(f"Accrued stats update failed: {e}")
                results['tasks']['accrued_stats'] = {'success': False, 'error': str(e)}
                results['errors'].append(f"Accrued stats: {e}")
        else:
            results['tasks']['accrued_stats'] = {'success': False, 'error': 'Module not available'}
        
        # Task 5: Sync Stats to League Databases
        logger.info("🔄 Task 5: Syncing to League Databases...")
        try:
            leagues_synced = sync_stats_to_leagues()
            results['tasks']['league_sync'] = {
                'success': leagues_synced > 0,
                'leagues_synced': leagues_synced,
                'completed_at': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"League sync failed: {e}")
            results['tasks']['league_sync'] = {'success': False, 'error': str(e)}
            results['errors'].append(f"League sync: {e}")
        
        # Task 6: Sync New Players
        logger.info("👥 Task 6: Syncing New Players...")
        try:
            if sync_new_players_to_leagues():
                results['tasks']['new_player_sync'] = {
                    'success': True,
                    'completed_at': datetime.now().isoformat()
                }
            else:
                results['tasks']['new_player_sync'] = {'success': False}
        except Exception as e:
            logger.error(f"New player sync failed: {e}")
            results['tasks']['new_player_sync'] = {'success': False, 'error': str(e)}
            results['errors'].append(f"New player sync: {e}")
        
        # Task 7: Handle Season Transition (if applicable)
        if datetime.now().month == 3:
            logger.info("🔄 Task 7: Checking Season Transition...")
            try:
                if handle_season_transition():
                    results['tasks']['season_transition'] = {
                        'success': True,
                        'completed_at': datetime.now().isoformat()
                    }
            except Exception as e:
                logger.error(f"Season transition failed: {e}")
                results['tasks']['season_transition'] = {'success': False, 'error': str(e)}
        
        # Task 8: Clean Old Data
        logger.info("🧹 Task 8: Cleaning Old Data...")
        try:
            if clean_old_data():
                results['tasks']['cleanup'] = {
                    'success': True,
                    'completed_at': datetime.now().isoformat()
                }
            else:
                results['tasks']['cleanup'] = {'success': False}
        except Exception as e:
            logger.error(f"Data cleanup failed: {e}")
            results['tasks']['cleanup'] = {'success': False, 'error': str(e)}
            results['errors'].append(f"Cleanup: {e}")
        
        # Calculate execution time
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()
        results['execution_time_seconds'] = execution_time
        
        # Determine overall success
        results['success'] = len(results['errors']) == 0
        
        # Final summary
        successful_tasks = sum(1 for task in results['tasks'].values() if task.get('success'))
        total_tasks = len(results['tasks'])
        
        logger.info(f"""
        ╔════════════════════════════════════════╗
        ║  DAILY UPDATE COMPLETE                 ║
        ║  Tasks: {successful_tasks}/{total_tasks} successful           ║
        ║  Time: {execution_time:.2f} seconds              ║
        ║  Status: {'✅ SUCCESS' if results['success'] else '❌ PARTIAL FAILURE'}         ║
        ╚════════════════════════════════════════╝
        """)
        
        # Send SNS notification if there were errors
        if results['errors'] and os.environ.get('SNS_TOPIC_ARN'):
            sns = boto3.client('sns', region_name='us-east-1')
            sns.publish(
                TopicArn=os.environ['SNS_TOPIC_ARN'],
                Subject=f"Dynasty Dugout Daily Update - {'Partial Failure' if successful_tasks > 0 else 'Failed'}",
                Message=f"""
Daily update completed with errors:
- Date: {today}
- Successful tasks: {successful_tasks}/{total_tasks}
- Errors: {', '.join(results['errors'])}
- Execution time: {execution_time:.2f} seconds

Please check CloudWatch logs for details.
                """
            )
        
        return {
            'statusCode': 200 if results['success'] else 207,
            'body': json.dumps(results)
        }
        
    except Exception as e:
        logger.error(f"""
        ╔════════════════════════════════════════╗
        ║  CRITICAL FAILURE IN MASTER UPDATER    ║
        ╚════════════════════════════════════════╝
        Error: {str(e)}
        """)
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'date': str(date.today())
            })
        }

# For local testing
if __name__ == "__main__":
    # Set environment variables for local testing
    os.environ['DB_CLUSTER_ARN'] = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
    os.environ['DB_SECRET_ARN'] = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
    
    result = lambda_handler({}, {})
    print(json.dumps(result, indent=2))