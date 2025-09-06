#!/usr/bin/env python3
import boto3
import json
from datetime import date, timedelta

DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
CURRENT_SEASON = 2025
SEASON_START = '2025-03-20'

rds_client = boto3.client('rds-data', region_name='us-east-1')
lambda_client = boto3.client('lambda', region_name='us-east-1')

def execute_sql(sql, database='postgres'):
    return rds_client.execute_statement(
        resourceArn=DB_CLUSTER_ARN,
        secretArn=DB_SECRET_ARN,
        database=database,
        sql=sql
    )

print("Updating season stats...")
execute_sql(f"""
    INSERT INTO player_season_stats (
        player_id, season, games_played, at_bats, runs, hits,
        doubles, triples, home_runs, rbi, stolen_bases, caught_stealing,
        walks, strikeouts, hit_by_pitch, batting_avg, obp, slg, ops,
        games_started, wins, losses, saves, blown_saves, holds,
        quality_starts, innings_pitched, hits_allowed, earned_runs,
        walks_allowed, strikeouts_pitched, era, whip
    )
    SELECT 
        player_id, {CURRENT_SEASON},
        COUNT(*), SUM(at_bats), SUM(runs), SUM(hits),
        SUM(doubles), SUM(triples), SUM(home_runs), SUM(rbi),
        SUM(stolen_bases), SUM(caught_stealing), SUM(walks), SUM(strikeouts),
        SUM(hit_by_pitch),
        CASE WHEN SUM(at_bats) > 0 THEN ROUND(SUM(hits)::DECIMAL / SUM(at_bats), 3) ELSE 0 END,
        CASE WHEN SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch) > 0 
            THEN ROUND((SUM(hits) + SUM(walks) + SUM(hit_by_pitch))::DECIMAL / 
                      (SUM(at_bats) + SUM(walks) + SUM(hit_by_pitch)), 3) ELSE 0 END,
        CASE WHEN SUM(at_bats) > 0 
            THEN ROUND((SUM(hits) + SUM(doubles) + 2*SUM(triples) + 3*SUM(home_runs))::DECIMAL / SUM(at_bats), 3) ELSE 0 END,
        0,
        COUNT(CASE WHEN innings_pitched >= 5 THEN 1 END),
        SUM(wins), SUM(losses), SUM(saves), SUM(blown_saves), SUM(holds),
        SUM(CASE WHEN quality_start = 1 THEN 1 ELSE 0 END),
        SUM(innings_pitched), SUM(hits_allowed), SUM(earned_runs),
        SUM(walks_allowed), SUM(strikeouts_pitched),
        CASE WHEN SUM(innings_pitched) > 0 
            THEN ROUND((SUM(earned_runs) * 9)::DECIMAL / SUM(innings_pitched), 2) ELSE 0 END,
        CASE WHEN SUM(innings_pitched) > 0 
            THEN ROUND((SUM(hits_allowed) + SUM(walks_allowed))::DECIMAL / SUM(innings_pitched), 3) ELSE 0 END
    FROM player_game_logs
    WHERE game_date >= '{SEASON_START}'
      AND game_date < CURRENT_DATE + INTERVAL '1 day'
    GROUP BY player_id
    ON CONFLICT (player_id, season) DO UPDATE SET
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
        hit_by_pitch = EXCLUDED.hit_by_pitch,
        batting_avg = EXCLUDED.batting_avg,
        obp = EXCLUDED.obp,
        slg = EXCLUDED.slg,
        games_started = EXCLUDED.games_started,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        saves = EXCLUDED.saves,
        blown_saves = EXCLUDED.blown_saves,
        holds = EXCLUDED.holds,
        quality_starts = EXCLUDED.quality_starts,
        innings_pitched = EXCLUDED.innings_pitched,
        hits_allowed = EXCLUDED.hits_allowed,
        earned_runs = EXCLUDED.earned_runs,
        walks_allowed = EXCLUDED.walks_allowed,
        strikeouts_pitched = EXCLUDED.strikeouts_pitched,
        era = EXCLUDED.era,
        whip = EXCLUDED.whip
""")

execute_sql(f"UPDATE player_season_stats SET ops = obp + slg WHERE season = {CURRENT_SEASON}")
print("✅ Season stats updated")

# Trigger lambdas
lambda_client.invoke(
    FunctionName='calculate-rolling-stats',
    InvocationType='RequestResponse',
    Payload=json.dumps({'date': str(date.today())})
)
print("✅ Rolling stats triggered")

yesterday = date.today() - timedelta(days=1)
lambda_client.invoke(
    FunctionName='update-active-accrued-stats',
    InvocationType='RequestResponse', 
    Payload=json.dumps({'date': yesterday.strftime('%Y-%m-%d')})
)
print("✅ Accrued stats triggered")