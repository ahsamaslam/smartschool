import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import toast from "react-hot-toast";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

/**
 * Read-only view of how a teacher is wired to sections. Assign or change sections in
 * Admin → Teachers → Add/Edit teacher (school, branch, class & section checkboxes).
 */
export default function AdminTeacherAssignments() {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [assigned, setAssigned] = useState([]);
  const [primary, setPrimary] = useState([]);

  const [curriculum, setCurriculum] = useState([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [uRes, aRes] = await Promise.all([
        api.get(`/admins/users`, { params: { role: "teacher" } }),
        api.get(`/admins/teachers/${teacherId}/class-assignments`),
      ]);
      const teachers = Array.isArray(uRes.data) ? uRes.data : [];
      const me = teachers.find((t) => t.id === teacherId);
      setTeacherName(me?.full_name || "Teacher");
      let tc = me?.teacher_curriculum_assignments;
      if (typeof tc === "string") {
        try {
          tc = JSON.parse(tc);
        } catch {
          tc = [];
        }
      }
      setCurriculum(Array.isArray(tc) ? tc : []);
      setAssigned(aRes.data?.assigned_via_admin || []);
      setPrimary(aRes.data?.primary_teacher_of || []);
    } catch {
      setError("Could not load assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [teacherId]);

  const removeAssignment = async (classId) => {
    const ok = window.confirm("Remove this section from the teacher? You can re-add it from Edit teacher.");
    if (!ok) return;
    try {
      await api.delete(`/admins/teachers/${teacherId}/class-assignments/${classId}`);
      toast.success("Removed");
      load();
    } catch {
      toast.error("Failed to remove");
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto pb-16">
      <button
        type="button"
        onClick={() => navigate("/admin/teachers")}
        className="text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        ← Teachers
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Assigned sections</h1>
      <p className="text-sm text-gray-500 mb-8">{teacherName}</p>

      {error && <Alert type="error" message={error} className="mb-6" />}

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 mb-8 text-sm text-indigo-950">
        <p className="font-semibold mb-1">Subject &amp; book assignments</p>
        <p>
          Configure <strong>branch → class → board → subject → book</strong> in{" "}
          <strong>Admin → Teachers → Edit teacher</strong>. Each row is one teaching responsibility in a
          section.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
          Curriculum assignments (subject · book per section)
        </h2>
        {!curriculum.length ? (
          <p className="text-sm text-gray-400">
            None yet — edit this teacher and add assignment rows with subject and book.
          </p>
        ) : (
          <ul className="space-y-2">
            {curriculum.map((row, i) => (
              <li
                key={`${row.class_id}-${row.library_subject_id}-${i}`}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <p className="font-medium text-gray-900">{row.class_name || "Section"}</p>
                <p className="text-gray-700 mt-1">
                  {row.board_name ? `${row.board_name} · ` : ""}
                  <strong>{row.subject_name}</strong> — {row.book_title}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {row.branch_name}
                  {row.grade_level != null && row.grade_level !== ""
                    ? ` · Grade ${row.grade_level}`
                    : ""}
                  {row.section ? ` · Sec ${row.section}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
          Assigned via teacher profile / admin form
        </h2>
        {!assigned.length ? (
          <p className="text-sm text-gray-400">None — add sections when creating or editing the teacher.</p>
        ) : (
          <ul className="space-y-2">
            {assigned.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.school_name} · {c.branch_name} · Grade {c.grade_level || "—"} · Sec{" "}
                    {c.section || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    to={`/admin/classes/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Class detail
                    <ChevronRightIcon className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeAssignment(c.id)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
          Primary teacher on class record
        </h2>
        {!primary.length ? (
          <p className="text-sm text-gray-400">None — set on the class screen under Schools if needed.</p>
        ) : (
          <ul className="space-y-2">
            {primary.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-600">
                    {c.school_name} · {c.branch_name}
                  </p>
                </div>
                <Link
                  to={`/admin/classes/${c.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Open class
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-gray-400">
        Teacher workflow: sign in as this teacher →{" "}
        <strong className="text-gray-600">My Classes</strong> shows each section as a card → open a card for
        students, attendance, homework, and more.
      </p>
      <p className="text-xs text-gray-400 mt-2">
        <Link to="/admin/schools" className="text-indigo-600 hover:underline">
          Schools & branches
        </Link>
      </p>
    </div>
  );
}
