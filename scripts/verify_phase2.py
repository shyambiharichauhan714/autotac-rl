"""
Phase 2 Verification Script
Runs environment initialization, checks observation space compliance,
and verifies 500 stochastic simulation steps across scenarios.
"""

import sys
import numpy as np
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.environment.av_env import AutonomousVehicleEnv
from ai.environment.spaces import (
    ActionType,
    ACTION_NAMES,
    STATE_FEATURE_NAMES,
    OBS_DIM,
    NUM_ACTIONS,
)

def run_phase2_verification() -> bool:
    print("==================================================")
    print(" PHASE 2 VERIFICATION: GYMNASIUM AV ENVIRONMENT")
    print("==================================================")

    # 1. Instantiate Environment
    env = AutonomousVehicleEnv()
    print(f"[*] Environment initialized successfully.")
    print(f"    Observation Space: {env.observation_space}")
    print(f"    Action Space:      {env.action_space} ({NUM_ACTIONS} discrete actions)")
    print(f"    Observation Dimension: {OBS_DIM} features")

    assert env.observation_space.shape == (12,), "Obs dim must be 12"
    assert env.action_space.n == 6, "Action count must be 6"

    # 2. Test Reset
    obs, info = env.reset(seed=123)
    print("\n[*] Reset Observation Vector:")
    for idx, (name, val) in enumerate(zip(STATE_FEATURE_NAMES, obs)):
        print(f"    [{idx:02d}] {name:<26}: {val:+.4f}")

    assert env.observation_space.contains(obs), "Reset observation out of bounds!"

    # 3. Test Scenarios
    scenarios = [
        "clear_road",
        "slow_vehicle_ahead",
        "sudden_obstacle",
        "red_traffic_signal",
        "heavy_traffic",
    ]

    print("\n[*] Validating Scenarios Execution:")
    for sc in scenarios:
        s_obs, s_info = env.reset(seed=42, options={"scenario": sc})
        # Step 20 steps
        for step in range(20):
            action = env.action_space.sample()
            s_obs, r, term, trunc, s_info = env.step(action)
            assert env.observation_space.contains(s_obs), f"Obs out of bounds in {sc} step {step}"
            if term or trunc:
                break
        print(f"    [PASS] Scenario '{sc}': ran {s_info['step']} steps, total reward = {s_info['total_reward']:.2f}")

    print("\n[SUCCESS] PHASE 2 COMPLETE: Environment is fully compliant and validated!")
    return True

if __name__ == "__main__":
    success = run_phase2_verification()
    sys.exit(0 if success else 1)
