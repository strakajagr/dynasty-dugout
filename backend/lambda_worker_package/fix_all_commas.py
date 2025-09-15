#!/usr/bin/env python3
"""Fix all missing commas in dictionary definitions"""

with open('master_daily_updater.py', 'r') as f:
    lines = f.readlines()

# Track if we're inside a dictionary
in_dict = 0
fixed_count = 0

for i in range(len(lines)):
    line = lines[i]
    stripped = line.strip()
    
    # Count braces to track dictionary depth
    in_dict += line.count('{') - line.count('}')
    
    # If we're inside a dictionary and this line doesn't end with a comma, brace, or comment
    if in_dict > 0 and i < len(lines) - 1:
        # Check if line needs a comma
        if (stripped and 
            not stripped.endswith(',') and 
            not stripped.endswith('{') and 
            not stripped.endswith('}') and
            not stripped.startswith('#') and
            not stripped.startswith('"""') and
            not stripped.endswith('"""')):
            
            # Check if next line suggests we need a comma
            next_line = lines[i + 1].strip()
            if (next_line and 
                (next_line.startswith("'") or 
                 next_line.startswith('"') or
                 next_line == '}' or
                 next_line == '},' or
                 next_line == '})' or
                 next_line.startswith('})') or
                 'sql' in next_line.lower())):
                
                # Add comma at end of line (preserve indentation)
                lines[i] = lines[i].rstrip() + ',\n'
                fixed_count += 1
                print(f"Fixed line {i+1}: {lines[i].strip()}")

print(f"\nTotal fixes: {fixed_count}")

# Write the fixed file
with open('master_daily_updater.py', 'w') as f:
    f.writelines(lines)

print("File updated successfully!")