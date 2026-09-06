"""
Custom Gymnasium-compatible Autonomous Driving Environment
Implements an academic-grade, lightweight tactical decision-making simulation.
"""

from typing import Any, Dict, Optional, Tuple
import numpy as np
import gymnasium as gym
from gymnasium import spaces

from ai.environment.spaces import (
    ActionType,
    ACTION_NAMES,
    STATE_FEATURE_NAMES,
    OBS_DIM,
    NUM_ACTIONS,
    MAX_SPEED,
    MIN_SPEED,
    MAX_ACCEL,
    NORMAL_BRAKE,
    EMERGENCY_BRAKE,
    LANE_CHANGE_DURATION,
    SENSOR_RANGE,
    ROAD_LENGTH,
    NUM_LANES,
    LANE_WIDTH,
    DELTA_T,
)

class AutonomousVehicleEnv(gym.Env):
    """
    Gymnasium Environment for Autonomous Vehicle Decision Making.
    
    State: 12-dimensional continuous box representing ego kinematics,
           spatial surrounding perception (lead, left, right vehicles),
           signal cues, road obstacles, and navigation progress.
           
    Action: Discrete(6) tactical decision commands.
    """
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 10}

    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        scenario_name: str = "default",
        render_mode: Optional[str] = None,
    ):
        super().__init__()
        self.config = config or {}
        self.scenario_name = scenario_name
        self.render_mode = render_mode

        # Simulation geometry & limits
        self.num_lanes = self.config.get("num_lanes", NUM_LANES)
        self.lane_width = self.config.get("lane_width", LANE_WIDTH)
        self.road_length = self.config.get("road_length", ROAD_LENGTH)
        self.max_speed = self.config.get("max_speed", MAX_SPEED)
        self.speed_limit = self.config.get("speed_limit", 28.0)  # ~100 km/h target
        self.delta_t = self.config.get("delta_t", DELTA_T)
        self.max_steps = self.config.get("max_steps", 500)
        self.sensor_range = self.config.get("sensor_range", SENSOR_RANGE)

        # Action and Observation spaces
        self.action_space = spaces.Discrete(NUM_ACTIONS)
        
        # 12-dimensional bounded observation space
        # Features range between -1.0 and 1.0 (or 0.0 and 1.0)
        low_bounds = np.array([
            0.0,   # ego_speed
            -1.0,  # ego_acceleration
            0.0,   # current_lane
            0.0,   # distance_vehicle_ahead
            -1.0,  # relative_speed_ahead
            0.0,   # distance_left_vehicle
            0.0,   # distance_right_vehicle
            -1.0,  # traffic_signal_state (-1=none, 0=red, 0.5=yellow, 1=green)
            0.0,   # distance_traffic_signal
            0.0,   # distance_obstacle
            -1.0,  # lane_deviation
            0.0,   # distance_destination
        ], dtype=np.float32)

        high_bounds = np.ones(OBS_DIM, dtype=np.float32)
        self.observation_space = spaces.Box(
            low=low_bounds, high=high_bounds, dtype=np.float32
        )

        # Internal state variables
        self.step_count = 0
        self.ego_x = 0.0                  # longitudinal distance (meters)
        self.ego_y = 0.0                  # lateral position (meters, 0=center of lane 0)
        self.ego_speed = 0.0              # m/s
        self.ego_accel = 0.0              # m/s^2
        self.current_lane = 1             # start in middle lane (index 1 for 3 lanes)
        self.target_lane = 1
        self.is_changing_lane = False
        self.lane_change_timer = 0.0

        # Surrounding traffic & obstacles
        self.traffic_vehicles = []
        self.obstacles = []
        self.traffic_lights = []

        # Tracking metrics for logging & evaluation
        self.total_reward = 0.0
        self.collision_occurred = False
        self.destination_reached = False
        self.near_collision_count = 0
        self.lane_violation_count = 0
        self.red_light_violations = 0
        self.emergency_brake_count = 0
        self.reward_components = {}

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Reset the environment to an initial stochastic or scenario-driven state."""
        super().reset(seed=seed)
        if seed is not None:
            np.random.seed(seed)

        self.step_count = 0
        self.total_reward = 0.0
        self.collision_occurred = False
        self.destination_reached = False
        self.near_collision_count = 0
        self.lane_violation_count = 0
        self.red_light_violations = 0
        self.emergency_brake_count = 0
        self.reward_components = {
            "progress": 0.0,
            "lane_keeping": 0.0,
            "safe_headway": 0.0,
            "speed_limit": 0.0,
            "collision_penalty": 0.0,
            "signal_penalty": 0.0,
            "action_smoothness": 0.0,
            "goal_reward": 0.0,
        }

        # Override options if provided
        opts = options or {}
        scenario = opts.get("scenario", self.scenario_name)

        # Reset Ego State
        self.ego_x = float(opts.get("initial_x", 0.0))
        self.current_lane = int(opts.get("initial_lane", 1))
        self.target_lane = self.current_lane
        self.ego_y = self.current_lane * self.lane_width
        self.ego_speed = float(opts.get("initial_speed", 18.0 + np.random.uniform(-2.0, 4.0)))
        self.ego_accel = 0.0
        self.is_changing_lane = False
        self.lane_change_timer = 0.0

        # Initialize Scenario Entities
        self._setup_scenario(scenario)

        observation = self._get_observation()
        info = self._get_info()

        return observation, info

    def step(
        self, action: int
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """Execute one simulation step based on the chosen action."""
        self.step_count += 1
        action = ActionType(int(action))

        # 1. Action Decoding & Kinematic Execution
        target_accel = 0.0
        initiated_lane_change = False

        if action == ActionType.MAINTAIN_SPEED:
            # Gradually decay acceleration to zero
            target_accel = -0.1 * self.ego_accel
        elif action == ActionType.ACCELERATE:
            target_accel = MAX_ACCEL
        elif action == ActionType.BRAKE:
            target_accel = NORMAL_BRAKE
        elif action == ActionType.EMERGENCY_BRAKE:
            target_accel = EMERGENCY_BRAKE
            self.emergency_brake_count += 1
        elif action == ActionType.CHANGE_LANE_LEFT:
            if not self.is_changing_lane and self.current_lane > 0:
                self.target_lane = self.current_lane - 1
                self.is_changing_lane = True
                self.lane_change_timer = LANE_CHANGE_DURATION
                initiated_lane_change = True
        elif action == ActionType.CHANGE_LANE_RIGHT:
            if not self.is_changing_lane and self.current_lane < self.num_lanes - 1:
                self.target_lane = self.current_lane + 1
                self.is_changing_lane = True
                self.lane_change_timer = LANE_CHANGE_DURATION
                initiated_lane_change = True

        # First-order acceleration smoothing (actuator latency)
        self.ego_accel += (target_accel - self.ego_accel) * 0.6
        self.ego_speed = float(np.clip(self.ego_speed + self.ego_accel * self.delta_t, MIN_SPEED, self.max_speed))
        self.ego_x += self.ego_speed * self.delta_t

        # Lateral displacement handling during lane changes
        if self.is_changing_lane:
            self.lane_change_timer -= self.delta_t
            target_y = self.target_lane * self.lane_width
            dy = (target_y - self.ego_y) * (self.delta_t / max(self.lane_change_timer + self.delta_t, 0.2))
            self.ego_y += dy

            if self.lane_change_timer <= 0.0 or abs(self.ego_y - target_y) < 0.15:
                self.ego_y = target_y
                self.current_lane = self.target_lane
                self.is_changing_lane = False
                self.lane_change_timer = 0.0
        else:
            # Lane centering spring force
            target_y = self.current_lane * self.lane_width
            self.ego_y += (target_y - self.ego_y) * 0.2

        # 2. Update Surrounding Traffic, Signals & Obstacles
        self._update_environment_dynamics()

        # 3. Check Safety Events: Collisions, Near-Collisions, Red Light Infractions
        collision_detected, collision_target = self._check_collisions()
        near_collision = self._check_near_collisions()
        red_light_crossed = self._check_red_light_violations()

        if collision_detected:
            self.collision_occurred = True
        if near_collision:
            self.near_collision_count += 1
        if red_light_crossed:
            self.red_light_violations += 1

        # Check Termination / Truncation
        terminated = False
        truncated = False

        if self.collision_occurred:
            terminated = True
        elif self.ego_x >= self.road_length:
            self.destination_reached = True
            terminated = True
        elif self.step_count >= self.max_steps:
            truncated = True

        # 4. Reward Computation
        reward, components = self._compute_reward(
            action=action,
            collision=collision_detected,
            near_collision=near_collision,
            red_light_violation=red_light_crossed,
            destination_reached=self.destination_reached,
        )

        self.total_reward += reward
        for k, v in components.items():
            self.reward_components[k] = self.reward_components.get(k, 0.0) + v

        observation = self._get_observation()
        info = self._get_info()
        info["step_reward_components"] = components
        info["collision_target"] = collision_target

        return observation, reward, terminated, truncated, info

    def _get_observation(self) -> np.ndarray:
        """Construct the 12-dimensional normalized state vector."""
        obs = np.zeros(OBS_DIM, dtype=np.float32)

        # 0. Ego Speed [0, 1]
        obs[0] = np.clip(self.ego_speed / self.max_speed, 0.0, 1.0)

        # 1. Ego Acceleration [-1, 1]
        max_abs_accel = abs(EMERGENCY_BRAKE)
        obs[1] = np.clip(self.ego_accel / max_abs_accel, -1.0, 1.0)

        # 2. Current Lane [0, 1]
        obs[2] = self.ego_y / max((self.num_lanes - 1) * self.lane_width, 1.0)
        obs[2] = np.clip(obs[2], 0.0, 1.0)

        # Find closest vehicles in each lane
        lead_dist, lead_rel_speed = self._get_lead_vehicle_info()
        left_dist = self._get_lateral_vehicle_dist(lane_offset=-1)
        right_dist = self._get_lateral_vehicle_dist(lane_offset=1)

        # 3. Distance to lead vehicle [0, 1]
        obs[3] = np.clip(lead_dist / self.sensor_range, 0.0, 1.0)

        # 4. Relative speed to lead vehicle [-1, 1]
        obs[4] = np.clip(lead_rel_speed / self.max_speed, -1.0, 1.0)

        # 5. Distance to left lane vehicle [0, 1]
        obs[5] = np.clip(left_dist / self.sensor_range, 0.0, 1.0)

        # 6. Distance to right lane vehicle [0, 1]
        obs[6] = np.clip(right_dist / self.sensor_range, 0.0, 1.0)

        # 7. Traffic signal state (-1.0=none/clear, 0.0=red, 0.5=yellow, 1.0=green)
        # 8. Distance to traffic signal [0, 1]
        signal_state, signal_dist = self._get_upcoming_traffic_light()
        obs[7] = signal_state
        obs[8] = np.clip(signal_dist / self.sensor_range, 0.0, 1.0)

        # 9. Distance to obstacle [0, 1]
        obs_dist = self._get_closest_obstacle_dist()
        obs[9] = np.clip(obs_dist / self.sensor_range, 0.0, 1.0)

        # 10. Lane deviation [-1, 1] (displacement from nearest lane center normalized by half lane width)
        nearest_lane_idx = int(round(self.ego_y / self.lane_width))
        nearest_lane_y = nearest_lane_idx * self.lane_width
        lane_dev = (self.ego_y - nearest_lane_y) / (self.lane_width / 2.0)
        obs[10] = np.clip(lane_dev, -1.0, 1.0)

        # 11. Distance to destination [0, 1]
        remaining_dist = max(self.road_length - self.ego_x, 0.0)
        obs[11] = np.clip(remaining_dist / self.road_length, 0.0, 1.0)

        return obs

    def _get_lead_vehicle_info(self) -> Tuple[float, float]:
        """Detect the closest lead vehicle in the current lane within sensor range."""
        closest_gap = self.sensor_range
        rel_speed = 0.0

        for v in self.traffic_vehicles:
            # Check if vehicle is in or entering ego's lane
            if abs(v["y"] - self.ego_y) < (self.lane_width * 0.6):
                gap = v["x"] - self.ego_x
                # Only consider vehicles ahead
                if 0 < gap < closest_gap:
                    closest_gap = gap
                    rel_speed = v["speed"] - self.ego_speed

        return float(closest_gap), float(rel_speed)

    def _get_lateral_vehicle_dist(self, lane_offset: int) -> float:
        """Find the distance to the closest vehicle in an adjacent lane."""
        target_lane = self.current_lane + lane_offset
        if target_lane < 0 or target_lane >= self.num_lanes:
            return self.sensor_range  # No lane boundary present

        target_y = target_lane * self.lane_width
        closest_dist = self.sensor_range

        for v in self.traffic_vehicles:
            if abs(v["y"] - target_y) < (self.lane_width * 0.5):
                dist = abs(v["x"] - self.ego_x)
                if dist < closest_dist:
                    closest_dist = dist

        return float(closest_dist)

    def _get_upcoming_traffic_light(self) -> Tuple[float, float]:
        """Get state and distance to the next traffic light ahead."""
        for light in self.traffic_lights:
            dist = light["x"] - self.ego_x
            if 0 <= dist <= self.sensor_range:
                state_map = {"green": 1.0, "yellow": 0.5, "red": 0.0}
                return state_map.get(light["state"], -1.0), dist
        return -1.0, self.sensor_range

    def _get_closest_obstacle_dist(self) -> float:
        """Find distance to obstacle in current lane."""
        closest_dist = self.sensor_range
        for obs in self.obstacles:
            if abs(obs["y"] - self.ego_y) < (self.lane_width * 0.5):
                gap = obs["x"] - self.ego_x
                if 0 < gap < closest_dist:
                    closest_dist = gap
        return float(closest_dist)

    def _check_collisions(self) -> Tuple[bool, Optional[str]]:
        """Physical bounding-box collision detection with other vehicles and obstacles."""
        ego_length = 4.5  # meters
        ego_width = 1.9   # meters

        # Check vehicle collisions
        for v in self.traffic_vehicles:
            dx = abs(v["x"] - self.ego_x)
            dy = abs(v["y"] - self.ego_y)
            if dx < (ego_length + v.get("length", 4.5)) / 2.0 and dy < (ego_width + v.get("width", 1.9)) / 2.0:
                return True, f"Vehicle ID {v.get('id', 'unknown')}"

        # Check static obstacles
        for obs in self.obstacles:
            dx = abs(obs["x"] - self.ego_x)
            dy = abs(obs["y"] - self.ego_y)
            if dx < (ego_length + obs.get("length", 2.0)) / 2.0 and dy < (ego_width + obs.get("width", 1.5)) / 2.0:
                return True, f"Obstacle at x={obs['x']:.1f}"

        # Check road off-track bounds
        min_y = -self.lane_width * 0.4
        max_y = (self.num_lanes - 1) * self.lane_width + self.lane_width * 0.4
        if self.ego_y < min_y or self.ego_y > max_y:
            return True, "Road Boundary Off-track"

        return False, None

    def _check_near_collisions(self) -> bool:
        """Flag unsafe proximity (< 6.0 meters longitudinal buffer)."""
        for v in self.traffic_vehicles:
            if abs(v["y"] - self.ego_y) < (self.lane_width * 0.5):
                gap = v["x"] - self.ego_x
                if 0 < gap < 6.0:
                    return True
        return False

    def _check_red_light_violations(self) -> bool:
        """Detect if ego ran a red light crossing the stopline."""
        for light in self.traffic_lights:
            if light["state"] == "red":
                # If vehicle crosses stopline within this time step
                prev_x = self.ego_x - (self.ego_speed * self.delta_t)
                if prev_x < light["x"] <= self.ego_x:
                    return True
        return False

    def _compute_reward(
        self,
        action: ActionType,
        collision: bool,
        near_collision: bool,
        red_light_violation: bool,
        destination_reached: bool,
    ) -> Tuple[float, Dict[str, float]]:
        """Multi-objective reward calculation preventing reward hacking."""
        weights = self.config.get("reward_weights", {})
        w_prog = weights.get("forward_progress", 1.0)
        w_lane = weights.get("lane_center_keeping", 0.5)
        w_dist = weights.get("safe_distance", 0.8)
        w_speed = weights.get("speed_compliance", 0.4)
        w_smooth = weights.get("smooth_driving", 0.2)

        # 1. Forward progress reward (normalized speed towards target)
        speed_ratio = self.ego_speed / max(self.speed_limit, 1.0)
        r_prog = w_prog * speed_ratio

        # 2. Lane keeping reward (penalize distance from lane center)
        nearest_lane_idx = int(round(self.ego_y / self.lane_width))
        dev = abs(self.ego_y - nearest_lane_idx * self.lane_width)
        r_lane = -w_lane * (dev / (self.lane_width / 2.0))

        # 3. Safe headway buffer
        lead_dist, _ = self._get_lead_vehicle_info()
        safe_gap = 18.0
        r_dist = 0.0
        if lead_dist < safe_gap:
            # Exponential penalty when closer than safe headway
            r_dist = -w_dist * np.exp((safe_gap - lead_dist) / 6.0)

        # 4. Speed limit compliance (penalize speeding over limit or idling needlessly)
        r_speed = 0.0
        if self.ego_speed > self.speed_limit:
            r_speed = -w_speed * (self.ego_speed - self.speed_limit)
        elif self.ego_speed < 5.0 and lead_dist > 30.0:
            r_speed = -0.5  # Penalize stalling on empty highway

        # 5. Smooth action penalty (penalize jerk and unnecessary lane shifting)
        r_smooth = -w_smooth * (abs(self.ego_accel) / abs(EMERGENCY_BRAKE))

        # Terminal & Critical Infractions
        r_coll = -100.0 if collision else 0.0
        r_signal = -40.0 if red_light_violation else 0.0
        r_goal = 50.0 if destination_reached else 0.0
        if near_collision:
            r_dist -= 10.0

        total_r = float(r_prog + r_lane + r_dist + r_speed + r_smooth + r_coll + r_signal + r_goal)

        components = {
            "progress": float(r_prog),
            "lane_keeping": float(r_lane),
            "safe_headway": float(r_dist),
            "speed_limit": float(r_speed),
            "collision_penalty": float(r_coll),
            "signal_penalty": float(r_signal),
            "action_smoothness": float(r_smooth),
            "goal_reward": float(r_goal),
        }

        return total_r, components

    def _update_environment_dynamics(self):
        """Advance traffic vehicles, cycle traffic signals, and maintain environment physics."""
        # 1. Update Traffic Vehicles
        for v in self.traffic_vehicles:
            v["x"] += v["speed"] * self.delta_t

            # Stochastic speed variation for realism
            if np.random.rand() < 0.05:
                v["speed"] += np.random.uniform(-0.5, 0.5)
                v["speed"] = float(np.clip(v["speed"], 10.0, 30.0))

        # 2. Cycle Traffic Lights
        for light in self.traffic_lights:
            light["timer"] -= self.delta_t
            if light["timer"] <= 0.0:
                if light["state"] == "green":
                    light["state"] = "yellow"
                    light["timer"] = 3.0  # 3 seconds yellow
                elif light["state"] == "yellow":
                    light["state"] = "red"
                    light["timer"] = 6.0  # 6 seconds red
                elif light["state"] == "red":
                    light["state"] = "green"
                    light["timer"] = 12.0 # 12 seconds green

    def _setup_scenario(self, scenario: str):
        """Configure scenario-specific vehicles, obstacles, and traffic lights."""
        self.traffic_vehicles.clear()
        self.obstacles.clear()
        self.traffic_lights.clear()

        if scenario == "clear_road":
            # No obstacles or blocking vehicles
            pass

        elif scenario == "slow_vehicle_ahead":
            # Single slow truck in ego's starting lane
            self.traffic_vehicles.append({
                "id": "slow_truck",
                "x": 60.0,
                "y": self.ego_y,
                "speed": 10.0,
                "length": 6.0,
                "width": 2.2,
                "type": "truck",
            })

        elif scenario == "sudden_obstacle":
            # Road hazard at 75 meters requiring lane change
            self.obstacles.append({
                "id": "hazard_1",
                "x": 80.0,
                "y": self.ego_y,
                "length": 2.0,
                "width": 1.5,
                "type": "debris",
            })

        elif scenario == "red_traffic_signal":
            # Traffic light at 150 meters set to red
            self.traffic_lights.append({
                "id": "tl_1",
                "x": 150.0,
                "state": "red",
                "timer": 8.0,
            })

        elif scenario == "yellow_traffic_signal":
            # Traffic light at 60 meters set to yellow
            self.traffic_lights.append({
                "id": "tl_1",
                "x": 60.0,
                "state": "yellow",
                "timer": 2.5,
            })

        elif scenario == "heavy_traffic":
            # Multiple vehicles across all 3 lanes
            for lane_i in range(self.num_lanes):
                for dist in [45.0, 95.0, 160.0, 240.0]:
                    v_speed = 14.0 + (lane_i * 3.0) + np.random.uniform(-1.5, 1.5)
                    self.traffic_vehicles.append({
                        "id": f"veh_l{lane_i}_{int(dist)}",
                        "x": dist + np.random.uniform(-5.0, 5.0),
                        "y": lane_i * self.lane_width,
                        "speed": float(v_speed),
                        "length": 4.5,
                        "width": 1.9,
                        "type": "car",
                    })

        elif scenario == "vehicle_suddenly_brakes":
            # Lead car that starts with high deceleration
            self.traffic_vehicles.append({
                "id": "lead_braker",
                "x": 40.0,
                "y": self.ego_y,
                "speed": 12.0,
                "length": 4.5,
                "width": 1.9,
                "type": "car",
            })

        else:
            # Default mixed traffic
            for lane_i in range(self.num_lanes):
                spacing = 70.0 + np.random.uniform(0.0, 20.0)
                for i in range(4):
                    self.traffic_vehicles.append({
                        "id": f"car_{lane_i}_{i}",
                        "x": 50.0 + (i * spacing),
                        "y": lane_i * self.lane_width,
                        "speed": 16.0 + np.random.uniform(-2.0, 4.0),
                        "length": 4.5,
                        "width": 1.9,
                        "type": "car",
                    })

            # One traffic signal at 400 meters
            self.traffic_lights.append({
                "id": "tl_mid",
                "x": 400.0,
                "state": "green",
                "timer": 15.0,
            })

    def _get_info(self) -> Dict[str, Any]:
        """Telemetry diagnostics dictionary for UI streaming and analytics."""
        return {
            "step": self.step_count,
            "ego_x": round(self.ego_x, 2),
            "ego_y": round(self.ego_y, 2),
            "ego_speed": round(self.ego_speed, 2),
            "ego_accel": round(self.ego_accel, 2),
            "current_lane": self.current_lane,
            "target_lane": self.target_lane,
            "is_changing_lane": self.is_changing_lane,
            "collision": self.collision_occurred,
            "destination_reached": self.destination_reached,
            "total_reward": round(self.total_reward, 3),
            "near_collisions": self.near_collision_count,
            "red_light_violations": self.red_light_violations,
            "emergency_brakes": self.emergency_brake_count,
            "traffic_vehicles": [
                {
                    "id": v["id"],
                    "x": round(v["x"], 2),
                    "y": round(v["y"], 2),
                    "speed": round(v["speed"], 2),
                    "type": v.get("type", "car"),
                }
                for v in self.traffic_vehicles
                if abs(v["x"] - self.ego_x) <= self.sensor_range
            ],
            "obstacles": [
                {
                    "id": o["id"],
                    "x": round(o["x"], 2),
                    "y": round(o["y"], 2),
                    "type": o.get("type", "debris"),
                }
                for o in self.obstacles
                if abs(o["x"] - self.ego_x) <= self.sensor_range
            ],
            "traffic_lights": [
                {
                    "id": l["id"],
                    "x": round(l["x"], 2),
                    "state": l["state"],
                    "timer": round(l["timer"], 1),
                }
                for l in self.traffic_lights
                if abs(l["x"] - self.ego_x) <= self.sensor_range
            ],
        }
