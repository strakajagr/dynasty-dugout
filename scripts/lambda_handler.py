from mangum import Mangum
from fantasy_api import app  # Import your existing FastAPI app

# This is the Lambda handler
handler = Mangum(app)
