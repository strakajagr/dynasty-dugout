# Dynasty Dugout - Refactoring Plan
**Version:** 1.0
**Timeline:** 6-8 weeks (part-time)

## Overview

This plan refactors your 60K-line codebase incrementally and safely, focusing on:
1. Reducing bugs through standardization
2. Making code more maintainable  
3. Never breaking existing functionality

## Phase 1: Quick Wins (Week 2) ⭐ START HERE

### 1.1: Standardize Error Responses (2-3 hours)
**Goal:** Consistent error handling across all endpoints

**Create:** `backend/src/core/error_handlers.py`
- Custom exception classes
- Centralized error formatting
- Automatic error handling

**Implementation:**
1. Create the error_handlers.py file (I'll provide code when needed)
2. Register with FastAPI app
3. Migrate one router at a time
4. Test after each migration

### 1.2: Add Response Models (3-4 hours)
**Goal:** Type safety and auto-documentation

**Create:** `backend/src/models/responses.py`
- Pydantic response models
- Standardized response format
- Backwards compatible structure

### 1.3: Add Error Boundary (30 min)
**Goal:** Catch React errors before they crash the app

**Create:** `frontend-react/src/components/ErrorBoundary.js`
- Wraps entire app
- Shows user-friendly error page
- Logs errors for debugging

### 1.4: Standardize Loading States (2-3 hours)
**Goal:** Consistent async operations

**Create:** `frontend-react/src/hooks/useAsync.js`
- Custom hook for async state
- Eliminates duplicate loading logic
- Simplifies components

**Phase 1 Success Criteria:**
- [ ] All smoke tests pass
- [ ] Zero new bugs introduced
- [ ] Consistent error messages
- [ ] Foundation for future phases

## Phase 2: API Standardization (Weeks 3-4)

### 2.1: Standardize Response Format
**Goal:** All APIs return same structure

**Current Problem:**
```javascript
// Different formats everywhere
{success: true, players: [...]}
{success: true, data: {...}}
{success: true, settings: {...}}
```

**Solution:** One standard format (with backwards compatibility)
```javascript
{
  success: true,
  data: {...},           // New standard
  players: [...],        // Keep old fields during migration
  metadata: {...}        // Optional pagination/context
}
```

### 2.2: Fix Player ID Confusion
**Goal:** Clear, consistent ID naming

**Current Problem:**
- `player_id` - sometimes MLB ID, sometimes league ID
- `mlb_player_id` - sometimes present, sometimes not
- `league_player_id` - only for rostered players

**Solution:**
```javascript
{
  ids: {
    mlb: 12345,        // Always present for MLB player
    league: 789        // Only if rostered in this league
  },
  // Keep old fields for backwards compat
  player_id: 12345,
  mlb_player_id: 12345,
  league_player_id: 789
}
```

### 2.3: Create Unified Player Endpoint
**Goal:** Single API call instead of 3-4

**New Endpoint:**
```
GET /api/leagues/{league_id}/players/{player_id}/unified
```

**Returns everything:**
- MLB player data
- Season stats
- Rolling stats
- League context (available/owned/other team)
- Pricing info

**Replaces:**
- GET /api/players/{id}/complete
- GET /api/leagues/{id}/free-agents (to check availability)
- GET /api/leagues/{id}/my-roster (to check ownership)

## Phase 3: Frontend Cleanup (Week 5)

### 3.1: Implement React Query
**Benefits:**
- Automatic caching (no duplicate requests)
- Automatic refetching
- Built-in loading/error states
- 50-70% less code

**Migration Strategy:**
1. Install react-query
2. Set up QueryClient
3. Migrate one component at a time
4. Keep old code for 1 sprint

### 3.2: Simplify PlayerProfileModal
**Current:** 200+ lines, 6+ pieces of state, complex logic
**After:** 50-80 lines, simple data fetching

### 3.3: Standardize Component Naming
Fix inconsistencies like:
- `PlayerSearchDropdownLeague.js` → `LeaguePlayerSearchDropdown.js`

## Phase 4: Performance (Weeks 6-8)

### 4.1: Add Database Indexes
- Analyze slow queries
- Add indexes strategically
- Monitor performance

### 4.2: Add Response Caching
- Cache expensive queries
- Set appropriate TTLs
- Add cache invalidation

### 4.3: Split Lambda Functions (Optional)
- Separate fast/slow operations
- Improve cold start times
- Optimize costs

## Implementation Guidelines

### Before ANY Change:
1. Run smoke tests: `python3 tests/smoke_tests.py`
2. Document baseline
3. Create git branch

### After EVERY Change:
1. Run smoke tests again
2. Check CloudWatch logs
3. Test critical user paths
4. Commit if tests pass

### If Something Breaks:
1. Check logs
2. Run smoke tests
3. Rollback: `git revert HEAD && sam deploy`
4. Document issue
5. Fix and try again

## File Locations

All implementation code will be in:
- `backend/src/core/` - Core utilities
- `backend/src/models/` - Data models
- `backend/src/routers/` - API endpoints
- `frontend-react/src/components/` - React components
- `frontend-react/src/hooks/` - Custom hooks

## Next Steps

1. ✅ Read this plan
2. ✅ Run smoke tests (already passing!)
3. Read PHASE_1_IMPLEMENTATION_GUIDE.md
4. Create branch: `git checkout -b refactor/phase-1`
5. Start Phase 1.1 (Error Handlers)

**Need help? I'll provide all the code when you're ready to implement!**
