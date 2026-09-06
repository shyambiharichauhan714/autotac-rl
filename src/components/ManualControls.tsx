import React, { useEffect } from 'react';
import { ActionType, ACTION_SHORT_NAMES } from '../types/simulation';
import { ChevronsUp, ChevronsDown, ArrowLeft, ArrowRight, Minus, OctagonAlert, Radio } from 'lucide-react';

interface ManualControlsProps {
  onManualAction: (action: ActionType) => void;
  lastAction: ActionType;
}

export const ManualControls: React.FC<ManualControlsProps> = ({ onManualAction, lastAction }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid capturing keystrokes if typing in input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          onManualAction(ActionType.ACCELERATE);
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          onManualAction(ActionType.DECELERATE);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          onManualAction(ActionType.LANE_CHANGE_LEFT);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          onManualAction(ActionType.LANE_CHANGE_RIGHT);
          break;
        case 'Space':
          e.preventDefault();
          onManualAction(ActionType.EMERGENCY_BRAKE);
          break;
        case 'KeyM':
          e.preventDefault();
          onManualAction(ActionType.MAINTAIN_SPEED);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onManualAction]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          Tactical Human Override Pad
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          Keys: [↑/W] [↓/S] [←/A] [→/D] [Space]
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Row 1: Left, Accel, Right */}
        <button
          onClick={() => onManualAction(ActionType.LANE_CHANGE_LEFT)}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium border transition ${
            lastAction === ActionType.LANE_CHANGE_LEFT
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
              : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Lane Left
        </button>

        <button
          onClick={() => onManualAction(ActionType.ACCELERATE)}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium border transition ${
            lastAction === ActionType.ACCELERATE
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
              : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300'
          }`}
        >
          <ChevronsUp className="w-3.5 h-3.5" />
          Accel (+1.5)
        </button>

        <button
          onClick={() => onManualAction(ActionType.LANE_CHANGE_RIGHT)}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium border transition ${
            lastAction === ActionType.LANE_CHANGE_RIGHT
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
              : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300'
          }`}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Lane Right
        </button>

        {/* Row 2: Maintain, Decel, E-Brake */}
        <button
          onClick={() => onManualAction(ActionType.MAINTAIN_SPEED)}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium border transition ${
            lastAction === ActionType.MAINTAIN_SPEED
              ? 'bg-slate-700 border-slate-500 text-slate-200'
              : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300'
          }`}
        >
          <Minus className="w-3.5 h-3.5" />
          Maintain (M)
        </button>

        <button
          onClick={() => onManualAction(ActionType.DECELERATE)}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium border transition ${
            lastAction === ActionType.DECELERATE
              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
              : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300'
          }`}
        >
          <ChevronsDown className="w-3.5 h-3.5" />
          Decel (-2.0)
        </button>

        <button
          onClick={() => onManualAction(ActionType.EMERGENCY_BRAKE)}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold border transition ${
            lastAction === ActionType.EMERGENCY_BRAKE
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-rose-950/40 border-rose-800/80 text-rose-300 hover:bg-rose-900/50'
          }`}
        >
          <OctagonAlert className="w-3.5 h-3.5" />
          E-Brake!
        </button>
      </div>
    </div>
  );
};
