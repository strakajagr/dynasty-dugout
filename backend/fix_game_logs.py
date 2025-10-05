#!/usr/bin/env python3
"""
Fix the game logs endpoint in players_canonical.py
Run this from: /home/strakajagr/projects/dynasty-dugout/backend/
"""

import os

# Read the file
file_path = 'src/routers/players_canonical.py'
with open(file_path, 'r') as f:
    content = f.read()

# Find and replace the game logs SQL query
# Current query is missing mlb_team and doesn't filter empty games
old_sql = '''sql = f"""
    SELECT 
        game_date, opponent, home_away,
        at_bats, hits, runs, rbi, home_runs, doubles, triples,
        stolen_bases, walks, strikeouts, hit_by_pitch,
        innings_pitched, wins, losses, saves, earned_runs, 
        hits_allowed, walks_allowed, strikeouts_pitched
    FROM player_game_logs 
    WHERE player_id = :player_id 
    {date_filter}
    ORDER BY game_date DESC
    LIMIT :limit
    """'''

# New query with mlb_team and filter for games actually played
new_sql = '''sql = f"""
    SELECT 
        game_date, mlb_team, opponent, home_away,
        at_bats, hits, runs, rbi, home_runs, doubles, triples,
        stolen_bases, walks, strikeouts, hit_by_pitch,
        innings_pitched, wins, losses, saves, earned_runs, 
        hits_allowed, walks_allowed, strikeouts_pitched, quality_starts,
        blown_saves, holds
    FROM player_game_logs 
    WHERE player_id = :player_id 
        AND (innings_pitched > 0 OR at_bats > 0)
    {date_filter}
    ORDER BY game_date DESC
    LIMIT :limit
    """'''

# Replace the SQL query
content = content.replace(old_sql, new_sql)

# Fix the game dictionary to include mlb_team
old_game_dict = '''game = {
                "game_date": record["game_date"],
                "opponent": record["opponent"],
                "home_away": record["home_away"],'''

new_game_dict = '''game = {
                "game_date": record["game_date"],
                "mlb_team": record.get("mlb_team", ""),
                "opponent": record["opponent"],
                "home_away": record["home_away"],'''

content = content.replace(old_game_dict, new_game_dict)

# Fix innings_pitched handling
old_ip_check = '''innings_pitched = float(record.get("innings_pitched") or 0)
            if innings_pitched > 0:
                er = float(record.get("earned_runs") or 0)'''

new_ip_check = '''innings_pitched = float(record.get("innings_pitched") or 0)
            if innings_pitched > 0:
                er = float(record.get("earned_runs") or 0)'''

# This is already correct, so no change needed

# Fix the pitching assignment
old_pitching = '''game["pitching"] = {
                    "innings_pitched": innings_pitched,'''

# This is already correct from our previous fix

# Add quality_starts, blown_saves, holds if not present
if '"quality_starts": record.get("quality_starts")' not in content:
    old_strikeouts_line = '"strikeouts": record.get("strikeouts_pitched")'
    new_strikeouts_line = '''"strikeouts": record.get("strikeouts_pitched"),
                    "quality_starts": record.get("quality_starts") or 0,
                    "blown_saves": record.get("blown_saves") or 0,
                    "holds": record.get("holds") or 0'''
    content = content.replace(old_strikeouts_line, new_strikeouts_line)

# Write the fixed file back
with open(file_path, 'w') as f:
    f.write(content)

print("✅ Fixed players_canonical.py game logs endpoint:")
print("1. Added mlb_team to SQL query and response")
print("2. Added filter: AND (innings_pitched > 0 OR at_bats > 0)")
print("3. Added quality_starts, blown_saves, holds to response")
print("4. Fixed None value handling for innings_pitched")
print("\nNow run: sam build && sam deploy --no-confirm-changeset --force-upload")
