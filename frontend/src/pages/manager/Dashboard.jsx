import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PageSpinner } from "../../components/common/Spinner";
import {
  UsersIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  StarIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import managerService from "../../services/managerService";
import PeriodFilter from "../../components/analytics/PeriodFilter";
import SPICard from "../../components/analytics/SPICard";

export default function ManagerDashboard() {
  const navigate = useNavigate();

  const [schools, setSchools]       = useState([]);
  const [loading, setLoading]       = useState(true);

  const [analyticsFilter, setAnalyticsFilter] = useState({ period: "last_month" });
  const [analyticsData, setAnalyticsData]     = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [aiPredictions, setAiPredictions] = useState({});

  useEffect(() => {
    managerService
      .getSchools()
      .then((res) => setSchools(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (schools.length === 0) return;
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
    const { period, start, end } = analyticsFilter;
    setAnalyticsLoading(true);
    managerService
      .getAnalyticsOverview(period, start, end)
      .then((res) => setAnalyticsData(res.data))
      .catch(() => setAnalyticsData(null))
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsFilter]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) return <PageSpinner />;

  const spi      = analyticsData?.spi || {};
  const riskDist = analyticsData?.risk_distribution || {};
  const tq       = analyticsData?.components?.teacher_quality || {};

  const totalStudents       = spi.total_enrolled        || 0;
  const totalActiveStudents = spi.total_active_students || 0;
  const totalTeachers       = tq.total_teachers         || 0;
  const totalBranches       = schools.reduce((s, x) => s + (x.branch_count || 0), 0);
  const totalClasses        = schools.reduce((s, x) => s + (x.class_count  || 0), 0);
  const atRisk              = (riskDist.critical || 0) + (riskDist.at_risk || 0);
  const excelling           = riskDist.excelling || 0;

  const schoolName = schools[0]?.name || "School";

  const spiCardData = spi.spi_score != null
    ? {
        school_name:              schoolName,
        spi_score:                spi.spi_score,
        avg_shs:                  spi.avg_shs,
        avg_cvi:                  spi.avg_cvi,
        at_risk_percentage:       spi.at_risk_percentage,
        top_performers_percentage: spi.top_performers_percentage,
        rating:                   spi.rating,
      }
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Manager Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">Overview of your school and branches.</p>

      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Students"
          value={totalStudents}
          icon={<UserGroupIcon className="h-6 w-6 text-green-600" />}
          to="/manager/students"
        />
        <StatCard
          label="Teachers"
          value={totalTeachers}
          icon={<AcademicCapIcon className="h-6 w-6 text-blue-600" />}
          to="/manager/teachers"
        />
        <StatCard
          label="Branches"
          value={totalBranches}
          icon={<BuildingOffice2Icon className="h-6 w-6 text-indigo-600" />}
          to="/manager/school"
        />
        <StatCard
          label="Classes"
          value={totalClasses}
          icon={<AcademicCapIcon className="h-6 w-6 text-teal-600" />}
          to="/manager/school"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="At Risk"
          value={atRisk}
          icon={<ExclamationTriangleIcon className="h-5 w-5 text-red-500" />}
          small
        />
        <StatCard
          label="Excelling"
          value={excelling}
          icon={<StarIcon className="h-5 w-5 text-amber-500" />}
          small
        />
        <StatCard
          label="Participating"
          value={totalActiveStudents}
          icon={<UsersIcon className="h-5 w-5 text-green-500" />}
          small
        />
        <StatCard
          label="Schools"
          value={schools.length}
          icon={<BuildingOffice2Icon className="h-5 w-5 text-gray-500" />}
          to="/manager/school"
          small
        />
      </div>

      {/* School Performance (SPI) */}
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
        ) : !spiCardData ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
            No school performance data for this period. Scores are calculated weekly.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((school) => {
              const ai    = aiPredictions[school.id];
              const preds = ai?.predictions || {};
              const outlook = preds.growth_outlook;
              const summary = preds.executive_summary;
              return (
                <div key={school.id} className="flex flex-col gap-2">
                  <SPICard
                    data={{ ...spiCardData, school_name: school.name }}
                    onClick={() => navigate("/manager/performance")}
                  />
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
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all block">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <p className={`font-bold text-gray-900 tabular-nums ${small ? "text-xl" : "text-2xl"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}
