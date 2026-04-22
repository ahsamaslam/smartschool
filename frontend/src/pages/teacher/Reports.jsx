import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import StudentList from "../../components/teacher/StudentList";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Dropdown from "../../components/common/Dropdown";

export default function TeacherReports() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
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
      .finally(() => setLoadingClasses(false));
  }, [user?.id]);

  useEffect(() => {
    if (!selectedClass) return;
    setLoadingStudents(true);
    teacherService
      .getClassStudents(selectedClass)
      .then((res) => setStudents(res.data || []))
      .finally(() => setLoadingStudents(false));
  }, [selectedClass]);

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }));

  if (loadingClasses) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Class Reports</h1>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="mb-6 max-w-xs">
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

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loadingStudents ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <StudentList students={students} classId={selectedClass} />
        )}
      </div>
    </div>
  );
}
