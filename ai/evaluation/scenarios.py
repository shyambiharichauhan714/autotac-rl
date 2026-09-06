"""
Evaluation Scenarios Catalog
Defines 10 standardized tactical driving scenarios for reproducible benchmarking.
"""

from typing import Dict, Any, List

EVAL_SCENARIOS: List[Dict[str, Any]] = [
    {
        "id": "clear_road",
        "name": "Highway Free Flow Cruising",
        "category": "Cruising",
        "difficulty": "Easy",
        "description": "Empty 3-lane highway to evaluate longitudinal speed tracking and lane centering.",
        "target_speed": 28.0,
        "max_steps": 400,
    },
    {
        "id": "slow_vehicle_ahead",
        "name": "Slow Lead Truck Overtake",
        "category": "Overtaking",
        "difficulty": "Medium",
        "description": "Slow truck (10 m/s) ahead in ego lane; tests lane-change decision and safe headway.",
        "target_speed": 28.0,
        "max_steps": 450,
    },
    {
        "id": "sudden_obstacle",
        "name": "Sudden Road Hazard Evasion",
        "category": "Emergency",
        "difficulty": "Hard",
        "description": "Stationary road debris at 80m requiring prompt lane shift or braking.",
        "target_speed": 26.0,
        "max_steps": 400,
    },
    {
        "id": "red_traffic_signal",
        "name": "Red Signal Stopline Adherence",
        "category": "Signals",
        "difficulty": "Medium",
        "description": "Traffic light at 150m cycling to red; tests stopping compliance before line.",
        "target_speed": 22.0,
        "max_steps": 400,
    },
    {
        "id": "yellow_traffic_signal",
        "name": "Yellow Signal Decision Zone",
        "category": "Signals",
        "difficulty": "Medium",
        "description": "Traffic light at 60m transitioning to yellow; tests dilemma zone decision making.",
        "target_speed": 22.0,
        "max_steps": 350,
    },
    {
        "id": "heavy_traffic",
        "name": "Dense Multi-Lane Highway Traffic",
        "category": "Dense Traffic",
        "difficulty": "Hard",
        "description": "Surrounded by 12 IDM traffic vehicles across all 3 lanes.",
        "target_speed": 25.0,
        "max_steps": 500,
    },
    {
        "id": "vehicle_suddenly_brakes",
        "name": "Lead Car Emergency Braking",
        "category": "Emergency",
        "difficulty": "Hard",
        "description": "Lead car in front applies sudden deceleration; tests emergency braking response.",
        "target_speed": 25.0,
        "max_steps": 400,
    },
    {
        "id": "boxed_in_traffic",
        "name": "Boxed-In Tight Headway",
        "category": "Dense Traffic",
        "difficulty": "Expert",
        "description": "Adjacent lanes are occupied, forcing ego to decelerate and wait for gap.",
        "target_speed": 24.0,
        "max_steps": 450,
    },
    {
        "id": "lane_bottleneck",
        "name": "Work Zone Lane Closure",
        "category": "Overtaking",
        "difficulty": "Hard",
        "description": "Right lane closed for construction; requires merge into middle/left lane.",
        "target_speed": 24.0,
        "max_steps": 450,
    },
    {
        "id": "emergency_stop",
        "name": "Maximum Deceleration Stop",
        "category": "Emergency",
        "difficulty": "Medium",
        "description": "High-speed highway cruising with immediate stop signal.",
        "target_speed": 30.0,
        "max_steps": 300,
    },
]
