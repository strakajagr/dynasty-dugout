# Dynasty Dugout - Complete Technical Documentation

## 🎯 **Executive Summary**

Dynasty Dugout is a production-ready fantasy baseball platform built with React frontend, FastAPI backend, and PostgreSQL database. The system uses a sophisticated league-per-database architecture with team attribution for advanced analytics.

## 🏗️ **System Architecture & Design Philosophy**

### **High-Level Architecture**
```
User Browser → CloudFront CDN → React App (Frontend)
                              ↓
User Actions → API Gateway → Lambda (FastAPI) → PostgreSQL (Backend)
                              ↓
                         Email (SES) + Auth (Cognito)
```

### **Core Design Principles**

1. **Single Source of Truth**: 
   - All styling flows through `dynastyTheme` design system
   - All API calls centralized in `apiService.js`
   - MLB HISTORICAL data stored once in main database, referenced by all leagues
   - MLB DAILY GAME LOGS downloaded daily and stored in MAIN DB

2. **Separation of Concerns**: 
   - Frontend: Pure React components using design system
   - Backend: API services with no UI logic
   - Infrastructure: CloudFront + API Gateway + Lambda + PostgreSQL

3. **Database-per-League Architecture**:
   - Main database: Shared MLB data and league registry ("phone book")
   - League databases: One isolated database per league for scalability
   - No data duplication: League DBs reference main DB via foreign keys
   - League DBs download CURRENT SEASON (2025) game logs as needed to track stats for ROSTERED players IN starting lineups – ROSTERED players NOT in starting lineup accrue no stats so game log data is not needed – Game log stats used to CALCUATE ACCRUED STARTING LINEUP statistics
   - All over data to be stored in and requested from MAIN DB.

4. **Team Attribution System**:
   - Track player performance while on specific teams (for analytics purposes) BUT CALCULATE and add to fantasy totals when player is IN the starting lineup for that fantasy team.
   - Enable "two-line" display: season stats vs team-specific stats vs. stats for the last two weeks (to be calculated upon gamelog downloads from MAIN DB on the fly) for table on “MyRoster.js”
   - Enable “two-line” display season stats vs team-specific stats vs. stats for the last two weeks (to be calculated upon gamelog downloads from MAIN DB on the fly) for all over tables.
   - Support trade analysis and contract evaluation

---

## 🗄️ **Database Architecture**

### **Why Database-per-League?**

**The Problem**: Traditional approach would store all leagues in one database:
- 1000 leagues × 1000 players = 1M records per table
- Complex queries with league filtering
- Performance degrades as leagues grow
- Security issues with league isolation

**The Solution**: Separate database per league:
- Each league gets `league_{league_id}` database
- Only 12-20 teams × ~300 players = manageable size
- Perfect isolation between leagues
- Linear scaling (1000 leagues = 1000 small DBs + 1 main DB)
- Dramatic cost savings vs data replication

### **Main Database: `postgres`**
**Purpose**: Shared MLB data and league registry (phone book)

```sql
-- =================================
-- PHONE BOOK TABLES (League Registry)
-- =================================

CREATE TABLE user_leagues (
    league_id UUID PRIMARY KEY,
    league_name VARCHAR(255) NOT NULL,
    commissioner_user_id VARCHAR(255) NOT NULL, -- AWS Cognito user ID
    database_name VARCHAR(255) NOT NULL,        -- "league_abc123_def456..."
    max_teams INTEGER DEFAULT 12,
    created_at TIMESTAMP DEFAULT NOW(),
    settings JSONB -- Basic league configuration
);

CREATE TABLE league_memberships (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES user_leagues(league_id),
    user_id VARCHAR(255) NOT NULL, -- AWS Cognito user ID
    role VARCHAR(50) DEFAULT 'member', -- 'commissioner', 'member'
    joined_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_user_league UNIQUE(league_id, user_id)
);

-- =================================
-- MLB DATA TABLES (Single Source of Truth)
-- =================================

CREATE TABLE mlb_players (
    player_id INTEGER PRIMARY KEY, -- MLB official player ID
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(10), -- 'C', '1B', '2B', 'SS', '3B', 'OF', 'DH', 'SP', 'RP'
    mlb_team VARCHAR(10), -- 'LAA', 'NYY', 'BOS', etc.
    jersey_number INTEGER,
    birth_date DATE,
    height_inches INTEGER,
    weight_lbs INTEGER,
    bats VARCHAR(1), -- 'L', 'R', 'S' (switch)
    throws VARCHAR(1), -- 'L', 'R'
    active BOOLEAN DEFAULT TRUE,
    debut_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE player_game_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL REFERENCES mlb_players(player_id),
    game_date DATE NOT NULL,
    opponent VARCHAR(10), -- Opposing team abbreviation
    home_away VARCHAR(1), -- 'H' or 'A'
    
    -- Hitting Stats (per game)
    at_bats INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    doubles INTEGER DEFAULT 0,
    triples INTEGER DEFAULT 0,
    home_runs INTEGER DEFAULT 0,
    rbi INTEGER DEFAULT 0,
    runs INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    caught_stealing INTEGER DEFAULT 0,
    hit_by_pitch INTEGER DEFAULT 0,
    sacrifice_hits INTEGER DEFAULT 0,
    sacrifice_flies INTEGER DEFAULT 0,
    
    -- Pitching Stats (per game)
    innings_pitched DECIMAL(4,1) DEFAULT 0, -- Can be fractional (6.1 = 6⅓ innings)
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    blown_saves INTEGER DEFAULT 0,
    holds INTEGER DEFAULT 0,
    earned_runs INTEGER DEFAULT 0,
    hits_allowed INTEGER DEFAULT 0,
    walks_allowed INTEGER DEFAULT 0,
    strikeouts_pitched INTEGER DEFAULT 0,
    home_runs_allowed INTEGER DEFAULT 0,
    hit_batters INTEGER DEFAULT 0,
    wild_pitches INTEGER DEFAULT 0,
    balks INTEGER DEFAULT 0,
    
    -- Game context
    game_started BOOLEAN DEFAULT FALSE, -- Did player start this game?
    complete_game BOOLEAN DEFAULT FALSE,
    shutout BOOLEAN DEFAULT FALSE,
    quality_start BOOLEAN DEFAULT FALSE, -- 6+ IP, ≤3 ER
    
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_player_game_date UNIQUE(player_id, game_date)
);

CREATE TABLE player_stats (
    stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL REFERENCES mlb_players(player_id),
    season INTEGER NOT NULL, -- 2024, 2025, etc.
    
    -- Calculated season totals (aggregated from game logs)
    games_played INTEGER DEFAULT 0,
    games_started INTEGER DEFAULT 0,
    
    -- Hitting totals
    at_bats INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    doubles INTEGER DEFAULT 0,
    triples INTEGER DEFAULT 0,
    home_runs INTEGER DEFAULT 0,
    rbi INTEGER DEFAULT 0,
    runs INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    caught_stealing INTEGER DEFAULT 0,
    
    -- Calculated hitting ratios
    avg DECIMAL(4,3) DEFAULT 0.000, -- Batting average
    obp DECIMAL(4,3) DEFAULT 0.000, -- On-base percentage
    slg DECIMAL(4,3) DEFAULT 0.000, -- Slugging percentage
    ops DECIMAL(4,3) DEFAULT 0.000, -- On-base plus slugging
    
    -- Pitching totals
    innings_pitched DECIMAL(5,1) DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    blown_saves INTEGER DEFAULT 0,
    holds INTEGER DEFAULT 0,
    earned_runs INTEGER DEFAULT 0,
    hits_allowed INTEGER DEFAULT 0,
    walks_allowed INTEGER DEFAULT 0,
    strikeouts_pitched INTEGER DEFAULT 0,
    home_runs_allowed INTEGER DEFAULT 0,
    
    -- Calculated pitching ratios
    era DECIMAL(4,2) DEFAULT 0.00, -- Earned run average
    whip DECIMAL(4,3) DEFAULT 0.000, -- Walks + hits per inning pitched
    k9 DECIMAL(4,2) DEFAULT 0.00, -- Strikeouts per 9 innings
    bb9 DECIMAL(4,2) DEFAULT 0.00, -- Walks per 9 innings
   quality starts INTEGER DEFAULT 0, (******* Quality starts (QS) are calculated as 6 or more IP AND 3 or fewer ER)
    
    -- Meta data
    last_updated TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_player_season UNIQUE(player_id, season)
);

-- =================================
-- MLB TEAMS AND SCHEDULES
-- =================================

CREATE TABLE mlb_teams (
    team_id INTEGER PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL, -- "Los Angeles Angels"
    team_city VARCHAR(100) NOT NULL, -- "Los Angeles"
    abbreviation VARCHAR(10) NOT NULL, -- "LAA"
    league VARCHAR(2) NOT NULL, -- "AL" or "NL"
    division VARCHAR(10) NOT NULL, -- "West", "Central", "East"
    established_year INTEGER,
    primary_color VARCHAR(7), -- Hex color code
    secondary_color VARCHAR(7),
    logo_url TEXT,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE mlb_games (
    game_id VARCHAR(50) PRIMARY KEY, -- MLB official game ID
    game_date DATE NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES mlb_teams(team_id),
    away_team_id INTEGER NOT NULL REFERENCES mlb_teams(team_id),
    home_score INTEGER,
    away_score INTEGER,
    innings INTEGER DEFAULT 9,
    game_status VARCHAR(20), -- 'scheduled', 'in_progress', 'final', 'postponed'
    weather_conditions TEXT,
    attendance INTEGER,
    game_time_minutes INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### **League Databases: `league_{league_id}`**
**Purpose**: League-specific data with team attribution system

**Naming Convention**: `league_9857b6c8_181f_44c4_be1d_7d4fe9eb6ae6`
- Replace hyphens with underscores for valid PostgreSQL database names
- Each league completely isolated from others

```sql
-- =================================
-- CORE LEAGUE MANAGEMENT
-- =================================

CREATE TABLE league_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL, -- References main DB user_leagues
    setting_name VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string', -- 'string', 'integer', 'boolean', 'json'
    category VARCHAR(50), -- 'scoring', 'roster', 'ui', 'trading'
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_setting_name UNIQUE(league_id, setting_name)
);

-- Example settings that control UI and behavior:
-- use_salaries: true/false (show salary columns)
-- use_contracts: true/false (show contract length)
-- use_waivers: true/false (enable waiver wire)
-- show_advanced_stats: true/false (show OPS, WHIP, etc.)
-- max_active_hitters: 14 (roster size)
-- max_pitchers: 9 (roster size)
-- salary_cap: 260000000 (in dollars)
-- trade_deadline: '2025-07-31' (trading cutoff)

CREATE TABLE league_teams (
    team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL, -- AWS Cognito user ID
    team_name VARCHAR(255) NOT NULL,
    manager_name VARCHAR(255) NOT NULL,
    manager_email VARCHAR(255) NOT NULL,
    team_logo_url TEXT,
    team_colors JSONB, -- {"primary": "#FF0000", "secondary": "#FFFFFF"}
    team_motto TEXT,
    is_commissioner BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    total_salary DECIMAL(12,2) DEFAULT 0, -- Current payroll
    roster_spots_used INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    ties INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0, -- Rotisserie or points league scoring
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_team_name UNIQUE(league_id, team_name),
    CONSTRAINT unique_user_league UNIQUE(league_id, user_id)
);

CREATE TABLE league_players (
    league_player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mlb_player_id INTEGER NOT NULL, -- FK to postgres.mlb_players.player_id
    team_id UUID REFERENCES league_teams(team_id), -- NULL = free agent
    
    -- Contract details
    salary DECIMAL(8,2), -- Annual salary for this league
    contract_years INTEGER DEFAULT 1, -- Length of contract
    contract_start_date DATE,
    contract_end_date DATE,
    
    -- Roster status
    availability_status VARCHAR(20) DEFAULT 'free_agent', 
    -- 'free_agent', 'owned', 'waiver', 'disabled_list'
    roster_status VARCHAR(20) DEFAULT 'active',
    -- 'active', 'bench', 'injured', 'suspended', 'minors'
    
    -- Acquisition tracking
    acquisition_date TIMESTAMP,
    acquisition_method VARCHAR(20), -- 'draft', 'trade', 'waiver', 'free_agent'
    acquisition_cost DECIMAL(8,2), -- What was paid (salary, draft pick value)
    
    -- Performance tracking
    games_started_for_team INTEGER DEFAULT 0,
    fantasy_points DECIMAL(8,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_player_league UNIQUE(league_id, mlb_player_id)
);

-- =================================
-- INVITATION & OWNER MANAGEMENT
-- =================================

CREATE TABLE league_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    personal_message TEXT,
    target_slot INTEGER, -- Which team slot this invitation is for
    invitation_token TEXT NOT NULL, -- JWT token for secure acceptance
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', 
    -- 'pending', 'accepted', 'cancelled', 'expired'
    
    -- User tracking (all VARCHAR for Cognito compatibility)
    invited_by VARCHAR(255) NOT NULL, -- Commissioner user ID
    invited_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL, -- 72 hours from creation
    accepted_at TIMESTAMP,
    accepted_by_user_id VARCHAR(255),
    cancelled_at TIMESTAMP,
    cancelled_by_user_id VARCHAR(255),
    
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_pending_email UNIQUE(league_id, email, status)
    -- Only one pending invitation per email per league
);

-- =================================
-- TRANSACTIONS & ROSTER MOVES
-- =================================

CREATE TABLE league_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_player_id UUID NOT NULL REFERENCES league_players(league_player_id),
    
    -- Team movement
    from_team_id UUID REFERENCES league_teams(team_id), -- NULL = from free agency
    to_team_id UUID REFERENCES league_teams(team_id), -- NULL = to free agency
    
    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL,
    -- 'add', 'drop', 'trade', 'waiver_claim', 'draft_pick'
    transaction_date TIMESTAMP DEFAULT NOW(),
    processed_date TIMESTAMP, -- When transaction actually took effect
    
    -- Financial terms
    salary DECIMAL(8,2), -- Salary for this transaction
    contract_years INTEGER,
    signing_bonus DECIMAL(8,2),
    
    -- Trade details (if applicable)
    trade_partner_team_id UUID REFERENCES league_teams(team_id),
    trade_value DECIMAL(8,2), -- Estimated value
    
    -- Waiver details (if applicable)
    waiver_priority INTEGER, -- Claim priority
    waiver_amount DECIMAL(8,2), -- Bid amount
    
    -- Administrative
    approved_by VARCHAR(255), -- Commissioner user ID (if approval required)
    approved_at TIMESTAMP,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- =================================
-- SCORING & STANDINGS
-- =================================

CREATE TABLE league_standings (
    standing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES league_teams(team_id),
    
    -- Rotisserie categories
    category VARCHAR(50) NOT NULL, 
    -- 'avg', 'hr', 'rbi', 'runs', 'sb', 'era', 'whip', 'wins', 'saves', 'strikeouts'
    value DECIMAL(10,4) NOT NULL, -- Actual statistical value
    rank INTEGER, -- 1st, 2nd, 3rd place in this category
    points INTEGER, -- Points awarded (12 teams = 12 pts for 1st, 1 pt for 12th)
    
    -- Metadata
    calculation_date DATE DEFAULT CURRENT_DATE,
    season_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_team_category UNIQUE(team_id, category, calculation_date)
);

CREATE TABLE league_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL, -- Message author
    recipient_user_id VARCHAR(255), -- NULL = league-wide message
    
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'general',
    -- 'general', 'trade_proposal', 'system_notification', 'admin_announcement'
    
    -- Trade proposal specific
    trade_proposal_id UUID, -- Links to trade proposals table
    
    -- Message status
    is_read BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE, -- Commissioner can pin important messages
    is_deleted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =================================
-- TEAM ATTRIBUTION SYSTEM (Advanced Analytics)
-- =================================

CREATE TABLE player_daily_team_stats (
    daily_stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mlb_player_id INTEGER NOT NULL, -- FK to main DB
    team_id UUID NOT NULL REFERENCES league_teams(team_id),
    game_date DATE NOT NULL,
    
    -- Daily hitting stats (copied from main DB game logs)
    at_bats INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    doubles INTEGER DEFAULT 0,
    triples INTEGER DEFAULT 0,
    home_runs INTEGER DEFAULT 0,
    rbi INTEGER DEFAULT 0,
    runs INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    caught_stealing INTEGER DEFAULT 0,
    
    -- Daily pitching stats
    innings_pitched DECIMAL(4,1) DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    blown_saves INTEGER DEFAULT 0,
    earned_runs INTEGER DEFAULT 0,
    hits_allowed INTEGER DEFAULT 0,
    walks_allowed INTEGER DEFAULT 0,
    strikeouts_pitched INTEGER DEFAULT 0,
    home_runs_allowed INTEGER DEFAULT 0,
    
    -- Attribution metadata
    ownership_start_date DATE, -- When this team acquired the player
    ownership_end_date DATE, -- When this team lost the player (NULL if still owned)
    
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_player_team_date UNIQUE(mlb_player_id, team_id, game_date)
);

CREATE TABLE player_team_accumulated_stats (
    accumulated_stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mlb_player_id INTEGER NOT NULL,
    team_id UUID NOT NULL REFERENCES league_teams(team_id),
    
    -- Date range this player was on this team
    first_game_date DATE NOT NULL,
    last_game_date DATE, -- NULL if still on team
    
    -- Accumulated hitting stats (sum of daily stats)
    team_games_played INTEGER DEFAULT 0,
    team_at_bats INTEGER DEFAULT 0,
    team_hits INTEGER DEFAULT 0,
    team_doubles INTEGER DEFAULT 0,
    team_triples INTEGER DEFAULT 0,
    team_home_runs INTEGER DEFAULT 0,
    team_rbi INTEGER DEFAULT 0,
    team_runs INTEGER DEFAULT 0,
    team_walks INTEGER DEFAULT 0,
    team_strikeouts INTEGER DEFAULT 0,
    team_stolen_bases INTEGER DEFAULT 0,
    team_caught_stealing INTEGER DEFAULT 0,
    
    -- Calculated hitting ratios (while on this team)
    team_batting_avg DECIMAL(4,3) DEFAULT 0.000,
    team_on_base_pct DECIMAL(4,3) DEFAULT 0.000,
    team_slugging_pct DECIMAL(4,3) DEFAULT 0.000,
    team_ops DECIMAL(4,3) DEFAULT 0.000,
    
    -- Accumulated pitching stats
    team_innings_pitched DECIMAL(5,1) DEFAULT 0,
    team_wins INTEGER DEFAULT 0,
    team_losses INTEGER DEFAULT 0,
    team_saves INTEGER DEFAULT 0,
    team_blown_saves INTEGER DEFAULT 0,
    team_earned_runs INTEGER DEFAULT 0,
    team_hits_allowed INTEGER DEFAULT 0,
    team_walks_allowed INTEGER DEFAULT 0,
    team_strikeouts_pitched INTEGER DEFAULT 0,
    team_home_runs_allowed INTEGER DEFAULT 0,
    
    -- Calculated pitching ratios (while on this team)
    team_era DECIMAL(4,2) DEFAULT 0.00,
    team_whip DECIMAL(4,3) DEFAULT 0.000,
    team_k9 DECIMAL(4,2) DEFAULT 0.00, -- Ks per 9 innings
    team_bb9 DECIMAL(4,2) DEFAULT 0.00, -- Walks per 9 innings
quality starts INTEGER DEFAULT 0, (******* Quality starts (QS) are calculated as 6 or more IP AND 3 or fewer ER)
    
    -- Performance metrics
    fantasy_points_for_team DECIMAL(8,2) DEFAULT 0,
    games_started_for_team INTEGER DEFAULT 0,
    
    last_updated TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_player_team_stint UNIQUE(mlb_player_id, team_id, first_game_date)
);

-- =================================
-- ENHANCED DATA PIPELINE (NEW)
-- =================================

-- League-specific season stats (calculated from league game logs)
CREATE TABLE player_season_stats (
    stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    
    -- Calculated from this league's player_game_logs table
    games_played INTEGER DEFAULT 0,
    
    -- Hitting totals
    at_bats INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    doubles INTEGER DEFAULT 0,
    triples INTEGER DEFAULT 0,
    home_runs INTEGER DEFAULT 0,
    rbi INTEGER DEFAULT 0,
    runs INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    
    -- Calculated hitting ratios
    avg DECIMAL(4,3) DEFAULT 0.000,
    obp DECIMAL(4,3) DEFAULT 0.000,
    slg DECIMAL(4,3) DEFAULT 0.000,
    ops DECIMAL(4,3) DEFAULT 0.000,
    
    -- Pitching totals
    innings_pitched DECIMAL(5,1) DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    earned_runs INTEGER DEFAULT 0,
    hits_allowed INTEGER DEFAULT 0,
    walks_allowed INTEGER DEFAULT 0,
    strikeouts_pitched INTEGER DEFAULT 0,
    
    -- Calculated pitching ratios
    era DECIMAL(4,2) DEFAULT 0.00,
    whip DECIMAL(4,3) DEFAULT 0.000,
    k9 DECIMAL(4,2) DEFAULT 0.00,
quality starts INTEGER DEFAULT 0, (******* Quality starts (QS) are calculated as 6 or more IP AND 3 or fewer ER)
    
    last_updated TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_player_season UNIQUE(player_id, season_year)
);
```

---

## 📁 **Complete File Structure**

### **Frontend: `frontend-react/`**
```
frontend-react/
├── src/
│   ├── services/                    # Core service layer
│   │   ├── colorService.js          # 🎨 dynastyTheme design system
│   │   ├── tableService.js          # DynastyTable reusable component
│   │   └── apiService.js            # All API calls (centralized)
│   ├── components/                  # Reusable React components
│   │   ├── AuthModal.js             # Login/signup modal
│   │   ├── ProtectedRoute.js        # Route authentication wrapper
│   │   ├── LoadingSpinner.js        # Loading states
│   │   └── ErrorBoundary.js         # Error handling
│   ├── pages/                       # Main page components
│   │   ├── LandingPage.js           # Public homepage
│   │   ├── CreateLeague.js          # League creation flow
│   │   ├── LeagueDashboard.js       # Main league interface (250 lines)
│   │   ├── PlayerProfile.js         # Individual player pages
│   │   ├── JoinLeague.js            # Invitation acceptance
│   │   └── league-dashboard/        # Modular dashboard components
│   │       ├── ComingSoon.js        # Placeholder component (15 lines)
│   │       ├── LeagueHome.js        # League overview (200 lines)
│   │       ├── LeagueStandings.js   # Rankings/points (80 lines)
│   │       ├── LeagueOwners.js      # Team/invitation management (400 lines)
│   │       ├── TeamHomeDashboard.js # Team analytics (600+ lines)
│   │       ├── FreeAgentSearch.js   # Browse available players (NEW)
│   │       └── MyRoster.js          # Roster management (NEW)
│   ├── styles/                     # Global CSS
│   │   ├── index.css               # Tailwind imports
│   │   └── App.css                 # Custom global styles
│   └── utils/                      # Helper functions
│       ├── formatters.js           # Date, currency, number formatting
│       ├── validators.js           # Form validation helpers
│       └── constants.js            # App-wide constants
├── public/                         # Static assets
│   ├── index.html                  # HTML template
│   ├── favicon.ico                 # Site icon
│   └── manifest.json               # PWA configuration
├── package.json                    # Dependencies & scripts
├── tailwind.config.js              # Tailwind CSS configuration
└── craco.config.js                 # Create React App overrides
```

### **Backend: `backend/`**
```
backend/
├── src/
│   ├── core/                       # Core infrastructure
│   │   ├── database.py             # AWS RDS Data API integration
│   │   ├── auth_utils.py           # JWT validation & user management
│   │   ├── config.py               # Environment configuration
│   │   └── email_service.py        # AWS SES email handling
│   ├── routers/                    # API endpoint organization
│   │   ├── auth.py                 # Authentication (signup, login, verify)
│   │   ├── account.py              # User profile management
│   │   ├── players.py              # Universal MLB player data
│   │   ├── analytics.py            # Advanced statistics & analytics
│   │   ├── utilities.py            # Health checks & debug endpoints
│   │   ├── invitations.py          # Public invitation endpoints
│   │   └── leagues/                # League-specific functionality
│   │       ├── __init__.py         # Router combination (200+ lines)
│   │       ├── lifecycle.py        # League creation/deletion (1000+ lines)
│   │       ├── management.py       # Basic league operations (settings, sync)
│   │       ├── owners.py           # Admin invitation functions (500+ lines)
│   │       ├── standings.py        # Rankings and scoring (174 lines)
│   │       ├── players.py          # League player management (1200+ lines)
│   │       └── transactions.py     # Free agency, trades, waivers (NEW)
│   ├── league_services/            # Business logic services
│   │   ├── player_sync.py          # MLB data synchronization
│   │   ├── attribution.py          # Team attribution calculations
│   │   └── scoring.py              # Fantasy scoring calculations
│   ├── lambda_handler.py           # FastAPI + Mangum integration
│   └── requirements.txt            # Python dependencies
├── template.yaml                   # AWS SAM infrastructure as code
├── samconfig.toml                  # SAM deployment configuration
└── events/                         # JSON test files for local testing
    ├── auth-test.json
    ├── league-create-test.json
    └── free-agents-test.json
```

---

## 🎨 **Design System Architecture**

### **Why a Unified Design System?**

**Problem**: Scattered styling leads to:
- Inconsistent colors and spacing across components
- Hardcoded CSS classes everywhere
- Difficult to maintain and update themes
- No single source of truth for design decisions

**Solution**: `dynastyTheme` centralizes all styling:
- All colors, spacing, and components defined once
- Components use theme functions, not hardcoded classes
- Easy to update entire app by changing theme
- Consistent professional appearance

### **dynastyTheme Structure**
```javascript
// src/services/colorService.js
export const dynastyTheme = {
  // Raw design tokens
  tokens: {
    colors: {
      primary: '#D4AF37',      // Gold
      secondary: '#8B4513',    // Saddle Brown  
      accent: '#228B22',       // Forest Green
      success: '#22C55E',      // Success green
      warning: '#F59E0B',      // Warning orange
      error: '#EF4444',        // Error red
      neutral: {
        50: '#F8FAFC',
        100: '#F1F5F9',
        200: '#E2E8F0',
        // ... complete neutral scale
        900: '#0F172A'
      }
    },
    spacing: {
      xs: '0.25rem',  // 4px
      sm: '0.5rem',   // 8px
      md: '1rem',     // 16px
      lg: '1.5rem',   // 24px
      xl: '2rem',     // 32px
      // ... complete spacing scale
    },
    typography: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['Fira Code', 'monospace']
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        // ... complete type scale
      }
    }
  },

  // Utility classes (built from tokens)
  classes: {
    text: {
      white: 'text-white',
      primary: 'text-yellow-400',
      secondary: 'text-amber-600',
      muted: 'text-gray-400',
      success: 'text-green-400',
      warning: 'text-orange-400',
      error: 'text-red-400'
    },
    bg: {
      primary: 'bg-yellow-400',
      secondary: 'bg-amber-600',
      dark: 'bg-gray-900',
      darker: 'bg-gray-950',
      card: 'bg-gray-800',
      success: 'bg-green-500',
      warning: 'bg-orange-500',
      error: 'bg-red-500'
    },
    border: {
      primary: 'border-yellow-400',
      secondary: 'border-amber-600',
      muted: 'border-gray-700',
      success: 'border-green-500',
      warning: 'border-orange-500',
      error: 'border-red-500'
    }
  },

  // Pre-built component styles
  components: {
    button: {
      primary: 'px-4 py-2 bg-yellow-400 text-black rounded font-medium hover:bg-yellow-300 transition-colors',
      secondary: 'px-4 py-2 bg-amber-600 text-white rounded font-medium hover:bg-amber-500 transition-colors',
      outline: 'px-4 py-2 border border-yellow-400 text-yellow-400 rounded font-medium hover:bg-yellow-400 hover:text-black transition-colors',
      ghost: 'px-4 py-2 text-yellow-400 rounded font-medium hover:bg-yellow-400/10 transition-colors',
      danger: 'px-4 py-2 bg-red-500 text-white rounded font-medium hover:bg-red-600 transition-colors'
    },
    card: {
      base: 'bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg',
      elevated: 'bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-xl',
      flat: 'bg-gray-800 border border-gray-700 rounded-lg p-4'
    },
    input: {
      base: 'w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-yellow-400 focus:outline-none',
      error: 'w-full px-3 py-2 bg-gray-700 border border-red-500 rounded text-white placeholder-gray-400 focus:border-red-400 focus:outline-none'
    },
    badge: {
      primary: 'px-2 py-1 text-xs bg-yellow-400 text-black rounded font-medium',
      secondary: 'px-2 py-1 text-xs bg-gray-600 text-white rounded font-medium',
      success: 'px-2 py-1 text-xs bg-green-500 text-white rounded font-medium',
      warning: 'px-2 py-1 text-xs bg-orange-500 text-white rounded font-medium',
      error: 'px-2 py-1 text-xs bg-red-500 text-white rounded font-medium'
    },
    section: {
      base: 'bg-gray-800 border border-gray-700 rounded-lg p-6',
      compact: 'bg-gray-800 border border-gray-700 rounded-lg p-4'
    }
  },

  // Dynamic component generation
  utils: {
    getComponent: (type, variant = 'primary', size = 'md') => {
      const base = dynastyTheme.components[type]?.[variant] || '';
      // Add size variations if needed
      return base;
    },
    
    combineClasses: (...classes) => {
      return classes.filter(Boolean).join(' ');
    }
  }
};
```

### **Usage Pattern (Critical)**
```javascript
// ✅ CORRECT - Every component follows this pattern:
import { dynastyTheme } from '../services/colorService';

function MyComponent() {
  return (
    <div className={dynastyTheme.components.card.base}>
      <h2 className={dynastyTheme.classes.text.primary}>Title</h2>
      <button className={dynastyTheme.utils.getComponent('button', 'primary')}>
        Click Me
      </button>
    </div>
  );
}

// ❌ NEVER DO THIS:
// Hard-coded colors, dynasty-specific CSS classes, inline styles
function BadComponent() {
  return (
    <div className="bg-gray-800 border-yellow-500" style={{color: '#D4AF37'}}>
      Bad styling
    </div>
  );
}
```

---

## 🌐 **Infrastructure & Deployment**

### **AWS Services Used**

1. **CloudFront CDN**: 
   - Distribution: `d20wx6xzxkf84y.cloudfront.net`
   - Serves React frontend from S3
   - Proxies `/api/*` requests to Lambda
   - **Benefit**: No CORS issues (same origin)

2. **API Gateway + Lambda**:
   - Function: `fantasy-baseball-api-FantasyBaseballApi-iie0vJFVmGWa`
   - Runtime: Python 3.12 with FastAPI + Mangum
   - **Architecture**: Serverless, auto-scaling

3. **Aurora PostgreSQL Serverless**:
   - Cluster: `fantasy-baseball`
   - **Access**: RDS Data API (no connection pooling needed)
   - **Scaling**: Automatic based on load

4. **Cognito + SES**:
   - **User Pool**: `us-east-1_OooV5u83w`
   - **Email**: SES verified sender
   - **Security**: JWT tokens in httpOnly cookies

### **Deployment Commands**

```bash
# Backend Deployment
cd ~/fantasy-baseball-central-clean/backend/
sam build && sam deploy --force-upload

# Frontend Deployment  
cd ~/fantasy-baseball-central-clean/frontend-react/
npm run build
aws s3 sync build/ s3://fantasy-baseball-frontend-strakajagr --delete
aws cloudfront create-invalidation --distribution-id E20B8XDXCIFHQ4 --paths "/*"

# View Lambda Logs (for debugging)
aws logs filter-log-events \
  --log-group-name "/aws/lambda/fantasy-baseball-api-FantasyBaseballApi-iie0vJFVmGWa" \
  --start-time $(date -d '5 minutes ago' +s)000
```

---

## 🧪 **Testing Strategy & JSON Test Cases**

### **Testing Philosophy**

1. **JSON-First Testing**: Use AWS Lambda event JSON for local testing
2. **Integration Focus**: Test complete workflows, not just individual functions
3. **Real Data**: Use actual league IDs and player data when possible
4. **Performance**: Track response times and database query counts

### **Current Test Setup**
```bash
# Local Lambda testing with SAM
sam local invoke FantasyBaseballApi -e event.json

# Test structure
cd ~/fantasy-baseball-central-clean/backend/events/
# Replace event.json content with test case
# Run: sam local invoke FantasyBaseballApi -e event.json
```

### **Complete Test Cases**

#### **Test 1: League Settings (management.py)**
```json
{
  "body": "",
  "resource": "/{proxy+}",
  "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/settings",
  "httpMethod": "GET",
  "isBase64Encoded": false,
  "queryStringParameters": null,
  "pathParameters": {
    "proxy": "api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/settings"
  },
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer YOUR_FRESH_TOKEN_HERE",
    "Content-Type": "application/json",
    "Host": "localhost:3000"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "123456", 
    "stage": "test",
    "requestId": "test-settings-request",
    "identity": {
      "sourceIp": "127.0.0.1"
    },
    "httpMethod": "GET",
    "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/settings"
  }
}
```
**Expected Response**: 
```json
{
  "statusCode": 200,
  "body": "{\"success\": true, \"ui_features\": {\"use_salaries\": true, \"use_contracts\": false, \"show_advanced_stats\": true}}"
}
```

#### **Test 2: Data Sync (management.py)**
```json
{
  "body": "",
  "resource": "/{proxy+}",
  "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/sync-data",
  "httpMethod": "POST",
  "isBase64Encoded": false,
  "queryStringParameters": null,
  "pathParameters": {
    "proxy": "api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/sync-data"
  },
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer YOUR_FRESH_TOKEN_HERE",
    "Content-Type": "application/json",
    "Host": "localhost:3000"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "123456", 
    "stage": "test",
    "requestId": "test-sync-request",
    "identity": {
      "sourceIp": "127.0.0.1"
    },
    "httpMethod": "POST",
    "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/sync-data"
  }
}
```
**Expected Response**: 
```json
{
  "statusCode": 200,
  "body": "{\"success\": true, \"sync_results\": {\"game_logs_synced\": 1500, \"season_stats_calculated\": 800, \"errors\": []}}"
}
```

#### **Test 3: Free Agents Browse (transactions.py)**
```json
{
  "body": "",
  "resource": "/{proxy+}",
  "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/free-agents",
  "httpMethod": "GET",
  "isBase64Encoded": false,
  "queryStringParameters": {
    "limit": "10",
    "position": "OF",
    "search": "Trout"
  },
  "pathParameters": {
    "proxy": "api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/free-agents"
  },
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer YOUR_FRESH_TOKEN_HERE",
    "Content-Type": "application/json",
    "Host": "localhost:3000"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "123456", 
    "stage": "test",
    "requestId": "test-free-agents-request",
    "identity": {
      "sourceIp": "127.0.0.1"
    },
    "httpMethod": "GET",
    "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/free-agents"
  }
}
```
**Expected Response**: 
```json
{
  "statusCode": 200,
  "body": "{\"success\": true, \"players\": [{\"first_name\": \"Mike\", \"last_name\": \"Trout\", \"position\": \"OF\", \"batting_avg\": 0.285, \"home_runs\": 25}], \"total\": 1, \"page\": 1}"
}
```

#### **Test 4: Add Player (transactions.py)**
```json
{
  "body": "{\"mlb_player_id\": 545361, \"salary\": 1000000, \"contract_years\": 1}",
  "resource": "/{proxy+}",
  "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/add-player",
  "httpMethod": "POST",
  "isBase64Encoded": false,
  "queryStringParameters": null,
  "pathParameters": {
    "proxy": "api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/add-player"
  },
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer YOUR_FRESH_TOKEN_HERE",
    "Content-Type": "application/json",
    "Host": "localhost:3000"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "123456", 
    "stage": "test",
    "requestId": "test-add-player-request",
    "identity": {
      "sourceIp": "127.0.0.1"
    },
    "httpMethod": "POST",
    "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/add-player"
  }
}
```
**Expected Response**: 
```json
{
  "statusCode": 200,
  "body": "{\"success\": true, \"message\": \"Player added to team\", \"transaction_id\": \"abc-123-def\", \"player\": {\"first_name\": \"Mike\", \"last_name\": \"Trout\"}}"
}
```

#### **Test 5: My Roster (transactions.py)**
```json
{
  "body": "",
  "resource": "/{proxy+}",
  "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/my-roster",
  "httpMethod": "GET",
  "isBase64Encoded": false,
  "queryStringParameters": null,
  "pathParameters": {
    "proxy": "api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/my-roster"
  },
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer YOUR_FRESH_TOKEN_HERE",
    "Content-Type": "application/json",
    "Host": "localhost:3000"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "123456", 
    "stage": "test",
    "requestId": "test-roster-request",
    "identity": {
      "sourceIp": "127.0.0.1"
    },
    "httpMethod": "GET",
    "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/my-roster"
  }
}
```
**Expected Response**: 
```json
{
  "statusCode": 200,
  "body": "{\"success\": true, \"team\": {\"team_name\": \"My Team\", \"total_salary\": 25000000}, \"players\": [{\"first_name\": \"Mike\", \"last_name\": \"Trout\", \"salary\": 1000000}]}"
}
```

#### **Test 6: Drop Player (transactions.py)**
```json
{
  "body": "{\"league_player_id\": \"abc-123-def-456\"}",
  "resource": "/{proxy+}",
  "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/drop-player",
  "httpMethod": "POST",
  "isBase64Encoded": false,
  "queryStringParameters": null,
  "pathParameters": {
    "proxy": "api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/drop-player"
  },
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer YOUR_FRESH_TOKEN_HERE",
    "Content-Type": "application/json",
    "Host": "localhost:3000"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "123456", 
    "stage": "test",
    "requestId": "test-drop-player-request",
    "identity": {
      "sourceIp": "127.0.0.1"
    },
    "httpMethod": "POST",
    "path": "/api/leagues/66b8710e-fb9a-47ba-b434-e76508aced50/drop-player"
  }
}
```
**Expected Response**: 
```json
{
  "statusCode": 200,
  "body": "{\"success\": true, \"message\": \"Player dropped from team\", \"transaction_id\": \"def-456-ghi\", \"player\": {\"first_name\": \"Mike\", \"last_name\": \"Trout\"}}"
}
```

#### **Test 7: Create New League (lifecycle.py)**
```json
{
  "body": "{\"league_name\": \"Test Data Pipeline League\", \"use_salaries\": true, \"use_contracts\": false, \"use_waivers\": true, \"show_advanced_stats\": true, \"max_teams\": 12}",
  "resource": "/{proxy+}",
  "path": "/api/leagues/create",
  "httpMethod": "POST",
  "isBase64Encoded": false,
  "queryStringParameters": null,
  "pathParameters": {
    "proxy": "api/leagues/create"
  },
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer YOUR_FRESH_TOKEN_HERE",
    "Content-Type": "application/json",
    "Host": "localhost:3000"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "123456", 
    "stage": "test",
    "requestId": "test-create-league-request",
    "identity": {
      "sourceIp": "127.0.0.1"
    },
    "httpMethod": "POST",
    "path": "/api/leagues/create"
  }
}
```
**Expected Response**: 
```json
{
  "statusCode": 200,
  "body": "{\"success\": true, \"league_id\": \"new-league-id-here\", \"status\": \"processing\", \"optimization\": \"Fast phone book setup (5 seconds vs 5+ minutes)\", \"estimated_time_minutes\": \"0.5-1\"}"
}
```

---

## 🎯 **Testing Sequence & Priorities**

### **Phase 1: Core Infrastructure (Priority 1)**
1. **Settings Endpoint** (Test 1)
   - Verifies league database exists
   - Tests basic authentication
   - Validates management.py deployment

2. **Free Agents Browse** (Test 3)  
   - Tests database joins (main DB + league DB)
   - Validates player data quality
   - Confirms transactions.py deployment

### **Phase 2: CRUD Operations (Priority 2)**
3. **Data Sync** (Test 2)
   - Tests game log copying from main to league DB
   - Validates season stats calculations
   - Performance test (should handle 1000+ records)

4. **Add Player** (Test 4)
   - Tests roster management
   - Validates transaction logging
   - Confirms salary/contract handling

5. **My Roster** (Test 5)
   - Tests team ownership queries
   - Validates player stats display
   - Confirms UI data format

### **Phase 3: Complete Workflow (Priority 3)**
6. **Drop Player** (Test 6)
   - Tests complete add/drop cycle
   - Validates transaction history
   - Confirms free agency return

7. **Create New League** (Test 7) - Optional
   - Tests enhanced schema creation
   - Validates 18x performance improvement
   - Confirms data pipeline setup

---

## 🚀 **Current Status & Next Steps**

### **✅ Completed Systems**
- **Authentication**: Signup → verify → login (Cognito + SES)
- **League Creation**: Optimized 18x faster (30 seconds vs 9 minutes)
- **Invitation System**: Email-first pattern, reliable delivery
- **Owner Management**: Teams + invitations + empty slots
- **Team Attribution**: Database schema ready for analytics
- **Design System**: 100% unified styling via dynastyTheme


Daily Attribution Process:

Python

# Daily background job (06:00 AM)
1. Get yesterday's game logs from main MLB database
2. Check team ownership for each player on that date
3. Attribute daily performance to correct team
4. Update player_daily_team_stats table
5. Recalculate accumulated stats for affected players
6. Update player_team_accumulated_stats table
7. Update current year (2025) player stats to be stored in the MAIN DB and used in all table queries for 2025 stats (reduce the need for data duplication)
🆕 PostgreSQL Attribution Functions (Auto-Created):

SQL

-- Functions created in each league database
calculate_team_batting_avg(player_id, team_id) → DECIMAL(4,3)
calculate_team_era(player_id, team_id) → DECIMAL(4,2)  
calculate_team_whip(player_id, team_id) → DECIMAL(4,3)
Why This Architecture
✅ Benefits:

Data Consistency: Single source of truth for MLB data
Storage Efficiency: No duplication of MLB statistics (99% storage reduction)
Update Performance: Daily updates happen once, not 1000+ times
Scalability: Linear scaling (1000 leagues = 1000 small databases + 1 MLB database)
Cost Optimization: Dramatic reduction in storage and compute costs
Perfect Isolation: League configurations completely independent
✅ Player Attribution: Sophisticated tracking of player performance per team (OPERATIONAL)
✅ Two-Line Analytics: Season totals vs team-specific performance comparison (READY)

❌ Rejected Approach (Full Database Replication):
Main MLB DB → Copy to League DB #1 (full replica)
→ Copy to League DB #2 (full replica)

→ ... (1000+ full replicas)
This would result in 1000x storage costs and massive daily update operations.


### **🎯 Immediate Next Steps**

1. **Deploy Backend Transactions Module**
   ```bash
   cd ~/fantasy-baseball-central-clean/backend/
   # Ensure src/routers/leagues/transactions.py is complete
   sam build && sam deploy --force-upload
   ```

2. **Update JWT Token**
   - Login to frontend: `https://d20wx6xzxkf84y.cloudfront.net`
   - F12 → Application → Cookies → Copy `fantasy_auth_token`
   - Replace `YOUR_FRESH_TOKEN_HERE` in test cases

3. **Run Priority Tests**
   ```bash
   # Test 1: Settings
   # Copy Test 1 JSON to event.json, update token
   sam local invoke FantasyBaseballApi -e event.json
   
   # Test 3: Free Agents  
   # Copy Test 3 JSON to event.json
   sam local invoke FantasyBaseballApi -e event.json
   ```

4. **Verify Data Quality**
   - Free agents should show real stats (not "N/A")
   - Hundreds of players available
   - Realistic batting averages, ERAs, home runs

### **🔍 Debugging Guide**

**Common Issues & Solutions**:

1. **401 Unauthorized**: Token expired, get fresh token
2. **404 Not Found**: Backend not deployed, run `sam deploy`
3. **500 Internal Error**: Check Lambda logs:
   ```bash
   aws logs filter-log-events \
     --log-group-name "/aws/lambda/fantasy-baseball-api-FantasyBaseballApi-iie0vJFVmGWa" \
     --start-time $(date -d '5 minutes ago' +s)000
   ```
4. **Database Connection Issues**: Verify RDS Data API format:
   ```python
   # ✅ ALWAYS USE THIS FORMAT:
   value = response["records"][0][0]["stringValue"]
   
   # ❌ NEVER ASSUME THIS FORMAT:
   value = response[0]['column_name']
   ```

### **🎉 Success Metrics**

**Complete Success Criteria**:
- ✅ All 7 test cases return 200 status codes
- ✅ Free agents display real 2025 MLB stats
- ✅ Add/drop players works end-to-end
- ✅ Settings control UI display correctly
- ✅ Response times under 3 seconds
- ✅ No authentication or database errors

**This documentation represents everything needed to understand, maintain, and continue developing Dynasty Dugout from the ground up.**
