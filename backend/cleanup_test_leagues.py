#!/usr/bin/env python3
"""
Cleanup script to delete all leagues except specified ones.
DESTRUCTIVE - Use with caution!
"""

import boto3
import sys

# Database configuration
DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'

rds_client = boto3.client('rds-data', region_name='us-east-1')

def execute_sql(sql, parameters=None, database_name='postgres'):
    """Execute SQL using RDS Data API"""
    params = {
        'resourceArn': DB_CLUSTER_ARN,
        'secretArn': DB_SECRET_ARN,
        'database': database_name,
        'sql': sql
    }
    
    if parameters:
        params['parameters'] = [
            {'name': k, 'value': {'stringValue': str(v)}}
            for k, v in parameters.items()
        ]
    
    return rds_client.execute_statement(**params)

def get_all_leagues():
    """Get all leagues from user_leagues table"""
    result = execute_sql(
        "SELECT league_id, league_name, commissioner_user_id, creation_status FROM user_leagues ORDER BY league_name",
        database_name='postgres'
    )
    
    leagues = []
    if result.get('records'):
        for record in result['records']:
            leagues.append({
                'league_id': record[0].get('stringValue'),
                'league_name': record[1].get('stringValue'),
                'commissioner_user_id': record[2].get('stringValue'),
                'creation_status': record[3].get('stringValue')
            })
    return leagues

def delete_league(league_id, league_name):
    """Delete a league and all its data"""
    print(f"\n🗑️  Deleting: {league_name} ({league_id[:8]}...)")
    
    # Delete from leagues registry
    try:
        execute_sql(
            "DELETE FROM leagues WHERE league_id = :league_id::uuid",
            {'league_id': league_id},
            database_name='leagues'
        )
        print("  ✅ Removed from leagues registry")
    except Exception as e:
        print(f"  ⚠️  Registry cleanup skipped: {e}")
    
    # Tables to clean in order (respects foreign keys)
    tables_to_clean = [
        'price_change_history',
        'league_invitations',
        'league_messages',
        'league_standings',
        'player_active_accrued_stats',
        'roster_status_history',
        'player_team_accumulated_stats',
        'player_daily_team_stats',
        'player_rolling_stats',
        'player_season_stats',
        'league_transactions',
        'league_players',
        'league_teams',
        'league_settings'
    ]
    
    total_rows = 0
    for table in tables_to_clean:
        try:
            result = execute_sql(
                f"DELETE FROM {table} WHERE league_id = :league_id::uuid",
                {'league_id': league_id},
                database_name='leagues'
            )
            rows = result.get('numberOfRecordsUpdated', 0)
            total_rows += rows
            if rows > 0:
                print(f"  ✅ Cleaned {rows} rows from {table}")
        except Exception as e:
            print(f"  ⚠️  Could not clean {table}: {e}")
    
    # Delete phone book entries
    execute_sql(
        "DELETE FROM league_memberships WHERE league_id = :league_id::uuid",
        {'league_id': league_id},
        database_name='postgres'
    )
    execute_sql(
        "DELETE FROM user_leagues WHERE league_id = :league_id::uuid",
        {'league_id': league_id},
        database_name='postgres'
    )
    print(f"  ✅ Removed phone book entries")
    print(f"  📊 Total: {total_rows} rows deleted")

def main():
    KEEP_LEAGUES = ["Rey Made Me Do It"]
    
    print("🔍 Fetching all leagues...")
    all_leagues = get_all_leagues()
    
    if not all_leagues:
        print("❌ No leagues found!")
        return
    
    print(f"\n📋 Found {len(all_leagues)} total leagues:\n")
    
    # Separate keep vs delete
    to_keep = []
    to_delete = []
    
    for league in all_leagues:
        if league['league_name'] in KEEP_LEAGUES:
            to_keep.append(league)
        else:
            to_delete.append(league)
    
    # Show what will be kept
    print("✅ WILL KEEP:")
    if to_keep:
        for league in to_keep:
            print(f"  - {league['league_name']} ({league['league_id'][:8]}...) [{league['creation_status']}]")
    else:
        print("  (none)")
    
    # Show what will be deleted
    print(f"\n❌ WILL DELETE ({len(to_delete)} leagues):")
    if to_delete:
        for league in to_delete:
            print(f"  - {league['league_name']} ({league['league_id'][:8]}...) [{league['creation_status']}]")
    else:
        print("  (none)")
        return
    
    # Confirmation
    print("\n⚠️  WARNING: This is DESTRUCTIVE and PERMANENT!")
    response = input(f"\nType 'DELETE {len(to_delete)} LEAGUES' to confirm: ")
    
    if response != f"DELETE {len(to_delete)} LEAGUES":
        print("\n❌ Cancelled - nothing was deleted")
        return
    
    # Execute deletions
    print("\n🚀 Starting deletion process...\n")
    
    for league in to_delete:
        try:
            delete_league(league['league_id'], league['league_name'])
        except Exception as e:
            print(f"  ❌ ERROR deleting {league['league_name']}: {e}")
    
    print(f"\n✅ COMPLETE - Deleted {len(to_delete)} leagues")
    print(f"✅ Kept {len(to_keep)} leagues")

if __name__ == '__main__':
    main()
