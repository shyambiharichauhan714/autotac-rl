"""
Unit Tests for Benchmark Evaluator and Metrics
"""

import pytest
from ai.evaluation.metrics import compute_aggregate_metrics
from ai.evaluation.evaluator import BenchmarkEvaluator

def test_aggregate_metrics():
    episodes = [
        {"total_reward": 10.0, "collision": False, "destination_reached": True, "steps": 50, "mean_speed": 20.0},
        {"total_reward": -80.0, "collision": True, "destination_reached": False, "steps": 20, "mean_speed": 15.0},
    ]
    res = compute_aggregate_metrics(episodes)
    assert res["episodes"] == 2
    assert res["collision_rate"] == 0.5
    assert res["success_rate"] == 0.5

def test_evaluator_agent():
    evaluator = BenchmarkEvaluator(model_path="ai/saved_models/ppo_av_model.zip")
    res = evaluator.evaluate_agent(agent_type="rule_based", scenario_id="clear_road", num_episodes=2)
    assert res["episodes"] == 2
    assert "mean_reward" in res
    assert "collision_rate" in res
