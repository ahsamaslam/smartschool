import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import {
  getAdminPreviewTeacherId,
  getAdminPreviewTeacherName,
} from "../../utils/adminPreviewTeacher";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import toast from "react-hot-toast";

function parseSectionAssignments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function TeacherClasses() {
  const { user } = useAuth();
  const location = useLocation();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    branch_id: "",
    name: "",
    grade_level: "",
  });

  const isAdmin = user?.role === "admin";

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    setError("");

    let fetchTeacherId = user.id;
    if (isAdmin) {
      const previewId = getAdminPreviewTeacherId();
      if (!previewId) {
        setClasses([]);
        setLoading(false);
        return;
      }
      fetchTeacherId = previewId;
    }

    teacherService
      .getClasses(fetchTeacherId)
      .then((res) => setClasses(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError("Failed to load classes."))
      .finally(() => setLoading(false));
  }, [user?.id, isAdmin]);

  useEffect(() => {
    load();
  }, [load, location.pathname, location.key]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await teacherService.createClass(user.id, form);
      toast.success("Class created!");
      setShowModal(false);
      setForm({ branch_id: "", name: "", grade_level: "" });
      load();
    } catch {
      toast.error("Failed to create class.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <PageSpinner />;

  const showAdminPreviewBanner = isAdmin && Boolean(getAdminPreviewTeacherId());
  const showAdminEmptyHelp = isAdmin && !getAdminPreviewTeacherId();

  return (
    <div className="p-6 max-w-5xl mx-auto pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Open a section to manage students, attendance, homework, and more.
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={() => setShowModal(true)}>
            + New class
          </Button>
        )}
      </div>

      {showAdminPreviewBanner && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/90 px-4 py-3 text-sm text-indigo-950 mb-6">
          <p className="font-semibold text-indigo-900">
            Previewing sections for{" "}
            {getAdminPreviewTeacherName() ? `"${getAdminPreviewTeacherName()}"` : "selected teacher"}
          </p>
          <p className="mt-1 text-indigo-900/90">
            This matches what that teacher sees under <strong>My Classes</strong>. To switch teachers,
            go to <Link to="/admin/teachers" className="underline font-medium">Admin → Teachers</Link>{" "}
            and click <strong>Sections</strong> on another teacher.
          </p>
        </div>
      )}

      {showAdminEmptyHelp && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 mb-6">
          <p className="font-semibold text-amber-900">Choose a teacher first</p>
          <p className="mt-1">
            Go to{" "}
            <Link to="/admin/teachers" className="text-amber-900 underline font-medium">
              Admin → Teachers
            </Link>{" "}
            and click <strong>Sections</strong> on a teacher. After that, this page will show their
            assigned sections here (same as opening Sections).
          </p>
        </div>
      )}

      {!isAdmin && classes.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
          No sections yet. Your school admin assigns classes when creating or editing your teacher profile
          (school → branch → section checkboxes).
        </div>
      )}

      {error && <Alert type="error" message={error} className="mb-4" />}

      {showAdminPreviewBanner && classes.length === 0 && !error && (
        <p className="text-center text-sm text-gray-600 py-12 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-4">
          No sections assigned to this teacher yet. Assign sections when adding or editing the teacher.
        </p>
      )}

      {classes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const assigns = parseSectionAssignments(cls.section_assignments);
            return (
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
              {assigns.length > 0 ? (
                  <ul className="text-xs text-gray-700 space-y-1 mb-3 border-l-2 border-indigo-100 pl-3">
                    {assigns.map((a, i) => (
                      <li key={i}>
                        <span className="font-semibold text-gray-800">{a.subject_name}</span>
                        {a.book_title ? (
                          <span className="text-gray-600"> · {a.book_title}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
              ) : null}
              <div className="mt-auto flex gap-4 text-xs text-gray-500 pt-2 border-t border-gray-50">
                <span>{cls.student_count ?? 0} students</span>
                <span>
                  {assigns.length > 0
                    ? `${assigns.length} teaching slot(s)`
                    : `${cls.subject_count ?? 0} subjects`}
                </span>
              </div>
            </Link>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create new class">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Class name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Class 10-A"
            required
          />
          <Input
            label="Grade level"
            value={form.grade_level}
            onChange={(e) =>
              setForm((f) => ({ ...f, grade_level: e.target.value }))
            }
            placeholder="e.g. Grade 10"
            required
          />
          <Input
            label="Branch ID"
            value={form.branch_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, branch_id: e.target.value }))
            }
            placeholder="Branch UUID"
            required
          />
          <Button type="submit" variant="primary" fullWidth loading={creating}>
            Create class
          </Button>
        </form>
      </Modal>
    </div>
  );
}
