#!/usr/bin/env python3
"""
Fix global_stats.py by replacing old helper functions with dictionary access
"""
import re

# Read the file
file_path = '/home/strakajagr/projects/dynasty-dugout/backend/src/routers/leagues/players/global_stats.py'

with open(file_path, 'r') as f:
    content = f.read()

# Replace all occurrences
replacements = [
    # Replace function calls with dictionary access
    (r'get_long_value\(record\[(\d+)\]\)', r"record.get('field_\1', 0)"),
    (r'get_decimal_value\(record\[(\d+)\]\)', r"record.get('field_\1', 0.0)"),
    (r'get_string_value\(record\[(\d+)\]\)', r"record.get('field_\1', '')"),
    (r'get_boolean_value\(record\[(\d+)\]\)', r"record.get('field_\1', False)"),
]

# For now, just use array indexing since that's what RDS returns
replacements = [
    (r'get_long_value\(record\[(\d+)\]\)', r"(record[\1] if isinstance(record, list) else record.get(list(record.keys())[\1] if record else None, 0))"),
    (r'get_decimal_value\(record\[(\d+)\]\)', r"(record[\1] if isinstance(record, list) else record.get(list(record.keys())[\1] if record else None, 0.0))"),
    (r'get_string_value\(record\[(\d+)\]\)', r"(record[\1] if isinstance(record, list) else record.get(list(record.keys())[\1] if record else None, ''))"),
    (r'get_boolean_value\(record\[(\d+)\]\)', r"(record[\1] if isinstance(record, list) else record.get(list(record.keys())[\1] if record else None, False))"),
]

# Actually, the simplest fix is to add the helper functions back to the file itself!
# Add helper functions at the top of the file after imports
helper_functions = '''
# Temporary helper functions until we refactor to dictionary access
def get_long_value(val):
    """Get long/int value from record field"""
    if val is None:
        return 0
    if isinstance(val, dict):
        if 'longValue' in val:
            return val['longValue']
        elif 'isNull' in val and val['isNull']:
            return 0
    return int(val) if val else 0

def get_decimal_value(val):
    """Get decimal/float value from record field"""
    if val is None:
        return 0.0
    if isinstance(val, dict):
        if 'doubleValue' in val:
            return val['doubleValue']
        elif 'isNull' in val and val['isNull']:
            return 0.0
    return float(val) if val else 0.0

def get_string_value(val):
    """Get string value from record field"""
    if val is None:
        return ''
    if isinstance(val, dict):
        if 'stringValue' in val:
            return val['stringValue']
        elif 'isNull' in val and val['isNull']:
            return ''
    return str(val) if val else ''

def get_boolean_value(val):
    """Get boolean value from record field"""
    if val is None:
        return False
    if isinstance(val, dict):
        if 'booleanValue' in val:
            return val['booleanValue']
        elif 'isNull' in val and val['isNull']:
            return False
    return bool(val) if val else False

'''

# Find where to insert the helper functions (after imports)
import_section_end = content.find('logger = logging.getLogger(__name__)')
if import_section_end != -1:
    # Insert helper functions after logger definition
    insert_pos = content.find('\n', import_section_end) + 1
    content = content[:insert_pos] + '\n' + helper_functions + content[insert_pos:]
else:
    # Insert after imports
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if line.startswith('from .utils import'):
            # Found the utils import, insert after it
            lines.insert(i+1, helper_functions)
            content = '\n'.join(lines)
            break

# Write the fixed file
with open(file_path, 'w') as f:
    f.write(content)

print(f"✅ Fixed {file_path}")
print("Helper functions added to the file")
