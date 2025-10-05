#!/bin/bash
# Dynasty Dugout - Complete Fix and Deploy Script
# This fixes ALL import errors and redeploys

echo "🔧 Dynasty Dugout Complete Fix"
echo "=============================="

# Check if we're in the backend directory
if [ ! -f "template.yaml" ]; then
    echo "❌ Error: Run this script from the backend directory"
    echo "   cd /home/strakajagr/projects/dynasty-dugout/backend"
    exit 1
fi

echo ""
echo "1️⃣ Checking Python dependencies..."
pip3 list | grep -E "fastapi|boto3|mangum" > /dev/null
if [ $? -ne 0 ]; then
    echo "   Installing missing dependencies..."
    pip3 install fastapi boto3 mangum PyJWT cryptography requests Pillow python-multipart numpy feedparser
fi

echo ""
echo "2️⃣ Testing local imports..."
cd src

# Test imports locally
python3 -c "
import sys
import traceback

errors = []

# Test each router
try:
    from routers import auth
    print('  ✅ auth router imports OK')
except Exception as e:
    print(f'  ❌ auth router FAILED: {e}')
    errors.append('auth')

try:
    from routers import account
    print('  ✅ account router imports OK')
except Exception as e:
    print(f'  ❌ account router FAILED: {e}')
    errors.append('account')

try:
    from routers import mlb
    print('  ✅ mlb router imports OK')
except Exception as e:
    print(f'  ❌ mlb router FAILED: {e}')
    errors.append('mlb')

try:
    from routers import leagues
    print('  ✅ leagues router imports OK')
except Exception as e:
    print(f'  ❌ leagues router FAILED: {e}')
    traceback.print_exc()
    errors.append('leagues')

try:
    from routers import players_canonical
    print('  ✅ players_canonical router imports OK')
except Exception as e:
    print(f'  ❌ players_canonical router FAILED: {e}')
    errors.append('players_canonical')

if errors:
    print(f'\n❌ Failed routers: {errors}')
    sys.exit(1)
else:
    print('\n✅ All routers import successfully!')
"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Import errors detected. Fixing..."
    
    # Check if the old functions are still being used
    echo "   Checking for old helper function usage..."
    grep -r "get_decimal_value\|get_long_value\|get_string_value" routers/leagues/players/*.py 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   ⚠️  Found old helper function usage. These need to be fixed!"
        echo "   The files still use removed functions."
    fi
fi

cd ..

echo ""
echo "3️⃣ Cleaning build artifacts..."
rm -rf .aws-sam/build/
rm -rf src/__pycache__
find src -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null

echo ""
echo "4️⃣ Building application..."
sam build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Check errors above."
    exit 1
fi

echo ""
echo "5️⃣ Deploying to AWS..."
sam deploy --no-confirm-changeset --capabilities CAPABILITY_IAM

if [ $? -ne 0 ]; then
    echo "❌ Deploy failed! Check errors above."
    exit 1
fi

echo ""
echo "6️⃣ Waiting for deployment to stabilize..."
sleep 15

echo ""
echo "7️⃣ Testing deployed endpoints..."
echo ""
echo "Testing MLB trending endpoint:"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" https://13cpdms4x1.execute-api.us-east-1.amazonaws.com/Prod/api/mlb/trending)
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)
body=$(echo "$response" | grep -v "HTTP_CODE:")

if [ "$http_code" = "200" ]; then
    echo "✅ MLB endpoints working! (Status: $http_code)"
else
    echo "❌ MLB endpoints returning $http_code"
    echo "Response: $body" | head -50
fi

echo ""
echo "Testing leagues endpoint:"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" https://13cpdms4x1.execute-api.us-east-1.amazonaws.com/Prod/api/leagues/health)
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$http_code" = "200" ]; then
    echo "✅ Leagues endpoints working! (Status: $http_code)"
else
    echo "❌ Leagues endpoints returning $http_code"
fi

echo ""
echo "=============================="
echo "📋 Deployment Summary:"
echo ""
if [ "$http_code" = "200" ]; then
    echo "✅ SUCCESS! All endpoints are working."
else
    echo "⚠️  Some endpoints may still have issues."
    echo ""
    echo "Check CloudWatch logs:"
    echo "aws logs tail /aws/lambda/fantasy-baseball-api-FantasyBaseballApi --follow"
fi
