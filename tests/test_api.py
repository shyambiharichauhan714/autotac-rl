"""
Unit Tests for FastAPI Endpoints
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"

def test_model_info():
    res = client.get("/api/model/info")
    assert res.status_code == 200
    data = res.json()
    assert data["state_dim"] == 12
    assert data["action_dim"] == 6

def test_scenarios():
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 5

def test_simulation_lifecycle():
    res_start = client.post("/api/simulation/start", json={"scenario": "clear_road", "agent_type": "rule_based"})
    assert res_start.status_code == 200
    state = res_start.json()
    assert "ego_x" in state
    assert "action_probabilities" in state

    res_step = client.post("/api/simulation/step", json={"manual_action": 1})
    assert res_step.status_code == 200
    state2 = res_step.json()
    assert state2["step"] >= 1
