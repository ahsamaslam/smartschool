import { Link } from "react-router-dom";
import clsx from "clsx";
import { KeyIcon } from "@heroicons/react/24/outline";
import teacherService from "../../services/teacherService";
import toast from "react-hot-toast";

const RISK = {
  excelling: { label: "Excelling", cls: "bg-blue-100 text-blue-700" },
  stable:    { label: "Stable",    cls: "bg-green-100 text-green-700" },
  at_risk:   { label: "At Risk",   cls: "bg-yellow-100 text-yellow-800" },
  critical:  { label: "Critical",  cls: "bg-red-100 text-red-700" },
};

function riskLevel(shs) {
  if (shs >= 80) return RISK.excelling;
  if (shs >= 60) return RISK.stable;
  if (shs >= 40) return RISK.at_risk;
  return RISK.critical;
}

export default function StudentList({ students = [], classId }) {
  const handlePasswordReset = async (studentId, name) => {
    try {
      await teacherService.sendPasswordReset(studentId);
      toast.success(`Password reset link sent for ${name}`);
    } catch {
      toast.error("Failed to send reset link.");
    }
  };

  const bar = (value, color = "bg-blue-400") => (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-0.5">
      <div
        className={clsx("h-1.5 rounded-full", color)}
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
            <th className="text-left py-3 px-4">Student</th>
            <th className="text-center py-3 px-4">Video %</th>
            <th className="text-center py-3 px-4">Attendance %</th>
            <th className="text-center py-3 px-4">Homework %</th>
            <th className="text-center py-3 px-4">Behavioral %</th>
            <th className="text-center py-3 px-4">SHS</th>
            <th className="text-center py-3 px-4">Rank</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {students.map((s) => {
            const shsRaw = parseFloat(s.shs_score ?? s.overall_score ?? 0);
            const shs = shsRaw.toFixed(1);
            const risk = riskLevel(shsRaw);
            return (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                {/* Student name + email */}
                <td className="py-3 px-4">
                  <Link
                    to={`/teacher/classes/${classId}/student/${s.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {s.full_name}
                  </Link>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </td>

                {/* Video */}
                <td className="py-3 px-4">
                  <div className="text-center text-xs font-medium text-gray-700">
                    {Math.round(s.video_completion_rate || 0)}%
                    {bar(s.video_completion_rate, "bg-blue-400")}
                  </div>
                </td>

                {/* Attendance */}
                <td className="py-3 px-4">
                  <div className="text-center text-xs font-medium text-gray-700">
                    {Math.round(s.attendance_rate || 0)}%
                    {bar(s.attendance_rate, "bg-green-400")}
                  </div>
                </td>

                {/* Homework */}
                <td className="py-3 px-4">
                  <div className="text-center text-xs font-medium text-gray-700">
                    {Math.round(s.homework_avg || 0)}%
                    {bar(s.homework_avg, "bg-purple-400")}
                  </div>
                </td>

                {/* Behavioral */}
                <td className="py-3 px-4">
                  <div className="text-center text-xs font-medium text-gray-700">
                    {Math.round(s.behavioral_rate || 0)}%
                    {bar(s.behavioral_rate, "bg-orange-400")}
                  </div>
                </td>

                {/* SHS with risk badge */}
                <td className="py-3 px-4 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-bold text-gray-800 tabular-nums">
                      {shs}
                    </span>
                    <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", risk.cls)}>
                      {risk.label}
                    </span>
                  </div>
                </td>

                {/* Rank */}
                <td className="py-3 px-4 text-center text-xs text-gray-500 font-medium">
                  #{s.ranking || "—"}
                </td>

                {/* Password reset */}
                <td className="py-3 px-4 text-right">
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
      <p className="text-[10px] text-gray-400 text-right px-4 pb-2">
        SHS = Video×25% + Homework×40% + Attendance×20% + Behavioral×15%
      </p>
    </div>
  );
}
