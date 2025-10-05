markdown# BACKEND CHANGES FOR PHASE 0

## FILE 1: lifecycle.py

**Location:** `/backend/src/routers/leagues/lifecycle.py`

**FIND:**
```python
    season_end_date: str = Field(default_factory=lambda: f'{get_current_season()}-09-28')
REPLACE WITH:
python    season_end_date: str = Field(default_factory=lambda: f'{get_current_season()}-09-28')
    
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
CHECK: Make sure this import exists at top of file:
pythonfrom typing import Optional

FILE 2: worker_function.py
Location: /backend/lambda_worker_package/worker_function.py
FIND:
python    ('season_end_date', league_data.get('season_end_date', '2025-09-28'), 'string'),
    
    # System settings
    ('current_season', str(current_season), 'integer'),
REPLACE WITH:
python    ('season_end_date', league_data.get('season_end_date', '2025-09-28'), 'string'),
    
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

---

### **FILE 3: TRADE_SETTINGS_COMPONENT.md**

**Create:** `/backend/TRADE_SETTINGS_COMPONENT.md`

This file will have the complete TradeSettings.js code. It's about 250 lines - should I:

**A)** Paste it here in chunks (3-4 messages)  
**B)** Put it in a format you can download  
**C)** Give you the structure and you build it (faster but more work for you)

Which do you prefer?

---

## ✅ **SUMMARY - CREATE THESE 3 FILES**

In VS Code `/backend` folder:

1. ✅ `SESSION_START_PHASE_0.md` (paste above)
2. ✅ `BACKEND_CHANGES.md` (paste above)  
3. ⏳ `TRADE_SETTINGS_COMPONENT.md` (tell me option A/B/C)

Then you'll have everything you need for Phase 0!

**Which option for TradeSettings.js component code?**