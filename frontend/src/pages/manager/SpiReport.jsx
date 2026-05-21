import { useEffect, useState, useCallback } from "react";
import managerService from "../../services/managerService";
import RiskDistributionBar from "../../components/analytics/RiskDistributionBar";
import { PageSpinner } from "../../components/common/Spinner";
import {
  AcademicCapIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

// ── helpers ──────────────────────────────────────────────────────────────────

const RATING_CONFIG = {
  Outstanding:        { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", score: "text-purple-600" },
  Excellent:          { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   score: "text-blue-600"   },
  Good:               { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  score: "text-green-600"  },
  Satisfactory:       { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  score: "text-amber-600"  },
  "Needs Improvement":{ bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    score: "text-red-600"    },
  "No data":          { bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-500",   score: "text-gray-600"   },
};

const GRADE_COLOR = {
  Excellent:           "bg-blue-100 text-blue-700",
  Good:                "bg-green-100 text-green-700",
  Satisfactory:        "bg-amber-100 text-amber-700",
  "Needs Improvement": "bg-red-100 text-red-700",
  "No data":           "bg-gray-100 text-gray-600",
};

function rc(rating) { return RATING_CONFIG[rating] || RATING_CONFIG["No data"]; }

function ScoreBar({ value, color = "bg-indigo-500", max = 100 }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function ComponentCard({ icon: Icon, title, weight, score, color, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${color} bg-opacity-10`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            <p className="text-xs text-gray-400">Weight: {weight} of SPI</p>
          </div>
        </div>
        <p className={`text-2xl font-black tabular-nums ${color}`}>{score.toFixed(1)}</p>
      </div>
      <ScoreBar value={score} color={color.replace("text-", "bg-")} />
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, suffix = "", note }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-800">{typeof value === "number" ? value.toFixed(1) : value}{suffix}
        {note && <span className="ml-1 text-gray-400">({note})</span>}
      </span>
    </div>
  );
}

function GradeChip({ grade }) {
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_COLOR[grade] || GRADE_COLOR["No data"]}`}>{grade}</span>;
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function SpiReport() {
  const [data, setData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      managerService.getAnalyticsOverview(),
      managerService.getTeacherAnalytics(),
      managerService.getClassAnalytics(),
    ]).then(([ov, ta]) => {
      if (ov.status === "fulfilled") setData(ov.value.data);
      if (ta.status === "fulfilled") setTeachers(ta.value.data?.teachers || []);
      if (ov.status === "rejected") setError("Failed to load SPI data.");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSpinner />;

  const spi = data?.spi || {};
  const comp = data?.components || {};
  const riskDist = data?.risk_distribution || {};
  const classes = data?.classes || [];
  const rating = spi.rating || "No data";
  const cfg = rc(rating);
  const spiScore = parseFloat(spi.spi_score || 0);

  const academic = comp.academic_excellence || {};
  const teacherQ = comp.teacher_quality || {};
  const opEff = comp.operational_efficiency || {};
  const growth = comp.growth_trajectory || {};

  // Top / bottom classes
  const topClasses = [...classes].sort((a, b) => b.avg_cvi - a.avg_cvi).slice(0, 3);
  const bottomClasses = [...classes].sort((a, b) => a.avg_cvi - b.avg_cvi).filter(c => c.total_students > 0).slice(0, 3);

  // Teacher breakdown
  const excellentTeachers = teachers.filter(t => t.avg_cvi >= 85);
  const underperformingTeachers = teachers.filter(t => t.avg_cvi < 60 && t.class_count > 0);

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">School Performance Index (SPI)</h1>
      <p className="text-sm text-gray-500 mb-6">Principal-level effectiveness · Live data from all classes</p>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</div>}

      {/* ── SPI Header ───────────────────────────────────────────────── */}
      <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6 mb-6`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${cfg.text}`}>School Performance Index</p>
            <p className="text-xs text-gray-500 max-w-xl">
              SPI = Academic Excellence × 0.40 + Teacher Quality × 0.30 + Operational Efficiency × 0.20 + Growth × 0.10
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-2">
              <span className="text-purple-600 font-semibold">≥ 90 Outstanding</span>
              <span className="text-blue-600 font-semibold">≥ 80 Excellent</span>
              <span className="text-green-600 font-semibold">≥ 70 Good</span>
              <span className="text-amber-600 font-semibold">≥ 60 Satisfactory</span>
              <span className="text-red-600 font-semibold">&lt; 60 Needs Improvement</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-6xl font-black tabular-nums ${cfg.score}`}>{spiScore.toFixed(1)}</p>
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mt-1 border ${cfg.border} ${cfg.text}`}>{rating}</span>
          </div>
        </div>

        {/* Overall bar */}
        <div className="bg-white/70 rounded-xl border border-white/80 p-4 mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Overall SPI</span><span>{spiScore.toFixed(1)} / 100</span>
          </div>
          <ScoreBar value={spiScore} color={spiScore >= 80 ? "bg-blue-500" : spiScore >= 60 ? "bg-green-500" : "bg-amber-500"} />
        </div>

        {/* Risk distribution */}
        <div className="bg-white/70 rounded-xl border border-white/80 p-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">School-Wide Risk Distribution ({(riskDist.critical||0)+(riskDist.at_risk||0)+(riskDist.stable||0)+(riskDist.excelling||0)} students)</p>
          <RiskDistributionBar distribution={riskDist} />
        </div>
      </div>

      {/* ── 4 SPI Components ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        {/* 1. Academic Excellence — 40% */}
        <ComponentCard icon={AcademicCapIcon} title="Academic Excellence" weight="40%" score={academic.score || 0} color="text-indigo-600">
          <MetricRow label="School Avg SHS" value={academic.avg_shs || 0} suffix="/100" />
          <MetricRow label="Top Performers (SHS ≥ 80)" value={academic.top_performers_pct || 0} suffix="%" />
          <MetricRow label="At-Risk (SHS < 50)" value={academic.at_risk_pct || 0} suffix="%" note="lower is better" />
          <MetricRow label="Total Students" value={academic.total_students || 0} suffix="" />
          <div className="pt-2 text-xs text-gray-400">
            Formula: Avg SHS × 0.50 + Top% × 0.30 + (100−AtRisk%) × 0.20
          </div>
        </ComponentCard>

        {/* 2. Teacher Quality — 30% */}
        <ComponentCard icon={UserGroupIcon} title="Teacher Quality" weight="30%" score={teacherQ.score || 0} color="text-emerald-600">
          <MetricRow label="Avg Class CVI" value={teacherQ.avg_cvi || 0} suffix="/100" />
          <MetricRow label="Excellent Teachers (CVI ≥ 85)" value={teacherQ.excellent_count || 0} suffix={` of ${teacherQ.total_teachers || 0}`} />
          <MetricRow label="Underperforming (CVI < 60)" value={teacherQ.underperforming_count || 0} suffix={` of ${teacherQ.total_teachers || 0}`} />
          <MetricRow label="CVI Consistency (σ)" value={teacherQ.teacher_variance || 0} note="lower = more consistent" />
          <div className="pt-2 text-xs text-gray-400">
            Formula: Avg CVI × 0.50 + Excellent% × 0.30 + (100−Underperforming%) × 0.20
          </div>
        </ComponentCard>

        {/* 3. Operational Efficiency — 20% */}
        <ComponentCard icon={ClipboardDocumentListIcon} title="Operational Efficiency" weight="20%" score={opEff.score || 0} color="text-violet-600">
          <MetricRow label="Avg Attendance Rate" value={opEff.avg_attendance || 0} suffix="%" />
          <MetricRow label="Avg Homework Submission" value={opEff.avg_homework || 0} suffix="%" />
          <div className="pt-2 text-xs text-gray-400">
            Formula: Attendance × 0.60 + Homework × 0.40
          </div>
        </ComponentCard>

        {/* 4. Growth Trajectory — 10% */}
        <ComponentCard icon={ArrowTrendingUpIcon} title="Growth Trajectory" weight="10%" score={growth.score || 50} color="text-amber-600">
          <MetricRow label="Month-over-Month" value="—" note="accumulates over time" />
          <MetricRow label="Retention Rate" value="—" note="tracks enrollment changes" />
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            {growth.note || "Historical data will appear as your school records accumulate."}
          </div>
        </ComponentCard>
      </div>

      {/* ── Teacher Ranking ───────────────────────────────────────────── */}
      {teachers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Teacher CVI Ranking</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sorted by Class Vitality Index — higher = better teacher effectiveness</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Rank</th>
                  <th className="text-left px-4 py-3">Teacher</th>
                  <th className="text-center px-4 py-3">CVI</th>
                  <th className="text-center px-4 py-3">Avg SHS</th>
                  <th className="text-center px-4 py-3">Classes</th>
                  <th className="text-center px-4 py-3">Struggling</th>
                  <th className="text-center px-4 py-3">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teachers.map((t, i) => (
                  <tr key={t.teacher_id} className={t.avg_cvi < 60 ? "bg-red-50/50" : t.avg_cvi >= 85 ? "bg-blue-50/30" : ""}>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.teacher_name}</p>
                      <p className="text-xs text-gray-400">{t.email}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg font-bold tabular-nums ${t.avg_cvi >= 85 ? "text-blue-600" : t.avg_cvi >= 75 ? "text-green-600" : t.avg_cvi >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {t.avg_cvi.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{t.avg_shs.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{t.class_count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-semibold ${t.struggling_students > 0 ? "text-amber-600" : "text-gray-400"}`}>
                        {t.struggling_students}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center"><GradeChip grade={t.teacher_grade} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Top vs Needs Support Classes ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Top performing */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircleIcon className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">Top Performing Classes</p>
          </div>
          {topClasses.length > 0 ? topClasses.map((c, i) => (
            <div key={c.class_id} className="flex items-center justify-between py-2 border-b border-blue-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.class_name} <span className="text-xs text-gray-400">· {c.branch_name}</span></p>
                <p className="text-xs text-gray-500">{c.teacher_name || "No teacher"}</p>
              </div>
              <span className="text-blue-700 font-bold text-sm">CVI {c.avg_cvi.toFixed(1)}</span>
            </div>
          )) : <p className="text-xs text-gray-400">No class data yet.</p>}
        </div>

        {/* Needs support */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Classes Needing Support</p>
          </div>
          {bottomClasses.length > 0 ? bottomClasses.map((c) => (
            <div key={c.class_id} className="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.class_name} <span className="text-xs text-gray-400">· {c.branch_name}</span></p>
                <p className="text-xs text-gray-500">{c.teacher_name || "No teacher"} · {c.struggling_count} struggling</p>
              </div>
              <span className={`font-bold text-sm ${c.avg_cvi < 60 ? "text-red-600" : "text-amber-600"}`}>CVI {c.avg_cvi.toFixed(1)}</span>
            </div>
          )) : <p className="text-xs text-gray-400">All classes performing well.</p>}
        </div>
      </div>

      {/* ── Alert banners ────────────────────────────────────────────── */}
      {underperformingTeachers.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
            <p className="text-sm font-semibold text-red-700">{underperformingTeachers.length} teacher(s) need professional development (CVI &lt; 60)</p>
          </div>
          <ul className="space-y-1">
            {underperformingTeachers.map(t => (
              <li key={t.teacher_id} className="text-xs text-red-700">
                • {t.teacher_name} — CVI: {t.avg_cvi.toFixed(1)} · {t.struggling_students} struggling students
              </li>
            ))}
          </ul>
        </div>
      )}
      {excellentTeachers.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-700">{excellentTeachers.length} Excellent teacher(s) — can be used as peer mentors</p>
          </div>
          <ul className="space-y-1">
            {excellentTeachers.map(t => (
              <li key={t.teacher_id} className="text-xs text-blue-700">
                • {t.teacher_name} — CVI: {t.avg_cvi.toFixed(1)} · {t.excelling_students} excelling students
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
