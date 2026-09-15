import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trackerService } from "../services/trackerService";
import { useAuth } from "../hooks/useAuth";
import { CalorieProgress, MacroProgress, MealCard, EmptyState } from "../components/shared";
import type { TrackerDay } from "../types";

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<TrackerDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadDashboard() {
    setLoading(true);
    setError(null);
    trackerService
      .today()
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl font-bold mb-1">
        {firstName ? `Hey, ${firstName} 👋` : "Dashboard"}
      </h1>
      <p className="text-white/40 text-sm mb-6">Here's how today is going.</p>

      {error ? (
        <div className="card text-center py-8">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-red-400 text-sm font-medium mb-1">{error}</div>
          <p className="text-xs text-white/40 mb-4">
            {import.meta.env.DEV
              ? "Make sure the backend server is running on port 4000."
              : "Unable to reach the server. Please check your connection and try again."}
          </p>
          <button onClick={loadDashboard} className="btn-secondary text-xs px-4 py-2">
            Retry
          </button>
        </div>
      ) : loading || !data ? (
        <div className="card animate-pulse h-32" />
      ) : (
        <div className="flex flex-col gap-5">
          <CalorieProgress consumed={data.consumed.calories} goal={data.goals.calories} />

          <div className="card flex flex-col gap-4">
            <div className="font-semibold text-sm">Macronutrients</div>
            <MacroProgress label="Protein" consumed={data.consumed.protein} goal={data.goals.protein} color="#22c55e" />
            <MacroProgress label="Carbohydrates" consumed={data.consumed.carbs} goal={data.goals.carbs} color="#00e5ff" />
            <MacroProgress label="Fat" consumed={data.consumed.fat} goal={data.goals.fat} color="#f59e0b" />
            <MacroProgress label="Fiber" consumed={data.consumed.fiber} goal={data.goals.fiber} color="#a78bfa" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={() => navigate("/app/scan")} className="btn-primary text-sm py-3">
              Scan Meal
            </button>
            <button onClick={() => navigate("/app/history")} className="btn-secondary text-sm py-3">
              History
            </button>
            <button onClick={() => navigate("/app/analytics")} className="btn-secondary text-sm py-3">
              Analytics
            </button>
            <button onClick={() => navigate("/app/tracker")} className="btn-secondary text-sm py-3">
              Tracker
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm">Today's Meals</div>
              <Link to="/app/history" className="text-xs text-cyan-accent">
                View all
              </Link>
            </div>
            {data.meals.length === 0 ? (
              <EmptyState icon="🍽" title="No meals logged yet" subtitle="Scan your first meal to get started." />
            ) : (
              <div className="flex flex-col gap-2">
                {data.meals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} onClick={() => navigate(`/app/history?meal=${meal.id}`)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
