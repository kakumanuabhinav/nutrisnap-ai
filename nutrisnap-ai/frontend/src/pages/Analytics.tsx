import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { analyticsService } from "../services/analyticsService";
import { EmptyState } from "../components/shared";
import type { AnalyticsTrend } from "../types";

const RANGES: Array<{ label: string; value: 7 | 30 | 90 }> = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
];

export function Analytics() {
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const [data, setData] = useState<AnalyticsTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAnalytics() {
    setLoading(true);
    setError(null);
    analyticsService
      .range(range)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load analytics data.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAnalytics();
  }, [range]);

  const chartData = data?.daily.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-1 bg-bg-card rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                range === r.value ? "bg-cyan-accent text-black" : "text-white/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
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
          <button onClick={loadAnalytics} className="btn-secondary text-xs px-4 py-2">
            Retry
          </button>
        </div>
      ) : loading || !data ? (
        <div className="card animate-pulse h-64" />
      ) : data.total_meals === 0 ? (
        <EmptyState icon="📈" title="No analytics yet" subtitle="Scan your first meal to start seeing nutrition trends." />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <div className="text-xl font-bold text-cyan-accent">{data.total_meals}</div>
              <div className="text-[11px] text-white/40 mt-1">meals scanned</div>
            </div>
            <div className="card text-center">
              <div className="text-xl font-bold text-cyan-accent">{data.average_calories_per_meal}</div>
              <div className="text-[11px] text-white/40 mt-1">avg kcal/meal</div>
            </div>
            <div className="card text-center">
              <div className="text-xl font-bold text-cyan-accent">{data.average_daily_calories}</div>
              <div className="text-[11px] text-white/40 mt-1">avg kcal/day</div>
            </div>
          </div>

          <div className="card">
            <div className="text-sm font-semibold mb-4">Daily Calories</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0d1519", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="calories" stroke="#00e5ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="text-sm font-semibold mb-4">Macro Trends</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0d1519", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="protein" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="carbs" fill="#00e5ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
