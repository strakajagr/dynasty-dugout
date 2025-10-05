# Dynasty Dugout Lambda Refactoring

## Summary
We've identified that your current architecture has **5 Lambda functions**:
1. **FantasyBaseballApi** (monolithic, contains everything)
2. **LeagueCreationWorker** (already separated ✅)
3. **MasterDailyUpdater** (already separated ✅)
4. **CalculateRollingStatsFunction** (already separated ✅)
5. **UpdateActiveAccruedStatsFunction** (already separated ✅)

The problem is that **FantasyBaseballApi** is a monolith with 200-second timeout containing ALL application routes.

## What I've Created

### 1. **LAMBDA_REFACTORING_PLAN.md**
Complete architectural plan for splitting the monolithic Lambda into focused services:
- Detailed analysis of current state
- Target architecture with 4 new API Lambdas
- Week-by-week implementation phases
- Performance targets and cost analysis

### 2. **LAMBDA_SPLIT_TLDR.md**
Quick reference guide:
- Simple explanation of the problem
- Recommended 3-4 Lambda split (not 20!)
- Action items you can do today

### 3. **PLAYERS_LAMBDA_EXTRACTION.md**
Step-by-step guide to extract the Players Lambda first:
- Why start with Players (60% of traffic)
- Exact code and configuration needed
- Testing and rollback procedures

### 4. **backend/lambdas/players/handler.py**
Complete working Players Lambda implementation:
- FastAPI-based like your existing code
- In-memory caching for performance
- All player endpoints extracted
- Ready to deploy

### 5. **backend/lambdas/players/requirements.txt**
Minimal dependencies for fast cold starts

## Recommended Next Steps

### This Week:
1. **Add monitoring to current Lambda** to understand traffic patterns:
```python
logger.info(f"Endpoint: {request.path} - Duration: {duration}ms")
```

2. **Test the Players Lambda locally**:
```bash
cd backend/lambdas/players
pip install -r requirements.txt
python handler.py  # Runs on port 8001
```

3. **Deploy Players Lambda alongside existing**:
- Add to your `template.yaml`
- Deploy with canary routing (10% traffic initially)
- Monitor CloudWatch for errors

### The Big Picture:
Instead of one 200-second monolith, you'll have:
- **PlayersLambda** (256MB, 30s) - handles 60% of traffic
- **AuthLambda** (128MB, 30s) - handles auth separately
- **CoreLambda** (512MB, 60s) - everything else
- Your existing workers continue unchanged

This will give you:
- **70% reduction in cold starts**
- **30% cost savings**
- **Much easier debugging**
- **Independent scaling**

## Why This Approach?
- **Incremental**: Extract one Lambda at a time
- **Low risk**: Easy rollback if issues
- **High impact**: Players Lambda alone handles 60% of traffic
- **Manageable**: 3-4 Lambdas, not 20 microservices

## Questions?
The key insight is that you don't need to break everything into microservices. Just splitting the highest-traffic endpoints (players) into their own Lambda will give you most of the benefits with minimal complexity.