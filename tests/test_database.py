"""
Unit Tests for Database Models and Engine
"""

import pytest
from backend.database.database import init_db, SessionLocal, engine
from backend.database.models import TrainingRun, TrainingMetric, EvaluationRun

def test_database_init_and_crud():
    init_db()
    db = SessionLocal()
    
    # Create run
    run = TrainingRun(
        total_timesteps=5000,
        learning_rate=0.0003,
        scenario="clear_road",
        status="completed",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    assert run.id is not None
    assert run.scenario == "clear_road"

    # Add metric
    metric = TrainingMetric(
        run_id=run.id,
        step=500,
        episode=2,
        reward=12.5,
        mean_reward=10.2,
        collision_rate=0.0,
        episode_length=250,
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)
    assert metric.id is not None
    assert metric.run_id == run.id

    db.close()
