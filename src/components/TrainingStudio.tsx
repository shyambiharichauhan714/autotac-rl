import React, { useState, useEffect, useRef } from 'react';
import { Hyperparameters, TrainingMetricPoint } from '../types/simulation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Play, Pause, RotateCcw, Sliders, Activity, TrendingUp, CheckCircle, Flame } from 'lucide-react';

export const TrainingStudio: React.FC = () => {
  const [hyperparams, setHyperparams] = useState<Hyperparameters>({
    learningRate: 0.0003,
    gamma: 0.99,
    gaeLambda: 0.95,
    clipRange: 0.2,
    entropyCoeff: 0.01,
    batchSize: 64,
    nEpochs: 10,
    totalTimesteps: 15000,
  });

  const [isTraining, setIsTraining] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [metrics, setMetrics] = useState<TrainingMetricPoint[]>([]);

  const animRef = useRef<number | null>(null);

  // Initial seed curves if empty
  useEffect(() => {
    if (metrics.length === 0) {
      const initial: TrainingMetricPoint[] = [];
      for (let s = 0; s <= 2000; s += 200) {
        const progress = s / 15000;
        const ep = Math.floor(s / 120);
        // Exponential reward improvement curve with stochastic noise
        const baseReward = -12.0 + 26.0 * (1 - Math.exp(-progress * 5));
        const noise = (Math.random() - 0.5) * 1.5;
        const collRate = Math.max(0.02, 0.45 * Math.exp(-progress * 6) + (Math.random() - 0.5) * 0.03);

        initial.push({
          step: s,
          episode: ep,
          meanReward: Number((baseReward + noise).toFixed(2)),
          collisionRate: Number((collRate * 100).toFixed(1)),
          policyLoss: Number((0.08 * Math.exp(-progress * 4) + Math.random() * 0.01).toFixed(4)),
          valueLoss: Number((0.45 * Math.exp(-progress * 3.5) + Math.random() * 0.04).toFixed(3)),
          entropy: Number((1.79 * (1 - progress * 0.6)).toFixed(3)),
          avgSpeed: Number((18 + 7 * (1 - Math.exp(-progress * 4))).toFixed(1)),
          fps: 820,
        });
      }
      setMetrics(initial);
      setCurrentStep(2000);
      setCurrentEpisode(Math.floor(2000 / 120));
    }
  }, []);

  // Live PPO training stepper
  useEffect(() => {
    if (!isTraining) return;

    const interval = setInterval(() => {
      setCurrentStep((prevStep) => {
        if (prevStep >= hyperparams.totalTimesteps) {
          setIsTraining(false);
          return prevStep;
        }

        const nextStep = prevStep + 250;
        const ep = Math.floor(nextStep / 110);
        setCurrentEpisode(ep);

        const progress = nextStep / hyperparams.totalTimesteps;
        // PPO theoretical convergence curve
        const baseReward = -12.0 + 28.5 * (1 - Math.exp(-progress * 4.5));
        const noise = (Math.random() - 0.5) * 1.8;
        const collRate = Math.max(0.01, 0.45 * Math.exp(-progress * 5.5) + (Math.random() - 0.5) * 0.02);
        const pLoss = Math.max(0.005, 0.08 * Math.exp(-progress * 4) + (Math.random() - 0.5) * 0.01);
        const vLoss = Math.max(0.02, 0.45 * Math.exp(-progress * 3.5) + (Math.random() - 0.5) * 0.03);
        const ent = Math.max(0.4, 1.79 * (1 - progress * 0.55));
        const spd = 18 + 8.5 * (1 - Math.exp(-progress * 4));

        const newPoint: TrainingMetricPoint = {
          step: nextStep,
          episode: ep,
          meanReward: Number((baseReward + noise).toFixed(2)),
          collisionRate: Number((collRate * 100).toFixed(1)),
          policyLoss: Number(pLoss.toFixed(4)),
          valueLoss: Number(vLoss.toFixed(3)),
          entropy: Number(ent.toFixed(3)),
          avgSpeed: Number(spd.toFixed(1)),
          fps: 780 + Math.floor(Math.random() * 80),
        };

        setMetrics((prev) => [...prev, newPoint]);
        return nextStep;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [isTraining, hyperparams.totalTimesteps]);

  const handleReset = () => {
    setIsTraining(false);
    setCurrentStep(0);
    setCurrentEpisode(0);
    setMetrics([]);
  };

  const latest = metrics[metrics.length - 1] || {
    meanReward: 0,
    collisionRate: 0,
    policyLoss: 0,
    valueLoss: 0,
    entropy: 0,
    fps: 0,
  };

  const progressPct = Math.min(100, Math.round((currentStep / hyperparams.totalTimesteps) * 100));

  return (
    <div className="space-y-4">
      {/* Top Banner & Training Execution Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-100">
              PPO Tactical Agent Training Studio
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Train the Proximal Policy Optimization network via Generalized Advantage Estimation (GAE)
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={() => setIsTraining(!isTraining)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold tracking-wide transition shadow-lg ${
              isTraining
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
          >
            {isTraining ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {isTraining ? 'PAUSE TRAINING' : 'START PPO OPTIMIZATION'}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Live Training Status Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="text-[11px] text-slate-400 font-medium">Timesteps / Progress</div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
            {currentStep.toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>Target: {hyperparams.totalTimesteps.toLocaleString()}</span>
            <span className="text-cyan-400 font-bold">{progressPct}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-cyan-500 h-full rounded-full transition-all duration-200" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="text-[11px] text-slate-400 font-medium">Mean Episode Reward</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${latest.meanReward >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {latest.meanReward > 0 ? `+${latest.meanReward}` : latest.meanReward}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Baseline: -12.0 → Optimum: ~+18.0
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="text-[11px] text-slate-400 font-medium">Collision Rate</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${latest.collisionRate < 5 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {latest.collisionRate}%
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Target safety rate: &lt;2.0%
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="text-[11px] text-slate-400 font-medium">Critic Value Loss</div>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
            {latest.valueLoss}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Policy Loss: {latest.policyLoss}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md col-span-2 md:col-span-1">
          <div className="text-[11px] text-slate-400 font-medium">Sampling Rate (FPS)</div>
          <div className="text-2xl font-bold font-mono text-violet-300 mt-1">
            {latest.fps} <span className="text-xs text-slate-500">steps/s</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Episode count: {currentEpisode}
          </div>
        </div>
      </div>

      {/* Recharts Learning Curves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Mean Episode Reward */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200">
                PPO Learning Curve: Mean Episode Return
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
              Reward Target ~18.0
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics}>
                <defs>
                  <linearGradient id="rewardGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 10 }} unit="s" />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[-15, 22]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                  formatter={(val: number) => [`${val}`, 'Mean Reward']}
                />
                <Area
                  type="monotone"
                  dataKey="meanReward"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#rewardGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Collision Rate (%) Reduction */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-slate-200">
                Safety Convergence: Collision Rate (%) Reduction
              </h3>
            </div>
            <span className="text-[10px] font-mono text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded">
              Collision % vs Steps
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics}>
                <defs>
                  <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 10 }} unit="s" />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" domain={[0, 50]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                  formatter={(val: number) => [`${val}%`, 'Collision Rate']}
                />
                <Area
                  type="monotone"
                  dataKey="collisionRate"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fill="url(#collGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hyperparameter Tuner & Config Form */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100">
            PPO Hyperparameter Tuning &amp; Optimization Matrix
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Learning Rate (α): {hyperparams.learningRate}
            </label>
            <input
              type="range"
              min="0.0001"
              max="0.001"
              step="0.00005"
              value={hyperparams.learningRate}
              disabled={isTraining}
              onChange={(e) =>
                setHyperparams({ ...hyperparams, learningRate: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Discount Factor (γ): {hyperparams.gamma}
            </label>
            <input
              type="range"
              min="0.9"
              max="0.999"
              step="0.005"
              value={hyperparams.gamma}
              disabled={isTraining}
              onChange={(e) =>
                setHyperparams({ ...hyperparams, gamma: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              GAE Parameter (λ): {hyperparams.gaeLambda}
            </label>
            <input
              type="range"
              min="0.8"
              max="0.99"
              step="0.01"
              value={hyperparams.gaeLambda}
              disabled={isTraining}
              onChange={(e) =>
                setHyperparams({ ...hyperparams, gaeLambda: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Clip Range (ε): {hyperparams.clipRange}
            </label>
            <input
              type="range"
              min="0.1"
              max="0.3"
              step="0.02"
              value={hyperparams.clipRange}
              disabled={isTraining}
              onChange={(e) =>
                setHyperparams({ ...hyperparams, clipRange: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
