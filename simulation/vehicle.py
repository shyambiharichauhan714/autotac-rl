"""
Vehicle Kinematics and Dynamic State Representation
Models physical dimensions, longitudinal motion, and lateral lane positioning.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional

@dataclass
class VehicleState:
    id: str
    x: float               # longitudinal position (m)
    y: float               # lateral position (m)
    speed: float           # longitudinal velocity (m/s)
    accel: float           # longitudinal acceleration (m/s^2)
    heading: float = 0.0   # yaw angle relative to road axis (rad)
    length: float = 4.8    # vehicle length (m)
    width: float = 2.0     # vehicle width (m)
    current_lane: int = 1
    vehicle_type: str = "car"  # "car", "truck", "ego"

class KinematicVehicle:
    """Kinematic point-mass vehicle model with actuator lag and geometric bounding box."""
    def __init__(
        self,
        vehicle_id: str,
        initial_x: float = 0.0,
        initial_y: float = 4.0,
        initial_speed: float = 20.0,
        length: float = 4.8,
        width: float = 2.0,
        vehicle_type: str = "car",
        max_speed: float = 35.0,
        min_speed: float = 0.0,
    ):
        self.state = VehicleState(
            id=vehicle_id,
            x=initial_x,
            y=initial_y,
            speed=initial_speed,
            accel=0.0,
            length=length,
            width=width,
            vehicle_type=vehicle_type,
        )
        self.max_speed = max_speed
        self.min_speed = min_speed
        self.target_y = initial_y
        self.target_speed = initial_speed

    def update_kinematics(self, target_accel: float, delta_t: float = 0.1, target_y: Optional[float] = None):
        """Update longitudinal velocity, position, and lateral transition."""
        # 1. Acceleration lag
        self.state.accel += (target_accel - self.state.accel) * 0.55
        
        # 2. Longitudinal position update
        self.state.speed = max(self.min_speed, min(self.max_speed, self.state.speed + self.state.accel * delta_t))
        self.state.x += self.state.speed * delta_t

        # 3. Lateral position update
        if target_y is not None:
            self.target_y = target_y

        dy = (self.target_y - self.state.y)
        if abs(dy) > 0.01:
            lateral_speed = 2.5  # m/s max lateral movement
            step_dy = max(-lateral_speed * delta_t, min(lateral_speed * delta_t, dy * 0.25))
            self.state.y += step_dy
        else:
            self.state.y = self.target_y

    def check_collision(self, other: "KinematicVehicle") -> bool:
        """AABB (Axis-Aligned Bounding Box) collision check between vehicles."""
        dx = abs(self.state.x - other.state.x)
        dy = abs(self.state.y - other.state.y)
        min_dx = (self.state.length + other.state.length) * 0.48
        min_dy = (self.state.width + other.state.width) * 0.48
        return dx < min_dx and dy < min_dy

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.state.id,
            "x": round(self.state.x, 2),
            "y": round(self.state.y, 2),
            "speed": round(self.state.speed, 2),
            "accel": round(self.state.accel, 2),
            "length": self.state.length,
            "width": self.state.width,
            "vehicle_type": self.state.vehicle_type,
        }
