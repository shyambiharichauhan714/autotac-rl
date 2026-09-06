import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { SimulationCanvas } from './components/SimulationCanvas';
import { TelemetryPanel } from './components/TelemetryPanel';
import { DecisionOverlay } from './components/DecisionOverlay';
import { ControlsBar } from './components/ControlsBar';
import { ManualControls } from './components/ManualControls';
import { PolicyInspector } from './components/PolicyInspector';
import { TrainingStudio } from './components/TrainingStudio';
import { EvaluationArena } from './components/EvaluationArena';
import { GeminiCopilot } from './components/GeminiCopilot';

import { SimulationEngine } from './simulation/engine';
import { ActionType, AgentType, ScenarioConfig, TelemetryFrame } from './types/simulation';
import { SCENARIOS } from './simulation/scenarios';
import { AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulation');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioConfig>(SCENARIOS[0]);
  const [agentType, setAgentType] = useState<AgentType>('ppo');
  const [deterministic, setDeterministic] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isRunning, setIsRunning] = useState(false);

  // Engine instance reference
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine(selectedScenario.id);
  }

  const [frame, setFrame] = useState<TelemetryFrame>(() => {
    return engineRef.current!.reset(selectedScenario.id);
  });

  const [history, setHistory] = useState<TelemetryFrame[]>([frame]);

  // Keep engine configuration synchronized
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.agentType = agentType;
      engineRef.current.deterministic = deterministic;
    }
  }, [agentType, deterministic]);

  // Simulation tick loop
  useEffect(() => {
    if (!isRunning) return;

    // Normal step is 100ms. Speed multiplier scales the interval
    const intervalMs = Math.max(20, Math.floor(100 / speedMultiplier));

    const interval = setInterval(() => {
      if (engineRef.current) {
        const nextFrame = engineRef.current.step();
        setFrame(nextFrame);
        setHistory((prev) => {
          const next = [...prev, nextFrame];
          return next.length > 300 ? next.slice(next.length - 300) : next;
        });

        if (nextFrame.collision || nextFrame.destinationReached) {
          setIsRunning(false);
        }
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isRunning, speedMultiplier]);

  const handleTogglePlay = useCallback(() => {
    if (frame.collision || frame.destinationReached) {
      // Auto-restart if already finished
      if (engineRef.current) {
        const resetFrame = engineRef.current.reset(selectedScenario.id);
        setFrame(resetFrame);
        setHistory([resetFrame]);
      }
    }
    setIsRunning((prev) => !prev);
  }, [frame.collision, frame.destinationReached, selectedScenario.id]);

  const handleStep = useCallback(() => {
    if (engineRef.current) {
      const nextFrame = engineRef.current.step();
      setFrame(nextFrame);
      setHistory((prev) => [...prev, nextFrame]);
    }
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    if (engineRef.current) {
      const resetFrame = engineRef.current.reset(selectedScenario.id);
      setFrame(resetFrame);
      setHistory([resetFrame]);
    }
  }, [selectedScenario.id]);

  const handleScenarioChange = useCallback((scenario: ScenarioConfig) => {
    setSelectedScenario(scenario);
    setIsRunning(false);
    if (engineRef.current) {
      const resetFrame = engineRef.current.reset(scenario.id);
      setFrame(resetFrame);
      setHistory([resetFrame]);
    }
  }, []);

  const handleManualAction = useCallback((action: ActionType) => {
    if (engineRef.current) {
      engineRef.current.manualOverrideAction = action;
      const nextFrame = engineRef.current.step();
      setFrame(nextFrame);
      setHistory((prev) => [...prev, nextFrame]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top App Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        agentType={agentType}
        isRunning={isRunning}
        stepCount={frame.step}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-4">
        {/* Status Notification Alerts */}
        {frame.collision && (
          <div className="bg-rose-950/80 border border-rose-600 rounded-xl p-3 text-rose-200 flex items-center justify-between shadow-lg animate-bounce">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>
                COLLISION OCCURRED: Vehicle collided with {frame.collisionTarget || 'lead vehicle'} at x={frame.ego.x.toFixed(1)}m. Simulation halted.
              </span>
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition"
            >
              Restart Episode
            </button>
          </div>
        )}

        {frame.destinationReached && (
          <div className="bg-emerald-950/80 border border-emerald-600 rounded-xl p-3 text-emerald-200 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                MISSION COMPLETE: Autonomous tactical agent navigated {selectedScenario.roadLength}m highway course safely! Total Reward: +{frame.cumulativeReward.toFixed(1)}
              </span>
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
            >
              Replay Episode
            </button>
          </div>
        )}

        {/* Tab 1: Live Tactical Simulation */}
        {activeTab === 'simulation' && (
          <div className="space-y-4">
            {/* 1. Highway Bird's-Eye Canvas */}
            <SimulationCanvas frame={frame} />

            {/* 2. Controls & Scenario selector */}
            <ControlsBar
              isRunning={isRunning}
              onTogglePlay={handleTogglePlay}
              onStep={handleStep}
              onReset={handleReset}
              speedMultiplier={speedMultiplier}
              onSpeedChange={setSpeedMultiplier}
              selectedScenario={selectedScenario}
              onScenarioChange={handleScenarioChange}
              agentType={agentType}
              onAgentTypeChange={setAgentType}
              deterministic={deterministic}
              onDeterministicToggle={() => setDeterministic(!deterministic)}
              onManualAction={handleManualAction}
            />

            {/* 3. Live Telemetry Panels */}
            <TelemetryPanel frame={frame} />

            {/* 4. Action Probabilities & Manual Override Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <DecisionOverlay frame={frame} onManualAction={handleManualAction} />
              </div>
              <div className="lg:col-span-1">
                <ManualControls onManualAction={handleManualAction} lastAction={frame.action} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Policy & Observation Feature Inspector */}
        {activeTab === 'inspector' && (
          <div className="space-y-4">
            <PolicyInspector frame={frame} />
          </div>
        )}

        {/* Tab 3: Deep RL Training Studio */}
        {activeTab === 'training' && (
          <div className="space-y-4">
            <TrainingStudio />
          </div>
        )}

        {/* Tab 4: Benchmark & Evaluation Arena */}
        {activeTab === 'benchmark' && (
          <div className="space-y-4">
            <EvaluationArena />
          </div>
        )}

        {/* Tab 5: AI Safety Copilot */}
        {activeTab === 'copilot' && (
          <div className="space-y-4">
            <GeminiCopilot frame={frame} history={history} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-3 text-center text-xs text-slate-500 font-mono">
        AUTOTAC-RL Tactical Driving Simulator · Deep Reinforcement Learning (PPO) · Actor-Critic 2x32 · Gym Env Compliant
      </footer>
    </div>
  );
}
