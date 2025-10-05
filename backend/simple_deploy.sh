#!/bin/bash
# Dynasty Dugout - Simple Deploy (No Docker)

echo "🚀 Dynasty Dugout Simple Deploy"
echo "================================"

cd /home/strakajagr/projects/dynasty-dugout/backend || exit 1

# 1. Test imports first
echo "Testing imports..."
python3 quick_test.py
if [ $? -ne 0 ]; then
    echo "❌ Import errors detected! Cannot deploy."
    exit 1
fi

# 2. Clean old builds
echo "Cleaning old builds..."
rm -rf .aws-sam/build/

# 3. Build WITHOUT container (uses local Python)
echo "Building (without Docker)..."
sam build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# 4. Deploy
echo "Deploying..."
sam deploy --no-confirm-changeset --capabilities CAPABILITY_IAM

echo ""
echo "✅ Deploy complete! Wait 30 seconds then test:"
echo "curl https://13cpdms4x1.execute-api.us-east-1.amazonaws.com/Prod/api/mlb/trending"
