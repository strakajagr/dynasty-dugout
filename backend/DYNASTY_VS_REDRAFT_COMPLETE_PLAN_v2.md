
markdown# 🏟️ DYNASTY VS. REDRAFT LEAGUE TYPE - COMPLETE IMPLEMENTATION PLAN v2.0
**Date:** October 5, 2025  
**Status:** Planning Phase  
**Priority:** CRITICAL - Blocks Draft Pick Trading System

---

## 📋 EXECUTIVE SUMMARY

### What Changed from v1.0:
- ❌ v1.0 assumed simple snake draft for all leagues
- ✅ v2.0 includes complex draft order logic:
  - Redraft: Snake or random repeating initial draft
  - Dynasty Year 1: Snake, random, or commissioner-set
  - Dynasty Year 2+: Reverse standings with optional NBA-style Round 1 lottery
  - Commissioner override capabilities for all scenarios

### Complexity Added:
- **2 new database tables** for draft order history and lottery results
- **NBA-style lottery system** (weighted odds, top teams excluded)
- **Multiple draft type options** for each league type and scenario
- **Draft order calculation engine** for standings-based drafts
- **Lottery execution system** for first-round pick determination

---

## 🎯 DRAFT ORDER LOGIC - COMPLETE SPECIFICATION

### REDRAFT LEAGUES

**Initial Draft (Every Year):**
Options:
├── Snake (default)
│   └── Round 1: 1,2,3...12 | Round 2: 12,11,10...1 | Repeat
├── Random Repeating
│   └── Randomize order once, repeat same order all rounds
├── Auction
│   └── Bidding system (future implementation)
└── Commissioner Sets Order
└── Manual order assignment

**After Draft:** Single season ends, doesn't matter

---

### DYNASTY LEAGUES

#### **Year 1 - Initial Draft:**
Options:
├── Snake (most common)
│   └── Standard alternating pattern
├── Random Repeating
│   └── Randomize once, repeat all rounds
├── Auction
│   └── Bidding system (future implementation)
└── Commissioner Sets Order
└── Manual assignment

**Initial Order Determination:**
- Random draw by system
- Commissioner manually sets
- Imported from external source

---

#### **Year 2+ - Subsequent Drafts:**

**Option 1: Basic Reverse Standings (Simple)**
All Rounds: Same order based on previous year's final standings
Example (12 teams):
Round 1: 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
Round 2: 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
Round 3: 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
... (all rounds same order)

**Option 2: Reverse Standings with Round 1 Lottery (Recommended)**
Round 1: NBA-style lottery determines order
├── Top N teams (default 3) EXCLUDED from lottery
├── All other teams (4th through last) enter lottery
├── Lottery uses NBA weighting system
└── Top N teams pick in slots (max_teams - N + 1) through max_teams
Rounds 2+: Reverse standings order (same every round)
Example (12 teams, top 3 excluded):
Round 1: [Lottery determines picks 1-9], then 10=3rd place, 11=2nd place, 12=1st place
Round 2: 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 (standings inverse)
Round 3: 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 (standings inverse)

**NBA Lottery Odds (14% / 14% / 14% / 12.5% / 10.5% / 9% / 7.5% / 6% / 4.5% / ...)**
```javascript
// For 12-team league with top 3 excluded:
const lotteryOdds = {
  12: 0.140,  // Last place - 14% chance at #1
  11: 0.140,  // 2nd-to-last - 14%
  10: 0.140,  // 3rd-to-last - 14%
  9:  0.125,  // 4th-to-last - 12.5%
  8:  0.105,  // 10.5%
  7:  0.090,  // 9%
  6:  0.075,  // 7.5%
  5:  0.060,  // 6%
  4:  0.045,  // 4.5%
  // Teams 1-3 (top 3) not in lottery
};
Option 3: Auction

Bidding system (future)

Option 4: Commissioner Sets Order

Manual override for any scenario


🗄️ DATABASE SCHEMA CHANGES
Table 1: user_leagues (postgres database)
Add Column:
sqlALTER TABLE user_leagues 
ADD COLUMN league_type VARCHAR(10) DEFAULT 'dynasty' 
CHECK (league_type IN ('dynasty', 'redraft'));

Table 2: league_settings (leagues database)
New Settings to Add:
javascript// League Type
league_type: 'dynasty' | 'redraft'

// Dynasty Settings
num_keepers: integer (0 for redraft)
draft_rounds: integer (1-40)

// Draft Type Configuration - REDRAFT
redraft_initial_draft_type: 'snake' | 'random_repeating' | 'auction' | 'commissioner'

// Draft Type Configuration - DYNASTY
dynasty_initial_draft_type: 'snake' | 'random_repeating' | 'auction' | 'commissioner'
dynasty_subsequent_draft_type: 'basic_standings' | 'standings_lottery' | 'auction' | 'commissioner'

// Lottery Configuration (Dynasty only)
lottery_enabled: boolean (default: true for subsequent drafts)
lottery_top_excluded: integer (default: 3, range: 0-10)
lottery_weighting: 'nba_style' (only option for now)

// Keeper Rules
keeper_deadline_date: string (YYYY-MM-DD)
keeper_positions_locked: boolean (default: false)
SQL Insert Examples:
sqlINSERT INTO league_settings (league_id, setting_name, setting_value, setting_type) VALUES
  (:league_id, 'league_type', 'dynasty', 'string'),
  (:league_id, 'num_keepers', '15', 'integer'),
  (:league_id, 'draft_rounds', '23', 'integer'),
  (:league_id, 'redraft_initial_draft_type', 'snake', 'string'),
  (:league_id, 'dynasty_initial_draft_type', 'snake', 'string'),
  (:league_id, 'dynasty_subsequent_draft_type', 'standings_lottery', 'string'),
  (:league_id, 'lottery_enabled', 'true', 'boolean'),
  (:league_id, 'lottery_top_excluded', '3', 'integer'),
  (:league_id, 'lottery_weighting', 'nba_style', 'string'),
  (:league_id, 'keeper_deadline_date', '2025-03-01', 'string'),
  (:league_id, 'keeper_positions_locked', 'false', 'boolean');

Table 3: draft_order_history (leagues database) - NEW TABLE
Purpose: Track draft order for every season/round
sqlCREATE TABLE draft_order_history (
    draft_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    season_year INTEGER NOT NULL,
    round INTEGER NOT NULL,
    pick_number INTEGER NOT NULL,  -- Overall pick # within round
    team_id UUID NOT NULL,
    determined_by VARCHAR(50) NOT NULL,  -- 'lottery' | 'standings' | 'snake' | 'random' | 'manual'
    notes TEXT,  -- Optional explanation
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,  -- User who set it (if manual)
    
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES league_teams(team_id) ON DELETE CASCADE,
    UNIQUE (league_id, season_year, round, pick_number)
);

CREATE INDEX idx_draft_order_league_year ON draft_order_history(league_id, season_year);
CREATE INDEX idx_draft_order_team ON draft_order_history(team_id);
Example Data:
javascript// Year 1, Round 1 (snake draft)
{ league_id, season_year: 2025, round: 1, pick_number: 1, team_id: 'team_a', determined_by: 'snake' }
{ league_id, season_year: 2025, round: 1, pick_number: 2, team_id: 'team_b', determined_by: 'snake' }

// Year 2, Round 1 (lottery)
{ league_id, season_year: 2026, round: 1, pick_number: 1, team_id: 'team_g', determined_by: 'lottery' }
{ league_id, season_year: 2026, round: 1, pick_number: 2, team_id: 'team_j', determined_by: 'lottery' }

// Year 2, Round 2 (standings)
{ league_id, season_year: 2026, round: 2, pick_number: 1, team_id: 'team_l', determined_by: 'standings' }

Table 4: lottery_results (leagues database) - NEW TABLE
Purpose: Store lottery execution details for transparency
sqlCREATE TABLE lottery_results (
    lottery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    season_year INTEGER NOT NULL,
    team_id UUID NOT NULL,
    previous_standing INTEGER NOT NULL,  -- Final rank from previous season (1=first, 12=last)
    lottery_odds NUMERIC(5,4) NOT NULL,  -- e.g. 0.1400 for 14%
    pick_received INTEGER NOT NULL,      -- What pick they got (1-9 in 12-team league)
    executed_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES league_teams(team_id) ON DELETE CASCADE,
    UNIQUE (league_id, season_year, team_id)
);

CREATE INDEX idx_lottery_league_year ON lottery_results(league_id, season_year);
Example Data:
javascript// 2026 lottery for 12-team league (top 3 excluded)
{ lottery_id, league_id, season_year: 2026, team_id: 'team_g', previous_standing: 12, lottery_odds: 0.1400, pick_received: 1 }
{ lottery_id, league_id, season_year: 2026, team_id: 'team_j', previous_standing: 11, lottery_odds: 0.1400, pick_received: 2 }
{ lottery_id, league_id, season_year: 2026, team_id: 'team_k', previous_standing: 10, lottery_odds: 0.1400, pick_received: 5 }
// ... etc for all lottery teams

📋 IMPLEMENTATION PHASES (REVISED)
PHASE 0: Database Schema - Core Fields
Duration: 1 session
Goal: Add league_type and basic dynasty settings
Tasks:

Add league_type column to user_leagues table
Migrate all existing leagues to league_type = 'dynasty'
Add basic settings to league_settings:

league_type
num_keepers (default: 15)
draft_rounds (default: 23)


Test queries

Files to Create:

/backend/scripts/phase0_add_league_type.py

Success Criteria:

✅ All existing leagues have league_type = 'dynasty'
✅ Can query num_keepers and draft_rounds from API


PHASE 0.5: Database Schema - Draft Order Tables
Duration: 1 session
Goal: Create new tables for draft order tracking
Tasks:

Create draft_order_history table
Create lottery_results table
Add draft type settings to league_settings:

redraft_initial_draft_type
dynasty_initial_draft_type
dynasty_subsequent_draft_type
lottery_enabled
lottery_top_excluded


Test table creation and indexes

Files to Create:

/backend/scripts/phase0_5_create_draft_tables.sql
/backend/scripts/phase0_5_add_draft_settings.py

Success Criteria:

✅ Tables created with proper foreign keys
✅ Can insert test data into both tables
✅ Draft type settings accessible via API


PHASE 1: Backend Models - League Type
Duration: 1 session
Goal: Update backend to support league type distinction
Tasks:

Add LeagueType enum to lifecycle.py
Add league_type, num_keepers, draft_rounds to LeagueCreateRequest
Update validation logic
Update get_league() endpoint to return new fields
Test API endpoint

Files to Modify:

/backend/src/routers/leagues/lifecycle.py
/backend/src/routers/leagues/management.py

Success Criteria:

✅ Can create league with league_type parameter
✅ API returns all new fields
✅ Validation rejects invalid values


PHASE 1.5: Backend Models - Draft Configuration
Duration: 1 session
Goal: Add draft type configuration to backend
Tasks:

Add draft type enums to lifecycle.py
Add draft config fields to LeagueCreateRequest:

redraft_initial_draft_type
dynasty_initial_draft_type
dynasty_subsequent_draft_type
lottery_enabled
lottery_top_excluded


Update validation logic
Test API endpoint

Files to Modify:

/backend/src/routers/leagues/lifecycle.py

Success Criteria:

✅ Can create league with all draft config
✅ API validates draft type options
✅ Conditional validation (lottery only for dynasty)


PHASE 2: Frontend - Basic Info Step
Duration: 1 session
Goal: Add league type selector to UI
Tasks:

Add "League Type" selector to BasicInfoStep.js
Add dynasty/redraft cards with descriptions
Update form state in useLeagueCreation hook
Update validation
Test UI flow

Files to Modify:

/frontend-react/src/components/league-creation/steps/BasicInfoStep.js
/frontend-react/src/hooks/useLeagueCreation.js

Success Criteria:

✅ Can select dynasty or redraft
✅ Selection persists across steps
✅ Visual feedback on selection


PHASE 3: Frontend - Dynasty Settings Step
Duration: 1 session
Goal: Create new step for dynasty-specific configuration
Tasks:

Create DynastySettingsStep.js component
Add keeper rules UI (num_keepers, positions, deadline)
Add draft rounds selector
Add "only show if dynasty" conditional logic
Test conditional rendering

Files to Create:

/frontend-react/src/components/league-creation/steps/DynastySettingsStep.js

Files to Modify:

/frontend-react/src/pages/CreateLeague.js (add conditional step)
/frontend-react/src/hooks/useLeagueCreation.js (add dynasty fields)

Success Criteria:

✅ Step only appears for dynasty leagues
✅ All dynasty settings captured
✅ Validation works correctly


PHASE 4: Frontend - Draft Configuration UI
Duration: 1 session
Goal: Add draft type selectors to Dynasty Settings
Tasks:

Add "Initial Draft Type" section

Snake, Random Repeating, Auction, Commissioner


Add "Subsequent Draft Type" section (dynasty only)

Basic Standings, Standings + Lottery, Auction, Commissioner


Add lottery configuration UI (if lottery selected)

Enable/disable toggle
Top teams excluded slider (0-10)


Test all combinations

Files to Modify:

/frontend-react/src/components/league-creation/steps/DynastySettingsStep.js

Success Criteria:

✅ All draft types selectable
✅ Lottery config only shows when relevant
✅ Helpful tooltips explain options


PHASE 5: Frontend - Conditional Feature Rendering
Duration: 1 session
Goal: Hide/show features based on league type
Tasks:

Update FinancialStep - hide contracts for redraft
Update TradeSettings - hide draft picks for redraft
Update RosterStep - add dynasty badges
Test both dynasty and redraft flows completely

Files to Modify:

/frontend-react/src/components/league-creation/steps/FinancialStep.js
/frontend-react/src/components/league-creation/steps/TradeSettings.js
/frontend-react/src/components/league-creation/steps/RosterStep.js

Success Criteria:

✅ Redraft leagues don't see contract options
✅ Redraft leagues don't see draft pick trading
✅ UI clearly indicates league type throughout


PHASE 6: Backend - Draft Order Calculation Engine
Duration: 1 session
Goal: Build logic to calculate draft order for any scenario
Tasks:

Create /backend/src/routers/leagues/draft_order.py
Implement generate_snake_order(teams, rounds)
Implement generate_standings_order(teams, standings, rounds)
Implement generate_random_repeating_order(teams, rounds)
Add tests for each function

Files to Create:

/backend/src/routers/leagues/draft_order.py

Functions to Implement:
pythondef generate_snake_order(teams: list, num_rounds: int) -> list
def generate_standings_order(standings: list, num_rounds: int) -> list  
def generate_random_repeating_order(teams: list, num_rounds: int) -> list
def save_draft_order(league_id, season_year, draft_order) -> bool
def get_draft_order(league_id, season_year) -> list
Success Criteria:

✅ Can generate snake order correctly
✅ Can generate standings-based order
✅ Draft order saved to draft_order_history table


PHASE 7: Backend - NBA Lottery System
Duration: 1 session
Goal: Implement weighted lottery for Round 1
Tasks:

Add lottery functions to draft_order.py
Implement NBA odds weighting
Implement lottery execution algorithm
Save lottery results to lottery_results table
Integrate with draft order generation

Functions to Implement:
pythondef get_nba_lottery_odds(num_teams: int, top_excluded: int) -> dict
def execute_lottery(league_id, season_year, standings, top_excluded) -> dict
def apply_lottery_to_round_1(draft_order, lottery_results) -> list
NBA Odds Reference:
pythonNBA_ODDS = [
    0.140,  # 14%
    0.140,  # 14%
    0.140,  # 14%
    0.125,  # 12.5%
    0.105,  # 10.5%
    0.090,  # 9%
    0.075,  # 7.5%
    0.060,  # 6%
    0.045,  # 4.5%
    0.030,  # 3%
    0.020,  # 2%
    0.015,  # 1.5%
    0.010,  # 1%
    0.005   # 0.5%
]
Success Criteria:

✅ Lottery odds calculated correctly
✅ Lottery execution deterministic (seeded random)
✅ Top teams excluded properly
✅ Results saved to database


PHASE 8: Backend - Draft Order API Endpoints
Duration: 1 session
Goal: Expose draft order functionality via API
Tasks:

Add GET /api/leagues/{id}/draft-order/{year} endpoint
Add POST /api/leagues/{id}/draft-order/{year}/generate endpoint
Add POST /api/leagues/{id}/draft-order/{year}/manual endpoint
Add GET /api/leagues/{id}/lottery/{year} endpoint
Test all endpoints

New Endpoints:
javascriptGET /api/leagues/{league_id}/draft-order/{year}
// Returns: Complete draft order for a season

POST /api/leagues/{league_id}/draft-order/{year}/generate
// Body: { draft_type: 'snake' | 'standings' | 'lottery' }
// Action: Generates and saves draft order

POST /api/leagues/{league_id}/draft-order/{year}/manual
// Body: { draft_order: [...] }  
// Action: Commissioner manually sets order

GET /api/leagues/{league_id}/lottery/{year}
// Returns: Lottery results for a season
Success Criteria:

✅ Can retrieve draft order
✅ Can generate draft order automatically
✅ Commissioner can override manually
✅ Can view lottery results


PHASE 9: Frontend - Draft Order Management UI
Duration: 1 session
Goal: Build commissioner interface for draft order
Tasks:

Create /frontend-react/src/pages/commissioner/DraftOrderManager.js
Add "View Draft Order" section (read-only)
Add "Generate Draft Order" button
Add "Manual Override" form
Add "Lottery Results" view (if applicable)

New Page Components:
jsx<DraftOrderManager league={league} season={currentSeason}>
  <DraftOrderViewer order={draftOrder} />
  <GenerateDraftOrderButton onGenerate={handleGenerate} />
  <ManualOverrideForm onSubmit={handleManualSet} />
  {lotteryEnabled && <LotteryResultsView results={lotteryResults} />}
</DraftOrderManager>
Success Criteria:

✅ Commissioner can view current draft order
✅ Can generate order with one click
✅ Can manually set order if needed
✅ Lottery results displayed clearly


PHASE 10: Integration Testing & Polish
Duration: 1 session
Goal: Test all scenarios end-to-end
Test Cases:

✅ Create redraft league with snake draft
✅ Create dynasty league with basic standings
✅ Create dynasty league with lottery
✅ Generate Year 1 draft order (snake)
✅ Generate Year 2 draft order (standings)
✅ Execute lottery for Year 2 Round 1
✅ Commissioner override draft order
✅ Verify draft picks table uses correct order

Files to Modify:

Various (polish and bug fixes)

Success Criteria:

✅ All test cases pass
✅ No console errors
✅ Documentation updated


🎯 DEFAULT VALUES STRATEGY
For New Redraft Leagues:
javascript{
  league_type: 'redraft',
  num_keepers: 0,
  draft_rounds: 23,
  redraft_initial_draft_type: 'snake',
  lottery_enabled: false
}
For New Dynasty Leagues:
javascript{
  league_type: 'dynasty',
  num_keepers: 15,
  draft_rounds: 23,
  dynasty_initial_draft_type: 'snake',
  dynasty_subsequent_draft_type: 'standings_lottery',
  lottery_enabled: true,
  lottery_top_excluded: 3,
  lottery_weighting: 'nba_style',
  keeper_deadline_date: '2025-03-01'
}
For Existing Leagues (Migration):
javascript{
  league_type: 'dynasty',  // Safe assumption
  num_keepers: 15,         // ~65% of roster
  draft_rounds: 23,        // Full roster size
  dynasty_initial_draft_type: 'snake',
  dynasty_subsequent_draft_type: 'basic_standings',  // Conservative default
  lottery_enabled: false,  // Don't enable automatically
  keeper_deadline_date: '2025-03-01'
}

📊 PHASE SUMMARY TABLE
PhaseNameDurationDependenciesDeliverable0DB Schema - Core1 sessionNoneleague_type column added0.5DB Schema - Draft Tables1 sessionPhase 0New tables created1Backend - League Type1 sessionPhase 0API supports league_type1.5Backend - Draft Config1 sessionPhase 0.5API supports draft config2Frontend - Basic Info1 sessionPhase 1League type selector UI3Frontend - Dynasty Step1 sessionPhase 2Dynasty settings UI4Frontend - Draft Config1 sessionPhase 3Draft type selectors5Frontend - Conditional1 sessionPhase 4Features hide/show correctly6Backend - Draft Order1 sessionPhase 0.5Draft order calculation7Backend - Lottery1 sessionPhase 6NBA lottery system8Backend - API Endpoints1 sessionPhase 7Draft order REST API9Frontend - Draft Manager1 sessionPhase 8Commissioner UI10Integration Testing1 sessionPhase 9End-to-end validation
Total Duration: 12 sessions
Can Start Draft Pick Trading: After Phase 8 complete

✅ SUCCESS CRITERIA - FINAL CHECKLIST
Phase 0-1.5 (Database + Backend):

 All existing leagues migrated safely
 league_type queryable via API
 num_keepers and draft_rounds stored correctly
 New tables created with proper indexes
 All draft type settings captured

Phase 2-5 (Frontend - Creation Flow):

 Users can select dynasty or redraft
 Dynasty leagues show Dynasty Settings step
 Redraft leagues skip Dynasty Settings step
 All draft types selectable with clear explanations
 Lottery configuration only shows when relevant
 Contracts hidden for redraft leagues
 Draft pick trading hidden for redraft leagues

Phase 6-8 (Backend - Draft Order Logic):

 Snake order generated correctly
 Standings-based order generated correctly
 Random repeating order generated correctly
 NBA lottery executes with proper odds
 Top teams excluded from lottery correctly
 Draft order saved to database
 API endpoints functional and tested

Phase 9-10 (Frontend - Commissioner Tools):

 Commissioner can view draft order
 Commissioner can generate draft order
 Commissioner can manually override order
 Lottery results displayed clearly
 All test scenarios pass

Ready for Draft Pick Trading When:

 Can query draft order for any year
 Can determine # of rounds from settings
 Can filter features by league_type
 Draft order calculation verified accurate


🚨 CRITICAL NOTES

Phases must be completed in order - Each builds on previous
Test after every phase - Don't accumulate bugs
Lottery is complex - Phase 7 needs extra attention
Commissioner overrides are fail-safes - Always allow manual control
Existing leagues default to conservative settings - Don't break production


📝 NEXT STEPS

Review this plan - Confirm phasing makes sense
Approve default values - Especially for existing leagues
Start Phase 0 - Database schema for league_type
Proceed sequentially - One phase per session
After Phase 8 - Ready for Draft Pick Initialization


END OF PLAN v2.0