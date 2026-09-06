import React, { useState } from 'react';
import { TelemetryFrame, ObservationVector } from '../types/simulation';
import { Cpu, Network, Layers, Activity, Sliders, CheckCircle2 } from 'lucide-react';

interface PolicyInspectorProps {
  frame: TelemetryFrame;
}

export const PolicyInspector: React.FC<PolicyInspectorProps> = ({ frame }) => {
  const obs = frame.observation;

  const featureConfigs: {
    key: keyof ObservationVector;
    name: string;
    description: string;
    value: number;
    unit: string;
    min: number;
    max: number;
    dangerThreshold?: number;
  }[] = [
    {
      key: 'egoSpeedNorm',
      name: 'Ego Speed (v / v_lim)',
      description: 'Normalized ratio of current ego speed to posted highway speed limit',
      value: obs.egoSpeedNorm,
      unit: `${(frame.ego.speed * 3.6).toFixed(1)} km/h`,
      min: 0,
      max: 1.5,
    },
    {
      key: 'egoAccelNorm',
      name: 'Longitudinal Acceleration',
      description: 'Current vehicle acceleration/braking force normalized to [-1, 1]',
      value: obs.egoAccelNorm,
      unit: `${frame.ego.acceleration.toFixed(2)} m/s²`,
      min: -1,
      max: 1,
    },
    {
      key: 'egoLaneNorm',
      name: 'Current Highway Lane',
      description: 'Lane index normalized across all 3 lanes (0: Left, 0.5: Center, 1.0: Right)',
      value: obs.egoLaneNorm,
      unit: `Lane ${frame.ego.lane}`,
      min: 0,
      max: 1,
    },
    {
      key: 'laneCenterOffsetNorm',
      name: 'Lateral Offset from Center',
      description: 'Normalized lateral deviation from the target lane centerline',
      value: obs.laneCenterOffsetNorm,
      unit: `${((frame.ego.y - (frame.ego.lane * 3.75 + 1.875)) * 100).toFixed(0)} cm`,
      min: -1,
      max: 1,
    },
    {
      key: 'leadDistanceNorm',
      name: 'Lead Vehicle Distance',
      description: 'Radar forward distance to closest obstacle in ego lane (0..100m)',
      value: obs.leadDistanceNorm,
      unit: frame.distanceToLead !== null ? `${frame.distanceToLead}m` : 'Clear (>100m)',
      min: 0,
      max: 1,
      dangerThreshold: 0.25,
    },
    {
      key: 'leadRelativeSpeedNorm',
      name: 'Lead Relative Speed (Δv)',
      description: 'Velocity differential between lead vehicle and ego (negative = closing in)',
      value: obs.leadRelativeSpeedNorm,
      unit: 'Δv / 15m/s',
      min: -1,
      max: 1,
    },
    {
      key: 'followDistanceNorm',
      name: 'Rear Follower Distance',
      description: 'Ultrasonic/rear radar distance to trailing vehicle in same lane',
      value: obs.followDistanceNorm,
      unit: '0..60m',
      min: 0,
      max: 1,
    },
    {
      key: 'followRelativeSpeedNorm',
      name: 'Rear Follower Relative Speed',
      description: 'Approach velocity of trailing vehicle behind ego',
      value: obs.followRelativeSpeedNorm,
      unit: 'norm',
      min: -1,
      max: 1,
    },
    {
      key: 'leftLeadDistNorm',
      name: 'Left Lane Forward Gap',
      description: 'Clearance distance to lead car in adjacent left lane (overtaking lane)',
      value: obs.leftLeadDistNorm,
      unit: '0..100m',
      min: 0,
      max: 1,
    },
    {
      key: 'leftRearDistNorm',
      name: 'Left Lane Rear Gap',
      description: 'Blindspot rear clearance in left lane for safe lane changes',
      value: obs.leftRearDistNorm,
      unit: '0..60m',
      min: 0,
      max: 1,
    },
    {
      key: 'rightLeadDistNorm',
      name: 'Right Lane Forward Gap',
      description: 'Clearance distance to lead car in adjacent right lane',
      value: obs.rightLeadDistNorm,
      unit: '0..100m',
      min: 0,
      max: 1,
    },
    {
      key: 'rightRearDistNorm',
      name: 'Right Lane Rear Gap',
      description: 'Blindspot rear clearance in right lane for safe merging',
      value: obs.rightRearDistNorm,
      unit: '0..60m',
      min: 0,
      max: 1,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Network Architecture Overview Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                PPO Actor-Critic Neural Architecture
              </h3>
              <p className="text-xs text-slate-400">
                12 Continuous Inputs → 2x [32 Tanh] Shared MLPs → Actor Head [6 Softmax] &amp; Critic Head [1 Linear V(s)]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-violet-950/60 border border-violet-800 text-violet-300">
              Actor Output: 6 Actions
            </span>
            <span className="px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-800 text-cyan-300">
              Critic Value V(s): {frame.valueEstimate.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Visual Pipeline Flow */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="text-slate-400 mb-1 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              1. Perception Vector
            </div>
            <div className="text-[11px] text-slate-300 font-bold">12-Dim State s_t</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Normalized speed, lane, headway, blindspots
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="text-slate-400 mb-1 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              2. Shared Latent Trunk
            </div>
            <div className="text-[11px] text-slate-300 font-bold">MLP (32 → 32) Tanh</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Extracts high-order tactical driving affordances
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="text-slate-400 mb-1 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              3. Actor Head π(a|s)
            </div>
            <div className="text-[11px] text-slate-300 font-bold">Linear → Softmax (6)</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Probabilities for tactical throttle, steer, &amp; brake
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="text-slate-400 mb-1 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              4. Critic Head V(s)
            </div>
            <div className="text-[11px] text-slate-300 font-bold">Linear V_θ(s)</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Estimates expected discounted return G_t
            </div>
          </div>
        </div>
      </div>

      {/* 12-Feature Real-Time Perception Inspector Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Live Observation Feature Values s_t
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Updated at 10 Hz (every 100ms)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {featureConfigs.map((feat, idx) => {
            const isDanger = feat.dangerThreshold !== undefined && feat.value < feat.dangerThreshold;
            const pct = Math.min(100, Math.max(0, ((feat.value - feat.min) / (feat.max - feat.min)) * 100));

            return (
              <div
                key={feat.key}
                className={`p-3 rounded-lg border transition ${
                  isDanger
                    ? 'bg-rose-950/30 border-rose-800/80 ring-1 ring-rose-500/40'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200 truncate" title={feat.name}>
                    {idx}. {feat.name}
                  </span>
                  <span
                    className={`font-mono font-bold text-xs ${
                      isDanger ? 'text-rose-400 animate-pulse' : 'text-cyan-400'
                    }`}
                  >
                    {feat.value.toFixed(2)}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 mb-2 truncate">
                  Raw: <span className="text-slate-300 font-mono">{feat.unit}</span>
                </div>

                {/* Visual Bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 rounded-full ${
                      isDanger ? 'bg-rose-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Objective Reward Function Breakdown */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Multi-Objective Tactical Reward Decomposition
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-200">
            Current Total R_t: {frame.rewardBreakdown.total > 0 ? `+${frame.rewardBreakdown.total}` : frame.rewardBreakdown.total}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-slate-400 mb-1 text-[11px]">Forward Progress</div>
            <div className="font-mono text-emerald-400 font-bold text-sm">
              +{frame.rewardBreakdown.progress.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">w_prog · (v / v_lim)</div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-slate-400 mb-1 text-[11px]">Speed Compliance</div>
            <div className="font-mono text-amber-400 font-bold text-sm">
              {frame.rewardBreakdown.speedLimitAdherence.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">-w_speed · |v - v_lim|</div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-slate-400 mb-1 text-[11px]">Headway Safety Margin</div>
            <div className="font-mono text-amber-400 font-bold text-sm">
              {frame.rewardBreakdown.headwaySafety.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">-w_safe · ((s_safe - d) / s_safe)²</div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-slate-400 mb-1 text-[11px]">Comfort / Jerk Penalty</div>
            <div className="font-mono text-slate-300 font-bold text-sm">
              {frame.rewardBreakdown.comfortJerk.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">-w_jerk · |da/dt|</div>
          </div>
        </div>
      </div>
    </div>
  );
};
