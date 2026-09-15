import type { Insight, Meal } from "../types";

export function CalorieProgress({
  consumed,
  goal,
}: {
  consumed: number;
  goal: number;
}) {
  const pct = Math.min(100, Math.round((consumed / Math.max(goal, 1)) * 100));
  const remaining = Math.max(0, goal - consumed);
  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-3xl font-bold">{Math.round(consumed)}</div>
          <div className="text-xs text-white/40">of {goal} kcal</div>
        </div>
        <div className="text-right">
          <div className="text-cyan-accent font-semibold">{remaining}</div>
          <div className="text-xs text-white/40">remaining</div>
        </div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-xs text-white/40 mt-1">{pct}%</div>
    </div>
  );
}

export function MacroProgress({
  label,
  consumed,
  goal,
  unit = "g",
  color = "#00e5ff",
}: {
  label: string;
  consumed: number;
  goal: number;
  unit?: string;
  color?: string;
}) {
  const pct = Math.min(100, Math.round((consumed / Math.max(goal, 1)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60">{label}</span>
        <span className="text-white/40">
          {Math.round(consumed)}/{goal}
          {unit}
        </span>
      </div>
      <div className="progress-track">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function MacroCard({ label, value, unit = "g" }: { label: string; value: number; unit?: string }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold text-cyan-accent">{Math.round(value)}</div>
      <div className="text-xs text-white/40 mt-1">
        {label} ({unit})
      </div>
    </div>
  );
}

export function MealCard({ meal, onClick }: { meal: Meal; onClick?: () => void }) {
  const time = new Date(meal.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <button
      onClick={onClick}
      className="card w-full flex items-center gap-4 text-left hover:border-cyan-accent/30 transition"
    >
      <div className="w-14 h-14 rounded-xl bg-bg-elevated overflow-hidden flex-shrink-0 flex items-center justify-center text-xl">
        {meal.image_url ? (
          <img src={meal.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          "🍽"
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{meal.summary || meal.meal_type}</div>
        <div className="text-xs text-white/40 capitalize">
          {meal.meal_type} · {time}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-semibold text-cyan-accent">{Math.round(meal.calories)}</div>
        <div className="text-[10px] text-white/40">
          P{Math.round(meal.protein)} C{Math.round(meal.carbs)} F{Math.round(meal.fat)}
        </div>
      </div>
    </button>
  );
}

const insightStyles: Record<Insight["type"], string> = {
  good: "border-good/30 bg-good/10 text-good",
  warning: "border-warn/30 bg-warn/10 text-warn",
  info: "border-cyan-accent/30 bg-cyan-accent/10 text-cyan-accent",
};

const insightIcon: Record<Insight["type"], string> = {
  good: "✓",
  warning: "⚠",
  info: "ℹ",
};

export function HealthInsights({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {insights.map((insight, i) => (
        <div key={i} className={`flex items-start gap-2 border rounded-xl px-3 py-2 text-sm ${insightStyles[insight.type]}`}>
          <span className="mt-0.5">{insightIcon[insight.type]}</span>
          <span>{insight.text}</span>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="text-4xl mb-3 opacity-60">{icon}</div>
      <div className="font-medium text-white/80">{title}</div>
      {subtitle && <div className="text-sm text-white/40 mt-1 max-w-xs">{subtitle}</div>}
    </div>
  );
}
