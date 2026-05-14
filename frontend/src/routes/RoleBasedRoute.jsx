import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_DASHBOARDS = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
  manager: "/manager/dashboard",
  admin: "/admin/dashboard",
  super_admin: "/admin/dashboard",
};

/**
 * After a successful login the frontend calls <RoleBasedRedirect />.
 * It reads the authenticated user's role and pushes to the correct dashboard.
 */
export default function RoleBasedRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user?.must_change_password) {
    return <Navigate to="/auth/force-password-change" replace />;
  }

  const dest = ROLE_DASHBOARDS[user.role] || "/login";
  return <Navigate to={dest} replace />;
}

export { ROLE_DASHBOARDS };
