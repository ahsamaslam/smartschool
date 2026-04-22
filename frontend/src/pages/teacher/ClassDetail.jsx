import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import teacherService from "../../services/teacherService";
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
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: "", student_email: "" });
  const [adding, setAdding] = useState(false);

  const loadStudents = () => {
    teacherService
      .getClassStudents(classId)
      .then((res) => setStudents(res.data || []))
      .catch(() => setError("Failed to load students."))
      .finally(() => setLoading(false));
  };

  useEffect(loadStudents, [classId]);

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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Class Students</h1>
        <div className="flex gap-3">
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
