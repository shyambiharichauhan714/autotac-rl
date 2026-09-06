"""
Evaluation Service
Runs benchmark evaluations and persists results in SQLite for analytics and radar charts.
"""

from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.database.database import SessionLocal
from backend.database.models import EvaluationRun
from ai.evaluation.evaluator import BenchmarkEvaluator

class EvaluationService:
    def __init__(self):
        self.evaluator = BenchmarkEvaluator()

    def run_evaluation(self, agent_type: str, scenario_id: str, num_episodes: int = 3) -> Dict[str, Any]:
        """Runs evaluation and persists results."""
        results = self.evaluator.evaluate_agent(
            agent_type=agent_type,
            scenario_id=scenario_id,
            num_episodes=num_episodes,
        )

        db: Session = SessionLocal()
        run = EvaluationRun(
            agent_type=agent_type,
            scenario_id=scenario_id,
            episodes=num_episodes,
            mean_reward=results["mean_reward"],
            std_reward=results["std_reward"],
            collision_rate=results["collision_rate"],
            success_rate=results["success_rate"],
            average_speed=results["average_speed"],
            details=results.get("episode_details", []),
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        db.close()

        results["db_id"] = run.id
        return results

    def get_benchmark_comparison(self) -> Dict[str, Any]:
        """Runs or returns cached baseline comparative benchmarks across Random, Rule-Based, and PPO."""
        return self.evaluator.run_full_benchmark(num_episodes_per_scenario=2)

evaluation_service = EvaluationService()
