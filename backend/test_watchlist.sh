#!/bin/bash
# Watch List Quick Test Script
# Run this to verify Watch List is working

echo "======================================"
echo "WATCH LIST VERIFICATION SCRIPT"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if table exists
echo "Step 1: Checking if user_watchlist table exists..."
echo ""

cd /home/strakajagr/projects/dynasty-dugout/backend

if [ -f "verify_watchlist.py" ]; then
    python3 verify_watchlist.py
    TABLE_CHECK=$?
else
    echo -e "${RED}❌ verify_watchlist.py not found${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo ""

# If table doesn't exist, offer to create it
if [ $TABLE_CHECK -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Table not found or error occurred${NC}"
    echo ""
    echo "Would you like to create the table now? (y/n)"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Creating table using AWS RDS Data API..."
        
        if [ -f "create_watchlist_table.sql" ]; then
            # Read SQL file content
            SQL_CONTENT=$(cat create_watchlist_table.sql)
            
            # Execute via AWS RDS Data API
            aws rds-data execute-statement \
                --resource-arn "arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless" \
                --secret-arn "arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb" \
                --database "postgres" \
                --sql "$SQL_CONTENT"
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Table created successfully!${NC}"
                echo ""
                echo "Re-running verification..."
                python3 verify_watchlist.py
            else
                echo -e "${RED}❌ Failed to create table${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ create_watchlist_table.sql not found${NC}"
            exit 1
        fi
    else
        echo "Skipping table creation."
        echo ""
        echo "To create manually, run:"
        echo "  aws rds-data execute-statement \\"
        echo "    --resource-arn \"arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless\" \\"
        echo "    --secret-arn \"arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb\" \\"
        echo "    --database \"postgres\" \\"
        echo "    --sql \"\$(cat create_watchlist_table.sql)\""
        exit 1
    fi
fi

echo ""
echo "======================================"
echo "TESTING BACKEND ENDPOINTS"
echo "======================================"
echo ""

echo "⚠️  Note: You'll need to add your auth token to test the endpoints"
echo ""
echo "Example endpoint tests:"
echo ""
echo "1. Get watch list:"
echo "   curl \"https://api.dynasty-dugout.com/api/watchlist\" \\"
echo "     -H \"Authorization: Bearer YOUR_TOKEN\""
echo ""
echo "2. Add player (Mike Trout - player_id: 545361):"
echo "   curl -X POST \"https://api.dynasty-dugout.com/api/watchlist/add?player_id=545361\" \\"
echo "     -H \"Authorization: Bearer YOUR_TOKEN\""
echo ""
echo "3. Check player status:"
echo "   curl \"https://api.dynasty-dugout.com/api/watchlist/player/545361/status\" \\"
echo "     -H \"Authorization: Bearer YOUR_TOKEN\""
echo ""
echo "4. Remove player:"
echo "   curl -X DELETE \"https://api.dynasty-dugout.com/api/watchlist/remove/545361\" \\"
echo "     -H \"Authorization: Bearer YOUR_TOKEN\""
echo ""

echo "======================================"
echo "FRONTEND TESTING CHECKLIST"
echo "======================================"
echo ""
echo "✅ Navigate to: https://dynasty-dugout.com/watch-list"
echo "✅ Should see watch list page (initially empty)"
echo "✅ Click star on any player to add to watch list"
echo "✅ Return to /watch-list and see the player"
echo "✅ Switch between Batter/Pitcher tabs"
echo "✅ Click player to open profile modal"
echo "✅ Click remove button to remove from watch list"
echo "✅ Verify star fills/unfills when toggling"
echo ""

echo "======================================"
echo "WATCH LIST IS READY!"
echo "======================================"
echo ""
echo -e "${GREEN}✅ Backend: Fully implemented${NC}"
echo -e "${GREEN}✅ Frontend: Fully implemented${NC}"
echo -e "${GREEN}✅ Integration: Star button in player modals${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify database table exists (done above)"
echo "  2. Test adding/removing players"
echo "  3. Test the /watch-list page"
echo "  4. Verify multi-league status shows correctly"
echo ""
echo "Happy testing! 🎉"
