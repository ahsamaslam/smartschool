import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

const RISK_COLORS = {
  HIGH: { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", icon: "text-red-600" },
  MEDIUM: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", icon: "text-amber-600" },
  LOW: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-900", icon: "text-yellow-600" },
  CLEAN: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900", icon: "text-green-600" },
};

export function IntegrityReportDashboard({ homeworkId, isExam = false }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    loadReports();
  }, [homeworkId, isExam]);

  const loadReports = async () => {
    try {
      const endpoint = isExam ? "exams" : "homework/teacher";
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/${endpoint}/${homeworkId}/integrity-reports`,
        { credentials: "include" }
      );
      const data = await response.json();
      setReports(data.data || []);
    } catch (error) {
      console.error("Failed to load integrity reports:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center text-gray-500 py-4">Loading integrity reports...</div>;
  }

  if (reports.length === 0) {
    return <div className="text-center text-gray-400 py-4">No integrity data collected yet.</div>;
  }

  const highRiskCount = reports.filter((r) =>
    r.reports.some((rep) => rep.risk_level === "HIGH")
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {highRiskCount > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-900 font-semibold flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            {highRiskCount} submission(s) with HIGH integrity risk
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {reports.map((student) => {
          const highRiskReports = student.reports.filter((r) => r.risk_level === "HIGH");
          const mediumRiskReports = student.reports.filter((r) => r.risk_level === "MEDIUM");
          const riskLevel = highRiskReports.length > 0 ? "HIGH" : mediumRiskReports.length > 0 ? "MEDIUM" : "CLEAN";
          const colors = RISK_COLORS[riskLevel];

          return (
            <div
              key={student.student_id}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${colors.bg} ${colors.border}`}
              onClick={() => setSelectedStudent(selectedStudent === student.student_id ? null : student.student_id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-semibold ${colors.text}`}>{student.student_name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{student.student_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {riskLevel === "HIGH" && (
                    <ExclamationTriangleIcon className={`h-5 w-5 ${colors.icon}`} />
                  )}
                  {riskLevel === "MEDIUM" && (
                    <ExclamationCircleIcon className={`h-5 w-5 ${colors.icon}`} />
                  )}
                  {riskLevel === "CLEAN" && (
                    <CheckCircleIcon className={`h-5 w-5 ${colors.icon}`} />
                  )}
                  <span className={`text-sm font-semibold ${colors.text}`}>{riskLevel}</span>
                </div>
              </div>

              {/* Expanded details */}
              {selectedStudent === student.student_id && (
                <div className="mt-4 pt-4 border-t border-gray-300/50 space-y-3">
                  {student.reports.map((report, idx) => (
                    <IntegrityReportDetail key={idx} report={report} studentName={student.student_name} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntegrityReportDetail({ report, studentName }) {
  const [expanded, setExpanded] = useState(false);
  const colors = RISK_COLORS[report.risk_level || "CLEAN"];

  return (
    <div className="text-sm bg-white/50 rounded p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left font-medium flex items-center justify-between ${colors.text}`}
      >
        <span>
          Question {report.question_id?.substring(0, 8) || "?"} • {report.risk_level || "UNKNOWN"}
        </span>
        <span>{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 text-xs text-gray-700">
          {/* Paste Events */}
          {report.paste_events && report.paste_events.length > 0 && (
            <div>
              <p className="font-semibold text-amber-700">📋 Paste Activity</p>
              <ul className="ml-3 space-y-1">
                {report.paste_events.map((pe, i) => (
                  <li key={i}>
                    {pe.contentLength} chars pasted
                    {pe.contentLength > 500 && <span className="text-red-600"> [LARGE]</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Typing Analysis */}
          {report.typing_analysis && Object.keys(report.typing_analysis).length > 0 && (
            <div>
              <p className="font-semibold text-blue-700">⌨️ Typing Speed</p>
              <div className="ml-3 space-y-0.5">
                <p>WPM: {report.typing_analysis.estimatedWPM || "?"}</p>
                {report.typing_analysis.totalTypingTime && (
                  <p>Time: {(report.typing_analysis.totalTypingTime / 1000).toFixed(1)}s</p>
                )}
              </div>
            </div>
          )}

          {/* Focus Losses */}
          {report.focus_losses && report.focus_losses.length > 0 && (
            <div>
              <p className="font-semibold text-orange-700">👁️ Tab Switches</p>
              <p className="ml-3">{report.focus_losses.length} switches detected</p>
            </div>
          )}

          {/* Flags */}
          {report.flags && report.flags.length > 0 && (
            <div>
              <p className="font-semibold text-red-700">⚠️ Flags Raised</p>
              <ul className="ml-3 space-y-1">
                {report.flags.map((flag, i) => (
                  <li key={i} className={flag.severity === "HIGH" ? "text-red-700 font-medium" : ""}>
                    {flag.type}: {flag.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Manual Action */}
          <div className="mt-3 pt-2 border-t border-gray-300/50 flex gap-2">
            <button className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200">
              Mark Verified
            </button>
            <button className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">
              Needs Review
            </button>
            <button className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200">
              Oral Verification
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default IntegrityReportDashboard;
