"""
Multi-Objective Reward Formulation for Autonomous Vehicle Tactical Driving
Decomposes reward signal into interpretable safety, efficiency, and comfort objectives.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Tuple
import numpy as np

@dataclass
class RewardWeights:
    """Configurable weights for multi-objective reward balancing."""
    progress_weight: float = 1.0           # Efficiency: forward progress towards destination
    lane_center_weight: float = 0.6        # Lane keeping: lateral alignment within lane
    safe_headway_weight: float = 1.2       # Safety: time headway and following buffer
    speed_compliance_weight: float = 0.5   # Rule compliance: speed limit compliance
    smoothness_weight: float = 0.3         # Comfort: minimizing sudden jerk and heavy acceleration
    collision_penalty: float = 100.0       # Severe penalty for any collision
    near_collision_penalty: float = 15.0   # Soft penalty for critical TTC/headway encroachment
    red_light_penalty: float = 40.0        # Traffic law compliance: stopline traversal on red
    goal_reward: float = 50.0              # Completion bonus upon reaching destination
    idle_penalty: float = 0.5              # Penalty for stopping on open highway

class RewardCalculator:
    """Calculates granular component-wise rewards and prevents reward hacking."""
    def __init__(self, weights: RewardWeights = None):
        self.weights = weights or RewardWeights()

    def compute_step_reward(
        self,
        ego_speed: float,
        speed_limit: float,
        lane_deviation: float,
        lane_width: float,
        lead_distance: float,
        safe_distance_threshold: float,
        ego_accel: float,
        max_brake: float,
        collision: bool,
        near_collision: bool,
        red_light_violation: bool,
        destination_reached: bool,
    ) -> Tuple[float, Dict[str, float]]:
        """
        Computes composite scalar reward and broken down dictionary of reward components.
        """
        # 1. Forward progress reward (normalized speed towards target)
        speed_ratio = max(0.0, ego_speed) / max(speed_limit, 1.0)
        r_progress = self.weights.progress_weight * speed_ratio

        # 2. Lane keeping reward (scaled quadratic penalty on lateral offset from lane center)
        half_lane = max(lane_width / 2.0, 0.5)
        norm_dev = min(1.0, abs(lane_deviation) / half_lane)
        r_lane = -self.weights.lane_center_weight * (norm_dev ** 1.5)

        # 3. Safe headway buffer (exponential surge as distance drops below threshold)
        r_headway = 0.0
        if lead_distance < safe_distance_threshold:
            deficit = (safe_distance_threshold - lead_distance) / max(safe_distance_threshold, 1.0)
            r_headway = -self.weights.safe_headway_weight * (np.exp(deficit * 2.5) - 1.0)
        if near_collision:
            r_headway -= self.weights.near_collision_penalty

        # 4. Speed limit compliance
        r_speed = 0.0
        if ego_speed > speed_limit:
            overshoot = ego_speed - speed_limit
            r_speed = -self.weights.speed_compliance_weight * (overshoot ** 1.2)
        elif ego_speed < 4.0 and lead_distance > 40.0:
            # Idle/loitering penalty when road is clear
            r_speed = -self.weights.idle_penalty

        # 5. Smoothness & Comfort (penalize excessive acceleration / heavy jerk)
        norm_accel = abs(ego_accel) / max(abs(max_brake), 1.0)
        r_smoothness = -self.weights.smoothness_weight * (norm_accel ** 2)

        # 6. Terminal & Safety infractions
        r_collision = -self.weights.collision_penalty if collision else 0.0
        r_red_light = -self.weights.red_light_penalty if red_light_violation else 0.0
        r_goal = self.weights.goal_reward if destination_reached else 0.0

        total_reward = (
            r_progress
            + r_lane
            + r_headway
            + r_speed
            + r_smoothness
            + r_collision
            + r_red_light
            + r_goal
        )

        components = {
            "progress": round(float(r_progress), 4),
            "lane_keeping": round(float(r_lane), 4),
            "safe_headway": round(float(r_headway), 4),
            "speed_compliance": round(float(r_speed), 4),
            "smoothness": round(float(r_smoothness), 4),
            "collision": round(float(r_collision), 4),
            "red_light": round(float(r_red_light), 4),
            "goal": round(float(r_goal), 4),
            "total": round(float(total_reward), 4),
        }

        return float(total_reward), components
