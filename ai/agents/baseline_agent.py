"""
Baseline Driving Agents for Benchmarking and Comparison
Implements Random Policy and Deterministic Rule-Based Tactical Controller.
"""

from typing import Dict, Any, Tuple
import numpy as np
from ai.environment.spaces import ActionType

class RandomAgent:
    """Agent executing uniform random discrete actions."""
    def __init__(self, action_space):
        self.action_space = action_space

    def predict(self, observation: np.ndarray, deterministic: bool = True) -> Tuple[int, Dict[str, Any]]:
        action = int(self.action_space.sample())
        # Return uniform action probabilities
        probs = [1.0 / self.action_space.n] * self.action_space.n
        return action, {"probabilities": probs}

class RuleBasedAgent:
    """
    Deterministic Heuristic Tactical Controller.
    Implements standard engineering rules:
    - Maintain safe distance to lead vehicle
    - React to red/yellow traffic signals
    - Overtake slow lead traffic via lane change if adjacent lane is clear
    - Obey speed limit and avoid collisions
    """
    def __init__(self, target_speed_ratio: float = 0.85):
        self.target_speed_ratio = target_speed_ratio

    def predict(self, observation: np.ndarray, deterministic: bool = True) -> Tuple[int, Dict[str, Any]]:
        # Observation indices:
        # [0]: ego_speed, [1]: ego_accel, [2]: current_lane, [3]: dist_lead
        # [4]: rel_speed, [5]: dist_left, [6]: dist_right, [7]: signal_state
        # [8]: dist_signal, [9]: dist_obstacle, [10]: lane_dev, [11]: dist_goal
        
        ego_speed = float(observation[0])
        dist_lead = float(observation[3])          # normalized [0, 1] -> 0 to 120m
        rel_speed = float(observation[4])
        dist_left = float(observation[5])
        dist_right = float(observation[6])
        signal_state = float(observation[7])       # -1.0=none, 0.0=red, 0.5=yellow, 1.0=green
        dist_signal = float(observation[8])
        dist_obstacle = float(observation[9])

        # Default action probabilities (will peak around selected action)
        probs = [0.05] * 6

        # 1. Emergency Braking: immediate obstacle or critical proximity (< 12m)
        if dist_obstacle < 0.12 or dist_lead < 0.10:
            action = ActionType.EMERGENCY_BRAKE
        
        # 2. Red / Yellow Light Compliance (< 40m away)
        elif (signal_state == 0.0 or signal_state == 0.5) and dist_signal < 0.35:
            if ego_speed > 0.1:
                action = ActionType.BRAKE
            else:
                action = ActionType.MAINTAIN_SPEED

        # 3. Slow or encroaching lead vehicle: Consider lane change or braking
        elif dist_lead < 0.30:  # < 36 meters
            # Check if left lane is clear (> 45 meters gap)
            if dist_left > 0.40 and observation[2] > 0.1:
                action = ActionType.CHANGE_LANE_LEFT
            # Check if right lane is clear
            elif dist_right > 0.40 and observation[2] < 0.9:
                action = ActionType.CHANGE_LANE_RIGHT
            else:
                # Boxed in: Brake to match lead vehicle speed
                action = ActionType.BRAKE

        # 4. Open road cruising
        elif ego_speed < self.target_speed_ratio:
            action = ActionType.ACCELERATE
        elif ego_speed > (self.target_speed_ratio + 0.08):
            action = ActionType.BRAKE
        else:
            action = ActionType.MAINTAIN_SPEED

        # Format probability distribution
        probs[action] = 0.75
        remaining = 0.25 / 5.0
        for i in range(6):
            if i != action:
                probs[i] = remaining

        return int(action), {"probabilities": probs}
