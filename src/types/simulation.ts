export enum ActionType {
  MAINTAIN_SPEED = 0,
  ACCELERATE = 1,
  DECELERATE = 2,
  LANE_CHANGE_LEFT = 3,
  LANE_CHANGE_RIGHT = 4,
  EMERGENCY_BRAKE = 5,
}

export const ACTION_NAMES: Record<ActionType, string> = {
  [ActionType.MAINTAIN_SPEED]: 'Maintain Speed',
  [ActionType.ACCELERATE]: 'Accelerate (+1.5 m/s²)',
  [ActionType.DECELERATE]: 'Decelerate (-2.0 m/s²)',
  [ActionType.LANE_CHANGE_LEFT]: 'Lane Change Left',
  [ActionType.LANE_CHANGE_RIGHT]: 'Lane Change Right',
  [ActionType.EMERGENCY_BRAKE]: 'Emergency Brake (-8.0 m/s²)',
};

export const ACTION_SHORT_NAMES: Record<ActionType, string> = {
  [ActionType.MAINTAIN_SPEED]: 'Maintain',
  [ActionType.ACCELERATE]: 'Accel',
  [ActionType.DECELERATE]: 'Decel',
  [ActionType.LANE_CHANGE_LEFT]: 'Left Lane',
  [ActionType.LANE_CHANGE_RIGHT]: 'Right Lane',
  [ActionType.EMERGENCY_BRAKE]: 'E-Brake',
};

export type AgentType = 'ppo' | 'rule_based' | 'random' | 'manual';

export interface Vehicle {
  id: string;
  x: number; // longitudinal position (meters)
  y: number; // lateral position (meters, lane 0=left, 1=center, 2=right, lane_y = lane * 3.75 + 1.875)
  speed: number; // m/s
  targetSpeed: number; // m/s
  acceleration: number; // m/s²
  length: number; // meters (typically 4.8m)
  width: number; // meters (typically 1.9m)
  lane: number; // current or closest lane (0, 1, 2)
  targetLane: number;
  isChangingLane: boolean;
  laneChangeProgress: number; // 0 to 1
  laneChangeDirection: -1 | 1 | 0; // -1 left, 1 right
  color: string;
  type: 'ego' | 'car' | 'truck' | 'sport';
  blinker: 'none' | 'left' | 'right' | 'hazard';
}

export interface Obstacle {
  id: string;
  x: number;
  lane: number;
  length: number;
  width: number;
  type: 'cone' | 'barrier' | 'stalled_vehicle';
  color: string;
}

export interface TrafficLight {
  id: string;
  x: number;
  state: 'green' | 'yellow' | 'red';
  timer: number;
  cycleDuration: number;
}

export interface ScenarioConfig {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme';
  description: string;
  speedLimit: number; // m/s
  roadLength: number; // meters
  spawnDensity: number; // vehicles per km
  initialEgoSpeed: number;
  trafficTypes: string[];
  hasObstacles: boolean;
  hasTrafficLights: boolean;
  specialEvent?: 'cut_in' | 'sudden_brake' | 'obstacle_block' | 'stop_and_go' | 'speed_drop';
}

export interface ObservationVector {
  egoSpeedNorm: number;
  egoAccelNorm: number;
  egoLaneNorm: number;
  laneCenterOffsetNorm: number;
  leadDistanceNorm: number;
  leadRelativeSpeedNorm: number;
  followDistanceNorm: number;
  followRelativeSpeedNorm: number;
  leftLeadDistNorm: number;
  leftRearDistNorm: number;
  rightLeadDistNorm: number;
  rightRearDistNorm: number;
}

export interface RewardBreakdown {
  progress: number;
  speedLimitAdherence: number;
  headwaySafety: number;
  laneChangeSmoothness: number;
  comfortJerk: number;
  collisionPenalty: number;
  goalBonus: number;
  total: number;
}

export interface TelemetryFrame {
  step: number;
  time: number; // seconds
  ego: Vehicle;
  traffic: Vehicle[];
  obstacles: Obstacle[];
  trafficLight?: TrafficLight;
  observation: ObservationVector;
  observationArray: number[];
  action: ActionType;
  actionProbabilities: number[];
  valueEstimate: number;
  rewardBreakdown: RewardBreakdown;
  cumulativeReward: number;
  distanceToLead: number | null;
  timeToCollision: number | null; // seconds
  collision: boolean;
  collisionTarget?: string;
  destinationReached: boolean;
  comfortJerk: number;
  speedLimit: number;
}

export interface Hyperparameters {
  learningRate: number;
  gamma: number;
  gaeLambda: number;
  clipRange: number;
  entropyCoeff: number;
  batchSize: number;
  nEpochs: number;
  totalTimesteps: number;
}

export interface TrainingMetricPoint {
  step: number;
  episode: number;
  meanReward: number;
  collisionRate: number;
  policyLoss: number;
  valueLoss: number;
  entropy: number;
  avgSpeed: number;
  fps: number;
}

export interface BenchmarkScenarioResult {
  scenarioId: string;
  scenarioName: string;
  agentType: AgentType;
  successRate: number; // %
  collisionRate: number; // %
  meanSpeed: number; // km/h
  meanReward: number;
  avgTimeToGoal: number; // s
  comfortIndex: number; // 0-100 score
  laneChangesCount: number;
}
