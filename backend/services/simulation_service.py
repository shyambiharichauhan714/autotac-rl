"""
Interactive Simulation Service
Manages real-time simulation sessions, executes stepping with selected policy or human override,
and generates real-time telemetry frames.
"""

from typing import Dict, Any, Optional
import numpy as np
from ai.environment.av_env import AutonomousVehicleEnv
from ai.environment.spaces import ACTION_NAMES, NUM_ACTIONS
from ai.agents.baseline_agent import RandomAgent, RuleBasedAgent
from ai.agents.ppo_agent import PPOAutonomousAgent

class SimulationService:
    def __init__(self, model_path: str = "ai/saved_models/ppo_av_model.zip"):
        self.model_path = model_path
        self.env: Optional[AutonomousVehicleEnv] = None
        self.scenario = "default"
        self.agent_type = "ppo"
        self.deterministic = True
        self.current_obs: Optional[np.ndarray] = None
        self.latest_info: Dict[str, Any] = {}
        self.is_active = False

        # Load agents
        self.random_agent = RandomAgent(None)
        self.rule_based_agent = RuleBasedAgent()
        self.ppo_agent = PPOAutonomousAgent(model_path) if model_path else None

    def start_session(
        self,
        scenario: str = "default",
        agent_type: str = "ppo",
        deterministic: bool = True,
        speed_limit: float = 28.0,
    ) -> Dict[str, Any]:
        """Start or restart a simulation episode."""
        self.scenario = scenario
        self.agent_type = agent_type
        self.deterministic = deterministic

        self.env = AutonomousVehicleEnv(
            scenario_name=scenario,
            config={"speed_limit": speed_limit},
        )
        self.random_agent.action_space = self.env.action_space

        obs, info = self.env.reset(options={"scenario": scenario})
        self.current_obs = obs
        self.latest_info = info
        self.is_active = True

        return self._format_state(action=0, action_probs=[1.0 / NUM_ACTIONS] * NUM_ACTIONS, value=0.0)

    def step(self, manual_action: Optional[int] = None) -> Dict[str, Any]:
        """Advance the simulation by one step."""
        if not self.is_active or self.env is None or self.current_obs is None:
            return self.start_session(self.scenario, self.agent_type, self.deterministic)

        # Determine action
        probs = [0.0] * NUM_ACTIONS
        value_est = 0.0

        if manual_action is not None and 0 <= manual_action < NUM_ACTIONS:
            action = int(manual_action)
            probs[action] = 1.0
        elif self.agent_type == "random":
            action, meta = self.random_agent.predict(self.current_obs)
            probs = meta["probabilities"]
        elif self.agent_type == "rule_based":
            action, meta = self.rule_based_agent.predict(self.current_obs)
            probs = meta["probabilities"]
        else:
            # PPO Agent
            if self.ppo_agent and self.ppo_agent.model:
                action, meta = self.ppo_agent.predict(self.current_obs, deterministic=self.deterministic)
                probs = meta["probabilities"]
                value_est = meta.get("value_estimate", 0.0)
            else:
                # Fallback to rule-based if PPO model not yet loaded
                action, meta = self.rule_based_agent.predict(self.current_obs)
                probs = meta["probabilities"]

        next_obs, reward, terminated, truncated, info = self.env.step(action)
        self.current_obs = next_obs
        self.latest_info = info

        if terminated or truncated:
            self.is_active = False

        return self._format_state(action=action, action_probs=probs, value=value_est)

    def _format_state(self, action: int, action_probs: list, value: float) -> Dict[str, Any]:
        info = self.latest_info
        return {
            "step": info.get("step", 0),
            "ego_x": info.get("ego_x", 0.0),
            "ego_y": info.get("ego_y", 4.0),
            "ego_speed": info.get("ego_speed", 0.0),
            "ego_accel": info.get("ego_accel", 0.0),
            "current_lane": info.get("current_lane", 1),
            "target_lane": info.get("target_lane", 1),
            "is_changing_lane": info.get("is_changing_lane", False),
            "collision": info.get("collision", False),
            "collision_target": info.get("collision_target"),
            "destination_reached": info.get("destination_reached", False),
            "total_reward": info.get("total_reward", 0.0),
            "selected_action": action,
            "selected_action_name": ACTION_NAMES.get(action, "UNKNOWN"),
            "action_probabilities": [round(p, 3) for p in action_probs],
            "value_estimate": value,
            "step_reward_components": info.get("step_reward_components", {}),
            "traffic_vehicles": info.get("traffic_vehicles", []),
            "obstacles": info.get("obstacles", []),
            "traffic_lights": info.get("traffic_lights", []),
            "is_active": self.is_active,
        }

# Global singleton
simulation_service = SimulationService()
