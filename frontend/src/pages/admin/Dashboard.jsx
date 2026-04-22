import { useEffect, useState } from "react";
import adminService from "../../services/adminService";
import { PageSpinner } from "../../components/common/Spinner";
import {
  UsersIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
  BookOpenIcon,
  VideoCameraIcon,
  ChartBarIcon,
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

  const cards = [
    {
      label: "Students",
      value: stats?.total_students ?? 0,
      icon: <UsersIcon className="h-6 w-6 text-green-600" />,
      to: "/admin/users?role=student",
    },
    {
      label: "Teachers",
      value: stats?.total_teachers ?? 0,
      icon: <UsersIcon className="h-6 w-6 text-blue-600" />,
      to: "/admin/users?role=teacher",
    },
    {
      label: "Schools",
      value: stats?.total_schools ?? 0,
      icon: <BuildingOffice2Icon className="h-6 w-6 text-indigo-600" />,
      to: "/admin/schools",
    },
    {
      label: "Subjects",
      value: stats?.total_subjects ?? 0,
      icon: <BookOpenIcon className="h-6 w-6 text-purple-600" />,
      to: "/admin/curriculum",
    },
    {
      label: "Topics",
      value: stats?.total_topics ?? 0,
      icon: <AcademicCapIcon className="h-6 w-6 text-amber-600" />,
      to: "/admin/curriculum",
    },
    {
      label: "Video Templates",
      value: stats?.total_video_templates ?? 0,
      icon: <VideoCameraIcon className="h-6 w-6 text-red-500" />,
      to: "/admin/videos",
    },
    {
      label: "Classes",
      value: stats?.total_classes ?? 0,
      icon: <AcademicCapIcon className="h-6 w-6 text-teal-600" />,
      to: "/admin/schools",
    },
    {
      label: "Completed Quizzes",
      value: stats?.total_completed_quizzes ?? 0,
      icon: <ChartBarIcon className="h-6 w-6 text-gray-600" />,
      to: "/admin/users",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">System-wide overview.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {card.value}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction
          to="/admin/users"
          label="Manage Users"
          icon={<UsersIcon className="h-5 w-5" />}
        />
        <QuickAction
          to="/admin/schools"
          label="Schools & Branches"
          icon={<BuildingOffice2Icon className="h-5 w-5" />}
        />
        <QuickAction
          to="/admin/curriculum"
          label="Curriculum"
          icon={<BookOpenIcon className="h-5 w-5" />}
        />
        <QuickAction
          to="/admin/settings"
          label="AI Settings"
          icon={<AcademicCapIcon className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}

function QuickAction({ to, label, icon }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
    >
      {icon}
      {label}
    </Link>
  );
}
