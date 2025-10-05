#!/usr/bin/env python3
"""
Complete fix for game logs - ensures all fields are retrieved and returned
"""

file_path = 'src/routers/players_canonical.py'

# Read the current file
with open(file_path, 'r') as f:
    lines = f.readlines()

# Find the game logs function
in_game_logs = False
fixed_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Find the game logs endpoint
    if '@router.get("/{player_id}/game-logs")' in line:
        in_game_logs = True
    
    # Fix the SQL query to include ALL fields
    if in_game_logs and 'sql = f"""' in line:
        fixed_lines.append(line)
        i += 1
        # Skip old query and insert complete query
        while i < len(lines) and '"""' not in lines[i]:
            i += 1
        
        # Insert the complete SQL query with ALL fields
        query = '''    SELECT 
        game_date, mlb_team, opponent, home_away,
        -- Batting stats
        at_bats, hits, runs, rbi, home_runs, doubles, triples,
        stolen_bases, walks, strikeouts, hit_by_pitch,
        -- Pitching stats
        innings_pitched, wins, losses, saves, earned_runs, 
        hits_allowed, walks_allowed, strikeouts_pitched,
        quality_starts, games_started, blown_saves, holds,
        was_starter
    FROM player_game_logs 
    WHERE player_id = :player_id 
        AND (innings_pitched > 0 OR at_bats > 0)
    {date_filter}
    ORDER BY game_date DESC
    LIMIT :limit
'''
        fixed_lines.append(query)
        fixed_lines.append('    """\n')
        i += 1
        continue
    
    # Fix the game dictionary to include mlb_team
    if in_game_logs and '"game_date": record["game_date"],' in line:
        fixed_lines.append(line)
        # Add mlb_team if not already there
        if i+1 < len(lines) and '"mlb_team"' not in lines[i+1]:
            indent = len(line) - len(line.lstrip())
            fixed_lines.append(' ' * indent + '"mlb_team": record.get("mlb_team", ""),\n')
        i += 1
        continue
    
    # Fix the pitching dictionary to include ALL fields
    if in_game_logs and 'game["pitching"] = {' in line:
        fixed_lines.append(line)
        i += 1
        # Skip old pitching dict and create complete one
        brace_count = 1
        while i < len(lines) and brace_count > 0:
            if '{' in lines[i]:
                brace_count += 1
            if '}' in lines[i]:
                brace_count -= 1
            if brace_count > 0:
                i += 1
        
        # Insert complete pitching dictionary
        pitching_dict = '''                game["pitching"] = {
                    "innings_pitched": innings_pitched,
                    "wins": record.get("wins") or 0,
                    "losses": record.get("losses") or 0,
                    "saves": record.get("saves") or 0,
                    "earned_runs": int(er),
                    "hits_allowed": hits_allowed,
                    "walks_allowed": walks_allowed,
                    "strikeouts": record.get("strikeouts_pitched") or 0,
                    "quality_starts": record.get("quality_starts") or 0,
                    "games_started": record.get("games_started") or (1 if record.get("was_starter") else 0),
                    "blown_saves": record.get("blown_saves") or 0,
                    "holds": record.get("holds") or 0,
                    "era": round((er * 9) / innings_pitched, 2) if innings_pitched > 0 else 0,
                    "whip": round((hits_allowed + walks_allowed) / innings_pitched, 3) if innings_pitched > 0 else 0
                }
'''
        fixed_lines.append(pitching_dict)
        continue
    
    # End of game logs function
    if in_game_logs and 'def ' in line and 'get_player_game_logs' not in line:
        in_game_logs = False
    
    fixed_lines.append(line)
    i += 1

# Write the fixed content
with open(file_path, 'w') as f:
    f.writelines(fixed_lines)

print("✅ Complete fix for game logs applied:")
print("1. SQL query includes: quality_starts, games_started, blown_saves, holds, was_starter")
print("2. Response includes all fields in pitching object")
print("3. WHIP is calculated from hits_allowed + walks_allowed")
print("4. games_started uses DB field or falls back to was_starter flag")
print("\nNow run: sam build && sam deploy --no-confirm-changeset --force-upload")
