import React from 'react';
import { ActionType, AgentType, ScenarioConfig } from '../types/simulation';
import { SCENARIOS } from '../simulation/scenarios';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sparkles,
  Sliders,
  Cpu,
  Keyboard,
  ShieldAlert,
} from 'lucide-react';

interface ControlsBarProps {
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  speedMultiplier: number;
  onSpeedChange: (multiplier: number) => void;
  selectedScenario: ScenarioConfig;
  onScenarioChange: (scenario: ScenarioConfig) => void;
  agentType: AgentType;
  onAgentTypeChange: (agent: AgentType) => void;
  deterministic: boolean;
  onDeterministicToggle: () => void;
  onManualAction: (action: ActionType) => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  isRunning,
  onTogglePlay,
  onStep,
  onReset,
  speedMultiplier,
  onSpeedChange,
  selectedScenario,
  onScenarioChange,
  agentType,
  onAgentTypeChange,
  deterministic,
  onDeterministicToggle,
  onManualAction,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-3">
      {/* 1. Playback & Step Controls */}
      <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-start">
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs tracking-wide transition shadow-md ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
          }`}
        >
          {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          {isRunning ? 'PAUSE' : 'SIMULATE'}
        </button>

        <button
          onClick={onStep}
          disabled={isRunning}
          title="Advance 1 Step (100ms)"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Step
        </button>

        <button
          onClick={onReset}
          title="Reset Episode"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>

        {/* Speed Multipliers */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          {[0.5, 1, 2, 4].map((spd) => (
            <button
              key={spd}
              onClick={() => onSpeedChange(spd)}
              className={`px-2 py-1 text-[11px] font-mono rounded transition ${
                speedMultiplier === spd
                  ? 'bg-cyan-500/20 text-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* 2. Scenario Selector */}
      <div className="flex items-center gap-2 w-full lg:w-auto">
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Scenario:</span>
        <select
          value={selectedScenario.id}
          onChange={(e) => {
            const sc = SCENARIOS.find((s) => s.id === e.target.value);
            if (sc) onScenarioChange(sc);
          }}
          className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer w-full lg:w-56 truncate"
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.difficulty})
            </option>
          ))}
        </select>
      </div>

      {/* 3. Agent Selector & Deterministic toggle */}
      <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => onAgentTypeChange('ppo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              agentType === 'ppo'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            PPO (RL)
          </button>
          <button
            onClick={() => onAgentTypeChange('rule_based')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              agentType === 'rule_based'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            IDM+MOBIL
          </button>
          <button
            onClick={() => onAgentTypeChange('manual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              agentType === 'manual'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Manual
          </button>
        </div>

        {agentType === 'ppo' && (
          <button
            onClick={onDeterministicToggle}
            title={deterministic ? 'Greedy Argmax Action' : 'Softmax Stochastic Sampling'}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition ${
              deterministic
                ? 'bg-slate-800 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            {deterministic ? 'DET' : 'STOCH'}
          </button>
        )}
      </div>
    </div>
  );
};
