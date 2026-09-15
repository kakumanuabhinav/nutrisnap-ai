import { Link } from "react-router-dom";

const FEATURES = [
  { icon: "📷", title: "Snap Any Meal", desc: "Upload or capture a photo — no manual logging." },
  { icon: "🤖", title: "AI Vision Analysis", desc: "Gemini identifies foods and estimates nutrition instantly." },
  { icon: "📊", title: "Full Nutrient Breakdown", desc: "Calories, macros, and key micronutrients per meal." },
  { icon: "💡", title: "Health Insights", desc: "Plain-language notes on what's good and what to watch." },
  { icon: "📈", title: "Trends Over Time", desc: "Weekly and monthly nutrition analytics from your real history." },
  { icon: "📱", title: "Install as an App", desc: "Full PWA support — works like a native app on your phone." },
];

const STEPS = [
  { step: "1", title: "Snap a photo", desc: "Take a picture of your meal or upload one." },
  { step: "2", title: "AI analyzes it", desc: "Gemini Vision identifies foods and estimates nutrition." },
  { step: "3", title: "Log & track", desc: "Save it to your daily tracker with one tap." },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-cyan-accent text-2xl">🥗</span>
          <span className="font-bold tracking-tight">NutriSnap AI</span>
        </div>
        <div className="flex gap-3">
          <Link to="/login" className="btn-secondary px-4 py-2 text-sm">
            Sign In
          </Link>
          <Link to="/register" className="btn-primary px-4 py-2 text-sm">
            Get Started
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto text-center px-6 pt-16 pb-20">
        <div className="inline-block text-xs px-3 py-1 rounded-full border border-cyan-accent/30 text-cyan-accent mb-6">
          Powered by Gemini Vision AI
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
          Snap your meal.
          <br />
          <span className="text-cyan-accent">Know your nutrition.</span>
        </h1>
        <p className="text-white/50 mt-6 max-w-xl mx-auto">
          NutriSnap AI turns a single photo into instant calories, macros, and health insights —
          then tracks it all for you.
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <Link to="/register" className="btn-primary">
            Scan My Meal
          </Link>
          <Link to="/login" className="btn-secondary">
            Sign In
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-10">Everything you need to eat smarter</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-semibold mb-1">{f.title}</div>
              <div className="text-sm text-white/50">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-cyan-accent/10 text-cyan-accent font-bold flex items-center justify-center mx-auto mb-3">
                {s.step}
              </div>
              <div className="font-semibold mb-1">{s.title}</div>
              <div className="text-sm text-white/50">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="card">
          <div className="text-3xl mb-3">📱</div>
          <h3 className="font-semibold text-lg mb-2">Install NutriSnap AI on your phone</h3>
          <p className="text-sm text-white/50 mb-4">
            Add it to your home screen for a fast, full-screen, app-like experience — works offline
            for your saved data too.
          </p>
          <Link to="/register" className="btn-primary inline-block">
            Get Started
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/30">
        © {new Date().getFullYear()} NutriSnap AI. Nutrition values are AI-generated estimates, not
        medical advice.
      </footer>
    </div>
  );
}
