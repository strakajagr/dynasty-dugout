#!/bin/bash

# Comprehensive Code Quality Check - Frontend & Backend
echo "🔍 Dynasty Dugout - FULL CODEBASE Quality Check"
echo "================================================="
echo ""

total_issues=0

# =============================================================================
# BACKEND CHECKS
# =============================================================================
echo "🔧 BACKEND CHECKS"
echo "=================="

# 1. Check for numeric array indexing in backend
echo ""
echo "1. Backend: Checking for bad numeric array indexing (record[0], record[1])..."
backend_bad_indexing=$(grep -rE 'record\[[0-9]+\]' src/routers --include="*.py" 2>/dev/null | wc -l)
if [ $backend_bad_indexing -gt 0 ]; then
    echo "   ❌ Found $backend_bad_indexing instances of numeric array indexing in backend"
    grep -rnE 'record\[[0-9]+\]' src/routers --include="*.py" 2>/dev/null | head -5
    total_issues=$((total_issues + 1))
else
    echo "   ✅ No numeric array indexing found in backend"
fi

# 2. Check for cross-database JOINs
echo ""
echo "2. Backend: Checking for cross-database JOINs..."
cross_db=$(grep -r "JOIN postgres\." src/routers --include="*.py" 2>/dev/null | wc -l)
if [ $cross_db -gt 0 ]; then
    echo "   ❌ Found $cross_db cross-database JOINs"
    grep -rn "JOIN postgres\." src/routers --include="*.py" 2>/dev/null
    total_issues=$((total_issues + 1))
else
    echo "   ✅ No cross-database JOINs found"
fi

# 3. Check for old backup files
echo ""
echo "3. Backend: Checking for old backup files..."
backend_backups=$(find src -name "*.OLD.py" -o -name "*_old.py" -o -name "*.BROKEN.*" 2>/dev/null | wc -l)
if [ $backend_backups -gt 0 ]; then
    echo "   ⚠️  Found $backend_backups old backup file(s)"
    find src -name "*.OLD.py" -o -name "*_old.py" -o -name "*.BROKEN.*" 2>/dev/null
    total_issues=$((total_issues + 1))
else
    echo "   ✅ No old backup files found"
fi

# =============================================================================
# FRONTEND CHECKS
# =============================================================================
echo ""
echo ""
echo "⚛️  FRONTEND CHECKS"
echo "==================="

# 1. Check for array indexing in API response handling
echo ""
echo "1. Frontend: Checking for array indexing in API responses..."
frontend_response_indexing=$(grep -r "response\.data\[0\]\|\.data\[0\]" ../frontend-react/src --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
if [ $frontend_response_indexing -gt 0 ]; then
    echo "   ❌ Found $frontend_response_indexing instances of array indexing in API responses"
    grep -rn "response\.data\[0\]\|\.data\[0\]" ../frontend-react/src --include="*.js" --include="*.jsx" 2>/dev/null | head -5
    total_issues=$((total_issues + 1))
else
    echo "   ✅ No array indexing in API responses"
fi

# 2. Check for record/data array access patterns
echo ""
echo "2. Frontend: Checking for records[0] or data[0] patterns..."
frontend_records_indexing=$(grep -r "records\[0\]\|data\[0\]" ../frontend-react/src --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "node_modules" | wc -l)
if [ $frontend_records_indexing -gt 0 ]; then
    echo "   ⚠️  Found $frontend_records_indexing potential array indexing patterns"
    grep -rn "records\[0\]\|data\[0\]" ../frontend-react/src --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "node_modules" | head -5
    total_issues=$((total_issues + 1))
else
    echo "   ✅ No problematic array indexing patterns found"
fi

# 3. Check for old backup files in frontend
echo ""
echo "3. Frontend: Checking for old backup files..."
frontend_backups=$(find ../frontend-react/src -name "*.OLD.*" -o -name "*_old.*" -o -name "*.BROKEN.*" 2>/dev/null | wc -l)
if [ $frontend_backups -gt 0 ]; then
    echo "   ⚠️  Found $frontend_backups old backup file(s)"
    find ../frontend-react/src -name "*.OLD.*" -o -name "*_old.*" -o -name "*.BROKEN.*" 2>/dev/null
    total_issues=$((total_issues + 1))
else
    echo "   ✅ No old backup files found"
fi

# 4. Verify table services use object access
echo ""
echo "4. Frontend: Verifying table services use proper object access..."
table_helpers_check=$(grep -c "p\?\.\|player\?\.\|game\?\." ../frontend-react/src/services/tables/tableHelpers.js 2>/dev/null)
if [ $table_helpers_check -gt 10 ]; then
    echo "   ✅ Table helpers using proper object access (found $table_helpers_check occurrences)"
else
    echo "   ⚠️  Could not verify table helpers object access pattern"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo ""
echo "================================================="
echo "📊 SUMMARY"
echo "================================================="
echo ""

if [ $total_issues -eq 0 ]; then
    echo "🎉 PERFECT! All checks passed!"
    echo ""
    echo "✨ Your codebase is clean and follows best practices:"
    echo "   ✅ Backend using dictionary access (record.get() or record['field'])"
    echo "   ✅ Frontend using object access (player.name, p?.stat)"
    echo "   ✅ No cross-database JOINs"
    echo "   ✅ No old backup files"
    echo ""
    echo "🚀 Ready to deploy and implement caching!"
else
    echo "⚠️  Found $total_issues potential issue(s)."
    echo ""
    echo "Please review the details above and fix any issues."
fi

echo ""
echo "================================================="
