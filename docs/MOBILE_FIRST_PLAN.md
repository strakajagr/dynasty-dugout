# Dynasty Dugout - Mobile-First Architecture Plan
**CRITICAL UPDATE: Mobile & Multi-League Context**

## 🎯 New Priorities

### Priority 1: Mobile-First Design (Start NOW)
### Priority 2: Multi-League Player Context
### Priority 3: Native App Preparation

---

## Phase 0.5: Mobile Foundation (NEW - Week 1.5)

### Why This Matters
- Users manage teams on the go
- Draft day needs mobile support
- Native apps coming later
- One backend serves all clients

### What We're Building

**1. Responsive Frontend (3-4 days)**
- Mobile-first CSS/Tailwind
- Touch-friendly UI
- Responsive tables
- Mobile navigation

**2. API Design for Multiple Clients**
```
Web App → \
Mobile Web → → Same API → Backend
iOS App → /
Android App → /
```

**Key principle:** API returns data, clients handle presentation

### Implementation Strategy

**Backend stays the same** - Just returns JSON
**Frontend gets responsive** - Works on all screen sizes
**Future apps** - Use same API endpoints

---

## Updated Unified Player Object

### The Problem You Identified ✅

**Current unified endpoint is too simple:**
```json
{
  "mlb_data": {...},
  "league_context": {...}  // Only ONE league!
}
```

**Reality is complex:**
- User might be in 5 leagues
- Same player could be on different teams in different leagues
- Different status in each league (active/bench/DL)
- Different pricing in each league
- Need to know ALL leagues player is in

### The Solution: Context-Aware Player Object

**Structure:**
```json
{
  "player_id": 12345,
  "mlb_data": {
    "ids": {
      "mlb": 12345
    },
    "info": {
      "first_name": "Mike",
      "last_name": "Trout",
      "position": "OF",
      "mlb_team": "LAA"
    },
    "stats": {
      "season": {...},
      "rolling_14_day": {...},
      "career": {...}
    }
  },
  
  // NEW: League contexts - array because player can be in multiple leagues
  "league_contexts": [
    {
      "league_id": 101,
      "league_name": "Main Dynasty League",
      
      // Player's status in THIS league
      "status": "owned" | "available" | "other_team",
      
      // If owned by user or other team
      "team_assignment": {
        "team_id": 5,
        "team_name": "Yankees",
        "owner_id": "user123",
        "owner_name": "You" | "John Doe",
        "is_user_team": true
      },
      
      // Roster details (if rostered)
      "roster_details": {
        "roster_status": "active" | "bench" | "DL" | "minors",
        "roster_position": "OF",
        "league_player_id": 789
      },
      
      // Financial details
      "financial": {
        "contract_salary": 45.0,      // What they're paid (if on a team)
        "contract_years": 3,
        "market_price": 50.0,          // Open market value
        "salary_cap_hit": 45.0
      },
      
      // League-specific stats (accrued in this league)
      "accrued_stats": {
        "games_counted": 120,
        "stats": {...}
      }
    },
    
    // Could be in multiple leagues
    {
      "league_id": 102,
      "league_name": "Redraft League",
      "status": "available",
      "team_assignment": null,
      "financial": {
        "market_price": 35.0  // Different price in different league!
      }
    }
  ],
  
  // Summary of all leagues user is in
  "user_league_summary": {
    "total_leagues": 2,
    "owned_in": 1,
    "available_in": 1,
    "leagues": [
      {
        "league_id": 101,
        "league_name": "Main Dynasty",
        "quick_status": "owned"
      },
      {
        "league_id": 102, 
        "league_name": "Redraft",
        "quick_status": "available"
      }
    ]
  }
}
```

### API Endpoints

**1. Global Player Search (No League Context)**
```
GET /api/players/search?q=Trout

Returns: Basic MLB data only, no league info
Use: Main dashboard search bar
```

**2. Player in League Context**
```
GET /api/leagues/{league_id}/players/{player_id}/complete

Returns: MLB data + THIS league's context
Use: When user is inside a specific league
```

**3. Player Across All User's Leagues (NEW)**
```
GET /api/players/{player_id}/my-leagues

Returns: MLB data + array of ALL leagues user is in
Use: "Where is this player in my leagues?" feature
```

**4. Bulk Player Status (NEW)**
```
POST /api/players/bulk-league-status
Body: {
  "player_ids": [12345, 67890],
  "league_ids": [101, 102]  // Optional: all user's leagues if omitted
}

Returns: Status for multiple players across multiple leagues
Use: Efficient loading of roster/FA tables
```

---

## Mobile-First Design Principles

### 1. Responsive Breakpoints
```css
/* Mobile first */
.container {
  width: 100%;           /* Default: mobile */
}

/* Tablet */
@media (min-width: 768px) {
  .container { width: 750px; }
}

/* Desktop */
@media (min-width: 1024px) {
  .container { width: 1000px; }
}
```

### 2. Touch-Friendly UI
- **Minimum touch target:** 44px x 44px
- **Buttons:** Large, easy to tap
- **Tables:** Horizontal scroll on mobile
- **Dropdowns:** Native mobile dropdowns
- **Modals:** Full-screen on mobile

### 3. Mobile Navigation
```
Desktop: Horizontal nav bar
Mobile:  Hamburger menu
```

### 4. Performance
- **Lazy load images**
- **Infinite scroll for lists**
- **Minimize bundle size**
- **PWA capabilities** (works offline)

---

## Backend Architecture for Multi-Client Support

### Principles

**1. Client-Agnostic API**
- Return JSON, let clients format
- No HTML in responses
- No client-specific logic

**2. Consistent Response Format**
```json
{
  "success": true,
  "data": {...},
  "metadata": {
    "pagination": {...},
    "client_hints": {  // NEW: Optional hints for clients
      "recommended_view": "card" | "table" | "list",
      "mobile_optimized": true
    }
  }
}
```

**3. Efficient Data Loading**
- Support field selection: `?fields=id,name,stats`
- Pagination for large lists
- Bulk endpoints for multiple items
- Compressed responses

### Example: Roster Endpoint

**Before (inefficient for mobile):**
```
GET /api/leagues/123/roster
Returns: Everything (150KB)
```

**After (mobile-optimized):**
```
GET /api/leagues/123/roster?view=mobile&fields=id,name,position,status
Returns: Just what mobile needs (20KB)
```

---

## Updated Phase 1: Quick Wins + Mobile (Week 2)

### 1.1: Error Handlers (same as before)
### 1.2: Response Models (same as before)
### 1.3: Error Boundary (same as before)

### 1.4: Mobile-Responsive Base (NEW - 2 days)

**Create: `frontend-react/src/styles/responsive.css`**
```css
/* Mobile-first responsive utilities */
```

**Update: All existing components for mobile**
- Dashboard → Responsive cards
- Player tables → Horizontal scroll
- Navigation → Hamburger menu
- Forms → Touch-friendly inputs

**Testing:**
```bash
# Desktop
npm start

# Mobile (Chrome DevTools)
F12 → Toggle device toolbar → Test iPhone/Android
```

### 1.5: useAsync Hook (same as before)

---

## Phase 2: Multi-League Context + API Standardization

### 2.1: Enhanced Player Object (NEW - 1 week)

**Create:**
- `backend/src/routers/players/multi_league.py`
- `backend/src/models/player_context.py`

**Endpoints:**
1. `/api/players/{id}/my-leagues` - All leagues
2. `/api/players/bulk-league-status` - Bulk queries
3. Updated `/api/leagues/{id}/players/{id}/complete`

**Frontend Updates:**
- PlayerProfileModal shows all leagues
- "Where is this player?" feature
- Quick status badges

### 2.2: Response Format (same as before)
### 2.3: Unified Endpoint (updated with multi-league)

---

## Phase 3: Native App Preparation (Week 5)

### 3.1: API Versioning
```
/api/v1/players/...  (current)
/api/v2/players/...  (future breaking changes)
```

### 3.2: Authentication for Apps
- OAuth tokens
- Refresh tokens
- Secure storage

### 3.3: Mobile-Specific Endpoints
```
GET /api/mobile/dashboard  (optimized payload)
GET /api/mobile/quick-actions  (common actions)
```

### 3.4: Push Notifications Setup (Backend)
- Trade notifications
- Waiver wire alerts
- Player news

---

## Phase 4: React Native Apps (Weeks 6-10)

### Option A: React Native (Recommended)
**Pros:**
- Share code with web
- One codebase for iOS + Android
- Same React knowledge

**Cons:**
- Learning curve
- Some platform-specific code needed

### Option B: Progressive Web App (PWA)
**Pros:**
- No app store approval
- Works everywhere
- Easier to update

**Cons:**
- Not quite "native"
- Some features limited

### Recommended Path:
1. **Phase 4A:** Make web app a PWA (2 weeks)
2. **Phase 4B:** Build React Native apps (8-10 weeks)

---

## Critical Mobile Features

### Must-Haves:
- [ ] Responsive on all screen sizes
- [ ] Touch-friendly buttons/inputs
- [ ] Mobile-optimized tables (horizontal scroll)
- [ ] Fast load times (<3 seconds)
- [ ] Works on slow connections

### Nice-to-Haves:
- [ ] Offline mode (PWA)
- [ ] Push notifications
- [ ] Biometric login
- [ ] Drag-and-drop roster moves (mobile)

---

## Updated Timeline

| Week | Focus |
|------|-------|
| 1 | ✅ Prep (Done - tests passing!) |
| 2 | Quick Wins + Mobile Base |
| 3-4 | Multi-League API + Mobile Polish |
| 5 | Frontend Cleanup + PWA |
| 6-8 | Performance + Testing |
| 9-10 | React Native Apps (Optional) |

---

## Testing Strategy

### Desktop Testing:
```bash
npm start
# Test in Chrome, Firefox, Safari
```

### Mobile Testing:
```bash
# Chrome DevTools
F12 → Device Toolbar → Test all devices

# Real devices
# Deploy to test URL, test on actual phones
```

### Cross-Client Testing:
- Web (desktop)
- Web (mobile browser)
- iOS (Safari)
- Android (Chrome)
- Future: Native apps

---

## Questions to Decide Now

1. **PWA first or React Native first?**
   - Recommendation: PWA first (faster, easier)

2. **Tailwind or custom CSS?**
   - Recommendation: Tailwind (mobile-first built-in)

3. **Table vs Card view on mobile?**
   - Recommendation: Cards for mobile, tables for desktop

4. **Hamburger menu or bottom nav?**
   - Recommendation: Bottom nav (easier to reach)

---

## Implementation Priority

**This Week:**
1. ✅ Read this plan
2. ✅ Tests passing
3. Plan mobile design (sketch screens)

**Next Week:**
1. Phase 1 error handling
2. Make one page mobile-responsive (proof of concept)
3. Test on real phone

**Week After:**
1. Finish Phase 1
2. All pages mobile-responsive
3. Multi-league API endpoints

---

## You're Absolutely Right

Mobile-first is CRITICAL. This updated plan:
- ✅ Starts mobile design NOW
- ✅ Handles multi-league complexity
- ✅ Prepares for native apps
- ✅ Keeps backend flexible

**Ready to discuss or need clarification on any part?**
