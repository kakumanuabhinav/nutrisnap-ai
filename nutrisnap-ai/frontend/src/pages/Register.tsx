import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/apiClient";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    age: "",
    gender: "",
    height_cm: "",
    weight_kg: "",
    activity_level: "",
    nutrition_goal: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        height_cm: form.height_cm ? Number(form.height_cm) : undefined,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
        activity_level: form.activity_level || undefined,
        nutrition_goal: form.nutrition_goal || undefined,
      });
      navigate("/app/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-bg">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="text-cyan-accent text-2xl">🥗</span>
          <span className="font-bold">NutriSnap AI</span>
        </div>
        <div className="card">
          <h1 className="text-xl font-bold mb-1">Create your account</h1>
          <p className="text-sm text-white/40 mb-6">Start tracking your nutrition with AI.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input className="input" placeholder="Full name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
            <input className="input" type="email" placeholder="Email" required value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" />
            <input className="input" type="password" placeholder="Password (min 8 characters)" required value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="new-password" />
            <input className="input" type="password" placeholder="Confirm password" required value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} autoComplete="new-password" />

            <button type="button" onClick={() => setShowOptional((s) => !s)} className="text-xs text-cyan-accent text-left">
              {showOptional ? "− Hide" : "+ Add"} optional health details
            </button>

            {showOptional && (
              <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" type="number" placeholder="Age" value={form.age} onChange={(e) => update("age", e.target.value)} />
                  <select className="input" value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                    <option value="">Gender</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" type="number" placeholder="Height (cm)" value={form.height_cm} onChange={(e) => update("height_cm", e.target.value)} />
                  <input className="input" type="number" placeholder="Weight (kg)" value={form.weight_kg} onChange={(e) => update("weight_kg", e.target.value)} />
                </div>
                <select className="input" value={form.activity_level} onChange={(e) => update("activity_level", e.target.value)}>
                  <option value="">Activity level</option>
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Lightly active</option>
                  <option value="moderate">Moderately active</option>
                  <option value="active">Active</option>
                  <option value="very_active">Very active</option>
                </select>
                <select className="input" value={form.nutrition_goal} onChange={(e) => update("nutrition_goal", e.target.value)}>
                  <option value="">Nutrition goal</option>
                  <option value="lose_weight">Lose weight</option>
                  <option value="maintain">Maintain weight</option>
                  <option value="gain_muscle">Gain muscle</option>
                  <option value="general_health">General health</option>
                </select>
              </div>
            )}

            {error && <div className="text-sm text-danger">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <div className="text-center text-xs text-white/40 mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-cyan-accent">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
