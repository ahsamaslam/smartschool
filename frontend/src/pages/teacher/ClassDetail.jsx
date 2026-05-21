import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import teacherService from "../../services/teacherService";
import { useAuth } from "../../hooks/useAuth";
import { getAdminPreviewTeacherId } from "../../utils/adminPreviewTeacher";
import StudentList from "../../components/teacher/StudentList";
import AttendanceForm from "../../components/teacher/AttendanceForm";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import toast from "react-hot-toast";
import { UserPlusIcon } from "@heroicons/react/24/outline";

export default function ClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [teachingSlots, setTeachingSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: "", student_email: "" });
  const [adding, setAdding] = useState(false);

  const loadStudents = () => {
    const teacherId =
      user?.role === "admin" ? getAdminPreviewTeacherId() || user?.id : user?.id;
    teacherService
      .getClassStudents(classId, teacherId)
      .then((res) => setStudents(res.data || []))
      .catch(() => setError("Failed to load students."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStudents();
  }, [classId]);

  useEffect(() => {
    const preview =
      user?.role === "admin" ? getAdminPreviewTeacherId() || user?.id : user?.id;
    if (!preview || !classId) {
      setTeachingSlots([]);
      return;
    }
    const params =
      user?.role === "admin" && getAdminPreviewTeacherId()
        ? { params: { for_teacher_id: getAdminPreviewTeacherId() } }
        : {};
    teacherService
      .getTeachingAssignments(classId, params)
      .then((res) => setTeachingSlots(res.data?.assignments || []))
      .catch(() => setTeachingSlots([]));
  }, [classId, user?.role, user?.id]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await teacherService.addStudentToClass(classId, addForm);
      toast.success("Student added!");
      setShowAddModal(false);
      setAddForm({ full_name: "", student_email: "" });
      loadStudents();
    } catch {
      toast.error("Failed to add student.");
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-16">
      <button
        type="button"
        onClick={() => navigate("/teacher/classes")}
        className="text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        ← My Classes
      </button>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Roster, attendance, and homework for this section.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Button variant="secondary" onClick={() => navigate(`/teacher/classes/${classId}/homework`)}>
            Homework
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowAttendance(!showAttendance)}
          >
            {showAttendance ? "Hide Attendance" : "Mark Attendance"}
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <UserPlusIcon className="h-4 w-4 mr-1.5" />
            Add Student
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {teachingSlots.length > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 mb-6">
          <p className="text-sm font-semibold text-indigo-950 mb-2">Your teaching slots (this section)</p>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm text-gray-800">
            {teachingSlots.map((row, i) => (
              <li
                key={`${row.library_subject_id}-${row.library_book_id}-${i}`}
                className="rounded-xl bg-white/90 border border-indigo-100 px-3 py-2"
              >
                <span className="font-medium">{row.subject_name}</span>
                <span className="text-gray-600"> · {row.book_title}</span>
                {row.board_name ? (
                  <span className="block text-xs text-gray-500 mt-0.5">{row.board_name}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-600 mt-3">
            Homework and library topics you can use are scoped to these subjects and books.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <StudentList students={students} classId={classId} />
          </div>
        </div>
        {showAttendance && (
          <div>
            <AttendanceForm
              classId={classId}
              students={students}
              teacherId={
                user?.role === "admin"
                  ? getAdminPreviewTeacherId() || user?.id
                  : user?.id
              }
              onSaved={loadStudents}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Student"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <Input
            label="Full Name"
            value={addForm.full_name}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, full_name: e.target.value }))
            }
            required
          />
          <Input
            label="Email"
            type="email"
            value={addForm.student_email}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, student_email: e.target.value }))
            }
            required
          />
          <Button type="submit" variant="primary" fullWidth loading={adding}>
            Add Student
          </Button>
        </form>
      </Modal>
    </div>
  );
}
