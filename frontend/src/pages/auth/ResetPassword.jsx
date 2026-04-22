import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../../services/api";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/password-reset/confirm", {
        token,
        new_password: password,
      });
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Reset failed. The link may have expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert
          type="error"
          message="Invalid reset link. Please request a new one."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <span className="text-white text-3xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {success ? (
            <Alert
              type="success"
              message="Password reset successfully! Redirecting to login…"
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert
                  type="error"
                  message={error}
                  dismissible
                  onDismiss={() => setError("")}
                />
              )}

              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="Min 8 chars, include uppercase, number & special character."
                required
                autoFocus
              />

              <Input
                label="Confirm Password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />

              <Button type="submit" fullWidth loading={loading}>
                Reset Password
              </Button>
            </form>
          )}

          <div className="text-center mt-4">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
