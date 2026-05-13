import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, ChevronRightIcon, EyeIcon } from "@heroicons/react/24/outline";
import adminService from "../../services/adminService";
import examService from "../../services/examService";
import homeworkService from "../../services/homeworkService";
import studentService from "../../services/studentService";
import AdminStudentCurriculumExplorer from "../../components/curriculum/AdminStudentCurriculumExplorer";
import AttendanceBarChart from "../../components/student/AttendanceBarChart";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { summarizeScope, formatHistoryClass } from "../../utils/studentPreviewScope";

function displayBookTitle(raw) {
  if (!raw || typeof raw !== "string") return "—";
  const t = raw.trim();
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(t)) return t;
  return t
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function homeworkPreviewBucketLabel(bucket) {
  const labels = {
    missing: "Missing",
    late_open: "Overdue (late OK)",
    pending: "Pending",
    in_progress: "In progress",
    submitted_awaiting: "Submitted",
    late_awaiting: "Late (submitted)",
    reviewed: "Reviewed",
    returned: "Returned",
  };
  return labels[bucket] || String(bucket || "pending").replace(/_/g, " ");
}

function homeworkPreviewBucketClass(bucket) {
  const b = bucket || "pending";
  return (
    {
      missing: "bg-red-50 text-red-900 border-red-300",
      late_open: "bg-orange-50 text-orange-950 border-orange-300",
      pending: "bg-slate-100 text-slate-800 border-slate-300",
      in_progress: "bg-amber-50 text-amber-950 border-amber-300",
      submitted_awaiting: "bg-blue-50 text-blue-900 border-blue-300",
      late_awaiting: "bg-orange-50 text-orange-950 border-orange-300",
      reviewed: "bg-emerald-50 text-emerald-900 border-emerald-300",
      returned: "bg-violet-50 text-violet-900 border-violet-300",
    }[b] || "bg-slate-100 text-slate-800 border-slate-300"
  );
}

/**
 * Full-page admin preview: mirrors student “My Courses” navigation so you can verify
 * curriculum / section wiring without using a student login.
 */
export default function AdminStudentPreview() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [scope, setScope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scopeError, setScopeError] = useState("");
  const [hwPreview, setHwPreview] = useState(null);
  const [hwPreviewError, setHwPreviewError] = useState("");
  const [attendancePreview, setAttendancePreview] = useState(null);
  const [attendancePreviewError, setAttendancePreviewError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setScopeError("");
      setDetail(null);
      setScope(null);
      setHwPreview(null);
      setHwPreviewError("");
      setAttendancePreview(null);
      setAttendancePreviewError("");
      try {
        const dRes = await adminService.getStudentDetail(studentId);
        if (cancelled) return;
        setDetail(dRes.data);
        try {
          const hwRes = await homeworkService.adminStudentHomeworkList(studentId);
          if (!cancelled) {
            setHwPreview(hwRes.data);
            setHwPreviewError("");
          }
        } catch {
          if (!cancelled) {
            setHwPreview(null);
            setHwPreviewError("Could not load homework for this student.");
          }
        }
        try {
          const attRes = await studentService.getAttendanceSummary(studentId);
          if (!cancelled) {
            setAttendancePreview(attRes.data);
            setAttendancePreviewError("");
          }
        } catch {
          if (!cancelled) {
            setAttendancePreview(null);
            setAttendancePreviewError("Could not load attendance summary.");
          }
        }
        const active = dRes.data?.history?.find((h) => h.is_active);
        if (!active?.class_id) {
          setScope(null);
          return;
        }
        try {
          const sRes = await examService.getClassExamScope(active.class_id);
          if (!cancelled) setScope(sRes.data);
        } catch {
          if (!cancelled) {
            setScope(null);
            setScopeError("Could not load curriculum tree for this section.");
          }
        }
      } catch {
        if (!cancelled) setError("Student not found or you cannot view this record.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) return <PageSpinner />;

  if (error || !detail) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <BackBar navigate={navigate} />
        <Alert type="error" message={error || "Unknown error."} />
        <Link
          to="/admin/students"
          className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-600 font-medium"
        >
          ← Back to Students
        </Link>
      </div>
    );
  }

  const profile = detail.profile;
  const active = detail.history?.find((h) => h.is_active);
  const summary = scope ? summarizeScope(scope) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-16">
      <BackBar navigate={navigate} />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">
            Student view (preview)
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            navigate("/admin/students", { state: { openStudentId: studentId } })
          }
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 shadow-sm shrink-0"
        >
          <EyeIcon className="h-4 w-4 text-gray-500" />
          Manage enrollment &amp; record
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 mb-6">
        <p className="font-semibold text-amber-900 mb-1">How this preview works</p>
        <p className="text-amber-900/90">
          This page copies the <strong>student app layout</strong> (My Courses) using the same
          section curriculum API, and loads a read-only <strong>homework list</strong> plus{" "}
          <strong>attendance by class</strong> (same endpoints as the student dashboard, scoped to this learner).
          Topic cards offer <strong>View slides</strong> (library presenter) and{" "}
          <strong>View recorded lecture</strong> when those materials exist; grey buttons are disabled until content
          is uploaded. Use a student login to test progress and the full learner player.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Account</p>
          <p className="text-sm text-gray-900">
            <span className="text-gray-500">Status:</span>{" "}
            {profile.is_active ? (
              <span className="text-green-700 font-medium">Active</span>
            ) : (
              <span className="text-red-600 font-medium">Inactive</span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Profile record · School: {profile.school_name || "—"} · Branch:{" "}
            {profile.branch_name || "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Active enrollment (drives curriculum)
          </p>
          {!active ? (
            <p className="text-sm text-amber-800">No active enrollment.</p>
          ) : (
            <div className="text-sm text-gray-800 space-y-1">
              <p>
                <span className="text-gray-500">School / Branch:</span> {active.school_name} ·{" "}
                {active.branch_name}
              </p>
              <p>
                <span className="text-gray-500">Section:</span> {formatHistoryClass(active)}
              </p>
              <p>
                <span className="text-gray-500">Session:</span>{" "}
                {active.academic_session || "—"}
              </p>
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950 mb-8">
          <p className="font-semibold mb-1">Curriculum snapshot</p>
          <p>
            ~<strong>{summary.subjects}</strong> subjects · ~<strong>{summary.books}</strong>{" "}
            books · ~<strong>{summary.topics}</strong> topics (
            {summary.mode === "flat_legacy" ? "legacy" : "library"})
          </p>
        </div>
      )}

      {(hwPreviewError || attendancePreviewError) && (
        <div className="space-y-2 mb-6">
          {hwPreviewError && <Alert type="warning" message={hwPreviewError} />}
          {attendancePreviewError && <Alert type="warning" message={attendancePreviewError} />}
        </div>
      )}

      {hwPreview != null && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Homework (preview)</h2>
          <p className="text-xs text-gray-500 mb-3">
            Published items visible to this student after enrollment + curriculum rules (same as &quot;My
            Homework&quot;).
          </p>
          {hwPreview?.summary && (
            <p className="text-sm text-gray-700 mb-3">
              Open: <strong>{hwPreview.summary.action_open ?? 0}</strong> · Missing:{" "}
              <strong>{hwPreview.summary.missing ?? 0}</strong> · Reviewed:{" "}
              <strong>{hwPreview.summary.reviewed ?? 0}</strong>
            </p>
          )}
          <p className="text-xs text-gray-600 mb-3">
            <strong className="text-gray-800">Tap a row</strong> to open the teacher{" "}
            <strong className="text-gray-800">Submissions</strong> screen for that assignment (review the whole class,
            including this student). Actual answering happens in the student app under{" "}
            <strong className="text-gray-800">My Homework</strong>.
          </p>
          <ul className="list-none space-y-3 max-h-96 overflow-y-auto pr-1 m-0 p-0">
            {(hwPreview?.data || []).slice(0, 20).map((row) => {
              const cid = row.class_id != null ? String(row.class_id) : "";
              const hid = row.id != null ? String(row.id) : "";
              const to =
                cid && hid
                  ? `/teacher/classes/${cid}/homework/${hid}/submissions`
                  : null;
              const bucket = row.ui_bucket || "pending";
              const inner = (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-semibold text-gray-900 pr-2">{row.title || "Homework"}</span>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide border ${homeworkPreviewBucketClass(bucket)}`}
                    >
                      {homeworkPreviewBucketLabel(bucket)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-800">
                    <span className="text-gray-600 font-medium">Subject:</span> {row.subject_name || "—"}
                  </p>
                  <p className="text-sm text-gray-800">
                    <span className="text-gray-600 font-medium">Book:</span> {displayBookTitle(row.book_title)}
                  </p>
                  <p className="text-sm text-gray-800">
                    <span className="text-gray-600 font-medium">Topic:</span> {row.topic_title || "—"}
                  </p>
                  <p className="text-sm text-gray-800">
                    <span className="text-gray-600 font-medium">Due:</span>{" "}
                    {row.due_at ? new Date(row.due_at).toLocaleString() : "—"}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2">
                    <span className="text-xs font-semibold text-teal-900">
                      {to ? "Open submissions & review" : "Missing class link"}
                    </span>
                    {to && <ChevronRightIcon className="h-5 w-5 text-teal-700 shrink-0" aria-hidden />}
                  </div>
                </>
              );
              if (!to) {
                return (
                  <li
                    key={hid || row.title}
                    className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-3 text-sm"
                  >
                    {inner}
                  </li>
                );
              }
              return (
                <li key={hid}>
                  <Link
                    to={to}
                    className="block rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ul>
          {!hwPreview?.data?.length && (
            <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 p-4">
              No published homework matches this enrollment yet.
            </p>
          )}
        </section>
      )}

      {attendancePreview && (
        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Attendance by class</h2>
          <p className="text-xs text-gray-500 mb-4">
            Overall {Number(attendancePreview.overall?.attendance_percent ?? 0).toFixed(1)}% present across recorded days.
          </p>
          <AttendanceBarChart data={attendancePreview.graph || []} />
        </section>
      )}

      {scopeError && <Alert type="warning" message={scopeError} className="mb-6" />}

      {!active?.class_id ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-10 text-center text-gray-600 text-sm">
          Assign an active class/section from{" "}
          <button
            type="button"
            className="text-indigo-600 font-medium underline"
            onClick={() =>
              navigate("/admin/students", { state: { openStudentId: studentId } })
            }
          >
            Manage enrollment &amp; record
          </button>{" "}
          to preview curriculum.
        </div>
      ) : scope?.mode === "library_tree" ? (
        <AdminStudentCurriculumExplorer boards={scope.boards || []} active={active} />
      ) : scope?.mode === "flat_legacy" ? (
        <LegacyCoursesPreview subjects={scope.subjects || []} />
      ) : (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-8 text-center text-sm text-amber-900">
          {scopeError
            ? "Fix the error above to load the tree."
            : "No curriculum linked to this section yet (empty scope)."}
        </div>
      )}

      {detail.history?.length > 0 && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Enrollment history</h3>
          <div className="space-y-2">
            {detail.history.map((h) => (
              <div
                key={h.id}
                className={`rounded-xl border p-3 text-xs ${
                  h.is_active
                    ? "border-green-200 bg-green-50/40"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                {h.is_active && (
                  <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-800 mb-1">
                    Active
                  </span>
                )}
                <p className="font-medium text-gray-800">
                  {h.school_name} / {h.branch_name} / {formatHistoryClass(h)}
                </p>
                <p className="text-gray-600 mt-1">
                  Session {h.academic_session || "—"} · {h.status}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BackBar({ navigate }) {
  return (
    <button
      type="button"
      onClick={() => navigate("/admin/students")}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Students
    </button>
  );
}

function LegacyCoursesPreview({ subjects }) {
  if (!subjects.length) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
        No legacy subjects on this section.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {subjects.map((sub) => (
        <div
          key={sub.id}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-semibold text-gray-900 mb-3">{sub.name}</p>
          <ul className="space-y-2">
            {(sub.topics || []).map((t) => (
              <li
                key={t.id}
                className="text-sm text-gray-700 py-1 border-l-2 border-gray-200 pl-3"
              >
                {t.title}
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  Legacy topic — student learning links require student login.
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
