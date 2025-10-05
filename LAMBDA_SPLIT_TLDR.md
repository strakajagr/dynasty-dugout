# Dynasty Dugout - Practical Lambda Split Strategy

## Current Reality Check ✅
You have **5 Lambda functions** today:
```
✅ LeagueCreationWorker     - Async league creation (working fine)
✅ MasterDailyUpdater        - Daily MLB updates (working fine)  
✅ CalculateRollingStats     - Stats calculations (working fine)
✅ UpdateActiveAccruedStats  - Active stats updates (working fine)
⚠️ FantasyBaseballApi       - EVERYTHING ELSE (the problem!)
```

## The Problem with FantasyBaseballApi 🔥
- **200-second timeout** (way too high for an API)
- Contains **8+ routers** with **100+ endpoints**
- **12+ second cold starts** 
- **Hard to debug** - which endpoint is slow?
- **Expensive** - always provisioned for worst case

## Proposed Solution: Split into 4 Focused Lambdas 🎯

### Why 4 and not 20?
- You're a **single developer** - keep it manageable
- **4 Lambdas** gives you 80% of the benefits with 20% of the complexity
- Each Lambda has a **clear purpose** and **different performance characteristics**

### The New Architecture:
```
Current:                          New:
FantasyBaseballApi   →→→          PlayersLambda (60% of traffic)
  (everything)                    AuthLambda (10% of traffic)  
                                  LeagueOpsLambda (28% of traffic)
                                  CoreLambda (2% of traffic)
```

## Implementation Order (Start Small, Win Big) 🚀

### Week 1: Extract PlayersLambda
**Why first?** Highest traffic, easiest to cache, biggest performance win

**What moves:**
- `/api/players/search`
- `/api/players/{id}`
- `/api/players/{id}/complete`
- `/api/players/{id}/game-logs`
- `/api/players/{id}/career-stats`
- `/api/players/{id}/recent-performance`

**Quick wins:**
- Add 5-minute caching
- Reduce from 512MB to 256MB
- Cold start: 12s → 3s

### Week 2: Extract AuthLambda  
**Why second?** Security isolation, rate limiting, small and fast

**What moves:**
- `/api/auth/login`
- `/api/auth/signup`
- `/api/auth/verify`
- `/api/auth/refresh`
- `/api/auth/logout`

**Quick wins:**
- Add rate limiting
- Failed login tracking
- Only 128MB needed
- Cold start: 12s → 1s

### Week 3: Keep Everything Else in CoreLambda
**Why?** The remaining endpoints are lower traffic and interconnected

**What stays together:**
- `/api/leagues/*` (all league operations)
- `/api/account/*` (profile management)
- `/api/invitation/*` (invites)
- `/api/utilities/*` (misc)
- `/api/mlb/*` (MLB data)

**This is fine because:**
- Combined, these are only 30% of traffic
- Many interdependencies
- Can optimize later if needed

## The Simplest Path Forward 📋

### Step 1: Add Monitoring First (Do This Today!)
```python
# Add to current Lambda
import time
logger.info(f"Endpoint: {request.path} - Duration: {duration}ms")
```

### Step 2: Create Players Lambda (Week 1)
1. Copy `players_canonical.py` to new Lambda
2. Copy only required dependencies
3. Deploy alongside existing Lambda
4. Route 10% traffic for testing

### Step 3: Monitor and Iterate
- Watch CloudWatch metrics
- Gradually increase traffic
- Add caching once stable

### Step 4: Repeat for Auth Lambda

## What About League Operations? 🤔

**Option A: Keep in CoreLambda** (Recommended)
- Simpler to manage
- Lower traffic anyway
- Can split later if needed

**Option B: Split Later** (If performance demands)
- LeagueReadLambda (GET requests)
- LeagueWriteLambda (POST/PUT/DELETE)
- Only if you see performance issues

## Cost Impact 💰

**Current:**
- 1 Lambda × 512MB × 200s timeout = Higher cost

**New:**
- PlayersLambda: 256MB × 30s = Lower cost
- AuthLambda: 128MB × 30s = Minimal cost  
- CoreLambda: 512MB × 60s = Similar to today

**Result: ~30% cost reduction** despite more Lambdas!

## Success Metrics 📊

After the split, you should see:
- ✅ Player API cold start: <3 seconds (from 12s)
- ✅ Auth API cold start: <1 second (from 12s)
- ✅ Average response time: <200ms (from 500ms+)
- ✅ Cost reduction: 30%
- ✅ Easier debugging (isolated logs)
- ✅ Independent scaling

## Common Pitfalls to Avoid ⚠️

1. **Don't over-engineer:** 4 Lambdas, not 40
2. **Don't break all at once:** Incremental extraction
3. **Don't forget caching:** Biggest performance win
4. **Don't skip monitoring:** Measure before and after
5. **Don't remove old Lambda immediately:** Keep for rollback

## TL;DR - Your Action Items 🎬

1. **Today:** Add logging to see which endpoints are slow
2. **This Week:** Extract PlayersLambda (highest impact)
3. **Next Week:** Extract AuthLambda (security win)
4. **Week 3:** Optimize and add caching
5. **Future:** Split leagues only if needed

Remember: You already have 5 working Lambdas. You're just splitting 1 problematic one into 3-4 focused ones. This is evolution, not revolution!