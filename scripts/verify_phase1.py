"""
Phase 1 Verification Script
Validates directory structure, configuration files, and project setup.
"""

import sys
from pathlib import Path

REQUIRED_DIRS = [
    "backend",
    "backend/api",
    "backend/schemas",
    "backend/services",
    "backend/database",
    "ai",
    "ai/environment",
    "ai/agents",
    "ai/training",
    "ai/evaluation",
    "ai/rewards",
    "ai/saved_models",
    "simulation",
    "data",
    "data/training",
    "data/evaluation",
    "tests",
    "scripts",
    "notebooks",
]

REQUIRED_FILES = [
    "requirements.txt",
    "pyproject.toml",
    "README.md",
    "backend/config.py",
    "backend/__init__.py",
    "ai/__init__.py",
    "simulation/__init__.py",
    "tests/__init__.py",
    "scripts/__init__.py",
]

def verify_setup() -> bool:
    base_dir = Path(__file__).resolve().parent.parent
    print(f"[*] Verifying Project Setup at: {base_dir}")
    all_passed = True

    print("\n--- Checking Required Directories ---")
    for d in REQUIRED_DIRS:
        dir_path = base_dir / d
        if dir_path.is_dir():
            print(f" [PASS] Directory exists: {d}")
        else:
            print(f" [FAIL] Missing directory: {d}")
            all_passed = False

    print("\n--- Checking Required Files ---")
    for f in REQUIRED_FILES:
        file_path = base_dir / f
        if file_path.is_file():
            print(f" [PASS] File exists: {f}")
        else:
            print(f" [FAIL] Missing file: {f}")
            all_passed = False

    print("\n--- Checking Configuration Module ---")
    try:
        sys.path.insert(0, str(base_dir))
        from backend.config import SIM_SETTINGS, DEFAULT_PPO_PARAMS, DEFAULT_REWARDS
        print(f" [PASS] Successfully loaded config.py:")
        print(f"        Simulation lanes: {SIM_SETTINGS.num_lanes}, Speed limit: {SIM_SETTINGS.speed_limit} m/s")
        print(f"        PPO Learning rate: {DEFAULT_PPO_PARAMS.learning_rate}, Batch size: {DEFAULT_PPO_PARAMS.batch_size}")
        print(f"        Collision penalty: {DEFAULT_REWARDS.collision}, Goal reward: {DEFAULT_REWARDS.destination_reached}")
    except Exception as e:
        print(f" [FAIL] Error loading backend.config: {e}")
        all_passed = False

    if all_passed:
        print("\n[SUCCESS] PHASE 1 Verification Completed: All directories, files, and configs verified!")
    else:
        print("\n[FAILED] PHASE 1 Verification Failed: Missing items detected.")
    return all_passed

if __name__ == "__main__":
    success = verify_setup()
    sys.exit(0 if success else 1)
