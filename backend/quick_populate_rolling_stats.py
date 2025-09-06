# quick_populate_rolling_stats.py
import boto3
from datetime import date, timedelta

CLUSTER_ARN = "arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless"
SECRET_ARN = "arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb"

rds_client = boto3.client('rds-data', region_name='us-east-1')

print("Creating rolling stats table...")
# Create table first
rds_client.execute_statement(
    resourceArn=CLUSTER_ARN,
    secretArn=SECRET_ARN,
    database='postgres',
    sql="""
    CREATE TABLE IF NOT EXISTS player_rolling_stats (
        player_id INT,
        period VARCHAR(20),
        as_of_date DATE,
        games_played INT DEFAULT 0,
        at_bats INT DEFAULT 0,
        hits INT DEFAULT 0,
        home_runs INT DEFAULT 0,
        rbi INT DEFAULT 0,
        runs INT DEFAULT 0,
        stolen_bases INT DEFAULT 0,
        batting_avg DECIMAL(5,3) DEFAULT 0.000,
        era DECIMAL(5,2) DEFAULT 0.00,
        wins INT DEFAULT 0,
        saves INT DEFAULT 0,
        innings_pitched DECIMAL(8,1) DEFAULT 0.0,
        whip DECIMAL(5,3) DEFAULT 0.000,
        strikeouts_pitched INT DEFAULT 0,
        PRIMARY KEY (player_id, period, as_of_date)
    )"""
)

print("Populating last 14 days rolling stats...")
# Populate with last 14 days data
today = date.today()
start_date = today - timedelta(days=14)

rds_client.execute_statement(
    resourceArn=CLUSTER_ARN,
    secretArn=SECRET_ARN,
    database='postgres',
    sql=f"""
    INSERT INTO player_rolling_stats (
        player_id, period, as_of_date, games_played,
        at_bats, hits, home_runs, rbi, runs, stolen_bases,
        batting_avg, era, wins, saves, innings_pitched, whip, strikeouts_pitched
    )
    SELECT 
        player_id, 
        'last_14_days', 
        CURRENT_DATE,
        COUNT(*),
        COALESCE(SUM(at_bats), 0),
        COALESCE(SUM(hits), 0),
        COALESCE(SUM(home_runs), 0),
        COALESCE(SUM(rbi), 0),
        COALESCE(SUM(runs), 0),
        COALESCE(SUM(stolen_bases), 0),
        CASE WHEN SUM(at_bats) > 0 
            THEN ROUND(SUM(hits)::DECIMAL / SUM(at_bats), 3) 
            ELSE 0.000 END,
        CASE WHEN SUM(innings_pitched) > 0 
            THEN ROUND((SUM(earned_runs) * 9)::DECIMAL / SUM(innings_pitched), 2) 
            ELSE 0.00 END,
        COALESCE(SUM(wins), 0),
        COALESCE(SUM(saves), 0),
        COALESCE(SUM(innings_pitched), 0),
        CASE WHEN SUM(innings_pitched) > 0 
            THEN ROUND((SUM(hits_allowed) + SUM(walks_allowed))::DECIMAL / SUM(innings_pitched), 3) 
            ELSE 0.000 END,
        COALESCE(SUM(strikeouts_pitched), 0)
    FROM player_game_logs
    WHERE game_date >= '{start_date}' 
      AND game_date <= '{today}'
    GROUP BY player_id
    ON CONFLICT (player_id, period, as_of_date) DO UPDATE SET
        games_played = EXCLUDED.games_played,
        at_bats = EXCLUDED.at_bats,
        hits = EXCLUDED.hits,
        home_runs = EXCLUDED.home_runs,
        rbi = EXCLUDED.rbi,
        runs = EXCLUDED.runs,
        stolen_bases = EXCLUDED.stolen_bases,
        batting_avg = EXCLUDED.batting_avg,
        era = EXCLUDED.era,
        wins = EXCLUDED.wins,
        saves = EXCLUDED.saves,
        innings_pitched = EXCLUDED.innings_pitched,
        whip = EXCLUDED.whip,
        strikeouts_pitched = EXCLUDED.strikeouts_pitched
    """
)

# Check how many records were created
result = rds_client.execute_statement(
    resourceArn=CLUSTER_ARN,
    secretArn=SECRET_ARN,
    database='postgres',
    sql="SELECT COUNT(*) FROM player_rolling_stats WHERE period = 'last_14_days' AND as_of_date = CURRENT_DATE"
)

count = result['records'][0][0]['longValue']
print(f"✅ Created {count} rolling stats records!")

# Also copy to your league database
league_id = "YOUR_LEAGUE_ID"  # Replace with your actual league ID
if league_id != "YOUR_LEAGUE_ID":
    league_db = f"league_{league_id.replace('-', '_')}"
    
    # Create table in league DB
    rds_client.execute_statement(
        resourceArn=CLUSTER_ARN,
        secretArn=SECRET_ARN,
        database=league_db,
        sql="""CREATE TABLE IF NOT EXISTS player_rolling_stats (LIKE postgres.player_rolling_stats INCLUDING ALL)"""
    )
    
    # Copy data
    rds_client.execute_statement(
        resourceArn=CLUSTER_ARN,
        secretArn=SECRET_ARN,
        database=league_db,
        sql="""INSERT INTO player_rolling_stats SELECT * FROM postgres.player_rolling_stats WHERE as_of_date = CURRENT_DATE ON CONFLICT DO NOTHING"""
    )
    
    print(f"✅ Also copied to league database {league_db}")