"""
Road Geometry and Multi-Lane Coordinate System
Models straight highway segments, lane markings, boundaries, and lateral coordinate transformations.
"""

from dataclasses import dataclass
from typing import Tuple

@dataclass
class RoadConfig:
    num_lanes: int = 3
    lane_width: float = 4.0        # meters
    road_length: float = 1000.0    # meters
    speed_limit: float = 28.0      # m/s (~100 km/h)
    shoulder_width: float = 2.0    # meters on each side

class Road:
    """Represents a multi-lane roadway environment."""
    def __init__(self, config: RoadConfig = None):
        self.config = config or RoadConfig()
        self.num_lanes = self.config.num_lanes
        self.lane_width = self.config.lane_width
        self.length = self.config.road_length
        self.speed_limit = self.config.speed_limit
        self.total_road_width = self.num_lanes * self.lane_width

    def get_lane_center_y(self, lane_index: int) -> float:
        """Get the lateral y-coordinate (meters) of a given lane's center line."""
        clamped_idx = max(0, min(lane_index, self.num_lanes - 1))
        return clamped_idx * self.lane_width

    def get_lane_index(self, y: float) -> int:
        """Determine the closest lane index from a lateral y-coordinate."""
        idx = int(round(y / self.lane_width))
        return max(0, min(idx, self.num_lanes - 1))

    def get_lane_offset(self, y: float) -> float:
        """Compute lateral displacement from the center of the nearest lane."""
        nearest_center = self.get_lane_center_y(self.get_lane_index(y))
        return y - nearest_center

    def is_within_bounds(self, x: float, y: float) -> bool:
        """Check if a coordinate is within drivable highway boundaries."""
        min_y = -self.lane_width * 0.4
        max_y = (self.num_lanes - 1) * self.lane_width + self.lane_width * 0.4
        return 0.0 <= x <= self.length + 50.0 and min_y <= y <= max_y

    def get_lane_boundaries(self) -> Tuple[float, float]:
        """Returns the lower and upper y-limits of the drivable road."""
        return -self.lane_width * 0.5, (self.num_lanes - 0.5) * self.lane_width
