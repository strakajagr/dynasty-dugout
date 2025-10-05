#!/usr/bin/env python3
"""
Dynasty Dugout - Watch List Verification Script
Tests database table and API endpoints
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from core.database import execute_sql

def verify_watchlist_table():
    """Verify the user_watchlist table exists and has correct structure"""
    print("=" * 70)
    print("WATCH LIST TABLE VERIFICATION")
    print("=" * 70)
    
    try:
        # Check if table exists
        result = execute_sql(
            """
            SELECT EXISTS (
                SELECT FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename = 'user_watchlist'
            ) as table_exists
            """,
            {},
            database_name='postgres'
        )
        
        table_exists = result['records'][0]['table_exists'] if result.get('records') else False
        
        if table_exists:
            print("✅ Table 'user_watchlist' EXISTS\n")
            
            # Get table structure
            structure = execute_sql(
                """
                SELECT 
                    column_name, 
                    data_type, 
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_name = 'user_watchlist' 
                ORDER BY ordinal_position
                """,
                {},
                database_name='postgres'
            )
            
            print("TABLE STRUCTURE:")
            print("-" * 70)
            for col in structure.get('records', []):
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                default = f"DEFAULT {col['column_default']}" if col['column_default'] else ""
                print(f"  {col['column_name']:<20} {col['data_type']:<20} {nullable:<10} {default}")
            
            # Get indexes
            indexes = execute_sql(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'user_watchlist'
                ORDER BY indexname
                """,
                {},
                database_name='postgres'
            )
            
            print("\nINDEXES:")
            print("-" * 70)
            for idx in indexes.get('records', []):
                print(f"  {idx['indexname']}")
            
            # Get row count
            count = execute_sql(
                "SELECT COUNT(*) as count FROM user_watchlist",
                {},
                database_name='postgres'
            )
            
            total = count['records'][0]['count'] if count.get('records') else 0
            print(f"\nCURRENT ROW COUNT: {total}")
            
            # If there are records, show a sample
            if total > 0:
                sample = execute_sql(
                    """
                    SELECT 
                        w.watch_id,
                        w.user_id,
                        w.player_id,
                        w.added_at,
                        w.priority,
                        p.first_name,
                        p.last_name,
                        p.position
                    FROM user_watchlist w
                    JOIN mlb_players p ON w.player_id = p.player_id
                    LIMIT 5
                    """,
                    {},
                    database_name='postgres'
                )
                
                print("\nSAMPLE RECORDS (first 5):")
                print("-" * 70)
                for rec in sample.get('records', []):
                    user_short = rec['user_id'][:8] + "..."
                    print(f"  {user_short} watching {rec['first_name']} {rec['last_name']} ({rec['position']}) - Priority: {rec['priority']}")
            
            print("\n" + "=" * 70)
            print("✅ WATCH LIST TABLE VERIFICATION COMPLETE")
            print("=" * 70)
            return True
            
        else:
            print("❌ Table 'user_watchlist' DOES NOT EXIST")
            print("\nTo create the table, run:")
            print("  psql -h <your-db-endpoint> -U postgres -d postgres -f create_watchlist_table.sql")
            print("\nOr use AWS RDS Data API to execute the SQL in create_watchlist_table.sql")
            print("=" * 70)
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def check_related_tables():
    """Check that related tables exist"""
    print("\nRELATED TABLES CHECK:")
    print("-" * 70)
    
    tables_to_check = ['mlb_players', 'user_leagues', 'league_memberships']
    
    for table in tables_to_check:
        try:
            result = execute_sql(
                f"""
                SELECT EXISTS (
                    SELECT FROM pg_tables 
                    WHERE schemaname = 'public' 
                    AND tablename = '{table}'
                ) as exists
                """,
                {},
                database_name='postgres'
            )
            exists = result['records'][0]['exists'] if result.get('records') else False
            status = "✅" if exists else "❌"
            print(f"  {status} {table}")
        except Exception as e:
            print(f"  ❌ {table} - Error: {str(e)}")

if __name__ == '__main__':
    print("\n")
    table_ok = verify_watchlist_table()
    print("\n")
    check_related_tables()
    print("\n")
    
    if table_ok:
        print("🎉 Watch List is ready to use!")
        print("\nNext steps:")
        print("  1. Deploy your backend if you haven't already")
        print("  2. Navigate to /watch-list in your frontend")
        print("  3. Click the star icon on any player to add them to your watch list")
    else:
        print("⚠️  Please create the user_watchlist table before using the feature")
        print("   Run: create_watchlist_table.sql")
