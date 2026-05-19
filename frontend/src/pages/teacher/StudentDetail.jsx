import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import teacherService from "../../services/teacherService";
import PerformanceTable from "../../components/teacher/PerformanceTable";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function StudentDetail() {
  const { classId, studentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    teacherService
      .getStudentPerformance(studentId, classId)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load student performance."))
      .finally(() => setLoading(false));
  }, [studentId, classId]);

  if (loading) return <PageSpinner />;

  const attendance = data?.attendance || {};
  const attendancePct =
    attendance.total_days > 0
      ? Math.round((attendance.present_days / attendance.total_days) * 100)
      : 0;

  let attendanceRate = 0;
  let submissionRate = 0;
  let retakes = 0;
  let revisits = 0;

  if (data && data.consistency) {
    attendanceRate = data.consistency.attendance_rate || 0;
    submissionRate = data.consistency.submission_rate || 0;
  }
  if (data && data.behavioral) {
    retakes = data.behavioral.retakes || 0;
    revisits = data.behavioral.revisits || 0;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to class
      </button>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Attendance summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
          Attendance
        </h2>
        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{attendancePct}%</p>
            <p className="text-xs text-gray-400">Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">
              {attendance.present_days || 0}
            </p>
            <p className="text-xs text-gray-400">Present</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">
              {attendance.total_days || 0}
            </p>
            <p className="text-xs text-gray-400">Total Days</p>
          </div>
        </div>
      </div>

      {/* SHS Breakdown Cards */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Consistency Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
            Consistency
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Attend:</p>
              <p className="text-2xl font-bold text-gray-800">{attendanceRate}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Submit:</p>
              <p className="text-2xl font-bold text-gray-800">{submissionRate}%</p>
            </div>
          </div>
        </div>

        {/* Behavioral Health Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
            Behavioral Health
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Retakes:</p>
              <p className="text-2xl font-bold text-gray-800">{retakes}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Revisits:</p>
              <p className="text-2xl font-bold text-gray-800">{revisits}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Topic performance */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Topic Performance
          </h2>
        </div>
        <PerformanceTable data={data?.topic_performance || []} />
      </div>
    </div>
  );
}
