import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const RISK_CONFIG = {
  critical:   { label: "Critical",   bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    score: "text-red-600"    },
  at_risk:    { label: "At-Risk",    bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  score: "text-amber-600"  },
  stable:     { label: "Stable",     bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  score: "text-green-600"  },
  excelling:  { label: "Excelling",  bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200",   score: "text-blue-600"   },
};

function ProgressBar({ value, color = "bg-indigo-500" }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div
        className={`h-2.5 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function ComponentCard({ title, weight, rate, detail, barColor, tip }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">Weight: {weight}</p>
        </div>
        <p className="text-2xl font-bold text-gray-900">{rate.toFixed(1)}%</p>
      </div>
      <ProgressBar value={rate} color={barColor} />
      <p className="text-xs text-gray-500 mt-2">{detail}</p>
      {rate < 60 && tip && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2">{tip}</p>
      )}
    </div>
  );
}

export default function StudentDetail() {
  const { classId, studentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    teacherService
      .getStudentPerformance(studentId, classId, user?.id)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load student report."))
      .finally(() => setLoading(false));
  }, [studentId, classId, user?.id]);

  if (loading) return <PageSpinner />;

  const risk = RISK_CONFIG[data?.risk_level] || RISK_CONFIG.stable;
  const shs = data?.shs ?? 0;
  const video = data?.video || {};
  const attendance = data?.attendance || {};
  const homework = data?.homework || {};
  const consistency = data?.consistency || {};
  const behavioral = data?.behavioral || {};
  const alerts = data?.alerts || [];

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-6 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to class
      </button>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {data && (
        <>
          {/* Header — student identity + SHS score */}
          <div className={`rounded-2xl border ${risk.border} ${risk.bg} p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${risk.text}`}>
                {risk.label}
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{data.student?.full_name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{data.student?.email}</p>
              <p className="text-sm text-gray-600 mt-2">
                Class rank: <span className="font-semibold text-gray-800">#{data.rank}</span> of{" "}
                <span className="font-semibold">{data.total_students}</span> students
              </p>
            </div>
            <div className="text-center sm:text-right shrink-0">
              <p className={`text-6xl font-black ${risk.score}`}>{shs.toFixed(1)}</p>
              <p className="text-sm font-semibold text-gray-500 mt-1">Student Health Score</p>
              <p className="text-xs text-gray-400">out of 100</p>
            </div>
          </div>

          {/* SHS formula legend */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 mb-6 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
            <span>SHS = Video×0.25 + Homework×0.40 + Consistency×0.20 + Behavioral×0.15</span>
            <span className="text-red-500">Critical &lt; 40</span>
            <span className="text-amber-500">At-Risk 40–59</span>
            <span className="text-green-600">Stable 60–79</span>
            <span className="text-blue-600">Excelling ≥ 80</span>
          </div>

          {/* Component breakdown - 4 components */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <ComponentCard
              title="Video Engagement"
              weight="25%"
              rate={video.rate || 0}
              barColor="bg-indigo-500"
              detail={
                video.total_lectures > 0
                  ? `${video.watched_count} of ${video.total_lectures} lectures (≥75%)`
                  : "No lectures yet"
              }
              tip="Encourage watching missing lectures."
            />
            <ComponentCard
              title="Homework"
              weight="40%"
              rate={homework.rate || 0}
              barColor="bg-violet-500"
              detail={
                homework.graded_count > 0
                  ? `${homework.marks_earned?.toFixed(0)}/${homework.total_marks_available?.toFixed(0)} marks`
                  : `${homework.submitted_count}/${homework.total_homeworks} submitted`
              }
              tip="Focus on homework quality and submission."
            />
            <ComponentCard
              title="Consistency"
              weight="20%"
              rate={consistency.rate || 0}
              barColor="bg-cyan-500"
              detail={`Attend: ${consistency.attendance?.toFixed(0)}% · Submit: ${consistency.submission?.toFixed(0)}%`}
              tip="Consistency in attendance and submission matters."
            />
            <ComponentCard
              title="Behavioral Health"
              weight="15%"
              rate={behavioral.rate || 0}
              barColor="bg-orange-500"
              detail={`Retakes: ${behavioral.homework_retakes_avg?.toFixed(1)} · Revisits: ${behavioral.topic_revisits_avg?.toFixed(1)}`}
              tip="Study habits and engagement patterns."
            />
          </div>

          {/* Contribution to SHS */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">SHS Contribution Breakdown (25-40-20-15)</p>
            <div className="space-y-3">
              {[
                { label: "Video (×0.25)", value: (video.rate || 0) * 0.25, max: 25, color: "bg-indigo-400" },
                { label: "Homework (×0.40)", value: (homework.rate || 0) * 0.40, max: 40, color: "bg-violet-400" },
                { label: "Consistency (×0.20)", value: (consistency.rate || 0) * 0.20, max: 20, color: "bg-cyan-400" },
                { label: "Behavioral (×0.15)", value: (behavioral.rate || 0) * 0.15, max: 15, color: "bg-orange-400" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <p className="text-xs text-gray-500 w-40 shrink-0">{item.label}</p>
                  <div className="flex-1">
                    <ProgressBar value={(item.value / item.max) * 100} color={item.color} />
                  </div>
                  <p className="text-xs font-semibold text-gray-700 w-16 text-right">
                    {item.value.toFixed(1)} / {item.max}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
              <span className="font-medium text-gray-600">Total SHS</span>
              <span className={`font-black text-lg ${risk.score}`}>{shs.toFixed(1)}</span>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-700">Action Required</p>
              </div>
              <ul className="space-y-2">
                {alerts.map((a, i) => (
                  <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">•</span>
                    {a.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
