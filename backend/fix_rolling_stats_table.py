#!/usr/bin/env python3
import boto3
import json

# Database configuration
DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
rds_client = boto3.client('rds-data', region_name='us-east-1')

def execute_sql(sql, database_name='postgres'):
    """Execute SQL using RDS Data API"""
    try:
        response = rds_client.execute_statement(
            resourceArn=DB_CLUSTER_ARN,
            secretArn=DB_SECRET_ARN,
            database=database_name,
            sql=sql
        )
        return response
    except Exception as e:
        print(f"SQL Error: {e}")
        raise

# First, check if the table exists
check_sql = """
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'player_rolling_stats'
);
"""

print("Checking if player_rolling_stats table exists in leagues database...")
result = execute_sql(check_sql, database_name='leagues')
exists = result['records'][0][0].get('booleanValue', False)

if exists:
    print("Table already exists. Checking for league_id column...")
    
    # Check if league_id column exists
    check_column_sql = """
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'player_rolling_stats' 
    AND column_name = 'league_id';
    """
    
    col_result = execute_sql(check_column_sql, database_name='leagues')
    if not col_result.get('records'):
        print("Adding league_id column...")
        alter_sql = """
        ALTER TABLE player_rolling_stats 
        ADD COLUMN league_id UUID;
        """
        execute_sql(alter_sql, database_name='leagues')
else:
    print("Creating player_rolling_stats table in leagues database...")
    
    create_sql = """
    CREATE TABLE IF NOT EXISTS player_rolling_stats (
        player_id INTEGER NOT NULL,
        league_id UUID NOT NULL,
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
        batting_avg DECIMAL(4,3) DEFAULT 0.000,
        obp DECIMAL(4,3) DEFAULT 0.000,
        slg DECIMAL(4,3) DEFAULT 0.000,
        ops DECIMAL(4,3) DEFAULT 0.000,
        games_started INTEGER DEFAULT 0,
        innings_pitched DECIMAL(5,1) DEFAULT 0.0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0,
        quality_starts INTEGER DEFAULT 0,
        era DECIMAL(5,2) DEFAULT 0.00,
        whip DECIMAL(4,3) DEFAULT 0.000,
        hits_allowed INTEGER DEFAULT 0,
        walks_allowed INTEGER DEFAULT 0,
        earned_runs INTEGER DEFAULT 0,
        blown_saves INTEGER DEFAULT 0,
        strikeouts_pitched INTEGER DEFAULT 0,
        last_calculated TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (player_id, league_id, period, as_of_date)
    );
    """
    
    execute_sql(create_sql, database_name='leagues')
    print("✅ Table created successfully!")

    # Create indexes for performance
    print("Creating indexes...")
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_rolling_stats_league ON player_rolling_stats(league_id);",
        "CREATE INDEX IF NOT EXISTS idx_rolling_stats_date ON player_rolling_stats(as_of_date);",
        "CREATE INDEX IF NOT EXISTS idx_rolling_stats_period ON player_rolling_stats(period);"
    ]
    
    for idx_sql in indexes:
        execute_sql(idx_sql, database_name='leagues')
    
    print("✅ Indexes created!")

print("\n✅ Database is ready for rolling stats sync!")
print("\nNow run the master daily updater again:")
print("aws lambda invoke --function-name dynasty-dugout-master-daily-updater --payload '{}' response.json")