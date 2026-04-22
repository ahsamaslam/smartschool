import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import ExamGenerator from "../../components/teacher/ExamGenerator";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Dropdown from "../../components/common/Dropdown";

export default function GenerateExam() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
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

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }));

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Exam</h1>
      <p className="text-sm text-gray-500 mb-8">
        AI-powered exam generator. Select topics and define your question
        breakdown.
      </p>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {/* Class selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Class
          </label>
          <Dropdown
            options={classOptions}
            value={selectedClass}
            onChange={setSelectedClass}
            placeholder="Select class…"
          />
        </div>

        {selectedClass && <ExamGenerator classId={selectedClass} topics={[]} />}
      </div>
    </div>
  );
}
