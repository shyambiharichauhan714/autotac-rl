import React from 'react';
import { TelemetryFrame, ACTION_NAMES } from '../types/simulation';
import { Gauge, Zap, Compass, AlertTriangle, ShieldCheck, Award } from 'lucide-react';

interface TelemetryPanelProps {
  frame: TelemetryFrame;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ frame }) => {
  const egoSpeedKmh = frame.ego.speed * 3.6;
  const speedLimitKmh = frame.speedLimit * 3.6;
  const speedPct = Math.min(100, (egoSpeedKmh / (speedLimitKmh * 1.25)) * 100);

  const accel = frame.ego.acceleration;
  const isBraking = accel < -0.5;
  const isAccel = accel > 0.5;

  const ttc = frame.timeToCollision;
  const ttcStatus =
    ttc === null
      ? { label: 'Clear Road', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
      : ttc < 2.0
      ? { label: 'Hazardous (<2s)', color: 'text-rose-400', bg: 'bg-rose-500/10' }
      : ttc < 4.0
      ? { label: 'Caution (<4s)', color: 'text-amber-400', bg: 'bg-amber-500/10' }
      : { label: 'Safe Headway', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Velocity & Speedometer */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <Gauge className="w-4 h-4 text-cyan-400" />
            Ego Speed
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Lim: {speedLimitKmh.toFixed(0)} km/h
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono tracking-tight text-slate-100">
            {egoSpeedKmh.toFixed(1)}
          </span>
          <span className="text-xs text-slate-400 font-mono">km/h</span>
          <span className="text-xs text-slate-500 font-mono ml-auto">
            ({frame.ego.speed.toFixed(1)} m/s)
          </span>
        </div>

        {/* Speed Bar Meter */}
        <div className="w-full bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-100 rounded-full ${
              egoSpeedKmh > speedLimitKmh
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500'
            }`}
            style={{ width: `${speedPct}%` }}
          />
        </div>
      </div>

      {/* 2. Longitudinal Acceleration */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg relative">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <Zap className="w-4 h-4 text-amber-400" />
            Acceleration / Jerk
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
              isBraking
                ? 'bg-rose-500/20 text-rose-300'
                : isAccel
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isBraking ? 'BRAKING' : isAccel ? 'POWER' : 'COASTING'}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={`text-3xl font-bold font-mono tracking-tight ${
              accel < -3.0
                ? 'text-rose-400'
                : accel < 0
                ? 'text-amber-300'
                : 'text-emerald-400'
            }`}
          >
            {accel > 0 ? `+${accel.toFixed(2)}` : accel.toFixed(2)}
          </span>
          <span className="text-xs text-slate-400 font-mono">m/s²</span>
          <span className="text-xs text-slate-500 font-mono ml-auto">
            Jerk: {frame.comfortJerk.toFixed(1)}
          </span>
        </div>

        {/* Bipolar Accel meter */}
        <div className="w-full bg-slate-800 h-2 rounded-full mt-2.5 relative overflow-hidden">
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-600 z-10" />
          {accel >= 0 ? (
            <div
              className="absolute left-1/2 top-0 bottom-0 bg-emerald-400 rounded-r-full"
              style={{ width: `${Math.min(50, (accel / 3.0) * 50)}%` }}
            />
          ) : (
            <div
              className="absolute top-0 bottom-0 bg-rose-500 rounded-l-full"
              style={{
                right: '50%',
                width: `${Math.min(50, (Math.abs(accel) / 8.0) * 50)}%`,
              }}
            />
          )}
        </div>
      </div>

      {/* 3. Safety Headway & TTC */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Lead Headway & TTC
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${ttcStatus.bg} ${ttcStatus.color}`}>
            {ttcStatus.label}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-bold font-mono tracking-tight text-slate-100">
              {frame.distanceToLead !== null ? frame.distanceToLead.toFixed(1) : '99+'}
            </span>
            <span className="text-xs text-slate-400 font-mono ml-1">m</span>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-mono uppercase">Time to collision</div>
            <div className={`text-lg font-bold font-mono ${ttcStatus.color}`}>
              {ttc !== null ? `${ttc.toFixed(1)}s` : 'Safe'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2.5 text-[11px] text-slate-400">
          <span className="text-slate-500">Lane Center Offset:</span>
          <span className="font-mono text-slate-200">
            {((frame.ego.y - (frame.ego.lane * 3.75 + 1.875)) * 100).toFixed(0)} cm
          </span>
        </div>
      </div>

      {/* 4. RL Tactical Policy Value & Reward */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <Award className="w-4 h-4 text-violet-400" />
            Cumulative RL Reward
          </span>
          <span className="text-[11px] font-mono text-violet-400 bg-violet-950/40 px-1.5 py-0.5 rounded">
            V(s): {frame.valueEstimate.toFixed(2)}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={`text-3xl font-bold font-mono tracking-tight ${
              frame.cumulativeReward >= 0 ? 'text-violet-300' : 'text-rose-400'
            }`}
          >
            {frame.cumulativeReward > 0 ? `+${frame.cumulativeReward.toFixed(1)}` : frame.cumulativeReward.toFixed(1)}
          </span>
          <span className="text-xs text-slate-500 font-mono ml-auto">
            Step: {frame.rewardBreakdown.total > 0 ? `+${frame.rewardBreakdown.total.toFixed(2)}` : frame.rewardBreakdown.total.toFixed(2)}
          </span>
        </div>

        {/* Micro breakdown badges */}
        <div className="flex items-center justify-between gap-1 mt-2.5 text-[10px] font-mono">
          <span className="text-emerald-400" title="Progress reward">
            Prog: +{frame.rewardBreakdown.progress.toFixed(2)}
          </span>
          <span className="text-amber-400" title="Headway safety penalty">
            Safe: {frame.rewardBreakdown.headwaySafety.toFixed(2)}
          </span>
          <span className="text-cyan-400" title="Lane change penalty">
            Lane: {frame.rewardBreakdown.laneChangeSmoothness.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
