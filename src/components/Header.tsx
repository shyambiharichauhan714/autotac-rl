import React from 'react';
import { AgentType } from '../types/simulation';
import { Car, Activity, Cpu, Award, Flame, Bot } from 'lucide-react';

export type ActiveTab = 'simulation' | 'inspector' | 'training' | 'benchmark' | 'copilot';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  agentType: AgentType;
  isRunning: boolean;
  stepCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  agentType,
  isRunning,
  stepCount,
}) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'simulation', label: 'Live Simulation', icon: <Car className="w-4 h-4" /> },
    { id: 'inspector', label: 'Policy Inspector', icon: <Cpu className="w-4 h-4" /> },
    { id: 'training', label: 'RL Training Studio', icon: <Flame className="w-4 h-4" /> },
    { id: 'benchmark', label: 'Benchmark Arena', icon: <Award className="w-4 h-4" /> },
    { id: 'copilot', label: 'Safety Copilot', icon: <Bot className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Title & Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold">
            <Car className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-100">
                AUTOTAC-RL
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700/60 text-cyan-300">
                DRL Tactical Decision Platform
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-md">
              Proximal Policy Optimization (PPO) · Highway Tactical Navigation · Multi-Agent Traffic
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium w-full md:w-auto overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg whitespace-nowrap transition ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Status indicator */}
        <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span>{isRunning ? 'SIM RUNNING' : 'STANDBY'}</span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-400">
            Step: <span className="text-slate-200 font-bold">{stepCount}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
