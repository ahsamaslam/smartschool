import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";

const SECTION_ORDER = [
  { key: "missing", title: "Missing", subtitle: "Past due with no submission" },
  { key: "late_open", title: "Overdue (late OK)", subtitle: "Past due — teacher allows late submission" },
  { key: "returned", title: "Returned for correction", subtitle: "Teacher sent back for updates" },
  { key: "pending", title: "Pending", subtitle: "Not started or due later" },
  { key: "in_progress", title: "In progress", subtitle: "Saved draft — finish and submit" },
  { key: "submitted_awaiting", title: "Submitted", subtitle: "Awaiting teacher review" },
  { key: "late_awaiting", title: "Late (submitted)", subtitle: "Submitted after due date" },
  { key: "reviewed", title: "Reviewed", subtitle: "Graded and feedback available" },
];

function labelForBucket(bucket) {
  const s = SECTION_ORDER.find((x) => x.key === bucket);
  return s?.title || bucket;
}

/** Turn slug-like library titles (e.g. pride-and-prejudice-jane-austen) into readable text for the card. */
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

/** Normalize id from API (UUID string, sometimes with braces). */
function homeworkRowId(row) {
  if (!row) return "";
  const raw = row.id ?? row.homework_id;
  if (raw == null) return "";
  return String(raw)
    .trim()
    .replace(/^\{|\}$/g, "");
}

function homeworkCta(bucket, homeworkType) {
  const isUpload = homeworkType === "upload";
  switch (bucket) {
    case "in_progress":
      return {
        label: "Continue & submit",
        hint: "Finish your answers or files, then submit.",
      };
    case "returned":
      return {
        label: "Update & resubmit",
        hint: "Your teacher returned this for changes.",
      };
    case "late_open":
      return {
        label: "Open & submit (late window)",
        hint: "Late submission is allowed for this assignment.",
      };
    case "submitted_awaiting":
    case "late_awaiting":
      return {
        label: "View submission",
        hint: "Submitted — waiting for teacher review.",
      };
    case "reviewed":
      return {
        label: "View marks & feedback",
        hint: "Open to see your score and teacher comments.",
      };
    case "missing":
      return {
        label: "Open homework",
        hint: "Past due — open to read instructions; you may not be able to submit.",
      };
    default:
      return {
        label: isUpload ? "Open & upload files" : "Open & answer questions",
        hint: "Work on this assignment on the next screen, then submit.",
      };
  }
}

function HomeworkCard({ row }) {
  const navigate = useNavigate();
  const hwId = homeworkRowId(row);
  const to = hwId ? `/student/homework/${encodeURIComponent(hwId)}` : null;
  const bucket = row.ui_bucket || "pending";
  const typeLabel = row.homework_type === "interactive" ? "Interactive" : "Upload";
  const due = row.due_at
    ? new Date(row.due_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";
  const cta = homeworkCta(bucket, row.homework_type);

  const badgeClass =
    {
      missing: "bg-red-50 text-red-900 border-red-300",
      late_open: "bg-orange-50 text-orange-950 border-orange-300",
      pending: "bg-slate-100 text-slate-800 border-slate-300",
      in_progress: "bg-amber-50 text-amber-950 border-amber-300",
      submitted_awaiting: "bg-blue-50 text-blue-900 border-blue-300",
      late_awaiting: "bg-orange-50 text-orange-950 border-orange-300",
      reviewed: "bg-emerald-50 text-emerald-900 border-emerald-300",
      returned: "bg-violet-50 text-violet-900 border-violet-300",
    }[bucket] || "bg-slate-100 text-slate-800 border-slate-300";

  const shellClass = `rounded-lg border shadow-sm transition-all overflow-hidden flex flex-col ${
    bucket === "missing"
      ? "border-red-200 bg-white hover:border-red-300 hover:shadow-md"
      : "border-gray-200 bg-white hover:border-teal-300 hover:shadow-md"
  }`;

  const openHomework = () => {
    if (to) navigate(to);
  };

  if (!to) {
    return (
      <article className={`${shellClass} opacity-90`}>
        <div className="p-5">
          <p className="font-semibold text-gray-900">{row.title}</p>
          <p className="mt-2 text-sm text-red-700">
            This assignment could not be opened (missing id). Please refresh the page or contact support.
          </p>
        </div>
      </article>
    );
  }

  return (
    <button
      type="button"
      onClick={openHomework}
      className={`${shellClass} w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 p-0 group`}
      aria-label={`Open homework: ${row.title}. ${cta.label}`}
    >
      <div className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-base group-hover:text-teal-900 transition-colors">
              {row.title}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-gray-700">
              <li>
                <span className="text-gray-600 font-medium">Subject:</span> {row.subject_name || "—"}
              </li>
              <li>
                <span className="text-gray-600 font-medium">Topic:</span> {row.topic_title || "—"}
              </li>
              <li>
                <span className="text-gray-600 font-medium">Due:</span> {due}
              </li>
            </ul>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${badgeClass}`}
            >
              {labelForBucket(bucket)}
            </span>
            {row.marks_awarded != null && bucket === "reviewed" && (
              <span className="text-xs font-medium text-emerald-800">
                {Number(row.marks_awarded).toFixed(1)}/{row.total_marks}
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        className={`mt-auto flex items-center justify-between px-3 py-2 border-t text-sm ${
          bucket === "missing" ? "border-red-100 bg-red-50/80" : "border-teal-100 bg-teal-50/90"
        }`}
      >
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{cta.label}</p>
        </div>
        <ChevronRightIcon className="h-4 w-4 text-teal-600 shrink-0" aria-hidden />
      </div>
    </button>
  );
}

export default function StudentHomework() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    homeworkService
      .studentList()
      .then((res) => {
        setItems(res.data?.data || []);
        setSummary(res.data?.summary || null);
        setNotifications(res.data?.notifications || []);
      })
      .catch(() => setError("Could not load homework."))
      .finally(() => setLoading(false));
  }, []);

  const bySection = useMemo(() => {
    const m = {};
    SECTION_ORDER.forEach((s) => {
      m[s.key] = [];
    });
    for (const row of items) {
      const b = row.ui_bucket || "pending";
      if (m[b]) m[b].push(row);
    }
    return m;
  }, [items]);

  if (loading) return <PageSpinner />;

  const pend = summary?.pending ?? 0;
  const prog = summary?.in_progress ?? 0;
  const miss = summary?.missing ?? 0;
  const lateOpen = summary?.late_open ?? 0;
  const ret = summary?.returned ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto pb-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Homework</h1>
      <p className="text-sm text-gray-600 mb-6">
        Each row is a <strong className="text-gray-800">tappable card</strong> (entire card opens the assignment).
        On the homework page, use <strong className="text-gray-800">Save progress</strong> if you need a break, then{" "}
        <strong className="text-gray-800">Submit</strong> when you are finished.
      </p>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {summary && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 mb-6">
          <p className="text-sm font-semibold text-amber-950">Work not completed</p>
          <p className="text-sm text-amber-900 mt-1">
            You have{" "}
            <strong>
              {pend + prog + ret + lateOpen} open
            </strong>{" "}
            homework{pend + prog + ret + lateOpen === 1 ? "" : "s"}
            {miss > 0 ? (
              <>
                {" "}
                and <strong>{miss}</strong> overdue (missing submission).
              </>
            ) : (
              "."
            )}
            {lateOpen > 0 && (
              <span className="block mt-1">
                <strong>{lateOpen}</strong> assignment{lateOpen === 1 ? "" : "s"} are past due but still accept
                late submission.
              </span>
            )}
          </p>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 mb-8 space-y-2">
          <p className="text-xs font-bold uppercase text-indigo-800 tracking-wide">Updates</p>
          <ul className="space-y-1.5">
            {notifications.slice(0, 8).map((n, i) => (
              <li key={`${n.type}-${n.homework_id}-${i}`} className="text-sm text-indigo-950 flex gap-2">
                <span className="text-indigo-500 shrink-0">•</span>
                <Link to={`/student/homework/${n.homework_id}`} className="hover:underline font-medium">
                  {n.message}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!items.length ? (
        <p className="text-sm text-gray-400 text-center py-16 rounded-2xl border border-dashed border-gray-200">
          No homework posted yet.
        </p>
      ) : (
        <div className="space-y-6">
          {SECTION_ORDER.map((sec) => {
            const list = bySection[sec.key] || [];
            if (!list.length) return null;
            return (
              <section key={sec.key}>
                <div className="mb-2">
                  <h2 className="text-sm font-bold text-gray-900">{sec.title}</h2>
                  <p className="text-xs text-gray-500">{sec.subtitle}</p>
                </div>
                <div className="space-y-2">
                  {list.map((row) => (
                    <HomeworkCard key={row.id} row={row} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
