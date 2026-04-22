import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import toast from "react-hot-toast";

export default function TeacherClasses() {
  const { user } = useAuth();
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

  const load = () => {
    if (!user?.id) return;
    teacherService
      .getClasses(user.id)
      .then((res) => setClasses(res.data || []))
      .catch(() => setError("Failed to load classes."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user?.id]);

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          + New Class
        </Button>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {classes.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">
          No classes yet. Create one!
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              to={`/teacher/classes/${cls.id}`}
              className="block bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <h3 className="font-semibold text-gray-900 mb-1">{cls.name}</h3>
              <p className="text-xs text-blue-600 mb-3">
                Grade {cls.grade_level} · {cls.branch_name}
              </p>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{cls.student_count} students</span>
                <span>{cls.subject_count} subjects</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create New Class"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Class Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Class 10-A"
            required
          />
          <Input
            label="Grade Level"
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
            Create Class
          </Button>
        </form>
      </Modal>
    </div>
  );
}
