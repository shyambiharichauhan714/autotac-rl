"""
PPO Training Pipeline for Autonomous Vehicle Tactical Driving
Supports curriculum training, hyperparameter configuration, metric recording, and model checkpointing.
"""

import argparse
import sys
import time
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from typing import Optional, Callable, Dict, Any

from ai.environment.av_env import AutonomousVehicleEnv
from ai.agents.ppo_agent import PPOAutonomousAgent
from ai.training.callbacks import LiveMetricsCallback

def train_ppo_agent(
    total_timesteps: int = 10000,
    learning_rate: float = 3e-4,
    batch_size: int = 64,
    scenario: str = "default",
    save_path: str = "ai/saved_models/ppo_av_model.zip",
    on_metric_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """
    Train a PPO model on the Autonomous Vehicle Gymnasium Environment.
    """
    print(f"[*] Initializing PPO training pipeline...")
    print(f"    Timesteps: {total_timesteps} | LR: {learning_rate} | Batch: {batch_size} | Scenario: {scenario}")
    
    # 1. Instantiate environment
    env = AutonomousVehicleEnv(scenario_name=scenario)

    # 2. Instantiate PPO agent
    agent = PPOAutonomousAgent()
    agent.initialize_new(
        env=env,
        learning_rate=learning_rate,
        batch_size=batch_size,
        n_steps=min(1024, max(128, total_timesteps // 4)),
    )

    # 3. Setup callback
    callback = LiveMetricsCallback(log_freq=50, on_step_callback=on_metric_callback)

    # 4. Run optimization
    start_time = time.time()
    agent.model.learn(total_timesteps=total_timesteps, callback=callback)
    duration = time.time() - start_time

    # 5. Save model checkpoint
    agent.save(save_path)
    print(f"[+] Model checkpoint successfully saved to {save_path} (Training time: {duration:.2f}s)")

    mean_reward = (
        sum(callback.episode_rewards[-20:]) / len(callback.episode_rewards[-20:])
        if callback.episode_rewards else 0.0
    )
    collision_rate = (
        sum(callback.collision_events[-50:]) / len(callback.collision_events[-50:])
        if callback.collision_events else 0.0
    )

    return {
        "status": "completed",
        "total_timesteps": total_timesteps,
        "total_episodes": callback.total_episodes,
        "mean_reward": round(mean_reward, 2),
        "collision_rate": round(collision_rate, 3),
        "training_duration": round(duration, 2),
        "saved_model_path": save_path,
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train PPO AV Agent")
    parser.add_argument("--timesteps", type=int, default=5000)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--scenario", type=str, default="default")
    parser.add_argument("--save-path", type=str, default="ai/saved_models/ppo_av_model.zip")
    args = parser.parse_args()

    train_ppo_agent(
        total_timesteps=args.timesteps,
        learning_rate=args.lr,
        batch_size=args.batch_size,
        scenario=args.scenario,
        save_path=args.save_path,
    )
