# Phase 1 Implementation Guide
**Quick Wins - Step by Step**

## Prerequisites

```bash
# 1. Create branch
git checkout -b refactor/phase-1-quick-wins

# 2. Run baseline tests
python3 tests/smoke_tests.py

# 3. Document results
python3 tests/smoke_tests.py > baseline_results.txt
```

## Task 1.1: Error Handlers (2-3 hours)

### What You're Building
Centralized error handling so all endpoints return consistent error messages.

### Steps

**1. When ready, ask me for the code and I'll provide:**
- `backend/src/core/error_handlers.py` (complete file)

**2. Register with FastAPI (add to `backend/src/fantasy_api.py`):**
```python
from core.error_handlers import setup_error_handlers

app = FastAPI(...)
setup_error_handlers(app)  # Add this line
```

**3. Test it works:**
```bash
cd backend
sam build
sam deploy
```

**4. Migrate ONE router to use new errors:**
Example - update `backend/src/routers/players.py`:

```python
# OLD:
raise HTTPException(status_code=404, detail="Player not found")

# NEW:
from core.error_handlers import ResourceNotFoundError
raise ResourceNotFoundError("Player", player_id)
```

**5. Test after each router:**
```bash
python3 tests/smoke_tests.py
```

## Task 1.2: Response Models (3-4 hours)

### What You're Building
Type-safe response models for automatic API documentation.

### Steps

**1. Ask me for the code:**
- `backend/src/models/responses.py` (complete file)

**2. Use in ONE endpoint:**
```python
from models.responses import PlayerSearchResponse

@router.get("/search", response_model=PlayerSearchResponse)
async def search_players(q: str):
    # ... your logic ...
    return PlayerSearchResponse(
        success=True,
        players=results,
        count=len(results)
    )
```

**3. Check auto-docs:**
Visit: `https://your-api.com/docs`

**4. Repeat for other endpoints**

## Task 1.3: Error Boundary (30 min)

### What You're Building
React component that catches errors before they crash the app.

### Steps

**1. Ask me for the code:**
- `frontend-react/src/components/ErrorBoundary.js`

**2. Wrap your app (in `frontend-react/src/App.js`):**
```javascript
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      {/* Your existing app code */}
    </ErrorBoundary>
  );
}
```

**3. Test it:**
- Temporarily throw an error in a component
- Verify error boundary shows error page
- Remove test error

## Task 1.4: useAsync Hook (2-3 hours)

### What You're Building
Custom hook that standardizes loading states.

### Steps

**1. Ask me for the code:**
- `frontend-react/src/hooks/useAsync.js`

**2. Use in ONE component:**

**Before:**
```javascript
const [loading, setLoading] = useState(false);
const [data, setData] = useState(null);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  fetch(url)
    .then(r => setData(r))
    .catch(e => setError(e))
    .finally(() => setLoading(false));
}, []);
```

**After:**
```javascript
import useAsync from '../hooks/useAsync';

const { data, loading, error } = useAsync(
  () => fetch(url).then(r => r.json()),
  true
);
```

**3. Test the component works**

**4. Repeat for 2-3 more components**

## Testing Checklist

After Phase 1:
- [ ] All smoke tests pass
- [ ] API docs at /docs work
- [ ] Error messages are consistent
- [ ] App doesn't crash on errors
- [ ] Loading spinners work correctly

## Deployment

```bash
# Backend
cd backend
sam build
sam deploy

# Frontend  
cd frontend-react
npm run build
aws s3 sync build/ s3://your-bucket/

# Test
python3 tests/smoke_tests.py
```

## Rollback If Needed

```bash
git revert HEAD
sam deploy  # or npm run build && aws s3 sync...
```

## When to Ask for Code

I have all the implementation code ready. Just ask:
- "Give me the error_handlers.py code"
- "Give me the responses.py code"
- "Give me the ErrorBoundary.js code"
- "Give me the useAsync.js code"

And I'll provide the complete, ready-to-use file!

## Success = Ready for Phase 2

Once Phase 1 is done:
- Review what worked well
- Document any issues
- Plan Phase 2 start date
