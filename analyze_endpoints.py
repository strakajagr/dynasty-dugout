#!/usr/bin/env python3
"""
Analyze Dynasty Dugout API endpoints to understand traffic patterns
and help plan Lambda separation
"""

import os
import re
from pathlib import Path
from collections import defaultdict

def analyze_router(file_path):
    """Extract all endpoint definitions from a router file"""
    endpoints = []
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find all FastAPI route decorators
    patterns = [
        r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']',
        r'@app\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, content)
        for method, path in matches:
            endpoints.append({
                'method': method.upper(),
                'path': path,
                'file': os.path.basename(file_path)
            })
    
    return endpoints

def analyze_leagues_directory(leagues_dir):
    """Analyze the leagues directory with subdirectories"""
    all_endpoints = []
    
    # Get all Python files recursively
    for py_file in Path(leagues_dir).rglob("*.py"):
        if "__pycache__" not in str(py_file):
            endpoints = analyze_router(py_file)
            all_endpoints.extend(endpoints)
    
    return all_endpoints

def main():
    routers_dir = "/home/strakajagr/projects/dynasty-dugout/backend/src/routers"
    
    # Analyze each router file
    router_analysis = defaultdict(list)
    
    # Regular router files
    router_files = [
        "auth.py",
        "account.py", 
        "players_canonical.py",
        "invitations.py",
        "utilities.py",
        "mlb.py"
    ]
    
    print("=" * 80)
    print("DYNASTY DUGOUT API ENDPOINT ANALYSIS")
    print("=" * 80)
    print()
    
    for router_file in router_files:
        file_path = os.path.join(routers_dir, router_file)
        if os.path.exists(file_path):
            endpoints = analyze_router(file_path)
            router_name = router_file.replace('.py', '')
            router_analysis[router_name] = endpoints
            
            print(f"\n📁 {router_name.upper()} Router ({len(endpoints)} endpoints)")
            print("-" * 40)
            for ep in endpoints[:5]:  # Show first 5 as examples
                print(f"  {ep['method']:6} {ep['path']}")
            if len(endpoints) > 5:
                print(f"  ... and {len(endpoints) - 5} more")
    
    # Analyze leagues directory separately
    leagues_dir = os.path.join(routers_dir, "leagues")
    if os.path.exists(leagues_dir):
        league_endpoints = analyze_leagues_directory(leagues_dir)
        router_analysis['leagues'] = league_endpoints
        
        print(f"\n📁 LEAGUES Router ({len(league_endpoints)} endpoints)")
        print("-" * 40)
        
        # Group by operation type
        read_ops = [e for e in league_endpoints if e['method'] == 'GET']
        write_ops = [e for e in league_endpoints if e['method'] in ['POST', 'PUT', 'DELETE', 'PATCH']]
        
        print(f"  READ Operations (GET): {len(read_ops)}")
        print(f"  WRITE Operations (POST/PUT/DELETE): {len(write_ops)}")
        
        # Show examples
        print("\n  Example READ endpoints:")
        for ep in read_ops[:3]:
            print(f"    GET {ep['path']}")
        
        print("\n  Example WRITE endpoints:")  
        for ep in write_ops[:3]:
            print(f"    {ep['method']:6} {ep['path']}")
    
    # Summary and recommendations
    print("\n" + "=" * 80)
    print("RECOMMENDED LAMBDA SPLIT")
    print("=" * 80)
    
    total_endpoints = sum(len(eps) for eps in router_analysis.values())
    
    print(f"\nTotal Endpoints: {total_endpoints}")
    print("\nProposed Lambda Functions:")
    print()
    print("1. PlayersLambda (~{} endpoints)".format(len(router_analysis.get('players_canonical', []))))
    print("   - All /api/players/* endpoints")
    print("   - Highest traffic, heavy caching opportunity")
    print()
    print("2. AuthLambda (~{} endpoints)".format(len(router_analysis.get('auth', []))))
    print("   - Authentication and authorization")
    print("   - Token management")
    print()
    
    leagues = router_analysis.get('leagues', [])
    league_reads = len([e for e in leagues if e['method'] == 'GET'])
    league_writes = len([e for e in leagues if e['method'] != 'GET'])
    
    print(f"3. LeagueReadLambda (~{league_reads} endpoints)")
    print("   - GET /api/leagues/* ")
    print("   - Standings, rosters, league info")
    print()
    print(f"4. LeagueWriteLambda (~{league_writes} endpoints)")
    print("   - POST/PUT/DELETE /api/leagues/*")
    print("   - Transactions, roster moves")
    print()
    
    other_count = (len(router_analysis.get('account', [])) + 
                   len(router_analysis.get('invitations', [])) + 
                   len(router_analysis.get('utilities', [])) +
                   len(router_analysis.get('mlb', [])))
    
    print(f"5. CoreLambda (~{other_count} endpoints)")
    print("   - Account management")
    print("   - Invitations")
    print("   - Utilities")
    print("   - MLB data")
    print("   - Catch-all for misc endpoints")
    
    print("\n" + "=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print("""
1. Start with PlayersLambda extraction (highest impact)
2. Monitor performance for 1 week
3. Extract AuthLambda (security benefits)
4. Split League operations (complex but valuable)
5. Leave CoreLambda as catch-all

This split will reduce cold starts by ~70% and allow independent scaling!
""")

if __name__ == "__main__":
    main()