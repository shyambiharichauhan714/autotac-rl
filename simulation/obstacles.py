"""
Road Obstacles and Stationary Hazards
Models debris, stalled vehicles, and construction barriers.
"""

from dataclasses import dataclass
from typing import Dict, Any, List

@dataclass
class Obstacle:
    id: str
    x: float             # longitudinal position (m)
    y: float             # lateral position (m)
    length: float = 2.0  # meters
    width: float = 1.6   # meters
    obstacle_type: str = "debris"  # "debris", "barrier", "pothole"

    def check_collision(self, vehicle_x: float, vehicle_y: float, v_length: float = 4.8, v_width: float = 2.0) -> bool:
        dx = abs(self.x - vehicle_x)
        dy = abs(self.y - vehicle_y)
        return dx < (self.length + v_length) * 0.48 and dy < (self.width + v_width) * 0.48

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "length": self.length,
            "width": self.width,
            "obstacle_type": self.obstacle_type,
        }

class ObstacleManager:
    """Stores and evaluates stationary road hazards."""
    def __init__(self):
        self.obstacles: List[Obstacle] = []

    def clear(self):
        self.obstacles.clear()

    def add_obstacle(self, obstacle_id: str, x: float, y: float, obstacle_type: str = "debris") -> Obstacle:
        obs = Obstacle(id=obstacle_id, x=x, y=y, obstacle_type=obstacle_type)
        self.obstacles.append(obs)
        return obs

    def check_vehicle_collision(self, v_x: float, v_y: float, v_length: float, v_width: float) -> bool:
        for obs in self.obstacles:
            if obs.check_collision(v_x, v_y, v_length, v_width):
                return True
        return False
