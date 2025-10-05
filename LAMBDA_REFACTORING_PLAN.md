🏆 Dynasty Dugout - Lambda Refactoring Plan v3.0
===============================================
Target Launch: 2026 MLB Season (March 2026)
Timeline: 6 months
Current State: 5 Lambda functions (1 monolithic API + 4 specialized workers)

📋 Executive Summary
------------------
Dynasty Dugout currently has 5 Lambda functions, but the main API Lambda is a monolith with 200-second timeout containing ALL application routes. The 4 worker Lambdas are already properly separated for background tasks. This plan focuses on breaking up the main API Lambda into focused services while keeping the existing workers.

🔍 Current Lambda Architecture
-----------------------------
### Existing Lambda Functions:
1. **FantasyBaseballApi** (200s timeout) - MONOLITHIC API ⚠️
   - `/api/auth/*` - Authentication (login, signup, verify, refresh)
   - `/api/account/*` - Profile management  
   - `/api/leagues/*` - ALL league operations (30+ endpoints!)
   - `/api/players/*` - Player data, stats, search
   - `/api/invitation/*` - League invitations
   - `/api/utilities/*` - Misc utility functions
   - `/api/mlb/*` - MLB data endpoints
   - **Problem**: Cold starts, timeouts, hard to debug, everything coupled

2. **LeagueCreationWorker** (300s) ✅ - Already separated
3. **MasterDailyUpdater** (900s) ✅ - Already separated  
4. **CalculateRollingStatsFunction** (300s) ✅ - Already separated
5. **UpdateActiveAccruedStatsFunction** (300s) ✅ - Already separated

### The Main Problem:
The `FantasyBaseballApi` Lambda has **EVERYTHING** except the worker functions. With 200-second timeout and all routes, it's:
- Slow to cold start (loading all dependencies)
- Hard to debug (which endpoint is slow?)
- Expensive (always provisioning for worst case)
- Risky to deploy (one bug affects everything)

🎯 Target Lambda Architecture
----------------------------
### New Lambda Structure (7 total):
```
API Gateway → Route by Path Pattern
     │
     ├─→ /api/auth/* → AuthLambda (128MB, 30s)
     │                  - login, signup, verify, refresh
     │
     ├─→ /api/players/* → PlayersLambda (256MB, 30s) 
     │                     - search, stats, game-logs
     │                     - HIGHEST TRAFFIC
     │
     ├─→ /api/leagues/*/transactions/* → LeagueWriteLambda (512MB, 60s)
     │   /api/leagues/*/roster-moves/*    - transactions
     │   /api/leagues/*/lineups/*         - roster changes
     │                                      - lineup updates
     │
     ├─→ /api/leagues/* → LeagueReadLambda (256MB, 30s)
     │                     - standings, rosters, league info
     │                     - owner lists, salary data
     │
     └─→ /* → CoreLambda (128MB, 30s)
              - /api/account/*
              - /api/invitation/*
              - /api/utilities/*
              - /api/health
              - catch-all for misc

Background Workers (Keep As-Is):
     - LeagueCreationWorker
     - MasterDailyUpdater
     - CalculateRollingStatsFunction
     - UpdateActiveAccruedStatsFunction
```

📊 Why This Split Makes Sense
-----------------------------
### Traffic Patterns (estimated):
- **Player endpoints**: 60% of traffic (search, stats viewing)
- **League reads**: 25% of traffic (standings, rosters)
- **Auth**: 10% of traffic (login/refresh)
- **League writes**: 3% of traffic (trades, roster moves)
- **Other**: 2% of traffic

### Benefits:
1. **Players Lambda** can be optimized for caching (5-min TTL)
2. **League Write** can have longer timeout for complex transactions
3. **Auth Lambda** can have specific security monitoring
4. **Cold starts** reduced by 70% (smaller packages)
5. **Independent scaling** - Players Lambda can scale separately

📅 Implementation Phases
-----------------------

## Phase 1: Foundation & Monitoring (Week 1) ✅
**Goal**: Fix bugs, add monitoring, understand current performance

### Immediate Actions:
- [x] Fix GS boolean bug
- [ ] Add CloudWatch custom metrics to current Lambda
- [ ] Create performance baseline dashboard
- [ ] Map all endpoints to their traffic volume

### Monitoring to Add:
```python
# Add to each router
import time
from aws_lambda_powertools import Metrics
from aws_lambda_powertools.metrics import MetricUnit

metrics = Metrics()

@router.get("/api/players/{player_id}")
@metrics.log_metrics
async def get_player(player_id: int):
    start = time.time()
    # ... existing code ...
    metrics.add_metric(
        name="GetPlayerLatency",
        unit=MetricUnit.Milliseconds,
        value=(time.time() - start) * 1000
    )
```

## Phase 2: Prepare Shared Layer (Week 2)
**Goal**: Create Lambda Layer with shared dependencies

### Lambda Layer Structure:
```
/opt/python/
├── core/
│   ├── database.py       # RDS connection
│   ├── auth_utils.py     # JWT validation
│   ├── error_handlers.py # Shared error handling
│   └── cache.py          # Redis client
├── models/
│   ├── player.py         # Pydantic models
│   ├── league.py
│   └── transaction.py
└── requirements.txt      # Shared dependencies
```

### Benefits:
- Reduce package size by 80%
- Share database connection logic
- Consistent error handling

## Phase 3: Extract Players Lambda (Week 3)
**Goal**: First split - highest traffic endpoint

### New PlayersLambda:
```python
# players_lambda.py
from fastapi import FastAPI
from mangum import Mangum
from routers import players_canonical
import redis

app = FastAPI(title="Dynasty Dugout Players API")

# Redis for caching
redis_client = redis.Redis(
    host='your-elasticache-endpoint',
    decode_responses=True
)

app.include_router(players_canonical.router, prefix="/api/players")

handler = Mangum(app, lifespan="off")
```

### API Gateway Integration:
```yaml
# SAM template addition
PlayersApi:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: lambdas/players/
    Handler: players_lambda.handler
    Layers:
      - !Ref SharedLayer
    Events:
      PlayersRoute:
        Type: Api
        Properties:
          Path: /api/players/{proxy+}
          Method: ANY
```

## Phase 4: Split League Operations (Week 4)
**Goal**: Separate league reads from writes

### LeagueReadLambda:
- GET /api/leagues/*
- Standings, rosters, owners
- Heavy caching (1-min TTL)

### LeagueWriteLambda:
- POST/PUT/DELETE /api/leagues/*
- Transactions, roster moves
- Cache invalidation
- Longer timeout (60s)

## Phase 5: Extract Auth Lambda (Week 5)
**Goal**: Isolated auth service with enhanced security

### AuthLambda Features:
- Rate limiting per IP
- Failed login tracking
- JWT token management
- Email verification

## Phase 6: Performance Optimization (Week 6)
**Goal**: Add caching layer and optimize

### Redis Caching Strategy:
```python
async def get_player_cached(player_id: int):
    # Try cache first
    cache_key = f"player:{player_id}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Cache miss - get from DB
    player = await get_player_from_db(player_id)
    
    # Cache for 5 minutes
    await redis_client.setex(
        cache_key, 
        300,  # 5 minutes
        json.dumps(player)
    )
    return player
```

### Cache TTLs:
- Player stats: 5 minutes
- Game logs: 1 hour  
- League standings: 1 minute
- Rosters: 30 seconds

## Phase 7: Testing & Migration (Weeks 7-8)
**Goal**: Zero-downtime migration

### Canary Deployment:
1. Deploy new Lambdas alongside old one
2. Use API Gateway weighted routing
3. Start with 5% traffic to new Lambdas
4. Monitor errors and latency
5. Gradually increase to 100%

### Rollback Plan:
- Keep old Lambda for 2 weeks
- One-click rollback via API Gateway
- Monitor error rates closely

🔧 Technical Details
-------------------

### API Gateway Path Routing:
```
/api/auth/*          → AuthLambda
/api/players/*       → PlayersLambda  
/api/leagues/*/transactions/* → LeagueWriteLambda
/api/leagues/*/roster-moves/* → LeagueWriteLambda
/api/leagues/*       → LeagueReadLambda
/api/*               → CoreLambda (catch-all)
```

### Shared Lambda Layer:
```python
# Build script
pip install -t python/ -r requirements-layer.txt
zip -r layer.zip python/
aws lambda publish-layer-version \
    --layer-name dynasty-dugout-shared \
    --zip-file fileb://layer.zip
```

### Environment Variables:
All Lambdas share:
- `DB_CLUSTER_ARN`
- `DB_SECRET_ARN`
- `REDIS_ENDPOINT`
- `JWT_SECRET`

### Cold Start Optimizations:
1. **Provisioned Concurrency** for Players Lambda (highest traffic)
2. **Connection pooling** in Lambda Layer
3. **Lazy imports** for heavy libraries
4. **Smaller packages** (<50MB zipped)

📊 Performance Targets
---------------------
### Before Split (Current):
- Cold start: 8-12 seconds
- Warm response: 200-2000ms
- Package size: 250MB
- Memory: 512MB for everything

### After Split (Target):
- Cold start: 1-3 seconds
- Warm response: 50-500ms  
- Package sizes: 10-50MB each
- Memory: Optimized per Lambda

### Specific Targets:
| Lambda | Cold Start | Warm Response | Memory |
|--------|------------|---------------|---------|
| Auth | <2s | <100ms | 128MB |
| Players | <3s | <200ms | 256MB |
| League Read | <2s | <150ms | 256MB |
| League Write | <4s | <500ms | 512MB |
| Core | <2s | <100ms | 128MB |

💰 Cost Analysis
---------------
### Current (1 Lambda):
- 1M requests/month
- Average duration: 500ms
- Memory: 512MB
- Cost: ~$50/month

### After Split (5 API Lambdas):
- Same 1M requests/month
- Average duration: 200ms (due to optimization)
- Memory: Optimized per function
- Cost: ~$35/month

### Savings: 30% reduction despite more Lambdas!

🚨 Risk Mitigation
-----------------
### Risks & Solutions:
1. **Risk**: Breaking changes during split
   **Solution**: Comprehensive integration tests

2. **Risk**: Increased complexity
   **Solution**: Shared Lambda Layer for common code

3. **Risk**: Database connection limits
   **Solution**: RDS Proxy for connection pooling

4. **Risk**: Cache inconsistency  
   **Solution**: Cache invalidation patterns

5. **Risk**: Authentication across Lambdas
   **Solution**: JWT tokens, no server session

🎯 Success Criteria
------------------
### Must Have:
- [ ] <3 second cold starts
- [ ] <500ms average response time
- [ ] Zero downtime migration
- [ ] 99.9% uptime
- [ ] No increase in errors

### Nice to Have:
- [ ] 50% cost reduction
- [ ] <1 second cold starts
- [ ] Auto-scaling based on traffic
- [ ] A/B testing capability

📝 Migration Checklist
---------------------
### Pre-Migration:
- [ ] All tests passing
- [ ] Performance baselines recorded
- [ ] Rollback plan tested
- [ ] CloudWatch dashboards ready
- [ ] Team notification sent

### During Migration:
- [ ] Deploy new Lambdas
- [ ] Configure API Gateway routes
- [ ] Start with 5% traffic
- [ ] Monitor error rates
- [ ] Gradually increase traffic

### Post-Migration:
- [ ] Verify all endpoints working
- [ ] Check performance metrics
- [ ] Update documentation
- [ ] Remove old Lambda (after 2 weeks)
- [ ] Celebrate! 🎉

🔄 Alternative Approach: Incremental Extraction
----------------------------------------------
If the full split seems too risky, consider incremental extraction:

### Month 1: Players Lambda only
- Extract just the Players endpoints
- Highest traffic, biggest win
- Learn from this experience

### Month 2: Auth Lambda
- Extract authentication
- Add enhanced security

### Month 3: League Split
- Split league reads and writes
- Add caching layer

### Month 4-6: Optimization
- Add Redis caching
- Performance tuning
- Native mobile apps

This incremental approach reduces risk but takes longer.

---
Last Updated: January 2025
Next Review: February 2025
Owner: Dynasty Dugout Team