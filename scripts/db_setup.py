#!/usr/bin/env python3
"""
Fantasy Baseball Database Setup Script
Creates all tables and initial schema for the fantasy baseball application.
"""

import psycopg2
from psycopg2 import sql
import sys

# Database connection parameters
DB_CONFIG = {
    'host': '54.157.83.234',
    'port': 5432,
    'database': 'postgres',
    'user': 'fantasy_admin',
    'password': ':Us2aCo[f2O!fq0pgU(0Hv~pgr7j'
}

def test_connection():
    """Test database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ Connected to PostgreSQL: {version[0]}")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def create_tables():
    """Create all fantasy baseball tables"""
    
    # SQL statements for creating tables
    create_table_sql = [
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            phone VARCHAR(20),
            timezone VARCHAR(50) DEFAULT 'America/New_York',
            notification_preferences JSONB DEFAULT '{"email": true, "sms": false}',
            profile_image_url TEXT,
            bio TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            custom_fields JSONB DEFAULT '{}'
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS leagues (
            league_id SERIAL PRIMARY KEY,
            league_name VARCHAR(100) NOT NULL,
            commissioner_id INTEGER REFERENCES users(user_id),
            max_teams INTEGER DEFAULT 12,
            league_format VARCHAR(20) DEFAULT 'rotisserie',
            scoring_categories JSONB DEFAULT '{"hitting": ["R", "RBI", "HR", "SB", "AVG", "OPS"], "pitching": ["W", "K", "SV", "QS", "ERA", "WHIP"]}',
            scoring_system JSONB,
            draft_date TIMESTAMP,
            season_year INTEGER,
            trade_deadline DATE,
            waiver_order_type VARCHAR(20) DEFAULT 'rolling',
            league_logo_url TEXT,
            description TEXT,
            is_public BOOLEAN DEFAULT FALSE,
            password_protected BOOLEAN DEFAULT FALSE,
            league_password_hash VARCHAR(255),
            roster_size INTEGER DEFAULT 25,
            starting_lineup_size INTEGER DEFAULT 10,
            bench_size INTEGER DEFAULT 15,
            il_spots INTEGER DEFAULT 2,
            trade_review_period_hours INTEGER DEFAULT 48,
            waiver_period_hours INTEGER DEFAULT 48,
            acquisition_budget DECIMAL(10,2) DEFAULT 100.00,
            salary_cap DECIMAL(12,2) DEFAULT 260.00,
            keepers_allowed INTEGER DEFAULT 0,
            keeper_deadline DATE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            custom_fields JSONB DEFAULT '{}'
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS teams (
            team_id SERIAL PRIMARY KEY,
            league_id INTEGER REFERENCES leagues(league_id),
            owner_id INTEGER REFERENCES users(user_id),
            team_name VARCHAR(100) NOT NULL,
            team_logo_url TEXT,
            team_motto VARCHAR(200),
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            points_for DECIMAL(10,2) DEFAULT 0,
            points_against DECIMAL(10,2) DEFAULT 0,
            waiver_priority INTEGER,
            acquisition_budget DECIMAL(10,2) DEFAULT 100.00,
            trades_made INTEGER DEFAULT 0,
            waiver_claims_made INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            custom_fields JSONB DEFAULT '{}',
            UNIQUE(league_id, owner_id)
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS mlb_players (
            player_id SERIAL PRIMARY KEY,
            mlb_id VARCHAR(20) UNIQUE,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            position VARCHAR(10),
            mlb_team VARCHAR(10),
            jersey_number INTEGER,
            birthdate DATE,
            height_inches INTEGER,
            weight_pounds INTEGER,
            bats VARCHAR(1),
            throws VARCHAR(1),
            mlb_debut_date DATE,
            headshot_url TEXT,
            salary INTEGER,
            contract_years INTEGER,
            is_active BOOLEAN DEFAULT TRUE,
            injury_status VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            custom_fields JSONB DEFAULT '{}'
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS fantasy_rosters (
            roster_id SERIAL PRIMARY KEY,
            team_id INTEGER REFERENCES teams(team_id),
            player_id INTEGER REFERENCES mlb_players(player_id),
            acquired_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            roster_position VARCHAR(20),
            contract_type VARCHAR(20),
            contract_length INTEGER DEFAULT 1,
            contract_salary DECIMAL(8,2),
            is_keeper BOOLEAN DEFAULT FALSE,
            keeper_round INTEGER,
            is_active BOOLEAN DEFAULT TRUE,
            released_date TIMESTAMP,
            UNIQUE(team_id, player_id, is_active)
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS player_stats (
            stat_id SERIAL PRIMARY KEY,
            player_id INTEGER REFERENCES mlb_players(player_id),
            week_number INTEGER,
            season_year INTEGER,
            games_played INTEGER DEFAULT 0,
            
            -- Hitting Stats
            at_bats INTEGER DEFAULT 0,
            hits INTEGER DEFAULT 0,
            runs INTEGER DEFAULT 0,
            rbis INTEGER DEFAULT 0,
            home_runs INTEGER DEFAULT 0,
            doubles INTEGER DEFAULT 0,
            triples INTEGER DEFAULT 0,
            stolen_bases INTEGER DEFAULT 0,
            walks INTEGER DEFAULT 0,
            strikeouts INTEGER DEFAULT 0,
            hit_by_pitch INTEGER DEFAULT 0,
            sacrifice_flies INTEGER DEFAULT 0,
            
            -- Pitching Stats
            innings_pitched DECIMAL(4,1) DEFAULT 0,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            saves INTEGER DEFAULT 0,
            holds INTEGER DEFAULT 0,
            blown_saves INTEGER DEFAULT 0,
            quality_starts INTEGER DEFAULT 0,
            complete_games INTEGER DEFAULT 0,
            shutouts INTEGER DEFAULT 0,
            earned_runs INTEGER DEFAULT 0,
            hits_allowed INTEGER DEFAULT 0,
            walks_allowed INTEGER DEFAULT 0,
            strikeouts_pitched INTEGER DEFAULT 0,
            
            -- Advanced metrics
            woba DECIMAL(5,3),
            era DECIMAL(5,2),
            whip DECIMAL(5,3),
            babip DECIMAL(5,3),
            
            -- Fantasy Points
            fantasy_points DECIMAL(10,2) DEFAULT 0,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, week_number, season_year)
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS rotisserie_standings (
            standing_id SERIAL PRIMARY KEY,
            league_id INTEGER REFERENCES leagues(league_id),
            team_id INTEGER REFERENCES teams(team_id),
            season_year INTEGER,
            week_number INTEGER,
            
            -- Hitting Categories (6x6 format)
            runs_rank INTEGER,
            rbi_rank INTEGER, 
            hr_rank INTEGER,
            sb_rank INTEGER,
            avg_rank INTEGER,
            ops_rank INTEGER,
            
            -- Pitching Categories  
            wins_rank INTEGER,
            strikeouts_rank INTEGER,
            saves_rank INTEGER,
            quality_starts_rank INTEGER,
            era_rank INTEGER,
            whip_rank INTEGER,
            
            -- Total points (sum of all category ranks)
            total_points INTEGER,
            overall_rank INTEGER,
            
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(league_id, team_id, season_year, week_number)
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS team_season_stats (
            team_stat_id SERIAL PRIMARY KEY,
            team_id INTEGER REFERENCES teams(team_id),
            season_year INTEGER,
            week_number INTEGER,
            
            -- Hitting totals
            total_runs INTEGER DEFAULT 0,
            total_rbi INTEGER DEFAULT 0,
            total_hr INTEGER DEFAULT 0,
            total_sb INTEGER DEFAULT 0,
            total_hits INTEGER DEFAULT 0,
            total_at_bats INTEGER DEFAULT 0,
            team_avg DECIMAL(5,3) DEFAULT 0,
            team_ops DECIMAL(5,3) DEFAULT 0,
            
            -- Pitching totals
            total_wins INTEGER DEFAULT 0,
            total_strikeouts INTEGER DEFAULT 0,
            total_saves INTEGER DEFAULT 0,
            total_quality_starts INTEGER DEFAULT 0,
            total_earned_runs INTEGER DEFAULT 0,
            total_innings_pitched DECIMAL(6,1) DEFAULT 0,
            total_hits_allowed INTEGER DEFAULT 0,
            total_walks_allowed INTEGER DEFAULT 0,
            team_era DECIMAL(5,2) DEFAULT 0,
            team_whip DECIMAL(5,3) DEFAULT 0,
            
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(team_id, season_year, week_number)
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id SERIAL PRIMARY KEY,
            league_id INTEGER REFERENCES leagues(league_id),
            transaction_type VARCHAR(20),
            from_team_id INTEGER REFERENCES teams(team_id),
            to_team_id INTEGER REFERENCES teams(team_id),
            player_id INTEGER REFERENCES mlb_players(player_id),
            transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            is_processed BOOLEAN DEFAULT FALSE
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS league_champions (
            champion_id SERIAL PRIMARY KEY,
            league_id INTEGER REFERENCES leagues(league_id),
            season_year INTEGER,
            champion_team_id INTEGER REFERENCES teams(team_id),
            champion_owner_id INTEGER REFERENCES users(user_id),
            final_points INTEGER,
            playoff_format VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(league_id, season_year)
        );
        """
    ]
    
    # Create indexes for performance
    create_indexes_sql = [
        "CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_team_active ON fantasy_rosters(team_id, is_active);",
        "CREATE INDEX IF NOT EXISTS idx_player_stats_week_year ON player_stats(week_number, season_year);",
        "CREATE INDEX IF NOT EXISTS idx_rotisserie_standings_league_week ON rotisserie_standings(league_id, week_number, season_year);",
        "CREATE INDEX IF NOT EXISTS idx_transactions_league_date ON transactions(league_id, transaction_date);",
        "CREATE INDEX IF NOT EXISTS idx_mlb_players_mlb_id ON mlb_players(mlb_id);",
        "CREATE INDEX IF NOT EXISTS idx_teams_league_owner ON teams(league_id, owner_id);"
    ]
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("Creating tables...")
        for i, sql_statement in enumerate(create_table_sql, 1):
            cursor.execute(sql_statement)
            table_name = sql_statement.split("CREATE TABLE IF NOT EXISTS ")[1].split(" (")[0]
            print(f"  {i}. Created table: {table_name}")
        
        print("\nCreating indexes...")
        for sql_statement in create_indexes_sql:
            cursor.execute(sql_statement)
        print(f"  Created {len(create_indexes_sql)} indexes")
        
        conn.commit()
        print("\n✅ All tables and indexes created successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False
    
    return True

def insert_sample_data():
    """Insert some sample data for testing"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("Inserting sample data...")
        
        # Sample user
        cursor.execute("""
            INSERT INTO users (email, username, password_hash, first_name, last_name)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            RETURNING user_id;
        """, ('test@example.com', 'testuser', 'hashed_password', 'Test', 'User'))
        
        result = cursor.fetchone()
        if result:
            user_id = result[0]
            print(f"  Created sample user with ID: {user_id}")
        else:
            # Get existing user
            cursor.execute("SELECT user_id FROM users WHERE email = %s", ('test@example.com',))
            user_id = cursor.fetchone()[0]
            print(f"  Using existing user with ID: {user_id}")
        
        # Sample league
        cursor.execute("""
            INSERT INTO leagues (league_name, commissioner_id, season_year)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING league_id;
        """, ('Test Fantasy League', user_id, 2025))
        
        # Sample MLB players
        sample_players = [
            ('mlb_123', 'Mike', 'Trout', 'OF', 'LAA'),
            ('mlb_456', 'Mookie', 'Betts', 'OF', 'LAD'),
            ('mlb_789', 'Aaron', 'Judge', 'OF', 'NYY')
        ]
        
        for mlb_id, first_name, last_name, position, team in sample_players:
            cursor.execute("""
                INSERT INTO mlb_players (mlb_id, first_name, last_name, position, mlb_team)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (mlb_id) DO NOTHING;
            """, (mlb_id, first_name, last_name, position, team))
        
        print("  Inserted sample players")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Sample data inserted successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error inserting sample data: {e}")
        return False

def show_table_counts():
    """Show count of records in each table"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        tables = ['users', 'leagues', 'teams', 'mlb_players', 'fantasy_rosters', 
                 'player_stats', 'rotisserie_standings', 'transactions']
        
        print("\nTable counts:")
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} records")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error checking table counts: {e}")

def main():
    """Main function to set up the database"""
    print("🏀 Fantasy Baseball Database Setup")
    print("=" * 40)
    
    # Test connection
    if not test_connection():
        print("Failed to connect to database. Please check your connection settings.")
        sys.exit(1)
    
    # Create tables
    if not create_tables():
        print("Failed to create tables.")
        sys.exit(1)
    
    # Insert sample data
    if not insert_sample_data():
        print("Failed to insert sample data.")
        sys.exit(1)
    
    # Show results
    show_table_counts()
    
    print("\n🎉 Database setup complete!")
    print("Your fantasy baseball database is ready to use.")

if __name__ == "__main__":
    main()
