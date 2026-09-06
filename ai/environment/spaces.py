"""
Autonomous Vehicle Gymnasium Environment Specification
Defines observation bounds, action definitions, and environment constants.
"""

from enum import IntEnum
import numpy as np

class ActionType(IntEnum):
    """Discrete Tactical Decision Action Space"""
    MAINTAIN_SPEED = 0
    ACCELERATE = 1
    BRAKE = 2
    CHANGE_LANE_LEFT = 3
    CHANGE_LANE_RIGHT = 4
    EMERGENCY_BRAKE = 5

ACTION_NAMES = {
    ActionType.MAINTAIN_SPEED: "MAINTAIN_SPEED",
    ActionType.ACCELERATE: "ACCELERATE",
    ActionType.BRAKE: "BRAKE",
    ActionType.CHANGE_LANE_LEFT: "CHANGE_LANE_LEFT",
    ActionType.CHANGE_LANE_RIGHT: "CHANGE_LANE_RIGHT",
    ActionType.EMERGENCY_BRAKE: "EMERGENCY_BRAKE",
}

# Observation vector feature dictionary
STATE_FEATURE_NAMES = [
    "ego_speed",                  # [0]: Longitudinal speed normalized by max_speed [0, 1]
    "ego_acceleration",           # [1]: Current acceleration normalized [-1, 1]
    "current_lane",               # [2]: Lane index normalized [0, 1]
    "distance_vehicle_ahead",     # [3]: Distance to lead vehicle in lane normalized [0, 1]
    "relative_speed_ahead",       # [4]: (v_lead - v_ego) / max_speed [-1, 1]
    "distance_left_vehicle",      # [5]: Distance to closest vehicle in left lane [0, 1]
    "distance_right_vehicle",     # [6]: Distance to closest vehicle in right lane [0, 1]
    "traffic_signal_state",       # [7]: Green (1.0), Yellow (0.5), Red (0.0), None (-1.0)
    "distance_traffic_signal",    # [8]: Distance to upcoming traffic light [0, 1]
    "distance_obstacle",          # [9]: Distance to road hazard/debris [0, 1]
    "lane_deviation",             # [10]: Lateral deviation from lane center [-1, 1]
    "distance_destination",       # [11]: Remaining distance to destination [0, 1]
]

OBS_DIM = len(STATE_FEATURE_NAMES)  # Exactly 12 dimensions
NUM_ACTIONS = len(ActionType)        # Exactly 6 discrete actions

# Default physical limits
MAX_SPEED = 35.0         # m/s (~126 km/h)
MIN_SPEED = 0.0          # m/s (no reversing on highway)
MAX_ACCEL = 3.5          # m/s^2 (comfortable acceleration)
NORMAL_BRAKE = -4.0      # m/s^2 (service braking)
EMERGENCY_BRAKE = -8.5   # m/s^2 (maximum friction braking)
LANE_CHANGE_DURATION = 1.5  # seconds to complete lateral maneuver
SENSOR_RANGE = 120.0     # meters maximum LiDAR/radar perception range
ROAD_LENGTH = 1000.0     # meters default scenario road length
NUM_LANES = 3            # standard 3-lane highway
LANE_WIDTH = 4.0         # meters standard lane width
DELTA_T = 0.1            # 10 Hz control loop
