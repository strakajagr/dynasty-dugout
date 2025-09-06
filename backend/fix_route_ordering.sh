#!/bin/bash

# Fix for global_stats.py route ordering issue
# The /search route must come BEFORE /{player_id} route

echo "Fixing route ordering in global_stats.py..."

# Create a backup
cp src/routers/leagues/players/global_stats.py src/routers/leagues/players/global_stats.py.backup

# Use a Python script to reorder the routes properly
cat > /tmp/fix_routes.py << 'EOF'
import re

# Read the file
with open('src/routers/leagues/players/global_stats.py', 'r') as f:
    content = f.read()

# Find all route definitions and their functions
route_pattern = r'(@router\.get\([^)]+\)[^@]*?)(?=@router\.get|$)'
routes = re.findall(route_pattern, content, re.DOTALL)

# Separate routes into categories
search_route = None
player_id_route = None
other_routes = []

for route in routes:
    if '/search' in route:
        search_route = route
    elif '"/{player_id}"' in route and '/career-stats' not in route and '/complete' not in route and '/analytics' not in route:
        player_id_route = route
    else:
        other_routes.append(route)

# Find the imports and everything before the first route
first_route_pos = content.find('@router.get')
header = content[:first_route_pos]

# Rebuild the file with correct ordering
new_content = header

# Add /search route FIRST (before /{player_id})
if search_route:
    new_content += search_route

# Add /{player_id} route after /search
if player_id_route:
    new_content += player_id_route

# Add all other routes
for route in other_routes:
    new_content += route

# Write the fixed file
with open('src/routers/leagues/players/global_stats.py', 'w') as f:
    f.write(new_content)

print("Routes reordered successfully!")
EOF

python3 /tmp/fix_routes.py

echo "Route ordering fixed!"
echo ""
echo "The /search route now comes before /{player_id} to prevent matching issues."
echo "Backup saved as global_stats.py.backup"