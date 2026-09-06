"""
Evaluation Metrics Computation for Autonomous Driving RL
Computes statistical aggregates: mean return, collision rate, success rate, speed compliance, and safety indices.
"""

from typing import List, Dict, Any
import numpy as np

def compute_aggregate_metrics(episode_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes rigorous statistical metrics over a set of evaluation episodes.
    """
    if not episode_results:
        return {}

    rewards = [r["total_reward"] for r in episode_results]
    collisions = [1.0 if r.get("collision", False) else 0.0 for r in episode_results]
    destinations = [1.0 if r.get("destination_reached", False) else 0.0 for r in episode_results]
    near_collisions = [r.get("near_collisions", 0) for r in episode_results]
    red_lights = [r.get("red_light_violations", 0) for r in episode_results]
    speeds = [r.get("mean_speed", 0.0) for r in episode_results]
    lengths = [r.get("steps", 0) for r in episode_results]

    return {
        "episodes": len(episode_results),
        "mean_reward": round(float(np.mean(rewards)), 2),
        "std_reward": round(float(np.std(rewards)), 2),
        "min_reward": round(float(np.min(rewards)), 2),
        "max_reward": round(float(np.max(rewards)), 2),
        "median_reward": round(float(np.median(rewards)), 2),
        "collision_rate": round(float(np.mean(collisions)), 3),
        "success_rate": round(float(np.mean(destinations)), 3),
        "near_collision_mean": round(float(np.mean(near_collisions)), 2),
        "red_light_violations_mean": round(float(np.mean(red_lights)), 2),
        "average_speed": round(float(np.mean(speeds)), 2),
        "average_episode_length": round(float(np.mean(lengths)), 1),
    }
