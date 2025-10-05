🚀 Quick Start: Extract Players Lambda First
==========================================

## Why Start with Players Lambda?
- **60% of your traffic** goes to player endpoints
- **Easiest to extract** - minimal dependencies on other modules  
- **Biggest performance win** - can heavily cache player data
- **Learn the process** before tackling more complex splits

## Step 1: Create New Lambda Structure
```bash
backend/
├── lambdas/
│   ├── players/
│   │   ├── __init__.py
│   │   ├── handler.py          # New Lambda handler
│   │   ├── requirements.txt    # Minimal deps
│   │   └── routers/
│   │       └── players.py      # Copy from src/routers/players_canonical.py
│   └── shared/                 # Shared code (future Lambda Layer)
│       ├── core/
│       │   ├── database.py     # Copy from src/core/database.py
│       │   └── auth_utils.py   # JWT validation only
│       └── models/
│           └── player.py       # Player models only
```

## Step 2: Create Minimal Players Lambda Handler
```python
# backend/lambdas/players/handler.py
import logging
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import sys
import os

# Add shared to path (temporary until Lambda Layer)
sys.path.insert(0, '/opt/python')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Dynasty Dugout Players API",
    version="1.0.0",
    description="Player data and statistics service"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/players/health")
async def health_check():
    return {"status": "healthy", "service": "players-api"}

# Import and include the players router
from routers.players import router as players_router
app.include_router(players_router, prefix="/api/players", tags=["Players"])

# Lambda handler
handler = Mangum(app, lifespan="off")
```

## Step 3: Update SAM Template
```yaml
# Add to template.yaml
  PlayersApi:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: dynasty-dugout-players-api
      CodeUri: lambdas/players/
      Handler: handler.handler
      Runtime: python3.12
      Timeout: 30
      MemorySize: 256
      Architectures:
        - x86_64
      Environment:
        Variables:
          DB_CLUSTER_ARN: !Ref DBClusterArn
          DB_SECRET_ARN: !Ref DBSecretArn
          CACHE_ENABLED: "true"
      Policies:
        - AWSLambdaBasicExecutionRole
        - Statement:
          - Effect: Allow
            Action:
              - rds-data:ExecuteStatement
              - secretsmanager:GetSecretValue
            Resource: '*'
      Events:
        PlayersRoute:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGatewayApi
            Path: /api/players/{proxy+}
            Method: ANY
```

## Step 4: Add Simple In-Memory Caching (Before Redis)
```python
# backend/lambdas/players/cache.py
import time
import json
from typing import Optional, Any

class SimpleCache:
    def __init__(self, default_ttl: int = 300):
        self._cache = {}
        self._default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            entry = self._cache[key]
            if time.time() < entry['expires']:
                return entry['value']
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        self._cache[key] = {
            'value': value,
            'expires': time.time() + (ttl or self._default_ttl)
        }
    
    def clear(self):
        self._cache.clear()

# Global cache instance (persists across Lambda invocations)
cache = SimpleCache(default_ttl=300)  # 5 minutes default
```

## Step 5: Update Players Router with Caching
```python
# Add caching to expensive endpoints
from cache import cache

@router.get("/search")
async def search_players(
    query: str,
    limit: int = 20,
    user_id: Optional[str] = None
):
    # Try cache first
    cache_key = f"search:{query}:{limit}"
    cached_result = cache.get(cache_key)
    if cached_result:
        logger.info(f"Cache hit for search: {query}")
        return cached_result
    
    # Your existing search logic...
    result = await perform_search(query, limit)
    
    # Cache the result
    cache.set(cache_key, result, ttl=300)  # 5 min cache
    
    return result
```

## Step 6: Deploy and Test Canary
```bash
# Build and deploy
cd backend
sam build PlayersApi
sam deploy --guided

# Test the new endpoint
curl https://your-api.execute-api.region.amazonaws.com/Prod/api/players/health

# Monitor CloudWatch
aws logs tail /aws/lambda/dynasty-dugout-players-api --follow
```

## Step 7: Gradual Traffic Shift in API Gateway
1. Keep both Lambdas running initially
2. In API Gateway, create weighted route:
   - 90% to old FantasyBaseballApi
   - 10% to new PlayersApi
3. Monitor for 24 hours
4. If stable, increase to 50/50
5. After 48 hours, shift 100% to PlayersApi

## Step 8: Add CloudWatch Metrics
```python
# Add to handler.py
from aws_lambda_powertools import Metrics
from aws_lambda_powertools.metrics import MetricUnit

metrics = Metrics()

@router.get("/{player_id}")
@metrics.log_metrics
async def get_player(player_id: int):
    start = time.time()
    
    # Your logic here
    
    # Record custom metric
    latency = (time.time() - start) * 1000
    metrics.add_metric(
        name="GetPlayerLatency",
        unit=MetricUnit.Milliseconds,
        value=latency
    )
    
    # Log if slow
    if latency > 1000:
        logger.warning(f"Slow request for player {player_id}: {latency}ms")
    
    return result
```

## Testing Checklist
- [ ] All player search endpoints work
- [ ] Player stats load correctly
- [ ] Game logs display properly
- [ ] Cache is working (check repeated requests)
- [ ] Cold start time < 3 seconds
- [ ] Warm response time < 200ms
- [ ] No increase in error rate
- [ ] CloudWatch logs look clean

## Rollback Plan
If anything goes wrong:
1. In API Gateway, immediately route 100% back to old Lambda
2. Investigate CloudWatch logs
3. Fix issues in new Lambda
4. Re-attempt with smaller traffic percentage

## Next Steps After Success
Once Players Lambda is stable for 1 week:
1. Add Redis caching (replace SimpleCache)
2. Add provisioned concurrency for consistent performance
3. Extract Auth Lambda (next easiest)
4. Then tackle League split (most complex)

## Common Gotchas to Avoid
1. **Database connections**: Use connection pooling
2. **Cold starts**: Keep package small, lazy load heavy libs
3. **Timeouts**: 30 seconds should be plenty for reads
4. **Memory**: Start with 256MB, adjust based on CloudWatch
5. **Permissions**: Make sure Lambda can access RDS and Secrets

---
This incremental approach lets you:
- Learn the process with lowest risk
- Get immediate performance benefits  
- Build confidence before bigger changes
- Easy rollback if needed