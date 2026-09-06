"""
Background Training Service
Manages asynchronous PPO training execution, thread monitoring, and telemetry ingestion to SQLite.
"""

import threading
import time
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from backend.database.database import SessionLocal
from backend.database.models import TrainingRun, TrainingMetric
from ai.training.train import train_ppo_agent
from backend.services.simulation_service import simulation_service

class TrainingService:
    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.is_training = False
        self.current_run_id: Optional[int] = None
        self.current_step = 0
        self.total_timesteps = 0
        self.mean_reward = 0.0
        self.collision_rate = 0.0
        self.fps = 0
        self.recent_metrics: List[Dict[str, Any]] = []

    def start_training(
        self,
        total_timesteps: int = 5000,
        learning_rate: float = 3e-4,
        batch_size: int = 64,
        scenario: str = "default",
    ) -> Dict[str, Any]:
        """Initiate background PPO training session."""
        if self.is_training:
            return {"status": "already_running", "run_id": self.current_run_id}

        self.is_training = True
        self.total_timesteps = total_timesteps
        self.current_step = 0
        self.recent_metrics.clear()
        self._stop_event.clear()

        # Create database record
        db: Session = SessionLocal()
        run = TrainingRun(
            status="running",
            total_timesteps=total_timesteps,
            learning_rate=learning_rate,
            batch_size=batch_size,
            scenario=scenario,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        self.current_run_id = run.id
        db.close()

        def _worker():
            try:
                def _metric_callback(payload: Dict[str, Any]):
                    self.current_step = payload["step"]
                    self.mean_reward = payload["mean_reward"]
                    self.collision_rate = payload["collision_rate"]
                    self.fps = payload.get("fps", 0)
                    self.recent_metrics.append(payload)
                    if len(self.recent_metrics) > 100:
                        self.recent_metrics.pop(0)

                    # Persist periodic metric
                    if payload.get("episode", 0) % 2 == 0:
                        db_inner = SessionLocal()
                        m = TrainingMetric(
                            run_id=self.current_run_id,
                            step=payload["step"],
                            episode=payload["episode"],
                            reward=payload["episode_reward"],
                            mean_reward=payload["mean_reward"],
                            collision_rate=payload["collision_rate"],
                            episode_length=payload["episode_length"],
                            fps=payload.get("fps", 0),
                        )
                        db_inner.add(m)
                        db_inner.commit()
                        db_inner.close()

                train_ppo_agent(
                    total_timesteps=total_timesteps,
                    learning_rate=learning_rate,
                    batch_size=batch_size,
                    scenario=scenario,
                    save_path="ai/saved_models/ppo_av_model.zip",
                    on_metric_callback=_metric_callback,
                )

                # Reload newly trained agent into simulation service
                simulation_service.ppo_agent.load("ai/saved_models/ppo_av_model.zip")

                # Update database status
                db_finish = SessionLocal()
                run_finish = db_finish.query(TrainingRun).filter(TrainingRun.id == self.current_run_id).first()
                if run_finish:
                    run_finish.status = "completed"
                    run_finish.final_reward = self.mean_reward
                    run_finish.final_collision_rate = self.collision_rate
                    run_finish.current_step = self.total_timesteps
                    db_finish.commit()
                db_finish.close()

            except Exception as e:
                print(f"[ERROR] Training worker failed: {e}")
                db_err = SessionLocal()
                run_err = db_err.query(TrainingRun).filter(TrainingRun.id == self.current_run_id).first()
                if run_err:
                    run_err.status = "failed"
                    db_err.commit()
                db_err.close()
            finally:
                self.is_training = False

        self._thread = threading.Thread(target=_worker, daemon=True)
        self._thread.start()

        return {"status": "started", "run_id": self.current_run_id}

    def stop_training(self) -> Dict[str, Any]:
        """Request stop of running training session."""
        if not self.is_training:
            return {"status": "not_running"}
        self._stop_event.set()
        self.is_training = False
        return {"status": "stopping"}

    def get_status(self) -> Dict[str, Any]:
        pct = (self.current_step / max(self.total_timesteps, 1)) * 100.0 if self.total_timesteps > 0 else 0.0
        return {
            "is_training": self.is_training,
            "run_id": self.current_run_id,
            "current_step": self.current_step,
            "total_timesteps": self.total_timesteps,
            "progress_percentage": round(min(100.0, pct), 1),
            "mean_reward": round(self.mean_reward, 2),
            "collision_rate": round(self.collision_rate, 3),
            "fps": self.fps,
            "recent_metrics": self.recent_metrics[-20:],
        }

# Global singleton
training_service = TrainingService()
