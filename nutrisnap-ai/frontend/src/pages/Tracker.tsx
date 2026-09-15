import { useEffect, useState } from "react";
import { trackerService } from "../services/trackerService";
import { CalorieProgress, MacroProgress, EmptyState } from "../components/shared";
import type { TrackerDay } from "../types";

export function Tracker() {
  const [data, setData] = useState<TrackerDay | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadTracker() {
    setLoading(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    const fetcher = date === today ? trackerService.today() : trackerService.byDate(date);
    fetcher
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load tracker data.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTracker();
  }, [date]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tracker</h1>
        <input
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="input w-auto text-sm py-2"
        />
      </div>

      {error ? (
        <div className="card text-center py-8">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-red-400 text-sm font-medium mb-1">{error}</div>
          <p className="text-xs text-white/40 mb-4">
            {import.meta.env.DEV
              ? "Make sure the backend server is running on port 4000."
              : "Unable to reach the server. Please check your connection and try again."}
          </p>
          <button onClick={loadTracker} className="btn-secondary text-xs px-4 py-2">
            Retry
          </button>
        </div>
      ) : loading || !data ? (
        <div className="card animate-pulse h-40" />
      ) : (
        <div className="flex flex-col gap-5">
          <CalorieProgress consumed={data.consumed.calories} goal={data.goals.calories} />

          <div className="card flex flex-col gap-4">
            <div className="font-semibold text-sm mb-1">Macronutrient Progress</div>
            <MacroProgress label="Protein" consumed={data.consumed.protein} goal={data.goals.protein} color="#22c55e" />
            <MacroProgress label="Carbohydrates" consumed={data.consumed.carbs} goal={data.goals.carbs} color="#00e5ff" />
            <MacroProgress label="Fat" consumed={data.consumed.fat} goal={data.goals.fat} color="#f59e0b" />
            <MacroProgress label="Fiber" consumed={data.consumed.fiber} goal={data.goals.fiber} color="#a78bfa" />
          </div>

          <div>
            <div className="font-semibold text-sm mb-3">Meals Logged</div>
            {data.meals.length === 0 ? (
              <EmptyState icon="📅" title="No meals for this day" />
            ) : (
              <div className="flex flex-col gap-2">
                {data.meals.map((m) => (
                  <div key={m.id} className="card flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium capitalize">{m.meal_type}</div>
                      <div className="text-white/40 text-xs">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="text-cyan-accent font-semibold">{Math.round(m.calories)} kcal</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
