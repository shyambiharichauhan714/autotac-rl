"""
Multi-Agent Benchmark Evaluator
Executes standardized evaluation episodes comparing PPO with Random and Rule-Based Baselines.
"""

from typing import Dict, Any, List, Optional
import numpy as np
from ai.environment.av_env import AutonomousVehicleEnv
from ai.agents.baseline_agent import RandomAgent, RuleBasedAgent
from ai.agents.ppo_agent import PPOAutonomousAgent
from ai.evaluation.metrics import compute_aggregate_metrics
from ai.evaluation.scenarios import EVAL_SCENARIOS

class BenchmarkEvaluator:
    """Orchestrates comparative benchmarking across agents and test scenarios."""
    def __init__(self, model_path: Optional[str] = "ai/saved_models/ppo_av_model.zip"):
        self.model_path = model_path
        self.env = AutonomousVehicleEnv()
        self.agents = {
            "random": RandomAgent(self.env.action_space),
            "rule_based": RuleBasedAgent(),
            "ppo": PPOAutonomousAgent(model_path) if model_path else None,
        }

    def evaluate_agent(
        self,
        agent_type: str,
        scenario_id: str = "default",
        num_episodes: int = 5,
        deterministic: bool = True,
    ) -> Dict[str, Any]:
        """Runs evaluation for a specific agent on a designated scenario."""
        agent = self.agents.get(agent_type)
        if agent is None:
            raise ValueError(f"Agent '{agent_type}' is not configured or model missing.")

        episodes = []
        for ep in range(num_episodes):
            obs, info = self.env.reset(seed=1000 + ep, options={"scenario": scenario_id})
            done = False
            total_r = 0.0
            speeds = []
            step = 0

            while not done:
                step += 1
                action, meta = agent.predict(obs, deterministic=deterministic)
                obs, reward, terminated, truncated, step_info = self.env.step(action)
                total_r += reward
                speeds.append(step_info["ego_speed"])
                done = terminated or truncated

            episodes.append({
                "episode": ep + 1,
                "total_reward": total_r,
                "steps": step,
                "collision": step_info["collision"],
                "destination_reached": step_info["destination_reached"],
                "near_collisions": step_info["near_collisions"],
                "red_light_violations": step_info["red_light_violations"],
                "mean_speed": float(np.mean(speeds)) if speeds else 0.0,
            })

        summary = compute_aggregate_metrics(episodes)
        summary["agent_type"] = agent_type
        summary["scenario_id"] = scenario_id
        summary["episode_details"] = episodes
        return summary

    def run_full_benchmark(self, num_episodes_per_scenario: int = 3) -> Dict[str, Any]:
        """Runs comparative evaluation across all 3 agents and multiple scenarios."""
        results = {}
        target_scenarios = ["clear_road", "slow_vehicle_ahead", "sudden_obstacle", "red_traffic_signal", "heavy_traffic"]
        
        for agent_name in ["random", "rule_based", "ppo"]:
            if agent_name == "ppo" and self.agents["ppo"] is None:
                continue
            
            agent_results = []
            for sc in target_scenarios:
                res = self.evaluate_agent(
                    agent_type=agent_name,
                    scenario_id=sc,
                    num_episodes=num_episodes_per_scenario,
                )
                agent_results.append(res)

            # Combined metrics for agent across all scenarios
            all_episodes = [ep for r in agent_results for ep in r["episode_details"]]
            overall = compute_aggregate_metrics(all_episodes)
            overall["by_scenario"] = {r["scenario_id"]: r for r in agent_results}
            results[agent_name] = overall

        return results
