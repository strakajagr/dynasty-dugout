import sys
import os
sys.path.append('/home/strakajagr/fantasy-baseball-central-clean')

from backend.src.database import execute_sql

# Check leagues database for league_teams columns
print("=== LEAGUES DATABASE - league_teams table ===")
query1 = """
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'league_teams' 
    ORDER BY ordinal_position
"""
result1 = execute_sql(query1, database_name='leagues')
if result1 and result1.get("records"):
    for record in result1["records"]:
        print(f"  {record[0].get('stringValue')}: {record[1].get('stringValue')}")

# Check main database for phone_book or similar tables
print("\n=== MAIN DATABASE - Check for phone_book table ===")
query2 = """
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%phone%' OR table_name LIKE '%owner%' OR table_name LIKE '%user%'
    ORDER BY table_name
"""
result2 = execute_sql(query2, database_name='postgres')
if result2 and result2.get("records"):
    for record in result2["records"]:
        print(f"  Found table: {record[0].get('stringValue')}")

# If phone_book exists, show its columns
print("\n=== Checking phone_book columns ===")
query3 = """
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'phone_book' 
    ORDER BY ordinal_position
"""
result3 = execute_sql(query3, database_name='postgres')
if result3 and result3.get("records"):
    for record in result3["records"]:
        print(f"  {record[0].get('stringValue')}: {record[1].get('stringValue')}")
