import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import learningService from "../../services/learningService";
import { PageSpinner } from "../../components/common/Spinner";
import { SHSTrendChart, MomentumIndicator, ComponentBreakdownChart } from "../../components/metrics/TrendChart";
import {
  CheckCircleIcon,
  ExclamationIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";

export default function StudentReport() {
  const { studentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [predictions, setPredictions] = useState(null);

  useEffect(() => {
    loadStudentReport();
  }, [studentId]);

  const loadStudentReport = async () => {
    try {
      setLoading(true);

      // Load historical metrics (would need to add endpoint)
      // const metricsRes = await learningService.getStudentMetrics(studentId);
      // setMetrics(metricsRes.data);

      // Demo data
      setMetrics({
        student_name: "Ahmed Hassan",
        current_shs: 72.5,
        weekly_avg: 70.2,
        momentum: 3.2,
        risk_level: "stable",
        daily_history: generateSampleData(),
      });

      setPredictions({
        exam_readiness: 75,
        dropout_risk: "low",
        topics_needing_help: ["Algebra", "Quadratic Equations"],
        learning_style: "visual",
        interventions: [
          "Watch additional algebra tutorials (recommended: Khan Academy Algebra 1)",
          "Practice quadratic equations 10 minutes daily",
          "Schedule 1-on-1 tutoring session next week",
        ],
      });
    } catch (err) {
      toast.error("Failed to load student report");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (!metrics) return <div className="p-6 text-center">No data available</div>;

  const riskColors = {
    critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    at_risk: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    stable: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    excelling: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  };
  const colors = riskColors[metrics.risk_level] || riskColors.stable;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Academic Report</h1>
        <p className="text-gray-500 mt-2">{metrics.student_name}</p>
        <p className="text-xs text-gray-400 mt-1">
          Generated {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Current Status Card */}
      <div className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-8 mb-8`}>
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-bold uppercase tracking-widest ${colors.text}`}>
              Current Status
            </p>
            <p className="text-5xl font-black mt-4" style={{ color: colors.text.split("-")[1] ? "#" + colors.text.split("-")[1] : "#666" }}>
              {metrics.current_shs.toFixed(1)}
            </p>
            <p className="text-sm text-gray-600 mt-2">Student Health Score (out of 100)</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${colors.text}`}>{metrics.risk_level}</p>
            <p className="text-xs text-gray-500 mt-2 capitalize">Status</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* 7-Day Average */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-semibold text-gray-600 uppercase">7-Day Average</p>
          <p className="text-3xl font-bold text-indigo-600 mt-3">
            {metrics.weekly_avg.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Performance this week</p>
        </div>

        {/* 30-Day Average */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-semibold text-gray-600 uppercase">30-Day Average</p>
          <p className="text-3xl font-bold text-purple-600 mt-3">
            {(metrics.weekly_avg - 2).toFixed(1)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Overall trend</p>
        </div>

        {/* Learning Style */}
        {predictions?.learning_style && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-sm font-semibold text-gray-600 uppercase">Learning Style</p>
            <p className="text-lg font-bold text-blue-600 mt-3 capitalize">
              {predictions.learning_style}
            </p>
            <p className="text-xs text-gray-500 mt-2">Based on engagement patterns</p>
          </div>
        )}
      </div>

      {/* Momentum Indicator */}
      <div className="mb-8">
        <MomentumIndicator
          momentum={metrics.momentum}
          risk_level={metrics.risk_level}
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <SHSTrendChart data={metrics.daily_history} />
        <ComponentBreakdownChart data={metrics.daily_history} />
      </div>

      {/* Exam Readiness */}
      {predictions && (
        <>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 mb-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-blue-900 uppercase tracking-widest">
                  📚 Exam Readiness
                </p>
                <p className="text-5xl font-black text-blue-600 mt-4">
                  {predictions.exam_readiness}%
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  Predicted score on next assessment
                </p>
              </div>
              <div className="text-right">
                <div className="inline-block px-4 py-2 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                  {predictions.exam_readiness >= 80
                    ? "Ready ✅"
                    : predictions.exam_readiness >= 60
                    ? "Preparing 📖"
                    : "Needs Help 🆘"}
                </div>
              </div>
            </div>
          </div>

          {/* Topics Needing Help */}
          {predictions.topics_needing_help && predictions.topics_needing_help.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 mb-8">
              <div className="flex items-center gap-2 mb-6">
                <ExclamationIcon className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-bold text-amber-900">Topics Needing Review</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {predictions.topics_needing_help.map((topic, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-amber-200 bg-white p-4"
                  >
                    <p className="font-semibold text-gray-900">{topic}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Consider scheduling extra practice or tutoring
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          <div className="rounded-2xl border border-green-200 bg-green-50 p-8">
            <div className="flex items-center gap-2 mb-6">
              <SparklesIcon className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-bold text-green-900">Recommended Actions</h3>
            </div>
            <div className="space-y-4">
              {predictions.interventions?.map((action, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-200">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dropout Risk */}
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Risk Assessment</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Dropout Risk Level</p>
                <p className="text-lg font-bold capitalize text-gray-900 mt-2">
                  {predictions.dropout_risk || "Low"}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-full font-semibold text-sm ${
                  predictions.dropout_risk === "low"
                    ? "bg-green-100 text-green-700"
                    : predictions.dropout_risk === "medium"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {predictions.dropout_risk === "low"
                  ? "✅ Engaged"
                  : predictions.dropout_risk === "medium"
                  ? "⚠️ Monitor"
                  : "🔴 At Risk"}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer Note */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
        <p>
          <strong>Note for Parents:</strong> This report is generated automatically based on
          your child's academic activities. If you have concerns, please contact the teacher
          or school administration. The metrics are updated daily and reflect the most recent
          performance data.
        </p>
      </div>
    </div>
  );
}

// Helper function to generate sample data
function generateSampleData() {
  const data = [];
  const today = new Date();
  let shs = 70;

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    shs += (Math.random() - 0.45) * 5; // Random walk
    shs = Math.max(30, Math.min(95, shs)); // Keep in range

    data.push({
      date: date.toISOString().split("T")[0],
      shs: Math.round(shs * 10) / 10,
      video_rate: 40 + Math.random() * 50,
      homework_rate: 50 + Math.random() * 50,
      consistency: 70 + Math.random() * 30,
      behavioral: 60 + Math.random() * 40,
      risk_level:
        shs < 40 ? "critical" : shs < 60 ? "at_risk" : shs < 80 ? "stable" : "excelling",
    });
  }

  return data;
}
