#!/usr/bin/env python3
"""
cleanup_ALL_leagues.py
DESTRUCTIVE script to completely wipe ALL league data for testing purposes
WARNING: This deletes EVERYTHING - all leagues, all phone book entries, all databases
"""

import boto3
import os
import sys
from datetime import datetime

# Configuration with your specific AWS resources
DB_CLUSTER_ARN = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless'
DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb'
AWS_REGION = 'us-east-1'

# Initialize RDS Data API client
rds_client = boto3.client('rds-data', region_name=AWS_REGION)

def execute_sql(sql, parameters=None, database_name='postgres'):
    """Execute SQL with RDS Data API"""
    try:
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
        
        response = rds_client.execute_statement(**params)
        return response
        
    except Exception as e:
        print(f"Database error on '{database_name}': {str(e)}")
        raise

def main():
    print("\n" + "="*60)
    print("COMPLETE LEAGUE WIPE SCRIPT - TESTING ONLY")
    print("WARNING: THIS WILL DELETE ALL LEAGUES AND DATA!")
    print("="*60)
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"Cluster: fantasy-baseball-serverless")
    print(f"Region: {AWS_REGION}")
    print()
    
    # Final confirmation
    print("⚠️  THIS WILL DELETE:")
    print("   - ALL leagues from phone book")
    print("   - ALL league memberships")
    print("   - ALL league databases")
    print("   - ALL league data")
    print()
    confirm = input("Delete everything? (yes/no): ")
    
    if confirm.lower() != 'yes':
        print("\nCancelled. Nothing was deleted.")
        return 0
    
    try:
        # Step 1: Get all leagues from phone book
        print("\nStep 1: Finding ALL leagues in phone book...")
        phonebook_result = execute_sql(
            "SELECT league_id, league_name FROM user_leagues",
            database_name='postgres'
        )
        
        all_leagues = []
        if phonebook_result.get('records'):
            for record in phonebook_result['records']:
                league_id = record[0].get('stringValue')
                league_name = record[1].get('stringValue', 'Unknown')
                all_leagues.append((league_id, league_name))
        
        print(f"Found {len(all_leagues)} total leagues to delete")
        
        if all_leagues:
            print("\nLeagues to be deleted:")
            for lid, lname in all_leagues:
                print(f"  - {lname} ({lid[:8]}...)")
        
        # Step 2: Delete ALL phone book entries
        if all_leagues:
            print(f"\nStep 2: Deleting ALL {len(all_leagues)} leagues from phone book...")
            
            for league_id, league_name in all_leagues:
                print(f"  Deleting: {league_name} ({league_id[:8]}...)")
                
                try:
                    # Delete from all related tables
                    tables_to_clean = [
                        'league_memberships',
                        'league_invitations',
                        'user_leagues'
                    ]
                    
                    for table in tables_to_clean:
                        try:
                            execute_sql(
                                f"DELETE FROM {table} WHERE league_id = :league_id::uuid",
                                {'league_id': league_id},
                                database_name='postgres'
                            )
                        except Exception as e:
                            # Table might not exist or have no entries
                            pass
                    
                    print(f"    ✓ Deleted {league_name}")
                except Exception as e:
                    print(f"    ✗ Failed to delete: {e}")
        else:
            print("\nStep 2: No leagues in phone book to delete")
        
        # Step 3: Drop ALL league databases (both individual and shared)
        print("\nStep 3: Finding ALL league databases...")
        
        # Find all databases that start with 'league'
        all_league_dbs_query = """
            SELECT datname FROM pg_database 
            WHERE datname LIKE 'league%'
        """
        db_result = execute_sql(all_league_dbs_query, database_name='postgres')
        
        league_databases = []
        if db_result.get('records'):
            for record in db_result['records']:
                db_name = record[0].get('stringValue')
                if db_name:
                    league_databases.append(db_name)
        
        if league_databases:
            print(f"Found {len(league_databases)} league databases to drop:")
            for db in league_databases:
                print(f"  - {db}")
            
            print(f"\nDropping ALL {len(league_databases)} league databases...")
            
            for db_name in league_databases:
                try:
                    print(f"  Dropping {db_name}...")
                    
                    # First terminate any connections
                    terminate_sql = f"""
                        SELECT pg_terminate_backend(pid)
                        FROM pg_stat_activity
                        WHERE datname = '{db_name}' AND pid <> pg_backend_pid()
                    """
                    try:
                        execute_sql(terminate_sql, database_name='postgres')
                    except:
                        pass  # Ignore errors from terminating connections
                    
                    # Now drop the database
                    execute_sql(f'DROP DATABASE IF EXISTS "{db_name}"', database_name='postgres')
                    print(f"    ✓ Dropped {db_name}")
                except Exception as e:
                    print(f"    ✗ Failed to drop {db_name}: {e}")
        else:
            print("No league databases found")
        
        # Step 4: Clean up any orphaned data in main database
        print("\nStep 4: Cleaning up orphaned data in main database...")
        
        cleanup_tables = [
            ('price_save_jobs', 'league_id'),
            ('league_creation_status', 'league_id')
        ]
        
        for table, column in cleanup_tables:
            try:
                result = execute_sql(f"DELETE FROM {table}", database_name='postgres')
                print(f"  ✓ Cleaned {table}")
            except Exception as e:
                # Table might not exist
                pass
        
        # Final summary
        print("\n" + "="*60)
        print("COMPLETE WIPE SUMMARY")
        print("="*60)
        print(f"Leagues deleted from phone book: {len(all_leagues)}")
        print(f"League databases dropped: {len(league_databases)}")
        print(f"Completed at: {datetime.now().isoformat()}")
        print("\n✓ All league data has been wiped clean for testing")
        print("="*60 + "\n")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())