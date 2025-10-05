#!/usr/bin/env python3
"""
Fix boolean value extraction for was_starter in game logs
RDS Data API returns {"booleanValue": true} not just true
"""

file_path = 'src/routers/players_canonical.py'

# Read the file
with open(file_path, 'r') as f:
    content = f.read()

# Fix the was_starter extraction to handle RDS Data API format
# Current: "games_started": 1 if record.get("was_starter") else 0,
# Need to extract the booleanValue from the dict

# Replace the simple get with proper extraction
old_pattern = '"games_started": 1 if record.get("was_starter") else 0,'
new_pattern = '"games_started": 1 if (record.get("was_starter", {}).get("booleanValue") if isinstance(record.get("was_starter"), dict) else record.get("was_starter")) else 0,'

content = content.replace(old_pattern, new_pattern)

# Also need to handle it when checking was_starter elsewhere
content = content.replace(
    '(1 if record.get("was_starter") else 0)',
    '(1 if (record.get("was_starter", {}).get("booleanValue") if isinstance(record.get("was_starter"), dict) else record.get("was_starter")) else 0)'
)

# Write back
with open(file_path, 'w') as f:
    f.write(content)

print("✅ Fixed was_starter boolean extraction:")
print("1. Now properly extracts booleanValue from RDS Data API response")
print("2. GS (Games Started) should now show 1 when was_starter is true")
print("\nDeploy: sam build && sam deploy --no-confirm-changeset --force-upload")
