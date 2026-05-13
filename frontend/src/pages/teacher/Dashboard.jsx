import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import {
  AcademicCapIcon,
  UsersIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    teacherService
      .getDashboard(user.id)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <PageSpinner />;

  const stats = data?.stats || {};
  const classes = data?.classes || [];
  const recentSubs = data?.recent_submissions || [];

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.full_name?.split(" ")[0]}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <StatCard icon={<AcademicCapIcon className="h-5 w-5 text-indigo-600" />} label="Classes" value={stats.total_classes ?? 0} color="indigo" />
        <StatCard icon={<UsersIcon className="h-5 w-5 text-green-600" />} label="Students" value={stats.total_students ?? 0} color="green" />
        <StatCard icon={<ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />} label="Published HW" value={stats.hw_published ?? 0} color="blue" />
        <StatCard icon={<PencilSquareIcon className="h-5 w-5 text-amber-600" />} label="Draft HW" value={stats.hw_draft ?? 0} color="amber" />
        <StatCard
          icon={<ClockIcon className="h-5 w-5 text-red-500" />}
          label="Needs Review"
          value={stats.pending_review ?? 0}
          color="red"
          highlight={stats.pending_review > 0}
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction to="/teacher/classes" icon={<AcademicCapIcon className="h-5 w-5" />} label="My Classes" color="indigo" />
          <QuickAction to="/teacher/homework" icon={<ClipboardDocumentListIcon className="h-5 w-5" />} label="Homework" color="blue" />
          <QuickAction to="/teacher/exams" icon={<BookOpenIcon className="h-5 w-5" />} label="Exams" color="purple" />
          <QuickAction to="/teacher/curriculum" icon={<BookOpenIcon className="h-5 w-5" />} label="My Curriculum" color="teal" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">My Classes</h2>
            <Link to="/teacher/classes" className="text-xs text-indigo-600 hover:underline">View all →</Link>
          </div>
          {classes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
              No classes assigned yet. Contact your admin.
            </div>
          ) : (
            <div className="space-y-2">
              {classes.slice(0, 5).map((cls) => (
                <Link
                  key={cls.id}
                  to={`/teacher/classes/${cls.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{cls.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cls.branch_name} · {cls.student_count ?? 0} students
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cls.attendance_taken_today ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        <CheckCircleIcon className="h-3 w-3" /> Attendance done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        <ExclamationCircleIcon className="h-3 w-3" /> Mark attendance
                      </span>
                    )}
                    <ChevronRightIcon className="h-4 w-4 text-gray-300 group-hover:text-indigo-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending submissions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Pending Reviews
              {recentSubs.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  {stats.pending_review}
                </span>
              )}
            </h2>
            <Link to="/teacher/homework" className="text-xs text-indigo-600 hover:underline">All homework →</Link>
          </div>
          {recentSubs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
              No pending submissions right now.
            </div>
          ) : (
            <div className="space-y-2">
              {recentSubs.map((sub) => (
                <Link
                  key={sub.id}
                  to={`/teacher/classes/${sub.class_id}/homework/${sub.homework_id}/submissions`}
                  className="flex items-start justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-red-200 hover:bg-red-50/30 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{sub.homework_title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sub.student_name}
                      {sub.is_late ? " · Late" : ""}
                      {sub.submitted_at ? ` · ${new Date(sub.submitted_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    <ClockIcon className="h-3 w-3" /> Review
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className={`rounded-2xl border p-4 bg-white flex flex-col gap-2 ${highlight ? "border-red-200 bg-red-50/40" : "border-gray-200"}`}>
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function QuickAction({ to, icon, label, color }) {
  const colors = {
    indigo: "text-indigo-700 bg-indigo-50 border-indigo-100 hover:bg-indigo-100",
    blue: "text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100",
    purple: "text-purple-700 bg-purple-50 border-purple-100 hover:bg-purple-100",
    teal: "text-teal-700 bg-teal-50 border-teal-100 hover:bg-teal-100",
    amber: "text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100",
  };
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${colors[color] || colors.indigo}`}
    >
      {icon}
      {label}
    </Link>
  );
}
