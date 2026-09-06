"""
FastAPI REST API Routes
Provides endpoints for health, model inspection, live simulation stepping, PPO training,
and comparative evaluations.
"""

from typing import List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.database.models import TrainingRun, TrainingMetric, EvaluationRun
from backend.schemas.api_schemas import (
    ModelInfoResponse,
    SimulationInitRequest,
    SimulationStepRequest,
    TrainingStartRequest,
    TrainingStatusResponse,
    EvaluationRequest,
)
from ai.environment.spaces import ACTION_NAMES, STATE_FEATURE_NAMES, OBS_DIM, NUM_ACTIONS
from ai.evaluation.scenarios import EVAL_SCENARIOS
from backend.services.simulation_service import simulation_service
from backend.services.training_service import training_service
from backend.services.evaluation_service import evaluation_service

router = APIRouter(prefix="/api")

@router.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "Autonomous Vehicle Tactical Driving RL Platform",
        "version": "1.0.0",
    }

@router.get("/model/info", response_model=ModelInfoResponse)
def get_model_info():
    model_path = "ai/saved_models/ppo_av_model.zip"
    exists = Path(model_path).exists()
    return {
        "model_name": "PPO Tactical Driving Agent",
        "architecture": "Proximal Policy Optimization (Actor-Critic 2x128 MLP)",
        "state_dim": OBS_DIM,
        "action_dim": NUM_ACTIONS,
        "status": "Ready" if exists else "Untrained",
        "checkpoint_exists": exists,
        "model_path": model_path,
        "action_names": ACTION_NAMES,
        "state_feature_names": STATE_FEATURE_NAMES,
    }

@router.get("/scenarios")
def list_scenarios():
    return EVAL_SCENARIOS

# ==================== SIMULATION ROUTES ====================

@router.post("/simulation/start")
def start_simulation(req: SimulationInitRequest):
    return simulation_service.start_session(
        scenario=req.scenario,
        agent_type=req.agent_type,
        deterministic=req.deterministic,
        speed_limit=req.speed_limit,
    )

@router.post("/simulation/step")
def step_simulation(req: SimulationStepRequest):
    return simulation_service.step(manual_action=req.manual_action)

@router.get("/simulation/state")
def get_simulation_state():
    return simulation_service.step(manual_action=None) if simulation_service.is_active else simulation_service.start_session()

@router.post("/simulation/reset")
def reset_simulation():
    return simulation_service.start_session(
        scenario=simulation_service.scenario,
        agent_type=simulation_service.agent_type,
        deterministic=simulation_service.deterministic,
    )

# ==================== TRAINING ROUTES ====================

@router.post("/training/start")
def start_training(req: TrainingStartRequest):
    return training_service.start_training(
        total_timesteps=req.total_timesteps,
        learning_rate=req.learning_rate,
        batch_size=req.batch_size,
        scenario=req.scenario,
    )

@router.post("/training/stop")
def stop_training():
    return training_service.stop_training()

@router.get("/training/status")
def get_training_status():
    return training_service.get_status()

@router.get("/training/history")
def get_training_history(db: Session = Depends(get_db)):
    runs = db.query(TrainingRun).order_by(TrainingRun.id.desc()).limit(10).all()
    return [
        {
            "id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "status": r.status,
            "total_timesteps": r.total_timesteps,
            "learning_rate": r.learning_rate,
            "scenario": r.scenario,
            "final_reward": r.final_reward,
            "final_collision_rate": r.final_collision_rate,
        }
        for r in runs
    ]

# ==================== EVALUATION & ANALYTICS ====================

@router.post("/evaluation/run")
def run_evaluation(req: EvaluationRequest):
    return evaluation_service.run_evaluation(
        agent_type=req.agent_type,
        scenario_id=req.scenario_id,
        num_episodes=req.num_episodes,
    )

@router.get("/evaluation/benchmark")
def get_full_benchmark():
    return evaluation_service.get_benchmark_comparison()

@router.get("/analytics/summary")
def get_analytics_summary(db: Session = Depends(get_db)):
    total_runs = db.query(TrainingRun).count()
    completed_runs = db.query(TrainingRun).filter(TrainingRun.status == "completed").count()
    eval_runs = db.query(EvaluationRun).count()

    latest_metrics = (
        db.query(TrainingMetric)
        .order_by(TrainingMetric.id.desc())
        .limit(50)
        .all()
    )

    return {
        "total_training_runs": total_runs,
        "completed_training_runs": completed_runs,
        "total_evaluations": eval_runs,
        "recent_learning_curve": [
            {
                "step": m.step,
                "episode": m.episode,
                "reward": m.reward,
                "mean_reward": m.mean_reward,
                "collision_rate": m.collision_rate,
            }
            for m in reversed(latest_metrics)
        ],
    }
