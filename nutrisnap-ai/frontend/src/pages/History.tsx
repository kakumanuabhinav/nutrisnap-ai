import { useEffect, useMemo, useState } from "react";
import { mealService } from "../services/mealService";
import { MealCard, EmptyState } from "../components/shared";
import type { Meal } from "../types";

function groupByDate(meals: Meal[]) {
  const groups: Record<string, Meal[]> = {};
  for (const meal of meals) {
    const key = new Date(meal.created_at).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    groups[key] = groups[key] || [];
    groups[key].push(meal);
  }
  return groups;
}

export function History() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Meal | null>(null);

  function load() {
    setLoading(true);
    mealService
      .listMeals({ q: search || undefined, meal_type: mealType || undefined, from: from || undefined, to: to || undefined })
      .then((r) => setMeals(r.meals))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => groupByDate(meals), [meals]);

  async function handleDelete(id: string) {
    await mealService.deleteMeal(id);
    setMeals((prev) => prev.filter((m) => m.id !== id));
    setSelected(null);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl font-bold mb-6">Meal History</h1>

      <div className="flex flex-col gap-3 mb-6">
        <input
          className="input"
          placeholder="Search foods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <div className="grid grid-cols-3 gap-2">
          <select className="input text-sm" value={mealType} onChange={(e) => setMealType(e.target.value)}>
            <option value="">All types</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
          <input type="date" className="input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn-secondary text-sm" onClick={load}>
          Apply Filters
        </button>
      </div>

      {loading ? (
        <div className="card animate-pulse h-40" />
      ) : meals.length === 0 ? (
        <EmptyState icon="🕓" title="Your meal history is empty" subtitle="Scan a meal to start building your history." />
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([date, dayMeals]) => (
            <div key={date}>
              <div className="text-xs text-white/40 mb-2">{date}</div>
              <div className="flex flex-col gap-2">
                {dayMeals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} onClick={() => setSelected(meal)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-semibold capitalize">{selected.meal_type}</div>
                <div className="text-xs text-white/40">{new Date(selected.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/40">✕</button>
            </div>
            {selected.summary && <p className="text-sm text-white/60 mb-4">{selected.summary}</p>}
            <div className="grid grid-cols-4 gap-2 text-center text-sm mb-4">
              <div><div className="font-bold text-cyan-accent">{Math.round(selected.calories)}</div><div className="text-[10px] text-white/40">kcal</div></div>
              <div><div className="font-bold">{Math.round(selected.protein)}g</div><div className="text-[10px] text-white/40">protein</div></div>
              <div><div className="font-bold">{Math.round(selected.carbs)}g</div><div className="text-[10px] text-white/40">carbs</div></div>
              <div><div className="font-bold">{Math.round(selected.fat)}g</div><div className="text-[10px] text-white/40">fat</div></div>
            </div>
            <button className="btn-secondary w-full text-danger" onClick={() => handleDelete(selected.id)}>
              Delete Meal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
