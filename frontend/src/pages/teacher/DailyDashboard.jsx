import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import { ExclamationTriangleIcon, CheckCircleIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

export default function TeacherDailyDashboard() {
  const { classId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [riskSummary, setRiskSummary] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, [classId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get class alerts
      const alertsRes = await teacherService.getClassAlerts(classId, {
        unresolved_only: true,
      });
      setAlerts(alertsRes.data);

      // Get risk summary
      const riskRes = await teacherService.getClassRiskSummary(classId);
      setRiskSummary(riskRes.data);

      // Dummy data for demonstration
      setData({
        class_name: "Class 5-A",
        today_health: 72,
        momentum: -5,
        students_total: 25,
      });
    } catch (err) {
      toast.error("Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSpinner />;

  const criticalCount = alerts.critical?.length || 0;
  const warningCount = alerts.warning?.length || 0;
  const unstableCount =
    (riskSummary?.risk_distribution?.critical?.count || 0) +
    (riskSummary?.risk_distribution?.at_risk?.count || 0);

  return (
    <div className="p-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {data?.class_name} · Daily Dashboard
        </h1>
        <p className="text-gray-500 mt-2">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Class Health Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Class Health Score
            </p>
            <div className="flex items-end gap-3 mt-3">
              <span className="text-5xl font-black text-indigo-600">
                {data?.today_health}
              </span>
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 mb-2">
                <span className="text-sm font-semibold text-amber-600">
                  {data?.momentum >= 0 ? "↑" : "↓"} {Math.abs(data?.momentum || 0)}%
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{data?.students_total}</p>
            <p className="text-sm text-gray-500 mt-1">Total Students</p>
          </div>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Critical Alerts */}
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700 uppercase tracking-wide">
                🔴 Urgent
              </p>
              <p className="text-4xl font-black text-red-600 mt-3">{criticalCount}</p>
              <p className="text-xs text-red-600 mt-2">students need immediate help</p>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500 opacity-30" />
          </div>
        </div>

        {/* Watch List */}
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                🟡 Watch List
              </p>
              <p className="text-4xl font-black text-amber-600 mt-3">{unstableCount}</p>
              <p className="text-xs text-amber-600 mt-2">at-risk or critical students</p>
            </div>
            <ChevronRightIcon className="h-8 w-8 text-amber-500 opacity-30" />
          </div>
        </div>

        {/* Performing Well */}
        <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
                🟢 Performing
              </p>
              <p className="text-4xl font-black text-green-600 mt-3">
                {(data?.students_total || 0) - unstableCount}
              </p>
              <p className="text-xs text-green-600 mt-2">stable or excelling</p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-500 opacity-30" />
          </div>
        </div>
      </div>

      {/* Critical Alerts Detail */}
      {criticalCount > 0 && (
        <div className="rounded-2xl border border-red-200 bg-white p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🔴 URGENT - Immediate Action Required</h3>
          <div className="space-y-3">
            {alerts.critical?.map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Risk Distribution */}
      {riskSummary && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Student Performance Distribution</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Critical */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-red-700">Critical</span>
                <span className="text-2xl font-bold text-red-600">
                  {riskSummary.risk_distribution?.critical?.count || 0}
                </span>
              </div>
              <div className="w-full bg-red-200 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, ((riskSummary.risk_distribution?.critical?.count || 0) / (data?.students_total || 1)) * 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-red-600 mt-2">
                Avg SHS: {(riskSummary.risk_distribution?.critical?.avg_shs || 0).toFixed(1)}
              </p>
            </div>

            {/* At-Risk */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-amber-700">At-Risk</span>
                <span className="text-2xl font-bold text-amber-600">
                  {riskSummary.risk_distribution?.at_risk?.count || 0}
                </span>
              </div>
              <div className="w-full bg-amber-200 rounded-full h-2">
                <div
                  className="bg-amber-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, ((riskSummary.risk_distribution?.at_risk?.count || 0) / (data?.students_total || 1)) * 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                Avg SHS: {(riskSummary.risk_distribution?.at_risk?.avg_shs || 0).toFixed(1)}
              </p>
            </div>

            {/* Stable */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-green-700">Stable</span>
                <span className="text-2xl font-bold text-green-600">
                  {riskSummary.risk_distribution?.stable?.count || 0}
                </span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, ((riskSummary.risk_distribution?.stable?.count || 0) / (data?.students_total || 1)) * 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-green-600 mt-2">
                Avg SHS: {(riskSummary.risk_distribution?.stable?.avg_shs || 0).toFixed(1)}
              </p>
            </div>

            {/* Excelling */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-700">Excelling</span>
                <span className="text-2xl font-bold text-blue-600">
                  {riskSummary.risk_distribution?.excelling?.count || 0}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, ((riskSummary.risk_distribution?.excelling?.count || 0) / (data?.students_total || 1)) * 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Avg SHS: {(riskSummary.risk_distribution?.excelling?.avg_shs || 0).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {riskSummary?.action_items && riskSummary.action_items.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">📋 Recommendations</h3>
          <div className="space-y-3">
            {riskSummary.action_items.map((item, idx) => (
              item && (
                <div key={idx} className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-200">
                      <span className="text-xs font-bold text-blue-700">{idx + 1}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">{item.recommendation}</p>
                    {item.count > 0 && (
                      <p className="text-xs text-blue-700 mt-1">{item.count} students affected</p>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertItem({ alert }) {
  return (
    <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-red-900 text-sm">{alert.message}</p>
          <p className="text-xs text-red-700 mt-2">{alert.action}</p>
        </div>
        <button className="text-xs font-semibold text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-100">
          View Details
        </button>
      </div>
    </div>
  );
}
