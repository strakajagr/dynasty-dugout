# Canonical Player Data Migration Guide

**Date:** September 30, 2025
**Status:** ✅ Backend & apiService Updated - Frontend Pages Need Migration

---

## What Changed

We've standardized player data structure across the entire app. Before, different endpoints returned player IDs inconsistently (`player_id`, `mlb_player_id`, `league_player_id`). Now, every endpoint returns a consistent structure.

## New Canonical Structure

```javascript
{
  "ids": {
    "mlb": 545361,              // Always present - MLB official ID
    "league_player": "uuid...", // Only if rostered in a league
    "league": "uuid..."         // Only in league context
  },
  "info": {
    "first_name": "Mike",
    "last_name": "Trout",
    "full_name": "Mike Trout",
    "position": "OF",
    "mlb_team": "LAA",
    "active": true
  },
  "stats": {
    "season": {...},
    "team_attribution": {...}  // Only when rostered by user
  },
  "league_context": {          // Only in league-specific endpoints
    "status": "owned|available|other_team",
    "team": {...},
    "roster": {...},
    "financial": {...}
  }
}
```

## Updated Files

### Backend ✅ COMPLETE

1. **`/backend/src/core/canonical_player.py`** - NEW
   - Canonical queries
   - Data formatters
   - Multi-league function

2. **`/backend/src/routers/players_canonical.py`** - NEW
   - `/search` - Global search
   - `/players/{id}/my-leagues` - Multi-league view
   - `/leagues/{id}/players/{id}` - Player in league
   - `/leagues/{id}/free-agents` - Free agents
   - `/leagues/{id}/my-roster` - User's roster

3. **`/backend/src/fantasy_api.py`** - MODIFIED
   - Now imports `players_canonical` instead of `global_stats`

### Frontend ✅ apiService UPDATED, ❌ Pages Need Migration

4. **`/frontend-react/src/services/apiService.js`** - MODIFIED
   - Added `playersAPI.getPlayerAcrossMyLeagues()` - NEW
   - Added `leaguesAPI.getPlayerInLeague()` - NEW
   - Added `leaguesAPI.getMyRosterCanonical()` - NEW
   - Added `leaguesAPI.getFreeAgentsCanonical()` - NEW
   - Legacy methods kept for backwards compatibility

## Migration Path for Frontend Pages

### Phase 1: Update Search (Main Dashboard)

**File:** `/frontend-react/src/pages/...` (wherever search is used)

**Before:**
```javascript
const results = await playersAPI.searchPlayers(searchTerm);
// results.players array has inconsistent structure
const player = results.players[0];
const playerId = player.player_id || player.mlb_player_id; // Confusing!
```

**After:**
```javascript
const results = await playersAPI.searchPlayers(searchTerm);
// results.players array has canonical structure
const player = results.players[0];
const playerId = player.ids.mlb; // Always consistent!
```

### Phase 2: Update Free Agents Page

**Before:**
```javascript
const { players } = await leaguesAPI.getFreeAgents(leagueId, filters);
// players have mixed ID fields
```

**After:**
```javascript
const { players } = await leaguesAPI.getFreeAgentsCanonical(leagueId, filters);
// Each player has: { ids: { mlb: ... }, info: {...}, stats: {...}, financial: {...} }
```

### Phase 3: Update Roster Page

**Before:**
```javascript
const { players } = await leaguesAPI.getMyRoster(leagueId);
// players might have player_id or mlb_player_id
```

**After:**
```javascript
const { players } = await leaguesAPI.getMyRosterCanonical(leagueId);
// Each player has: { ids: { mlb, league_player }, info: {...}, roster: {...}, stats: {...} }
```

### Phase 4: Add Multi-League Feature (NEW)

**New capability - show player across all user's leagues:**

```javascript
const playerData = await playersAPI.getPlayerAcrossMyLeagues(545361);

// playerData structure:
{
  ids: { mlb: 545361 },
  info: { first_name: "Mike", last_name: "Trout", ... },
  stats: { season: {...} },  // Same MLB stats for all leagues
  league_contexts: [
    {
      league_id: "uuid1",
      league_name: "Dynasty League",
      status: "owned",
      team: { team_name: "My Team", ... },
      financial: { contract_salary: 45, ... }
    },
    {
      league_id: "uuid2",
      league_name: "Redraft League",
      status: "available",
      financial: { market_price: 35 }
    }
  ],
  summary: {
    total_leagues: 5,
    owned_in: 2,
    available_in: 3
  }
}
```

## Finding Files That Need Updates

Search for these patterns in React files:

```bash
# Find files that access player IDs the old way
grep -r "player\.player_id\|player\.mlb_player_id" frontend-react/src/

# Find files that call old API methods
grep -r "getFreeAgents\|getMyRoster" frontend-react/src/pages/

# Find files that search for players
grep -r "searchPlayers" frontend-react/src/
```

## Common Patterns to Update

### 1. Accessing Player ID

**Before:**
```javascript
const playerId = player.player_id || player.mlb_player_id || player.id;
```

**After:**
```javascript
const playerId = player.ids.mlb;
```

### 2. Checking Ownership

**Before:**
```javascript
const isOwned = player.team_id != null;
```

**After:**
```javascript
const isOwned = player.league_context?.status === "owned";
const isMyPlayer = player.league_context?.team?.is_user_team === true;
```

### 3. Displaying Stats

**Before:**
```javascript
<td>{player.batting_avg || "N/A"}</td>
<td>{player.home_runs || 0}</td>
```

**After:**
```javascript
<td>{player.stats?.season?.batting_avg?.toFixed(3) || "N/A"}</td>
<td>{player.stats?.season?.home_runs || 0}</td>
```

## Testing Checklist

After migrating each page:

- [ ] Player search returns results
- [ ] Player IDs are accessed correctly (no undefined errors)
- [ ] Stats display properly
- [ ] Free agent page loads
- [ ] Roster page loads
- [ ] Add/drop player works
- [ ] No console errors about missing fields

## Deployment Strategy

**Option 1: Gradual Migration (RECOMMENDED)**
- Keep legacy methods in apiService
- Update pages one at a time
- Test each page before moving to next
- Remove legacy methods after all pages updated

**Option 2: Big Bang**
- Update all pages at once
- Deploy backend + frontend together
- Higher risk but faster

**We recommend Option 1** - it's safer for production.

## Backwards Compatibility

Legacy methods are still available but deprecated:
- `playersAPI.getPlayers()` - use `searchPlayers()` instead
- `leaguesAPI.getFreeAgents()` - use `getFreeAgentsCanonical()` instead
- `leaguesAPI.getMyRoster()` - use `getMyRosterCanonical()` instead

These will show console warnings but continue to work until all pages are migrated.

## Timeline

- **Week 1:** Update 2-3 most-used pages (search, free agents, roster)
- **Week 2:** Update remaining pages
- **Week 3:** Remove legacy methods, full testing
- **Week 4:** Deploy to production

## Need Help?

If you see errors like:
- `Cannot read property 'mlb' of undefined` → player.ids is missing
- `player.batting_avg is undefined` → Check player.stats.season.batting_avg
- `player.team_name is undefined` → Check player.league_context.team.team_name

Check this guide for the correct canonical structure.

## Files Modified in This Session

```
backend/src/
  ├── core/
  │   ├── canonical_player.py          (NEW - 750 lines)
  │   └── error_handlers.py            (already deployed)
  ├── routers/
  │   └── players_canonical.py         (NEW - 300 lines)
  └── fantasy_api.py                   (MODIFIED - 1 line changed)

frontend-react/src/services/
  └── apiService.js                    (MODIFIED - added canonical methods)
```

## Next Steps

1. **Deploy backend:**
   ```bash
   cd backend
   sam build
   sam deploy
   ```

2. **Test new endpoints:**
   - `/api/players/search?q=Trout`
   - `/api/players/players/545361/my-leagues`
   - `/api/players/leagues/{id}/free-agents`

3. **Update one frontend page as a test**

4. **Once working, update remaining pages systematically**

---

**Bottom Line:** Player data is now consistent everywhere. No more checking 3 different ID fields. Use `player.ids.mlb` and `player.stats.season` for everything.
