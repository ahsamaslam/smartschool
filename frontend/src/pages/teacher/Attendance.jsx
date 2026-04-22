import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import AttendanceForm from "../../components/teacher/AttendanceForm";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Dropdown from "../../components/common/Dropdown";
import { formatDate } from "../../utils/formatters";

export default function TeacherAttendance() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    teacherService
      .getClasses(user.id)
      .then((res) => {
        const cls = res.data || [];
        setClasses(cls);
        if (cls.length) setSelectedClass(cls[0].id);
      })
      .catch(() => setError("Failed to load classes."))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!selectedClass) return;
    teacherService
      .getClassStudents(selectedClass)
      .then((res) => setStudents(res.data || []));
  }, [selectedClass]);

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }));

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Attendance</h1>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Class
        </label>
        <Dropdown
          options={classOptions}
          value={selectedClass}
          onChange={setSelectedClass}
          placeholder="Choose a class…"
        />
      </div>

      {selectedClass && (
        <AttendanceForm
          classId={selectedClass}
          students={students}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
