import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import studentService from "../../services/studentService";
import learningService from "../../services/learningService";
import SubjectCard from "../../components/student/SubjectCard";
import PerformanceChart from "../../components/student/PerformanceChart";
import AttendanceBarChart from "../../components/student/AttendanceBarChart";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [learnSummary, setLearnSummary] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      studentService.getDashboard(user.id).catch(() => ({ data: {} })),
      learningService.getDashboardSummary().catch(() => null),
      studentService.getAttendanceSummary(user.id).catch(() => ({ data: null })),
    ])
      .then(([dash, summary, attendance]) => {
        setSubjects(dash.data?.subjects || []);
        setLearnSummary(summary?.data || null);
        setAttendanceSummary(attendance?.data || null);
      })
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <PageSpinner />;

  // Build chart data from subjects
  const chartData = subjects.map((s) => ({
    topic: s.subject_name,
    score: Math.round(s.highest_score || 0),
    average: Math.round(s.average_score || 0),
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome back, {user?.full_name?.split(" ")[0] || "Student"}!
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Here's an overview of your progress.
      </p>

      {error && <Alert type="error" message={error} className="mb-6" />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          to="/student/courses"
          className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm hover:border-indigo-200 transition-colors"
        >
          <p className="text-xs font-semibold uppercase text-indigo-600 mb-1">
            Learning
          </p>
          <p className="text-lg font-semibold text-gray-900">My Courses</p>
          <p className="text-sm text-gray-500 mt-1">
            Books and topics for your section.
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 mt-3">
            Open <ChevronRightIcon className="h-4 w-4" />
          </span>
        </Link>
        <Link
          to="/student/exams"
          className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm hover:border-emerald-200 transition-colors"
        >
          <p className="text-xs font-semibold uppercase text-emerald-700 mb-1">
            Exams
          </p>
          <p className="text-lg font-semibold text-gray-900">My Exams</p>
          <p className="text-sm text-gray-500 mt-1">
            Upcoming {learnSummary?.exams_upcoming ?? "—"} · Active{" "}
            {learnSummary?.exams_active ?? "—"}
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 mt-3">
            View <ChevronRightIcon className="h-4 w-4" />
          </span>
        </Link>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">
            Topic progress
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {learnSummary?.progress_percent != null
              ? `${learnSummary.progress_percent}%`
              : "—"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {learnSummary?.topics_completed ?? "—"} of{" "}
            {learnSummary?.topics_tracked ?? "—"} topics completed
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">
            Available exams
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {learnSummary?.finalized_exam_count != null
              ? learnSummary.finalized_exam_count
              : "—"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Finalized for your enrolled sections.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-8">
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
              Attendance
            </h2>
            <p className="text-sm font-semibold text-gray-700">
              Overall: {attendanceSummary?.overall?.attendance_percent ?? 0}%
            </p>
          </div>
          <AttendanceBarChart data={attendanceSummary?.graph || []} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-3">
            Attendance Summary
          </h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Present</p>
              <p className="text-2xl font-bold text-green-700">
                {attendanceSummary?.overall?.present_days ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Total Classes Marked</p>
              <p className="text-2xl font-bold text-gray-900">
                {attendanceSummary?.overall?.total_days ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Attendance %</p>
              <p className="text-2xl font-bold text-indigo-700">
                {attendanceSummary?.overall?.attendance_percent ?? 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
            Current Course Enrolled
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left px-4 py-3">Course Name</th>
                <th className="text-left px-4 py-3">Teacher Name</th>
                <th className="text-left px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(attendanceSummary?.courses || []).map((c) => (
                <tr key={c.class_id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.class_name}</td>
                  <td className="px-4 py-3 text-gray-800">{c.teacher_name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.teaching_type}</td>
                </tr>
              ))}
              {(attendanceSummary?.courses || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={3}>
                    No enrolled classes found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
            Attendance by Teacher
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left px-4 py-3">Teacher Name</th>
                <th className="text-left px-4 py-3">T/L</th>
                <th className="text-left px-4 py-3">P</th>
                <th className="text-left px-4 py-3">A</th>
                <th className="text-left px-4 py-3">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(attendanceSummary?.courses || []).map((c) => (
                <tr key={`${c.class_id}-attendance`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.teacher_name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.teaching_type}</td>
                  <td className="px-4 py-3 text-gray-700">{c.present_days}</td>
                  <td className="px-4 py-3 text-gray-700">{c.absent_days}</td>
                  <td className="px-4 py-3 font-semibold text-indigo-700">
                    {Number(c.attendance_percent || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {(attendanceSummary?.courses || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                    Attendance has not been marked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(learnSummary?.recent_topics?.length > 0 ||
        (learnSummary?.completed_topics_list?.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {learnSummary?.recent_topics?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                  Continue learning
                </h2>
                <Link
                  to="/student/courses"
                  className="text-sm text-indigo-600 font-medium"
                >
                  All courses
                </Link>
              </div>
              <ul className="divide-y divide-gray-100">
                {learnSummary.recent_topics.slice(0, 5).map((t) => (
                  <li key={t.topic_id}>
                    <Link
                      to={`/student/learn/topic/${t.topic_id}`}
                      className="flex items-center justify-between py-2.5 text-sm text-gray-800 hover:text-indigo-700"
                    >
                      <span className="truncate">{t.title}</span>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {learnSummary?.completed_topics_list?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">
                Recently completed
              </h2>
              <ul className="divide-y divide-gray-100">
                {learnSummary.completed_topics_list.slice(0, 5).map((t) => (
                  <li key={t.topic_id}>
                    <Link
                      to={`/student/learn/topic/${t.topic_id}`}
                      className="flex items-center justify-between py-2.5 text-sm text-gray-800 hover:text-indigo-700"
                    >
                      <span className="truncate">{t.title}</span>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-8">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">
            Performance Overview
          </h2>
          <PerformanceChart data={chartData} />
        </div>
      )}

      {/* Subjects Grid */}
      <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">
        My Subjects
      </h2>
      {subjects.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-12">
          No subjects enrolled.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject) => (
            <SubjectCard key={subject.subject_id} subject={subject} />
          ))}
        </div>
      )}
    </div>
  );
}
