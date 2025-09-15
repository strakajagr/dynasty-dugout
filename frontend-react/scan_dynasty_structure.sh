#!/bin/bash

# ====================================================================
# DYNASTY DUGOUT - EASIEST FILE STRUCTURE COMMAND
# Just copy and run this entire block in your terminal
# ====================================================================

FUNCTION_NAME="fantasy-baseball-api-FantasyBaseballApi-5W258cgyZ9pl"

# Create output file with timestamp
OUTPUT_FILE="dynasty_structure_$(date +%Y%m%d_%H%M%S).txt"

{
    echo "==================================="
    echo "DYNASTY DUGOUT FILE STRUCTURE SCAN"
    echo "Generated: $(date)"
    echo "==================================="
    echo ""
    
    echo "1. LAMBDA FUNCTIONS"
    echo "-------------------"
    aws lambda list-functions \
        --query 'Functions[?contains(FunctionName, `fantasy`) || contains(FunctionName, `dynasty`)].FunctionName' \
        --output text | tr '\t' '\n'
    
    echo ""
    echo "2. DOWNLOADING MAIN LAMBDA..."
    echo "-----------------------------"
    DOWNLOAD_URL=$(aws lambda get-function --function-name $FUNCTION_NAME --query 'Code.Location' --output text)
    wget -q -O /tmp/lambda.zip "$DOWNLOAD_URL"
    unzip -q /tmp/lambda.zip -d /tmp/lambda_code/
    
    echo ""
    echo "3. BACKEND FILE STRUCTURE"
    echo "--------------------------"
    echo ""
    echo "All Python Files:"
    find /tmp/lambda_code -name "*.py" -type f | sort | sed 's|/tmp/lambda_code/||'
    
    echo ""
    echo "4. KEY MODULES BREAKDOWN"
    echo "------------------------"
    echo ""
    echo "Core Utilities:"
    find /tmp/lambda_code -path "*/core/*" -name "*.py" | sort | sed 's|/tmp/lambda_code/||'
    
    echo ""
    echo "Main Routers:"
    find /tmp/lambda_code -maxdepth 2 -path "*/routers/*.py" | sort | sed 's|/tmp/lambda_code/||'
    
    echo ""
    echo "League Routers:"
    find /tmp/lambda_code -path "*/routers/leagues/*.py" | sort | sed 's|/tmp/lambda_code/||'
    
    echo ""
    echo "Player Modules:"
    find /tmp/lambda_code -path "*/players/*" -name "*.py" | sort | sed 's|/tmp/lambda_code/||'
    
    echo ""
    echo "Transaction Modules:"
    find /tmp/lambda_code -path "*/transactions/*" -name "*.py" | sort | sed 's|/tmp/lambda_code/||'
    
    echo ""
    echo "Salary Modules:"
    find /tmp/lambda_code -path "*/salaries/*" -name "*.py" | sort | sed 's|/tmp/lambda_code/||'
    
    echo ""
    echo "5. FRONTEND STRUCTURE (S3)"
    echo "---------------------------"
    echo ""
    echo "JavaScript Files (first 30):"
    aws s3 ls s3://fantasy-baseball-frontend-strakajagr/ --recursive \
        | grep -E '\.(js|jsx)$' \
        | awk '{print $4}' \
        | grep -E '(pages|components|services|utils)' \
        | head -30
    
    echo ""
    echo "6. FILE EXISTENCE CHECK"
    echo "-----------------------"
    echo "Checking critical files..."
    
    critical_files=(
        "fantasy_api.py"
        "routers/players.py"
        "routers/leagues/players/global_stats.py"
        "routers/leagues/players/analytics.py"
        "routers/leagues/players/utils.py"
        "routers/leagues/players/models.py"
        "core/database.py"
        "core/season_utils.py"
        "core/auth_utils.py"
    )
    
    for file in "${critical_files[@]}"; do
        if [ -f "/tmp/lambda_code/$file" ]; then
            echo "✓ $file"
        else
            echo "✗ $file (NOT FOUND)"
        fi
    done
    
    echo ""
    echo "7. FANTASY_API.PY ROUTER IMPORTS"
    echo "---------------------------------"
    if [ -f "/tmp/lambda_code/fantasy_api.py" ]; then
        grep -E "^from routers|^import routers|app.include_router" /tmp/lambda_code/fantasy_api.py | head -20
    fi
    
    echo ""
    echo "8. DATABASE TABLES"
    echo "------------------"
    aws rds-data execute-statement \
        --resource-arn "arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless" \
        --secret-arn "arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb" \
        --database "postgres" \
        --sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 20" \
        --query 'records[*][0].stringValue' \
        --output text 2>/dev/null | tr '\t' '\n'
    
    # Cleanup
    rm -rf /tmp/lambda_code /tmp/lambda.zip
    
    echo ""
    echo "==================================="
    echo "SCAN COMPLETE"
    echo "==================================="
    
} | tee "$OUTPUT_FILE"

echo ""
echo "Results saved to: $OUTPUT_FILE"
echo "Share this file with Claude to update the documentation!"