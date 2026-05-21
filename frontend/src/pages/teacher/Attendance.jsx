import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import teacherService from "../../services/teacherService";
import AttendanceForm from "../../components/teacher/AttendanceForm";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Dropdown from "../../components/common/Dropdown";
import { formatDate } from "../../utils/formatters";

export default function TeacherAttendance() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedClassId = searchParams.get("class_id");
  const isLocked = searchParams.get("locked") === "true";
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
        console.log("Attendance - Classes loaded:", cls.length, cls);
        setClasses(cls);
        if (preselectedClassId && cls.some((c) => c.id === preselectedClassId)) {
          console.log("Attendance - Pre-selecting class:", preselectedClassId);
          setSelectedClass(preselectedClassId);
        } else if (cls.length) {
          console.log("Attendance - Selecting first class:", cls[0].id);
          setSelectedClass(cls[0].id);
        }
      })
      .catch((err) => {
        console.error("Attendance - Error loading classes:", err);
        setError("Failed to load classes.");
      })
      .finally(() => setLoading(false));
  }, [user?.id, preselectedClassId]);

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

      {isLocked ? (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Class
          </label>
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 font-medium">
            {classes.find((c) => c.id === selectedClass)?.name || "—"}
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Class
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a class…</option>
            {classOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

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
