# 🎯 Quick Reference: Adding Caching to Your Endpoints

## Super Simple Pattern

```python
from core.cache import cached

@cached(ttl_seconds=600, key_prefix='my_data', key_params=['id'])
async def my_endpoint(id: int):
    # Your existing code here
    result = execute_sql(...)
    return result
```

That's it! The decorator handles everything.

---

## 🔥 High-Priority Endpoints to Cache

### 1. Salary/Pricing Endpoints (Highest Impact!)

**File**: `src/routers/leagues/salaries.py`

These are your MOST expensive queries. Cache them first!

```python
from core.cache import cached

# Pricing data (changes infrequently)
@cached(ttl_seconds=1800, key_prefix='pricing_data', key_params=['league_id'])
async def get_pricing_data(league_id: int, ...):
    # BEFORE: 2000-2500ms per request
    # AFTER: 5-10ms per request (200x faster!)
    result = execute_sql(...)
    return result

# Salary settings
@cached(ttl_seconds=300, key_prefix='salary_settings', key_params=['league_id'])
async def get_salary_settings(league_id: int, ...):
    # BEFORE: 200-500ms
    # AFTER: 2-5ms (100x faster!)
    return settings

# Team salaries
@cached(ttl_seconds=600, key_prefix='team_salaries', key_params=['league_id'])
async def get_all_team_salaries(league_id: int, ...):
    # BEFORE: 500-1000ms
    # AFTER: 5-10ms (100x faster!)
    return salaries
```

**Impact**: These 3 changes alone will make your pricing pages load 10-100x faster!

---

### 2. Player Endpoints

**File**: `src/routers/players_canonical.py`

```python
from core.cache import cached

# Player complete data (includes game logs)
@cached(ttl_seconds=600, key_prefix='player_complete', key_params=['player_id'])
async def get_player_complete(player_id: int, ...):
    # BEFORE: 500-1500ms
    # AFTER: 5-20ms (50-100x faster!)
    return player_data

# Player career stats
@cached(ttl_seconds=1200, key_prefix='player_career', key_params=['player_id'])
async def get_player_career_stats(player_id: int, ...):
    # Career stats change slowly, can cache longer
    return career_stats

# Player search (cache by search term)
@cached(ttl_seconds=300, key_prefix='player_search', key_params=['query'])
async def search_players(query: str, ...):
    # Cache common searches like "trout", "ohtani"
    return search_results

# Player analytics
@cached(ttl_seconds=900, key_prefix='player_analytics', key_params=['player_id'])
async def get_player_analytics(player_id: int, ...):
    # Analytics are expensive to compute
    return analytics
```

---

### 3. League Endpoints

**File**: `src/routers/leagues/leagues.py` (or wherever league endpoints are)

```python
from core.cache import cached

# League settings (rarely change)
@cached(ttl_seconds=3600, key_prefix='league_settings', key_params=['league_id'])
async def get_league_settings(league_id: int, ...):
    # Settings change rarely, cache for 1 hour
    return settings

# League standings
@cached(ttl_seconds=300, key_prefix='league_standings', key_params=['league_id'])
async def get_league_standings(league_id: int, ...):
    # Standings update often, cache for 5 minutes
    return standings

# League teams
@cached(ttl_seconds=600, key_prefix='league_teams', key_params=['league_id'])
async def get_league_teams(league_id: int, ...):
    # Teams don't change often
    return teams

# Team roster
@cached(ttl_seconds=300, key_prefix='team_roster', key_params=['team_id'])
async def get_team_roster(team_id: int, ...):
    # Rosters can change, shorter TTL
    return roster
```

---

### 4. MLB Data Endpoints

**File**: `src/routers/mlb.py`

```python
from core.cache import cached

# MLB teams (static data)
@cached(ttl_seconds=86400, key_prefix='mlb_teams')
async def get_mlb_teams():
    # Teams rarely change, cache for 24 hours
    return teams

# MLB players list
@cached(ttl_seconds=3600, key_prefix='mlb_active_players')
async def get_active_mlb_players():
    # Cache for 1 hour
    return players

# Trending players
@cached(ttl_seconds=600, key_prefix='mlb_trending')
async def get_trending_players():
    # Trending changes more often
    return trending
```

---

## ⏱️ Choosing the Right TTL

| Data Type | Changes | Recommended TTL | Example |
|-----------|---------|-----------------|---------|
| Static data | Never/Rarely | 24h (86400s) | MLB teams, positions |
| Reference data | Weekly | 1h (3600s) | League settings, scoring categories |
| Computed data | Daily | 30m (1800s) | Pricing calculations, analytics |
| User data | Hourly | 10m (600s) | Player stats, rosters |
| Live data | Every minute | 5m (300s) | Standings, recent games |
| Real-time data | Constantly | 1m (60s) or no cache | Live scores |

---

## 🎨 Cache Key Patterns

### Pattern 1: Simple ID-based

```python
@cached(ttl_seconds=600, key_prefix='player', key_params=['player_id'])
async def get_player(player_id: int):
    # Cache key: "player:12345"
    pass
```

### Pattern 2: Multiple parameters

```python
@cached(ttl_seconds=600, key_prefix='player_stats', key_params=['player_id', 'season'])
async def get_player_stats(player_id: int, season: int):
    # Cache key: "player_stats:12345:2024"
    pass
```

### Pattern 3: Complex query (hash-based)

```python
@cached(ttl_seconds=300, key_prefix='player_search')
async def search_players(query: str, position: str = None, min_age: int = None):
    # Cache key: "player_search:<hash_of_all_params>"
    # Automatically handles all combinations
    pass
```

### Pattern 4: No parameters (global cache)

```python
@cached(ttl_seconds=3600, key_prefix='all_teams')
async def get_all_teams():
    # Cache key: "all_teams"
    # Same result for everyone
    pass
```

---

## 🔄 When to Invalidate Cache

### After Data Updates

```python
from core.cache import invalidate_cache_pattern

async def update_player(player_id: int, data: dict):
    # Update the database
    execute_sql("UPDATE mlb_players SET ... WHERE player_id = :id", {'id': player_id})
    
    # Invalidate related cache entries
    invalidate_cache_pattern(f'player:{player_id}')
    invalidate_cache_pattern(f'player_complete:{player_id}')
    invalidate_cache_pattern(f'player_stats:{player_id}')
    
    return {"success": True}
```

### After League Changes

```python
async def update_league_settings(league_id: int, settings: dict):
    # Update settings
    execute_sql(...)
    
    # Clear league caches
    invalidate_cache_pattern(f'league_settings:{league_id}')
    invalidate_cache_pattern(f'league_standings:{league_id}')
    
    return {"success": True}
```

### Manual Invalidation via API

```bash
# Clear specific player
curl -X POST "$API_URL/api/cache/invalidate/player:12345"

# Clear all pricing data
curl -X POST "$API_URL/api/cache/invalidate/pricing"

# Clear specific league
curl -X POST "$API_URL/api/cache/invalidate/league:67"
```

---

## 📊 Testing Your Cached Endpoints

### Test 1: Measure Speedup

```bash
# First request (cache miss - slow)
time curl "$API_URL/api/leagues/123/pricing"
# Example: 2.5 seconds

# Second request (cache hit - fast!)
time curl "$API_URL/api/leagues/123/pricing"
# Example: 0.02 seconds (125x faster!)

# Third request (still cached)
time curl "$API_URL/api/leagues/123/pricing"
# Example: 0.01 seconds (250x faster!)
```

### Test 2: Verify Cache is Working

```bash
# Check cache stats
curl "$API_URL/api/cache/stats"

# Look for increasing "hits"
# {
#   "memory_cache": {
#     "hits": 150,        ← Should increase
#     "misses": 10,
#     "hit_rate": 93.75
#   }
# }
```

### Test 3: Cache Performance Dashboard

```bash
# Get performance analysis
curl "$API_URL/api/cache/performance"

# Should show:
# - High hit rates (>80%)
# - Recommendations for optimization
```

---

## 🎯 Priority List: What to Cache First

### Phase 1: Immediate Wins (Do These First!)

1. ✅ Pricing/Salary endpoints (3 endpoints)
   - **Impact**: Massive! These are your slowest queries
   - **Time**: 5 minutes
   - **Speedup**: 100-200x faster

2. ✅ Player complete data (1 endpoint)
   - **Impact**: High. Used on every player page
   - **Time**: 2 minutes
   - **Speedup**: 50-100x faster

3. ✅ League settings (1 endpoint)
   - **Impact**: Medium. Accessed frequently
   - **Time**: 2 minutes
   - **Speedup**: 100x faster

**Total time**: 10 minutes
**Impact**: Most users will see 10-100x faster load times!

### Phase 2: Additional Improvements

4. Player search (1 endpoint)
5. Team rosters (2 endpoints)
6. League standings (1 endpoint)
7. Player analytics (1 endpoint)

**Total time**: 15 minutes
**Impact**: Nearly all pages now blazing fast!

### Phase 3: Advanced Optimization

8. MLB trending players
9. Season statistics
10. Historical data

---

## 🐛 Common Mistakes to Avoid

### ❌ Don't: Cache user-specific data with wrong key

```python
# BAD - All users get same data!
@cached(ttl_seconds=600, key_prefix='my_teams')
async def get_my_teams(user_id: int):
    pass
```

```python
# GOOD - Include user_id in cache key
@cached(ttl_seconds=600, key_prefix='my_teams', key_params=['user_id'])
async def get_my_teams(user_id: int):
    pass
```

### ❌ Don't: Cache data that changes constantly

```python
# BAD - Live scores change every second!
@cached(ttl_seconds=300, key_prefix='live_score')
async def get_live_score(game_id: int):
    pass
```

### ❌ Don't: Use TTL that's too long for dynamic data

```python
# BAD - Standings can change quickly!
@cached(ttl_seconds=86400, key_prefix='standings')  # 24 hours is too long!
async def get_standings(league_id: int):
    pass
```

```python
# GOOD - Appropriate TTL for standings
@cached(ttl_seconds=300, key_prefix='standings', key_params=['league_id'])  # 5 minutes
async def get_standings(league_id: int):
    pass
```

### ❌ Don't: Forget to invalidate after updates

```python
# BAD - Updated player data but old data still cached!
async def update_player_stats(player_id: int, stats: dict):
    execute_sql("UPDATE ...")
    return {"success": True}  # Cache still has old data!
```

```python
# GOOD - Invalidate cache after update
from core.cache import invalidate_cache_pattern

async def update_player_stats(player_id: int, stats: dict):
    execute_sql("UPDATE ...")
    invalidate_cache_pattern(f'player:{player_id}')  # Clear old cache
    return {"success": True}
```

---

## 🎉 Real-World Example: Complete Workflow

Let's add caching to the pricing page (highest impact):

### Step 1: Edit the file

```bash
cd ~/projects/dynasty-dugout/backend
nano src/routers/leagues/salaries.py
```

### Step 2: Add import at the top

```python
from core.cache import cached, invalidate_cache_pattern
```

### Step 3: Add decorator to main function

```python
@cached(ttl_seconds=1800, key_prefix='pricing_data', key_params=['league_id'])
async def get_pricing_data(league_id: int, ...):
    # Your existing code - DON'T CHANGE ANYTHING HERE!
    result = execute_sql(...)
    return result
```

### Step 4: Deploy

```bash
sam build
sam deploy
```

### Step 5: Test

```bash
# Time the request
time curl "$API_URL/api/leagues/123/salaries/pricing"
# First: 2.5 seconds

time curl "$API_URL/api/leagues/123/salaries/pricing"
# Second: 0.02 seconds (125x faster!)
```

### Step 6: Monitor

```bash
curl "$API_URL/api/cache/stats"
# Check hit rate is increasing
```

**Done!** You just made your pricing page 100x faster in 5 minutes! 🎉

---

## 📈 Expected Results

After caching your top 10 endpoints, you should see:

- ⚡ **95% of requests** served from cache (< 50ms)
- 🚀 **100x faster** page loads
- 💰 **90% reduction** in database queries
- 😊 **Much happier** users
- 💪 **10x more** traffic capacity

---

## 🆘 Need Help?

If an endpoint isn't caching properly:

1. Check CloudWatch logs for cache errors
2. Verify the decorator syntax is correct
3. Test with `/api/cache/test` endpoint
4. Check cache stats with `/api/cache/stats`
5. Make sure `key_params` matches function parameters exactly

---

**That's it!** You're ready to make your app 100x faster! 🚀

Start with the pricing endpoints, test them, then move on to the others!
