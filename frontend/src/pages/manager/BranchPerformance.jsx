import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import managerService from "../../services/managerService";

const RATING_CONFIG = {
  Outstanding:         { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", score: "text-purple-600" },
  Excellent:           { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   score: "text-blue-600"   },
  Good:                { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  score: "text-green-600"  },
  Satisfactory:        { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  score: "text-amber-600"  },
  "Needs Improvement": { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    score: "text-red-600"    },
  "No data":           { bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-500",   score: "text-gray-600"   },
};

const GRADE_COLOR = {
  Excellent:           "bg-blue-100 text-blue-700",
  Good:                "bg-green-100 text-green-700",
  Satisfactory:        "bg-amber-100 text-amber-700",
  "Needs Improvement": "bg-red-100 text-red-700",
};

function bpiRating(score) {
  if (score >= 90) return "Outstanding";
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 60) return "Satisfactory";
  return "Needs Improvement";
}

function rc(rating) { return RATING_CONFIG[rating] || RATING_CONFIG["No data"]; }

function ScoreBar({ value, color = "bg-indigo-500" }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function GradeChip({ grade }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_COLOR[grade] || "bg-gray-100 text-gray-600"}`}>
      {grade || "No data"}
    </span>
  );
}

function cviScoreColor(cvi) {
  if (cvi === 0) return "text-gray-400";
  if (cvi >= 85) return "text-blue-600";
  if (cvi >= 75) return "text-green-600";
  if (cvi >= 60) return "text-amber-600";
  return "text-red-600";
}

export default function ManagerBranchPerformance() {
  const { branchId } = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();

  const [classes,    setClasses]    = useState([]);
  const [branchName, setBranchName] = useState(location.state?.branchName || "");
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setLoading(true);
    managerService
      .getBranchLiveAnalytics(branchId)
      .then((res) => {
        const data = res.data;
        if (data.branch_name) setBranchName(data.branch_name);
        const sorted = [...(data.classes || [])].sort(
          (a, b) => parseFloat(b.avg_cvi) - parseFloat(a.avg_cvi)
        );
        setClasses(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [branchId]);

  // ── derived metrics ────────────────────────────────────────────────────────
  const classesWithCvi  = classes.filter((c) => parseFloat(c.avg_cvi) > 0);
  const bpi = classesWithCvi.length > 0
    ? classesWithCvi.reduce((s, c) => s + parseFloat(c.avg_cvi), 0) / classesWithCvi.length
    : 0;
  const rating = bpi > 0 ? bpiRating(bpi) : "No data";
  const cfg    = rc(rating);

  const totalStudents   = classes.reduce((s, c) => s + (parseInt(c.total_students)  || 0), 0);
  const totalStruggling = classes.reduce((s, c) => s + (parseInt(c.struggling_count)|| 0), 0);
  const totalExcelling  = classes.reduce((s, c) => s + (parseInt(c.excelling_count) || 0), 0);
  const avgShs = classesWithCvi.length > 0
    ? classesWithCvi.reduce((s, c) => s + parseFloat(c.avg_shs), 0) / classesWithCvi.length
    : 0;
  const atRiskPct = totalStudents > 0 ? (totalStruggling / totalStudents) * 100 : 0;
  const topPct    = totalStudents > 0 ? (totalExcelling  / totalStudents) * 100 : 0;

  // Teacher ranking derived from classes
  const teacherMap = {};
  for (const cls of classes) {
    if (!cls.teacher_name) continue;
    const key = cls.teacher_name;
    if (!teacherMap[key]) {
      teacherMap[key] = { teacher_name: key, cvi_sum: 0, cvi_count: 0, class_count: 0, struggling: 0, excelling: 0, grades: [] };
    }
    const t = teacherMap[key];
    t.class_count += 1;
    t.struggling  += parseInt(cls.struggling_count) || 0;
    t.excelling   += parseInt(cls.excelling_count)  || 0;
    if (parseFloat(cls.avg_cvi) > 0) { t.cvi_sum += parseFloat(cls.avg_cvi); t.cvi_count += 1; }
    if (cls.teacher_grade) t.grades.push(cls.teacher_grade);
  }
  const teachers = Object.values(teacherMap)
    .map((t) => ({ ...t, avg_cvi: t.cvi_count > 0 ? t.cvi_sum / t.cvi_count : 0, teacher_grade: t.grades[0] || null }))
    .sort((a, b) => b.avg_cvi - a.avg_cvi);

  const topClasses    = [...classes].filter((c) => parseFloat(c.avg_cvi) > 0).slice(0, 3);
  const bottomClasses = [...classes]
    .filter((c) => parseFloat(c.avg_cvi) > 0 && parseInt(c.total_students) > 0)
    .sort((a, b) => parseFloat(a.avg_cvi) - parseFloat(b.avg_cvi))
    .slice(0, 3);

  const excellentTeachers      = teachers.filter((t) => t.avg_cvi >= 85);
  const underperformingTeachers = teachers.filter((t) => t.avg_cvi > 0 && t.avg_cvi < 60);

  if (loading) return <div className="p-6 text-center py-20 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-1">
        <button
          type="button"
          onClick={() => navigate("/manager/performance")}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{branchName || "Branch Performance"}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6 pl-10">Branch Performance Index · Live data from all classes in this branch</p>

      {/* BPI Header */}
      <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6 mb-6`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${cfg.text}`}>Branch Performance Index</p>
            <p className="text-xs text-gray-500 max-w-xl">
              BPI = Average Class Vitality Index across all classes in this branch
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
            <p className={`text-6xl font-black tabular-nums ${bpi > 0 ? cfg.score : "text-gray-500"}`}>
              {bpi.toFixed(1)}
            </p>
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mt-1 border ${cfg.border} ${cfg.text}`}>
              {rating}
            </span>
          </div>
        </div>

        {bpi > 0 && (
          <div className="bg-white/70 rounded-xl border border-white/80 p-4 mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Branch Performance Index</span><span>{bpi.toFixed(1)} / 100</span>
            </div>
            <ScoreBar value={bpi} color={bpi >= 80 ? "bg-blue-500" : bpi >= 60 ? "bg-green-500" : "bg-amber-500"} />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Classes",        value: classes.length,          color: "text-gray-800" },
            { label: "Total Students", value: totalStudents,           color: "text-gray-800" },
            { label: "At Risk",        value: `${atRiskPct.toFixed(1)}%`, color: "text-red-600" },
            { label: "Excelling",      value: `${topPct.toFixed(1)}%`,    color: "text-blue-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white/70 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-indigo-50"><AcademicCapIcon className="h-4 w-4 text-indigo-600" /></div>
            <p className="text-sm font-semibold text-gray-800">Academic Overview</p>
          </div>
          <div className="space-y-2">
            {[
              { label: "Avg SHS",             value: avgShs.toFixed(1),     suffix: "/100" },
              { label: "Avg CVI",             value: bpi.toFixed(1),        suffix: "/100" },
              { label: "Struggling Students", value: totalStruggling },
              { label: "Excelling Students",  value: totalExcelling  },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{row.label}</span>
                <span className="font-semibold text-gray-800">{row.value}{row.suffix || ""}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-emerald-50"><UserGroupIcon className="h-4 w-4 text-emerald-600" /></div>
            <p className="text-sm font-semibold text-gray-800">Teacher Overview</p>
          </div>
          <div className="space-y-2">
            {[
              { label: "Teachers with Classes",   value: teachers.length },
              { label: "Excellent (CVI ≥ 85)",    value: excellentTeachers.length },
              { label: "Needs Support (CVI < 60)", value: underperformingTeachers.length },
              { label: "Classes Covered",          value: classes.filter((c) => c.teacher_name).length },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{row.label}</span>
                <span className="font-semibold text-gray-800">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teacher Ranking */}
      {teachers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Teacher CVI Ranking</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sorted by Class Vitality Index</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Rank</th>
                  <th className="text-left px-4 py-3">Teacher</th>
                  <th className="text-center px-4 py-3">Avg CVI</th>
                  <th className="text-center px-4 py-3">Classes</th>
                  <th className="text-center px-4 py-3">Struggling</th>
                  <th className="text-center px-4 py-3">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teachers.map((t, i) => (
                  <tr key={t.teacher_name} className={t.avg_cvi > 0 && t.avg_cvi < 60 ? "bg-red-50/50" : t.avg_cvi >= 85 ? "bg-blue-50/30" : ""}>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{t.teacher_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg font-bold tabular-nums ${cviScoreColor(t.avg_cvi)}`}>
                        {t.avg_cvi.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{t.class_count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-semibold ${t.struggling > 0 ? "text-amber-600" : "text-gray-400"}`}>
                        {t.struggling}
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

      {/* Top vs Needs Support */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircleIcon className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">Top Performing Classes</p>
          </div>
          {topClasses.length > 0 ? topClasses.map((c) => (
            <div key={c.class_id} className="flex items-center justify-between py-2 border-b border-blue-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.class_name}</p>
                <p className="text-xs text-gray-500">{c.teacher_name || "No teacher"}</p>
              </div>
              <span className="text-blue-700 font-bold text-sm">CVI {parseFloat(c.avg_cvi).toFixed(1)}</span>
            </div>
          )) : <p className="text-xs text-gray-400">No CVI data yet.</p>}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Classes Needing Support</p>
          </div>
          {bottomClasses.length > 0 ? bottomClasses.map((c) => (
            <div key={c.class_id} className="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.class_name}</p>
                <p className="text-xs text-gray-500">{c.teacher_name || "No teacher"} · {c.struggling_count || 0} struggling</p>
              </div>
              <span className={`font-bold text-sm ${parseFloat(c.avg_cvi) < 60 ? "text-red-600" : "text-amber-600"}`}>
                CVI {parseFloat(c.avg_cvi).toFixed(1)}
              </span>
            </div>
          )) : <p className="text-xs text-gray-400">All classes performing well.</p>}
        </div>
      </div>

      {/* Alert banners */}
      {underperformingTeachers.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
            <p className="text-sm font-semibold text-red-700">
              {underperformingTeachers.length} teacher(s) need professional development (CVI &lt; 60)
            </p>
          </div>
          <ul className="space-y-1">
            {underperformingTeachers.map((t) => (
              <li key={t.teacher_name} className="text-xs text-red-700">
                • {t.teacher_name} — CVI: {t.avg_cvi.toFixed(1)} · {t.struggling} struggling students
              </li>
            ))}
          </ul>
        </div>
      )}
      {excellentTeachers.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-700">
              {excellentTeachers.length} Excellent teacher(s) — can be used as peer mentors
            </p>
          </div>
          <ul className="space-y-1">
            {excellentTeachers.map((t) => (
              <li key={t.teacher_name} className="text-xs text-blue-700">
                • {t.teacher_name} — CVI: {t.avg_cvi.toFixed(1)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full Class Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Class Performance</h2>
          <p className="text-xs text-gray-400 mt-0.5">{classes.length} class{classes.length !== 1 ? "es" : ""} in this branch</p>
        </div>
        {classes.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No classes found for this branch.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Class</th>
                  <th className="text-left px-4 py-3">Grade</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Teacher</th>
                  <th className="text-center px-4 py-3">Students</th>
                  <th className="text-center px-4 py-3">CVI</th>
                  <th className="text-center px-4 py-3">Avg SHS</th>
                  <th className="text-center px-4 py-3 hidden md:table-cell">Struggling</th>
                  <th className="text-center px-4 py-3 hidden md:table-cell">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {classes.map((cls) => {
                  const cvi = parseFloat(cls.avg_cvi || 0);
                  const shs = parseFloat(cls.avg_shs || 0);
                  return (
                    <tr
                      key={cls.class_id}
                      className={cvi > 0 && cvi < 60 ? "bg-red-50/30" : cvi >= 85 ? "bg-blue-50/20" : "hover:bg-gray-50"}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{cls.class_name}</td>
                      <td className="px-4 py-3 text-gray-500">{cls.grade_level ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{cls.teacher_name || "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{cls.total_students || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-base font-bold tabular-nums ${cviScoreColor(cvi)}`}>
                          {cvi.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{shs.toFixed(1)}</td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className={`font-semibold ${parseInt(cls.struggling_count) > 0 ? "text-amber-600" : "text-gray-400"}`}>
                          {cls.struggling_count || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {cls.teacher_grade && cls.teacher_grade !== "No data"
                          ? <GradeChip grade={cls.teacher_grade} />
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
