import boto3
import requests
import time

DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
rds_client = boto3.client('rds-data', region_name='us-east-1')

def execute_sql(sql, parameters=None):
    params = {
        'resourceArn': DB_CLUSTER_ARN,
        'secretArn': DB_SECRET_ARN,
        'database': 'postgres',
        'sql': sql
    }
    if parameters:
        rds_params = []
        for k, v in parameters.items():
            param = {'name': k}
            if v is None:
                param['value'] = {'isNull': True}
            elif isinstance(v, int):
                param['value'] = {'longValue': v}
            else:
                param['value'] = {'stringValue': str(v)}
            rds_params.append(param)
        params['parameters'] = rds_params
    return rds_client.execute_statement(**params)

# Add columns if they don't exist
print("Adding missing columns...")
execute_sql("ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS birthdate DATE")
execute_sql("ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS height_inches INTEGER")
execute_sql("ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS weight_pounds INTEGER")

# Get all players
result = execute_sql("SELECT player_id FROM mlb_players ORDER BY player_id")
players = [r[0].get('longValue') for r in result.get('records', [])]

print(f"Updating {len(players)} players with bio data...")

updated = 0
errors = 0

for idx, player_id in enumerate(players):
    if idx % 50 == 0:
        print(f"Progress: {idx}/{len(players)} - Updated: {updated}, Errors: {errors}")
    
    try:
        response = requests.get(f"https://statsapi.mlb.com/api/v1/people/{player_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'people' in data and len(data['people']) > 0:
                person = data['people'][0]
                
                # Parse height (e.g., "6' 0\"" -> 72 inches)
                height_str = person.get('height', '')
                height_inches = None
                if height_str and "'" in height_str:
                    parts = height_str.replace('"', '').split("'")
                    if len(parts) == 2:
                        try:
                            feet = int(parts[0].strip())
                            inches = int(parts[1].strip()) if parts[1].strip() else 0
                            height_inches = feet * 12 + inches
                        except:
                            height_inches = None
                
                # Get birthdate and weight
                birthdate = person.get('birthDate')
                weight = person.get('weight')
                
                # Update using CAST for birthdate
                if birthdate:
                    sql = """UPDATE mlb_players 
                             SET birthdate = CAST(:birthdate AS DATE), 
                                 height_inches = :height, 
                                 weight_pounds = :weight
                             WHERE player_id = :player_id"""
                else:
                    sql = """UPDATE mlb_players 
                             SET height_inches = :height, 
                                 weight_pounds = :weight
                             WHERE player_id = :player_id"""
                
                execute_sql(sql, {
                    'player_id': player_id,
                    'birthdate': birthdate,
                    'height': height_inches,
                    'weight': weight
                })
                updated += 1
        
        time.sleep(0.2)  # Rate limiting
        
    except Exception as e:
        errors += 1
        if errors <= 5:  # Only print first 5 errors
            print(f"Error updating player {player_id}: {e}")

print(f"\nComplete! Updated {updated} players, {errors} errors")

# Verify
result = execute_sql("""
    SELECT COUNT(*) as total,
           COUNT(birthdate) as with_birthdate,
           COUNT(height_inches) as with_height,
           COUNT(weight_pounds) as with_weight
    FROM mlb_players
""")
if result['records']:
    r = result['records'][0]
    print(f"\nStats:")
    print(f"  Total players: {r[0]['longValue']}")
    print(f"  With birthdate: {r[1]['longValue']}")
    print(f"  With height: {r[2]['longValue']}")
    print(f"  With weight: {r[3]['longValue']}")

# Test with Schwarber
result = execute_sql("""
    SELECT birthdate, height_inches, weight_pounds 
    FROM mlb_players 
    WHERE player_id = 656941
""")
if result['records']:
    r = result['records'][0]
    print(f"\nSchwarber test:")
    print(f"  Birthdate: {r[0].get('stringValue', 'NULL')}")
    print(f"  Height: {r[1].get('longValue', 'NULL')} inches")
    print(f"  Weight: {r[2].get('longValue', 'NULL')} lbs")
