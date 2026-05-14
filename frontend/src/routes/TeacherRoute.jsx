import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Teacher portal URLs must not be used by students (they show grading UI and read-only previews).
 * Students are redirected to the matching student homework screen when possible.
 */
export default function TeacherRoute() {
  const { user } = useAuth();
  const role = user?.role;
  const loc = useLocation();

  if (role === "student") {
    const m = loc.pathname.match(/\/homework\/([^/]+)\/submissions\/?$/);
    const homeworkId = m?.[1];
    if (homeworkId) {
      return <Navigate to={`/student/homework/${homeworkId}`} replace />;
    }
    return <Navigate to="/student/dashboard" replace />;
  }

  if (role === "manager") {
    return <Navigate to="/manager/dashboard" replace />;
  }

  if (role !== "teacher" && role !== "admin" && role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
