import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";

function statusBadge(row) {
  const st = row.submission_status || "pending";
  const map = {
    pending: "bg-gray-100 text-gray-700",
    submitted: "bg-blue-50 text-blue-800",
    late: "bg-amber-50 text-amber-900",
    reviewed: "bg-emerald-50 text-emerald-800",
    returned: "bg-violet-50 text-violet-800",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${map[st] || map.pending}`}
    >
      {st}
    </span>
  );
}

export default function StudentHomework() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    homeworkService
      .studentList()
      .then((res) => setItems(res.data?.data || []))
      .catch(() => setError("Could not load homework."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto pb-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Homework</h1>
      <p className="text-sm text-gray-500 mb-8">
        Assignments for your active class and section. Open a row to answer or upload files.
      </p>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {!items.length ? (
        <p className="text-sm text-gray-400 text-center py-16 rounded-2xl border border-dashed border-gray-200">
          No homework posted yet.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <Link
              key={row.id}
              to={`/student/homework/${row.id}`}
              className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-teal-200 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{row.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Topic · {row.topic_title || "—"} ·{" "}
                    {row.homework_type === "interactive" ? "Interactive" : "Upload"}
                  </p>
                  {row.due_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Due {new Date(row.due_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {statusBadge(row)}
                  {row.marks_awarded != null && (
                    <span className="text-xs text-gray-500">
                      Score {Number(row.marks_awarded).toFixed(1)}
                      {row.total_marks != null ? ` / ${row.total_marks}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
