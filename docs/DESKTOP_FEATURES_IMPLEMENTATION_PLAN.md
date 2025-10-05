# Dynasty Dugout - Desktop Features Implementation Plan

**Last Updated:** October 2, 2025  
**Status:** Ready to Build  
**Priority Order:** D → C → A → Message Board → B

---

## 🎯 Overview

This document details the implementation plan for the remaining desktop features before mobile PWA development begins. Each feature follows the pattern: **Backend → Desktop UI → (Future: Mobile UI)**

**Build Order:**
1. **D:** Watch List (simplest - warm-up)
2. **C:** Trades (core feature)
3. **A:** Messaging (communication)
4. **Message Board:** Desktop-only forum
5. **B:** Live Draft (most complex)

**Total Time:** 108 hours (14-27 days depending on daily commitment)

---

## 🚀 Feature D: Watch List

**Total Time:** 8 hours  
**Priority:** 1st - Simplest feature, good warm-up

### Backend (4 hours)

#### Step 1: Database Schema (1 hour)
```sql
-- Add to MAIN DATABASE (postgres)
-- Watch list is user-global, not league-specific

CREATE TABLE user_watchlist (
    watch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Cognito user ID
    player_id INTEGER NOT NULL REFERENCES mlb_players(player_id),
    added_at TIMESTAMP DEFAULT NOW(),
    notes TEXT, -- Optional user notes
    priority INTEGER DEFAULT 0, -- For sorting (0 = normal, higher = more important)
    CONSTRAINT unique_user_player UNIQUE(user_id, player_id)
);

CREATE INDEX idx_watchlist_user ON user_watchlist(user_id);
CREATE INDEX idx_watchlist_player ON user_watchlist(player_id);
```

#### Step 2: Create Watchlist Router (2 hours)
```python
# File: backend/src/routers/watchlist.py

from fastapi import APIRouter, HTTPException, Depends
from core.auth_utils import get_current_user
from core.database import execute_sql
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/add")
async def add_to_watchlist(
    player_id: int,
    notes: str = None,
    priority: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Add a player to user's watch list"""
    try:
        # Check if already watched
        check = execute_sql(
            """
            SELECT watch_id FROM user_watchlist 
            WHERE user_id = :user_id AND player_id = :player_id
            """,
            {
                "user_id": current_user["user_id"],
                "player_id": player_id
            }
        )
        
        if check.get('records'):
            return {
                "success": False,
                "message": "Player already on watch list"
            }
        
        # Get player info for confirmation
        player_info = execute_sql(
            """
            SELECT first_name, last_name, position, mlb_team
            FROM mlb_players WHERE player_id = :player_id
            """,
            {"player_id": player_id}
        )
        
        if not player_info.get('records'):
            raise HTTPException(status_code=404, detail="Player not found")
        
        player = player_info['records'][0]
        
        # Add to watchlist
        execute_sql(
            """
            INSERT INTO user_watchlist (user_id, player_id, notes, priority)
            VALUES (:user_id, :player_id, :notes, :priority)
            """,
            {
                "user_id": current_user["user_id"],
                "player_id": player_id,
                "notes": notes,
                "priority": priority
            }
        )
        
        logger.info(f"User {current_user['user_id']} added {player['first_name']} {player['last_name']} to watchlist")
        
        return {
            "success": True,
            "message": f"Added {player['first_name']} {player['last_name']} to watch list",
            "player": player
        }
        
    except Exception as e:
        logger.error(f"Error adding to watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/remove/{player_id}")
async def remove_from_watchlist(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove a player from user's watch list"""
    try:
        result = execute_sql(
            """
            DELETE FROM user_watchlist 
            WHERE user_id = :user_id AND player_id = :player_id
            RETURNING player_id
            """,
            {
                "user_id": current_user["user_id"],
                "player_id": player_id
            }
        )
        
        if not result.get('records'):
            raise HTTPException(status_code=404, detail="Player not on watch list")
        
        logger.info(f"User {current_user['user_id']} removed player {player_id} from watchlist")
        
        return {
            "success": True,
            "message": "Player removed from watch list"
        }
        
    except Exception as e:
        logger.error(f"Error removing from watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_watchlist(
    current_user: dict = Depends(get_current_user)
):
    """Get user's complete watch list with player details and stats"""
    try:
        result = execute_sql(
            """
            SELECT 
                w.watch_id,
                w.player_id,
                w.added_at,
                w.notes,
                w.priority,
                p.first_name,
                p.last_name,
                p.position,
                p.mlb_team,
                p.active,
                ps.avg,
                ps.home_runs,
                ps.rbi,
                ps.stolen_bases,
                ps.era,
                ps.wins,
                ps.saves,
                ps.strikeouts_pitched
            FROM user_watchlist w
            JOIN mlb_players p ON w.player_id = p.player_id
            LEFT JOIN player_stats ps ON p.player_id = ps.player_id 
                AND ps.season = EXTRACT(YEAR FROM CURRENT_DATE)
            WHERE w.user_id = :user_id
            ORDER BY w.priority DESC, w.added_at DESC
            """,
            {"user_id": current_user["user_id"]}
        )
        
        players = result.get('records', [])
        
        return {
            "success": True,
            "count": len(players),
            "players": players
        }
        
    except Exception as e:
        logger.error(f"Error fetching watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/player/{player_id}/status")
async def check_watchlist_status(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Check if a player is on user's watch list"""
    try:
        result = execute_sql(
            """
            SELECT watch_id FROM user_watchlist 
            WHERE user_id = :user_id AND player_id = :player_id
            """,
            {
                "user_id": current_user["user_id"],
                "player_id": player_id
            }
        )
        
        is_watched = len(result.get('records', [])) > 0
        
        return {
            "success": True,
            "is_watched": is_watched
        }
        
    except Exception as e:
        logger.error(f"Error checking watchlist status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### Step 3: Register Router in Main App (30 min)
```python
# File: backend/src/fantasy_api.py

# Add with other router imports
from routers import watchlist

# Register router
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["Watch List"])
logger.info("✅ Watch List router registered")
```

#### Step 4: Test Endpoints (30 min)
```bash
# Test adding player
curl -X POST "https://api.dynasty-dugout.com/api/watchlist/add" \
  -H "Content-Type: application/json" \
  -d '{"player_id": 660271, "notes": "Keep eye on hot streak"}'

# Test getting watchlist
curl "https://api.dynasty-dugout.com/api/watchlist"

# Test removing player
curl -X DELETE "https://api.dynasty-dugout.com/api/watchlist/remove/660271"

# Test player status
curl "https://api.dynasty-dugout.com/api/watchlist/player/660271/status"
```

---

### Desktop UI (4 hours)

[... rest of the Watch List desktop UI implementation ...]

---

### Testing Checklist

**Backend:**
- [ ] Watch list table created in main database
- [ ] Can add player to watch list
- [ ] Can remove player from watch list
- [ ] Can retrieve watch list with player details
- [ ] Can check if player is watched
- [ ] Duplicate additions are rejected
- [ ] Watch list persists across sessions

**Desktop UI:**
- [ ] Star button appears on player profile modal
- [ ] Star fills when player is watched
- [ ] Click star adds/removes from watch list
- [ ] Watch List page shows all watched players
- [ ] Can filter by hitters/pitchers
- [ ] Can remove players from watch list page
- [ ] Watch indicators appear on player cards
- [ ] Click player card opens profile modal
- [ ] Watch list updates immediately after changes

---

## 🎯 Next Feature: Trades (C)

After Watch List is complete and tested, proceed to **Feature C: Trades** implementation.

[Full Trades implementation continues in next sections...]

---

## 📝 Notes

- **Deploy after each feature:** Use your deploy script to test in production
- **Test thoroughly:** Each feature affects multiple parts of the app
- **Document as you go:** Update API contracts and architecture docs
- **Mobile follows:** Don't build mobile versions until desktop is complete

---

**Ready to start with Watch List (D)?** 🚀
