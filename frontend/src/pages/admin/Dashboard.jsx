import { useEffect, useState } from "react";
import { PageSpinner } from "../../components/common/Spinner";
import {
  UsersIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
  BookOpenIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../../services/api").then(({ default: api }) => {
      api
        .get("/admins/stats/system")
        .then((res) => setStats(res.data))
        .finally(() => setLoading(false));
    });
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">System-wide overview.</p>

      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Students"
          value={stats?.total_students ?? 0}
          icon={<UserGroupIcon className="h-6 w-6 text-green-600" />}
          to="/admin/students"
          color="green"
        />
        <StatCard
          label="Teachers"
          value={stats?.total_teachers ?? 0}
          icon={<AcademicCapIcon className="h-6 w-6 text-blue-600" />}
          to="/admin/teachers"
          color="blue"
        />
        <StatCard
          label="Schools"
          value={stats?.total_schools ?? 0}
          icon={<BuildingOffice2Icon className="h-6 w-6 text-indigo-600" />}
          to="/admin/schools"
          color="indigo"
        />
        <StatCard
          label="Classes"
          value={stats?.total_classes ?? 0}
          icon={<AcademicCapIcon className="h-6 w-6 text-teal-600" />}
          to="/admin/schools"
          color="teal"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Subjects"
          value={stats?.total_subjects ?? 0}
          icon={<BookOpenIcon className="h-6 w-6 text-purple-600" />}
          to="/admin/curriculum"
          color="purple"
          small
        />
        <StatCard
          label="Topics"
          value={stats?.total_topics ?? 0}
          icon={<BookOpenIcon className="h-6 w-6 text-amber-600" />}
          to="/admin/curriculum"
          color="amber"
          small
        />
        <StatCard
          label="Completed Quizzes"
          value={stats?.total_completed_quizzes ?? 0}
          icon={<ChartBarIcon className="h-6 w-6 text-gray-500" />}
          to="/admin/users"
          color="gray"
          small
        />
        <StatCard
          label="Managers"
          value={stats?.total_managers ?? 0}
          icon={<UsersIcon className="h-6 w-6 text-rose-600" />}
          to="/admin/users"
          color="rose"
          small
        />
      </div>

      {/* Quick actions */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction to="/admin/teachers" label="Manage Teachers" icon={<AcademicCapIcon className="h-5 w-5" />} />
        <QuickAction to="/admin/students" label="Manage Students" icon={<UserGroupIcon className="h-5 w-5" />} />
        <QuickAction to="/admin/schools" label="Schools & Branches" icon={<BuildingOffice2Icon className="h-5 w-5" />} />
        <QuickAction to="/admin/library" label="Library / Books" icon={<BookOpenIcon className="h-5 w-5" />} />
        <QuickAction to="/admin/curriculum" label="Book Parser" icon={<ClipboardDocumentListIcon className="h-5 w-5" />} />
        <QuickAction to="/admin/settings" label="AI Settings" icon={<AcademicCapIcon className="h-5 w-5" />} />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, to, small }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all block"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <p className={`font-bold text-gray-900 tabular-nums ${small ? "text-xl" : "text-2xl"}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </Link>
  );
}

function QuickAction({ to, label, icon }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all"
    >
      {icon}
      {label}
    </Link>
  );
}
