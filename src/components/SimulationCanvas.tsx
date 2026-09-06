import React, { useEffect, useRef, useState } from 'react';
import { TelemetryFrame, Vehicle, Obstacle, TrafficLight } from '../types/simulation';
import { LANE_WIDTH, NUM_LANES, getLaneCenterY } from '../simulation/physics';
import { Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface SimulationCanvasProps {
  frame: TelemetryFrame;
  onSelectVehicle?: (vehicle: Vehicle) => void;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ frame, onSelectVehicle }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState(3.8); // pixels per meter
  const [showSensors, setShowSensors] = useState(true);
  const [showTelemetryTags, setShowTelemetryTags] = useState(true);
  const [followEgo, setFollowEgo] = useState(true);

  // Animated pulse timer
  const animTimeRef = useRef(0);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      animTimeRef.current += 0.03;
      render();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [frame, zoom, showSensors, showTelemetryTags, followEgo]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Background asphalt
    ctx.fillStyle = '#0f172a'; // Deep slate
    ctx.fillRect(0, 0, width, height);

    // Camera offset: Ego is centered horizontally around 25% from left
    const cameraX = followEgo ? frame.ego.x - 25 : frame.ego.x - 25;
    const roadCenterY = height / 2;
    const roadTotalWidth = NUM_LANES * LANE_WIDTH * zoom;
    const roadTopY = roadCenterY - roadTotalWidth / 2;

    // 1. Draw Road Surface
    ctx.fillStyle = '#1e293b'; // Road tarmac
    ctx.fillRect(0, roadTopY, width, roadTotalWidth);

    // 2. Draw Road Shoulders
    ctx.fillStyle = '#334155'; // Shoulder
    ctx.fillRect(0, roadTopY - 8, width, 8);
    ctx.fillRect(0, roadTopY + roadTotalWidth, width, 8);

    // Solid Edge lines
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, roadTopY);
    ctx.lineTo(width, roadTopY);
    ctx.moveTo(0, roadTopY + roadTotalWidth);
    ctx.lineTo(width, roadTopY + roadTotalWidth);
    ctx.stroke();

    // 3. Draw Dashed Lane Dividers
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12 * (zoom / 4), 16 * (zoom / 4)]);
    const dashOffset = -(cameraX * zoom) % (28 * (zoom / 4));
    ctx.lineDashOffset = dashOffset;

    for (let l = 1; l < NUM_LANES; l++) {
      const laneY = roadTopY + l * LANE_WIDTH * zoom;
      ctx.beginPath();
      ctx.moveTo(0, laneY);
      ctx.lineTo(width, laneY);
      ctx.stroke();
    }
    ctx.setLineDash([]); // reset line dash

    // Helper coordinate conversion (World -> Screen)
    const toScreenX = (worldX: number) => (worldX - cameraX) * zoom;
    const toScreenY = (worldY: number) => roadTopY + worldY * zoom;

    // 4. Draw Distance Grid Milestones
    ctx.fillStyle = '#475569';
    ctx.font = '10px monospace';
    const startM = Math.floor(cameraX / 50) * 50;
    for (let m = startM; m < cameraX + width / zoom + 50; m += 50) {
      const sx = toScreenX(m);
      if (sx >= 0 && sx <= width) {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, roadTopY - 14);
        ctx.lineTo(sx, roadTopY);
        ctx.stroke();
        ctx.fillText(`${m}m`, sx - 10, roadTopY - 18);
      }
    }

    // 5. Draw Radar / LiDAR Perception Beam from Ego
    if (showSensors && !frame.collision) {
      const egoSx = toScreenX(frame.ego.x + frame.ego.length / 2);
      const egoSy = toScreenY(frame.ego.y);
      const beamLength = 100 * zoom;

      // Front radar cone
      const gradient = ctx.createRadialGradient(egoSx, egoSy, 5, egoSx + beamLength * 0.7, egoSy, beamLength);
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.28)');
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.12)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(egoSx, egoSy);
      ctx.arc(egoSx, egoSy, beamLength, -0.32, 0.32);
      ctx.closePath();
      ctx.fill();

      // Pulsing radar arc
      const pulseRadius = ((animTimeRef.current * 40) % 100) * zoom;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(egoSx, egoSy, pulseRadius, -0.28, 0.28);
      ctx.stroke();

      // Side Blind Spot Radar Cones
      ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
      // Left side blindspot
      ctx.beginPath();
      ctx.arc(toScreenX(frame.ego.x), egoSy, 25 * zoom, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.fill();
      // Right side blindspot
      ctx.beginPath();
      ctx.arc(toScreenX(frame.ego.x), egoSy, 25 * zoom, Math.PI * 0.25, Math.PI * 0.75);
      ctx.fill();
    }

    // 6. Draw Traffic Light if present
    if (frame.trafficLight) {
      const tl = frame.trafficLight;
      const tlx = toScreenX(tl.x);
      if (tlx > -50 && tlx < width + 50) {
        // Gantry pole
        ctx.fillStyle = '#64748b';
        ctx.fillRect(tlx - 2, roadTopY - 45, 4, roadTotalWidth + 45);

        // Light housing
        ctx.fillStyle = '#020617';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.fillRect(tlx - 10, roadTopY - 42, 20, 36);
        ctx.strokeRect(tlx - 10, roadTopY - 42, 20, 36);

        // Bulbs: Red, Yellow, Green
        const states = [
          { color: '#ef4444', active: tl.state === 'red', y: roadTopY - 34 },
          { color: '#f59e0b', active: tl.state === 'yellow', y: roadTopY - 24 },
          { color: '#10b981', active: tl.state === 'green', y: roadTopY - 14 },
        ];

        states.forEach(({ color, active, y }) => {
          ctx.beginPath();
          ctx.arc(tlx, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = active ? color : '#334155';
          ctx.fill();
          if (active) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        });
      }
    }

    // 7. Draw Obstacles
    for (const obs of frame.obstacles) {
      const sx = toScreenX(obs.x);
      const sy = toScreenY(getLaneCenterY(obs.lane));
      const w = obs.length * zoom;
      const h = obs.width * zoom;

      if (obs.type === 'cone') {
        // Warning cone
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Stalled vehicle / barrier
        ctx.fillStyle = '#d97706';
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);

        // Hazard stripes
        ctx.fillStyle = '#0f172a';
        for (let i = -w / 2; i < w / 2; i += 8) {
          ctx.beginPath();
          ctx.moveTo(sx + i, sy - h / 2);
          ctx.lineTo(sx + i + 4, sy + h / 2);
          ctx.lineTo(sx + i + 7, sy + h / 2);
          ctx.lineTo(sx + i + 3, sy - h / 2);
          ctx.fill();
        }

        // Flashing hazard indicator
        if (Math.sin(animTimeRef.current * 10) > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(sx - w / 2 + 2, sy - h / 2 + 2, 2.5, 0, Math.PI * 2);
          ctx.arc(sx - w / 2 + 2, sy + h / 2 - 2, 2.5, 0, Math.PI * 2);
          ctx.arc(sx + w / 2 - 2, sy - h / 2 + 2, 2.5, 0, Math.PI * 2);
          ctx.arc(sx + w / 2 - 2, sy + h / 2 - 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 8. Draw Surrounding Traffic Vehicles
    for (const v of frame.traffic) {
      const sx = toScreenX(v.x);
      const sy = toScreenY(v.y);
      const w = v.length * zoom;
      const h = v.width * zoom;

      if (sx < -80 || sx > width + 80) continue;

      // Draw Vehicle Body
      ctx.save();
      ctx.translate(sx, sy);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w, h);

      // Chassis
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.fill();

      // Windshield & Roof
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-w * 0.15, -h * 0.4, w * 0.4, h * 0.8);

      // Headlights (facing right / forward)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(w / 2 - 2, -h * 0.45, 2, 3);
      ctx.fillRect(w / 2 - 2, h * 0.45 - 3, 2, 3);

      // Brake lights (rear / left)
      const isBraking = v.acceleration < -0.6;
      ctx.fillStyle = isBraking ? '#ef4444' : '#991b1b';
      ctx.fillRect(-w / 2, -h * 0.45, 2, 3);
      ctx.fillRect(-w / 2, h * 0.45 - 3, 2, 3);

      // Turn blinkers
      if (v.blinker !== 'none' && Math.sin(animTimeRef.current * 12) > 0) {
        ctx.fillStyle = '#f59e0b';
        const blinkerY = v.blinker === 'left' ? -h / 2 : h / 2;
        ctx.beginPath();
        ctx.arc(w * 0.3, blinkerY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Bounding box & Radar tags if inside detection range
      const distFromEgo = v.x - frame.ego.x;
      if (showTelemetryTags && distFromEgo > 0 && distFromEgo < 100) {
        ctx.strokeStyle = distFromEgo < 20 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(14, 165, 233, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - w / 2 - 3, sy - h / 2 - 3, w + 6, h + 6);

        // Tag label
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(sx - 26, sy - h / 2 - 19, 52, 14);
        ctx.fillStyle = distFromEgo < 20 ? '#fca5a5' : '#38bdf8';
        ctx.font = '9px monospace';
        const deltaV = (v.speed - frame.ego.speed).toFixed(1);
        ctx.fillText(`${distFromEgo.toFixed(0)}m|${deltaV > '0' ? '+' : ''}${deltaV}`, sx - 22, sy - h / 2 - 8);
      }
    }

    // 9. Draw Ego Vehicle (The RL Tactical Agent)
    const egoSx = toScreenX(frame.ego.x);
    const egoSy = toScreenY(frame.ego.y);
    const egoW = frame.ego.length * zoom;
    const egoH = frame.ego.width * zoom;

    ctx.save();
    ctx.translate(egoSx, egoSy);

    // Collision FX
    if (frame.collision) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, egoW * 0.9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.fill();
    }

    // Ego Vehicle Glow
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;

    // Ego Chassis (Cyan / Neon highlight)
    ctx.fillStyle = frame.collision ? '#ef4444' : '#0891b2';
    ctx.beginPath();
    ctx.roundRect(-egoW / 2, -egoH / 2, egoW, egoH, 4);
    ctx.fill();
    ctx.shadowBlur = 0; // reset glow

    // Ego Accent Roof & Panoramic Glass
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-egoW * 0.2, -egoH * 0.38, egoW * 0.45, egoH * 0.76);

    // Roof LiDAR Puck
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Headlights beam
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(egoW / 2 - 2, -egoH * 0.42, 2.5, 3.5);
    ctx.fillRect(egoW / 2 - 2, egoH * 0.42 - 3.5, 2.5, 3.5);

    // Taillights
    const isEgoBraking = frame.ego.acceleration < -0.8;
    ctx.fillStyle = isEgoBraking ? '#ff0033' : '#b91c1c';
    if (isEgoBraking) {
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 10;
    }
    ctx.fillRect(-egoW / 2, -egoH * 0.42, 2.5, 3.5);
    ctx.fillRect(-egoW / 2, egoH * 0.42 - 3.5, 2.5, 3.5);
    ctx.shadowBlur = 0;

    // Ego Turn blinkers (blinking amber)
    if (frame.ego.blinker !== 'none' && Math.sin(animTimeRef.current * 14) > 0) {
      ctx.fillStyle = '#f59e0b';
      const blinkY = frame.ego.blinker === 'left' ? -egoH / 2 : egoH / 2;
      ctx.beginPath();
      ctx.arc(egoW * 0.35, blinkY, 3, 0, Math.PI * 2);
      ctx.arc(-egoW * 0.35, blinkY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 10. Draw Ego Telemetry HUD tag
    ctx.fillStyle = 'rgba(8, 145, 178, 0.9)';
    ctx.fillRect(egoSx - 35, egoSy - egoH / 2 - 22, 70, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`EGO ${(frame.ego.speed * 3.6).toFixed(0)} km/h`, egoSx - 31, egoSy - egoH / 2 - 11);

    // 11. Time-to-Collision (TTC) Critical Alert Banner
    if (frame.timeToCollision !== null && frame.timeToCollision < 2.5 && !frame.collision) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.fillRect(width / 2 - 100, 16, 200, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`⚠️ TTC ALERT: ${frame.timeToCollision.toFixed(1)}s`, width / 2 - 75, 32);
    }

    ctx.restore();
  };

  return (
    <div className="relative w-full h-[340px] md:h-[390px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col">
      {/* Top overlay toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-slate-100">Live Highway Perception (Bird&apos;s-Eye)</span>
          <span className="text-slate-500">|</span>
          <span className="text-cyan-400 font-mono font-medium">
            x = {frame.ego.x.toFixed(1)}m
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 font-mono">
            Lane {frame.ego.lane} {frame.ego.isChangingLane ? '(Merging...)' : ''}
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 text-slate-300">
          <button
            onClick={() => setShowSensors(!showSensors)}
            title="Toggle Sensor Radar Cone"
            className={`p-1.5 rounded hover:bg-slate-800 transition ${
              showSensors ? 'text-cyan-400' : 'text-slate-500'
            }`}
          >
            {showSensors ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setShowTelemetryTags(!showTelemetryTags)}
            title="Toggle Distance & Relative Speed Tags"
            className={`px-2 py-1 text-[11px] font-mono rounded hover:bg-slate-800 transition ${
              showTelemetryTags ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-500'
            }`}
          >
            TAGS
          </button>
          <div className="w-[1px] h-4 bg-slate-800 mx-1" />
          <button
            onClick={() => setZoom((z) => Math.max(2.0, z - 0.5))}
            title="Zoom Out"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 px-1">{zoom.toFixed(1)}x</span>
          <button
            onClick={() => setZoom((z) => Math.min(6.0, z + 0.5))}
            title="Zoom In"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(3.8)}
            title="Reset Zoom"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full relative cursor-crosshair">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Bottom overlay status */}
      <div className="absolute bottom-2 left-3 right-3 z-10 flex items-center justify-between text-[11px] text-slate-400 pointer-events-none font-mono">
        <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded border border-slate-800">
          <span>Speed Limit: </span>
          <span className="text-slate-200 font-semibold">{(frame.speedLimit * 3.6).toFixed(0)} km/h</span>
          <span className="mx-2 text-slate-600">|</span>
          <span>Lead Dist: </span>
          <span className={frame.distanceToLead && frame.distanceToLead < 20 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
            {frame.distanceToLead ? `${frame.distanceToLead}m` : 'Clear (>100m)'}
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span>TTC: </span>
          <span className={frame.timeToCollision && frame.timeToCollision < 2.5 ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-200'}>
            {frame.timeToCollision ? `${frame.timeToCollision}s` : 'Safe (∞)'}
          </span>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded border border-slate-800">
          <span>Camera: </span>
          <span className="text-cyan-400">Ego Tracking Active</span>
        </div>
      </div>
    </div>
  );
};
