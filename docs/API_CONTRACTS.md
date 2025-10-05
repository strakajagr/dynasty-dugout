# Dynasty Dugout API Contracts - Baseline
**Purpose:** Document current API behavior before refactoring

## Critical Endpoints

### Player Search
```
GET /api/players/search?q={query}&limit={limit}
```
**Response:**
```json
{
  "success": true,
  "players": [
    {
      "player_id": 12345,
      "first_name": "Mike",
      "last_name": "Trout",
      "position": "OF",
      "mlb_team": "LAA"
    }
  ],
  "count": 1
}
```

### Complete Player Data
```
GET /api/players/{player_id}/complete
```
**Returns:** MLB data, season stats, rolling stats

### League Free Agents
```
GET /api/leagues/{league_id}/free-agents-enhanced
```
**Returns:** Available players with pricing

### My Roster
```
GET /api/leagues/{league_id}/my-roster-enhanced
```
**Returns:** User's rostered players with stats

### Add Player
```
POST /api/leagues/{league_id}/add-player
Body: {
  "league_player_id": 123,
  "salary": 45.0,
  "contract_years": 3
}
```

## Field Name Issues (To Fix in Phase 2)

**Player IDs are confusing:**
- `player_id` - sometimes MLB ID, sometimes not
- `mlb_player_id` - inconsistent presence
- `league_player_id` - only for rostered players

**Frontend must check multiple field names:**
```javascript
String(p.mlb_player_id) === String(playerId) ||
String(p.player_id) === String(playerId)
```

## Testing Commands

```bash
# Health check
curl https://your-api.com/api/health

# Player search
curl "https://your-api.com/api/players/search?q=Trout"

# Run all tests
python3 tests/smoke_tests.py
```

## Critical: Don't Break These

During refactoring, these must keep working:
- User can search for players
- User can view player profile
- User can add/drop players
- Commissioner actions work
- Free agent list loads
- Roster loads with stats

**Run smoke tests before and after every change!**
