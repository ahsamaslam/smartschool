import { useEffect, useState, useCallback } from "react";
import { PageSpinner } from "../../components/common/Spinner";
import {
  UsersIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
  BookOpenIcon,
  ChartBarIcon,
  UserGroupIcon,
  SparklesIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import adminService from "../../services/adminService";
import PeriodFilter from "../../components/analytics/PeriodFilter";
import SPICard from "../../components/analytics/SPICard";

// ─── DEMO FLAG — set to false to use live API data ────────────────────────────
const DEMO_MODE = false;

const DEMO_STATS = {
  total_students: 420,
  total_teachers: 38,
  total_schools: 3,
  total_classes: 54,
  total_subjects: 12,
  total_topics: 184,
  total_completed_quizzes: 3218,
  total_managers: 5,
};

const DEMO_ANALYTICS = {
  schools: [
    {
      school_id: "s1",
      school_name: "Al-Noor Academy",
      spi_score: 81.2,
      avg_shs: 74.8,
      avg_cvi: 77.3,
      at_risk_percentage: 12.4,
      top_performers_percentage: 34.1,
      rating: "Excellent - Regional Leader",
    },
    {
      school_id: "s2",
      school_name: "Bright Horizons School",
      spi_score: 72.6,
      avg_shs: 68.1,
      avg_cvi: 71.4,
      at_risk_percentage: 18.7,
      top_performers_percentage: 25.3,
      rating: "Good - Above Average",
    },
    {
      school_id: "s3",
      school_name: "Crescent High School",
      spi_score: 88.5,
      avg_shs: 82.3,
      avg_cvi: 85.1,
      at_risk_percentage: 7.9,
      top_performers_percentage: 45.6,
      rating: "Excellent - Regional Leader",
    },
  ],
};

const DEMO_AI = {
  s1: {
    available: true,
    confidence_score: 87,
    predictions: {
      predicted_spi_next_month: 83.0,
      growth_outlook: "Positive Growth Trajectory",
      at_risk_students_prediction: 14,
      teachers_needing_support_prediction: 1,
      executive_summary:
        "Strong upward trend. Video completion up 12%. One Grade 5 teacher needs targeted PD. Midterm readiness at 76%.",
    },
  },
  s2: {
    available: true,
    confidence_score: 73,
    predictions: {
      predicted_spi_next_month: 71.0,
      growth_outlook: "Stable — Minor Risks",
      at_risk_students_prediction: 26,
      teachers_needing_support_prediction: 2,
      executive_summary:
        "3 classes show declining quiz scores. Grade 7 attendance at 68% — intervention needed before midterms.",
    },
  },
  s3: {
    available: true,
    confidence_score: 91,
    predictions: {
      predicted_spi_next_month: 91.0,
      growth_outlook: "Strong Positive Growth",
      at_risk_students_prediction: 6,
      teachers_needing_support_prediction: 0,
      executive_summary:
        "Top performer across all metrics. All teachers rated Good or above. On track for Outstanding rating next month.",
    },
  },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Analytics state
  const [analyticsFilter, setAnalyticsFilter] = useState({
    period: "last_month",
  });
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [aiPredictions, setAiPredictions] = useState({});

  useEffect(() => {
    if (DEMO_MODE) {
      setStats(DEMO_STATS);
      setAnalyticsData(DEMO_ANALYTICS);
      setAiPredictions(DEMO_AI);
      setLoading(false);
      return;
    }
    import("../../services/api").then(({ default: api }) => {
      api
        .get("/admins/stats/system")
        .then((res) => setStats(res.data))
        .finally(() => setLoading(false));
    });
  }, []);

  const loadAnalytics = useCallback(() => {
    if (DEMO_MODE) return;
    const { period, start, end } = analyticsFilter;
    setAnalyticsLoading(true);
    adminService
      .getAnalyticsOverview(period, start, end)
      .then((res) => setAnalyticsData(res.data))
      .catch(() => setAnalyticsData(null))
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsFilter]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Load AI predictions for each school after analytics data arrives (live mode only)
  useEffect(() => {
    if (DEMO_MODE) return;
    const schools = analyticsData?.schools || [];
    if (schools.length === 0) return;
    Promise.allSettled(
      schools.map((s) => adminService.getAIPredictions("school", s.school_id)),
    ).then((results) => {
      const map = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.data?.available) {
          map[schools[i].school_id] = r.value.data;
        }
      });
      setAiPredictions(map);
    });
  }, [analyticsData]);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">System-wide overview.</p>

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

      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Students"
          value={stats?.total_students ?? 0}
          icon={<UserGroupIcon className="h-6 w-6 text-green-600" />}
          to="/admin/students"
          color="green"
        />
        <StatCard
          label="Teachers"
          value={stats?.total_teachers ?? 0}
          icon={<AcademicCapIcon className="h-6 w-6 text-blue-600" />}
          to="/admin/teachers"
          color="blue"
        />
        <StatCard
          label="Schools"
          value={stats?.total_schools ?? 0}
          icon={<BuildingOffice2Icon className="h-6 w-6 text-indigo-600" />}
          to="/admin/schools"
          color="indigo"
        />
        <StatCard
          label="Classes"
          value={stats?.total_classes ?? 0}
          icon={<AcademicCapIcon className="h-6 w-6 text-teal-600" />}
          to="/admin/schools"
          color="teal"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Subjects"
          value={stats?.total_subjects ?? 0}
          icon={<BookOpenIcon className="h-6 w-6 text-purple-600" />}
          to="/admin/curriculum"
          color="purple"
          small
        />
        <StatCard
          label="Topics"
          value={stats?.total_topics ?? 0}
          icon={<BookOpenIcon className="h-6 w-6 text-amber-600" />}
          to="/admin/curriculum"
          color="amber"
          small
        />
        <StatCard
          label="Completed Quizzes"
          value={stats?.total_completed_quizzes ?? 0}
          icon={<ChartBarIcon className="h-6 w-6 text-gray-500" />}
          to="/admin/users"
          color="gray"
          small
        />
        <StatCard
          label="Managers"
          value={stats?.total_managers ?? 0}
          icon={<UsersIcon className="h-6 w-6 text-rose-600" />}
          to="/admin/users"
          color="rose"
          small
        />
      </div>

      {/* ── School Performance Analytics ─────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            School Performance (SPI)
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
        ) : !analyticsData || (analyticsData.schools || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
            No school performance data for this period. Scores are calculated
            weekly.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyticsData.schools.map((school) => {
              const ai = aiPredictions[school.school_id];
              const preds = ai?.predictions || {};
              const outlook = preds.growth_outlook;
              const summary = preds.executive_summary;
              return (
                <div key={school.school_id} className="flex flex-col gap-2">
                  <Link to={`/admin/schools/${school.school_id}/performance`}>
                    <SPICard
                      data={{
                        school_name: school.school_name,
                        spi_score: school.spi_score,
                        avg_shs: school.avg_shs,
                        avg_cvi: school.avg_cvi,
                        at_risk_percentage: school.at_risk_percentage,
                        top_performers_percentage:
                          school.top_performers_percentage,
                        rating: school.rating,
                      }}
                    />
                  </Link>
                  {ai && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <SparklesIcon className="h-3.5 w-3.5 text-purple-500" />
                        <span className="text-xs font-semibold text-purple-700">
                          AI Forecast
                        </span>
                        {ai.confidence_score && (
                          <span className="ml-auto text-xs text-gray-400">
                            {parseFloat(ai.confidence_score).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {outlook && (
                        <p className="text-xs text-gray-600 font-medium mb-0.5">
                          {typeof outlook === "number"
                            ? `Predicted SPI: ${outlook.toFixed(1)}`
                            : outlook}
                        </p>
                      )}
                      {summary && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {summary}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, to, small }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all block"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <p
        className={`font-bold text-gray-900 tabular-nums ${small ? "text-xl" : "text-2xl"}`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </Link>
  );
}
