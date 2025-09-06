# backend/scripts/load_historical_stats.py
import boto3
import requests
import time

DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
rds_client = boto3.client('rds-data', region_name='us-east-1')

def execute_sql(sql, parameters=None, database_name='postgres'):
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
        params['parameters'] = rds_params
    
    return rds_client.execute_statement(**params)

def get_2025_players():
    result = execute_sql("""
        SELECT DISTINCT p.player_id, p.first_name, p.last_name 
        FROM mlb_players p
        INNER JOIN player_season_stats pss ON p.player_id = pss.player_id
        WHERE pss.season = 2025
        ORDER BY p.player_id
    """)
    players = []
    if result and result.get('records'):
        for record in result['records']:
            players.append({
                'player_id': record[0].get('longValue'),
                'name': f"{record[1].get('stringValue', '')} {record[2].get('stringValue', '')}"
            })
    return players

def load_player_history(player_id, player_name):
    try:
        url = f"https://statsapi.mlb.com/api/v1/people/{player_id}/stats?stats=yearByYear&gameType=R"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            return 0
            
        data = response.json()
        if not data.get('stats') or not data['stats'][0].get('splits'):
            return 0
        
        years_loaded = 0
        for split in data['stats'][0]['splits']:
            if split.get('league', {}).get('name') not in ['American League', 'National League']:
                continue
                
            # Get year and ensure it's an integer
            year = split.get('season')
            if not year:
                continue
            year = int(year)  # Convert to integer
            
            if year == 2025:  # Skip 2025
                continue
                
            stats = split.get('stat', {})
            if not stats:
                continue
            
            # Check if exists - pass year as integer
            check = execute_sql(
                "SELECT 1 FROM player_season_stats WHERE player_id = :pid AND season = :season",
                {'pid': player_id, 'season': year}  # year is already int
            )
            if check.get('records'):
                continue
            
            # Convert innings pitched
            ip_str = str(stats.get('inningsPitched', '0.0'))
            if '.' in ip_str:
                parts = ip_str.split('.')
                ip = float(parts[0]) + (float(parts[1]) / 3 if len(parts) > 1 else 0)
            else:
                ip = float(ip_str) if ip_str else 0.0
            
            def parse_avg(val):
                if not val:
                    return 0.0
                val = str(val)
                if val.startswith('.'):
                    return float('0' + val)
                return float(val) if val else 0.0
            
            sql = """
            INSERT INTO player_season_stats (
                player_id, season, games_played, at_bats, runs, hits, doubles, triples, 
                home_runs, rbi, stolen_bases, caught_stealing, walks, strikeouts,
                batting_avg, obp, slg, ops, games_started, wins, losses, saves,
                innings_pitched, hits_allowed, earned_runs, walks_allowed, 
                strikeouts_pitched, era, whip, quality_starts, blown_saves, holds,
                hit_by_pitch, home_runs_allowed
            ) VALUES (
                :player_id, :season, :games_played, :at_bats, :runs, :hits, :doubles, :triples,
                :home_runs, :rbi, :stolen_bases, :caught_stealing, :walks, :strikeouts,
                :batting_avg, :obp, :slg, :ops, :games_started, :wins, :losses, :saves,
                :innings_pitched, :hits_allowed, :earned_runs, :walks_allowed,
                :strikeouts_pitched, :era, :whip, :quality_starts, :blown_saves, :holds,
                :hit_by_pitch, :home_runs_allowed
            )"""
            
            params = {
                'player_id': player_id,
                'season': year,  # Already an integer
                'games_played': stats.get('gamesPlayed', 0),
                'at_bats': stats.get('atBats', 0),
                'runs': stats.get('runs', 0),
                'hits': stats.get('hits', 0),
                'doubles': stats.get('doubles', 0),
                'triples': stats.get('triples', 0),
                'home_runs': stats.get('homeRuns', 0),
                'rbi': stats.get('rbi', 0),
                'stolen_bases': stats.get('stolenBases', 0),
                'caught_stealing': stats.get('caughtStealing', 0),
                'walks': stats.get('baseOnBalls', 0),
                'strikeouts': stats.get('strikeOuts', 0),
                'batting_avg': parse_avg(stats.get('avg')),
                'obp': parse_avg(stats.get('obp')),
                'slg': parse_avg(stats.get('slg')),
                'ops': parse_avg(stats.get('ops')),
                'games_started': stats.get('gamesStarted', 0),
                'wins': stats.get('wins', 0),
                'losses': stats.get('losses', 0),
                'saves': stats.get('saves', 0),
                'innings_pitched': ip,
                'hits_allowed': stats.get('hitsAllowed', 0),
                'earned_runs': stats.get('earnedRuns', 0),
                'walks_allowed': stats.get('baseOnBallsAllowed', 0),
                'strikeouts_pitched': stats.get('strikeOuts', 0) if stats.get('inningsPitched') else 0,
                'era': float(stats.get('era', '0.00')) if stats.get('era') else 0.00,
                'whip': float(stats.get('whip', '0.00')) if stats.get('whip') else 0.00,
                'quality_starts': stats.get('qualityStarts', 0),
                'blown_saves': stats.get('blownSaves', 0),
                'holds': stats.get('holds', 0),
                'hit_by_pitch': stats.get('hitByPitch', 0),
                'home_runs_allowed': stats.get('homeRunsAllowed', 0)
            }
            
            execute_sql(sql, params)
            years_loaded += 1
            
        return years_loaded
        
    except Exception as e:
        print(f"Error loading {player_name}: {e}")
        return 0

def main():
    print("Loading career history for CURRENT 2025 MLB players...")
    
    players = get_2025_players()
    print(f"Found {len(players)} players with 2025 stats\n")
    
    total_years_loaded = 0
    players_with_history = 0
    
    for idx, player in enumerate(players):
        if idx % 20 == 0:
            print(f"Progress: {idx}/{len(players)} players | {total_years_loaded} seasons loaded")
        
        years = load_player_history(player['player_id'], player['name'])
        if years > 0:
            total_years_loaded += years
            players_with_history += 1
            print(f"  {player['name']}: {years} seasons")
        
        time.sleep(0.3)  # Rate limiting
    
    print(f"\n{'='*60}")
    print(f"COMPLETE!")
    print(f"Processed: {len(players)} current players")
    print(f"Players with history: {players_with_history}")
    print(f"Total seasons loaded: {total_years_loaded}")
    
    result = execute_sql("""
        SELECT 
            COUNT(DISTINCT player_id) as players,
            COUNT(DISTINCT season) as seasons,
            MIN(season) as earliest,
            MAX(season) as latest,
            COUNT(*) as total_records
        FROM player_season_stats
    """)
    
    if result['records']:
        r = result['records'][0]
        print(f"\nDatabase totals:")
        print(f"  Players: {r[0]['longValue']}")
        print(f"  Seasons: {r[1]['longValue']} ({r[2]['longValue']}-{r[3]['longValue']})")
        print(f"  Records: {r[4]['longValue']}")

if __name__ == "__main__":
    main()