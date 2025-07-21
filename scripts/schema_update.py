#!/usr/bin/env python3
"""
Aurora Schema Update Script
Updates existing fantasy baseball tables to match MLB Stats API structure
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

def get_db_connection():
    """Create and return a database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

def update_mlb_players_table():
    """Update mlb_players table to match MLB API structure"""
    
    update_sql = """
    -- Add new columns to mlb_players table
    ALTER TABLE mlb_players 
    ADD COLUMN IF NOT EXISTS mlb_api_id INTEGER UNIQUE,
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS nick_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS birth_city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS birth_state_province VARCHAR(100),
    ADD COLUMN IF NOT EXISTS birth_country VARCHAR(100),
    ADD COLUMN IF NOT EXISTS current_age INTEGER,
    ADD COLUMN IF NOT EXISTS draft_year INTEGER,
    ADD COLUMN IF NOT EXISTS height_string VARCHAR(20),
    ADD COLUMN IF NOT EXISTS weight_string VARCHAR(20),
    ADD COLUMN IF NOT EXISTS bat_side_code VARCHAR(1),
    ADD COLUMN IF NOT EXISTS bat_side_description VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pitch_hand_code VARCHAR(1),
    ADD COLUMN IF NOT EXISTS pitch_hand_description VARCHAR(20),
    ADD COLUMN IF NOT EXISTS primary_position_code VARCHAR(5),
    ADD COLUMN IF NOT EXISTS primary_position_name VARCHAR(50),
    ADD COLUMN IF NOT EXISTS primary_position_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS primary_number VARCHAR(10),
    ADD COLUMN IF NOT EXISTS strike_zone_top DECIMAL(4,2),
    ADD COLUMN IF NOT EXISTS strike_zone_bottom DECIMAL(4,2),
    ADD COLUMN IF NOT EXISTS is_player BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_played_date DATE,
    ADD COLUMN IF NOT EXISTS current_team_id INTEGER,
    ADD COLUMN IF NOT EXISTS current_team_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS current_team_abbreviation VARCHAR(10),
    ADD COLUMN IF NOT EXISTS api_raw_data JSONB;
    
    -- Create index on MLB API ID for fast lookups
    CREATE INDEX IF NOT EXISTS idx_mlb_players_api_id ON mlb_players(mlb_api_id);
    """
    
    return update_sql

def update_player_stats_table():
    """Update player_stats table with comprehensive MLB statistics"""
    
    update_sql = """
    -- Add comprehensive hitting statistics
    ALTER TABLE player_stats
    ADD COLUMN IF NOT EXISTS ground_outs INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS air_outs INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS intentional_walks INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS caught_stealing INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stolen_base_percentage DECIMAL(5,3),
    ADD COLUMN IF NOT EXISTS ground_into_double_play INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS number_of_pitches INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS plate_appearances INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_bases INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS left_on_base INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sac_bunts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sac_flies INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ground_outs_to_airouts DECIMAL(5,3),
    ADD COLUMN IF NOT EXISTS catchers_interference INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS at_bats_per_home_run DECIMAL(6,2),
    
    -- Advanced hitting metrics
    ADD COLUMN IF NOT EXISTS avg DECIMAL(5,3),
    ADD COLUMN IF NOT EXISTS obp DECIMAL(5,3),
    ADD COLUMN IF NOT EXISTS slg DECIMAL(5,3),
    ADD COLUMN IF NOT EXISTS ops DECIMAL(5,3),
    ADD COLUMN IF NOT EXISTS iso DECIMAL(5,3),
    
    -- Additional pitching statistics
    ADD COLUMN IF NOT EXISTS batters_faced INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS outs_pitched INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS doubles_allowed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS triples_allowed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS home_runs_allowed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inherited_runners INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inherited_runners_scored INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS catchers_interference_pitching INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wild_pitches INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS balks INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bequeathed_runners INTEGER DEFAULT 0,
    
    -- Advanced pitching metrics
    ADD COLUMN IF NOT EXISTS strikeouts_per_9inn DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS walks_per_9inn DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS hits_per_9inn DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS runs_per_9inn DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS home_runs_per_9inn DECIMAL(5,2),
    
    -- Fielding statistics
    ADD COLUMN IF NOT EXISTS games_started INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS assists INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS putouts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS errors INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS chances INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fielding_percentage DECIMAL(5,3),
    ADD COLUMN IF NOT EXISTS range_factor_per_game DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS range_factor_per_9inn DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS innings_fielded DECIMAL(6,1),
    ADD COLUMN IF NOT EXISTS double_plays_fielding INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS triple_plays_fielding INTEGER DEFAULT 0,
    
    -- Store raw API response for future use
    ADD COLUMN IF NOT EXISTS api_raw_data JSONB;
    
    -- Add indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_player_stats_api_data ON player_stats USING GIN (api_raw_data);
    """
    
    return update_sql

def create_mlb_teams_table():
    """Create a dedicated table for MLB teams"""
    
    create_sql = """
    CREATE TABLE IF NOT EXISTS mlb_teams (
        team_id SERIAL PRIMARY KEY,
        mlb_api_id INTEGER UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        team_name VARCHAR(100),
        location_name VARCHAR(100),
        abbreviation VARCHAR(10),
        short_name VARCHAR(50),
        club_name VARCHAR(100),
        franchise_name VARCHAR(100),
        file_code VARCHAR(10),
        team_code VARCHAR(10),
        first_year_of_play INTEGER,
        league_id INTEGER,
        league_name VARCHAR(100),
        division_id INTEGER,
        division_name VARCHAR(100),
        venue_id INTEGER,
        venue_name VARCHAR(200),
        spring_league_id INTEGER,
        spring_league_name VARCHAR(100),
        spring_venue_id INTEGER,
        active BOOLEAN DEFAULT TRUE,
        all_star_status VARCHAR(1),
        season INTEGER DEFAULT 2025,
        api_raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_mlb_teams_api_id ON mlb_teams(mlb_api_id);
    CREATE INDEX IF NOT EXISTS idx_mlb_teams_abbreviation ON mlb_teams(abbreviation);
    CREATE INDEX IF NOT EXISTS idx_mlb_teams_active ON mlb_teams(active);
    """
    
    return create_sql

def create_games_table():
    """Create a table to store game information"""
    
    create_sql = """
    CREATE TABLE IF NOT EXISTS mlb_games (
        game_id SERIAL PRIMARY KEY,
        mlb_api_game_id INTEGER UNIQUE NOT NULL,
        game_date DATE NOT NULL,
        game_datetime TIMESTAMP,
        home_team_id INTEGER,
        away_team_id INTEGER,
        home_team_name VARCHAR(100),
        away_team_name VARCHAR(100),
        home_score INTEGER,
        away_score INTEGER,
        status VARCHAR(20),
        current_inning INTEGER,
        inning_state VARCHAR(10),
        game_type VARCHAR(5),
        doubleheader VARCHAR(1),
        venue_id INTEGER,
        venue_name VARCHAR(200),
        winning_team VARCHAR(100),
        losing_team VARCHAR(100),
        winning_pitcher VARCHAR(100),
        losing_pitcher VARCHAR(100),
        save_pitcher VARCHAR(100),
        series_status VARCHAR(200),
        api_raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_mlb_games_api_id ON mlb_games(mlb_api_game_id);
    CREATE INDEX IF NOT EXISTS idx_mlb_games_date ON mlb_games(game_date);
    CREATE INDEX IF NOT EXISTS idx_mlb_games_teams ON mlb_games(home_team_id, away_team_id);
    """
    
    return create_sql

def update_existing_data():
    """Update existing sample data with new structure"""
    
    update_sql = """
    -- Update existing Mike Trout record with API data
    UPDATE mlb_players 
    SET 
        mlb_api_id = 545361,
        full_name = 'Mike Trout',
        middle_name = 'Nelson',
        nick_name = 'Kiiiiid',
        birth_city = 'Vineland',
        birth_state_province = 'NJ',
        birth_country = 'USA',
        current_age = 33,
        draft_year = 2009,
        height_string = '6'' 2"',
        weight_string = '235 lbs',
        bat_side_code = 'R',
        bat_side_description = 'Right',
        pitch_hand_code = 'R',
        pitch_hand_description = 'Right',
        primary_position_code = 'RF',
        primary_position_name = 'Outfielder',
        primary_position_type = 'Outfielder',
        primary_number = '27',
        is_player = TRUE,
        is_verified = TRUE,
        current_team_name = 'Los Angeles Angels',
        current_team_abbreviation = 'LAA'
    WHERE mlb_id = 'mlb_123';
    
    -- Update other existing players similarly
    UPDATE mlb_players 
    SET 
        mlb_api_id = 605141,
        full_name = 'Mookie Betts'
    WHERE mlb_id = 'mlb_456';
    
    UPDATE mlb_players 
    SET 
        mlb_api_id = 592450,
        full_name = 'Aaron Judge'
    WHERE mlb_id = 'mlb_789';
    """
    
    return update_sql

def run_schema_updates():
    """Execute all schema updates"""
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        print("📊 Starting schema updates...")
        
        # Update mlb_players table
        print("1. Updating mlb_players table...")
        cursor.execute(update_mlb_players_table())
        print("   ✅ mlb_players table updated")
        
        # Update player_stats table
        print("2. Updating player_stats table...")
        cursor.execute(update_player_stats_table())
        print("   ✅ player_stats table updated")
        
        # Create mlb_teams table
        print("3. Creating mlb_teams table...")
        cursor.execute(create_mlb_teams_table())
        print("   ✅ mlb_teams table created")
        
        # Create games table
        print("4. Creating mlb_games table...")
        cursor.execute(create_games_table())
        print("   ✅ mlb_games table created")
        
        # Update existing data
        print("5. Updating existing sample data...")
        cursor.execute(update_existing_data())
        print("   ✅ Sample data updated")
        
        # Commit all changes
        conn.commit()
        
        print("\n🎉 All schema updates completed successfully!")
        
        # Show updated table structure
        cursor.execute("""
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'mlb_players' 
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        print(f"\n📋 Updated mlb_players table now has {len(columns)} columns:")
        for table, column, data_type in columns[:10]:  # Show first 10
            print(f"   {column}: {data_type}")
        if len(columns) > 10:
            print(f"   ... and {len(columns) - 10} more columns")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error during schema update: {e}")
        conn.rollback()
        cursor.close()
        conn.close()
        return False

def main():
    """Main function"""
    print("🔄 Aurora Database Schema Update")
    print("Updating tables to match MLB Stats API structure")
    print("=" * 50)
    
    success = run_schema_updates()
    
    if success:
        print("\n✅ Schema update complete!")
        print("Your Aurora database is now ready for MLB Stats API data")
    else:
        print("\n❌ Schema update failed!")
        print("Please check the error messages above")

if __name__ == "__main__":
    main()
