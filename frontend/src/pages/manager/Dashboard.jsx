import { useEffect, useState, useCallback } from "react";
import managerService from "../../services/managerService";
import SchoolCard from "../../components/manager/SchoolCard";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import PeriodFilter from "../../components/analytics/PeriodFilter";
import SPICard from "../../components/analytics/SPICard";
import PerformanceTable from "../../components/analytics/PerformanceTable";
import ScoreBadge from "../../components/analytics/ScoreBadge";
import {
  BuildingOffice2Icon,
  AcademicCapIcon,
  ExclamationTriangleIcon,
  StarIcon,
  SparklesIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";

// ─── DEMO FLAG — set to false to use live API data ────────────────────────────
const DEMO_MODE = false;

const DEMO_SCHOOLS = [
  { id: "s1", name: "Al-Noor Academy", branch_count: 3, class_count: 18 },
  { id: "s2", name: "Bright Horizons School", branch_count: 2, class_count: 12 },
  { id: "s3", name: "Crescent High School", branch_count: 4, class_count: 24 },
];

const DEMO_OVERVIEW = {
  spi: {
    spi_score: 78.4,
    avg_shs: 71.2,
    avg_cvi: 74.8,
    at_risk_percentage: 14.3,
    top_performers_percentage: 31.7,
    rating: "Good - Above Average",
  },
  risk_distribution: { critical: 8, at_risk: 19, stable: 112, excelling: 61 },
};

const DEMO_TEACHERS = [
  { teacher_name: "Ms. Ayesha Khan", avg_cvi: 89.2, avg_shs: 82.1, class_count: 3, struggling_students: 4, teacher_grade: "Excellent" },
  { teacher_name: "Mr. Omar Farooq", avg_cvi: 81.5, avg_shs: 76.4, class_count: 2, struggling_students: 7, teacher_grade: "Good" },
  { teacher_name: "Ms. Sara Malik", avg_cvi: 76.0, avg_shs: 72.9, class_count: 3, struggling_students: 9, teacher_grade: "Good" },
  { teacher_name: "Mr. Hassan Ali", avg_cvi: 58.3, avg_shs: 54.6, class_count: 2, struggling_students: 21, teacher_grade: "Needs Improvement" },
  { teacher_name: "Ms. Fatima Raza", avg_cvi: 63.1, avg_shs: 61.8, class_count: 2, struggling_students: 14, teacher_grade: "Satisfactory" },
];

const DEMO_CLASSES = [
  { class_name: "Class 8-B", branch_name: "Main Campus", teacher_name: "Ms. Ayesha Khan", avg_cvi: 89.2, avg_shs: 82.1, struggling_count: 2, excelling_count: 18 },
  { class_name: "Class 6-A", branch_name: "North Branch", teacher_name: "Mr. Omar Farooq", avg_cvi: 84.7, avg_shs: 79.3, struggling_count: 3, excelling_count: 14 },
  { class_name: "Class 9-C", branch_name: "Main Campus", teacher_name: "Ms. Sara Malik", avg_cvi: 76.0, avg_shs: 72.9, struggling_count: 6, excelling_count: 9 },
  { class_name: "Class 7-D", branch_name: "South Branch", teacher_name: "Mr. Hassan Ali", avg_cvi: 58.3, avg_shs: 54.6, struggling_count: 15, excelling_count: 2 },
  { class_name: "Class 5-C", branch_name: "North Branch", teacher_name: "Ms. Fatima Raza", avg_cvi: 63.1, avg_shs: 61.8, struggling_count: 11, excelling_count: 4 },
];

const DEMO_AI_PREDICTIONS = {
  s1: {
    available: true,
    confidence_score: 87,
    predictions: {
      predicted_spi_next_month: 81.2,
      growth_outlook: "Positive Growth Trajectory",
      at_risk_students_prediction: 14,
      teachers_needing_support_prediction: 1,
      executive_summary:
        "Al-Noor Academy shows strong upward momentum. Video completion rates improved 12% this month. One teacher in Grade 5 needs targeted professional development. Midterm readiness is estimated at 76% across cohorts.",
    },
  },
  s2: {
    available: true,
    confidence_score: 73,
    predictions: {
      predicted_spi_next_month: 74.5,
      growth_outlook: "Stable — Minor Risks",
      at_risk_students_prediction: 22,
      teachers_needing_support_prediction: 2,
      executive_summary:
        "Bright Horizons is stable but 3 classes show declining quiz scores over the past 2 weeks. Attendance in Grade 7 dropped to 68% — early intervention recommended before midterms.",
    },
  },
  s3: {
    available: true,
    confidence_score: 91,
    predictions: {
      predicted_spi_next_month: 83.0,
      growth_outlook: "Strong Positive Growth",
      at_risk_students_prediction: 9,
      teachers_needing_support_prediction: 0,
      executive_summary:
        "Crescent High School is the top performer across all branches. All teachers are rated Good or above. Predicted to reach 'Excellent' SPI rating next month if current trends hold.",
    },
  },
};

export default function ManagerDashboard() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Analytics state
  const [analyticsFilter, setAnalyticsFilter] = useState({
    period: "last_month",
  });
  const [analyticsOverview, setAnalyticsOverview] = useState(null);
  const [teacherAnalytics, setTeacherAnalytics] = useState([]);
  const [classAnalytics, setClassAnalytics] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // AI Predictions state (per-school)
  const [aiPredictions, setAiPredictions] = useState({});

  useEffect(() => {
    if (DEMO_MODE) {
      setSchools(DEMO_SCHOOLS);
      setAnalyticsOverview(DEMO_OVERVIEW);
      setTeacherAnalytics(DEMO_TEACHERS);
      setClassAnalytics(DEMO_CLASSES);
      setAiPredictions(DEMO_AI_PREDICTIONS);
      setLoading(false);
      return;
    }
    managerService
      .getSchools()
      .then((res) => setSchools(res.data || []))
      .catch(() => setError("Failed to load schools."))
      .finally(() => setLoading(false));
  }, []);

  // Load AI predictions for each school (live mode only)
  useEffect(() => {
    if (DEMO_MODE || schools.length === 0) return;
    Promise.allSettled(
      schools.map((s) => managerService.getAIPredictions("school", s.id)),
    ).then((results) => {
      const map = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.data?.available) {
          map[schools[i].id] = r.value.data;
        }
      });
      setAiPredictions(map);
    });
  }, [schools]);

  const loadAnalytics = useCallback(() => {
    if (DEMO_MODE) return;
    const { period, start, end } = analyticsFilter;
    setAnalyticsLoading(true);
    Promise.allSettled([
      managerService.getAnalyticsOverview(period, start, end),
      managerService.getTeacherAnalytics(period, start, end),
      managerService.getClassAnalytics(period, start, end),
    ])
      .then(([ov, ta, ca]) => {
        if (ov.status === "fulfilled") setAnalyticsOverview(ov.value.data);
        if (ta.status === "fulfilled")
          setTeacherAnalytics(ta.value.data?.teachers || []);
        if (ca.status === "fulfilled")
          setClassAnalytics(ca.value.data?.classes || []);
      })
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsFilter]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) return <PageSpinner />;

  const totalSchools = schools.length;
  const totalBranches = schools.reduce((s, x) => s + (x.branch_count || 0), 0);
  const totalClasses = schools.reduce((s, x) => s + (x.class_count || 0), 0);

  const spiData = analyticsOverview?.spi;
  const riskDist = analyticsOverview?.risk_distribution || {};
  const atRisk = (riskDist.critical || 0) + (riskDist.at_risk || 0);
  const excelling = riskDist.excelling || 0;

  const teacherColumns = [
    { key: "teacher_name", label: "Teacher" },
    {
      key: "avg_cvi",
      label: "Avg CVI",
      render: (v) => <ScoreBadge score={parseFloat(v || 0).toFixed(1)} />,
    },
    {
      key: "avg_shs",
      label: "Avg SHS",
      render: (v) => parseFloat(v || 0).toFixed(1),
    },
    { key: "class_count", label: "Classes" },
    {
      key: "struggling_students",
      label: "Struggling",
      render: (v) => <span className="text-amber-600 font-semibold">{v}</span>,
    },
    { key: "teacher_grade", label: "Grade" },
  ];

  const classColumns = [
    { key: "class_name", label: "Class" },
    { key: "branch_name", label: "Branch" },
    { key: "teacher_name", label: "Teacher" },
    {
      key: "avg_cvi",
      label: "CVI",
      render: (v) => <ScoreBadge score={parseFloat(v || 0).toFixed(1)} />,
    },
    {
      key: "avg_shs",
      label: "Avg SHS",
      render: (v) => parseFloat(v || 0).toFixed(1),
    },
    {
      key: "struggling_count",
      label: "Struggling",
      render: (v) => <span className="text-amber-600 font-semibold">{v}</span>,
    },
    {
      key: "excelling_count",
      label: "Excelling",
      render: (v) => <span className="text-blue-600 font-semibold">{v}</span>,
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Manager Dashboard
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Overview of all schools and branches.
      </p>

      {/* Demo mode banner */}
      {DEMO_MODE && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
          <BeakerIcon className="h-4 w-4 shrink-0" />
          <span>
            <strong>Demo Mode</strong> — Showing sample data. Set{" "}
            <code className="bg-amber-100 px-1 rounded">DEMO_MODE = false</code>{" "}
            in Dashboard.jsx to use live API data.
          </span>
        </div>
      )}

      {error && <Alert type="error" message={error} className="mb-6" />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<BuildingOffice2Icon className="h-6 w-6 text-blue-600" />}
          label="Schools"
          value={totalSchools}
        />
        <StatCard
          icon={<BuildingOffice2Icon className="h-6 w-6 text-indigo-600" />}
          label="Branches"
          value={totalBranches}
        />
        <StatCard
          icon={<AcademicCapIcon className="h-6 w-6 text-green-600" />}
          label="Classes"
          value={totalClasses}
        />
        <StatCard
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-red-500" />}
          label="At Risk"
          value={atRisk}
          highlight={atRisk > 0}
        />
      </div>

      {/* ── Analytics Section ────────────────────────── */}
      <div className="mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Performance Analytics
          </h2>
          <PeriodFilter
            period={analyticsFilter.period}
            start={analyticsFilter.start}
            end={analyticsFilter.end}
            onChange={setAnalyticsFilter}
          />
        </div>

        {analyticsLoading ? (
          <div className="py-10 text-center text-sm text-gray-400">
            Loading analytics…
          </div>
        ) : (
          <>
            {/* SPI summary */}
            {spiData && (
              <div className="mb-6">
                <SPICard
                  data={{ ...spiData, school_name: "School Overview" }}
                />
              </div>
            )}

            {/* Teacher Performance */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Teacher Performance
              </h3>
              <PerformanceTable
                rows={teacherAnalytics}
                columns={teacherColumns}
                emptyMsg="No teacher analytics for this period."
              />
            </div>

            {/* Class Performance */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Class Performance
              </h3>
              <PerformanceTable
                rows={classAnalytics}
                columns={classColumns}
                emptyMsg="No class analytics for this period."
              />
            </div>
          </>
        )}
      </div>

      {/* Schools list */}
      {Object.keys(aiPredictions).length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon className="h-5 w-5 text-purple-500" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              AI Predictions (Next 30 Days)
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {schools
              .filter((s) => aiPredictions[s.id])
              .map((s) => {
                const ai = aiPredictions[s.id];
                const preds = ai.predictions || {};
                const outlook =
                  preds.growth_outlook || preds.predicted_spi_next_month;
                const summary = preds.executive_summary;
                const atRiskPred = preds.at_risk_students_prediction;
                const teachersPred = preds.teachers_needing_support_prediction;
                const outlookColor =
                  typeof outlook === "string" &&
                  outlook.toLowerCase().includes("positive")
                    ? "text-green-600"
                    : typeof outlook === "string" &&
                        outlook.toLowerCase().includes("negative")
                      ? "text-red-500"
                      : "text-blue-600";

                return (
                  <div
                    key={s.id}
                    className="bg-white border border-purple-100 rounded-xl p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-gray-800 text-sm">
                        {s.name}
                      </span>
                      {ai.confidence_score && (
                        <span className="text-xs text-gray-400">
                          {parseFloat(ai.confidence_score).toFixed(0)}%
                          confidence
                        </span>
                      )}
                    </div>
                    {outlook && (
                      <p className={`text-sm font-medium mb-1 ${outlookColor}`}>
                        Outlook:{" "}
                        {typeof outlook === "number"
                          ? `SPI ${outlook.toFixed(1)}`
                          : outlook}
                      </p>
                    )}
                    {atRiskPred !== undefined && (
                      <p className="text-xs text-amber-600 mb-1">
                        Predicted at-risk students:{" "}
                        <strong>{atRiskPred}</strong>
                      </p>
                    )}
                    {teachersPred !== undefined && (
                      <p className="text-xs text-rose-500 mb-1">
                        Teachers needing support:{" "}
                        <strong>{teachersPred}</strong>
                      </p>
                    )}
                    {summary && (
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-3">
                        {summary}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Schools list */}
      <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
        Schools
      </h2>
      {schools.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          No schools found.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((s) => (
            <SchoolCard key={s.id} school={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div
      className={`bg-white rounded-2xl border p-5 flex items-center gap-4 ${highlight ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}
    >
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}
