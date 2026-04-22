import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import studentService from "../../services/studentService";
import SubjectCard from "../../components/student/SubjectCard";
import PerformanceChart from "../../components/student/PerformanceChart";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    studentService
      .getDashboard(user.id)
      .then((res) => setSubjects(res.data?.subjects || []))
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <PageSpinner />;

  // Build chart data from subjects
  const chartData = subjects.map((s) => ({
    topic: s.subject_name,
    score: Math.round(s.highest_score || 0),
    average: Math.round(s.average_score || 0),
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome back, {user?.full_name?.split(" ")[0] || "Student"}!
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Here's an overview of your progress.
      </p>

      {error && <Alert type="error" message={error} className="mb-6" />}

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-8">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">
            Performance Overview
          </h2>
          <PerformanceChart data={chartData} />
        </div>
      )}

      {/* Subjects Grid */}
      <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">
        My Subjects
      </h2>
      {subjects.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-12">
          No subjects enrolled.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject) => (
            <SubjectCard key={subject.subject_id} subject={subject} />
          ))}
        </div>
      )}
    </div>
  );
}
