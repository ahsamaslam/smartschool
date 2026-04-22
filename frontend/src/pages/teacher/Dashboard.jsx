import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Card from "../../components/common/Card";
import {
  AcademicCapIcon,
  UsersIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    teacherService
      .getClasses(user.id)
      .then((res) => setClasses(res.data || []))
      .catch(() => setError("Failed to load classes."))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <PageSpinner />;

  const totalStudents = classes.reduce(
    (sum, c) => sum + (c.student_count || 0),
    0,
  );
  const totalSubjects = classes.reduce(
    (sum, c) => sum + (c.subject_count || 0),
    0,
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome, {user?.full_name?.split(" ")[0]}!
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Here's your teaching overview.
      </p>

      {error && <Alert type="error" message={error} className="mb-6" />}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<AcademicCapIcon className="h-6 w-6 text-blue-600" />}
          label="Classes"
          value={classes.length}
        />
        <StatCard
          icon={<UsersIcon className="h-6 w-6 text-green-600" />}
          label="Total Students"
          value={totalStudents}
        />
        <StatCard
          icon={<BookOpenIcon className="h-6 w-6 text-purple-600" />}
          label="Subjects"
          value={totalSubjects}
        />
      </div>

      {/* Classes list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
          My Classes
        </h2>
        <Link
          to="/teacher/classes"
          className="text-sm text-blue-600 hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.slice(0, 6).map((cls) => (
          <Link
            key={cls.id}
            to={`/teacher/classes/${cls.id}`}
            className="block bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <h3 className="font-semibold text-gray-900">{cls.name}</h3>
            <p className="text-xs text-blue-600">
              {cls.branch_name} · {cls.school_name}
            </p>
            <div className="mt-3 flex gap-4 text-xs text-gray-500">
              <span>{cls.student_count} students</span>
              <span>{cls.subject_count} subjects</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}
