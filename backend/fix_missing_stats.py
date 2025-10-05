#!/usr/bin/env python3
"""
Fix missing fields in game logs response
Adds quality_starts, games_started, blown_saves, holds, whip to the pitching object
"""

file_path = 'src/routers/players_canonical.py'

# Read the file
with open(file_path, 'r') as f:
    content = f.read()

# Find the pitching dictionary creation and ensure all fields are included
# Look for where we create game["pitching"] = {

# Find the line with "strikeouts": record.get("strikeouts_pitched")
old_pitching_end = '''"strikeouts": record.get("strikeouts_pitched") or 0,
                    "era": round((earned_runs * 9) / innings_pitched, 2) if innings_pitched > 0 else 0'''

new_pitching_end = '''"strikeouts": record.get("strikeouts_pitched") or 0,
                    "quality_starts": record.get("quality_starts") or 0,
                    "games_started": 1 if innings_pitched >= 5.0 else 0,  # Assume starter if 5+ IP
                    "blown_saves": record.get("blown_saves") or 0,
                    "holds": record.get("holds") or 0,
                    "era": round((earned_runs * 9) / innings_pitched, 2) if innings_pitched > 0 else 0'''

content = content.replace(old_pitching_end, new_pitching_end)

# Also add whip calculation after era
old_era_line = '"era": round((earned_runs * 9) / innings_pitched, 2) if innings_pitched > 0 else 0'
if 'game["pitching"]["whip"]' not in content:
    # Add WHIP calculation right after creating the pitching dictionary
    lines = content.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        new_lines.append(line)
        if '"era": round((earned_runs * 9) / innings_pitched, 2)' in line and 'game["pitching"]' not in line:
            # This is inside the pitching dictionary, add whip after it
            indent = len(line) - len(line.lstrip())
            new_lines.append(' ' * indent + '}')
            new_lines.append(' ' * (indent - 16) + '# Add WHIP calculation')
            new_lines.append(' ' * (indent - 16) + 'if innings_pitched > 0:')
            new_lines.append(' ' * (indent - 12) + 'game["pitching"]["whip"] = round((hits_allowed + walks_allowed) / innings_pitched, 3)')
    content = '\n'.join(new_lines)

# Write the fixed file back
with open(file_path, 'w') as f:
    f.write(content)

print("✅ Fixed game logs to include all pitching fields:")
print("- quality_starts (from DB)")
print("- games_started (calculated as 1 if IP >= 5)")
print("- blown_saves (from DB)") 
print("- holds (from DB)")
print("- whip (calculated)")
print("\nNow run: sam build && sam deploy --no-confirm-changeset --force-upload")
