"""
FastAPI Main Application Entry Point
"""

from pathlib import Path
import sys

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database.database import init_db
from backend.api.routes import router

app = FastAPI(
    title="Autonomous Vehicle Tactical Driving Decision-Making Platform",
    description="Deep Reinforcement Learning (PPO) Tactical Decision Simulation & Analytics",
    version="1.0.0",
)

# Enable CORS for local and proxy web access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database schema
init_db()

# Register API routes
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
