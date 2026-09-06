"""
Curriculum Learning Manager for Autonomous Driving RL
Gradually introduces traffic density, obstacles, and signal challenges as agent performance improves.
"""

from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class CurriculumStage:
    level: int
    name: str
    scenario: str
    target_success_rate: float
    min_episodes: int
    description: str

STAGES = [
    CurriculumStage(
        level=1,
        name="Lane Cruising & Speed Control",
        scenario="clear_road",
        target_success_rate=0.90,
        min_episodes=20,
        description="Master longitudinal speed compliance and lane centering on empty road.",
    ),
    CurriculumStage(
        level=2,
        name="Car Following & Headway Maintenance",
        scenario="slow_vehicle_ahead",
        target_success_rate=0.85,
        min_episodes=30,
        description="Maintain safe following distance behind slow lead traffic and execute lane shifts.",
    ),
    CurriculumStage(
        level=3,
        name="Traffic Light & Signal Compliance",
        scenario="red_traffic_signal",
        target_success_rate=0.85,
        min_episodes=30,
        description="Respond to dynamic signal transitions and stop safely prior to stoplines.",
    ),
    CurriculumStage(
        level=4,
        name="Dense Highway Traffic",
        scenario="heavy_traffic",
        target_success_rate=0.80,
        min_episodes=40,
        description="Navigate multi-lane highway surrounded by fluctuating IDM vehicles.",
    ),
    CurriculumStage(
        level=5,
        name="Complex Emergency Maneuvering",
        scenario="sudden_obstacle",
        target_success_rate=0.75,
        min_episodes=50,
        description="Evade sudden road debris and hazardous braking lead cars.",
    ),
]

class CurriculumManager:
    """Tracks training metrics and dynamically advances curriculum stages."""
    def __init__(self):
        self.current_stage_idx = 0
        self.episodes_in_stage = 0
        self.recent_successes = []

    @property
    def current_stage(self) -> CurriculumStage:
        return STAGES[self.current_stage_idx]

    def record_episode(self, success: bool) -> bool:
        """Records episode outcome. Returns True if advanced to next curriculum level."""
        self.episodes_in_stage += 1
        self.recent_successes.append(1 if success else 0)
        if len(self.recent_successes) > 25:
            self.recent_successes.pop(0)

        # Check advancement condition
        if self.episodes_in_stage >= self.current_stage.min_episodes and len(self.recent_successes) >= 20:
            rate = sum(self.recent_successes) / len(self.recent_successes)
            if rate >= self.current_stage.target_success_rate:
                if self.current_stage_idx < len(STAGES) - 1:
                    self.current_stage_idx += 1
                    self.episodes_in_stage = 0
                    self.recent_successes.clear()
                    return True
        return False

    def get_status(self) -> Dict[str, Any]:
        rate = (sum(self.recent_successes) / len(self.recent_successes)) if self.recent_successes else 0.0
        return {
            "current_level": self.current_stage.level,
            "stage_name": self.current_stage.name,
            "scenario": self.current_stage.scenario,
            "episodes_in_stage": self.episodes_in_stage,
            "rolling_success_rate": round(rate, 2),
            "target_success_rate": self.current_stage.target_success_rate,
            "total_stages": len(STAGES),
        }
