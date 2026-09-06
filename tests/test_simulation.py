"""
Unit tests for Simulation Modules (Road, Kinematics, Traffic IDM, Obstacles, Signals)
"""

import pytest
from simulation.road import Road, RoadConfig
from simulation.vehicle import KinematicVehicle
from simulation.traffic import TrafficManager
from simulation.obstacles import ObstacleManager
from simulation.traffic_lights import TrafficLightManager, SignalState

def test_road_geometry():
    road = Road(RoadConfig(num_lanes=3, lane_width=4.0))
    assert road.get_lane_center_y(0) == 0.0
    assert road.get_lane_center_y(1) == 4.0
    assert road.get_lane_center_y(2) == 8.0
    assert road.get_lane_index(4.1) == 1
    assert road.is_within_bounds(50.0, 4.0) is True
    assert road.is_within_bounds(50.0, 25.0) is False

def test_vehicle_kinematics_and_collision():
    v1 = KinematicVehicle("v1", initial_x=10.0, initial_y=0.0, initial_speed=20.0)
    v2 = KinematicVehicle("v2", initial_x=12.0, initial_y=0.0, initial_speed=20.0)
    assert v1.check_collision(v2) is True

    v1.update_kinematics(target_accel=2.0, delta_t=0.5)
    assert v1.state.speed > 20.0
    assert v1.state.x > 10.0

def test_traffic_idm_car_following():
    road = Road()
    traffic = TrafficManager(road)
    lead = traffic.add_vehicle("lead", x=50.0, lane_idx=1, speed=15.0)
    follower = traffic.add_vehicle("follower", x=20.0, lane_idx=1, speed=25.0)

    # Step traffic multiple times, follower should slow down behind lead
    for _ in range(30):
        traffic.step(delta_t=0.1)

    assert follower.state.speed < 25.0
    assert follower.state.x < lead.state.x

def test_obstacles_and_signals():
    obs_mgr = ObstacleManager()
    obs_mgr.add_obstacle("deb1", x=40.0, y=4.0)
    assert obs_mgr.check_vehicle_collision(40.0, 4.0, 4.8, 2.0) is True
    assert obs_mgr.check_vehicle_collision(100.0, 4.0, 4.8, 2.0) is False

    tl_mgr = TrafficLightManager()
    tl = tl_mgr.add_light("tl1", stopline_x=100.0, initial_state=SignalState.RED)
    assert tl_mgr.check_violation(prev_x=95.0, curr_x=105.0) is True
    assert tl_mgr.check_violation(prev_x=80.0, curr_x=90.0) is False
