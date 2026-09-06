"""
PPO Policy Agent Wrapper for Autonomous Vehicle Tactical Driving
Provides model checkpoint management, action selection, and policy distribution extraction.
"""

from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import numpy as np
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env

from ai.environment.av_env import AutonomousVehicleEnv
from ai.environment.spaces import NUM_ACTIONS

class PPOAutonomousAgent:
    """High-level wrapper for SB3 PPO model with action probabilities inspection."""
    def __init__(self, model_path: Optional[str] = None, env: Optional[AutonomousVehicleEnv] = None):
        self.env = env
        self.model: Optional[PPO] = None
        self.model_path = model_path
        
        if model_path and Path(model_path).exists():
            self.load(model_path)

    def initialize_new(
        self,
        env: AutonomousVehicleEnv,
        learning_rate: float = 3e-4,
        n_steps: int = 1024,
        batch_size: int = 64,
        n_epochs: int = 10,
        gamma: float = 0.99,
        gae_lambda: float = 0.95,
        clip_range: float = 0.2,
        ent_coef: float = 0.01,
        policy_kwargs: Optional[Dict[str, Any]] = None,
    ):
        """Construct a fresh PPO policy with optimized 2-layer MLP architecture."""
        policy_kwargs = policy_kwargs or dict(
            net_arch=dict(pi=[128, 128], vf=[128, 128]),
            activation_fn=torch.nn.Tanh,
        )
        self.model = PPO(
            policy="MlpPolicy",
            env=env,
            learning_rate=learning_rate,
            n_steps=n_steps,
            batch_size=batch_size,
            n_epochs=n_epochs,
            gamma=gamma,
            gae_lambda=gae_lambda,
            clip_range=clip_range,
            ent_coef=ent_coef,
            policy_kwargs=policy_kwargs,
            verbose=0,
        )

    def predict(self, observation: np.ndarray, deterministic: bool = True) -> Tuple[int, Dict[str, Any]]:
        """
        Select action from observation and compute action probabilities for HUD display.
        """
        if self.model is None:
            # Fallback uniform random
            action = int(np.random.randint(0, NUM_ACTIONS))
            probs = [1.0 / NUM_ACTIONS] * NUM_ACTIONS
            return action, {"probabilities": probs, "value_estimate": 0.0}

        # Vectorize observation for PyTorch policy
        obs_tensor = torch.as_tensor(observation).unsqueeze(0).to(self.model.policy.device)
        with torch.no_grad():
            distribution = self.model.policy.get_distribution(obs_tensor)
            probs = distribution.distribution.probs.cpu().numpy()[0].tolist()
            value = float(self.model.policy.predict_values(obs_tensor).cpu().numpy()[0][0])

        if deterministic:
            action = int(np.argmax(probs))
        else:
            action = int(np.random.choice(NUM_ACTIONS, p=probs))

        return action, {"probabilities": probs, "value_estimate": round(value, 3)}

    def save(self, filepath: str):
        if self.model is not None:
            Path(filepath).parent.mkdir(parents=True, exist_ok=True)
            self.model.save(filepath)

    def load(self, filepath: str):
        self.model = PPO.load(filepath)
        self.model_path = filepath
