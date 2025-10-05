#!/bin/bash

# Final cleanup - remove remaining old files
echo "🗑️  Removing remaining old files..."

files_removed=0

# Remove team_stats_old.py if it exists
if [ -f "src/routers/leagues/players/team_stats_old.py" ]; then
    rm "src/routers/leagues/players/team_stats_old.py"
    echo "✅ Removed src/routers/leagues/players/team_stats_old.py"
    files_removed=$((files_removed + 1))
fi

# Remove any other _old.py files
for file in $(find src -name "*_old.py" 2>/dev/null); do
    rm "$file"
    echo "✅ Removed $file"
    files_removed=$((files_removed + 1))
done

echo ""
if [ $files_removed -eq 0 ]; then
    echo "✅ No old files found - already clean!"
else
    echo "✅ Removed $files_removed old file(s)"
fi

echo ""
echo "Now run: ./verify_code_quality.sh to confirm everything is clean"
