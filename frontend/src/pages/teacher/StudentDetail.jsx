import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import teacherService from "../../services/teacherService";
import PerformanceTable from "../../components/teacher/PerformanceTable";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const RISK_CONFIG = {
  excelling: { label: "Excelling", color: "bg-blue-100 text-blue-700", ring: "ring-blue-400" },
  stable: { label: "Stable", color: "bg-green-100 text-green-700", ring: "ring-green-400" },
  at_risk: { label: "At Risk", color: "bg-yellow-100 text-yellow-800", ring: "ring-yellow-400" },
  critical: { label: "Critical", color: "bg-red-100 text-red-700", ring: "ring-red-400" },
};

function SHSRing({ score, risk }) {
  const cfg = RISK_CONFIG[risk] || RISK_CONFIG.stable;
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={risk === "excelling" ? "#3b82f6" : risk === "stable" ? "#22c55e" : risk === "at_risk" ? "#f59e0b" : "#ef4444"}
          strokeWidth="12"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold text-gray-800">{score}</p>
        <p className="text-xs text-gray-400">/ 100</p>
      </div>
    </div>
  );
}

function ComponentBar({ label, value, weight, color }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{label} <span className="text-gray-400">({weight}%)</span></span>
        <span className="text-xs font-semibold text-gray-700">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export default function StudentDetail() {
  const { classId, studentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    teacherService
      .getStudentPerformance(studentId, classId)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load student performance."))
      .finally(() => setLoading(false));
  }, [studentId, classId]);

  if (loading) return <PageSpinner />;

  const shs = data?.shs ?? 0;
  const risk = data?.risk_level ?? "stable";
  const riskCfg = RISK_CONFIG[risk] || RISK_CONFIG.stable;

  const comp = data?.components || {};
  const video = data?.video || {};
  const attendance = data?.attendance || {};
  const homework = data?.homework || {};
  const behavioral = data?.behavioral || {};
  const alerts = data?.alerts || [];

  const submissionRate =
    homework.total_homeworks > 0
      ? Math.round((homework.submitted_count / homework.total_homeworks) * 100)
      : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to class
      </button>

      {error && <Alert type="error" message={error} />}

      {/* Student header */}
      {data?.student && (
        <div className="flex items-center gap-4">
          {data.student.profile_picture_url ? (
            <img src={data.student.profile_picture_url} className="h-12 w-12 rounded-full object-cover" alt="" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
              {data.student.full_name?.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-800">{data.student.full_name}</h1>
            <p className="text-sm text-gray-400">{data.student.email}</p>
          </div>
        </div>
      )}

      {/* SHS Hero */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
          Student Health Score (SHS)
        </h2>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Ring + badge */}
          <div className="flex flex-col items-center gap-3">
            <SHSRing score={shs} risk={risk} />
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${riskCfg.color}`}>
              {riskCfg.label}
            </span>
            {data?.rank != null && (
              <p className="text-xs text-gray-400">
                Rank <span className="font-semibold text-gray-600">#{data.rank}</span> of {data.total_students}
              </p>
            )}
          </div>

          {/* Component bars */}
          <div className="flex-1 w-full space-y-3">
            <ComponentBar label="Homework" value={comp.homework ?? 0} weight={40} color="bg-purple-500" />
            <ComponentBar label="Video Engagement" value={comp.video ?? 0} weight={25} color="bg-blue-500" />
            <ComponentBar label="Attendance" value={comp.attendance ?? 0} weight={20} color="bg-green-500" />
            <ComponentBar label="Behavioral" value={comp.behavioral ?? 0} weight={15} color="bg-orange-400" />
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          Formula: Homework×40% + Video×25% + Attendance×20% + Behavioral×15%
        </p>
      </div>

      {/* Detail cards grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Video */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Video</p>
          <p className="text-2xl font-bold text-blue-600">{(comp.video ?? 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {video.watched_count ?? 0}/{video.total_lectures ?? 0} lectures
          </p>
        </div>

        {/* Homework */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Homework</p>
          <p className="text-2xl font-bold text-purple-600">{(comp.homework ?? 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {homework.submitted_count ?? 0}/{homework.total_homeworks ?? 0} submitted
          </p>
          {homework.total_marks_available > 0 && (
            <p className="text-xs text-gray-400">
              {(homework.marks_earned ?? 0).toFixed(0)}/{homework.total_marks_available.toFixed(0)} marks
            </p>
          )}
        </div>

        {/* Attendance */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Attendance</p>
          <p className="text-2xl font-bold text-green-600">{(comp.attendance ?? 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {attendance.present_days ?? 0}/{attendance.total_days ?? 0} days
          </p>
        </div>

        {/* Behavioral */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Behavioral</p>
          <p className="text-2xl font-bold text-orange-500">{(comp.behavioral ?? 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {behavioral.revisits ?? 0} revisits · {behavioral.retakes ?? 0} retakes
          </p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Behavioral detail */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
          Behavioral Breakdown
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-400 mb-1">Topic Revisits</p>
            <p className="text-2xl font-bold text-gray-800">{behavioral.revisits ?? 0}</p>
            <p className="text-xs text-gray-400">Score: {(behavioral.revisit_score ?? 0).toFixed(1)} / 100</p>
            <p className="text-xs text-gray-400">Cap: 5 revisits = 100%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Homework Retakes</p>
            <p className="text-2xl font-bold text-gray-800">{behavioral.retakes ?? 0}</p>
            <p className="text-xs text-gray-400">Score: {(behavioral.retake_score ?? 0).toFixed(1)} / 100</p>
            <p className="text-xs text-gray-400">Cap: 3 retakes = 100%</p>
          </div>
        </div>
      </div>

      {/* Topic performance */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Topic Performance
          </h2>
        </div>
        <PerformanceTable data={data?.topic_performance || []} />
      </div>
    </div>
  );
}
