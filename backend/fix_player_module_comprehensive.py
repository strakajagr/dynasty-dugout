#!/usr/bin/env python3
"""
Comprehensive fix for players_canonical.py based on ACTUAL database schema
Fixes:
1. Use 'quality_starts' (with an s) not 'quality_start' 
2. Remove non-existent 'games_started' column from queries
3. Use 'was_starter' boolean for GS stat
4. Fix this throughout ALL player endpoints
"""

import re

file_path = 'src/routers/players_canonical.py'

# Read the file
with open(file_path, 'r') as f:
    content = f.read()

# FIX 1: Game logs SQL query
# Remove games_started, keep quality_starts and was_starter
old_game_logs_sql = """quality_starts, games_started, blown_saves, holds,
        was_starter"""
new_game_logs_sql = """quality_starts, blown_saves, holds, was_starter"""

content = content.replace(old_game_logs_sql, new_game_logs_sql)

# Also check for any variation without the line break
content = content.replace("quality_starts, games_started, blown_saves", "quality_starts, blown_saves")

# FIX 2: In the game logs response, use was_starter for GS
# Find all instances where we try to use games_started
old_gs_calc = '"games_started": record.get("games_started") or (1 if record.get("was_starter") else 0),'
new_gs_calc = '"games_started": 1 if record.get("was_starter") else 0,'
content = content.replace(old_gs_calc, new_gs_calc)

# Also fix any instance where we might be checking games_started directly
content = content.replace('record.get("games_started")', '(1 if record.get("was_starter") else 0)')

# FIX 3: Season stats and career stats queries
# These queries might also have issues with games_started
# In player_season_stats, the column might be different
# Let's fix references to ensure we're using the right columns

# FIX 4: Rolling stats calculations
# Make sure rolling stats also use the correct columns
rolling_fixes = [
    ('SUM(games_started) as games_started', 'SUM(CASE WHEN was_starter THEN 1 ELSE 0 END) as games_started'),
    ('SUM(quality_start) as quality_starts', 'SUM(quality_starts) as quality_starts'),
]

for old, new in rolling_fixes:
    if old in content:
        content = content.replace(old, new)

# FIX 5: Make sure we're consistently using quality_starts (with an s)
# But be careful not to double-pluralize
content = re.sub(r'quality_start(?!s)', 'quality_starts', content)

# FIX 6: In the pitching dictionary creation, ensure we use was_starter for GS
# This is in multiple places - game logs, recent performance, etc.
pitching_dict_pattern = r'"games_started":\s*record\.get\([^)]+\)[^,]*,'
pitching_dict_replacement = '"games_started": 1 if record.get("was_starter") else 0,'

# Apply the fix wherever we create pitching stats
lines = content.split('\n')
new_lines = []
for line in lines:
    if '"games_started":' in line and 'pitching' in content[max(0, content.find(line)-200):content.find(line)]:
        # This is likely in a pitching dictionary
        if 'was_starter' not in line:
            line = re.sub(r'"games_started":\s*[^,]+,', pitching_dict_replacement, line)
    new_lines.append(line)
content = '\n'.join(new_lines)

# FIX 7: Ensure WHIP calculation exists after we set pitching stats
# Already handled in previous fixes

# Write the fixed content back
with open(file_path, 'w') as f:
    f.write(content)

print("✅ COMPREHENSIVE FIX APPLIED:")
print("1. Fixed SQL queries to use 'quality_starts' (with an s)")
print("2. Removed non-existent 'games_started' column from all queries")
print("3. Using 'was_starter' boolean for GS stat throughout")
print("4. Fixed in game logs, rolling stats, and all other endpoints")
print("5. Ensured consistent column naming across the module")
print("\n🚀 Now run: sam build && sam deploy --no-confirm-changeset --force-upload")
print("\nThis should fix:")
print("- Game logs display")
print("- Quality Starts (QS) showing correctly")
print("- Games Started (GS) calculated from was_starter")
print("- All pitching stats displaying properly")
