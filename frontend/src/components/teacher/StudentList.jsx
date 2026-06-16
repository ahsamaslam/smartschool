import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { KeyIcon } from "@heroicons/react/24/outline";
import teacherService from "../../services/teacherService";
import toast from "react-hot-toast";

/**
 * StudentList — composite score = video view rate + attendance + quiz avg
 * per business guide requirement
 */
export default function StudentList({ students = [], classId, simple = false }) {
  const navigate = useNavigate();

  const handlePasswordReset = async (studentId, name) => {
    try {
      await teacherService.sendPasswordReset(studentId);
      toast.success(`Password reset link sent for ${name}`);
    } catch {
      toast.error("Failed to send reset link.");
    }
  };

  // SHS risk thresholds: <40 critical, 40-59 at-risk, 60-79 stable, >=80 excelling
  const scoreColor = (score) => {
    if (score >= 80) return "text-blue-700 bg-blue-50";
    if (score >= 60) return "text-green-600 bg-green-50";
    if (score >= 40) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const bar = (value) => (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-0.5">
      <div
        className={clsx(
          "h-1.5 rounded-full",
          value >= 80
            ? "bg-green-500"
            : value >= 60
              ? "bg-amber-400"
              : "bg-red-400",
        )}
        style={{ width: `${Math.min(value || 0, 100)}%` }}
      />
    </div>
  );

  if (!students.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No students enrolled.
      </p>
    );
  }

  if (simple) {
    return (
      <div className="divide-y divide-gray-100">
        {students.map((s, i) => (
          <div
            key={s.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 cursor-pointer transition-colors group"
            onClick={() => navigate(`/teacher/classes/${classId}/student/${s.id}`)}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
                <p className="text-xs text-gray-400">{s.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handlePasswordReset(s.id, s.full_name)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Send password reset"
              >
                <KeyIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
            <th className="text-left py-3 px-4">Student</th>
            <th className="text-center py-3 px-4">Video %</th>
            <th className="text-center py-3 px-4">Attendance %</th>
            <th className="text-center py-3 px-4">Homework</th>
            <th className="text-center py-3 px-4">Overall</th>
            <th className="text-center py-3 px-4">Rank</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {students.map((s) => {
            const overall = parseFloat(s.overall_score || 0).toFixed(1);
            return (
              <tr
                key={s.id}
                className="hover:bg-indigo-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/teacher/classes/${classId}/student/${s.id}`)}
              >
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-900">{s.full_name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </td>
                <td className="py-3 px-4">
                  <div className="text-center text-xs font-medium text-gray-700">
                    {Math.round(s.video_completion_rate || 0)}%
                    {bar(s.video_completion_rate)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-center text-xs font-medium text-gray-700">
                    {Math.round(s.attendance_rate || 0)}%
                    {bar(s.attendance_rate)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-center text-xs font-medium text-gray-700">
                    {s.homework_avg != null
                      ? `${Math.round(s.homework_avg)}%`
                      : "—"}
                    {s.homework_avg != null && bar(s.homework_avg)}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={clsx(
                      "inline-block px-2 py-0.5 rounded-full text-xs font-bold tabular-nums",
                      scoreColor(overall),
                    )}
                  >
                    {overall}%
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-xs text-gray-500 font-medium">
                  {s.ranking || "—"}
                </td>
                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handlePasswordReset(s.id, s.full_name)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Send password reset"
                  >
                    <KeyIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
