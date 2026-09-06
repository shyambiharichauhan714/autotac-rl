"""
Training Callbacks for Logging, Live Streaming, and Checkpointing
Captures episode returns, lengths, collision events, and loss metrics during PPO optimization.
"""

from typing import Dict, Any, List, Optional, Callable
import time
from stable_baselines3.common.callbacks import BaseCallback

class LiveMetricsCallback(BaseCallback):
    """Callback for broadcasting training telemetry to SQLite database and frontend UI."""
    def __init__(
        self,
        log_freq: int = 100,
        on_step_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        verbose: int = 0,
    ):
        super().__init__(verbose)
        self.log_freq = log_freq
        self.on_step_callback = on_step_callback
        
        self.episode_rewards: List[float] = []
        self.episode_lengths: List[int] = []
        self.collision_events: List[int] = []
        self.current_ep_reward = 0.0
        self.current_ep_length = 0
        self.total_episodes = 0
        self.start_time = time.time()

    def _on_step(self) -> bool:
        # Check reward and terminal signals
        rewards = self.locals.get("rewards")
        dones = self.locals.get("dones")
        infos = self.locals.get("infos")

        if rewards is not None and len(rewards) > 0:
            self.current_ep_reward += float(rewards[0])
            self.current_ep_length += 1

        if dones is not None and len(dones) > 0 and dones[0]:
            self.total_episodes += 1
            self.episode_rewards.append(self.current_ep_reward)
            self.episode_lengths.append(self.current_ep_length)
            
            # Check collision in info
            has_collided = 0
            if infos and len(infos) > 0:
                has_collided = 1 if infos[0].get("collision", False) else 0
            self.collision_events.append(has_collided)

            # Emit summary metric
            if self.on_step_callback:
                avg_reward = (
                    sum(self.episode_rewards[-20:]) / len(self.episode_rewards[-20:])
                    if self.episode_rewards else 0.0
                )
                collision_rate = (
                    sum(self.collision_events[-50:]) / len(self.collision_events[-50:])
                    if self.collision_events else 0.0
                )
                metric_payload = {
                    "step": self.num_timesteps,
                    "episode": self.total_episodes,
                    "episode_reward": round(self.current_ep_reward, 2),
                    "mean_reward": round(avg_reward, 2),
                    "episode_length": self.current_ep_length,
                    "collision_rate": round(collision_rate, 3),
                    "fps": int(self.num_timesteps / max(time.time() - self.start_time, 0.1)),
                }
                self.on_step_callback(metric_payload)

            self.current_ep_reward = 0.0
            self.current_ep_length = 0

        return True
