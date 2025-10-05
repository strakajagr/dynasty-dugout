#!/bin/bash

# Dynasty Dugout Code Quality Verification Script
# This script checks for common code quality issues

echo "🔍 Dynasty Dugout Code Quality Check"
echo "===================================="

issues=0

# 1. Check for BAD array indexing (numeric indices like record[0])
echo "1. Checking for bad numeric array indexing (record[0], record[1])..."
# Only flag actual numeric indices, not dictionary string keys
bad_indexing=$(grep -rE 'record\[[0-9]+\]' src/routers --include="*.py" 2>/dev/null | wc -l)
if [ $bad_indexing -gt 0 ]; then
    echo "   ❌ Found $bad_indexing instances of numeric array indexing"
    grep -rnE 'record\[[0-9]+\]' src/routers --include="*.py" 2>/dev/null | head -5
    issues=$((issues + 1))
else
    echo "   ✅ No numeric array indexing found"
    echo "      ℹ️  Note: record[\"field_name\"] dictionary access is GOOD and expected"
fi

# 2. Check for cross-database JOINs
echo ""
echo "2. Checking for cross-database JOINs (JOIN postgres.)..."
cross_db_joins=$(grep -r "JOIN postgres\." src/routers --include="*.py" 2>/dev/null | wc -l)
if [ $cross_db_joins -gt 0 ]; then
    echo "   ❌ Found $cross_db_joins instances of cross-database JOINs"
    grep -rn "JOIN postgres\." src/routers --include="*.py" 2>/dev/null
    issues=$((issues + 1))
else
    echo "   ✅ No cross-database JOINs found"
fi

# 3. Check for backup files
echo ""
echo "3. Checking for backup files (.OLD.py, .BROKEN.js)..."
backup_files=$(find src -name "*.OLD.py" -o -name "*.BROKEN.js" 2>/dev/null)
if [ -n "$backup_files" ]; then
    echo "   ⚠️  Found backup files:"
    echo "$backup_files" | sed 's/^/      - /'
    echo "   Run cleanup_old_files.sh to remove them"
    issues=$((issues + 1))
else
    echo "   ✅ No backup files found"
fi

# 4. Check for helper function usage (informational)
echo ""
echo "4. Checking for consistent helper function usage..."
get_long=$(grep -r "get_long_value" src/routers --include="*.py" 2>/dev/null | wc -l)
get_string=$(grep -r "get_string_value" src/routers --include="*.py" 2>/dev/null | wc -l)
dict_access=$(grep -r "\.get(" src/routers --include="*.py" 2>/dev/null | wc -l)
echo "   Helper functions: get_long_value ($get_long), get_string_value ($get_string)"
echo "   Dictionary access: record.get() ($dict_access)"
if [ $dict_access -gt 0 ]; then
    echo "   ✅ Using modern dictionary access pattern"
fi

# 5. Check for lambdas directory
echo ""
echo "5. Checking for empty lambdas directory..."
if [ -d "lambdas" ]; then
    lambda_count=$(find lambdas -type f 2>/dev/null | wc -l)
    if [ $lambda_count -eq 0 ]; then
        echo "   ⚠️  Empty lambdas directory exists (can be removed)"
    else
        echo "   ℹ️  Lambdas directory has $lambda_count files"
    fi
else
    echo "   ✅ No lambdas directory (already cleaned)"
fi

# Summary
echo ""
echo "===================================="
if [ $issues -eq 0 ]; then
    echo "✅ All checks passed! Code is clean."
else
    echo "⚠️  Found $issues potential issues to address."
fi
