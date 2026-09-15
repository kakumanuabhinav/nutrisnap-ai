import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/authService";
import { ApiError } from "../services/apiClient";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="text-cyan-accent text-2xl">🥗</span>
          <span className="font-bold">NutriSnap AI</span>
        </div>
        <div className="card">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">✉️</div>
              <h1 className="font-bold mb-1">Check your email</h1>
              <p className="text-sm text-white/40">
                If an account exists for {email}, we've sent a password reset link.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-1">Reset your password</h1>
              <p className="text-sm text-white/40 mb-6">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                  type="email"
                  required
                  className="input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {error && <div className="text-sm text-danger">{error}</div>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
          <div className="text-center text-xs text-white/40 mt-4">
            <Link to="/login" className="text-cyan-accent">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
