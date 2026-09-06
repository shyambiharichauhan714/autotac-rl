# Deep Reinforcement Learning for Autonomous Vehicle Decision Making

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.1+-ee4c2c.svg)](https://pytorch.org/)
[![Stable-Baselines3](https://img.shields.io/badge/SB3-2.2+-brightgreen.svg)](https://stable-baselines3.readthedocs.io/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An end-to-end autonomous driving decision-making system where a simulated ego vehicle learns safe, efficient, and law-compliant driving policies using Deep Reinforcement Learning (Proximal Policy Optimization - PPO).

---

## 1. Abstract
Autonomous vehicle (AV) decision making in dynamic multi-lane traffic requires navigating non-linear interactions with surrounding vehicles, obstacles, lane geometries, and traffic light signals. Traditional rule-based state machines often suffer from fragility in edge-case situations. This project investigates Deep Reinforcement Learning (DRL)—specifically Proximal Policy Optimization (PPO)—to learn continuous tactical decision policies. An academic-grade, lightweight Gymnasium simulation environment models high-fidelity kinematics, multi-agent traffic dynamics, stochastic obstacle generation, and traffic signals. The framework integrates a FastAPI REST service, SQLite experiment logging, and a modern interactive analytics and live-telemetry dashboard.

---

## 2. Problem Statement
Tactical decision making for autonomous vehicles occupies the crucial layer between global route planning and low-level actuation:
1. **Safety vs. Progress Tradeoff**: The vehicle must maintain progress without incurring collision risks or dangerous headway.
2. **Multi-Agent Stochasticity**: Surrounding traffic exhibits diverse driving behaviors (slow drivers, aggressive overtakes, sudden braking).
3. **Discrete vs. Continuous Control**: Discretized tactical decisions (maintain, accelerate, brake, emergency brake, lane changes) must remain kinematically feasible and comfortable for passengers.
4. **Reward Design Challenges**: Sparse collision penalties often cause reward hacking or hyper-cautious behaviors (e.g., freezing or refusing to drive).

---

## 3. Project Objectives
- **Custom Gymnasium Environment**: Build an accessible, reproducible multi-lane simulation modeling realistic physics, surrounding traffic, traffic signals, and obstacles.
- **Formulated State & Action Spaces**: Define a 12-dimensional normalized observation vector capturing dynamic ego state, spatial-temporal headway, and environmental cues.
- **Engineered Multi-Objective Reward Function**: Implement modular reward components penalizing collisions, headway violations, red lights, and excessive jerk while rewarding efficiency and lane keeping.
- **PPO Policy Learning**: Train actor-critic architectures using Stable-Baselines3 with Generalized Advantage Estimation (GAE) and clipped surrogate objectives.
- **Scientific Benchmarking**: Rigorously compare PPO against Random and Rule-Based baseline policies across standardized safety scenarios.
- **Full-Stack Visualization**: Expose REST APIs for live simulation streaming, asynchronous training execution, model versioning, and telemetry analytics.

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Next.js / React Dashboard                │
│  (Live Road Telemetry, Training Monitor, Analytics, Scenarios)│
└───────────────────────────────┬──────────────────────────────┘
                                │ HTTP / JSON / SSE
┌───────────────────────────────▼──────────────────────────────┐
│                      FastAPI Backend Server                  │
│       (Training Control, Simulation Runner, Analytics APIs)   │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
┌───────────────▼──────────────┐ ┌──────────────▼──────────────┐
│       SQLite Database        │ │      Model Repository       │
│  (Runs, Metrics, Evaluation) │ │      (ai/saved_models/)     │
└──────────────────────────────┘ └─────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│                  AI & Simulation Subsystem                   │
│                                                              │
│  ┌──────────────────────┐        ┌────────────────────────┐  │
│  │   PPO Policy Agent   ├───────►│  Action: {0..5}        │  │
│  └──────────▲───────────┘        └───────────┬────────────┘  │
│             │ Observation                    │               │
│  ┌──────────┴───────────┐        ┌───────────▼────────────┐  │
│  │  Gymnasium AV Env    │◄───────┤  Vehicle & Traffic Sim │  │
│  └──────────┬───────────┘        └────────────────────────┘  │
│             │                                                │
│  ┌──────────▼───────────┐                                    │
│  │   Reward Function    │                                    │
│  └──────────────────────┘                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Technology Stack
- **AI & Reinforcement Learning**: Python 3.10+, PyTorch, Stable-Baselines3, Gymnasium, NumPy, Pandas, Matplotlib
- **Backend & Persistence**: FastAPI, Uvicorn, SQLAlchemy, SQLite, Pydantic
- **Frontend & Visualization**: React / Next.js, TypeScript, Tailwind CSS, Motion, Recharts, Lucide Icons
- **Testing & Verification**: PyTest, Requests, Logging

---

## 6. Directory Structure

```
autonomous-vehicle-drl/
├── backend/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entrypoint
│   ├── config.py                # Hyperparameters, paths, simulation settings
│   ├── api/                     # REST API routers (training, simulation, analytics)
│   ├── schemas/                 # Pydantic data schemas
│   ├── services/                # Business logic & simulation controllers
│   └── database/                # SQLAlchemy models & database session
│
├── ai/
│   ├── __init__.py
│   ├── environment/             # Custom Gymnasium AV environment
│   ├── agents/                  # PPO agent wrapper & baseline policies
│   ├── training/                # Training loops, callbacks, checkpointing
│   ├── evaluation/              # Statistical evaluation pipeline
│   ├── rewards/                 # Multi-component reward formulations
│   └── saved_models/            # Checkpoints (.zip) and metadata (.json)
│
├── simulation/
│   ├── __init__.py
│   ├── road.py                  # Multi-lane geometry and boundaries
│   ├── vehicle.py               # Ego and dynamic kinematic models
│   ├── traffic.py               # Surrounding vehicle behavior & spawning
│   ├── obstacles.py             # Road hazards & debris
│   └── traffic_lights.py        # Signal cycle state machine
│
├── data/
│   ├── training/                # Logged metrics (CSV / JSON)
│   └── evaluation/              # Baseline comparison results
│
├── tests/
│   ├── test_env.py              # Environment step/reset tests
│   ├── test_simulation.py       # Kinematics and collision detection
│   ├── test_rewards.py          # Reward weighting unit tests
│   ├── test_agent.py            # PPO inference & action execution
│   └── test_api.py              # FastAPI endpoint integration tests
│
├── scripts/
│   ├── train.py                 # CLI training script
│   ├── evaluate.py              # CLI evaluation & baseline benchmark
│   └── run_backend.py           # Backend server launch script
│
├── requirements.txt             # Python dependencies
├── pyproject.toml               # Package build metadata
└── README.md                    # Project documentation
```

---

## 7. State, Action, and Reward Formulation

### 7.1 State Space (12-D Normalized Vector)
| Index | Feature | Description | Range |
|---|---|---|---|
| $s_0$ | Ego Speed | Longitudinal velocity normalized by $v_{\max}$ | $[0, 1]$ |
| $s_1$ | Ego Acceleration | Rate of velocity change normalized by $a_{\max}$ | $[-1, 1]$ |
| $s_2$ | Current Lane | Current lane index normalized by $N_{\text{lanes}}-1$ | $[0, 1]$ |
| $s_3$ | Distance Vehicle Ahead | Net gap to lead vehicle in same lane | $[0, 1]$ |
| $s_4$ | Relative Speed Ahead | $(v_{\text{lead}} - v_{\text{ego}}) / v_{\max}$ | $[-1, 1]$ |
| $s_5$ | Distance Left Vehicle | Net gap to closest vehicle in left lane | $[0, 1]$ |
| $s_6$ | Distance Right Vehicle| Net gap to closest vehicle in right lane | $[0, 1]$ |
| $s_7$ | Traffic Signal State | Green (1.0), Yellow (0.5), Red (0.0), None (-1.0)| $[-1, 1]$ |
| $s_8$ | Signal Distance | Distance to upcoming signal stopline | $[0, 1]$ |
| $s_9$ | Distance to Obstacle | Distance to static road hazard in lane | $[0, 1]$ |
| $s_{10}$| Lane Lateral Offset | Lateral displacement from target lane center | $[-1, 1]$ |
| $s_{11}$| Distance to Goal | Remaining distance to route finish line | $[0, 1]$ |

### 7.2 Action Space (Discrete 6 Actions)
- `0`: **Maintain Speed** ($\Delta a = 0$)
- `1`: **Accelerate** ($a = +2.5\text{ m/s}^2$)
- `2`: **Brake** ($a = -3.5\text{ m/s}^2$)
- `3`: **Change Lane Left** (Execute lateral translation to left lane)
- `4`: **Change Lane Right** (Execute lateral translation to right lane)
- `5`: **Emergency Brake** ($a = -8.0\text{ m/s}^2$)

### 7.3 Reward Function
$$R_t = w_{\text{prog}} R_{\text{prog}} + w_{\text{lane}} R_{\text{lane}} + w_{\text{dist}} R_{\text{dist}} + w_{\text{speed}} R_{\text{speed}} + R_{\text{terminal}}$$
Where:
- $R_{\text{prog}} = v_{\text{ego}} / v_{\text{target}}$ (encourages forward progress)
- $R_{\text{lane}} = -\vert d_{\text{center}} \vert$ (penalizes lane deviation)
- $R_{\text{dist}} = -\exp(-d_{\text{lead}} / d_{\text{safe}})$ if $d_{\text{lead}} < d_{\text{safe}}$ (time-to-collision safety buffer)
- $R_{\text{collision}} = -100.0$ (terminal failure penalty)
- $R_{\text{red\_light}} = -40.0$ (stopline infraction penalty)
- $R_{\text{destination}} = +50.0$ (goal achievement reward)

---

## 8. Installation & Virtual Environment Setup

### 8.1 Prerequisites
- Python 3.10 or higher
- Node.js 18+ & npm
- Git

### 8.2 Python Environment Setup
```bash
# 1. Create a virtual environment
python3 -m venv venv

# 2. Activate virtual environment
# On Linux / macOS:
source venv/bin/activate
# On Windows (cmd):
venv\Scripts\activate.bat
# On Windows (PowerShell):
venv\Scripts\Activate.ps1

# 3. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 9. Verification & Execution Instructions

### 9.1 Verification Commands
```bash
# Verify Python environment packages
python3 -c "import gymnasium, stable_baselines3, torch, fastapi; print('Environment dependencies ready!')"

# Run test suite
pytest tests/
```

### 9.2 Running Training
```bash
# Lightweight development run (10,000 timesteps)
python scripts/train.py --timesteps 10000 --experiment dev_run

# Standard experiment (50,000 timesteps)
python scripts/train.py --timesteps 50000 --experiment full_run
```

### 9.3 Running Evaluation & Benchmarks
```bash
# Evaluate against baseline policies across 20 test episodes
python scripts/evaluate.py --model ai/saved_models/latest.zip --episodes 20
```

### 9.4 Starting the FastAPI Backend
```bash
python scripts/run_backend.py --port 8000
```

### 9.5 Starting the Frontend Dashboard
```bash
npm install
npm run dev
```

---

## 10. Development Roadmap (14 Phases)
- [x] **Phase 1**: Project Setup, Architecture & Configuration
- [ ] **Phase 2**: Custom Gymnasium AV Environment
- [ ] **Phase 3**: Kinematic Vehicle & Traffic Simulation
- [ ] **Phase 4**: Multi-Objective Reward Engine
- [ ] **Phase 5**: Stable-Baselines3 PPO Training Pipeline
- [ ] **Phase 6**: Evaluation & Baseline Comparison (PPO vs. Random vs. Rule-Based)
- [ ] **Phase 7**: SQLite Database & SQLAlchemy Persistence
- [ ] **Phase 8**: FastAPI REST Services & Telemetry Streaming
- [ ] **Phase 9**: Modern React / Next.js Dashboard
- [ ] **Phase 10**: Interactive Live Road Simulation Canvas
- [ ] **Phase 11**: Real-Time Analytics & Training Telemetry Charts
- [ ] **Phase 12**: Unit & Integration Test Suites
- [ ] **Phase 13**: Full Academic Dissertation & Technical Documentation
- [ ] **Phase 14**: End-to-End System Verification & Live Viva Demo Flow
