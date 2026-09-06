"""
Unit tests for Reward System and Curriculum Manager
"""

import pytest
from ai.rewards.reward_functions import RewardCalculator, RewardWeights
from ai.rewards.curriculum import CurriculumManager

def test_reward_calculator():
    calc = RewardCalculator()
    total, comps = calc.compute_step_reward(
        ego_speed=25.0,
        speed_limit=28.0,
        lane_deviation=0.0,
        lane_width=4.0,
        lead_distance=50.0,
        safe_distance_threshold=20.0,
        ego_accel=0.5,
        max_brake=-8.5,
        collision=False,
        near_collision=False,
        red_light_violation=False,
        destination_reached=False,
    )
    assert total > 0.0
    assert comps["progress"] > 0.0
    assert comps["collision"] == 0.0

def test_reward_collision_penalty():
    calc = RewardCalculator()
    total, comps = calc.compute_step_reward(
        ego_speed=15.0,
        speed_limit=28.0,
        lane_deviation=0.0,
        lane_width=4.0,
        lead_distance=0.0,
        safe_distance_threshold=20.0,
        ego_accel=-4.0,
        max_brake=-8.5,
        collision=True,
        near_collision=True,
        red_light_violation=False,
        destination_reached=False,
    )
    assert total <= -90.0
    assert comps["collision"] == -100.0

def test_curriculum_manager():
    curriculum = CurriculumManager()
    assert curriculum.current_stage.level == 1
    # Advance through successful episodes
    for _ in range(25):
        curriculum.record_episode(success=True)
    assert curriculum.current_stage.level == 2
