import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, EyeIcon } from "@heroicons/react/24/outline";
import adminService from "../../services/adminService";
import examService from "../../services/examService";
import AdminStudentCurriculumExplorer from "../../components/curriculum/AdminStudentCurriculumExplorer";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { summarizeScope, formatHistoryClass } from "../../utils/studentPreviewScope";

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setScopeError("");
      setDetail(null);
      setScope(null);
      try {
        const dRes = await adminService.getStudentDetail(studentId);
        if (cancelled) return;
        setDetail(dRes.data);
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
          section curriculum API. Topic cards offer <strong>View slides</strong> (library
          presenter) and <strong>View recorded lecture</strong> when those materials exist; grey
          buttons are disabled until content is uploaded. Use a student login to test progress and
          the full learner player.
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
