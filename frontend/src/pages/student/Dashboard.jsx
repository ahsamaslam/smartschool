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
import { ChevronRightIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const RISK_CONFIG = {
  critical:   { label: "Critical",   bg: "bg-red-50",     border: "border-red-200",    text: "text-red-700",    score: "text-red-600"    },
  at_risk:    { label: "At-Risk",    bg: "bg-amber-50",   border: "border-amber-200",  text: "text-amber-700",  score: "text-amber-600"  },
  stable:     { label: "Stable",     bg: "bg-green-50",   border: "border-green-200",  text: "text-green-700",  score: "text-green-600"  },
  excelling:  { label: "Excelling",  bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700",   score: "text-blue-600"   },
};

function SHSBar({ value, color = "bg-indigo-500" }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [learnSummary, setLearnSummary] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [shsData, setShsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      studentService.getDashboard(user.id).catch(() => ({ data: {} })),
      learningService.getDashboardSummary().catch(() => null),
      studentService.getAttendanceSummary(user.id).catch(() => ({ data: null })),
      learningService.getSHS().catch(() => ({ data: [] })),
    ])
      .then(([dash, summary, attendance, shs]) => {
        setSubjects(dash.data?.subjects || []);
        setLearnSummary(summary?.data || null);
        setAttendanceSummary(attendance?.data || null);
        setShsData(Array.isArray(shs?.data) ? shs.data : []);
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

      {/* SHS Health Score Section */}
      {shsData.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
              Student Health Score (SHS)
            </h2>
            <p className="text-xs text-gray-400">Video × 0.25 · Attendance × 0.35 · Homework × 0.40</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shsData.map((cls) => {
              const risk = RISK_CONFIG[cls.risk_level] || RISK_CONFIG.stable;
              const books = cls.books || [];
              const multiBook = books.filter(b => b.total_lectures > 0).length > 1;
              return (
                <div key={cls.class_id} className={`rounded-2xl border ${risk.border} ${risk.bg} p-5`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{cls.class_name}</p>
                      {cls.section && <p className="text-xs text-gray-400">{cls.section}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-black ${risk.score}`}>{cls.shs.toFixed(1)}</p>
                      <span className={`text-xs font-bold uppercase ${risk.text}`}>{risk.label}</span>
                    </div>
                  </div>

                  {/* Overall component bars */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                        <span>Video (25%)</span>
                        <span>{cls.video.watched_count}/{cls.video.total_lectures} lectures · {cls.video.rate.toFixed(0)}%</span>
                      </div>
                      <SHSBar value={cls.video.rate} color="bg-indigo-400" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                        <span>Attendance (35%)</span>
                        <span>{cls.attendance.present_days}/{cls.attendance.total_days} days · {cls.attendance.rate.toFixed(0)}%</span>
                      </div>
                      <SHSBar value={cls.attendance.rate} color="bg-emerald-400" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                        <span>Homework (40%)</span>
                        <span>
                          {cls.homework.graded_count > 0 && cls.homework.total_marks_available > 0
                            ? `${cls.homework.marks_earned?.toFixed(0)}/${cls.homework.total_marks_available?.toFixed(0)} marks · ${cls.homework.rate.toFixed(0)}%`
                            : `${cls.homework.submitted_count}/${cls.homework.total_homeworks} done · ${cls.homework.rate.toFixed(0)}%`}
                        </span>
                      </div>
                      <SHSBar value={cls.homework.rate} color="bg-violet-400" />
                    </div>
                  </div>

                  {/* Per-book video breakdown (only when multiple books) */}
                  {multiBook && (
                    <div className="mt-4 pt-3 border-t border-white/50">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Video by Subject</p>
                      <div className="space-y-2">
                        {books.map((b, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                              <span className="truncate max-w-[55%]" title={`${b.subject_name} — ${b.book_title}`}>
                                {b.subject_name}
                              </span>
                              <span>
                                {b.total_lectures > 0
                                  ? `${b.watched_count}/${b.total_lectures} · ${b.video_rate.toFixed(0)}%`
                                  : "No lectures"}
                              </span>
                            </div>
                            {b.total_lectures > 0 && (
                              <SHSBar value={b.video_rate} color={b.video_rate >= 75 ? "bg-indigo-500" : b.video_rate >= 40 ? "bg-amber-400" : "bg-red-400"} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* At-risk tip */}
                  {(cls.risk_level === "critical" || cls.risk_level === "at_risk") && (
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 bg-white/60 rounded-lg px-2.5 py-1.5">
                      <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {cls.video.rate < cls.attendance.rate && cls.video.rate < cls.homework.rate
                        ? "Watch more lectures (≥75%) to boost your Video score."
                        : cls.homework.rate < cls.attendance.rate && cls.homework.rate < cls.video.rate
                        ? "Submit pending homework to raise your score."
                        : "Improve your attendance to raise your SHS."}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Book</th>
                <th className="text-left px-4 py-3">Teacher</th>
                <th className="text-left px-4 py-3">Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(attendanceSummary?.courses || []).map((c, i) => (
                <tr key={`${c.class_id}-${c.subject_name}-${i}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.subject_name || c.class_name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.book_title || '—'}</td>
                  <td className="px-4 py-3 text-gray-800">{c.teacher_name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.class_name}</td>
                </tr>
              ))}
              {(attendanceSummary?.courses || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={4}>
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
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">T/L</th>
                <th className="text-left px-4 py-3">P</th>
                <th className="text-left px-4 py-3">A</th>
                <th className="text-left px-4 py-3">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(attendanceSummary?.courses || []).map((c, i) => (
                <tr key={`${c.class_id}-${c.subject_name}-att-${i}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.teacher_name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.subject_name || '—'}</td>
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
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
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
