# fix_batting_stats.py
import boto3

rds_client = boto3.client('rds-data', region_name='us-east-1')
DB_CLUSTER_ARN = "arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless"
DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb"

def execute_sql(sql, database='postgres'):
    try:
        response = rds_client.execute_statement(
            resourceArn=DB_CLUSTER_ARN,
            secretArn=DB_SECRET_ARN,
            database=database,
            sql=sql
        )
        return response
    except Exception as e:
        print(f"Error: {e}")
        return None

# Fixed batting stats - rbi not rbis
batting_sql = """
INSERT INTO player_stats (
    player_id, season, games_played, at_bats, hits, home_runs, rbi, runs, 
    stolen_bases, walks, strikeouts, doubles, triples, caught_stealing,
    avg, obp, slg, ops
)
SELECT 
    player_id,
    2025 as season,
    COUNT(*) as games_played,
    SUM(at_bats) as at_bats,
    SUM(hits) as hits,
    SUM(home_runs) as home_runs,
    SUM(rbi) as rbi,  -- FIXED: rbi not rbis
    SUM(runs) as runs,
    SUM(stolen_bases) as stolen_bases,
    SUM(walks) as walks,
    SUM(strikeouts) as strikeouts,
    SUM(doubles) as doubles,
    SUM(triples) as triples,
    SUM(caught_stealing) as caught_stealing,
    CASE WHEN SUM(at_bats) > 0 THEN ROUND(SUM(hits)::numeric / SUM(at_bats)::numeric, 3) ELSE 0 END as avg,
    CASE WHEN (SUM(at_bats) + SUM(walks)) > 0 THEN 
        ROUND((SUM(hits) + SUM(walks))::numeric / (SUM(at_bats) + SUM(walks))::numeric, 3) 
    ELSE 0 END as obp,
    CASE WHEN SUM(at_bats) > 0 THEN 
        ROUND((SUM(hits) + SUM(doubles) + 2*SUM(triples) + 3*SUM(home_runs))::numeric / SUM(at_bats)::numeric, 3)
    ELSE 0 END as slg,
    CASE WHEN SUM(at_bats) > 0 THEN 
        ROUND(
            ((SUM(hits) + SUM(walks))::numeric / NULLIF(SUM(at_bats) + SUM(walks), 0)::numeric) +
            ((SUM(hits) + SUM(doubles) + 2*SUM(triples) + 3*SUM(home_runs))::numeric / NULLIF(SUM(at_bats), 0)::numeric), 3
        )
    ELSE 0 END as ops
FROM player_game_logs
WHERE game_date >= '2025-01-01' AND game_date < '2026-01-01'
AND at_bats > 0
GROUP BY player_id
ON CONFLICT (player_id, season) DO UPDATE SET
    games_played = EXCLUDED.games_played,
    at_bats = EXCLUDED.at_bats,
    hits = EXCLUDED.hits,
    home_runs = EXCLUDED.home_runs,
    rbi = EXCLUDED.rbi,
    runs = EXCLUDED.runs,
    avg = EXCLUDED.avg,
    obp = EXCLUDED.obp,
    slg = EXCLUDED.slg,
    ops = EXCLUDED.ops;
"""

print("Calculating batting stats...")
result = execute_sql(batting_sql)
if result:
    print(f"Batting stats calculated: {result.get('numberOfRecordsUpdated', 0)} records")

# Verify
result = execute_sql("SELECT COUNT(*) as count FROM player_stats WHERE season = 2025")
if result and result.get('records'):
    count = result['records'][0][0].get('longValue', 0)
    print(f"Total 2025 stats in main DB: {count}")