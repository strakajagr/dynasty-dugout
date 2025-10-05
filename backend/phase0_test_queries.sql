---

# 📄 phase0_test_queries.sql
```sql
-- ============================================================================
-- PHASE 0: TEST QUERIES FOR LEAGUE TYPE SCHEMA
-- ============================================================================
-- These queries test the league type functionality without modifying existing data
-- Run these in order to verify the schema is ready for league type support
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: VERIFY CURRENT SCHEMA
-- ----------------------------------------------------------------------------

-- TEST 1.1: Check if user_leagues.settings column exists (postgres database)
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_leagues' 
  AND column_name = 'settings';

-- Expected: settings | jsonb | YES


-- TEST 1.2: Check if leagues.league_settings column exists (leagues database)
-- NOTE: Switch to 'leagues' database for this query
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'leagues' 
  AND column_name = 'league_settings';

-- Expected: league_settings | jsonb | YES


-- ----------------------------------------------------------------------------
-- SECTION 2: TEST CREATING A DYNASTY LEAGUE
-- ----------------------------------------------------------------------------

-- TEST 2.1: Create a test dynasty league in user_leagues (postgres database)
INSERT INTO user_leagues (
  league_id, 
  league_name, 
  database_name, 
  settings,
  commissioner_user_id,
  max_teams,
  created_at
) VALUES (
  'a1111111-1111-1111-1111-111111111111'::uuid,
  'TEST Dynasty League',
  'leagues',
  '{"league_type": "dynasty"}'::jsonb,
  'test_user_123',
  12,
  NOW()
);


-- TEST 2.2: Create corresponding league in leagues table (leagues database)
-- NOTE: Switch to 'leagues' database for this query
INSERT INTO leagues (
  league_id,
  league_name,
  league_settings,
  league_status,
  is_active,
  created_at
) VALUES (
  'a1111111-1111-1111-1111-111111111111'::uuid,
  'TEST Dynasty League',
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
  }'::jsonb,
  'active',
  true,
  NOW()
);


-- ----------------------------------------------------------------------------
-- SECTION 3: TEST CREATING A REDRAFT LEAGUE
-- ----------------------------------------------------------------------------

-- TEST 3.1: Create a test redraft league in user_leagues (postgres database)
INSERT INTO user_leagues (
  league_id, 
  league_name, 
  database_name, 
  settings,
  commissioner_user_id,
  max_teams,
  created_at
) VALUES (
  'b2222222-2222-2222-2222-222222222222'::uuid,
  'TEST Redraft League',
  'leagues',
  '{"league_type": "redraft"}'::jsonb,
  'test_user_123',
  12,
  NOW()
);


-- TEST 3.2: Create corresponding league in leagues table (leagues database)
-- NOTE: Switch to 'leagues' database for this query
INSERT INTO leagues (
  league_id,
  league_name,
  league_settings,
  league_status,
  is_active,
  created_at
) VALUES (
  'b2222222-2222-2222-2222-222222222222'::uuid,
  'TEST Redraft League',
  '{
    "num_keepers": 0,
    "draft_rounds": 23,
    "redraft_initial_draft_type": "snake",
    "lottery_enabled": false
  }'::jsonb,
  'active',
  true,
  NOW()
);


-- ----------------------------------------------------------------------------
-- SECTION 4: QUERY LEAGUE TYPE FROM user_leagues
-- ----------------------------------------------------------------------------

-- TEST 4.1: Get all test leagues (postgres database)
SELECT 
  league_id,
  league_name,
  settings->>'league_type' as league_type,
  settings
FROM user_leagues
WHERE league_name LIKE 'TEST%'
ORDER BY league_name;

-- Expected: 2 rows (dynasty and redraft)


-- TEST 4.2: Filter by league type (postgres database)
SELECT 
  league_id,
  league_name,
  settings->>'league_type' as league_type
FROM user_leagues
WHERE settings->>'league_type' = 'dynasty'
  AND league_name LIKE 'TEST%';

-- Expected: 1 row (TEST Dynasty League)


-- TEST 4.3: Count leagues by type (postgres database)
SELECT 
  settings->>'league_type' as league_type,
  COUNT(*) as count
FROM user_leagues
WHERE league_name LIKE 'TEST%'
GROUP BY settings->>'league_type';

-- Expected: dynasty: 1, redraft: 1


-- ----------------------------------------------------------------------------
-- SECTION 5: QUERY DYNASTY SETTINGS FROM leagues table
-- ----------------------------------------------------------------------------

-- TEST 5.1: Get all dynasty settings (leagues database)
-- NOTE: Switch to 'leagues' database for this query
SELECT 
  l.league_id,
  l.league_name,
  l.league_settings->>'num_keepers' as num_keepers,
  l.league_settings->>'draft_rounds' as draft_rounds,
  l.league_settings->>'dynasty_subsequent_draft_type' as subsequent_draft_type,
  l.league_settings->>'lottery_enabled' as lottery_enabled,
  l.league_settings
FROM leagues l
WHERE l.league_name LIKE 'TEST%'
ORDER BY l.league_name;

-- Expected: 2 rows with different settings


-- TEST 5.2: Get only dynasty leagues with lottery enabled (leagues database)
-- NOTE: Switch to 'leagues' database for this query
SELECT 
  l.league_id,
  l.league_name,
  (l.league_settings->>'lottery_enabled')::boolean as lottery_enabled,
  l.league_settings->>'lottery_top_excluded' as top_excluded
FROM leagues l
WHERE l.league_name LIKE 'TEST%'
  AND (l.league_settings->>'lottery_enabled')::boolean = true;

-- Expected: 1 row (TEST Dynasty League)


-- TEST 5.3: Get num_keepers as integer (leagues database)
-- NOTE: Switch to 'leagues' database for this query
SELECT 
  l.league_id,
  l.league_name,
  (l.league_settings->>'num_keepers')::integer as num_keepers_int
FROM leagues l
WHERE l.league_name LIKE 'TEST%'
ORDER BY num_keepers_int DESC;

-- Expected: 2 rows (15 for dynasty, 0 for redraft)


-- ----------------------------------------------------------------------------
-- SECTION 6: JOIN user_leagues + leagues FOR COMPLETE VIEW
-- ----------------------------------------------------------------------------

-- TEST 6.1: Get complete league data (requires cross-database query or app logic)
-- This query shows what data you need from BOTH databases:

-- From postgres database:
SELECT 
  ul.league_id,
  ul.league_name,
  ul.settings->>'league_type' as league_type,
  ul.commissioner_user_id,
  ul.max_teams
FROM user_leagues ul
WHERE ul.league_name LIKE 'TEST%';

-- Then use league_id to query leagues database:
-- Switch to 'leagues' database
SELECT 
  l.league_id,
  l.league_settings
FROM leagues l
WHERE l.league_id IN (
  'a1111111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222'
);


-- ----------------------------------------------------------------------------
-- SECTION 7: UPDATE OPERATIONS
-- ----------------------------------------------------------------------------

-- TEST 7.1: Update league_type in user_leagues (postgres database)
UPDATE user_leagues
SET settings = jsonb_set(
  settings,
  '{league_type}',
  '"dynasty"'::jsonb
)
WHERE league_id = 'b2222222-2222-2222-2222-222222222222';

-- Verify update:
SELECT league_name, settings->>'league_type' as league_type
FROM user_leagues
WHERE league_id = 'b2222222-2222-2222-2222-222222222222';


-- TEST 7.2: Update num_keepers in leagues table (leagues database)
-- NOTE: Switch to 'leagues' database
UPDATE leagues
SET league_settings = jsonb_set(
  league_settings,
  '{num_keepers}',
  '20'::jsonb
)
WHERE league_id = 'a1111111-1111-1111-1111-111111111111';

-- Verify update:
SELECT league_name, league_settings->>'num_keepers' as num_keepers
FROM leagues
WHERE league_id = 'a1111111-1111-1111-1111-111111111111';


-- TEST 7.3: Add new setting to existing JSONB (leagues database)
-- NOTE: Switch to 'leagues' database
UPDATE leagues
SET league_settings = league_settings || 
  '{"new_setting": "test_value"}'::jsonb
WHERE league_id = 'a1111111-1111-1111-1111-111111111111';

-- Verify update:
SELECT league_settings->>'new_setting' as new_setting
FROM leagues
WHERE league_id = 'a1111111-1111-1111-1111-111111111111';


-- ----------------------------------------------------------------------------
-- SECTION 8: VALIDATION QUERIES
-- ----------------------------------------------------------------------------

-- TEST 8.1: Check for NULL or missing league_type (postgres database)
SELECT 
  league_id,
  league_name,
  settings->>'league_type' as league_type,
  CASE 
    WHEN settings->>'league_type' IS NULL THEN 'MISSING'
    WHEN settings->>'league_type' = '' THEN 'EMPTY'
    ELSE 'OK'
  END as validation_status
FROM user_leagues
WHERE league_name LIKE 'TEST%';


-- TEST 8.2: Validate num_keepers is within range (leagues database)
-- NOTE: Switch to 'leagues' database
SELECT 
  league_id,
  league_name,
  (league_settings->>'num_keepers')::integer as num_keepers,
  CASE 
    WHEN (league_settings->>'num_keepers')::integer < 0 THEN 'INVALID: Too Low'
    WHEN (league_settings->>'num_keepers')::integer > 40 THEN 'INVALID: Too High'
    ELSE 'VALID'
  END as validation_status
FROM leagues
WHERE league_name LIKE 'TEST%';


-- TEST 8.3: Check for required dynasty settings (leagues database)
-- NOTE: Switch to 'leagues' database
SELECT 
  league_id,
  league_name,
  CASE 
    WHEN league_settings ? 'num_keepers' THEN 'YES' 
    ELSE 'NO' 
  END as has_num_keepers,
  CASE 
    WHEN league_settings ? 'draft_rounds' THEN 'YES' 
    ELSE 'NO' 
  END as has_draft_rounds,
  CASE 
    WHEN league_settings ? 'dynasty_initial_draft_type' THEN 'YES' 
    ELSE 'NO' 
  END as has_initial_draft_type
FROM leagues
WHERE league_name LIKE 'TEST%';


-- ----------------------------------------------------------------------------
-- SECTION 9: CLEANUP TEST DATA
-- ----------------------------------------------------------------------------

-- TEST 9.1: Delete test leagues from user_leagues (postgres database)
-- UNCOMMENT TO RUN:
-- DELETE FROM user_leagues 
-- WHERE league_name LIKE 'TEST%';


-- TEST 9.2: Delete test leagues from leagues table (leagues database)
-- UNCOMMENT TO RUN:
-- NOTE: Switch to 'leagues' database
-- DELETE FROM leagues 
-- WHERE league_name LIKE 'TEST%';


-- ----------------------------------------------------------------------------
-- SECTION 10: SUMMARY REPORT
-- ----------------------------------------------------------------------------

-- TEST 10.1: Final verification (postgres database)
SELECT 
  COUNT(*) as total_test_leagues,
  COUNT(CASE WHEN settings->>'league_type' = 'dynasty' THEN 1 END) as dynasty_count,
  COUNT(CASE WHEN settings->>'league_type' = 'redraft' THEN 1 END) as redraft_count
FROM user_leagues
WHERE league_name LIKE 'TEST%';

-- Expected after tests (before cleanup):
-- total: 2, dynasty: 1, redraft: 1


-- ============================================================================
-- END OF TEST QUERIES
-- ============================================================================
-- 
-- NEXT STEPS:
-- 1. Run Section 1 queries to verify schema exists
-- 2. Run Section 2-3 to create test leagues
-- 3. Run Section 4-6 to verify queries work
-- 4. Run Section 7 to test updates
-- 5. Run Section 8 to validate data
-- 6. Run Section 9 to cleanup
-- 7. Move to Phase 1: Backend Models
-- ============================================================================