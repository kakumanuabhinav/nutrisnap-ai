import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { profileService } from "../services/profileService";
import { API_BASE } from "../services/apiClient";
import { ApiError } from "../services/apiClient";

export function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState({ mealReminders: true, weeklyReport: true });
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwMessage(null);
    try {
      await profileService.changePassword(currentPassword, newPassword);
      setPwMessage("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : "Could not update password.");
    }
  }

  async function handleDeleteAccount() {
    await profileService.deleteAccount();
    navigate("/");
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex flex-col gap-5">
        <div className="card">
          <div className="text-sm font-semibold mb-1">Account</div>
          <div className="text-sm text-white/50">{user?.email}</div>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-4">Change Password</div>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <input
              type="password"
              className="input"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            <input
              type="password"
              className="input"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            {pwError && <div className="text-sm text-danger">{pwError}</div>}
            {pwMessage && <div className="text-sm text-good">{pwMessage}</div>}
            <button type="submit" className="btn-secondary">
              Update Password
            </button>
          </form>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-4">Notification Preferences</div>
          <label className="flex items-center justify-between py-2 text-sm">
            Meal logging reminders
            <input
              type="checkbox"
              checked={notifications.mealReminders}
              onChange={(e) => setNotifications((n) => ({ ...n, mealReminders: e.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between py-2 text-sm">
            Weekly nutrition report
            <input
              type="checkbox"
              checked={notifications.weeklyReport}
              onChange={(e) => setNotifications((n) => ({ ...n, weeklyReport: e.target.checked }))}
            />
          </label>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-2">Privacy & Data</div>
          <p className="text-xs text-white/40 mb-3">
            Export a copy of your profile and meal history as JSON.
          </p>
          <a href={`${API_BASE}/profile/export`} className="btn-secondary inline-block text-sm">
            Export My Data
          </a>
        </div>

        <div className="card border-danger/20">
          <div className="text-sm font-semibold text-danger mb-2">Delete Account</div>
          <p className="text-xs text-white/40 mb-3">
            Permanently deletes your account and all logged meals. This cannot be undone.
          </p>
          {confirmDelete ? (
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button className="btn-primary flex-1 !bg-danger !text-white" onClick={handleDeleteAccount}>
                Confirm Delete
              </button>
            </div>
          ) : (
            <button className="btn-secondary text-danger" onClick={() => setConfirmDelete(true)}>
              Delete My Account
            </button>
          )}
        </div>

        <button className="btn-secondary" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}
