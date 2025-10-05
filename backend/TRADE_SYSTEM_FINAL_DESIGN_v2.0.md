
markdown# 🏟️ DYNASTY DUGOUT - TRADING SYSTEM
## FINAL COMPREHENSIVE DESIGN v2.0

---

## 📋 EXECUTIVE SUMMARY

### Trading Interfaces
1. **TradeCenter Page** - Full tabbed interface with complete stats
2. **TradeModal** - Quick popup for single-player trades

### Core Principles
- ✅ All trade rules configurable per league (Phase 0 complete)
- ✅ Full stats integration (same as MyRoster/TeamStats)
- ✅ Tabbed view (one team's roster at a time)
- ✅ 2-team trades only (for now)
- ✅ Trade players, draft picks, and FA cash
- ✅ Uses canonical player structure (from MyRoster.js parser)
- ✅ Uses dynastyTheme from colorService.js
- ✅ Uses DynastyTable from tableService.js

---

## 🎨 DESIGN SYSTEM INTEGRATION

### Color Service (dynastyTheme)
**File:** `/frontend-react/src/services/colorService.js`

All trade components use dynastyTheme for consistency:
```javascript
import { dynastyTheme } from '../../services/colorService';

// Examples:
<div className={dynastyTheme.components.card.base}>
<button className={dynastyTheme.components.button.primary}>
<span className={dynastyTheme.classes.text.primary}>
Table Service (DynastyTable)
File: /frontend-react/src/services/tableService.js
All trade tables use DynastyTable component:
javascriptimport { DynastyTable } from '../../services/tableService';

<DynastyTable
  data={transformedPlayers}
  columns={tradeRosterColumns}
  stickyHeader={true}
  enableHorizontalScroll={true}
/>
Table Columns
File: /frontend-react/src/services/tables/tradeRosterColumns.js (NEW)
Following pattern from:

teamStatsColumns.js - For stat configurations
myRosterColumns.js - For action buttons


🎨 TRADECENTER PAGE - FINAL LAYOUT
Three Main Sections
1. STICKY HEADER - Trade Builder (Always Visible)
┌─────────────────────────────────────────────────────────────┐
│ Trading with: [Select Team ▼]           [Review] [Submit]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  YOUR OFFER                      ⇄         THEIR OFFER       │
│  ┌──────────────────────┐              ┌──────────────────┐ │
│  │ ⚾ Judge (OF) NYY     │              │ ⚾ Soto (OF) NYY  │ │
│  │ HR:30 RBI:80 R:90    │              │ HR:35 RBI:100    │ │
│  │ $25                  │              │ $28              │ │
│  │ [X]                  │              │ [X]              │ │
│  ├──────────────────────┤              └──────────────────┘ │
│  │ 📅 2026 1st Round    │                                    │
│  │ [X]                  │                                    │
│  └──────────────────────┘                                    │
│                                                               │
│  [+ Player] [+ Pick] [+ Cash]     [+ Player] [+ Pick]        │
└─────────────────────────────────────────────────────────────┘
2. ROSTER TABS
┌─────────────────────────────────────────────────────────────┐
│  [ Your Roster ]  [ Yankees Roster ]                         │
└─────────────────────────────────────────────────────────────┘
3. FULL STATS TABLE (Active Tab Only)
┌─────────────────────────────────────────────────────────────┐
│  View: [3-Line Format ●] [Accrued Only ○]                   │
│                                                               │
│  Position Tabs: [Batters] [Pitchers]                         │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  {DYNASTYTABLE - Same structure as TeamStats}         │  │
│  │  POS | Player | Team | G | AB | H | HR | ... | [Add] │  │
│  │  ─────────────────────────────────────────────────────│  │
│  │  OF    Aaron Judge   NYY   (3-line format with all    │  │
│  │        ↗ 14-Day            league stats)              │  │
│  │        ✓ Accrued                            [Add →]   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  {Draft Picks Section}                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Available Picks:                                      │  │
│  │  ☑ 2025 1st Round [Add]                               │  │
│  │  ☑ 2025 2nd Round [Add]                               │  │
│  │  ☑ 2026 1st Round (from Red Sox) [Add]               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

🔌 BACKEND API - TRADE-SPECIFIC ENDPOINT
Primary Endpoint
GET /api/leagues/{league_id}/trades/teams-comparison?team1={id}&team2={id}
Response Structure
javascript{
  success: true,
  
  league: {
    league_id: "...",
    league_name: "My Dynasty League",
    
    // Trade rules from Phase 0 settings
    trade_settings: {
      veto_system: "none",
      veto_threshold: 0.5,
      veto_period_hours: 48,
      trade_deadline_date: "08-31",
      trade_deadline_enabled: true,
      future_picks_tradeable_years: 1,
      fa_cash_tradeable: true,
      max_fa_cash_per_trade: null,
      min_roster_size: 25,
      max_roster_size: 40
    },
    
    // For stat columns (same as TeamStats)
    scoring_categories: {
      batting: ['AVG', 'HR', 'RBI', 'R', 'SB', 'OBP', 'SLG'],
      pitching: ['W', 'SV', 'K', 'ERA', 'WHIP', 'K/9']
    },
    
    position_requirements: {...}
  },
  
  team1: {
    team_id: "...",
    team_name: "Your Team Name",
    manager_name: "Your Name",
    
    // CANONICAL PLAYER STRUCTURE (from MyRoster.js)
    // Uses get_canonical_players_for_team() from canonical_player.py
    players: [
      {
        ids: { mlb: "...", league_player: "..." },
        info: { full_name: "Aaron Judge", position: "OF", mlb_team: "NYY" },
        stats: {
          season: { games_played: 140, at_bats: 520, hits: 148, ... },
          rolling_14_day: { games_played: 12, at_bats: 45, hits: 15, ... },
          team_attribution: { games_played: 95, at_bats: 360, hits: 104, ... }
        },
        financial: { 
          market_price: 25, 
          contract_salary: 20, 
          contract_years: 2 
        },
        roster: { status: "active", position: "OF_1" },
        
        // TRADE-SPECIFIC ADDITIONS (computed at query time)
        trade_eligible: true,
        trade_ineligible_reason: null,
        involved_in_trade_id: null
      },
      // ... all players
    ],
    
    // Draft picks (from new draft_picks table)
    draft_picks: [
      { 
        year: 2025, 
        round: 1, 
        original_team_id: "...",
        original_team_name: "Your Team",
        tradeable: true 
      },
      { 
        year: 2026, 
        round: 1, 
        original_team_id: "other_id",
        original_team_name: "Red Sox",
        tradeable: true 
      },
      // ... all picks
    ],
    
    // Financial (calculated same as MyRoster.js)
    fa_budget: 770,  // (draft_cap - current_spend) + season_cap
    salary_cap_used: 30,
    salary_cap_limit: 800,
    
    // Roster
    roster_size: 32,
    active_roster_count: 25,
    bench_count: 5,
    minors_count: 2
  },
  
  team2: {
    // Same structure for opponent
  }
}

💻 FRONTEND COMPONENTS - DETAILED SPECS
1. TradeCenter.js - Main Page Component
javascriptimport { dynastyTheme } from '../../services/colorService';
import { DynastyTable } from '../../services/tableService';

const TradeCenter = ({ leagueId }) => {
  // STATE
  const [selectedTheirTeam, setSelectedTheirTeam] = useState(null);
  const [activeRosterTab, setActiveRosterTab] = useState('yours'); // 'yours' | 'theirs'
  const [statsView, setStatsView] = useState('3-line'); // '3-line' | 'accrued'
  const [activePositionTab, setActivePositionTab] = useState('batters');
  
  const [yourOffer, setYourOffer] = useState({
    players: [],
    picks: [],
    cash: 0
  });
  
  const [theirOffer, setTheirOffer] = useState({
    players: [],
    picks: [],
    cash: 0
  });
  
  // DATA FETCHING
  const { data, loading } = useTradeComparison(leagueId, yourTeamId, selectedTheirTeam);
  
  // HANDLERS
  const addToYourOffer = (player) => {
    setYourOffer(prev => ({
      ...prev,
      players: [...prev.players, player]
    }));
  };
  
  const addToTheirOffer = (player) => {
    setTheirOffer(prev => ({
      ...prev,
      players: [...prev.players, player]
    }));
  };
  
  // RENDER
  return (
    <div className="space-y-6">
      
      {/* STICKY HEADER - Trade Builder */}
      <div className={`sticky top-0 z-10 p-6 border-b ${dynastyTheme.classes.bg.card} ${dynastyTheme.classes.border.neutral}`}>
        
        {/* Team Selector */}
        <div className="flex justify-between items-center mb-4">
          <h1 className={dynastyTheme.classes.text.white}>Trade Center</h1>
          <select 
            value={selectedTheirTeam || ''}
            onChange={(e) => setSelectedTheirTeam(e.target.value)}
            className={dynastyTheme.components.input}
          >
            <option value="">Select team to trade with...</option>
            {allTeams.map(team => (
              <option key={team.team_id} value={team.team_id}>
                {team.team_name}
              </option>
            ))}
          </select>
          
          <div className="flex gap-2">
            <button 
              onClick={reviewTrade}
              className={dynastyTheme.components.button.secondary}
            >
              Review Trade
            </button>
            <button 
              onClick={submitTrade} 
              disabled={!isValid}
              className={dynastyTheme.components.button.primary}
            >
              Submit Trade
            </button>
          </div>
        </div>
        
        {/* Offer Boxes */}
        {selectedTheirTeam && (
          <div className="grid grid-cols-2 gap-6">
            
            <TradeOfferBox
              title="Your Offer"
              items={yourOffer}
              onRemovePlayer={removeFromYourOffer}
              onRemovePick={removePickFromYourOffer}
              onAddPlayer={() => setActiveRosterTab('yours')}
              onAddPick={openYourPickPicker}
              onAddCash={openCashInput}
            />
            
            <TradeOfferBox
              title="Their Offer"
              items={theirOffer}
              onRemovePlayer={removeFromTheirOffer}
              onRemovePick={removePickFromTheirOffer}
              onAddPlayer={() => setActiveRosterTab('theirs')}
              onAddPick={openTheirPickPicker}
            />
            
          </div>
        )}
      </div>
      
      {/* ROSTER TABS */}
      {selectedTheirTeam && (
        <div>
          <div className={`flex gap-2 border-b ${dynastyTheme.classes.border.neutral}`}>
            <button
              onClick={() => setActiveRosterTab('yours')}
              className={activeRosterTab === 'yours' ? dynastyTheme.components.tab.active : dynastyTheme.components.tab.base}
            >
              Your Roster - {data?.team1?.team_name}
            </button>
            <button
              onClick={() => setActiveRosterTab('theirs')}
              className={activeRosterTab === 'theirs' ? dynastyTheme.components.tab.active : dynastyTheme.components.tab.base}
            >
              Their Roster - {data?.team2?.team_name}
            </button>
          </div>
          
          {/* ACTIVE TAB CONTENT */}
          <div className="mt-6">
            
            {/* View Toggle */}
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => setStatsView('3-line')}
                className={statsView === '3-line' ? dynastyTheme.components.button.primary : dynastyTheme.components.button.secondary}
              >
                Full Stats (3-line)
              </button>
              <button 
                onClick={() => setStatsView('accrued')}
                className={statsView === 'accrued' ? dynastyTheme.components.button.primary : dynastyTheme.components.button.secondary}
              >
                Accrued Only
              </button>
            </div>
            
            {/* Position Tabs */}
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => setActivePositionTab('batters')}
                className={activePositionTab === 'batters' ? dynastyTheme.components.tab.active : dynastyTheme.components.tab.base}
              >
                Batters
              </button>
              <button 
                onClick={() => setActivePositionTab('pitchers')}
                className={activePositionTab === 'pitchers' ? dynastyTheme.components.tab.active : dynastyTheme.components.tab.base}
              >
                Pitchers
              </button>
            </div>
            
            {/* FULL STATS TABLE */}
            <TradeRosterTable
              players={activeRosterTab === 'yours' ? data.team1.players : data.team2.players}
              statsView={statsView}
              positionFilter={activePositionTab}
              statConfigs={currentStatConfigs}
              onAddPlayer={activeRosterTab === 'yours' ? addToYourOffer : addToTheirOffer}
              selectedPlayers={activeRosterTab === 'yours' ? yourOffer.players : theirOffer.players}
            />
            
            {/* DRAFT PICKS SECTION */}
            <TradeDraftPicksList
              picks={activeRosterTab === 'yours' ? data.team1.draft_picks : data.team2.draft_picks}
              onAddPick={activeRosterTab === 'yours' ? addPickToYourOffer : addPickToTheirOffer}
              selectedPicks={activeRosterTab === 'yours' ? yourOffer.picks : theirOffer.picks}
            />
            
          </div>
        </div>
      )}
      
    </div>
  );
};
2. TradeOfferBox.js - Offer Display Component
javascriptimport { dynastyTheme } from '../../services/colorService';

const TradeOfferBox = ({ 
  title, 
  items, 
  onRemovePlayer, 
  onRemovePick, 
  onAddPlayer, 
  onAddPick, 
  onAddCash 
}) => {
  
  return (
    <div className={`border rounded-lg p-4 ${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.bg.card}`}>
      
      <h3 className={`text-lg font-bold mb-4 ${dynastyTheme.classes.text.white}`}>
        {title}
      </h3>
      
      {/* Empty State */}
      {items.players.length === 0 && items.picks.length === 0 && items.cash === 0 && (
        <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralDark}`}>
          No items in offer
        </div>
      )}
      
      {/* Players */}
      <div className="space-y-2 mb-4">
        {items.players.map(player => (
          <CompactPlayerCard
            key={player.mlb_player_id}
            player={player}
            stats={['HR', 'RBI', 'R']} // Top 3 stats only
            onRemove={() => onRemovePlayer(player)}
          />
        ))}
      </div>
      
      {/* Draft Picks */}
      <div className="space-y-2 mb-4">
        {items.picks.map(pick => (
          <CompactPickCard
            key={`${pick.year}-${pick.round}`}
            pick={pick}
            onRemove={() => onRemovePick(pick)}
          />
        ))}
      </div>
      
      {/* FA Cash */}
      {items.cash > 0 && (
        <CompactCashCard
          amount={items.cash}
          onRemove={() => onRemoveCash()}
        />
      )}
      
      {/* Add Buttons */}
      <div className="flex gap-2 mt-4">
        <button 
          onClick={onAddPlayer} 
          className={dynastyTheme.components.button.secondary}
        >
          + Player
        </button>
        <button 
          onClick={onAddPick} 
          className={dynastyTheme.components.button.secondary}
        >
          + Pick
        </button>
        {onAddCash && (
          <button 
            onClick={onAddCash} 
            className={dynastyTheme.components.button.secondary}
          >
            + Cash
          </button>
        )}
      </div>
      
    </div>
  );
};
3. TradeRosterTable.js - Full Stats Table
javascriptimport { DynastyTable } from '../../services/tableService';
import { 
  transformPlayersToThreeLineFormat, 
  transformPlayersToAccruedOnlyFormat 
} from '../../services/tables/transformers';
import { 
  createTradeRosterColumns, 
  createTradeRosterColumnsAccruedOnly 
} from '../../services/tables/tradeRosterColumns';

const TradeRosterTable = ({
  players,
  statsView,
  positionFilter,
  statConfigs,
  onAddPlayer,
  selectedPlayers
}) => {
  
  // Filter players
  const filteredPlayers = players.filter(p => {
    const isPitcher = ['SP', 'RP', 'P'].includes(p.info.position);
    if (positionFilter === 'batters') return !isPitcher;
    if (positionFilter === 'pitchers') return isPitcher;
    return true;
  });
  
  // Transform based on view (reuse from TeamStats)
  const tableData = statsView === '3-line'
    ? transformPlayersToThreeLineFormat(filteredPlayers)
    : transformPlayersToAccruedOnlyFormat(filteredPlayers);
  
  // Create columns with ADD button
  const columns = statsView === '3-line'
    ? createTradeRosterColumns({
        statConfigs,
        onAddPlayer,
        selectedPlayers,
        isPitcher: positionFilter === 'pitchers'
      })
    : createTradeRosterColumnsAccruedOnly({
        statConfigs,
        onAddPlayer,
        selectedPlayers,
        isPitcher: positionFilter === 'pitchers'
      });
  
  return (
    <DynastyTable
      data={tableData}
      columns={columns}
      stickyHeader={true}
      enableHorizontalScroll={true}
      enableVerticalScroll={false}
      maxHeight="none"
      minWidth="800px"
    />
  );
};

📁 FILES TO CREATE/MODIFY
New Backend Files
/backend/src/routers/leagues/trades/
├── get_teams_comparison.py      ← Main trade endpoint
├── create_trade.py
├── accept_trade.py
├── reject_trade.py
└── validate_trade.py

/backend/src/routers/leagues/draft_picks/
├── initialize_picks.py
└── get_available_picks.py
New Frontend Files
/frontend-react/src/pages/
└── TradeCenter.js                ← Main page

/frontend-react/src/components/trades/
├── TradeOfferBox.js              ← Offer display
├── CompactPlayerCard.js          ← Player in offer box
├── CompactPickCard.js            ← Pick in offer box
├── CompactCashCard.js            ← Cash in offer box
├── TradeRosterTable.js           ← Full stats table wrapper
├── TradeDraftPicksList.js        ← Draft picks section
├── TradeModal.js                 ← Quick trade popup
├── TradeValidationSummary.js     ← Validation display
├── ActiveTradesList.js           ← Pending trades
└── TradeHistoryCard.js           ← Past trades

/frontend-react/src/services/tables/
└── tradeRosterColumns.js         ← Column configs (reuses stat logic)
Files to Modify
/frontend-react/src/App.js
- Add route: /league/:id/trades

/frontend-react/src/components/Sidebar.js
- Add "Trades" menu item

/frontend-react/src/pages/league-dashboard/MyRoster.js
- Add Trade button → opens TradeModal

/frontend-react/src/pages/league-dashboard/TeamStats.js
- Add Trade button → opens TradeModal

/frontend-react/src/services/apiService.js
- Add trades API calls

✅ IMPLEMENTATION PHASES (Final)
PhaseDescriptionSessionsStatusPhase 0League Settings1✅ COMPLETEPhase 1Database Schema1🔜 NEXTPhase 2Draft Picks Init1⏳ PendingPhase 2.5Trade Stats Endpoint1⏳ PendingPhase 3TradeCenter UI Foundation1⏳ PendingPhase 4Player Selection with Stats1⏳ PendingPhase 5Draft Picks UI1⏳ PendingPhase 6FA Cash1⏳ PendingPhase 7Validation System1⏳ PendingPhase 8Submit Trade Backend1⏳ PendingPhase 9Accept/Reject1⏳ PendingPhase 10Process Trades1⏳ PendingPhase 11-16Veto, Modal, History, Polish6⏳ Pending
Total: ~16 sessions
