import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Blocks access to any route for unauthenticated users.
 * Redirects to /login, preserving the intended URL via `state.from`.
 */
export default function ProtectedRoute() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (
    user?.must_change_password &&
    window.location.pathname !== "/auth/force-password-change"
  ) {
    return <Navigate to="/auth/force-password-change" replace />;
  }

  return <Outlet />;
}
