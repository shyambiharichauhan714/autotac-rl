"""
Traffic Signals and Intersection State Machines
Models traffic light signal phases (Green, Yellow, Red) and stopline enforcement.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, List, Tuple

class SignalState(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"

@dataclass
class TrafficLight:
    id: str
    stopline_x: float          # Longitudinal position where vehicle must stop
    state: SignalState = SignalState.GREEN
    timer: float = 12.0        # Seconds remaining in current phase
    green_duration: float = 12.0
    yellow_duration: float = 3.0
    red_duration: float = 6.0

    def step(self, delta_t: float = 0.1):
        """Advance the signal timer and cycle between states."""
        self.timer -= delta_t
        if self.timer <= 0.0:
            if self.state == SignalState.GREEN:
                self.state = SignalState.YELLOW
                self.timer = self.yellow_duration
            elif self.state == SignalState.YELLOW:
                self.state = SignalState.RED
                self.timer = self.red_duration
            elif self.state == SignalState.RED:
                self.state = SignalState.GREEN
                self.timer = self.green_duration

    def check_red_light_crossing(self, prev_x: float, curr_x: float) -> bool:
        """True if the vehicle traversed the stopline while the light was RED."""
        if self.state == SignalState.RED:
            return prev_x < self.stopline_x <= curr_x
        return False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "stopline_x": round(self.stopline_x, 2),
            "state": self.state.value,
            "timer": round(self.timer, 1),
        }

class TrafficLightManager:
    """Manages signals along the roadway."""
    def __init__(self):
        self.lights: List[TrafficLight] = []

    def clear(self):
        self.lights.clear()

    def add_light(
        self,
        light_id: str,
        stopline_x: float,
        initial_state: SignalState = SignalState.GREEN,
        initial_timer: float = 12.0,
    ) -> TrafficLight:
        tl = TrafficLight(id=light_id, stopline_x=stopline_x, state=initial_state, timer=initial_timer)
        self.lights.append(tl)
        return tl

    def step(self, delta_t: float = 0.1):
        for l in self.lights:
            l.step(delta_t)

    def check_violation(self, prev_x: float, curr_x: float) -> bool:
        for l in self.lights:
            if l.check_red_light_crossing(prev_x, curr_x):
                return True
        return False

    def get_upcoming_light(self, curr_x: float) -> Tuple[float, float]:
        """Returns (state_value, distance) for the next light ahead."""
        for l in self.lights:
            dist = l.stopline_x - curr_x
            if dist >= 0.0:
                state_val = 1.0 if l.state == SignalState.GREEN else (0.5 if l.state == SignalState.YELLOW else 0.0)
                return state_val, dist
        return -1.0, 1000.0
