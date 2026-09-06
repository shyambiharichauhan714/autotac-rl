"""
Backend Configuration Module
Defines runtime configurations, file paths, default hyperparameters,
and scenario configurations for Autonomous Vehicle Decision Making.
"""

from pathlib import Path
from dataclasses import dataclass, field

try:
    from pydantic import BaseModel
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False

# Base Directory Paths
BASE_DIR = Path(__file__).resolve().parent.parent
AI_DIR = BASE_DIR / "ai"
SAVED_MODELS_DIR = AI_DIR / "saved_models"
DATA_DIR = BASE_DIR / "data"
TRAINING_DATA_DIR = DATA_DIR / "training"
EVAL_DATA_DIR = DATA_DIR / "evaluation"

# Ensure runtime directories exist
SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
TRAINING_DATA_DIR.mkdir(parents=True, exist_ok=True)
EVAL_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Database Configuration
DATABASE_URL = f"sqlite:///{DATA_DIR}/av_drl.db"

@dataclass
class SimulationSettings:
    num_lanes: int = 3
    lane_width: float = 4.0  # meters
    road_length: float = 1000.0  # meters
    speed_limit: float = 30.0  # m/s (~108 km/h)
    delta_t: float = 0.1  # seconds per step
    max_steps_per_episode: int = 500
    safe_following_distance: float = 20.0  # meters

@dataclass
class PPOHyperparameters:
    learning_rate: float = 0.0003
    n_steps: int = 2048
    batch_size: int = 64
    n_epochs: int = 10
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_range: float = 0.2
    ent_coef: float = 0.01
    vf_coef: float = 0.5
    max_grad_norm: float = 0.5

@dataclass
class RewardWeights:
    forward_progress: float = 1.0
    lane_center_keeping: float = 0.5
    safe_distance: float = 0.8
    speed_compliance: float = 0.4
    smooth_driving: float = 0.2
    destination_reached: float = 50.0
    collision: float = -100.0
    near_collision: float = -15.0
    lane_departure: float = -20.0
    red_light_violation: float = -40.0
    excessive_braking: float = -2.0
    excessive_steering: float = -1.0

# Global Instances
SIM_SETTINGS = SimulationSettings()
DEFAULT_PPO_PARAMS = PPOHyperparameters()
DEFAULT_REWARDS = RewardWeights()

