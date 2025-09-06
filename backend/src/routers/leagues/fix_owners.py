import sys

with open('owners.py', 'r') as f:
    lines = f.readlines()

# Find the setup_team function and add logging
new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    # Add logging after the DEBUG line that's already there
    if "DEBUG: About to save logo URL:" in line:
        # Look ahead to find the execute_sql call
        if i + 1 < len(lines) and "execute_sql(update_sql" in lines[i + 1]:
            new_lines.append('        update_result = ')
            # Skip the original execute_sql line start
            continue

with open('owners.py', 'w') as f:
    f.writelines(new_lines)
