# ⚡ PHASE 0 SESSION HANDOFF

**PASTE THIS AT START OF NEXT SESSION →**

---

```
=== PHASE 0: TRADE SETTINGS IMPLEMENTATION ===

ASSISTANT: Read these files first (in order):
1. /home/strakajagr/projects/dynasty-dugout/backend/PHASE_0_COMPLETE_GUIDE.md
2. /home/strakajagr/projects/dynasty-dugout/backend/PHASE_0_QUICK_START.md

TASK: Add 10 trade settings to league creation
FILES: 2 backend, 2 frontend
TIME: 30-40 minutes
STATUS: Research complete, ready to implement

STEPS:
1. Backend: lifecycle.py (str_replace - exact code in guide)
2. Backend: worker_function.py (str_replace - exact code in guide)
3. Frontend: Create TradeSettings.js (I'll paste code)
4. Frontend: Update league wizard (need to find file)
5. Deploy & Test

START: Read /backend/src/routers/leagues/lifecycle.py
```

---

---

## 📝 BACKEND CHANGES (2 files)

### File 1: lifecycle.py
**Location:** In `LeagueCreateRequest` class, after `season_end_date` field  
**Method:** str_replace with this EXACT code:

**FIND THIS:**
```python
    season_end_date: str = Field(default_factory=lambda: f'{get_current_season()}-09-28')
```

**REPLACE WITH THIS:**
```python
    season_end_date: str = Field(default_factory=lambda: f'{get_current_season()}-09-28')
    
    # Trade Configuration
    veto_system: str = Field(
        default='none',
        pattern='^(none|commissioner|league_vote)$',
        description="Veto system: none, commissioner, or league_vote"
    )
    veto_threshold: float = Field(
        default=0.5,
        ge=0.1,
        le=1.0,
        description="Percentage of teams needed to veto (if league_vote)"
    )
    veto_period_hours: int = Field(
        default=48,
        ge=0,
        le=168,
        description="Hours before trade auto-processes (if veto enabled)"
    )
    trade_deadline_enabled: bool = Field(
        default=True,
        description="Enable trade deadline?"
    )
    trade_deadline_date: str = Field(
        default='08-31',
        pattern='^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
        description="Trade deadline date (MM-DD format)"
    )
    future_picks_tradeable_years: int = Field(
        default=1,
        ge=0,
        le=5,
        description="How many years ahead can picks be traded"
    )
    fa_cash_tradeable: bool = Field(
        default=True,
        description="Can teams trade FAAB/cash?"
    )
    max_fa_cash_per_trade: Optional[float] = Field(
        default=None,
        ge=0,
        description="Maximum cash per trade (null = unlimited)"
    )
    min_roster_size: int = Field(
        default=25,
        ge=15,
        le=50,
        description="Minimum roster size after trade"
    )
    max_roster_size: int = Field(
        default=40,
        ge=20,
        le=60,
        description="Maximum roster size after trade"
    )
```

**ALSO CHECK:** Make sure `Optional` is imported at top:
```python
from typing import Optional
```

---

### File 2: worker_function.py
**Location:** In `settings_to_insert` list, after `('season_end_date', ...)` line  
**Method:** str_replace with this EXACT code:

**FIND THIS:**
```python
    ('season_end_date', league_data.get('season_end_date', '2025-09-28'), 'string'),
    
    # System settings
    ('current_season', str(current_season), 'integer'),
```

**REPLACE WITH THIS:**
```python
    ('season_end_date', league_data.get('season_end_date', '2025-09-28'), 'string'),
    
    # Trade settings
    ('veto_system', league_data.get('veto_system', 'none'), 'string'),
    ('veto_threshold', str(league_data.get('veto_threshold', 0.5)), 'float'),
    ('veto_period_hours', str(league_data.get('veto_period_hours', 48)), 'integer'),
    ('trade_deadline_enabled', str(league_data.get('trade_deadline_enabled', True)), 'boolean'),
    ('trade_deadline_date', league_data.get('trade_deadline_date', '08-31'), 'string'),
    ('future_picks_tradeable_years', str(league_data.get('future_picks_tradeable_years', 1)), 'integer'),
    ('fa_cash_tradeable', str(league_data.get('fa_cash_tradeable', True)), 'boolean'),
    ('max_fa_cash_per_trade', str(league_data.get('max_fa_cash_per_trade') or 'null'), 'string'),
    ('min_roster_size', str(league_data.get('min_roster_size', 25)), 'integer'),
    ('max_roster_size', str(league_data.get('max_roster_size', 40)), 'integer'),
    
    # System settings
    ('current_season', str(current_season), 'integer'),
```

---

## 🎨 FRONTEND CHANGES (2 files)

### File 1: TradeSettings.js (NEW FILE)
**⚠️ YOU MUST CREATE THIS FILE MANUALLY**

**Path:** `/frontend-react/src/components/league-setup/TradeSettings.js`

**What I'll do:**
1. Tell you to create the file
2. Give you complete code to paste (it's in the guide)
3. You paste it and save

### File 2: League Setup Wizard (UNKNOWN LOCATION)
**⚠️ NEED TO FIND THIS FILE FIRST**

**Possible locations:**
- `/frontend-react/src/pages/league-setup/LeagueSetupWizard.js`
- `/frontend-react/src/pages/create-league/CreateLeague.js`
- `/frontend-react/src/components/league/LeagueCreation.js`

**Search command:**
```bash
find /home/strakajagr/projects/dynasty-dugout/frontend-react/src \
  -name "*[Ss]etup*" -o -name "*[Cc]reate*" | grep -i league
```

**What to add:**
```javascript
import TradeSettings from '../../components/league-setup/TradeSettings';

// In steps array, add:
{ id: 5, title: 'Trades', component: TradeSettings },
```

---

## ✅ DEPLOYMENT & TESTING

### Backend Deployment
```bash
cd /home/strakajagr/projects/dynasty-dugout/backend
sam build
sam deploy
```

**Wait for:** "Successfully created/updated stack" message

---

### Frontend Deployment
```bash
cd ~/projects/dynasty-dugout/frontend-react/
npm run build
./deploy.sh
```

**Wait for:** CloudFront invalidation complete

---

### Testing Steps

1. **Open app in browser:**
   - Navigate to league creation
   - Verify "Trades" step appears in wizard
   - Try different settings (veto system, deadline, etc.)
   - Complete league creation

2. **Verify in database:**
   ```sql
   -- Connect to postgres database
   SELECT setting_name, setting_value, setting_type
   FROM league_settings
   WHERE league_id = 'your-new-test-league-id'
     AND (setting_name LIKE '%trade%' 
          OR setting_name LIKE '%veto%' 
          OR setting_name LIKE '%roster%')
   ORDER BY setting_name;
   ```

3. **Expected results (10 rows):**
   ```
   fa_cash_tradeable              True        boolean
   future_picks_tradeable_years   1           integer
   max_fa_cash_per_trade          null        string
   max_roster_size                40          integer
   min_roster_size                25          integer
   trade_deadline_date            08-31       string
   trade_deadline_enabled         True        boolean
   veto_period_hours              48          integer
   veto_system                    none        string
   veto_threshold                 0.5         float
   ```

---

## 🔧 TROUBLESHOOTING

### Can't find wizard file?
Search for these strings in frontend:
- "LeagueCreateRequest"
- "BasicInfo" + "component"
- "steps" + "title"

### Import errors in lifecycle.py?
Make sure this is at top:
```python
from typing import Optional
```

### TradeSettings.js not rendering?
Check:
1. File created in correct path
2. Import statement in wizard correct
3. Component added to steps array

---

## 📊 SETTINGS ADDED

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| veto_system | string | 'none' | Veto method |
| veto_threshold | float | 0.5 | % to veto |
| veto_period_hours | int | 48 | Review period |
| trade_deadline_enabled | bool | true | Has deadline? |
| trade_deadline_date | string | '08-31' | Deadline date |
| future_picks_tradeable_years | int | 1 | Years ahead |
| fa_cash_tradeable | bool | true | Cash allowed? |
| max_fa_cash_per_trade | float/null | null | Max cash |
| min_roster_size | int | 25 | Min players |
| max_roster_size | int | 40 | Max players |

---

## 💡 KEY DISCOVERIES

### FAAB is Calculated
```javascript
faab = (draft_cap - current_spend) + season_cap
faab = (600 - 30) + 200 = 770
```

### Canonical Structure is Perfect
```javascript
player.financial.contract_salary  // For trades
player.financial.contract_years   // For trades
player.roster.status             // For validation
```

### No Schema Changes Needed
Just adding rows to existing `league_settings` table!

---

## ⏱️ ESTIMATED TIMELINE

| Task | Minutes |
|------|---------|
| Backend lifecycle.py | 2 |
| Backend worker_function.py | 2 |
| Find frontend wizard | 5 |
| Create TradeSettings.js | 3 |
| Update wizard | 2 |
| Deploy backend | 5 |
| Test league creation | 10 |
| Verify database | 3 |
| **TOTAL** | **32 min** |

---

## 📚 FULL DOCUMENTATION

**Complete Guide:**
`/home/strakajagr/projects/dynasty-dugout/backend/PHASE_0_COMPLETE_GUIDE.md`

**Contains:**
- All details about FAAB calculation
- Canonical player structure integration
- Complete code for all files
- Validation examples
- Testing procedures

---

**LET'S DO THIS!** 🚀

---

## ✅ PHASE 0 COMPLETION CHECKLIST

Mark each item as you complete it:

### Backend
- [ ] lifecycle.py modified (10 fields added)
- [ ] worker_function.py modified (10 settings added)
- [ ] `sam build` successful
- [ ] `sam deploy` successful
- [ ] No deployment errors

### Frontend
- [ ] TradeSettings.js created with full code
- [ ] League wizard file located
- [ ] League wizard updated (Trades step added)
- [ ] `npm run build` successful
- [ ] `./deploy.sh` successful
- [ ] No build errors

### Testing
- [ ] Accessed league creation in browser
- [ ] "Trades" step visible in wizard
- [ ] Can change veto system
- [ ] Can toggle trade deadline
- [ ] Can adjust all settings
- [ ] Created test league successfully
- [ ] Database query shows 10 new settings
- [ ] All settings have correct values

### Verification
- [ ] veto_system = 'none' (or your choice)
- [ ] veto_threshold = 0.5
- [ ] veto_period_hours = 48
- [ ] trade_deadline_enabled = True
- [ ] trade_deadline_date = '08-31'
- [ ] future_picks_tradeable_years = 1
- [ ] fa_cash_tradeable = True
- [ ] max_fa_cash_per_trade = null
- [ ] min_roster_size = 25
- [ ] max_roster_size = 40

**PHASE 0 COMPLETE WHEN ALL BOXES CHECKED** ✅

---

## 🚀 HANDOFF TO PHASE 1

### What We Built in Phase 0
✅ League settings for trades (10 new settings)  
✅ Trade configuration UI in league setup  
✅ Settings persist to database correctly  
✅ Commissioners can customize trade rules  

### What's Next: Phase 1 - Database Schema

**Create these tables in `leagues` database:**

1. **`league_trades`** - Trade proposals and history
   - trade_id, league_id, status, proposed_by, proposed_to
   - proposed_date, accepted_date, processed_date, vetoed_date
   - veto_votes_for, veto_votes_against
   - commissioner_notes

2. **`trade_players`** - Players in each trade
   - trade_player_id, trade_id, league_player_id
   - from_team_id, to_team_id
   - player_name, position, salary (denormalized for history)

3. **`trade_picks`** - Draft picks in trades
   - trade_pick_id, trade_id
   - from_team_id, to_team_id
   - pick_year, pick_round, original_team_id

4. **`trade_cash`** - Cash/FAAB in trades
   - trade_cash_id, trade_id
   - from_team_id, to_team_id, amount

5. **`draft_picks`** - Track all draft picks
   - pick_id, league_id, team_id, original_team_id
   - year, round, pick_number
   - tradeable, traded_to_team_id, trade_id

6. **`trade_votes`** - League vote tracking (if veto_system = 'league_vote')
   - vote_id, trade_id, team_id, user_id
   - vote (approve/veto), voted_at

**Estimated Time:** 1-2 hours  
**Complexity:** Medium (schema design + migrations)

### Phase 1 Session Starter

```
=== PHASE 1: TRADE DATABASE SCHEMA ===

COMPLETED: Phase 0 - Trade settings in league creation
NOW: Create database tables for trades system

CONTEXT: We have 10 trade settings saved. Now we need tables to store:
- Trade proposals (pending/accepted/rejected/vetoed)
- Players/picks/cash in each trade
- Draft picks (for trading)
- Vote tracking (if league uses voting)

FIRST: Read design doc section on database schema
THEN: Create SQL for 6 new tables in 'leagues' database

START: Review Phase 1 requirements in trade design doc
```

### Documentation for Phase 1
- Main design: `/backend/TRADE_SYSTEM_FINAL_DESIGN_v2.0.md`
- Canonical integration: `/backend/CANONICAL_TRADES_INTEGRATION.md`

---

## 📊 CURRENT STATUS

| Phase | Status | Duration | Notes |
|-------|--------|----------|-------|
| **Phase 0** | ✅ COMPLETE | ~40 min | Trade settings in league creation |
| **Phase 1** | 🔜 NEXT | ~90 min | Database schema for trades |
| Phase 2 | ⏳ Pending | ~60 min | Draft picks initialization |
| Phase 2.5 | ⏳ Pending | ~60 min | Trade stats endpoint |
| Phase 3-16 | ⏳ Pending | ~12 hrs | Trade UI & processing |

**Total Progress:** 1/17 phases (6%)  
**Estimated Total Time:** ~16 sessions

---

**CONGRATULATIONS ON COMPLETING PHASE 0!** 🎉