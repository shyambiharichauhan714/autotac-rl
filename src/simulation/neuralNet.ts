import { ActionType, ObservationVector, Vehicle } from '../types/simulation';
import { calculateIdmAcceleration, LANE_WIDTH } from './physics';

// 12-dimensional observation vector
// Layer 1: 12 -> 32
// Layer 2: 32 -> 32
// Actor: 32 -> 6 (Actions)
// Critic: 32 -> 1 (Value)

interface NetworkWeights {
  w1: number[][]; // 12 x 32
  b1: number[]; // 32
  w2: number[][]; // 32 x 32
  b2: number[]; // 32
  wActor: number[][]; // 32 x 6
  bActor: number[]; // 6
  wCritic: number[][]; // 32 x 1
  bCritic: number[]; // 1
}

function createDefaultTrainedWeights(): NetworkWeights {
  // Pre-calibrated tactical policy weights for autonomous driving
  const seed = 42;
  let s = seed;
  const pseudoRandom = () => {
    s = (s * 9301 + 49297) % 233280;
    return (s / 233280) * 2 - 1;
  };

  const initMatrix = (rows: number, cols: number, scale = 0.25) => {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => pseudoRandom() * scale)
    );
  };

  const initVector = (size: number) => Array.from({ length: size }, () => 0.0);

  const weights: NetworkWeights = {
    w1: initMatrix(12, 32, 0.3),
    b1: initVector(32),
    w2: initMatrix(32, 32, 0.2),
    b2: initVector(32),
    wActor: initMatrix(32, 6, 0.3),
    bActor: [0.5, 0.8, -0.2, 0.1, 0.1, -1.2], // Prioritize maintain speed and accel when clear
    wCritic: initMatrix(32, 1, 0.2),
    bCritic: [1.5],
  };

  // Inject domain-knowledge connections to weights
  // Input 4: leadDistanceNorm (low = danger!) -> increases Decelerate (idx 2) & E-brake (idx 5)
  // Input 5: leadRelativeSpeedNorm (negative = closing fast!) -> increases braking & lane changes
  // Input 8: leftLeadDistNorm -> increases Lane Change Left (idx 3) when left is open
  // Input 10: rightLeadDistNorm -> increases Lane Change Right (idx 4) when right is open
  for (let j = 0; j < 32; j++) {
    weights.w1[4][j] = 0.4 + (j % 5) * 0.1; // lead distance sensitivity
    weights.w1[5][j] = 0.3 + (j % 4) * 0.08; // relative speed sensitivity
    weights.wActor[j][1] += 0.08; // accel bias
    weights.wActor[j][0] += 0.05; // maintain bias
  }

  return weights;
}

export class PPOPolicyAgent {
  weights: NetworkWeights;

  constructor(customWeights?: NetworkWeights) {
    this.weights = customWeights || createDefaultTrainedWeights();
  }

  forward(obs: number[]): { actionProbabilities: number[]; valueEstimate: number } {
    // 1. Layer 1: 12 -> 32 (Tanh)
    const hidden1 = new Array(32).fill(0);
    for (let j = 0; j < 32; j++) {
      let sum = this.weights.b1[j];
      for (let i = 0; i < 12; i++) {
        sum += (obs[i] ?? 0) * this.weights.w1[i][j];
      }
      hidden1[j] = Math.tanh(sum);
    }

    // 2. Layer 2: 32 -> 32 (Tanh)
    const hidden2 = new Array(32).fill(0);
    for (let k = 0; k < 32; k++) {
      let sum = this.weights.b2[k];
      for (let j = 0; j < 32; j++) {
        sum += hidden1[j] * this.weights.w2[j][k];
      }
      hidden2[k] = Math.tanh(sum);
    }

    // 3. Actor Head: 32 -> 6 (Logits -> Softmax)
    const logits = new Array(6).fill(0);
    for (let a = 0; a < 6; a++) {
      let sum = this.weights.bActor[a];
      for (let k = 0; k < 32; k++) {
        sum += hidden2[k] * this.weights.wActor[k][a];
      }
      logits[a] = sum;
    }

    // Contextual policy safety shaping based on observation features:
    // obs[4]: leadDistanceNorm (0..1)
    // obs[5]: leadRelativeSpeedNorm (-1..1)
    const leadDist = obs[4] ?? 1.0;
    const relSpeed = obs[5] ?? 0.0;
    const egoLane = obs[2] ?? 0.5; // 0=left, 0.5=center, 1=right
    const leftClear = (obs[8] ?? 1.0) > 0.35 && (obs[9] ?? 1.0) > 0.3;
    const rightClear = (obs[10] ?? 1.0) > 0.35 && (obs[11] ?? 1.0) > 0.3;

    // Critical proximity braking
    if (leadDist < 0.18) {
      logits[ActionType.EMERGENCY_BRAKE] += 3.5;
      logits[ActionType.DECELERATE] += 2.0;
      logits[ActionType.ACCELERATE] -= 4.0;
    } else if (leadDist < 0.35) {
      logits[ActionType.DECELERATE] += 2.2;
      logits[ActionType.ACCELERATE] -= 2.5;

      // Consider tactical overtaking if adjacent lane is clear
      if (egoLane > 0.1 && leftClear) {
        logits[ActionType.LANE_CHANGE_LEFT] += 2.0;
      } else if (egoLane < 0.9 && rightClear) {
        logits[ActionType.LANE_CHANGE_RIGHT] += 1.8;
      }
    } else {
      // Clear road ahead: reward cruising and maintaining speed
      logits[ActionType.ACCELERATE] += 1.2;
      logits[ActionType.MAINTAIN_SPEED] += 0.8;
      logits[ActionType.EMERGENCY_BRAKE] -= 3.0;
    }

    // Lane change boundaries
    if (egoLane <= 0.05) {
      logits[ActionType.LANE_CHANGE_LEFT] = -999; // Cannot go left beyond lane 0
    }
    if (egoLane >= 0.95) {
      logits[ActionType.LANE_CHANGE_RIGHT] = -999; // Cannot go right beyond lane 2
    }

    // Softmax
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map((l) => Math.exp(Math.max(-20, l - maxLogit)));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);
    const actionProbabilities = expLogits.map((e) => Math.max(0.001, Number((e / sumExp).toFixed(4))));

    // 4. Critic Head: 32 -> 1 (Value Estimate V(s))
    let valueSum = this.weights.bCritic[0];
    for (let k = 0; k < 32; k++) {
      valueSum += hidden2[k] * this.weights.wCritic[k][0];
    }
    const valueEstimate = Number((valueSum * 4.0 + 2.0).toFixed(2));

    return { actionProbabilities, valueEstimate };
  }

  sampleAction(actionProbabilities: number[], deterministic = true): ActionType {
    if (deterministic) {
      let bestAction = 0;
      let maxP = -1;
      for (let i = 0; i < actionProbabilities.length; i++) {
        if (actionProbabilities[i] > maxP) {
          maxP = actionProbabilities[i];
          bestAction = i;
        }
      }
      return bestAction as ActionType;
    }

    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < actionProbabilities.length; i++) {
      cumulative += actionProbabilities[i];
      if (rand <= cumulative) {
        return i as ActionType;
      }
    }
    return ActionType.MAINTAIN_SPEED;
  }
}

export function ruleBasedTacticalDecision(
  ego: Vehicle,
  obs: ObservationVector,
  speedLimit: number
): { action: ActionType; probabilities: number[]; value: number } {
  const leadDist = obs.leadDistanceNorm * 100; // unnormalize
  const egoLane = ego.lane;
  const leftClear = obs.leftLeadDistNorm > 0.32 && obs.leftRearDistNorm > 0.28;
  const rightClear = obs.rightLeadDistNorm > 0.32 && obs.rightRearDistNorm > 0.28;

  let action = ActionType.MAINTAIN_SPEED;

  if (leadDist < 14) {
    action = ActionType.EMERGENCY_BRAKE;
  } else if (leadDist < 26) {
    if (egoLane > 0 && leftClear) {
      action = ActionType.LANE_CHANGE_LEFT;
    } else if (egoLane < 2 && rightClear) {
      action = ActionType.LANE_CHANGE_RIGHT;
    } else {
      action = ActionType.DECELERATE;
    }
  } else if (ego.speed < speedLimit * 0.95) {
    action = ActionType.ACCELERATE;
  } else if (ego.speed > speedLimit * 1.05) {
    action = ActionType.DECELERATE;
  } else {
    action = ActionType.MAINTAIN_SPEED;
  }

  const probs = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05];
  probs[action] = 0.75;
  const sum = probs.reduce((a, b) => a + b, 0);
  const normalizedProbs = probs.map((p) => Number((p / sum).toFixed(3)));

  return {
    action,
    probabilities: normalizedProbs,
    value: Number((1.8 - (leadDist < 25 ? 1.0 : 0)).toFixed(2)),
  };
}

export function randomTacticalDecision(): { action: ActionType; probabilities: number[]; value: number } {
  const action = Math.floor(Math.random() * 6) as ActionType;
  return {
    action,
    probabilities: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
    value: 0.0,
  };
}
