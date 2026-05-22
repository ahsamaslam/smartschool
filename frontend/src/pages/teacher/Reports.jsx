import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import StudentList from "../../components/teacher/StudentList";
import RiskDistributionBar from "../../components/analytics/RiskDistributionBar";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Dropdown from "../../components/common/Dropdown";
import {
  ExclamationTriangleIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

// ── helpers ──────────────────────────────────────────────────────────────────

const GRADE_CONFIG = {
  Excellent:           { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200"   },
  Good:                { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200"  },
  Satisfactory:        { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200"  },
  "Needs Improvement": { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200"    },
  "No data":           { bg: "bg-gray-100",   text: "text-gray-600",   border: "border-gray-200"   },
};

function gradeConfig(grade) {
  return GRADE_CONFIG[grade] || GRADE_CONFIG["No data"];
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0) / arr.length;
}

function buildAlerts(summary, students) {
  const alerts = [];
  if (!students.length) return alerts;

  const avgVideo    = avg(students, "avg_video");
  const avgHomework = avg(students, "homework_rate");
  const variance    = parseFloat(summary.engagement_variance || 0);
  const struggling  = parseInt(summary.struggling_count || 0);
  const total       = students.length;

  // Inequality alert
  if (variance > 25) {
    alerts.push({
      type: "inequality",
      icon: "gap",
      message: `Large performance gap detected (SHS variance: ${variance.toFixed(1)}). Some students are being left behind.`,
      action: "Review individual student SHS reports and offer targeted support.",
    });
  }
  // Low engagement alert
  if (avgVideo < 50 && avgHomework < 60) {
    alerts.push({
      type: "engagement",
      icon: "low",
      message: `Low video engagement (${avgVideo.toFixed(0)}%) AND low homework completion (${avgHomework.toFixed(0)}%). Teaching approach may need revision.`,
      action: "Consider simplifying content, adding more interactive elements, or following up with students directly.",
    });
  } else if (avgVideo > 85 && avgHomework < 60) {
    // High video watch, low homework → content understanding issue
    alerts.push({
      type: "content",
      icon: "complex",
      message: `High video engagement (${avgVideo.toFixed(0)}%) but low homework completion (${avgHomework.toFixed(0)}%). Content may be too complex or homework too difficult.`,
      action: "Review homework difficulty. Consider adding example walkthroughs in your lectures.",
    });
  }
  // Struggling students alert
  if (struggling >= Math.max(1, total * 0.3)) {
    alerts.push({
      type: "struggling",
      icon: "critical",
      message: `${struggling} of ${total} students (${Math.round((struggling / total) * 100)}%) are below SHS 50 — immediate attention needed.`,
      action: "Identify patterns among struggling students and schedule check-ins.",
    });
  }

  return alerts;
}

// ── sub-components ────────────────────────────────────────────────────────────

function MetricTile({ label, value, sub, color = "text-gray-900" }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ComponentBar({ label, value, color, weight }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label} <span className="text-gray-300">({weight})</span></span>
        <span className="font-semibold text-gray-700">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function AlertCard({ alert }) {
  const colors = {
    inequality: "border-purple-200 bg-purple-50 text-purple-700",
    engagement: "border-red-200 bg-red-50 text-red-700",
    content:    "border-amber-200 bg-amber-50 text-amber-700",
    struggling: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[alert.type] || "border-gray-200 bg-gray-50 text-gray-700"}`}>
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{alert.message}</p>
          {alert.action && (
            <p className="text-xs opacity-80 mt-1">
              <span className="font-semibold">Action: </span>{alert.action}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function TeacherReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [classes, setClasses]               = useState([]);
  const [selectedClass, setSelectedClass]   = useState("");
  const [students, setStudents]             = useState([]);
  const [analytics, setAnalytics]           = useState(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingData, setLoadingData]       = useState(false);
  const [error, setError]                   = useState("");

  const preselectedClassId = searchParams.get("class_id");
  const isLocked = searchParams.get("locked") === "true";

  // Load teacher's classes
  useEffect(() => {
    if (!user?.id) return;
    teacherService
      .getClasses(user.id)
      .then((res) => {
        const cls = res.data || [];
        setClasses(cls);
        if (preselectedClassId && cls.some(c => c.id === preselectedClassId)) {
          setSelectedClass(preselectedClassId);
        } else if (cls.length) {
          setSelectedClass(cls[0].id);
        }
      })
      .catch(() => setError("Failed to load classes."))
      .finally(() => setLoadingClasses(false));
  }, [user?.id, preselectedClassId]);

  // Load students + CVI analytics when class changes
  const loadClassData = useCallback(() => {
    if (!selectedClass || !user?.id) return;
    setLoadingData(true);
    Promise.all([
      teacherService.getClassStudents(selectedClass, user.id),
      teacherService.getClassAnalytics(selectedClass),
    ])
      .then(([studRes, analRes]) => {
        setStudents(studRes.data || []);
        setAnalytics(analRes.data || null);
      })
      .catch(() => setError("Failed to load class data."))
      .finally(() => setLoadingData(false));
  }, [selectedClass, user?.id]);

  useEffect(() => {
    loadClassData();
  }, [loadClassData]);

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }));

  if (loadingClasses) return <PageSpinner />;

  const summary  = analytics?.summary || {};
  const riskDist = analytics?.risk_distribution || {};
  const analyticStudents = analytics?.students || [];
  const grade    = summary.teacher_grade || "No data";
  const gc       = gradeConfig(grade);
  const cvi      = parseFloat(summary.avg_cvi || 0);
  const alerts   = analytics ? buildAlerts(summary, analyticStudents) : [];

  const avgVideo      = avg(analyticStudents, "avg_video");
  const avgAttendance = avg(analyticStudents, "attendance_rate");
  const avgHomework   = avg(analyticStudents, "homework_rate");

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || "";

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Class Vitality Index · Student performance breakdown</p>
        </div>
        <div className="max-w-xs w-full">
          {isLocked ? (
            <div className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 text-sm font-medium">
              {selectedClassName}
            </div>
          ) : (
            <Dropdown
              options={classOptions}
              value={selectedClass}
              onChange={setSelectedClass}
              placeholder="Choose a class…"
            />
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {loadingData ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading analytics…</div>
      ) : (
        <>
          {/* ── CVI Header ──────────────────────────────────────────────── */}
          {analytics && (
            <div className={`rounded-2xl border ${gc.border} ${gc.bg} p-6 mb-6`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${gc.text}`}>
                    Class Vitality Index (CVI)
                  </p>
                  <p className="text-xs text-gray-500 max-w-xl">
                    CVI = Avg SHS × 0.35 + Learning Velocity × 0.25 + Consistency × 0.20 + Content Effectiveness × 0.20
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-5xl font-black tabular-nums ${gc.text}`}>{cvi.toFixed(1)}</p>
                  <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mt-1 ${gc.bg} ${gc.text} border ${gc.border}`}>
                    {grade}
                  </span>
                </div>
              </div>

              {/* Grade thresholds legend */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 mb-5">
                <span className="text-blue-600 font-semibold">≥ 85 Excellent</span>
                <span className="text-green-600 font-semibold">≥ 75 Good</span>
                <span className="text-amber-600 font-semibold">≥ 60 Satisfactory</span>
                <span className="text-red-600 font-semibold">&lt; 60 Needs Improvement</span>
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <MetricTile
                  label="Avg SHS"
                  value={parseFloat(summary.avg_shs || 0).toFixed(1)}
                  sub="Class avg health score"
                  color={parseFloat(summary.avg_shs || 0) >= 70 ? "text-green-700" : "text-amber-700"}
                />
                <MetricTile
                  label="Variance"
                  value={parseFloat(summary.engagement_variance || 0).toFixed(1)}
                  sub={parseFloat(summary.engagement_variance || 0) > 25 ? "⚠ High gap" : "Consistent class"}
                  color={parseFloat(summary.engagement_variance || 0) > 25 ? "text-red-600" : "text-green-700"}
                />
                <MetricTile
                  label="Struggling"
                  value={summary.struggling_count || 0}
                  sub="SHS below 50"
                  color={(summary.struggling_count || 0) > 0 ? "text-red-600" : "text-green-700"}
                />
                <MetricTile
                  label="Excelling"
                  value={summary.excelling_count || 0}
                  sub="SHS ≥ 80"
                  color="text-blue-700"
                />
              </div>

              {/* Risk distribution */}
              <div className="bg-white/70 rounded-xl border border-white/80 p-4 mb-5">
                <p className="text-xs font-semibold text-gray-600 mb-2">Risk Distribution</p>
                <RiskDistributionBar distribution={riskDist} />
              </div>

              {/* Component averages */}
              <div className="bg-white/70 rounded-xl border border-white/80 p-4 mb-5">
                <p className="text-xs font-semibold text-gray-600 mb-3">Class Average — Component Scores</p>
                <div className="space-y-2.5">
                  <ComponentBar label="Video Engagement" value={avgVideo}      color="bg-indigo-500" weight="25%" />
                  <ComponentBar label="Attendance"       value={avgAttendance} color="bg-emerald-500" weight="35%" />
                  <ComponentBar label="Homework"         value={avgHomework}   color="bg-violet-500" weight="40%" />
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 text-center text-xs text-gray-500">
                  <span>Contribution: <strong className="text-indigo-700">{(avgVideo * 0.25).toFixed(1)} pts</strong></span>
                  <span>Contribution: <strong className="text-emerald-700">{(avgAttendance * 0.35).toFixed(1)} pts</strong></span>
                  <span>Contribution: <strong className="text-violet-700">{(avgHomework * 0.40).toFixed(1)} pts</strong></span>
                </div>
              </div>

              {/* Teacher-specific alerts */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Teacher Alerts</p>
                  {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
                </div>
              )}
              {alerts.length === 0 && analyticStudents.length > 0 && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                  <span>✓</span> No critical alerts — class is performing well across all metrics.
                </div>
              )}
            </div>
          )}

          {/* ── Student Table ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800 text-sm">Student List</h2>
                <p className="text-xs text-gray-400 mt-0.5">{students.length} students — click a row to view full SHS report</p>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-300" />
            </div>
            <StudentList students={students} classId={selectedClass} />
          </div>
        </>
      )}
    </div>
  );
}
