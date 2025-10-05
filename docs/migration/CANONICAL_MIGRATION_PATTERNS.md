# 📘 CANONICAL MIGRATION PATTERNS

## PURPOSE
This document defines the **canonical data structure** for the Dynasty Dugout frontend. All components must follow these patterns to ensure consistency with the backend API.

---

## 🎯 CORE PRINCIPLE

**BACKEND IS SOURCE OF TRUTH**
- Backend returns: `season_stats`, `rolling_14_day`, `game_logs` (snake_case)
- Frontend uses: **SAME NAMES** - no conversion, no mapping
- Data flows: API → Hook → Components (unchanged field names)

---

## 📋 CANONICAL FIELD NAMES

### Player Data Structure

```javascript
// FROM: /api/players/:playerId/complete
{
  player: {
    // Basic Info
    player_id: 123456,        // NOT playerId
    first_name: "Mike",        // NOT firstName
    last_name: "Trout",        // NOT lastName
    position: "OF",
    mlb_team: "LAA",          // NOT mlbTeam or team
    jersey_number: 27,        // NOT jerseyNumber
    height_inches: 74,        // NOT heightInches
    weight_pounds: 235,       // NOT weightPounds
    birthdate: "1991-08-07",
    age: 33,
    is_active: true           // NOT isActive
  },
  
  // Season Statistics
  season_stats: {             // NOT seasonStats
    // Hitters
    games_played: 150,        // NOT gamesPlayed
    at_bats: 500,            // NOT atBats
    batting_avg: 0.285,      // NOT battingAvg
    on_base_pct: 0.365,      // NOT onBasePct
    slugging_pct: 0.500,     // NOT sluggingPct
    home_runs: 30,           // NOT homeRuns
    stolen_bases: 20,        // NOT stolenBases
    
    // Pitchers (nested structure)
    pitching: {
      innings_pitched: 180.0, // NOT inningsPitched
      wins: 12,
      losses: 8,
      era: 3.50,
      whip: 1.20,
      strikeouts_pitched: 200, // NOT strikeoutsPitched
      quality_starts: 20,       // NOT qualityStarts
      saves: 0,
      blown_saves: 0,           // NOT blownSaves
      holds: 0
    }
  },
  
  // Rolling 14-Day Stats
  rolling_14_day: {           // NOT rolling14Day or rollingStats
    // Same structure as season_stats
    games: 12,
    batting_avg: 0.310,
    home_runs: 3,
    // For pitchers: nested pitching object
    pitching: {
      era: 2.80,
      strikeouts_pitched: 18
    }
  },
  
  // Career Statistics
  career_stats: [             // NOT careerStats
    {
      season: 2024,
      mlb_team: "LAA",        // NOT team
      games_played: 150,      // NOT gamesPlayed
      batting_avg: 0.285,     // NOT battingAvg
      // ... same pattern
    }
  ],
  
  career_totals: {            // NOT careerTotals
    seasons: 12,
    games_played: 1500,       // NOT gamesPlayed
    home_runs: 350,           // NOT homeRuns
    // ... same pattern
  },
  
  // Game Logs
  game_logs: [                // NOT gameLogs
    {
      game_date: "2025-01-15", // NOT gameDate
      opponent: "SEA",
      is_home: true,           // NOT isHome
      batting_avg: 0.333,      // NOT battingAvg
      at_bats: 3,             // NOT atBats
      // ... same pattern
    }
  ],
  
  // Contract Info (league context only)
  contract_info: {            // NOT contractInfo
    team_id: "uuid",          // NOT teamId
    team_name: "My Team",     // NOT teamName
    owner_name: "John",       // NOT ownerName
    salary: 25.5,
    contract_years: 3,        // NOT contractYears
    roster_status: "active",  // NOT rosterStatus
    acquisition_method: "draft", // NOT acquisitionMethod
    acquisition_date: "2024-03-15" // NOT acquisitionDate
  },
  
  // Analytics
  analytics: {
    hot_cold: {               // NOT hotCold
      status: "hot",
      temperature: "🔥"
    },
    performance_trends: {},   // NOT performanceTrends
    position_rankings: [],    // NOT positionRankings
    league_comparisons: {},   // NOT leagueComparisons
    z_scores: {}             // NOT zScores
  }
}
```

---

## 🔧 COMPONENT PATTERNS

### Pattern 1: Custom Hook (usePlayerData)

```javascript
// ✅ CORRECT - Uses backend field names throughout
export const usePlayerData = (playerId, leagueId) => {
  // State uses backend names
  const [player, setPlayer] = useState(null);
  const [season_stats, setSeasonStats] = useState(null);      // ✅ snake_case
  const [rolling_14_day, setRolling14Day] = useState(null);   // ✅ snake_case
  const [career_stats, setCareerStats] = useState([]);        // ✅ snake_case
  const [game_logs, setGameLogs] = useState([]);              // ✅ snake_case
  const [contract_info, setContractInfo] = useState(null);    // ✅ snake_case
  
  // Return uses backend names
  return {
    loading,
    error,
    player,
    season_stats,      // ✅ NOT seasonStats
    rolling_14_day,    // ✅ NOT rollingStats
    career_stats,      // ✅ NOT careerStats
    game_logs,         // ✅ NOT gameLogs
    contract_info,     // ✅ NOT contractInfo
    analytics,
    isPitcher: () => {...},
    hasContract: () => {...}
  };
};

// ❌ WRONG - Don't do this
export const usePlayerData = (playerId, leagueId) => {
  const [seasonStats, setSeasonStats] = useState(null);  // ❌ camelCase
  const [rollingStats, setRollingStats] = useState(null); // ❌ camelCase
  // ...
  return { seasonStats, rollingStats };  // ❌ camelCase
};
```

---

### Pattern 2: Page Component (PlayerProfile)

```javascript
// ✅ CORRECT - Destructures with backend names
const PlayerProfile = () => {
  const { playerId, leagueId } = useParams();
  
  // Destructure with backend field names
  const {
    loading,
    error,
    player,
    season_stats,      // ✅ snake_case
    rolling_14_day,    // ✅ snake_case
    career_stats,      // ✅ snake_case
    career_totals,     // ✅ snake_case
    game_logs,         // ✅ snake_case
    contract_info,     // ✅ snake_case
    analytics,
    isPitcher
  } = usePlayerData(playerId, leagueId);
  
  // Pass with backend field names
  return (
    <PlayerInfoCard 
      player={player}
      playerId={playerId}
      season_stats={season_stats}           // ✅ snake_case prop
      rolling_14_day={rolling_14_day}       // ✅ snake_case prop
      career_stats={career_stats}           // ✅ snake_case prop
      game_logs={game_logs}                 // ✅ snake_case prop
      contract_info={contract_info}         // ✅ snake_case prop
      analytics={analytics}
      isPitcher={isPitcher()}
      leagueId={leagueId}
    />
  );
};

// ❌ WRONG - Don't rename variables
const {
  season_stats: seasonStats,  // ❌ Don't rename
  game_logs: gameLogs         // ❌ Don't rename
} = usePlayerData(playerId, leagueId);
```

---

### Pattern 3: Container Component (PlayerInfoCard)

```javascript
// ✅ CORRECT - Props use backend names
const PlayerInfoCard = ({ 
  player,
  playerId,
  season_stats,          // ✅ snake_case prop
  rolling_14_day,        // ✅ snake_case prop
  career_stats,          // ✅ snake_case prop
  career_totals,         // ✅ snake_case prop
  game_logs,             // ✅ snake_case prop
  contract_info,         // ✅ snake_case prop
  analytics,
  isPitcher,
  leagueId
}) => {
  // Use data directly with backend names
  const stats = season_stats || {};
  const rolling = rolling_14_day || {};
  
  // Pass to child tabs with backend names
  return (
    <div>
      {activeTab === 'overview' && (
        <PlayerOverviewTab 
          player={player}
          season_stats={season_stats}       // ✅ snake_case
          rolling_14_day={rolling_14_day}   // ✅ snake_case
          isPitcher={isPitcher}
        />
      )}
      
      {activeTab === 'gamelogs' && (
        <PlayerGameLogsTab 
          gameLogs={game_logs}              // ✅ snake_case
          playerId={playerId}
          isPitcher={isPitcher}
        />
      )}
    </div>
  );
};

// ❌ WRONG - Don't use camelCase props
const PlayerInfoCard = ({ 
  seasonStats,    // ❌ camelCase
  rollingStats,   // ❌ camelCase
  gameLogs        // ❌ camelCase
}) => {
  // ...
};
```

---

### Pattern 4: Leaf Component (Tab Components)

```javascript
// ✅ CORRECT - Props use backend names
const PlayerOverviewTab = ({ 
  player, 
  season_stats,      // ✅ snake_case
  rolling_14_day,    // ✅ snake_case
  isPitcher 
}) => {
  // Helper function to safely get stats
  const getStat = (stats, statName, isPitcher) => {
    if (!stats) return null;
    
    // For pitchers, check nested pitching object
    if (isPitcher && stats.pitching && stats.pitching[statName] !== undefined) {
      return stats.pitching[statName];
    }
    
    // Check top level
    return stats[statName] || null;
  };
  
  // Use backend field names
  const stats = season_stats || {};
  const rolling = rolling_14_day || {};
  
  // Access with backend field names
  const avg = getStat(stats, 'batting_avg', isPitcher);     // ✅ snake_case
  const hr = getStat(stats, 'home_runs', isPitcher);        // ✅ snake_case
  const era = getStat(stats, 'era', isPitcher);             // ✅ snake_case
  
  return (
    <div>
      <StatRow label="AVG" value={avg} />
      <StatRow label="HR" value={hr} />
    </div>
  );
};

// ❌ WRONG - Don't use camelCase
const PlayerOverviewTab = ({ seasonStats, rollingStats }) => {
  const avg = seasonStats.battingAvg;  // ❌ camelCase field access
  // ...
};
```

---

## 🔍 STAT ACCESSOR PATTERNS

### For Hitters (Flat Structure)

```javascript
// ✅ CORRECT
const games = season_stats.games_played || season_stats.games;
const avg = season_stats.batting_avg;
const hr = season_stats.home_runs;
const sb = season_stats.stolen_bases;

// ❌ WRONG
const games = season_stats.gamesPlayed;  // ❌ camelCase
const avg = season_stats.battingAvg;     // ❌ camelCase
```

### For Pitchers (Nested Structure)

```javascript
// ✅ CORRECT - Check nested pitching object first
const getStat = (stats, statName, isPitcher) => {
  if (!stats) return null;
  
  // For pitchers, check nested pitching object
  if (isPitcher && stats.pitching && stats.pitching[statName] !== undefined) {
    return stats.pitching[statName];
  }
  
  // Fallback to top level
  return stats[statName] || null;
};

const era = getStat(season_stats, 'era', true);
const whip = getStat(season_stats, 'whip', true);
const k = getStat(season_stats, 'strikeouts_pitched', true);

// ❌ WRONG - Direct access without checking nested structure
const era = season_stats.era;  // ❌ May be undefined if nested
```

---

## 🎨 DISPLAY FORMATTING

### Batting Average

```javascript
// ✅ CORRECT
const formatAvg = (value) => {
  const avg = parseFloat(value) || 0;
  if (avg === 0) return '.000';
  if (avg >= 1) return `.${Math.round(avg).toString().padStart(3, '0')}`;
  return avg.toFixed(3);
};

const displayAvg = formatAvg(season_stats.batting_avg);  // ".285"
```

### ERA / WHIP

```javascript
// ✅ CORRECT
const formatERA = (value) => (parseFloat(value) || 0).toFixed(2);
const formatWHIP = (value) => (parseFloat(value) || 0).toFixed(2);

const displayERA = formatERA(season_stats.pitching?.era);    // "3.50"
const displayWHIP = formatWHIP(season_stats.pitching?.whip); // "1.20"
```

### Innings Pitched

```javascript
// ✅ CORRECT
const formatIP = (value) => (parseFloat(value) || 0).toFixed(1);

const displayIP = formatIP(season_stats.pitching?.innings_pitched); // "180.0"
```

---

## 📊 TABLE COLUMN DEFINITIONS

### Game Logs Table

```javascript
// ✅ CORRECT - Column keys match backend field names
export const createGameLogsColumns = (isPitcher) => {
  if (isPitcher) {
    return [
      { key: 'game_date', label: 'Date', width: 100 },        // ✅ snake_case
      { key: 'opponent', label: 'Opp', width: 60 },
      { key: 'innings_pitched', label: 'IP', width: 60 },     // ✅ snake_case
      { key: 'earned_runs', label: 'ER', width: 50 },         // ✅ snake_case
      { key: 'strikeouts_pitched', label: 'K', width: 50 },   // ✅ snake_case
      { key: 'walks_allowed', label: 'BB', width: 50 }        // ✅ snake_case
    ];
  }
  
  return [
    { key: 'game_date', label: 'Date', width: 100 },          // ✅ snake_case
    { key: 'opponent', label: 'Opp', width: 60 },
    { key: 'batting_avg', label: 'AVG', width: 70 },          // ✅ snake_case
    { key: 'home_runs', label: 'HR', width: 50 },             // ✅ snake_case
    { key: 'stolen_bases', label: 'SB', width: 50 }           // ✅ snake_case
  ];
};

// ❌ WRONG - Don't use camelCase keys
{ key: 'gameDate', label: 'Date' }        // ❌ camelCase
{ key: 'battingAvg', label: 'AVG' }       // ❌ camelCase
```

---

## 🧪 TESTING PATTERNS

### Unit Test Example

```javascript
// ✅ CORRECT - Test with backend field names
describe('usePlayerData', () => {
  it('should return data with backend field names', () => {
    const { result } = renderHook(() => usePlayerData('123456'));
    
    expect(result.current).toHaveProperty('season_stats');      // ✅ snake_case
    expect(result.current).toHaveProperty('rolling_14_day');    // ✅ snake_case
    expect(result.current).toHaveProperty('game_logs');         // ✅ snake_case
    
    expect(result.current).not.toHaveProperty('seasonStats');   // ✅ Verify no camelCase
    expect(result.current).not.toHaveProperty('gameLogs');      // ✅ Verify no camelCase
  });
});
```

---

## 🚨 COMMON MISTAKES TO AVOID

### ❌ Mistake 1: Renaming on Destructure
```javascript
// ❌ WRONG
const { season_stats: seasonStats } = usePlayerData(playerId);

// ✅ CORRECT
const { season_stats } = usePlayerData(playerId);
```

### ❌ Mistake 2: Camel Case Props
```javascript
// ❌ WRONG
<PlayerOverviewTab seasonStats={season_stats} />

// ✅ CORRECT
<PlayerOverviewTab season_stats={season_stats} />
```

### ❌ Mistake 3: Mixed Naming
```javascript
// ❌ WRONG - Mixing snake_case and camelCase
const stats = {
  season_stats: data.season_stats,  // ✅ Good
  gameLogs: data.game_logs,         // ❌ Bad - renamed to camelCase
  rollingStats: data.rolling_14_day // ❌ Bad - renamed to camelCase
};

// ✅ CORRECT - All snake_case
const stats = {
  season_stats: data.season_stats,
  game_logs: data.game_logs,
  rolling_14_day: data.rolling_14_day
};
```

### ❌ Mistake 4: Not Checking Nested Structure
```javascript
// ❌ WRONG - Assumes flat structure for pitchers
const era = season_stats.era;  // May be undefined

// ✅ CORRECT - Check nested pitching object
const era = season_stats.pitching?.era || season_stats.era;
```

---

## ✅ QUICK CHECKLIST

Use this before committing code:

- [ ] All props use snake_case field names
- [ ] No renaming on destructure
- [ ] Hook returns backend field names
- [ ] Components receive backend field names
- [ ] Table columns use backend keys
- [ ] Stat accessors check for nested pitching object
- [ ] No camelCase anywhere in data flow
- [ ] Tests verify backend field names

---

## 📚 REFERENCE EXAMPLES

### Complete Component Example

See: `/frontend-react/src/components/player/PlayerOverviewTab.js`
- Shows proper prop names
- Shows getStat helper pattern
- Shows nested pitching handling

### Complete Hook Example

See: `/frontend-react/src/hooks/usePlayerData.js`
- Shows proper state names
- Shows proper API response handling
- Shows proper return object

### Complete Page Example

See: `/frontend-react/src/pages/PlayerProfile.js`
- Shows proper hook usage
- Shows proper prop passing
- Shows proper data flow

---

**REMEMBER:** Backend field names are the source of truth. Never convert or rename them in the frontend!
