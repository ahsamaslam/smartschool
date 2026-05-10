import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import teacherService from "../../services/teacherService";
import { setAdminPreviewTeacher } from "../../utils/adminPreviewTeacher";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";

/**
 * Admin/testing: same card layout as teacher "My Classes", scoped to a teacher by ID.
 * Opening a card uses the same class URL as the teacher app (students, homework, attendance).
 */
export default function AdminTeacherSectionsPreview() {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [teacherName, setTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [clsRes, usersRes] = await Promise.all([
          teacherService.getClasses(teacherId),
          api.get("/admins/users", { params: { role: "teacher" } }),
        ]);
        if (cancelled) return;
        const list = Array.isArray(clsRes.data) ? clsRes.data : [];
        setClasses(list);
        const teachers = Array.isArray(usersRes.data) ? usersRes.data : [];
        const me = teachers.find((t) => String(t.id) === String(teacherId));
        const name = me?.full_name || "Teacher";
        setTeacherName(name);
        setAdminPreviewTeacher(teacherId, name);
      } catch {
        if (!cancelled) setError("Could not load sections.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-16">
      <button
        type="button"
        onClick={() => navigate("/admin/teachers")}
        className="text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        ← Teachers
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sections · {teacherName}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Same view as <strong>Teacher → My Classes</strong>. Open a section for roster, homework, and attendance.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950 mb-6">
        Preview mode: sections come from this teacher&apos;s profile assignments. Use a teacher login later for
        production permissions.
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {!error && classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-10 text-center text-sm text-gray-600">
          No sections assigned yet. Edit this teacher under <strong>Teachers</strong> and tick classes &
          sections.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              to={`/teacher/classes/${cls.id}`}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all min-h-[140px]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-gray-900 text-lg leading-tight pr-2">{cls.name}</h3>
                <ChevronRightIcon className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 shrink-0" />
              </div>
              <p className="text-xs text-indigo-600 font-medium mb-1">
                {cls.school_name ? `${cls.school_name} · ` : ""}
                {cls.branch_name}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                {cls.grade_level != null && cls.grade_level !== ""
                  ? `Grade ${cls.grade_level}`
                  : ""}
                {cls.section ? ` · Section ${cls.section}` : ""}
              </p>
              <div className="mt-auto flex gap-4 text-xs text-gray-500 pt-2 border-t border-gray-50">
                <span>{cls.student_count ?? 0} students</span>
                <span>{cls.subject_count ?? 0} subjects</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
