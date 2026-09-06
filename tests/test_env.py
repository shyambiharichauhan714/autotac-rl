"""
Gymnasium Environment Unit Tests
Validates reset, step, bounds, collision logic, and Gymnasium API conformance.
"""

import numpy as np
import pytest
from ai.environment.av_env import AutonomousVehicleEnv
from ai.environment.spaces import (
    ActionType,
    ACTION_NAMES,
    OBS_DIM,
    NUM_ACTIONS,
    MAX_SPEED,
    MIN_SPEED,
)

def test_environment_initialization():
    """Verify environment action and observation space dimensions and types."""
    env = AutonomousVehicleEnv()
    assert env.action_space.n == NUM_ACTIONS
    assert env.observation_space.shape == (OBS_DIM,)
    assert env.observation_space.dtype == np.float32

def test_environment_reset():
    """Verify reset returns valid observation vector and info dictionary."""
    env = AutonomousVehicleEnv()
    obs, info = env.reset(seed=42)

    assert isinstance(obs, np.ndarray)
    assert obs.shape == (OBS_DIM,)
    assert env.observation_space.contains(obs), f"Observation {obs} not in space!"
    
    assert "ego_x" in info
    assert "ego_speed" in info
    assert "current_lane" in info
    assert info["step"] == 0

def test_environment_step_all_actions():
    """Verify all 6 tactical discrete actions step cleanly and maintain bounds."""
    env = AutonomousVehicleEnv()
    obs, info = env.reset(seed=101)

    for action in ActionType:
        next_obs, reward, terminated, truncated, step_info = env.step(action)
        assert isinstance(next_obs, np.ndarray)
        assert next_obs.shape == (OBS_DIM,)
        assert env.observation_space.contains(next_obs), (
            f"Action {ACTION_NAMES[action]} produced out-of-bounds obs: {next_obs}"
        )
        assert isinstance(reward, float)
        assert isinstance(terminated, bool)
        assert isinstance(truncated, bool)
        assert "step_reward_components" in step_info

def test_lane_change_left_and_right():
    """Verify lateral position adjusts upon lane change requests."""
    env = AutonomousVehicleEnv()
    env.reset(seed=77, options={"initial_lane": 1})
    assert env.current_lane == 1

    # Request lane change left (towards lane 0)
    obs, reward, term, trunc, info = env.step(ActionType.CHANGE_LANE_LEFT)
    assert env.is_changing_lane is True
    assert env.target_lane == 0

    # Step through transition until maneuver completes
    for _ in range(25):
        if not env.is_changing_lane:
            break
        env.step(ActionType.MAINTAIN_SPEED)

    assert env.current_lane == 0
    assert abs(env.ego_y - 0.0) < 0.2

def test_speed_bounds_and_braking():
    """Verify vehicle accelerates and brakes within physical speed limits."""
    env = AutonomousVehicleEnv()
    env.reset(seed=12, options={"initial_speed": 10.0})

    # Accelerate
    for _ in range(30):
        env.step(ActionType.ACCELERATE)
    assert env.ego_speed <= MAX_SPEED
    assert env.ego_speed > 10.0

    # Emergency brake
    for _ in range(40):
        env.step(ActionType.EMERGENCY_BRAKE)
    assert env.ego_speed >= MIN_SPEED
    assert env.ego_speed < 1.0

def test_collision_termination():
    """Verify collision with obstacle terminates episode with negative penalty."""
    env = AutonomousVehicleEnv()
    # Setup sudden obstacle right ahead
    env.reset(seed=99, options={"scenario": "sudden_obstacle", "initial_speed": 25.0})

    terminated = False
    collision_occurred = False
    for _ in range(50):
        obs, reward, terminated, truncated, info = env.step(ActionType.ACCELERATE)
        if info["collision"]:
            collision_occurred = True
            assert reward <= -80.0
            break

    assert collision_occurred is True
    assert terminated is True
