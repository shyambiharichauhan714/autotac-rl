import {
  ActionType,
  AgentType,
  Obstacle,
  ScenarioConfig,
  TelemetryFrame,
  TrafficLight,
  Vehicle,
} from '../types/simulation';
import { SCENARIOS } from './scenarios';
import {
  calculateIdmAcceleration,
  calculateReward,
  checkCollision,
  computeObservationVector,
  findSurroundingVehicles,
  getLaneCenterY,
  LANE_CHANGE_DURATION,
  LANE_WIDTH,
  NUM_LANES,
  observationToArray,
  SENSOR_RANGE,
} from './physics';
import { PPOPolicyAgent, randomTacticalDecision, ruleBasedTacticalDecision } from './neuralNet';

export class SimulationEngine {
  scenario: ScenarioConfig;
  agentType: AgentType = 'ppo';
  deterministic = true;
  manualOverrideAction: ActionType | null = null;

  stepCount = 0;
  simTime = 0.0;
  dt = 0.1; // 100ms simulation step
  isCompleted = false;
  hasCollided = false;
  destinationReached = false;
  cumulativeReward = 0.0;

  ego: Vehicle;
  traffic: Vehicle[] = [];
  obstacles: Obstacle[] = [];
  trafficLight?: TrafficLight;

  ppoAgent: PPOPolicyAgent;
  latestFrame: TelemetryFrame | null = null;
  history: TelemetryFrame[] = [];

  constructor(scenarioId = 'highway_cruise') {
    this.scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
    this.ppoAgent = new PPOPolicyAgent();
    this.ego = this._createEgoVehicle();
    this.reset(scenarioId);
  }

  private _createEgoVehicle(): Vehicle {
    return {
      id: 'ego',
      x: 0,
      y: getLaneCenterY(1), // start in center lane (Lane 1)
      speed: this.scenario.initialEgoSpeed,
      targetSpeed: this.scenario.speedLimit,
      acceleration: 0,
      length: 4.8,
      width: 1.9,
      lane: 1,
      targetLane: 1,
      isChangingLane: false,
      laneChangeProgress: 0,
      laneChangeDirection: 0,
      color: '#06b6d4', // Cyan accent
      type: 'ego',
      blinker: 'none',
    };
  }

  reset(scenarioId?: string) {
    if (scenarioId) {
      this.scenario = SCENARIOS.find((s) => s.id === scenarioId) || this.scenario;
    }

    this.stepCount = 0;
    this.simTime = 0.0;
    this.isCompleted = false;
    this.hasCollided = false;
    this.destinationReached = false;
    this.cumulativeReward = 0.0;
    this.manualOverrideAction = null;
    this.history = [];

    this.ego = this._createEgoVehicle();
    this.obstacles = [];
    this.trafficLight = undefined;

    // Spawn obstacles if configured
    if (this.scenario.hasObstacles || this.scenario.specialEvent === 'obstacle_block') {
      this.obstacles.push({
        id: 'obs-stalled-truck',
        x: 180,
        lane: 1, // center lane blocked!
        length: 8.5,
        width: 2.4,
        type: 'stalled_vehicle',
        color: '#f59e0b',
      });
      this.obstacles.push({
        id: 'obs-cones',
        x: 165,
        lane: 1,
        length: 2.0,
        width: 1.2,
        type: 'cone',
        color: '#ef4444',
      });
    }

    // Spawn traffic light if configured
    if (this.scenario.hasTrafficLights) {
      this.trafficLight = {
        id: 'signal-1',
        x: 320,
        state: 'green',
        timer: 0,
        cycleDuration: 18,
      };
    }

    // Spawn surrounding traffic
    this.traffic = this._generateInitialTraffic();

    // Compute initial telemetry frame
    this.latestFrame = this._generateFrame(ActionType.MAINTAIN_SPEED, [0.7, 0.1, 0.1, 0.05, 0.05, 0.0], 1.5);
    this.history.push(this.latestFrame);
    return this.latestFrame;
  }

  private _generateInitialTraffic(): Vehicle[] {
    const traffic: Vehicle[] = [];
    const colors = ['#94a3b8', '#64748b', '#cbd5e1', '#38bdf8', '#34d399', '#fbbf24'];
    let idCounter = 1;

    // Spawn lead vehicle in ego's lane
    if (this.scenario.specialEvent === 'cut_in') {
      // Vehicle in Lane 0 that will cut in later
      traffic.push({
        id: `traffic-cutin`,
        x: 45,
        y: getLaneCenterY(0),
        speed: 26.0,
        targetSpeed: 26.0,
        acceleration: 0,
        length: 4.6,
        width: 1.9,
        lane: 0,
        targetLane: 0,
        isChangingLane: false,
        laneChangeProgress: 0,
        laneChangeDirection: 0,
        color: '#ef4444', // Red aggressive vehicle
        type: 'sport',
        blinker: 'none',
      });
    } else {
      // Normal lead in lane 1
      traffic.push({
        id: `traffic-${idCounter++}`,
        x: 55,
        y: getLaneCenterY(1),
        speed: Math.max(16, this.scenario.speedLimit - 5),
        targetSpeed: this.scenario.speedLimit - 4,
        acceleration: 0,
        length: 4.8,
        width: 1.9,
        lane: 1,
        targetLane: 1,
        isChangingLane: false,
        laneChangeProgress: 0,
        laneChangeDirection: 0,
        color: colors[0],
        type: 'car',
        blinker: 'none',
      });
    }

    // Generate traffic in all 3 lanes along the road
    const positionsByLane: number[][] = [[], [], []];
    positionsByLane[1].push(55);
    if (this.scenario.specialEvent === 'cut_in') {
      positionsByLane[0].push(45);
    }

    const laneSpeeds = [
      this.scenario.speedLimit * 1.05, // Left lane (Fast)
      this.scenario.speedLimit * 0.9, // Center lane (Cruising)
      this.scenario.speedLimit * 0.75, // Right lane (Heavy trucks)
    ];

    const numVehicles = Math.min(25, Math.floor((this.scenario.roadLength / 1000) * this.scenario.spawnDensity));

    for (let i = 0; i < numVehicles; i++) {
      const lane = i % NUM_LANES;
      // Find candidate x
      let candidateX = 30 + Math.random() * (this.scenario.roadLength * 0.75);

      // Avoid spawning on top of ego or existing vehicle in same lane
      const minSpacing = 28;
      const isTooClose = positionsByLane[lane].some((pos) => Math.abs(pos - candidateX) < minSpacing);
      if (Math.abs(candidateX - this.ego.x) < 20 || isTooClose) {
        candidateX += 35;
      }

      positionsByLane[lane].push(candidateX);

      const isTruck = lane === 2 && Math.random() > 0.4;
      const length = isTruck ? 11.5 : 4.8;
      const width = isTruck ? 2.4 : 1.9;
      const spd = laneSpeeds[lane] + (Math.random() * 4 - 2);

      traffic.push({
        id: `traffic-${idCounter++}`,
        x: candidateX,
        y: getLaneCenterY(lane),
        speed: Math.max(12, spd),
        targetSpeed: laneSpeeds[lane],
        acceleration: 0,
        length,
        width,
        lane,
        targetLane: lane,
        isChangingLane: false,
        laneChangeProgress: 0,
        laneChangeDirection: 0,
        color: isTruck ? '#e2e8f0' : colors[i % colors.length],
        type: isTruck ? 'truck' : 'car',
        blinker: 'none',
      });
    }

    // Sort by longitudinal coordinate x
    return traffic.sort((a, b) => a.x - b.x);
  }

  step(): TelemetryFrame {
    if (this.isCompleted) {
      return this.latestFrame!;
    }

    this.stepCount++;
    this.simTime += this.dt;

    // 1. Update Traffic Lights if present
    if (this.trafficLight) {
      this.trafficLight.timer += this.dt;
      const cycle = this.trafficLight.timer % this.trafficLight.cycleDuration;
      if (cycle < 10) {
        this.trafficLight.state = 'green';
      } else if (cycle < 13) {
        this.trafficLight.state = 'yellow';
      } else {
        this.trafficLight.state = 'red';
      }
    }

    // 2. Scenario specific special events
    this._handleSpecialEvents();

    // 3. Find Ego surroundings
    const surroundings = findSurroundingVehicles(this.ego, this.traffic, this.obstacles);

    // 4. Compute Observation vector (12 normalized dimensions)
    const obs = computeObservationVector(this.ego, surroundings, this.scenario.speedLimit);
    const obsArray = observationToArray(obs);

    // 5. Select Action
    let action: ActionType;
    let probs: number[] = [0, 0, 0, 0, 0, 0];
    let value = 0.0;

    if (this.manualOverrideAction !== null) {
      action = this.manualOverrideAction;
      probs[action] = 1.0;
      value = 1.0;
      this.manualOverrideAction = null; // Clear override after one step
    } else if (this.agentType === 'random') {
      const res = randomTacticalDecision();
      action = res.action;
      probs = res.probabilities;
      value = res.value;
    } else if (this.agentType === 'rule_based') {
      const res = ruleBasedTacticalDecision(this.ego, obs, this.scenario.speedLimit);
      action = res.action;
      probs = res.probabilities;
      value = res.value;
    } else {
      // PPO Policy
      const res = this.ppoAgent.forward(obsArray);
      probs = res.actionProbabilities;
      value = res.valueEstimate;
      action = this.ppoAgent.sampleAction(probs, this.deterministic);
    }

    // 6. Apply Action to Ego Vehicle Dynamics
    this._applyEgoAction(action);

    // 7. Update Traffic Vehicle Physics (IDM car following)
    this._updateTrafficPhysics();

    // 8. Collision detection
    const collRes = checkCollision(this.ego, this.traffic, this.obstacles);
    if (collRes.collided) {
      this.hasCollided = true;
      this.isCompleted = true;
    }

    // 9. Check Destination
    if (this.ego.x >= this.scenario.roadLength) {
      this.destinationReached = true;
      this.isCompleted = true;
    }

    // 10. Generate Frame and Compute Rewards
    const frame = this._generateFrame(action, probs, value, surroundings, collRes.targetId);
    this.latestFrame = frame;
    this.history.push(frame);
    if (this.history.length > 500) {
      this.history.shift();
    }

    return frame;
  }

  private _applyEgoAction(action: ActionType) {
    const prevAccel = this.ego.acceleration;
    let targetAccel = 0;

    switch (action) {
      case ActionType.MAINTAIN_SPEED:
        targetAccel = 0;
        break;
      case ActionType.ACCELERATE:
        targetAccel = 1.6;
        break;
      case ActionType.DECELERATE:
        targetAccel = -2.2;
        break;
      case ActionType.EMERGENCY_BRAKE:
        targetAccel = -8.0;
        break;
      case ActionType.LANE_CHANGE_LEFT:
        if (this.ego.lane > 0 && !this.ego.isChangingLane) {
          this.ego.isChangingLane = true;
          this.ego.targetLane = this.ego.lane - 1;
          this.ego.laneChangeProgress = 0;
          this.ego.laneChangeDirection = -1;
          this.ego.blinker = 'left';
        }
        targetAccel = 0.2;
        break;
      case ActionType.LANE_CHANGE_RIGHT:
        if (this.ego.lane < NUM_LANES - 1 && !this.ego.isChangingLane) {
          this.ego.isChangingLane = true;
          this.ego.targetLane = this.ego.lane + 1;
          this.ego.laneChangeProgress = 0;
          this.ego.laneChangeDirection = 1;
          this.ego.blinker = 'right';
        }
        targetAccel = 0.2;
        break;
    }

    // Low-pass actuator filter for realistic vehicle inertia
    this.ego.acceleration += (targetAccel - this.ego.acceleration) * 0.45;
    this.ego.speed = Math.max(0, this.ego.speed + this.ego.acceleration * this.dt);
    this.ego.x += this.ego.speed * this.dt;

    // Handle Lateral Lane Change Transition (Cubic ease in-out)
    if (this.ego.isChangingLane) {
      this.ego.laneChangeProgress += this.dt / LANE_CHANGE_DURATION;
      if (this.ego.laneChangeProgress >= 1.0) {
        this.ego.lane = this.ego.targetLane;
        this.ego.isChangingLane = false;
        this.ego.laneChangeProgress = 0;
        this.ego.laneChangeDirection = 0;
        this.ego.blinker = 'none';
        this.ego.y = getLaneCenterY(this.ego.lane);
      } else {
        // Smooth Hermite / sinusoidal transition
        const t = this.ego.laneChangeProgress;
        const smoothT = t * t * (3 - 2 * t);
        const startY = getLaneCenterY(this.ego.lane);
        const endY = getLaneCenterY(this.ego.targetLane);
        this.ego.y = startY + (endY - startY) * smoothT;
      }
    } else {
      this.ego.y = getLaneCenterY(this.ego.lane);
    }
  }

  private _updateTrafficPhysics() {
    for (const v of this.traffic) {
      // Find lead vehicle ahead of this traffic car
      const surroundings = findSurroundingVehicles(v, [this.ego, ...this.traffic], this.obstacles);
      let targetDesiredSpeed = v.targetSpeed;

      // Handle Traffic light stop
      if (this.trafficLight && this.trafficLight.state === 'red') {
        const distToLight = this.trafficLight.x - v.x;
        if (distToLight > 0 && distToLight < 45) {
          targetDesiredSpeed = 0;
        }
      }

      const idmAccel = calculateIdmAcceleration(
        v.speed,
        targetDesiredSpeed,
        surroundings.leadDistance,
        surroundings.lead?.speed ?? null
      );

      v.acceleration = idmAccel;
      v.speed = Math.max(0, v.speed + v.acceleration * this.dt);
      v.x += v.speed * this.dt;

      // Traffic lane change interpolation if changing
      if (v.isChangingLane) {
        v.laneChangeProgress += this.dt / 1.5;
        if (v.laneChangeProgress >= 1.0) {
          v.lane = v.targetLane;
          v.isChangingLane = false;
          v.blinker = 'none';
          v.y = getLaneCenterY(v.lane);
        } else {
          const t = v.laneChangeProgress;
          const smoothT = t * t * (3 - 2 * t);
          const startY = getLaneCenterY(v.lane);
          const endY = getLaneCenterY(v.targetLane);
          v.y = startY + (endY - startY) * smoothT;
        }
      }
    }
  }

  private _handleSpecialEvents() {
    // 1. Cut-in scenario: aggressive cut-in when ego gets close
    if (this.scenario.specialEvent === 'cut_in') {
      const cutinCar = this.traffic.find((v) => v.id === 'traffic-cutin');
      if (cutinCar && !cutinCar.isChangingLane && cutinCar.lane === 0) {
        const dx = cutinCar.x - this.ego.x;
        if (dx > 8 && dx < 28) {
          // Execute cut into ego's lane (Lane 1) and brake hard
          cutinCar.isChangingLane = true;
          cutinCar.targetLane = 1;
          cutinCar.laneChangeDirection = 1;
          cutinCar.blinker = 'right';
          cutinCar.targetSpeed = 12.0;
        }
      }
    }

    // 2. Stop and go shockwave: periodic braking wave
    if (this.scenario.specialEvent === 'stop_and_go') {
      const phase = Math.sin(this.simTime * 0.5);
      for (let i = 0; i < this.traffic.length; i++) {
        if (i % 3 === 0) {
          this.traffic[i].targetSpeed = phase > 0.2 ? 8.0 : 22.0;
        }
      }
    }
  }

  private _generateFrame(
    action: ActionType,
    probs: number[],
    value: number,
    surroundings?: ReturnType<typeof findSurroundingVehicles>,
    collisionTarget?: string
  ): TelemetryFrame {
    const surr = surroundings ?? findSurroundingVehicles(this.ego, this.traffic, this.obstacles);
    const obs = computeObservationVector(this.ego, surr, this.scenario.speedLimit);
    const obsArray = observationToArray(obs);

    const leadDist = surr.leadDistance;
    let ttc: number | null = null;
    if (leadDist !== null && surr.lead) {
      const relSpeed = this.ego.speed - surr.lead.speed;
      if (relSpeed > 0.1) {
        ttc = Number((leadDist / relSpeed).toFixed(2));
      }
    }

    const jerk = Math.abs(this.ego.acceleration);
    const rewards = calculateReward(
      this.ego,
      this.scenario.speedLimit,
      leadDist,
      this.ego.isChangingLane,
      jerk,
      this.hasCollided,
      this.destinationReached
    );

    this.cumulativeReward += rewards.total;

    return {
      step: this.stepCount,
      time: Number(this.simTime.toFixed(2)),
      ego: { ...this.ego },
      traffic: this.traffic.map((v) => ({ ...v })),
      obstacles: [...this.obstacles],
      trafficLight: this.trafficLight ? { ...this.trafficLight } : undefined,
      observation: obs,
      observationArray: obsArray,
      action,
      actionProbabilities: probs,
      valueEstimate: value,
      rewardBreakdown: rewards,
      cumulativeReward: Number(this.cumulativeReward.toFixed(2)),
      distanceToLead: leadDist ? Number(leadDist.toFixed(1)) : null,
      timeToCollision: ttc,
      collision: this.hasCollided,
      collisionTarget,
      destinationReached: this.destinationReached,
      comfortJerk: Number(jerk.toFixed(2)),
      speedLimit: this.scenario.speedLimit,
    };
  }
}
