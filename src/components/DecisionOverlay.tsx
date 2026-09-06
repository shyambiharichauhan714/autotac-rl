import React from 'react';
import { ActionType, ACTION_NAMES, ACTION_SHORT_NAMES, TelemetryFrame } from '../types/simulation';
import { Brain, Activity, ArrowRight, ArrowLeft, ChevronsUp, ChevronsDown, Minus, OctagonAlert } from 'lucide-react';

interface DecisionOverlayProps {
  frame: TelemetryFrame;
  onManualAction?: (action: ActionType) => void;
}

export const DecisionOverlay: React.FC<DecisionOverlayProps> = ({ frame, onManualAction }) => {
  const getActionIcon = (action: ActionType) => {
    switch (action) {
      case ActionType.MAINTAIN_SPEED:
        return <Minus className="w-3.5 h-3.5" />;
      case ActionType.ACCELERATE:
        return <ChevronsUp className="w-3.5 h-3.5 text-emerald-400" />;
      case ActionType.DECELERATE:
        return <ChevronsDown className="w-3.5 h-3.5 text-amber-400" />;
      case ActionType.LANE_CHANGE_LEFT:
        return <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />;
      case ActionType.LANE_CHANGE_RIGHT:
        return <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />;
      case ActionType.EMERGENCY_BRAKE:
        return <OctagonAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-slate-100">
            PPO Neural Policy Decision & Action Softmax π(a|s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            Selected Action:
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-violet-950/70 text-violet-200 border border-violet-700/50">
            {getActionIcon(frame.action)}
            {ACTION_NAMES[frame.action]}
          </span>
        </div>
      </div>

      {/* Probability Bars for all 6 discrete tactical actions */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
        {frame.actionProbabilities.map((prob, idx) => {
          const action = idx as ActionType;
          const isSelected = frame.action === action;
          const pct = Math.min(100, Math.round(prob * 100));

          return (
            <div
              key={action}
              onClick={() => onManualAction && onManualAction(action)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-violet-900/30 border-violet-500/80 ring-1 ring-violet-500/50 shadow-md'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1 font-medium text-slate-300">
                  {getActionIcon(action)}
                  <span className="truncate">{ACTION_SHORT_NAMES[action]}</span>
                </div>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    isSelected ? 'text-violet-300' : 'text-slate-400'
                  }`}
                >
                  {pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 rounded-full ${
                    action === ActionType.EMERGENCY_BRAKE
                      ? 'bg-rose-500'
                      : isSelected
                      ? 'bg-violet-400'
                      : 'bg-slate-600'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
