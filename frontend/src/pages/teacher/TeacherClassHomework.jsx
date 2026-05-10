import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";

export default function TeacherClassHomework() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    homeworkService
      .teacherList({ class_id: classId })
      .then((res) => setItems(res.data?.data || []))
      .catch(() => setError("Failed to load homework."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [classId]);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-16">
      <button
        type="button"
        onClick={() => navigate(`/teacher/classes/${classId}`)}
        className="text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        ← Class
      </button>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homework</h1>
          <p className="text-sm text-gray-500 mt-1">
            Topic-scoped assignments broadcast to this section (no per-student picks).
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate(`/teacher/classes/${classId}/homework/new`)}>
          New homework
        </Button>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {!items.length ? (
        <p className="text-center text-gray-400 py-16 rounded-2xl border border-dashed border-gray-200">
          No homework yet. Create one and publish when ready.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((h) => (
            <div
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div>
                <p className="font-semibold text-gray-900">{h.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {h.homework_type} · {h.topic_title || "topic"} ·{" "}
                  <span
                    className={
                      h.status === "published"
                        ? "text-emerald-700 font-semibold"
                        : "text-amber-700 font-semibold"
                    }
                  >
                    {h.status}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/teacher/classes/${classId}/homework/${h.id}/edit`}
                  className="text-sm font-semibold text-indigo-600 hover:underline"
                >
                  Edit
                </Link>
                <Link
                  to={`/teacher/classes/${classId}/homework/${h.id}/submissions`}
                  className="text-sm font-semibold text-teal-700 hover:underline"
                >
                  Submissions
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
