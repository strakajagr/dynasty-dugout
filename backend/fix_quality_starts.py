#!/usr/bin/env python3
"""
Fix Quality Starts calculation in game logs
"""

# Read the players_canonical.py file
file_path = 'src/routers/players_canonical.py'
with open(file_path, 'r') as f:
    content = f.read()

# Find the section where we process pitching stats in game logs
# Add QS calculation after we get innings_pitched and earned_runs

# Find where we set quality_starts in the pitching dictionary
old_qs_line = '"quality_starts": record.get("quality_starts") or 0,'

# Replace with a calculation if the value is 0 or None
new_qs_line = '''# Calculate quality start if not in DB (6+ IP and <= 3 ER)
                    qs = record.get("quality_starts") or 0
                    if qs == 0 and innings_pitched >= 6.0 and er <= 3:
                        qs = 1
                    game["pitching"]["quality_starts"] = qs
                    # Continue with other stats'''

# More targeted replacement - find the exact section
if '"quality_starts": record.get("quality_starts") or 0,' in content:
    # Replace the line with calculated version
    lines = content.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        if '"quality_starts": record.get("quality_starts") or 0,' in line:
            indent = len(line) - len(line.lstrip())
            new_lines.append(' ' * indent + '# Calculate quality start (6+ IP and <= 3 ER)')
            new_lines.append(' ' * indent + 'qs = record.get("quality_starts") or 0')
            new_lines.append(' ' * indent + 'if qs == 0 and innings_pitched >= 6.0 and er <= 3:')
            new_lines.append(' ' * (indent + 4) + 'qs = 1')
            new_lines.append(' ' * indent + '"quality_starts": qs,')
        else:
            new_lines.append(line)
    content = '\n'.join(new_lines)
else:
    # Alternative: Add QS calculation in the pitching section
    # Find where we create the pitching dictionary
    pitching_section = 'game["pitching"] = {'
    if pitching_section in content:
        # Add QS calculation before the dictionary
        old_section = '''if innings_pitched > 0:
                er = float(record.get("earned_runs") or 0)
                hits_allowed = record.get("hits_allowed") or 0
                walks_allowed = record.get("walks_allowed") or 0
                
                game["pitching"] = {'''
        
        new_section = '''if innings_pitched > 0:
                er = float(record.get("earned_runs") or 0)
                hits_allowed = record.get("hits_allowed") or 0
                walks_allowed = record.get("walks_allowed") or 0
                
                # Calculate quality start (6+ IP and <= 3 ER)
                quality_starts = record.get("quality_starts") or 0
                if quality_starts == 0 and innings_pitched >= 6.0 and er <= 3:
                    quality_starts = 1
                
                game["pitching"] = {'''
        
        content = content.replace(old_section, new_section)
        
        # Then use the calculated value
        content = content.replace(
            '"quality_starts": record.get("quality_starts") or 0,',
            '"quality_starts": quality_starts,'
        )

# Write the fixed content back
with open(file_path, 'w') as f:
    f.write(content)

print("✅ Fixed Quality Starts calculation:")
print("1. QS is calculated as: 6+ innings pitched AND 3 or fewer earned runs")
print("2. Falls back to database value if it exists")
print("\nNow run: sam build && sam deploy --no-confirm-changeset --force-upload")

# Also check if QS exists in the database
print("\n📊 To check if quality_starts exists in DB, run:")
print('aws rds-data execute-statement \\')
print('  --resource-arn "arn:aws:rds:us-east-1:711655675495:cluster:fantasy-baseball-db-cluster" \\')
print('  --secret-arn "arn:aws:secretsmanager:us-east-1:711655675495:secret:fantasy-baseball-db-secret-Jeb4TO" \\')
print('  --database "postgres" \\')
print('  --sql "SELECT game_date, innings_pitched, earned_runs, quality_starts FROM player_game_logs WHERE player_id = 656605 AND innings_pitched >= 6 LIMIT 10"')
