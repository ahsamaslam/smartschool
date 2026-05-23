import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import PeriodFilter from "../../components/analytics/PeriodFilter";
import CVICard from "../../components/analytics/CVICard";
import ScoreBadge from "../../components/analytics/ScoreBadge";
import {
  AcademicCapIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Analytics state
  const [analyticsFilter, setAnalyticsFilter] = useState({
    period: "last_month",
  });
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    teacherService
      .getDashboard(user.id)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const loadAnalytics = useCallback(() => {
    const { period, start, end } = analyticsFilter;
    setAnalyticsLoading(true);
    teacherService
      .getAnalyticsOverview(period, start, end)
      .then((res) => setAnalytics(res.data))
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsFilter]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

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
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <StatCard
          icon={<AcademicCapIcon className="h-5 w-5 text-indigo-600" />}
          label="Classes"
          value={stats.total_classes ?? 0}
          color="indigo"
        />
        <StatCard
          icon={<UsersIcon className="h-5 w-5 text-green-600" />}
          label="Students"
          value={stats.total_students ?? 0}
          color="green"
        />
        <StatCard
          icon={<ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />}
          label="Published HW"
          value={stats.hw_published ?? 0}
          color="blue"
        />
        <StatCard
          icon={<PencilSquareIcon className="h-5 w-5 text-amber-600" />}
          label="Draft HW"
          value={stats.hw_draft ?? 0}
          color="amber"
        />
        <StatCard
          icon={<ClockIcon className="h-5 w-5 text-red-500" />}
          label="Needs Review"
          value={stats.pending_review ?? 0}
          color="red"
          highlight={stats.pending_review > 0}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">My Classes</h2>
            <Link
              to="/teacher/classes"
              className="text-xs text-indigo-600 hover:underline"
            >
              View all →
            </Link>
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
                  to={`/teacher/attendance?class_id=${cls.id}&locked=true`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {cls.name}
                    </p>
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
                        <ExclamationCircleIcon className="h-3 w-3" /> Mark
                        attendance
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
            <Link
              to="/teacher/homework"
              className="text-xs text-indigo-600 hover:underline"
            >
              All homework →
            </Link>
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
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {sub.homework_title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sub.student_name}
                      {sub.is_late ? " · Late" : ""}
                      {sub.submitted_at
                        ? ` · ${new Date(sub.submitted_at).toLocaleDateString()}`
                        : ""}
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

      {/* ── Performance Analytics ────────────────────────── */}
      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Performance Analytics
          </h2>
          <PeriodFilter
            period={analyticsFilter.period}
            start={analyticsFilter.start}
            end={analyticsFilter.end}
            onChange={setAnalyticsFilter}
          />
        </div>

        {analyticsLoading ? (
          <div className="py-10 text-center text-sm text-gray-400">
            Loading analytics…
          </div>
        ) : !analytics ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
            Analytics data not available yet. Scores are calculated nightly.
          </div>
        ) : (
          <>
            {/* Teacher summary bar */}
            <div className="flex flex-wrap items-center gap-6 mb-5 rounded-2xl border border-gray-200 bg-white p-4">
              {/* CVI Score */}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  My CVI Score
                </p>
                <p className="text-2xl font-bold tabular-nums text-indigo-700 mt-0.5">
                  {typeof analytics.overall_cvi === "number"
                    ? analytics.overall_cvi.toFixed(1)
                    : "—"}
                  <span className="text-sm font-normal text-gray-400"> / 100</span>
                </p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              {/* Grade */}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  Grade
                </p>
                {analytics.overall_grade ? (
                  <span className={`inline-block mt-0.5 text-sm font-bold px-2.5 py-1 rounded-full ${
                    analytics.overall_grade === "Excellent" ? "bg-blue-100 text-blue-700"
                    : analytics.overall_grade === "Good" ? "bg-green-100 text-green-700"
                    : analytics.overall_grade === "Satisfactory" ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-700"
                  }`}>
                    {analytics.overall_grade}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
              <div className="w-px h-10 bg-gray-200" />
              {/* Active Alerts */}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  Active Alerts
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xl font-bold ${(analytics.active_alert_count || 0) > 0 ? "text-red-600" : "text-gray-700"}`}>
                    {analytics.active_alert_count ?? 0}
                  </span>
                  {(analytics.active_alert_count || 0) > 0 && (
                    <BellAlertIcon className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              {/* What CVI means */}
              <div className="text-xs text-gray-400 max-w-xs">
                CVI = Class Vitality Index. Measures your teaching effectiveness: avg student SHS (35%), improvement velocity (25%), class consistency (20%), homework success (20%).
              </div>
            </div>

            {/* CVI per class */}
            {(analytics.classes || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
                No class analytics for this period.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.classes.map((cls) => (
                  <Link
                    key={cls.class_id}
                    to={`/teacher/classes/${cls.class_id}`}
                  >
                    <CVICard data={cls} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div
      className={`rounded-2xl border p-4 bg-white flex flex-col gap-2 ${highlight ? "border-red-200 bg-red-50/40" : "border-gray-200"}`}
    >
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <p
        className={`text-2xl font-bold tabular-nums ${highlight ? "text-red-600" : "text-gray-900"}`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
