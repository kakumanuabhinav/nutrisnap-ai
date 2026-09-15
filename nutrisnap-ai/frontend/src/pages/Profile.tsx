import { useEffect, useState } from "react";
import { profileService } from "../services/profileService";
import type { Profile as ProfileType } from "../types";

export function Profile() {
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [suggested, setSuggested] = useState<{ suggested_calorie_goal: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadProfile() {
    setLoading(true);
    setError(null);
    Promise.all([profileService.get(), profileService.suggestedGoals()])
      .then(([p, s]) => {
        setProfile(p.profile);
        setSuggested(s);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function update<K extends keyof ProfileType>(key: K, value: ProfileType[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    setSaved(false);
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      await profileService.update({
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        activity_level: profile.activity_level,
        nutrition_goal: profile.nutrition_goal,
        calorie_goal: profile.calorie_goal,
        protein_goal: profile.protein_goal,
        carb_goal: profile.carb_goal,
        fat_goal: profile.fat_goal,
        fiber_goal: profile.fiber_goal,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="card text-center py-8">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-red-400 text-sm font-medium mb-1">{error}</div>
          <p className="text-xs text-white/40 mb-4">
            {import.meta.env.DEV
              ? "Make sure the backend server is running on port 4000."
              : "Unable to reach the server. Please check your connection and try again."}
          </p>
          <button onClick={loadProfile} className="btn-secondary text-xs px-4 py-2">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="card animate-pulse h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="flex flex-col gap-5">
        <div className="card flex flex-col gap-3">
          <div className="text-sm font-semibold">Personal Info</div>
          <input className="input" value={profile.name} onChange={(e) => update("name", e.target.value)} placeholder="Name" />
          <input className="input opacity-60" value={profile.email} disabled />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="number" placeholder="Age" value={profile.age ?? ""} onChange={(e) => update("age", Number(e.target.value) as ProfileType["age"])} />
            <select className="input" value={profile.gender ?? ""} onChange={(e) => update("gender", e.target.value)}>
              <option value="">Gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="number" placeholder="Height (cm)" value={profile.height_cm ?? ""} onChange={(e) => update("height_cm", Number(e.target.value) as ProfileType["height_cm"])} />
            <input className="input" type="number" placeholder="Weight (kg)" value={profile.weight_kg ?? ""} onChange={(e) => update("weight_kg", Number(e.target.value) as ProfileType["weight_kg"])} />
          </div>
          <select className="input" value={profile.activity_level ?? ""} onChange={(e) => update("activity_level", e.target.value)}>
            <option value="">Activity level</option>
            <option value="sedentary">Sedentary</option>
            <option value="light">Lightly active</option>
            <option value="moderate">Moderately active</option>
            <option value="active">Active</option>
            <option value="very_active">Very active</option>
          </select>
          <select className="input" value={profile.nutrition_goal ?? ""} onChange={(e) => update("nutrition_goal", e.target.value)}>
            <option value="">Nutrition goal</option>
            <option value="lose_weight">Lose weight</option>
            <option value="maintain">Maintain weight</option>
            <option value="gain_muscle">Gain muscle</option>
            <option value="general_health">General health</option>
          </select>
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Daily Targets</div>
            {suggested?.suggested_calorie_goal && (
              <button
                className="text-xs text-cyan-accent"
                onClick={() => update("calorie_goal", suggested.suggested_calorie_goal!)}
              >
                Use suggested ({suggested.suggested_calorie_goal} kcal)
              </button>
            )}
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Calorie goal</label>
            <input className="input" type="number" value={profile.calorie_goal} onChange={(e) => update("calorie_goal", Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Protein (g)</label>
              <input className="input" type="number" value={profile.protein_goal} onChange={(e) => update("protein_goal", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Carbs (g)</label>
              <input className="input" type="number" value={profile.carb_goal} onChange={(e) => update("carb_goal", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Fat (g)</label>
              <input className="input" type="number" value={profile.fat_goal} onChange={(e) => update("fat_goal", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {saved && <div className="text-sm text-good">Profile updated.</div>}
        <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
