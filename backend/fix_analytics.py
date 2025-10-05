#!/usr/bin/env python3
"""
Fix type comparison errors in PlayerAnalytics
"""

# Find analytics.py file
import os
import glob

# Search for the analytics file
possible_paths = [
    'src/routers/leagues/players/analytics.py',
    'src/routers/analytics.py',
    'src/core/analytics.py'
]

analytics_file = None
for path in possible_paths:
    if os.path.exists(path):
        analytics_file = path
        print(f"Found analytics file at: {path}")
        break

if not analytics_file:
    # Try to find it
    for root, dirs, files in os.walk('src'):
        if 'analytics.py' in files:
            analytics_file = os.path.join(root, 'analytics.py')
            print(f"Found analytics file at: {analytics_file}")
            break

if not analytics_file:
    print("❌ Could not find analytics.py file")
    print("Please locate the PlayerAnalytics class file")
    exit(1)

# Read the file
with open(analytics_file, 'r') as f:
    content = f.read()

# Fix common type comparison issues
replacements = [
    # Fix comparisons where database values might be strings
    ('if games > 0:', 'if int(games or 0) > 0:'),
    ('if innings > 0:', 'if float(innings or 0) > 0:'),
    ('if innings_pitched > 0:', 'if float(innings_pitched or 0) > 0:'),
    ('if at_bats > 0:', 'if int(at_bats or 0) > 0:'),
    ('if earned_runs > 0:', 'if float(earned_runs or 0) > 0:'),
    ('if walks > 0:', 'if int(walks or 0) > 0:'),
    ('if hits > 0:', 'if int(hits or 0) > 0:'),
    
    # Fix record value extraction
    ('record.get("games")', 'int(record.get("games") or 0)'),
    ('record.get("innings_pitched")', 'float(record.get("innings_pitched") or 0)'),
    ('record.get("earned_runs")', 'float(record.get("earned_runs") or 0)'),
    ('record.get("at_bats")', 'int(record.get("at_bats") or 0)'),
    ('record.get("hits")', 'int(record.get("hits") or 0)'),
    ('record.get("walks")', 'int(record.get("walks") or 0)'),
    ('record.get("strikeouts")', 'int(record.get("strikeouts") or 0)'),
    ('record.get("wins")', 'int(record.get("wins") or 0)'),
    ('record.get("losses")', 'int(record.get("losses") or 0)'),
    ('record.get("saves")', 'int(record.get("saves") or 0)'),
    ('record.get("quality_starts")', 'int(record.get("quality_starts") or 0)'),
]

# Apply replacements
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        print(f"✓ Fixed: {old} → {new}")

# Also add a safe conversion function at the top of the class if not present
if 'def safe_float(' not in content and 'def safe_int(' not in content:
    # Find the class definition
    class_start = content.find('class PlayerAnalytics')
    if class_start != -1:
        # Find the first method
        first_def = content.find('def ', class_start)
        if first_def != -1:
            # Insert helper methods
            helpers = '''
    @staticmethod
    def safe_int(value, default=0):
        """Safely convert a value to integer"""
        if value is None:
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def safe_float(value, default=0.0):
        """Safely convert a value to float"""
        if value is None:
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    
'''
            content = content[:first_def] + helpers + content[first_def:]
            print("✓ Added safe conversion helper methods")

# Write the fixed file back
with open(analytics_file, 'w') as f:
    f.write(content)

print(f"\n✅ Fixed {analytics_file}")
print("Type comparisons should now handle None and string values correctly")
print("\nNow run: sam build && sam deploy --no-confirm-changeset --force-upload")
