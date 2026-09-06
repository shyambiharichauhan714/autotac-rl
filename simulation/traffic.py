"""
Traffic Flow and Surrounding Vehicle Behavior
Implements the Intelligent Driver Model (IDM) for realistic car-following and lane-keeping behavior.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from simulation.vehicle import KinematicVehicle
from simulation.road import Road

class TrafficManager:
    """Manages surrounding non-ego vehicles with IDM car-following dynamics."""
    def __init__(self, road: Road):
        self.road = road
        self.vehicles: List[KinematicVehicle] = []
        
        # IDM parameters
        self.desired_headway = 1.5      # time headway T (seconds)
        self.min_spacing = 2.5          # minimum distance s0 (meters)
        self.max_accel = 2.0            # comfortable acceleration a (m/s^2)
        self.desired_decel = 3.0        # comfortable deceleration b (m/s^2)
        self.delta = 4.0                # acceleration exponent

    def clear(self):
        self.vehicles.clear()

    def add_vehicle(
        self,
        vehicle_id: str,
        x: float,
        lane_idx: int,
        speed: float,
        vehicle_type: str = "car",
    ) -> KinematicVehicle:
        length = 6.0 if vehicle_type == "truck" else 4.6
        width = 2.2 if vehicle_type == "truck" else 1.9
        y = self.road.get_lane_center_y(lane_idx)
        v = KinematicVehicle(
            vehicle_id=vehicle_id,
            initial_x=x,
            initial_y=y,
            initial_speed=speed,
            length=length,
            width=width,
            vehicle_type=vehicle_type,
        )
        self.vehicles.append(v)
        return v

    def step(self, delta_t: float = 0.1, ego_vehicle: Optional[KinematicVehicle] = None):
        """Update each vehicle using IDM acceleration against lead vehicles."""
        # Consider all participants (traffic + ego if present)
        all_participants = list(self.vehicles)
        if ego_vehicle:
            all_participants.append(ego_vehicle)

        for v in self.vehicles:
            lane_idx = self.road.get_lane_index(v.state.y)
            # Find closest vehicle ahead in the same lane
            lead_v = None
            min_dist = float("inf")
            for other in all_participants:
                if other.state.id == v.state.id:
                    continue
                # Check same lane
                if abs(other.state.y - v.state.y) < (self.road.lane_width * 0.6):
                    dist = other.state.x - v.state.x
                    if 0 < dist < min_dist:
                        min_dist = dist
                        lead_v = other

            # Compute IDM acceleration
            accel = self._compute_idm_accel(v, lead_v, min_dist)
            v.update_kinematics(target_accel=accel, delta_t=delta_t)

    def _compute_idm_accel(
        self,
        vehicle: KinematicVehicle,
        lead: Optional[KinematicVehicle],
        net_distance: float,
    ) -> float:
        v0 = self.road.speed_limit
        v = vehicle.state.speed
        free_road_term = 1.0 - (v / max(v0, 1.0)) ** self.delta

        if lead is None or net_distance > 100.0:
            return self.max_accel * free_road_term

        # Interaction term
        delta_v = v - lead.state.speed
        s_star = self.min_spacing + max(
            0.0, v * self.desired_headway + (v * delta_v) / (2.0 * np.sqrt(self.max_accel * self.desired_decel))
        )
        s = max(0.5, net_distance - lead.state.length)
        interaction_term = (s_star / s) ** 2

        idm_accel = self.max_accel * (free_road_term - interaction_term)
        return float(np.clip(idm_accel, -6.0, self.max_accel))

    def get_vehicles_near(self, x: float, sensor_range: float) -> List[Dict[str, Any]]:
        return [
            v.to_dict()
            for v in self.vehicles
            if abs(v.state.x - x) <= sensor_range
        ]
