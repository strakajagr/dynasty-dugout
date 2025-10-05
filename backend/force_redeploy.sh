#!/bin/bash
# Dynasty Dugout - Force Redeploy Script
# This ensures your changes are actually deployed

echo "🚀 Dynasty Dugout Force Redeploy"
echo "================================"

cd /home/strakajagr/projects/dynasty-dugout/backend || exit 1

# 1. Clean build artifacts
echo "🧹 Cleaning old build artifacts..."
rm -rf .aws-sam/build/
rm -f lambda-package.zip

# 2. Rebuild
echo "🔨 Building fresh..."
sam build --use-container

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Check errors above."
    exit 1
fi

# 3. Deploy with confirmation
echo "📦 Deploying to AWS..."
sam deploy --no-confirm-changeset --capabilities CAPABILITY_IAM

if [ $? -ne 0 ]; then
    echo "❌ Deploy failed! Check errors above."
    exit 1
fi

# 4. Wait for deployment to stabilize
echo "⏳ Waiting 10 seconds for deployment to stabilize..."
sleep 10

# 5. Test the deployment
echo "🧪 Testing deployment..."
echo ""
echo "Health check:"
curl -s https://13cpdms4x1.execute-api.us-east-1.amazonaws.com/Prod/api/health | python3 -m json.tool | head -10

echo ""
echo "MLB Trending test:"
response=$(curl -s -w "\n%{http_code}" https://13cpdms4x1.execute-api.us-east-1.amazonaws.com/Prod/api/mlb/trending)
status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$status_code" = "200" ]; then
    echo "✅ MLB endpoints working! (Status: $status_code)"
else
    echo "❌ MLB endpoints still returning $status_code"
    echo "Response: $body" | head -100
fi

echo ""
echo "================================"
echo "✅ Deployment complete!"
echo ""
echo "Check CloudWatch logs if issues persist:"
echo "aws logs tail /aws/lambda/dynasty-dugout-FantasyBaseballApi --follow"
