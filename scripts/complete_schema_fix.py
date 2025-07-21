#!/usr/bin/env python3
import boto3

# Initialize RDS Data API client
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
        print(f"✅ Executed: {sql[:50]}...")
        return response
    except Exception as e:
        print(f"❌ Error: {sql[:50]}... - {str(e)}")

# Add all missing columns for mlb_players
columns_to_add = [
    "birth_city VARCHAR(100)",
    "birth_state_province VARCHAR(100)", 
    "birth_country VARCHAR(100)",
    "height VARCHAR(20)",
    "weight INTEGER",
    "active BOOLEAN DEFAULT TRUE",
    "current_team_id INTEGER",
    "current_team_name VARCHAR(100)",
    "primary_position_code VARCHAR(10)",
    "primary_position_name VARCHAR(50)",
    "primary_position_type VARCHAR(50)",
    "primary_position_abbreviation VARCHAR(10)",
    "bat_side_code VARCHAR(10)",
    "bat_side_description VARCHAR(50)",
    "pitch_hand_code VARCHAR(10)", 
    "pitch_hand_description VARCHAR(50)",
    "mlb_debut_date DATE",
    "name_first_last VARCHAR(200)",
    "name_slug VARCHAR(200)",
    "first_last_name VARCHAR(200)",
    "box_score_name VARCHAR(100)",
    "gender VARCHAR(10)",
    "is_player BOOLEAN DEFAULT TRUE",
    "is_verified BOOLEAN DEFAULT FALSE",
    "draft_year INTEGER",
    "pronunciation VARCHAR(200)",
    "mlb_id INTEGER",
    "api_data JSONB"
]

print("Adding missing columns to mlb_players table...")
for column in columns_to_add:
    sql = f"ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS {column};"
    execute_sql(sql)

print("\n✅ Schema update completed!")
