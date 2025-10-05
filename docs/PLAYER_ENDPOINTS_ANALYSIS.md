# Player Endpoints Analysis - Frontend Usage Report

**Date:** September 30, 2025  
**Purpose:** Map all player endpoint calls between frontend and backend

---

## 📊 SUMMARY

### Backend Status (players_canonical.py)
- **Total Endpoints:** 10
- **Being Called by Frontend:** 3
- **Defined but Not Called:** 4
- **Missing (Called but Not Exist):** 2-3

---

## ✅ ENDPOINTS THAT EXIST AND ARE BEING USED

### 1. **Complete Player Profile**
**Backend:** `GET /api/players/{player_id}/complete`  
**Also Aliased As:** `GET /api/players/{player_id}`

**Frontend Usage:**
- **File:** `/frontend-react/src/hooks/usePlayerData.js` (Line ~36)
- **Call:** `api.get(/api/players/${playerId}/complete?league_id=${leagueId})`
- **Used By:** 
  - PlayerProfile.js page
  - Any component using usePlayerData hook

**Data Returned:**
```javascript
{
  player_id, first_name, last_name, position, mlb_team, ...
  season_stats: { batting_avg, home_runs, ... },
  rolling_14_day: { games, at_bats, hits, ... },
  career_stats: [...],
  game_logs: [...],
  contract_info: { ... },
  analytics: { ... }
}
```

**Status:** ✅ **WORKING** - This is the primary player data endpoint

---

### 2. **Global Player Search**
**Backend:** `GET /api/players/search?q={query}&limit={limit}`

**Frontend Usage:**
- **File:** `/frontend-react/src/components/PlayerSearchDropdown.js` (Line ~64)
- **Call:** `apiService.players.searchPlayers(trimmedQuery, 12)`
- **Used By:**
  - Dashboard search bar
  - Global player search

**Data Returned:**
```javascript
{
  success: true,
  players: [
    {
      ids: { mlb: 12345 },
      info: { first_name, last_name, position, mlb_team },
      stats: { batting_avg, home_runs, ... }
    }
  ],
  count: 10,
  query: "..."
}
```

**Status:** ✅ **WORKING** - Global search using canonical structure

---

### 3. **Player Fallback Endpoint**
**Backend:** `GET /api/players/{player_id}`

**Frontend Usage:**
- **File:** `/frontend-react/src/hooks/usePlayerData.js` (Line ~136)
- **Call:** `api.get(/api/players/${playerId})`
- **Used By:** Fallback when /complete fails

**Status:** ✅ **WORKING** - Alias for /complete endpoint

---

## 🔍 ENDPOINTS THAT EXIST BUT ARE NOT BEING CALLED

These are defined in apiService.js but no frontend components are calling them (because /complete returns all the data):

### 4. **Career Stats Endpoint**
**Backend:** `GET /api/players/{player_id}/career-stats`  
**Frontend API Method:** `playersAPI.getCareerStats(playerId)`  
**Status:** ⚠️ **DEFINED BUT UNUSED** - Data comes from /complete

### 5. **Game Logs Endpoint**
**Backend:** `GET /api/players/{player_id}/game-logs?limit={limit}&days={days}`  
**Frontend API Method:** `playersAPI.getGameLogs(playerId, options)`  
**Status:** ⚠️ **DEFINED BUT UNUSED** - Data comes from /complete

### 6. **Recent Performance Endpoint**
**Backend:** `GET /api/players/{player_id}/recent-performance?days={days}`  
**Frontend API Method:** `playersAPI.getRecentPerformance(playerId, days)`  
**Status:** ⚠️ **DEFINED BUT UNUSED** - Data comes from /complete

### 7. **Multi-League Player View**
**Backend:** `GET /api/players/players/{player_id}/my-leagues`  
**Frontend API Method:** `playersAPI.getPlayerAcrossMyLeagues(playerId)`  
**Status:** ⚠️ **DEFINED BUT UNUSED** - Feature not implemented in UI yet

---

## ❌ ENDPOINTS BEING CALLED BUT MISSING FROM players_canonical.py

### 8. **Pitcher Tile Analytics**
**Frontend Call:** 
- **File:** `/frontend-react/src/components/player/PlayerGameLogsTab.js` (Line ~23)
- **Call:** `playersAPI.getPitcherTileAnalytics(playerId, leagueId)`
- **Endpoint:** `GET /api/players/{player_id}/pitcher-tile-analytics?league_id={leagueId}`

**Status:** ❌ **MISSING** - Not found in players_canonical.py

**Frontend Usage:** Called by PlayerGameLogsTab when displaying pitcher analytics tiles

---

### 9. **Hitter Tile Analytics**
**Frontend Call:**
- **File:** `/frontend-react/src/components/player/PlayerGameLogsTab.js` (Line ~24)
- **Call:** `playersAPI.getHitterTileAnalytics(playerId, leagueId)`
- **Endpoint:** `GET /api/players/{player_id}/hitter-tile-analytics?league_id={leagueId}`

**Status:** ❌ **MISSING** - Not found in players_canonical.py

**Frontend Usage:** Called by PlayerGameLogsTab when displaying hitter analytics tiles

---

### 10. **General Analytics Endpoint**
**Frontend API Method:** `playersAPI.getAnalytics(playerId)`  
**Endpoint:** `GET /api/players/{player_id}/analytics`

**Status:** ❓ **UNKNOWN** - Defined in apiService.js, not sure if called or if it exists

---

## 🎯 LEAGUE-CONTEXT ENDPOINTS (Also in players_canonical.py)

These endpoints are for league-specific player data:

### 11. **Player in League Context**
**Backend:** `GET /api/players/leagues/{league_id}/players/{player_id}`  
**Frontend:** `leaguesAPI.getPlayerInLeague(leagueId, playerId)`  
**Status:** ✅ Exists, used for league-specific player views

### 12. **Free Agents in League**
**Backend:** `GET /api/players/leagues/{league_id}/free-agents`  
**Frontend:** `leaguesAPI.getFreeAgentsCanonical(leagueId, filters)`  
**Status:** ✅ Exists, used by FreeAgentSearch page

### 13. **My Roster in League**
**Backend:** `GET /api/players/leagues/{league_id}/my-roster`  
**Frontend:** `leaguesAPI.getMyRosterCanonical(leagueId)`  
**Status:** ✅ Exists, used by MyRoster page

---

## 🚨 CRITICAL ISSUES

### **Issue 1: Missing Tile Analytics Endpoints**

The frontend is actively calling these endpoints but they don't exist in `players_canonical.py`:
- `/api/players/{player_id}/pitcher-tile-analytics`
- `/api/players/{player_id}/hitter-tile-analytics`

**Impact:** PlayerGameLogsTab will fail to load analytics tiles.

**Possible Locations:**
1. Old `players.py` file (not currently being used)
2. Separate analytics router
3. Need to be created

**Action Needed:** Find where these endpoints are defined and:
- Option A: Add them to `players_canonical.py`
- Option B: Keep them in separate analytics router
- Option C: Create them if they don't exist

---

## 📋 RECOMMENDATIONS

### Short Term (Critical)
1. **Find the tile analytics endpoints** - Search old players.py or other routers
2. **Add missing endpoints to players_canonical.py** if they exist elsewhere
3. **Test all player profile views** to ensure no broken functionality

### Medium Term (Optimization)
1. **Remove unused API methods** from apiService.js to reduce confusion
2. **Document which endpoints return which data** to avoid duplicate calls
3. **Consider if /complete endpoint should be split** (currently returns everything)

### Long Term (Enhancement)
1. **Implement multi-league player view** (endpoint exists, UI doesn't use it yet)
2. **Add response models** to all endpoints for type safety
3. **Create integration tests** for critical player data flows

---

## 📁 FILE LOCATIONS REFERENCE

### Backend
- **Main Player Router:** `/backend/src/routers/players_canonical.py`
- **Old Player Router:** `/backend/src/routers/players.py` (not being used)
- **API Service:** `/backend/src/fantasy_api.py` (routes to players_canonical)

### Frontend
- **API Service:** `/frontend-react/src/services/apiService.js`
- **Player Data Hook:** `/frontend-react/src/hooks/usePlayerData.js`
- **Player Profile Page:** `/frontend-react/src/pages/PlayerProfile.js`
- **Player Components:** `/frontend-react/src/components/player/`
  - PlayerGameLogsTab.js (calls tile analytics)
  - PlayerCareerTab.js (receives data via props)
  - PlayerOverviewTab.js (receives data via props)

### Search Components
- **Global Search:** `/frontend-react/src/components/PlayerSearchDropdown.js`
- **League Search:** `/frontend-react/src/components/PlayerSearchDropdownLeague.js`

---

## ✅ NEXT STEPS

1. **Search for tile analytics endpoints** in:
   - Old players.py file
   - Any analytics-specific routers
   - Backend search for "tile" or "analytics"

2. **Test current functionality:**
   ```bash
   # Test player profile loads
   curl https://your-api/api/players/123/complete
   
   # Test search works
   curl https://your-api/api/players/search?q=Trout
   ```

3. **Deploy and verify:**
   - Build: `cd backend && sam build`
   - Deploy: `sam deploy`
   - Test: Run smoke tests

4. **Frontend verification:**
   - Open player profile page
   - Check console for any 404 errors
   - Verify all tabs load correctly

---

**Document Status:** Complete  
**Last Updated:** September 30, 2025  
**Created By:** Claude (MCP Analysis)
