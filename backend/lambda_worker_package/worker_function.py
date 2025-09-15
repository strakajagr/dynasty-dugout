"""
League Creation Worker Lambda - COMPLETE WITH STATS POPULATION
Fixes DECIMAL field extraction, removes hit_by_pitch, ensures rolling stats work
NOW SAVES: position_requirements, bench_slots, dl_slots, minor_league_slots, etc.
FIXED: Handles existing tables and missing columns properly
NEW: Adds player_name, position, mlb_team to league_players table
ADDED: Creates leagues registry entry for daily stat syncing
ADDED: Ensures mlb_team column exists in player_game_logs
RESTORED: Full stats population from postgres to leagues database
"""
import json
import logging
import boto3
import os
from uuid import uuid4
from datetime import datetime, date

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Database configuration
DB_CLUSTER_ARN = os.environ.get('DB_CLUSTER_ARN')
DB_SECRET_ARN = os.environ.get('DB_SECRET_ARN')

rds_client = boto3.client('rds-data', region_name='us-east-1')

def get_current_season():
    """Get the current MLB season year"""
    now = datetime.now()
    month = now.month
    year = now.year
    if month < 4:
        return year - 1
    return year

CURRENT_SEASON = get_current_season()
logger.info(f"🗓️ Worker initialized for {CURRENT_SEASON} season")

def execute_sql(sql, parameters=None, database_name='postgres'):
    """Execute SQL with RDS Data API"""
    try:
        params = {
            'resourceArn': DB_CLUSTER_ARN,
            'secretArn': DB_SECRET_ARN,
            'database': database_name,
            'sql': sql
        }
        
        if parameters:
            rds_params = []
            for key, value in parameters.items():
                param = {'name': key}
                if value is None:
                    param['value'] = {'isNull': True}
                elif isinstance(value, str):
                    param['value'] = {'stringValue': value}
                elif isinstance(value, bool):
                    param['value'] = {'booleanValue': value}
                elif isinstance(value, int):
                    param['value'] = {'longValue': value}
                elif isinstance(value, float):
                    param['value'] = {'doubleValue': value}
                else:
                    param['value'] = {'stringValue': str(value)}
                rds_params.append(param)
            
            if rds_params:
                params['parameters'] = rds_params
        
        response = rds_client.execute_statement(**params)
        return response
        
    except Exception as e:
        logger.error(f"Database error on '{database_name}': {str(e)}")
        logger.error(f"SQL: {sql[:200]}...")
        raise

def update_league_status(league_id, status, error_message=None):
    """Update league creation status in postgres phone book"""
    try:
        execute_sql(
            """UPDATE user_leagues 
               SET creation_status = :status, 
                   creation_error_message = :error_message,
                   status_last_updated_at = NOW()
               WHERE league_id = :league_id::uuid""",
            {
                'league_id': league_id, 
                'status': status, 
                'error_message': error_message
            },
            database_name='postgres'
        )
        logger.info(f"Updated league {league_id} status to {status}")
    except Exception as e:
        logger.error(f"Failed to update league status: {e}")

def ensure_postgres_tables_have_correct_columns():
    """Ensure postgres database tables have all required columns"""
    try:
        logger.info("🔧 Checking postgres database schema...")
        
        # Check if mlb_team column exists in player_game_logs
        column_check = execute_sql(
            """SELECT column_name FROM information_schema.columns 
               WHERE table_name = 'player_game_logs' 
               AND table_schema = 'public' 
               AND column_name = 'mlb_team'""",
            database_name='postgres'
        )
        
        if not column_check.get('records'):
            logger.info("➕ Adding mlb_team column to player_game_logs...")
            execute_sql(
                "ALTER TABLE player_game_logs ADD COLUMN mlb_team VARCHAR(3)",
                database_name='postgres'
            )
            logger.info("✅ Added mlb_team column to player_game_logs")
        else:
            logger.info("✅ mlb_team column already exists in player_game_logs")
            
    except Exception as e:
        logger.warning(f"Could not check/add postgres columns: {e}")

def ensure_shared_tables_exist():
    """Ensure all required tables exist in the shared 'leagues' database"""
    try:
        logger.info("📦 Ensuring shared tables exist in 'leagues' database...")
        
        # CRITICAL: Create the leagues registry table first
        execute_sql("""
            CREATE TABLE IF NOT EXISTS leagues (
                league_id UUID PRIMARY KEY,
                league_name VARCHAR(255) NOT NULL,
                league_status VARCHAR(50) DEFAULT 'setup',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """, database_name='leagues')
        logger.info("✅ Leagues registry table ensured")
        
        # Create all other tables
        tables = [
            """CREATE TABLE IF NOT EXISTS league_settings (
                setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                setting_name VARCHAR(100) NOT NULL,
                setting_value TEXT,
                setting_type VARCHAR(50) DEFAULT 'string',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_league_setting UNIQUE(league_id, setting_name)
            )""",
            
            """CREATE TABLE IF NOT EXISTS league_teams (
                team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                team_name VARCHAR(255),
                manager_name VARCHAR(255),
                manager_email VARCHAR(255),
                team_logo_url TEXT,
                team_colors JSONB,
                team_motto TEXT,
                is_commissioner BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                slot_number INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_league_user UNIQUE(league_id, user_id),
                CONSTRAINT unique_league_slot UNIQUE(league_id, slot_number)
            )""",
            
            """CREATE TABLE IF NOT EXISTS league_players (
                league_player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                mlb_player_id INTEGER NOT NULL,
                player_name VARCHAR(255),
                position VARCHAR(50),
                mlb_team VARCHAR(50),
                team_id UUID,
                salary DECIMAL(8,2) DEFAULT 1.0,
                generated_price DECIMAL(8,2) DEFAULT 0,
                manual_price_override DECIMAL(8,2) DEFAULT 0,
                contract_years INTEGER DEFAULT 1,
                availability_status VARCHAR(20) DEFAULT 'free_agent',
                roster_status VARCHAR(20) DEFAULT 'active',
                roster_position VARCHAR(10),
                acquisition_date TIMESTAMP,
                acquisition_method VARCHAR(20),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_league_mlb_player UNIQUE(league_id, mlb_player_id)
            )""",
            
            """CREATE TABLE IF NOT EXISTS league_transactions (
                transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                league_player_id UUID NOT NULL,
                from_team_id UUID,
                to_team_id UUID,
                transaction_type VARCHAR(50) NOT NULL,
                transaction_date TIMESTAMP DEFAULT NOW(),
                salary DECIMAL(8,2),
                contract_years INTEGER,
                notes TEXT
            )""",
            
            """CREATE TABLE IF NOT EXISTS player_season_stats (
                season_stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                player_id INTEGER NOT NULL,
                season INTEGER NOT NULL,
                games_played INTEGER DEFAULT 0,
                at_bats INTEGER DEFAULT 0,
                hits INTEGER DEFAULT 0,
                runs INTEGER DEFAULT 0,
                rbi INTEGER DEFAULT 0,
                home_runs INTEGER DEFAULT 0,
                doubles INTEGER DEFAULT 0,
                triples INTEGER DEFAULT 0,
                stolen_bases INTEGER DEFAULT 0,
                caught_stealing INTEGER DEFAULT 0,
                walks INTEGER DEFAULT 0,
                strikeouts INTEGER DEFAULT 0,
                batting_avg DECIMAL(5,3) DEFAULT 0.000,
                obp DECIMAL(5,3) DEFAULT 0.000,
                slg DECIMAL(5,3) DEFAULT 0.000,
                ops DECIMAL(5,3) DEFAULT 0.000,
                games_started INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                saves INTEGER DEFAULT 0,
                blown_saves INTEGER DEFAULT 0,
                holds INTEGER DEFAULT 0,
                quality_starts INTEGER DEFAULT 0,
                innings_pitched DECIMAL(6,1) DEFAULT 0.0,
                earned_runs INTEGER DEFAULT 0,
                hits_allowed INTEGER DEFAULT 0,
                walks_allowed INTEGER DEFAULT 0,
                strikeouts_pitched INTEGER DEFAULT 0,
                home_runs_allowed INTEGER DEFAULT 0,
                era DECIMAL(5,2) DEFAULT 0.00,
                whip DECIMAL(5,3) DEFAULT 0.000,
                last_updated TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_league_player_season UNIQUE(league_id, player_id, season)
            )""",
            
            """CREATE TABLE IF NOT EXISTS player_rolling_stats (
                rolling_stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                player_id INTEGER NOT NULL,
                period VARCHAR(20) NOT NULL,
                as_of_date DATE NOT NULL,
                games_played INTEGER DEFAULT 0,
                at_bats INTEGER DEFAULT 0,
                hits INTEGER DEFAULT 0,
                home_runs INTEGER DEFAULT 0,
                rbi INTEGER DEFAULT 0,
                runs INTEGER DEFAULT 0,
                stolen_bases INTEGER DEFAULT 0,
                caught_stealing INTEGER DEFAULT 0,
                walks INTEGER DEFAULT 0,
                strikeouts INTEGER DEFAULT 0,
                batting_avg DECIMAL(5,3) DEFAULT 0.000,
                obp DECIMAL(5,3) DEFAULT 0.000,
                slg DECIMAL(5,3) DEFAULT 0.000,
                ops DECIMAL(5,3) DEFAULT 0.000,
                games_started INTEGER DEFAULT 0,
                innings_pitched DECIMAL(6,1) DEFAULT 0.0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                saves INTEGER DEFAULT 0,
                blown_saves INTEGER DEFAULT 0,
                earned_runs INTEGER DEFAULT 0,
                era DECIMAL(5,2) DEFAULT 0.00,
                whip DECIMAL(5,3) DEFAULT 0.000,
                quality_starts INTEGER DEFAULT 0,
                strikeouts_pitched INTEGER DEFAULT 0,
                hits_allowed INTEGER DEFAULT 0,
                walks_allowed INTEGER DEFAULT 0,
                last_calculated TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_league_rolling UNIQUE(league_id, player_id, period, as_of_date)
            )""",
            
            """CREATE TABLE IF NOT EXISTS league_invitations (
                invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                email VARCHAR(255) NOT NULL,
                owner_name VARCHAR(255) NOT NULL,
                personal_message TEXT,
                target_slot INTEGER,
                invitation_token TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                invited_by VARCHAR(255) NOT NULL,
                invited_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP
            )""",
            
            """CREATE TABLE IF NOT EXISTS player_prices (
                price_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                player_id INTEGER NOT NULL,
                price DECIMAL(8,2),
                tier VARCHAR(20),
                manual_override BOOLEAN DEFAULT FALSE,
                pricing_method VARCHAR(50),
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_league_player_price UNIQUE(league_id, player_id)
            )""",
            
            """CREATE TABLE IF NOT EXISTS roster_status_history (
                history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                league_player_id UUID NOT NULL,
                team_id UUID,
                roster_status VARCHAR(20),
                effective_date DATE,
                end_date DATE,
                changed_by VARCHAR(255),
                change_reason TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )""",
            
            """CREATE TABLE IF NOT EXISTS player_active_accrued_stats (
                accrued_stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                mlb_player_id INTEGER NOT NULL,
                team_id UUID NOT NULL,
                first_active_date DATE,
                last_active_date DATE,
                total_active_days INTEGER DEFAULT 0,
                active_games_played INTEGER DEFAULT 0,
                active_at_bats INTEGER DEFAULT 0,
                active_hits INTEGER DEFAULT 0,
                active_home_runs INTEGER DEFAULT 0,
                active_rbi INTEGER DEFAULT 0,
                active_runs INTEGER DEFAULT 0,
                active_stolen_bases INTEGER DEFAULT 0,
                active_walks INTEGER DEFAULT 0,
                active_strikeouts INTEGER DEFAULT 0,
                active_batting_avg DECIMAL(5,3) DEFAULT 0.000,
                active_innings_pitched DECIMAL(6,1) DEFAULT 0.0,
                active_wins INTEGER DEFAULT 0,
                active_losses INTEGER DEFAULT 0,
                active_saves INTEGER DEFAULT 0,
                active_earned_runs INTEGER DEFAULT 0,
                active_quality_starts INTEGER DEFAULT 0,
                active_era DECIMAL(5,2) DEFAULT 0.00,
                active_whip DECIMAL(5,3) DEFAULT 0.000,
                last_updated TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_league_player_team_accrued UNIQUE(league_id, mlb_player_id, team_id)
            )"""
        ]
        
        # Create all tables
        for table_sql in tables:
            execute_sql(table_sql, database_name='leagues')
        
        # CRITICAL FIX: Handle existing league_players table missing new columns
        logger.info("🔧 Checking for missing columns in existing tables...")
        
        try:
            # Check if player_name, position, mlb_team columns exist in league_players
            columns_to_check = ['player_name', 'position', 'mlb_team', 'roster_position']
            
            for column_name in columns_to_check:
                column_check = execute_sql(
                    """SELECT column_name FROM information_schema.columns 
                       WHERE table_name = 'league_players' 
                       AND table_schema = 'public' 
                       AND column_name = :column_name""",
                    {'column_name': column_name},
                    database_name='leagues'
                )
                
                if not column_check.get('records'):
                    logger.info(f"➕ Adding missing {column_name} column to league_players...")
                    
                    if column_name == 'player_name':
                        execute_sql(
                            "ALTER TABLE league_players ADD COLUMN player_name VARCHAR(255)",
                            database_name='leagues'
                        )
                    elif column_name == 'position':
                        execute_sql(
                            "ALTER TABLE league_players ADD COLUMN position VARCHAR(50)",
                            database_name='leagues'
                        )
                    elif column_name == 'mlb_team':
                        execute_sql(
                            "ALTER TABLE league_players ADD COLUMN mlb_team VARCHAR(50)",
                            database_name='leagues'
                        )
                    elif column_name == 'roster_position':
                        execute_sql(
                            "ALTER TABLE league_players ADD COLUMN roster_position VARCHAR(10)",
                            database_name='leagues'
                        )
                    
                    logger.info(f"✅ Added {column_name} column successfully")
                else:
                    logger.info(f"✅ {column_name} column already exists")
                
        except Exception as col_error:
            logger.warning(f"Could not add columns: {col_error}")
        
        logger.info("✅ All shared tables ensured with correct schema")
        return True
        
    except Exception as e:
        logger.error(f"Failed to ensure shared tables exist: {e}")
        return False

def register_league_in_registry(league_id, league_name):
    """Register the league in the leagues table for daily stat syncing"""
    try:
        logger.info(f"[{league_id[:8]}] 📝 Registering league in leagues registry...")
        
        execute_sql(
            """INSERT INTO leagues (league_id, league_name, is_active, league_status) 
               VALUES (:league_id::uuid, :league_name, true, 'setup')
               ON CONFLICT (league_id) DO UPDATE SET
                   league_name = EXCLUDED.league_name,
                   updated_at = NOW()""",
            {'league_id': league_id, 'league_name': league_name},
            database_name='leagues'
        )
        
        logger.info(f"[{league_id[:8]}] ✅ League registered for stat syncing")
        return True
        
    except Exception as e:
        logger.error(f"[{league_id[:8]}] Failed to register league: {e}")
        return False

def get_value_safe(record, index, value_type='long'):
    """Safely extract value from RDS Data API record"""
    if index >= len(record):
        return 0 if value_type == 'long' else 0.0 if value_type == 'decimal' else ''
    
    field = record[index]
    if not field:
        return 0 if value_type == 'long' else 0.0 if value_type == 'decimal' else ''
    
    if value_type == 'long':
        return field.get('longValue', 0)
    elif value_type == 'decimal':
        # CRITICAL: DECIMAL types come as stringValue, not doubleValue!
        if 'stringValue' in field:
            try:
                return float(field['stringValue'])
            except:
                return 0.0
        return field.get('doubleValue', 0.0)
    elif value_type == 'string':
        return field.get('stringValue', '')
    else:
        return 0

def populate_league_players(league_id):
    """Populate league_players with full player info from postgres.mlb_players"""
    try:
        logger.info(f"[{league_id[:8]}] Loading MLB players with full info...")
        
        # Get all active players with their info from postgres
        all_players = execute_sql(
            """SELECT player_id, first_name || ' ' || last_name as player_name, 
                      position, mlb_team 
               FROM mlb_players 
               WHERE is_active = true""",
            database_name='postgres'
        )
        
        if all_players.get('records'):
            logger.info(f"[{league_id[:8]}] Inserting {len(all_players['records'])} players...")
            
            # Insert in batches with full player info
            for i in range(0, len(all_players['records']), 100):
                batch = all_players['records'][i:i+100]
                values_list = []
                
                for rec in batch:
                    player_id = get_value_safe(rec, 0, 'long')
                    player_name = get_value_safe(rec, 1, 'string')
                    position = get_value_safe(rec, 2, 'string')
                    mlb_team = get_value_safe(rec, 3, 'string')
                    
                    # Escape single quotes in names
                    player_name = player_name.replace("'", "''") if player_name else 'Unknown'
                    position = position if position else 'UTIL'
                    mlb_team = mlb_team if mlb_team else 'FA'
                    
                    values_list.append(
                        f"('{league_id}'::uuid, {player_id}, '{player_name}', '{position}', '{mlb_team}')"
                    )
                
                if values_list:
                    insert_sql = f"""
                        INSERT INTO league_players (league_id, mlb_player_id, player_name, position, mlb_team) 
                        VALUES {', '.join(values_list)}
                        ON CONFLICT (league_id, mlb_player_id) 
                        DO UPDATE SET 
                            player_name = EXCLUDED.player_name,
                            position = EXCLUDED.position,
                            mlb_team = EXCLUDED.mlb_team
                    """
                    execute_sql(insert_sql, database_name='leagues')
            
            logger.info(f"[{league_id[:8]}] ✅ Players loaded with full info")
            return True
        
    except Exception as e:
        logger.error(f"[{league_id[:8]}] Failed to populate players: {e}")
        return False

def populate_league_stats(league_id, current_season):
    """Populate CURRENT season stats - ENSURE ROLLING STATS EXIST FIRST"""
    try:
        logger.info(f"[{league_id[:8]}] 📊 Ensuring rolling stats are calculated...")
        
        # FORCE CALCULATE ROLLING STATS FIRST
        lambda_client = boto3.client('lambda', region_name='us-east-1')
        try:
            response = lambda_client.invoke(
                FunctionName='calculate-rolling-stats',
                InvocationType='RequestResponse',
                Payload=json.dumps({'date': str(date.today())})
            )
            result = json.loads(response['Payload'].read())
            logger.info(f"[{league_id[:8]}] ✅ Rolling stats calculated: {result}")
        except Exception as e:
            logger.error(f"[{league_id[:8]}] Failed to calculate rolling stats: {e}")
            # Continue anyway - season stats will still work
        
        logger.info(f"[{league_id[:8]}] 📊 Populating stats for league from {current_season} season...")
        
        # STEP 1: SELECT season stats from postgres
        logger.info(f"[{league_id[:8]}] Fetching season stats from postgres...")
        
        select_sql = f"""
            SELECT player_id, season, games_played, at_bats, hits, runs, home_runs, rbi, 
                   doubles, triples, stolen_bases, caught_stealing, walks, strikeouts,
                   batting_avg, obp, slg, ops, games_started, wins, losses, saves, blown_saves, holds,
                   quality_starts, innings_pitched, earned_runs, hits_allowed, walks_allowed, 
                   strikeouts_pitched, home_runs_allowed, era, whip
            FROM player_season_stats
            WHERE season = {current_season}
        """
        
        result = execute_sql(select_sql, database_name='postgres')
        
        if not result or not result.get('records'):
            logger.error(f"[{league_id[:8]}] No season stats found in postgres for {current_season}")
            return False
        
        # STEP 2: INSERT into leagues database in batches
        logger.info(f"[{league_id[:8]}] Inserting {len(result['records'])} player stats into league...")
        
        batch_size = 100
        total_inserted = 0
        
        for i in range(0, len(result['records']), batch_size):
            batch = result['records'][i:i+batch_size]
            values_list = []
            
            for record in batch:
                # Extract values with proper type handling
                player_id = get_value_safe(record, 0, 'long')
                season = get_value_safe(record, 1, 'long')
                games_played = get_value_safe(record, 2, 'long')
                at_bats = get_value_safe(record, 3, 'long')
                hits = get_value_safe(record, 4, 'long')
                runs = get_value_safe(record, 5, 'long')
                home_runs = get_value_safe(record, 6, 'long')
                rbi = get_value_safe(record, 7, 'long')
                doubles = get_value_safe(record, 8, 'long')
                triples = get_value_safe(record, 9, 'long')
                stolen_bases = get_value_safe(record, 10, 'long')
                caught_stealing = get_value_safe(record, 11, 'long')
                walks = get_value_safe(record, 12, 'long')
                strikeouts = get_value_safe(record, 13, 'long')
                # CRITICAL FIX: DECIMAL fields use stringValue
                batting_avg = get_value_safe(record, 14, 'decimal')
                obp = get_value_safe(record, 15, 'decimal')
                slg = get_value_safe(record, 16, 'decimal')
                ops = get_value_safe(record, 17, 'decimal')
                games_started = get_value_safe(record, 18, 'long')
                wins = get_value_safe(record, 19, 'long')
                losses = get_value_safe(record, 20, 'long')
                saves = get_value_safe(record, 21, 'long')
                blown_saves = get_value_safe(record, 22, 'long')
                holds = get_value_safe(record, 23, 'long')
                quality_starts = get_value_safe(record, 24, 'long')
                innings_pitched = get_value_safe(record, 25, 'decimal')
                earned_runs = get_value_safe(record, 26, 'long')
                hits_allowed = get_value_safe(record, 27, 'long')
                walks_allowed = get_value_safe(record, 28, 'long')
                strikeouts_pitched = get_value_safe(record, 29, 'long')
                home_runs_allowed = get_value_safe(record, 30, 'long')
                era = get_value_safe(record, 31, 'decimal')
                whip = get_value_safe(record, 32, 'decimal')
                
                if player_id > 0:  # Only add valid player records
                    values_list.append(f"""(
                        '{league_id}'::uuid, {player_id}, {season}, {games_played}, {at_bats}, {hits}, {runs},
                        {home_runs}, {rbi}, {doubles}, {triples}, {stolen_bases}, {caught_stealing},
                        {walks}, {strikeouts}, {batting_avg}, {obp}, {slg}, {ops},
                        {games_started}, {wins}, {losses}, {saves}, {blown_saves}, {holds},
                        {quality_starts}, {innings_pitched}, {earned_runs}, {hits_allowed},
                        {walks_allowed}, {strikeouts_pitched}, {home_runs_allowed}, {era}, {whip}
                    )""")
            
            if values_list:
                insert_sql = f"""
                    INSERT INTO player_season_stats (
                        league_id, player_id, season, games_played, at_bats, hits, runs,
                        home_runs, rbi, doubles, triples, stolen_bases, caught_stealing,
                        walks, strikeouts, batting_avg, obp, slg, ops,
                        games_started, wins, losses, saves, blown_saves, holds,
                        quality_starts, innings_pitched, earned_runs, hits_allowed,
                        walks_allowed, strikeouts_pitched, home_runs_allowed, era, whip
                    ) VALUES {','.join(values_list)}
                    ON CONFLICT (league_id, player_id, season) DO NOTHING
                """
                
                execute_sql(insert_sql, database_name='leagues')
                total_inserted += len(values_list)
        
        logger.info(f"[{league_id[:8]}] ✅ Inserted {total_inserted} player season stats")
        
        # STEP 3: Fetch and insert rolling stats
        logger.info(f"[{league_id[:8]}] Fetching rolling stats from postgres...")
        
        rolling_select_sql = """
            SELECT player_id, period, as_of_date, games_played, at_bats, hits, home_runs,
                   rbi, runs, stolen_bases, caught_stealing, walks, strikeouts,
                   batting_avg, obp, slg, ops, games_started, innings_pitched,
                   wins, losses, saves, blown_saves, earned_runs, era, whip,
                   quality_starts, strikeouts_pitched, hits_allowed, walks_allowed
            FROM player_rolling_stats
            WHERE as_of_date = CURRENT_DATE
              AND period = 'last_14_days'
        """
        
        rolling_result = execute_sql(rolling_select_sql, database_name='postgres')
        
        if rolling_result and rolling_result.get('records'):
            logger.info(f"[{league_id[:8]}] Found {len(rolling_result['records'])} rolling stats records")
            
            rolling_inserted = 0
            for i in range(0, len(rolling_result['records']), batch_size):
                batch = rolling_result['records'][i:i+batch_size]
                values_list = []
                
                for record in batch:
                    player_id = get_value_safe(record, 0, 'long')
                    period = get_value_safe(record, 1, 'string')
                    as_of_date = get_value_safe(record, 2, 'string')
                    games_played = get_value_safe(record, 3, 'long')
                    at_bats = get_value_safe(record, 4, 'long')
                    hits = get_value_safe(record, 5, 'long')
                    home_runs = get_value_safe(record, 6, 'long')
                    rbi = get_value_safe(record, 7, 'long')
                    runs = get_value_safe(record, 8, 'long')
                    stolen_bases = get_value_safe(record, 9, 'long')
                    caught_stealing = get_value_safe(record, 10, 'long')
                    walks = get_value_safe(record, 11, 'long')
                    strikeouts = get_value_safe(record, 12, 'long')
                    # CRITICAL FIX: DECIMAL fields use stringValue
                    batting_avg = get_value_safe(record, 13, 'decimal')
                    obp = get_value_safe(record, 14, 'decimal')
                    slg = get_value_safe(record, 15, 'decimal')
                    ops = get_value_safe(record, 16, 'decimal')
                    games_started = get_value_safe(record, 17, 'long')
                    innings_pitched = get_value_safe(record, 18, 'decimal')
                    wins = get_value_safe(record, 19, 'long')
                    losses = get_value_safe(record, 20, 'long')
                    saves = get_value_safe(record, 21, 'long')
                    blown_saves = get_value_safe(record, 22, 'long')
                    earned_runs = get_value_safe(record, 23, 'long')
                    era = get_value_safe(record, 24, 'decimal')
                    whip = get_value_safe(record, 25, 'decimal')
                    quality_starts = get_value_safe(record, 26, 'long')
                    strikeouts_pitched = get_value_safe(record, 27, 'long')
                    hits_allowed = get_value_safe(record, 28, 'long')
                    walks_allowed = get_value_safe(record, 29, 'long')
                    
                    if player_id > 0 and period and as_of_date:  # Valid record check
                        values_list.append(f"""(
                            '{league_id}'::uuid, {player_id}, '{period}', '{as_of_date}'::date,
                            {games_played}, {at_bats}, {hits}, {home_runs}, {rbi}, {runs},
                            {stolen_bases}, {caught_stealing}, {walks}, {strikeouts},
                            {batting_avg}, {obp}, {slg}, {ops}, {games_started},
                            {innings_pitched}, {wins}, {losses}, {saves}, {blown_saves},
                            {earned_runs}, {era}, {whip}, {quality_starts},
                            {strikeouts_pitched}, {hits_allowed}, {walks_allowed}
                        )""")
                
                if values_list:
                    insert_sql = f"""
                        INSERT INTO player_rolling_stats (
                            league_id, player_id, period, as_of_date,
                            games_played, at_bats, hits, home_runs, rbi, runs,
                            stolen_bases, caught_stealing, walks, strikeouts,
                            batting_avg, obp, slg, ops, games_started,
                            innings_pitched, wins, losses, saves, blown_saves,
                            earned_runs, era, whip, quality_starts,
                            strikeouts_pitched, hits_allowed, walks_allowed
                        ) VALUES {','.join(values_list)}
                        ON CONFLICT (league_id, player_id, period, as_of_date) DO NOTHING
                    """
                    
                    execute_sql(insert_sql, database_name='leagues')
                    rolling_inserted += len(values_list)
            
            logger.info(f"[{league_id[:8]}] ✅ Inserted {rolling_inserted} rolling stat records")
        else:
            logger.warning(f"[{league_id[:8]}] No rolling stats found in postgres - may need to run calculate_rolling_stats")
        
        return True
        
    except Exception as e:
        logger.error(f"[{league_id[:8]}] ❌ Failed to populate stats: {e}", exc_info=True)
        return False

def lambda_handler(event, context):
    """Main worker function with STATS POPULATION AND FULL ROSTER CONFIGURATION"""
    league_id = event.get('league_id')
    user_id = event.get('user_id')
    league_data = event.get('league_data', {})
    current_season = event.get('current_season', CURRENT_SEASON)
    
    logger.info(f"[{league_id[:8]}] WORKER: Starting league creation for '{league_data.get('league_name')}'")
    logger.info(f"[{league_id[:8]}] ROSTER CONFIG: {league_data.get('position_requirements', 'NOT PROVIDED')}")
    
    try:
        # Step 0: Ensure postgres tables have correct columns
        ensure_postgres_tables_have_correct_columns()
        
        # Step 1: Check if 'leagues' database exists
        logger.info("Checking if 'leagues' database exists...")
        try:
            db_check = execute_sql(
                "SELECT datname FROM pg_database WHERE datname = 'leagues'",
                database_name='postgres'
            )
            
            if not db_check.get('records'):
                logger.info("Creating 'leagues' database...")
                execute_sql('CREATE DATABASE leagues', database_name='postgres')
                logger.info("✅ Created 'leagues' database")
            else:
                logger.info("✅ 'leagues' database already exists")
        except Exception as e:
            logger.error(f"Error checking/creating leagues database: {e}")
        
        # Step 2: Ensure shared tables exist WITH PROPER COLUMN HANDLING
        if not ensure_shared_tables_exist():
            raise Exception("Failed to ensure shared tables exist")
        
        # Step 3: CRITICAL - Register league in leagues table for stat syncing
        if not register_league_in_registry(league_id, league_data.get('league_name', 'Unnamed League')):
            logger.warning(f"[{league_id[:8]}] Failed to register league but continuing...")
        
        # Step 4: Load MLB players WITH FULL INFO for this league
        if not populate_league_players(league_id):
            logger.error(f"[{league_id[:8]}] Failed to populate players, continuing anyway...")
        
        # Step 5: Insert ALL league settings including ROSTER CONFIGURATION
        logger.info(f"[{league_id[:8]}] Saving complete league settings including roster config...")
        
        # CRITICAL: Now includes ALL roster configuration settings
        settings_to_insert = [
            # Basic league settings
            ('league_name', league_data.get('league_name', 'Unnamed League'), 'string'),
            ('max_teams', str(league_data.get('max_teams', 12)), 'integer'),
            ('player_pool', league_data.get('player_pool', 'american_national'), 'string'),
            ('include_minor_leagues', str(league_data.get('include_minor_leagues', False)), 'boolean'),
            
            # Scoring settings
            ('scoring_system', league_data.get('scoring_system', 'rotisserie_ytd'), 'string'),
            ('scoring_categories', json.dumps(league_data.get('scoring_categories', {
                'hitters': ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
                'pitchers': ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
            })), 'json'),
            
            # ROSTER CONFIGURATION - CRITICAL FOR MYROSTER
            ('position_requirements', json.dumps(league_data.get('position_requirements', {
                'C': {'slots': 2},
                '1B': {'slots': 1},
                '2B': {'slots': 1}, 
                '3B': {'slots': 1},
                'SS': {'slots': 1},
                'OF': {'slots': 4},
                'MI': {'slots': 1},
                'CI': {'slots': 1},
                'UTIL': {'slots': 1},
                'P': {'slots': 10}
            })), 'json'),
            ('max_players_total', str(league_data.get('max_players_total', 23)), 'integer'),
            ('min_hitters', str(league_data.get('min_hitters', 13)), 'integer'),
            ('max_pitchers', str(league_data.get('max_pitchers', 10)), 'integer'),
            ('min_pitchers', str(league_data.get('min_pitchers', 10)), 'integer'),
            ('bench_slots', str(league_data.get('bench_slots', 5)), 'integer'),
            ('dl_slots', str(league_data.get('dl_slots', 0)), 'integer'),
            ('minor_league_slots', str(league_data.get('minor_league_slots', 0)), 'integer'),
            
            # Financial settings
            ('use_salaries', str(league_data.get('use_salaries', True)), 'boolean'),
            ('use_contracts', str(league_data.get('use_contracts', True)), 'boolean'),
            ('use_dual_cap', str(league_data.get('use_dual_cap', True)), 'boolean'),
            ('draft_cap', str(league_data.get('draft_cap', 600)), 'float'),
            ('season_cap', str(league_data.get('season_cap', 200)), 'float'),
            ('salary_cap', str(league_data.get('salary_cap', 800)), 'float'),
            ('min_salary', str(league_data.get('min_salary', 2)), 'float'),
            ('salary_increment', str(league_data.get('salary_increment', 2)), 'float'),
            ('rookie_price', str(league_data.get('rookie_price', 20)), 'float'),
            ('standard_contract_length', str(league_data.get('standard_contract_length', 2)), 'integer'),
            ('draft_cap_usage', str(league_data.get('draft_cap_usage', 0.75)), 'float'),
            
            # Advanced settings
            ('transaction_deadline', league_data.get('transaction_deadline', 'monday'), 'string'),
            ('use_waivers', str(league_data.get('use_waivers', False)), 'boolean'),
            ('season_start_date', league_data.get('season_start_date', '2025-03-28'), 'string'),
            ('season_end_date', league_data.get('season_end_date', '2025-09-28'), 'string'),
            
            # System settings
            ('current_season', str(current_season), 'integer'),
            ('league_status', 'setup', 'string'),
            ('creation_date', datetime.now().isoformat(), 'string')
        ]
        
        # Insert all settings with better error handling
        settings_inserted = 0
        settings_failed = 0
        for setting_name, setting_value, setting_type in settings_to_insert:
            try:
                execute_sql(
                    """INSERT INTO league_settings (league_id, setting_name, setting_value, setting_type)
                       VALUES (:league_id::uuid, :name, :value, :type)
                       ON CONFLICT (league_id, setting_name) DO UPDATE 
                       SET setting_value = EXCLUDED.setting_value, 
                           setting_type = EXCLUDED.setting_type,
                           updated_at = NOW()""",
                    {
                        'league_id': league_id,
                        'name': setting_name,
                        'value': setting_value,
                        'type': setting_type
                    },
                    database_name='leagues'
                )
                settings_inserted += 1
            except Exception as setting_error:
                logger.error(f"Failed to save setting {setting_name}: {setting_error}")
                settings_failed += 1
        
        logger.info(f"[{league_id[:8]}] ✅ Inserted {settings_inserted} league settings ({settings_failed} failed)")
        
        # Step 6: Create commissioner's team
        execute_sql(
            """INSERT INTO league_teams (league_id, user_id, team_name, is_commissioner, slot_number)
               VALUES (:league_id::uuid, :user_id, 'Team 1', true, 1)
               ON CONFLICT (league_id, user_id) DO NOTHING""",
            {'league_id': league_id, 'user_id': user_id},
            database_name='leagues'
        )
        
        # Step 7: CRITICAL - POPULATE STATS (RESTORED FROM OLD FILE)
        if not populate_league_stats(league_id, current_season):
            logger.error(f"[{league_id[:8]}] Failed to populate stats but continuing...")
        
        # Step 8: Mark as completed
        update_league_status(league_id, 'completed')
        logger.info(f"[{league_id[:8]}] ✅ League creation successful with full roster config and stats!")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True, 
                'league_id': league_id,
                'season': current_season,
                'roster_positions_saved': len(league_data.get('position_requirements', {})),
                'settings_saved': settings_inserted,
                'settings_failed': settings_failed,
                'message': 'League created successfully with complete roster configuration and stats'
            })
        }
        
    except Exception as e:
        logger.error(f"[{league_id[:8]}] ❌ Error creating league: {str(e)}")
        update_league_status(league_id, 'failed', str(e))
        return {
            'statusCode': 500,
            'body': json.dumps({'success': False, 'error': str(e)})
        }