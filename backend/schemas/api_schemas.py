"""
Pydantic API Request & Response Schemas
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ModelInfoResponse(BaseModel):
    model_name: str
    architecture: str
    state_dim: int
    action_dim: int
    status: str
    checkpoint_exists: bool
    model_path: str
    action_names: Dict[int, str]
    state_feature_names: List[str]

class ScenarioInfo(BaseModel):
    id: str
    name: str
    category: str
    difficulty: str
    description: str
    target_speed: float
    max_steps: int

class SimulationInitRequest(BaseModel):
    scenario: str = "default"
    agent_type: str = "ppo"  # ppo, rule_based, random, manual
    deterministic: bool = True
    speed_limit: float = 28.0

class SimulationStepRequest(BaseModel):
    manual_action: Optional[int] = None  # 0 to 5 if manual

class TelemetryState(BaseModel):
    step: int
    ego_x: float
    ego_y: float
    ego_speed: float
    ego_accel: float
    current_lane: int
    target_lane: int
    is_changing_lane: bool
    collision: bool
    collision_target: Optional[str] = None
    destination_reached: bool
    total_reward: float
    selected_action: int
    selected_action_name: str
    action_probabilities: List[float]
    value_estimate: Optional[float] = None
    step_reward_components: Dict[str, float]
    traffic_vehicles: List[Dict[str, Any]]
    obstacles: List[Dict[str, Any]]
    traffic_lights: List[Dict[str, Any]]

class TrainingStartRequest(BaseModel):
    total_timesteps: int = Field(default=5000, ge=500, le=100000)
    learning_rate: float = Field(default=3e-4, ge=1e-5, le=1e-2)
    batch_size: int = Field(default=64)
    scenario: str = "default"

class TrainingStatusResponse(BaseModel):
    is_training: bool
    run_id: Optional[int] = None
    current_step: int = 0
    total_timesteps: int = 0
    progress_percentage: float = 0.0
    mean_reward: float = 0.0
    collision_rate: float = 0.0
    fps: int = 0
    recent_metrics: List[Dict[str, Any]] = []

class EvaluationRequest(BaseModel):
    agent_type: str = "ppo"
    scenario_id: str = "default"
    num_episodes: int = Field(default=3, ge=1, le=20)
