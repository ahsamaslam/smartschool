import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { ChevronRightIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";

export default function TeacherHomework() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [allHomework, setAllHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    const loadData = async () => {
      try {
        // Get all classes for this teacher
        const classesRes = await teacherService.getClasses(user.id);
        const classList = Array.isArray(classesRes.data) ? classesRes.data : [];
        setClasses(classList);

        // Get homework for each class and combine
        const allHw = [];
        for (const cls of classList) {
          try {
            const hwRes = await homeworkService.teacherList({ class_id: cls.id });
            const hwList = hwRes.data?.data || [];
            // Add class info to each homework item
            allHw.push(
              ...hwList.map((h) => ({
                ...h,
                class_id: cls.id,
                class_name: cls.name,
                branch_name: cls.branch_name,
              }))
            );
          } catch {
            // Silently skip if one class fails
          }
        }
        setAllHomework(allHw.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        setError("");
      } catch (err) {
        setError("Failed to load homework.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">All Homework</h1>
        <p className="text-sm text-gray-500 mt-1">
          View and manage homework assignments across all your classes.
        </p>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" />}

      {allHomework.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
          <ClipboardDocumentListIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">
            {classes.length === 0
              ? "You haven't been assigned to any classes yet."
              : "No homework created yet. Create homework from a class page."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {allHomework.map((hw) => (
            <div
              key={`${hw.class_id}-${hw.id}`}
              className="rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-500">{hw.class_name}</p>
                    <span className="text-xs text-gray-400">·</span>
                    <p className="text-sm text-gray-500">{hw.branch_name}</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">{hw.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="capitalize">{hw.homework_type}</span>
                    {hw.topic_title && (
                      <>
                        <span>·</span>
                        <span>{hw.topic_title}</span>
                      </>
                    )}
                    <span>·</span>
                    <span
                      className={`font-semibold ${
                        hw.status === "published" ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {hw.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Link
                    to={`/teacher/classes/${hw.class_id}/homework/${hw.id}/edit`}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Edit
                  </Link>
                  <Link
                    to={`/teacher/classes/${hw.class_id}/homework/${hw.id}/submissions`}
                    className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                  >
                    Submissions
                  </Link>
                  <ChevronRightIcon className="h-4 w-4 text-gray-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
