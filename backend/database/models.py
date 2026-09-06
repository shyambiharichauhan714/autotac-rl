"""
SQLAlchemy ORM Models for AV Tactical Driving Platform
Stores Training Runs, Metric Time-series, Benchmark Evaluations, and Simulation Telemetry.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.database.database import Base

class TrainingRun(Base):
    __tablename__ = "training_runs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="running")  # running, completed, stopped, failed
    total_timesteps = Column(Integer, default=10000)
    current_step = Column(Integer, default=0)
    learning_rate = Column(Float, default=3e-4)
    batch_size = Column(Integer, default=64)
    scenario = Column(String(100), default="default")
    model_name = Column(String(150), default="ppo_av_model")
    final_reward = Column(Float, nullable=True)
    final_collision_rate = Column(Float, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    metrics = relationship("TrainingMetric", back_populates="run", cascade="all, delete-orphan")

class TrainingMetric(Base):
    __tablename__ = "training_metrics"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("training_runs.id"), index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    step = Column(Integer, index=True)
    episode = Column(Integer)
    reward = Column(Float)
    mean_reward = Column(Float)
    collision_rate = Column(Float)
    episode_length = Column(Integer)
    fps = Column(Integer, nullable=True)

    run = relationship("TrainingRun", back_populates="metrics")

class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    agent_type = Column(String(50), index=True)  # ppo, rule_based, random
    scenario_id = Column(String(100), index=True)
    episodes = Column(Integer, default=5)
    mean_reward = Column(Float)
    std_reward = Column(Float)
    collision_rate = Column(Float)
    success_rate = Column(Float)
    average_speed = Column(Float)
    details = Column(JSON, nullable=True)

class SimulationSession(Base):
    __tablename__ = "simulation_sessions"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    scenario_id = Column(String(100))
    agent_type = Column(String(50))
    total_steps = Column(Integer, default=0)
    total_reward = Column(Float, default=0.0)
    collision = Column(Boolean, default=False)
    destination_reached = Column(Boolean, default=False)
    telemetry_summary = Column(JSON, nullable=True)
