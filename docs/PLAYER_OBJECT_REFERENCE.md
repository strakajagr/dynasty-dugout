# Player Object Architecture - Visual Reference

## Context-Aware Player Data

### Scenario: User "John" searches for Mike Trout

```
┌─────────────────────────────────────────────────────────────┐
│ User: John (logged in)                                      │
│ Leagues: Dynasty League (101), Redraft League (102)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SEARCH FROM: Main Dashboard (no league context)             │
│ QUERY: GET /api/players/search?q=Trout                     │
└─────────────────────────────────────────────────────────────┘

RETURNS:
{
  "player_id": 12345,
  "first_name": "Mike",
  "last_name": "Trout",
  "position": "OF",
  "mlb_team": "LAA",
  "stats": {...}
  // NO league data - just MLB info
}

┌─────────────────────────────────────────────────────────────┐
│ SEARCH FROM: Inside Dynasty League (101)                    │
│ QUERY: GET /api/leagues/101/players/12345/complete         │
└─────────────────────────────────────────────────────────────┘

RETURNS:
{
  "mlb_data": {...},
  "league_context": {
    "league_id": 101,
    "status": "owned",
    "team": {
      "team_id": 5,
      "team_name": "John's Yankees",
      "owner": "You"
    },
    "roster": {
      "status": "active",  // active | bench | DL | minors
      "position": "OF"
    },
    "financial": {
      "contract_salary": 45,    // What you're paying
      "contract_years": 3,
      "market_price": 50        // What he's worth
    }
  }
}

┌─────────────────────────────────────────────────────────────┐
│ SEARCH FROM: "Where is this player?" feature               │
│ QUERY: GET /api/players/12345/my-leagues                   │
└─────────────────────────────────────────────────────────────┘

RETURNS:
{
  "mlb_data": {...},
  "league_contexts": [
    {
      "league_id": 101,
      "league_name": "Dynasty League",
      "status": "owned",
      "team_name": "John's Yankees",
      "roster_status": "active",
      "contract_salary": 45
    },
    {
      "league_id": 102,
      "league_name": "Redraft League", 
      "status": "available",
      "market_price": 35
    }
  ]
}
```

## Key Distinctions

### Contract vs Market Price
```
Contract Salary:  What a team is PAYING for the player
                  (Only exists if player is rostered)

Market Price:     What the player is WORTH on open market
                  (Exists for all players in league)
                  
Example:
- You signed Trout 2 years ago for $45
- He's now worth $60 on open market
- Your contract: $45 (bargain!)
- Market price: $60 (his current value)
```

### Roster Status
```
active:  On active roster, accruing stats
bench:   On roster but not starting
DL:      Injured, on disabled list
minors:  In minor league system
```

### Player Status in League
```
owned:       On user's team
available:   Free agent (can be added)
other_team:  On another team (can't add, maybe trade)
```

## API Endpoint Decision Tree

```
User searches player
  │
  ├─ From main dashboard?
  │  └─> GET /api/players/search
  │     Returns: MLB data only
  │
  ├─ From inside a league?
  │  └─> GET /api/leagues/{id}/players/{id}/complete
  │     Returns: MLB data + THIS league context
  │
  └─ From "Where is this player?" feature?
     └─> GET /api/players/{id}/my-leagues
        Returns: MLB data + ALL leagues user is in
```

## Mobile Considerations

### Mobile Screen Example:

```
┌────────────────────────┐
│ Mike Trout        [×]  │ ← Large, easy to tap
│ OF | LAA | #27         │
├────────────────────────┤
│ 📊 Stats              │
│ .285 AVG | 35 HR      │
├────────────────────────┤
│ 🏆 Your Leagues       │ ← NEW: League summary
│                        │
│ Dynasty League  ✓ Own  │ ← Quick status
│ Active | $45 | 3 yrs  │
│                        │
│ Redraft League  💰 FA  │
│ Price: $35            │
├────────────────────────┤
│ [Add to Team] [Trade] │ ← Touch-friendly
└────────────────────────┘
```

### Data Loading Strategy:

**Initial load (fast):**
- Player name, position, team
- Current stats
- League summary (just status)

**Lazy load (when user scrolls):**
- Full stats history
- Game logs
- Transaction history

**Bulk operations (efficient):**
```
Instead of:
  - GET /api/leagues/101/players/1/complete
  - GET /api/leagues/101/players/2/complete
  - GET /api/leagues/101/players/3/complete
  (3 requests, slow on mobile)

Use:
  - POST /api/players/bulk-league-status
    Body: {"player_ids": [1,2,3], "league_id": 101}
  (1 request, fast!)
```

## Implementation Checklist

Phase 1:
- [ ] Global player search (MLB data only)
- [ ] League player endpoint (one league context)
- [ ] Mobile-responsive player card

Phase 2:
- [ ] Multi-league player endpoint
- [ ] Bulk status endpoint
- [ ] "Where is this player?" feature

Phase 3:
- [ ] Optimize for mobile performance
- [ ] Add infinite scroll
- [ ] Implement PWA caching

## Questions?

- Contract vs price distinction clear?
- Multi-league structure makes sense?
- Mobile-first approach good?
- API endpoints cover all use cases?
