"""
Unit Tests for PPO Agent and Baseline Agents
"""

import numpy as np
import pytest
from ai.environment.av_env import AutonomousVehicleEnv
from ai.environment.spaces import NUM_ACTIONS
from ai.agents.baseline_agent import RandomAgent, RuleBasedAgent
from ai.agents.ppo_agent import PPOAutonomousAgent

def test_random_agent():
    env = AutonomousVehicleEnv()
    agent = RandomAgent(env.action_space)
    obs, info = env.reset(seed=42)
    action, meta = agent.predict(obs)
    assert 0 <= action < NUM_ACTIONS
    assert len(meta["probabilities"]) == NUM_ACTIONS
    assert sum(meta["probabilities"]) == pytest.approx(1.0)

def test_rule_based_agent():
    env = AutonomousVehicleEnv()
    agent = RuleBasedAgent()
    obs, info = env.reset(seed=42)
    action, meta = agent.predict(obs)
    assert 0 <= action < NUM_ACTIONS
    assert len(meta["probabilities"]) == NUM_ACTIONS
    assert sum(meta["probabilities"]) == pytest.approx(1.0, abs=1e-3)

def test_ppo_agent_inference():
    agent = PPOAutonomousAgent("ai/saved_models/ppo_av_model.zip")
    env = AutonomousVehicleEnv()
    obs, info = env.reset(seed=42)
    action, meta = agent.predict(obs, deterministic=True)
    assert 0 <= action < NUM_ACTIONS
    assert len(meta["probabilities"]) == NUM_ACTIONS
    assert "value_estimate" in meta
