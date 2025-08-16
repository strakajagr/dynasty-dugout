#!/usr/bin/env python3
"""
Dynasty Dugout - Complete League Cleanup (Python Version)
Deletes ALL leagues and their associated databases
"""

import boto3
import json
import sys
from typing import List, Dict, Any

# Configuration - UPDATED FOR YOUR ENVIRONMENT
CLUSTER_ARN = "arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball"
SECRET_ARN = "arn:aws:secretsmanager:us-east-1:584812014683:secret:rds!cluster-a4ca625a-7cb4-484a-8707-80f27e403c70-pwORGg"
MAIN_DATABASE = "postgres"
AWS_REGION = "us-east-1"

class LeagueCleanup:
    def __init__(self):
        self.rds_client = boto3.client('rds-data', region_name=AWS_REGION)
        
    def test_connection(self) -> bool:
        """Test if we can connect to the database"""
        print("🔍 Testing database connection...")
        try:
            response = self.rds_client.execute_statement(
                resourceArn=CLUSTER_ARN,
                secretArn=SECRET_ARN,
                database=MAIN_DATABASE,
                sql="SELECT 1;"
            )
            print("   ✅ Database connection successful")
            return True
        except Exception as e:
            print(f"   ❌ Database connection failed: {e}")
            print("")
            print("💡 Try these troubleshooting steps:")
            print("   1. Check if your AWS credentials are configured")
            print("   2. Verify the secret ARN is correct")
            print("   3. Ensure the RDS cluster is running")
            return False
    
    def execute_sql(self, database: str, sql: str, description: str = "") -> Dict[str, Any]:
        """Execute SQL using RDS Data API"""
        print(f"🔍 {description}")
        print(f"   SQL: {sql}")
        
        try:
            response = self.rds_client.execute_statement(
                resourceArn=CLUSTER_ARN,
                secretArn=SECRET_ARN,
                database=database,
                sql=sql
            )
            print("   ✅ Success")
            return response
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return {}
    
    def get_registered_leagues(self) -> List[Dict[str, str]]:
        """Get all registered leagues from main database"""
        print("🔍 Getting registered leagues...")
        
        try:
            response = self.rds_client.execute_statement(
                resourceArn=CLUSTER_ARN,
                secretArn=SECRET_ARN,
                database=MAIN_DATABASE,
                sql="SELECT league_id, league_name, database_name FROM user_leagues;"
            )
            
            leagues = []
            for record in response.get('records', []):
                leagues.append({
                    'league_id': record[0].get('stringValue', ''),
                    'league_name': record[1].get('stringValue', ''),
                    'database_name': record[2].get('stringValue', '')
                })
            
            print(f"   Found {len(leagues)} registered leagues")
            for league in leagues:
                print(f"   - {league['league_name']} ({league['database_name']})")
            
            return leagues
            
        except Exception as e:
            print(f"   ❌ Error getting leagues: {e}")
            return []
    
    def get_all_league_databases(self) -> List[str]:
        """Get all databases that start with 'league_'"""
        print("🔍 Getting all league databases...")
        
        try:
            response = self.rds_client.execute_statement(
                resourceArn=CLUSTER_ARN,
                secretArn=SECRET_ARN,
                database=MAIN_DATABASE,
                sql="SELECT datname FROM pg_database WHERE datname LIKE 'league_%';"
            )
            
            databases = []
            for record in response.get('records', []):
                db_name = record[0].get('stringValue', '')
                if db_name:
                    databases.append(db_name)
            
            print(f"   Found {len(databases)} league databases")
            for db in databases:
                print(f"   - {db}")
            
            return databases
            
        except Exception as e:
            print(f"   ❌ Error getting databases: {e}")
            return []
    
    def drop_database(self, database_name: str) -> bool:
        """Drop a specific database - ONLY league databases!"""
        # SAFETY CHECK: Only drop databases that start with "league_"
        if not database_name.startswith('league_'):
            print(f"   🔒 SAFETY: Refusing to drop non-league database: {database_name}")
            return False
            
        if database_name in ['postgres', 'template0', 'template1']:
            print(f"   🔒 SAFETY: Refusing to drop system database: {database_name}")
            return False
            
        try:
            self.rds_client.execute_statement(
                resourceArn=CLUSTER_ARN,
                secretArn=SECRET_ARN,
                database=MAIN_DATABASE,
                sql=f'DROP DATABASE IF EXISTS "{database_name}";'
            )
            print(f"   ✅ Dropped league database: {database_name}")
            return True
        except Exception as e:
            print(f"   ❌ Failed to drop {database_name}: {e}")
            return False
    
    def clear_registry_tables(self):
        """Clear the main database registry tables"""
        print("🧹 Clearing registry tables...")
        
        # Clear in proper order (foreign key constraints)
        self.execute_sql(
            MAIN_DATABASE,
            "DELETE FROM league_memberships;",
            "Clearing league memberships"
        )
        
        self.execute_sql(
            MAIN_DATABASE,
            "DELETE FROM user_leagues;",
            "Clearing league registry"
        )
    
    def verify_cleanup(self) -> Dict[str, Any]:
        """Verify that cleanup was successful"""
        print("🔍 Verifying cleanup...")
        
        # Check remaining league databases
        remaining_dbs = self.get_all_league_databases()
        
        # Check remaining registry entries
        try:
            response = self.rds_client.execute_statement(
                resourceArn=CLUSTER_ARN,
                secretArn=SECRET_ARN,
                database=MAIN_DATABASE,
                sql="SELECT COUNT(*) FROM user_leagues;"
            )
            remaining_leagues = response['records'][0][0].get('longValue', 0)
        except:
            remaining_leagues = -1
        
        return {
            'remaining_databases': remaining_dbs,
            'remaining_leagues': remaining_leagues
        }
    
    def run_cleanup(self):
        """Run the complete cleanup process"""
        print("🧹 Starting Dynasty Dugout League Cleanup...")
        print("⚠️  This will DELETE:")
        print("    - League databases (league_*)")
        print("    - League registry entries")
        print("🔒 This will PRESERVE:")
        print("    - Main postgres database")
        print("    - All MLB player data")
        print("    - All table structures")
        print(f"📍 Cluster: {CLUSTER_ARN}")
        print("")
        
        # Test connection first
        if not self.test_connection():
            print("❌ Cannot proceed without database connection")
            return
        
        print("")
        
        # Get current state
        print("=================== CURRENT STATE ===================")
        registered_leagues = self.get_registered_leagues()
        all_league_dbs = self.get_all_league_databases()
        print("")
        
        # Confirm deletion
        confirm = input("❓ Delete ONLY league databases and registry entries? (type 'YES' or 'Y' to confirm): ")
        if confirm.upper() not in ["YES", "Y"]:
            print("❌ Cleanup cancelled.")
            return
        
        print("")
        print("=================== STARTING CLEANUP ===================")
        
        # Step 1: Drop registered league databases
        dropped_count = 0
        if registered_leagues:
            print("🗑️  Step 1: Dropping registered league databases...")
            for league in registered_leagues:
                db_name = league['database_name']
                if self.drop_database(db_name):
                    dropped_count += 1
        
        # Step 2: Drop orphaned league databases
        print("")
        print("🔍 Step 2: Checking for orphaned league databases...")
        current_dbs = self.get_all_league_databases()
        
        if current_dbs:
            print("🗑️  Dropping orphaned databases...")
            for db_name in current_dbs:
                if self.drop_database(db_name):
                    dropped_count += 1
        
        # Step 3: Clear registry tables
        print("")
        self.clear_registry_tables()
        
        # Step 4: Verification
        print("")
        print("=================== VERIFICATION ===================")
        verification = self.verify_cleanup()
        
        remaining_dbs = verification['remaining_databases']
        remaining_leagues = verification['remaining_leagues']
        
        if not remaining_dbs:
            print("✅ All league databases successfully deleted")
        else:
            print("⚠️  Remaining league databases:")
            for db in remaining_dbs:
                print(f"   - {db}")
        
        print(f"📊 Remaining leagues in registry: {remaining_leagues}")
        
        # Final status
        print("")
        print("=================== CLEANUP COMPLETE ===================")
        if remaining_leagues == 0 and not remaining_dbs:
            print("🎉 SUCCESS: All leagues and databases cleaned up!")
            print("📋 Summary:")
            print(f"   ✅ League databases dropped: {dropped_count}")
            print("   ✅ Registry tables: Cleared")
            print("   ✅ Orphaned databases: Cleaned")
            print("")
            print("🚀 Ready for fresh league testing!")
        else:
            print("⚠️  WARNING: Some items remain - check output above")
        
        print("")
        print("💡 Next steps:")
        print("   1. Create a fresh test league")
        print("   2. Run your transaction tests")
        print("   3. Verify all endpoints work correctly")

if __name__ == "__main__":
    print("⚙️  Configuration:")
    print(f"   Cluster ARN: {CLUSTER_ARN}")
    print(f"   Secret ARN: {SECRET_ARN}")
    print(f"   Main Database: {MAIN_DATABASE}")
    print("")
    
    cleanup = LeagueCleanup()
    cleanup.run_cleanup()