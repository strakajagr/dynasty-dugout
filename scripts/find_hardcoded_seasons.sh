#!/bin/bash

# find_hardcoded_seasons.sh
# Finds all hardcoded season references in the codebase

echo "=========================================="
echo "SEARCHING FOR HARDCODED SEASON REFERENCES"
echo "=========================================="
echo ""

# Backend Python files
echo "BACKEND PYTHON FILES:"
echo "---------------------"

echo "1. Hardcoded 2025:"
grep -rn "2025" backend/src --include="*.py" | grep -v "__pycache__" | grep -v "# " | head -20

echo ""
echo "2. CURRENT_SEASON assignments:"
grep -rn "CURRENT_SEASON\s*=" backend/src --include="*.py" | grep -v "__pycache__"

echo ""
echo "3. Field names with years:"
grep -rn "season_2025\|game_logs_2025\|stats_2025" backend/src --include="*.py" | grep -v "__pycache__"

echo ""
echo "4. SQL with year references:"
grep -rn "WHERE.*2025\|season = 2025\|YEAR.*2025" backend/src --include="*.py" | grep -v "__pycache__"

echo ""
echo "5. _14_day_stats (should be _14_day):"
grep -rn "_14_day_stats" backend/src --include="*.py" | grep -v "__pycache__"

# Frontend JavaScript files
echo ""
echo "FRONTEND JAVASCRIPT FILES:"
echo "--------------------------"

echo "1. Hardcoded 2025:"
grep -rn "2025" frontend-react/src --include="*.js" --include="*.jsx" | head -10

echo ""
echo "2. Field names with years:"
grep -rn "season_2025\|game_logs_2025\|stats_2025" frontend-react/src --include="*.js" --include="*.jsx"

echo ""
echo "3. _stats suffix that should be removed:"
grep -rn "season_2025_stats\|rolling_14_day_stats" frontend-react/src --include="*.js" --include="*.jsx"

# Lambda functions
echo ""
echo "LAMBDA FUNCTIONS:"
echo "-----------------"

echo "1. Master daily updater:"
grep -n "2025\|CURRENT_SEASON" backend/lambda_worker_package/master_daily_updater.py | head -10

echo ""
echo "2. Other Lambda handlers:"
find backend/lambda_worker_package -name "*.py" -exec grep -l "2025\|CURRENT_SEASON = " {} \;

# Database migrations
echo ""
echo "DATABASE MIGRATIONS/SCHEMAS:"
echo "----------------------------"
find backend -name "*.sql" -exec grep -l "2025" {} \;

echo ""
echo "=========================================="
echo "RECOMMENDED FIXES:"
echo "=========================================="
echo "1. Create core/season_utils.py with get_current_season() function"
echo "2. Import and use get_current_season() everywhere instead of constants"
echo "3. Change all field names to remove year references:"
echo "   - season_2025_stats → season_stats"
echo "   - game_logs_2025 → game_logs"
echo "   - rolling_14_day_stats → rolling_14_day"
echo "4. Update frontend to handle both old and new field names during transition"
echo "5. Use season columns in database tables instead of year-specific names"