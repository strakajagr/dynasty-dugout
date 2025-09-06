from backend.src.database import execute_sql

schema_query = """
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'league_teams'
    ORDER BY ordinal_position
"""
result = execute_sql(schema_query, database_name='leagues')
if result and result.get("records"):
    print("Columns in league_teams:")
    for record in result["records"]:
        print(f"  - {record[0].get('stringValue')}")
else:
    print("No results or table not found")
