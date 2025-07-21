#!/usr/bin/env python3
import boto3

rds_client = boto3.client('rds-data')
CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball'
SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-db-credentials'

def execute_sql(sql):
    try:
        response = rds_client.execute_statement(
            resourceArn=CLUSTER_ARN,
            secretArn=SECRET_ARN,
            database='postgres',
            sql=sql
        )
        print(f"✅ {sql[:60]}...")
        return response
    except Exception as e:
        print(f"❌ {sql[:60]}... - {str(e)}")

# Fix date columns to be VARCHAR instead of DATE
print("Fixing date column types...")
execute_sql("ALTER TABLE mlb_players ALTER COLUMN birth_date TYPE VARCHAR(20);")
execute_sql("ALTER TABLE mlb_players ALTER COLUMN mlb_debut_date TYPE VARCHAR(20);")

# Ensure all tables exist
print("Creating missing tables...")
execute_sql("""
CREATE TABLE IF NOT EXISTS mlb_teams (
    team_id INTEGER PRIMARY KEY,
    name VARCHAR(100),
    team_name VARCHAR(100),
    abbreviation VARCHAR(10),
    team_code VARCHAR(10),
    file_code VARCHAR(10),
    club_name VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    venue_id INTEGER,
    venue_name VARCHAR(100),
    league_id INTEGER,
    league_name VARCHAR(50),
    division_id INTEGER,
    division_name VARCHAR(50),
    sport_id INTEGER,
    sport_name VARCHAR(50),
    short_name VARCHAR(100),
    franchise_name VARCHAR(100),
    first_year_of_play VARCHAR(10),
    api_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

execute_sql("""
CREATE TABLE IF NOT EXISTS mlb_games (
    game_id BIGINT PRIMARY KEY,
    game_date VARCHAR(30),
    game_type VARCHAR(10),
    season VARCHAR(10),
    season_display VARCHAR(10),
    game_number INTEGER,
    double_header VARCHAR(20),
    day_night VARCHAR(20),
    scheduled_innings INTEGER,
    away_team_id INTEGER,
    away_team_name VARCHAR(100),
    home_team_id INTEGER,
    home_team_name VARCHAR(100),
    venue_id INTEGER,
    venue_name VARCHAR(100),
    weather_condition VARCHAR(50),
    weather_temp VARCHAR(20),
    weather_wind VARCHAR(50),
    game_status VARCHAR(30),
    detailed_state VARCHAR(50),
    status_code VARCHAR(10),
    away_score INTEGER,
    home_score INTEGER,
    current_inning INTEGER,
    inning_state VARCHAR(20),
    api_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

print("✅ All fixes completed!")
