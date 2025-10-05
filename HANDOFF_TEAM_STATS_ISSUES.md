# Team Stats Page Issues - Handoff Document
**Date:** Current Session  
**Status:** 🔴 CRITICAL - Data Not Loading, Missing Stats

---

## 🚨 CURRENT PROBLEMS

### 1. **Data Not Loading - All Columns Show "-"**
- Screenshot shows empty data (all dashes)
- Backend returns canonical structure but frontend can't access it
- **Root Cause:** Possible mismatch in data parsing

### 2. **Backend Not Sending ALL 35+ Stats**
- Even though canonical structure uses `.dict()`, it's NOT sending full stat set
- Only sending limited stats (same 10 as before the fix)
- Need to verify Pydantic models have all 35+ stats

### 3. **Column Widths Not Applying**
- ✅ **FIXED THIS SESSION** - className function now works
- Narrow widths (48px, 24px, 21px) should now apply
- Thin lines every 3rd row should now work

---

## ✅ FIXES COMPLETED THIS SESSION

### File: `/frontend-react/src/services/tables/DynastyTable.js`
**Line 437:** Changed className to support functions:
```javascript
// BEFORE:
${column.className || ''}

// AFTER:
${typeof column.className === 'function' ? column.className(row, index) : (column.className || '')}
```

**Result:** Column className functions now execute properly for:
- Thin lines every 3rd row
- Dynamic styling based on row data

### File: `/frontend-react/src/pages/league-dashboard/TeamStats.js`
**Line 94:** Added support for backend's `hitters` key:
```javascript
// BEFORE:
batting: league.scoring_categories.hitting || league.scoring_categories.batting || DEFAULT_BATTING_STATS

// AFTER:
batting: league.scoring_categories.hitters || league.scoring_categories.hitting || league.scoring_categories.batting || DEFAULT_BATTING_STATS
```

**Result:** Dynamic stats now read correctly from league settings

---

## 🔍 INVESTIGATION NEEDED

### **Priority 1: Why Is Data Not Loading?**

**Check in Console:**
```javascript
// In browser console on Team Stats page:
const response = await fetch('/api/leagues/YOUR_LEAGUE_ID/team-stats-dashboard/YOUR_TEAM_ID');
const data = await response.json();
console.log('First player:', data.team_stats?.[0]);
```

**Expected Structure:**
```javascript
{
  ids: { mlb: 12345, league_player: "uuid" },
  info: { player_name: "Mike Trout", position: "OF", mlb_team: "LAA" },
  stats: {
    season: { batting_avg: 0.283, home_runs: 40, ... },  // ← ALL 35+ stats
    rolling_14_day: { batting_avg: 0.300, ... },
    team_attribution: { batting_avg: 0.290, ... }
  },
  league_context: { roster_status: "active", salary: 45, ... }
}
```

**What to Look For:**
1. Is `stats.season` present?
2. Does `stats.season` have ALL fields (batting_avg, at_bats, hits, ops, doubles, triples, walks, etc.)?
3. Or does it only have 10 fields (games_played, batting_avg, home_runs, rbi, runs, stolen_bases)?

---

### **Priority 2: Backend Canonical Structure - Verify Full Stats**

**File to Check:** `/backend/src/routers/leagues/players/team_stats.py`

**Around line 272-298 - Look for:**
```python
player_dict = {
    "ids": {
        "mlb": player.mlb_player_id,
        "league_player": player.league_player_id
    },
    "info": {...},
    "stats": {
        "season": player.season_stats.dict(),  # ← Does Pydantic model have ALL stats?
        "rolling_14_day": player.rolling_14_day.dict(),
        "team_attribution": player.accrued_stats.dict()
    },
    "league_context": {...}
}
```

**Check if Pydantic models are complete:**

**File:** `/backend/src/routers/leagues/players/team_stats.py` (around line 88-113)

Look at `SeasonStats` Pydantic model - does it have:
```python
class SeasonStats(BaseModel):
    games_played: int = 0
    at_bats: int = 0  # ← Is this here?
    hits: int = 0  # ← Is this here?
    batting_avg: float = 0.0
    home_runs: int = 0
    rbi: int = 0
    runs: int = 0
    stolen_bases: int = 0
    ops: float = 0.0  # ← Is this here?
    obp: float = 0.0
    slg: float = 0.0
    doubles: int = 0
    triples: int = 0
    walks: int = 0
    strikeouts: int = 0
    # ... ALL 35+ stats?
```

**If missing stats:** Add them to Pydantic model AND verify SQL query fetches them (lines 39-87)

---

### **Priority 3: Frontend Data Parsing - parseCanonicalPlayer()**

**File:** `/frontend-react/src/pages/league-dashboard/TeamStats.js` (around line 177)

**Check if this function works:**
```javascript
const parseCanonicalPlayer = (canonicalPlayer) => {
  return {
    mlb_player_id: canonicalPlayer.ids?.mlb,
    league_player_id: canonicalPlayer.ids?.league_player,
    player_name: canonicalPlayer.info?.player_name,
    position: canonicalPlayer.info?.position,
    mlb_team: canonicalPlayer.info?.mlb_team,
    
    // ← CRITICAL: Are these nested paths correct?
    season_stats: canonicalPlayer.stats?.season || {},
    rolling_14_day: canonicalPlayer.stats?.rolling_14_day || {},
    accrued_stats: canonicalPlayer.stats?.team_attribution || {},
    
    roster_status: canonicalPlayer.league_context?.roster_status || 'active',
    salary: canonicalPlayer.league_context?.salary,
    contract_years: canonicalPlayer.league_context?.contract_years,
    // ... etc
  };
};
```

**Test:** Log the output to verify transformation works:
```javascript
console.log('Parsed player:', parseCanonicalPlayer(data.team_stats[0]));
```

---

## 🎯 QUICK FIX CHECKLIST

### **Step 1: Verify Data Structure**
```bash
# In browser console on Team Stats page:
const response = await fetch('/api/leagues/YOUR_LEAGUE_ID/team-stats-dashboard/YOUR_TEAM_ID');
const data = await response.json();
console.log('Raw data:', data);
console.log('First player:', data.team_stats?.[0]);
console.log('Season stats:', data.team_stats?.[0]?.stats?.season);
```

### **Step 2: Check Backend Pydantic Models**
1. Open `/backend/src/routers/leagues/players/team_stats.py`
2. Find `SeasonStats` class (around line 88-113)
3. Verify it has ALL 35+ stat fields
4. If missing: Add them

### **Step 3: Verify SQL Query Fetches All Stats**
1. Same file, lines 39-87
2. Check if SQL SELECT includes: `at_bats`, `hits`, `ops`, `obp`, `slg`, `doubles`, `triples`, etc.
3. If missing: Add them to SQL query

### **Step 4: Test Data Flow**
```javascript
// In browser console:
// 1. Check raw backend response
// 2. Check parseCanonicalPlayer output
// 3. Check if activeLineupRows has data
// 4. Check if columns can access the data
```

---

## 📊 EXPECTED BEHAVIOR AFTER FIXES

### **Column Widths:**
- POS: 30px
- Player: 48px (was 120px)
- Team: 24px (was 40px)
- G, AB, H: 21px each (was 35px)
- Dynamic stats: 24px each (was 40px)
- Price/Salary/Contract: 45-60px

### **Visual:**
- ✅ Thin horizontal lines every 3rd row
- ✅ No leading zeros (.266 not 0.266)
- ✅ 3-line format (Season, 14-Day, Accrued)
- ✅ Dynamic columns from league settings

### **Data:**
- ✅ All player names visible
- ✅ All teams visible
- ✅ ALL stats showing (not just 10)
- ✅ Stats formatted correctly

---

## 🔑 KEY FILES TO CHECK

1. **Backend Data Source:**
   - `/backend/src/routers/leagues/players/team_stats.py` (lines 39-298)

2. **Frontend Data Parsing:**
   - `/frontend-react/src/pages/league-dashboard/TeamStats.js` (lines 177-200, parseCanonicalPlayer)

3. **Frontend Column Config:**
   - `/frontend-react/src/services/tables/teamStatsColumns.js` (entire file)

4. **Frontend Table Renderer:**
   - `/frontend-react/src/services/tables/DynastyTable.js` (line 437 - className fix)

5. **Stat Field Mapping:**
   - `/frontend-react/src/utils/statMapping.js` (STAT_FIELD_MAP)

---

## 🚀 DEPLOYMENT STATUS

### **Files Changed This Session:**
1. ✅ `/frontend-react/src/services/tables/DynastyTable.js` - className function fix
2. ✅ `/frontend-react/src/pages/league-dashboard/TeamStats.js` - hitters key support

### **Files Changed Previous Session:**
1. `/backend/src/routers/leagues/players/team_stats.py` - canonical structure
2. `/frontend-react/src/services/tables/DynastyTable.js` - leading zero removal
3. `/frontend-react/src/pages/league-dashboard/TeamStats.js` - parseCanonicalPlayer
4. `/frontend-react/src/services/tables/teamStatsColumns.js` - narrow columns, thin lines

### **Deployment Needed:**
- ✅ Backend: Already deployed (canonical structure)
- ❌ Frontend: NEEDS DEPLOYMENT (2 new fixes this session)

---

## 💡 MOST LIKELY ROOT CAUSE

**Backend Pydantic model `SeasonStats` is incomplete!**

Even though we switched to `.dict()`, if the Pydantic model only defines 10 fields, then `.dict()` only outputs 10 fields.

**Solution:**
1. Add ALL 35+ stat fields to `SeasonStats` Pydantic model
2. Ensure SQL query fetches all those fields
3. Re-deploy backend

---

## 📝 NEXT SESSION PRIORITIES

1. **Console log the API response** - see actual data structure
2. **Verify Pydantic models have all stats** - add missing fields
3. **Test frontend parsing** - ensure parseCanonicalPlayer works
4. **Deploy frontend fixes** - className function + hitters key
5. **Verify column widths apply** - should be narrow now
6. **Verify thin lines appear** - every 3rd row

---

## 🆘 IF STILL BROKEN AFTER ALL FIXES

**Nuclear Option - Revert to Flat Structure:**

Instead of canonical structure, go back to flat:
```python
# In team_stats.py, return simple flat structure:
player_dict = {
    "mlb_player_id": player.mlb_player_id,
    "player_name": player.player_name,
    "position": player.position,
    "mlb_team": player.mlb_team,
    "season_stats": player.season_stats.dict(),  # All stats at this level
    "rolling_14_day": player.rolling_14_day.dict(),
    "accrued_stats": player.accrued_stats.dict(),
    "roster_status": player.roster_status,
    "salary": player.salary,
    # ... etc
}
```

Then remove `parseCanonicalPlayer()` and access data directly.

---

**END OF HANDOFF - Good luck!** 🚀
