import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import teacherService from "../../services/teacherService";
import AttendanceForm from "../../components/teacher/AttendanceForm";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";

export default function TeacherAttendance() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedClassId = searchParams.get("class_id");
  const isLocked = searchParams.get("locked") === "true" || !!preselectedClassId;
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load classes once
  useEffect(() => {
    if (!user?.id) return;
    teacherService
      .getClasses(user.id)
      .then((res) => setClasses(res.data || []))
      .catch(() => setError("Failed to load classes."))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Apply pre-selection when classes load or URL class_id changes
  useEffect(() => {
    if (!classes.length) return;
    if (preselectedClassId && classes.some((c) => c.id === preselectedClassId)) {
      setSelectedClass(preselectedClassId);
    } else if (!selectedClass) {
      setSelectedClass(classes[0].id);
    }
  }, [classes, preselectedClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedClass) return;
    teacherService
      .getClassStudents(selectedClass)
      .then((res) => setStudents(res.data || []));
  }, [selectedClass]);

  if (loading) return <PageSpinner />;

  const selectedClassName = classes.find((c) => c.id === selectedClass)?.name || "—";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Attendance</h1>
      {isLocked && selectedClassName !== "—" && (
        <p className="text-sm text-gray-500 mb-6">{selectedClassName}</p>
      )}

      {error && <Alert type="error" message={error} className="mb-4" />}

      {isLocked ? (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 font-medium">
            {selectedClassName}
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
