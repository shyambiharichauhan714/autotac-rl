import {
  ActionType,
  Vehicle,
  Obstacle,
  TrafficLight,
  ObservationVector,
  RewardBreakdown,
} from '../types/simulation';

export const LANE_WIDTH = 3.75; // meters
export const NUM_LANES = 3;
export const SENSOR_RANGE = 100.0; // meters forward
export const REAR_SENSOR_RANGE = 60.0; // meters backward
export const LANE_CHANGE_DURATION = 1.4; // seconds to switch lane smoothly

export function getLaneCenterY(lane: number): number {
  return lane * LANE_WIDTH + LANE_WIDTH / 2;
}

export function calculateIdmAcceleration(
  egoSpeed: number,
  desiredSpeed: number,
  leadDistance: number | null,
  leadSpeed: number | null,
  params = {
    aMax: 2.5, // max acceleration m/s²
    bComfort: 2.0, // comfortable deceleration m/s²
    s0: 3.5, // minimum bumper-to-bumper standstill distance (m)
    T: 1.4, // desired time headway (s)
    delta: 4.0, // acceleration exponent
  }
): number {
  const freeRoadTerm = 1 - Math.pow(Math.max(0, egoSpeed) / Math.max(0.1, desiredSpeed), params.delta);

  if (leadDistance === null || leadSpeed === null || leadDistance > SENSOR_RANGE) {
    return params.aMax * freeRoadTerm;
  }

  const deltaV = egoSpeed - leadSpeed;
  const sStar =
    params.s0 +
    Math.max(0, egoSpeed * params.T + (egoSpeed * deltaV) / (2 * Math.sqrt(params.aMax * params.bComfort)));

  const interactionTerm = Math.pow(sStar / Math.max(0.5, leadDistance), 2);
  const accel = params.aMax * (freeRoadTerm - interactionTerm);
  return Math.max(-9.0, Math.min(params.aMax, accel));
}

export function findSurroundingVehicles(
  subject: Vehicle,
  vehicles: Vehicle[],
  obstacles: Obstacle[] = []
): {
  lead: Vehicle | null;
  leadDistance: number | null;
  rear: Vehicle | null;
  rearDistance: number | null;
  leftLead: Vehicle | null;
  leftLeadDist: number | null;
  leftRear: Vehicle | null;
  leftRearDist: number | null;
  rightLead: Vehicle | null;
  rightLeadDist: number | null;
  rightRear: Vehicle | null;
  rightRearDist: number | null;
} {
  const subjectLane = subject.lane;
  let lead: Vehicle | null = null;
  let leadDist = Infinity;
  let rear: Vehicle | null = null;
  let rearDist = Infinity;

  let leftLead: Vehicle | null = null;
  let leftLeadDist = Infinity;
  let leftRear: Vehicle | null = null;
  let leftRearDist = Infinity;

  let rightLead: Vehicle | null = null;
  let rightLeadDist = Infinity;
  let rightRear: Vehicle | null = null;
  let rightRearDist = Infinity;

  for (const v of vehicles) {
    if (v.id === subject.id) continue;

    const dx = v.x - subject.x;
    const vLane = v.lane;

    // Check same lane
    if (vLane === subjectLane) {
      if (dx > 0 && dx < leadDist) {
        leadDist = dx;
        lead = v;
      } else if (dx < 0 && Math.abs(dx) < rearDist) {
        rearDist = Math.abs(dx);
        rear = v;
      }
    }

    // Check left lane (subjectLane - 1)
    if (vLane === subjectLane - 1) {
      if (dx > 0 && dx < leftLeadDist) {
        leftLeadDist = dx;
        leftLead = v;
      } else if (dx < 0 && Math.abs(dx) < leftRearDist) {
        leftRearDist = Math.abs(dx);
        leftRear = v;
      }
    }

    // Check right lane (subjectLane + 1)
    if (vLane === subjectLane + 1) {
      if (dx > 0 && dx < rightLeadDist) {
        rightLeadDist = dx;
        rightLead = v;
      } else if (dx < 0 && Math.abs(dx) < rightRearDist) {
        rightRearDist = Math.abs(dx);
        rightRear = v;
      }
    }
  }

  // Account for static obstacles in current/adjacent lanes
  for (const obs of obstacles) {
    const dx = obs.x - subject.x;
    if (obs.lane === subjectLane && dx > 0 && dx < leadDist) {
      leadDist = dx;
      lead = {
        id: obs.id,
        x: obs.x,
        y: getLaneCenterY(obs.lane),
        speed: 0,
        targetSpeed: 0,
        acceleration: 0,
        length: obs.length,
        width: obs.width,
        lane: obs.lane,
        targetLane: obs.lane,
        isChangingLane: false,
        laneChangeProgress: 0,
        laneChangeDirection: 0,
        color: obs.color,
        type: 'car',
        blinker: 'hazard',
      };
    }
  }

  return {
    lead,
    leadDistance: leadDist < SENSOR_RANGE ? leadDist : null,
    rear,
    rearDistance: rearDist < REAR_SENSOR_RANGE ? rearDist : null,
    leftLead,
    leftLeadDist: leftLeadDist < SENSOR_RANGE ? leftLeadDist : null,
    leftRear,
    leftRearDist: leftRearDist < REAR_SENSOR_RANGE ? leftRearDist : null,
    rightLead,
    rightLeadDist: rightLeadDist < SENSOR_RANGE ? rightLeadDist : null,
    rightRear,
    rightRearDist: rightRearDist < REAR_SENSOR_RANGE ? rightRearDist : null,
  };
}

export function computeObservationVector(
  ego: Vehicle,
  surroundings: ReturnType<typeof findSurroundingVehicles>,
  speedLimit: number
): ObservationVector {
  const egoSpeedNorm = Math.min(1.5, Math.max(0, ego.speed / speedLimit));
  const egoAccelNorm = Math.max(-1.0, Math.min(1.0, ego.acceleration / 4.0));
  const egoLaneNorm = ego.lane / (NUM_LANES - 1);
  const laneCenterY = getLaneCenterY(ego.lane);
  const laneCenterOffsetNorm = Math.max(-1.0, Math.min(1.0, (ego.y - laneCenterY) / (LANE_WIDTH / 2)));

  const leadDist = surroundings.leadDistance ?? SENSOR_RANGE;
  const leadDistanceNorm = Math.min(1.0, leadDist / SENSOR_RANGE);
  const leadRelativeSpeed = surroundings.lead ? surroundings.lead.speed - ego.speed : 0;
  const leadRelativeSpeedNorm = Math.max(-1.0, Math.min(1.0, leadRelativeSpeed / 15.0));

  const followDist = surroundings.rearDistance ?? REAR_SENSOR_RANGE;
  const followDistanceNorm = Math.min(1.0, followDist / REAR_SENSOR_RANGE);
  const followRelativeSpeed = surroundings.rear ? surroundings.rear.speed - ego.speed : 0;
  const followRelativeSpeedNorm = Math.max(-1.0, Math.min(1.0, followRelativeSpeed / 15.0));

  const leftLeadDistNorm = (surroundings.leftLeadDist ?? SENSOR_RANGE) / SENSOR_RANGE;
  const leftRearDistNorm = (surroundings.leftRearDist ?? REAR_SENSOR_RANGE) / REAR_SENSOR_RANGE;
  const rightLeadDistNorm = (surroundings.rightLeadDist ?? SENSOR_RANGE) / SENSOR_RANGE;
  const rightRearDistNorm = (surroundings.rightRearDist ?? REAR_SENSOR_RANGE) / REAR_SENSOR_RANGE;

  return {
    egoSpeedNorm: Number(egoSpeedNorm.toFixed(3)),
    egoAccelNorm: Number(egoAccelNorm.toFixed(3)),
    egoLaneNorm: Number(egoLaneNorm.toFixed(3)),
    laneCenterOffsetNorm: Number(laneCenterOffsetNorm.toFixed(3)),
    leadDistanceNorm: Number(leadDistanceNorm.toFixed(3)),
    leadRelativeSpeedNorm: Number(leadRelativeSpeedNorm.toFixed(3)),
    followDistanceNorm: Number(followDistanceNorm.toFixed(3)),
    followRelativeSpeedNorm: Number(followRelativeSpeedNorm.toFixed(3)),
    leftLeadDistNorm: Number(leftLeadDistNorm.toFixed(3)),
    leftRearDistNorm: Number(leftRearDistNorm.toFixed(3)),
    rightLeadDistNorm: Number(rightLeadDistNorm.toFixed(3)),
    rightRearDistNorm: Number(rightRearDistNorm.toFixed(3)),
  };
}

export function observationToArray(obs: ObservationVector): number[] {
  return [
    obs.egoSpeedNorm,
    obs.egoAccelNorm,
    obs.egoLaneNorm,
    obs.laneCenterOffsetNorm,
    obs.leadDistanceNorm,
    obs.leadRelativeSpeedNorm,
    obs.followDistanceNorm,
    obs.followRelativeSpeedNorm,
    obs.leftLeadDistNorm,
    obs.leftRearDistNorm,
    obs.rightLeadDistNorm,
    obs.rightRearDistNorm,
  ];
}

export function checkCollision(
  ego: Vehicle,
  vehicles: Vehicle[],
  obstacles: Obstacle[] = []
): { collided: boolean; targetId?: string } {
  const egoHalfL = ego.length / 2;
  const egoHalfW = ego.width / 2;

  for (const v of vehicles) {
    if (v.id === ego.id) continue;

    const dx = Math.abs(ego.x - v.x);
    const dy = Math.abs(ego.y - v.y);
    const minDx = egoHalfL + v.length / 2;
    const minDy = egoHalfW + v.width / 2;

    if (dx < minDx * 0.92 && dy < minDy * 0.88) {
      return { collided: true, targetId: v.id };
    }
  }

  for (const obs of obstacles) {
    const obsY = getLaneCenterY(obs.lane);
    const dx = Math.abs(ego.x - obs.x);
    const dy = Math.abs(ego.y - obsY);
    const minDx = egoHalfL + obs.length / 2;
    const minDy = egoHalfW + obs.width / 2;

    if (dx < minDx * 0.92 && dy < minDy * 0.88) {
      return { collided: true, targetId: obs.id };
    }
  }

  return { collided: false };
}

export function calculateReward(
  ego: Vehicle,
  speedLimit: number,
  leadDistance: number | null,
  isChangingLane: boolean,
  jerk: number,
  hasCollided: boolean,
  destinationReached: boolean,
  weights = {
    progress: 1.0,
    speedAdherence: 0.8,
    safety: 1.2,
    laneChange: 0.15,
    jerk: 0.1,
    collision: 15.0,
    goal: 10.0,
  }
): RewardBreakdown {
  // 1. Progress reward (traveling smoothly at or near target speed)
  const speedRatio = Math.min(1.0, ego.speed / speedLimit);
  const progress = weights.progress * speedRatio;

  // 2. Speed limit adherence (penalty if excessively exceeding or creeping)
  let speedPenalty = 0;
  if (ego.speed > speedLimit) {
    speedPenalty = (ego.speed - speedLimit) * 0.5;
  } else if (ego.speed < speedLimit * 0.5) {
    speedPenalty = (speedLimit * 0.5 - ego.speed) * 0.2;
  }
  const speedLimitAdherence = -weights.speedAdherence * speedPenalty;

  // 3. Headway / Safe distance penalty
  let headwayPenalty = 0;
  if (leadDistance !== null) {
    const safeDistance = Math.max(8.0, ego.speed * 1.2);
    if (leadDistance < safeDistance) {
      headwayPenalty = Math.pow((safeDistance - leadDistance) / safeDistance, 2) * 2.0;
    }
  }
  const headwaySafety = -weights.safety * headwayPenalty;

  // 4. Lane change penalty (discourages frivolous weaving)
  const laneChangeSmoothness = isChangingLane ? -weights.laneChange : 0;

  // 5. Comfort / Jerk penalty
  const comfortJerk = -weights.jerk * Math.min(5.0, Math.abs(jerk));

  // 6. Collision penalty
  const collisionPenalty = hasCollided ? -weights.collision : 0;

  // 7. Goal bonus
  const goalBonus = destinationReached ? weights.goal : 0;

  const total = Number(
    (
      progress +
      speedLimitAdherence +
      headwaySafety +
      laneChangeSmoothness +
      comfortJerk +
      collisionPenalty +
      goalBonus
    ).toFixed(3)
  );

  return {
    progress: Number(progress.toFixed(3)),
    speedLimitAdherence: Number(speedLimitAdherence.toFixed(3)),
    headwaySafety: Number(headwaySafety.toFixed(3)),
    laneChangeSmoothness: Number(laneChangeSmoothness.toFixed(3)),
    comfortJerk: Number(comfortJerk.toFixed(3)),
    collisionPenalty: Number(collisionPenalty.toFixed(3)),
    goalBonus: Number(goalBonus.toFixed(3)),
    total,
  };
}
