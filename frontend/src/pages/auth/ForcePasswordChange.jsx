import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLE_DASHBOARDS } from "../../routes/RoleBasedRoute";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import api from "../../services/api";
import { API_ROUTES } from "../../utils/constants";

export default function ForcePasswordChange() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const destination = useMemo(
    () => ROLE_DASHBOARDS[user?.role] || "/",
    [user?.role],
  );

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.must_change_password) {
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      await api.post(
        `${API_ROUTES.AUTH}/password/change`,
        {
          user_id: user.id,
          old_password: oldPassword,
          new_password: newPassword,
        },
        { skipAuthRedirect: true },
      );

      updateUser({ must_change_password: false });
      navigate(destination, { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to change password.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-gray-900">
          Change Temporary Password
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          Your account requires a password update before you can continue.
        </p>

        {error && (
          <Alert
            type="error"
            message={error}
            dismissible
            onDismiss={() => setError("")}
            className="mt-5"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <Input
            label="Current Password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Enter your temporary password"
            required
            autoComplete="current-password"
          />

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
            autoComplete="new-password"
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Button type="submit" fullWidth loading={saving}>
            Update Password
          </Button>
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
