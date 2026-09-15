import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { checkBackendHealth, API_BASE } from "../services/apiClient";

const NAV_ITEMS = [
  { to: "/app/dashboard", label: "Dashboard", icon: "◧" },
  { to: "/app/scan", label: "Scan", icon: "◎" },
  { to: "/app/tracker", label: "Tracker", icon: "◔" },
  { to: "/app/history", label: "History", icon: "☰" },
  { to: "/app/analytics", label: "Analytics", icon: "📈" },
  { to: "/app/profile", label: "Profile", icon: "◍" },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [backendError, setBackendError] = useState<string | null>(null);

  async function testBackend() {
    const health = await checkBackendHealth();
    if (!health.ok) {
      setBackendError(health.message || `Backend server is not reachable at ${API_BASE}`);
    } else {
      setBackendError(null);
    }
  }

  useEffect(() => {
    testBackend();
    const interval = setInterval(testBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 border-r border-white/5 p-5 gap-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-1">
          <span className="text-cyan-accent text-2xl">🥗</span>
          <span className="font-bold tracking-tight">NutriSnap AI</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                  isActive
                    ? "bg-cyan-accent/10 text-cyan-accent"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <NavLink
            to="/app/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5"
          >
            ⚙ Settings
          </NavLink>
          <div className="px-3 py-2 text-xs text-white/40 truncate">{user?.email}</div>
          <button onClick={() => logout()} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-danger hover:bg-white/5">
            ⎋ Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 sticky top-0 bg-bg/95 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <span className="text-cyan-accent text-xl">🥗</span>
          <span className="font-bold text-sm">NutriSnap AI</span>
        </div>
        <NavLink to="/app/settings" className="text-white/60 text-lg">⚙</NavLink>
      </header>

      <main className="flex-1 pb-20 md:pb-0 flex flex-col">
        {backendError && (
          <div className="bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs px-4 py-2.5 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{backendError}</span>
            </span>
            <button
              onClick={() => testBackend()}
              className="px-2.5 py-1 rounded bg-red-500/25 hover:bg-red-500/40 text-white font-medium transition ml-2 text-[11px]"
            >
              Retry
            </button>
          </div>
        )}
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-card border-t border-white/5 flex justify-around py-2 z-30">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${
                isActive ? "text-cyan-accent" : "text-white/50"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
