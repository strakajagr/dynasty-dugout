
markdown# 🏟️ PHASE 0: LEAGUE TYPE SCHEMA DOCUMENTATION
**Date:** October 5, 2025  
**Status:** Planning Phase  
**Database Architecture:** Two-Tier (postgres + leagues)

---

## 🗄️ DATABASE ARCHITECTURE OVERVIEW

### **Tier 1: `postgres` database**
Central registry for all leagues. One row per league in `user_leagues` table.

**Key Column:**
- `settings` (JSONB) - High-level league metadata

### **Tier 2: `leagues` database**
League-specific data. Each league_id has rows across multiple tables.

**Key Table:** `leagues`
- `league_settings` (JSONB) - Game rules and configuration
- `roster_settings` (JSONB) - Roster composition rules
- `salary_settings` (JSONB) - Financial rules

**Key Table:** `league_settings` (key-value store)
- Fallback option: `setting_name`, `setting_value`, `setting_type`

---

## 📋 LEAGUE TYPE SETTINGS - WHERE THEY LIVE

### **1️⃣ `user_leagues.settings` (postgres database)**

**New Field:**
```json
{
  "league_type": "dynasty" | "redraft"
}
Why here?

Quick filtering: "Show me all my dynasty leagues"
Available without querying league-specific database
Used for UI routing and feature flags


2️⃣ leagues.league_settings (leagues database)
New Fields:
json{
  // Core Dynasty Settings
  "num_keepers": 15,                    // integer, 0 for redraft
  "draft_rounds": 23,                   // integer, 1-40
  
  // Draft Configuration - REDRAFT
  "redraft_initial_draft_type": "snake", // "snake" | "random_repeating" | "auction" | "commissioner"
  
  // Draft Configuration - DYNASTY
  "dynasty_initial_draft_type": "snake",           // Year 1 draft
  "dynasty_subsequent_draft_type": "standings_lottery", // Year 2+ draft
  
  // Lottery Settings (Dynasty only)
  "lottery_enabled": true,              // boolean
  "lottery_top_excluded": 3,            // integer, 0-10
  "lottery_weighting": "nba_style",     // string (only option for now)
  
  // Keeper Rules
  "keeper_deadline_date": "2025-03-01", // YYYY-MM-DD
  "keeper_positions_locked": false      // boolean
}
Why here?

Detailed game configuration
Only loaded when viewing specific league
Can be complex nested objects


🎯 DEFAULT VALUES
Dynasty League Defaults:
json// user_leagues.settings
{
  "league_type": "dynasty"
}

// leagues.league_settings
{
  "num_keepers": 15,
  "draft_rounds": 23,
  "dynasty_initial_draft_type": "snake",
  "dynasty_subsequent_draft_type": "standings_lottery",
  "lottery_enabled": true,
  "lottery_top_excluded": 3,
  "lottery_weighting": "nba_style",
  "keeper_deadline_date": "2025-03-01",
  "keeper_positions_locked": false
}
Redraft League Defaults:
json// user_leagues.settings
{
  "league_type": "redraft"
}

// leagues.league_settings
{
  "num_keepers": 0,
  "draft_rounds": 23,
  "redraft_initial_draft_type": "snake",
  "lottery_enabled": false
}

📝 SQL EXAMPLES
Creating a Dynasty League
Step 1: Insert into user_leagues (postgres database)
sqlINSERT INTO user_leagues (
  league_id, 
  league_name, 
  database_name, 
  settings,
  commissioner_user_id,
  max_teams
) VALUES (
  gen_random_uuid(),
  'My Dynasty League',
  'leagues',
  '{"league_type": "dynasty"}'::jsonb,
  'user_123',
  12
);
Step 2: Insert into leagues (leagues database)
sqlINSERT INTO leagues (
  league_id,
  league_name,
  league_settings
) VALUES (
  :league_id,  -- Same UUID from step 1
  'My Dynasty League',
  '{
    "num_keepers": 15,
    "draft_rounds": 23,
    "dynasty_initial_draft_type": "snake",
    "dynasty_subsequent_draft_type": "standings_lottery",
    "lottery_enabled": true,
    "lottery_top_excluded": 3,
    "lottery_weighting": "nba_style",
    "keeper_deadline_date": "2025-03-01",
    "keeper_positions_locked": false
  }'::jsonb
);

Creating a Redraft League
Step 1: Insert into user_leagues (postgres database)
sqlINSERT INTO user_leagues (
  league_id, 
  league_name, 
  database_name, 
  settings,
  commissioner_user_id,
  max_teams
) VALUES (
  gen_random_uuid(),
  'My Redraft League',
  'leagues',
  '{"league_type": "redraft"}'::jsonb,
  'user_123',
  12
);
Step 2: Insert into leagues (leagues database)
sqlINSERT INTO leagues (
  league_id,
  league_name,
  league_settings
) VALUES (
  :league_id,
  'My Redraft League',
  '{
    "num_keepers": 0,
    "draft_rounds": 23,
    "redraft_initial_draft_type": "snake",
    "lottery_enabled": false
  }'::jsonb
);

🔍 QUERYING LEAGUE TYPE
Get all dynasty leagues for a user:
sqlSELECT 
  league_id,
  league_name,
  settings->>'league_type' as league_type
FROM user_leagues
WHERE settings->>'league_type' = 'dynasty'
  AND commissioner_user_id = 'user_123';
Get complete league configuration:
sql-- Step 1: From postgres database
SELECT 
  ul.league_id,
  ul.league_name,
  ul.settings->>'league_type' as league_type
FROM user_leagues ul
WHERE ul.league_id = :league_id;

-- Step 2: From leagues database
SELECT 
  l.league_id,
  l.league_settings->>'num_keepers' as num_keepers,
  l.league_settings->>'draft_rounds' as draft_rounds,
  l.league_settings
FROM leagues l
WHERE l.league_id = :league_id;

🚨 VALIDATION RULES
league_type:

Required: YES
Allowed values: "dynasty" or "redraft"
Default: "dynasty"

num_keepers:

Required: YES
Min: 0 (redraft)
Max: roster_size - 1
Default: 15 (dynasty), 0 (redraft)

draft_rounds:

Required: YES
Min: 1
Max: 40
Default: 23

dynasty_subsequent_draft_type:

Required: Only for dynasty leagues
Allowed values: "basic_standings", "standings_lottery", "auction", "commissioner"
Default: "standings_lottery"

lottery_enabled:

Required: Only for dynasty leagues
Type: boolean
Default: true (if dynasty_subsequent_draft_type = "standings_lottery")

lottery_top_excluded:

Required: Only if lottery_enabled = true
Min: 0
Max: 10
Default: 3


🎓 USAGE PATTERNS
Backend (Python):
python# Read league type
league_type = league_data['settings'].get('league_type', 'dynasty')

# Read dynasty settings
num_keepers = league_settings.get('num_keepers', 15)
draft_rounds = league_settings.get('draft_rounds', 23)

# Conditional logic
if league_type == 'dynasty':
    subsequent_draft_type = league_settings.get('dynasty_subsequent_draft_type')
    if subsequent_draft_type == 'standings_lottery':
        lottery_enabled = league_settings.get('lottery_enabled', True)
Frontend (JavaScript/React):
javascript// From API response
const leagueType = league.settings.league_type;
const isRedraft = leagueType === 'redraft';

// Conditional rendering
{!isRedraft && (
  <DynastySettingsPanel 
    numKeepers={league.league_settings.num_keepers}
    draftRounds={league.league_settings.draft_rounds}
  />
)}

🔄 ALTERNATIVE: Key-Value Store
If JSONB queries become problematic, you can use the league_settings table:
sqlINSERT INTO league_settings (league_id, setting_name, setting_value, setting_type) VALUES
  (:league_id, 'num_keepers', '15', 'integer'),
  (:league_id, 'draft_rounds', '23', 'integer'),
  (:league_id, 'dynasty_initial_draft_type', 'snake', 'string'),
  (:league_id, 'lottery_enabled', 'true', 'boolean');
Pros:

Easier to add new settings
Standard SQL queries

Cons:

More verbose queries
More rows to maintain


✅ PHASE 0 COMPLETE WHEN:

✅ Documentation reviewed and approved
✅ Backend team understands JSONB structure
✅ Frontend team understands settings location
✅ Test queries validated
✅ Ready to move to Phase 1 (Backend Models)