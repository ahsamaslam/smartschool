import { useEffect, useState, useMemo } from "react";
import managerService from "../../services/managerService";
import { PageSpinner } from "../../components/common/Spinner";
import {
  AcademicCapIcon,
  UserGroupIcon,
  TableCellsIcon,
  PresentationChartLineIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";

const RISK_COLORS = {
  excelling: "bg-emerald-100 text-emerald-800",
  stable: "bg-blue-100 text-blue-800",
  at_risk: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const GRADE_COLORS = {
  Excellent: "bg-emerald-100 text-emerald-800",
  Good: "bg-blue-100 text-blue-800",
  Satisfactory: "bg-amber-100 text-amber-800",
  "Needs Improvement": "bg-red-100 text-red-800",
  "No data": "bg-gray-100 text-gray-500",
};

function ScoreBar({ value, color = "bg-indigo-500" }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-9 text-right text-gray-700">{Math.round(pct)}%</span>
    </div>
  );
}

function SpiHeader({ spi, loading }) {
  if (loading) return <div className="h-28 rounded-2xl bg-gray-100 animate-pulse mb-6" />;
  if (!spi) return null;
  const score = Math.round(spi.spi_score || 0);
  const color =
    score >= 80 ? "from-emerald-500 to-emerald-600" :
    score >= 60 ? "from-blue-500 to-indigo-600" :
    score >= 40 ? "from-amber-500 to-orange-500" :
    "from-red-500 to-red-600";

  const hasInactive = spi.inactive_students > 0;

  return (
    <div className={`rounded-2xl bg-gradient-to-r ${color} text-white p-5 mb-6`}>
      <div className="flex flex-wrap gap-6 items-center">
        <div>
          <p className="text-xs font-semibold uppercase opacity-80 mb-0.5">School Performance Index</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black">{score}</span>
            <span className="text-lg opacity-70 mb-0.5">/100</span>
          </div>
          <p className="text-sm opacity-90 mt-1">{spi.rating}</p>
        </div>
        <div className="flex gap-6 flex-wrap">
          <StatChip label="Avg SHS" value={`${parseFloat(spi.avg_shs || 0).toFixed(1)}`} />
          <StatChip label="Avg CVI" value={`${Math.round(spi.avg_cvi || 0)}`} />
          <StatChip label="Active Students" value={`${spi.total_active_students ?? "—"}`} />
          <StatChip label="At Risk" value={`${Math.round(spi.at_risk_percentage || 0)}%`} />
          <StatChip label="Top Performers" value={`${Math.round(spi.top_performers_percentage || 0)}%`} />
        </div>
      </div>
      {hasInactive && (
        <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2 text-xs">
          <span className="font-semibold">ℹ</span>
          <span>
            {spi.inactive_students} of {spi.total_enrolled} enrolled students have no recorded activity and are excluded from averages.
            Averages reflect the {spi.total_active_students} active students only.
          </span>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  );
}

function SortHeader({ label, sortKey, current, onSort }) {
  const active = current.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
    >
      {label}
      {active ? (
        current.dir === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
      ) : (
        <span className="h-3 w-3 opacity-30">⇅</span>
      )}
    </button>
  );
}

function useSort(data, defaultKey, defaultDir = "desc") {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });
  const toggle = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  const sorted = useMemo(() => {
    if (!data?.length) return data || [];
    return [...data].sort((a, b) => {
      const va = a[sort.key] ?? "";
      const vb = b[sort.key] ?? "";
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sort.key, sort.dir]);
  return { sorted, sort, toggle };
}

// ─── Students Tab ───────────────────────────────────────────────────────────
function StudentsTab({ students, loading }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(q) ||
        s.class_name?.toLowerCase().includes(q) ||
        s.teacher_name?.toLowerCase().includes(q),
    );
  }, [students, search]);
  const { sorted, sort, toggle } = useSort(filtered, "shs_score");

  if (loading) return <div className="h-48 animate-pulse bg-gray-50 rounded-xl" />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, class, teacher…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <span className="text-xs text-gray-500">{filtered.length} students</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Student" sortKey="full_name" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Class" sortKey="class_name" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Teacher" sortKey="teacher_name" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="SHS Score" sortKey="shs_score" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">Video</th>
              <th className="px-4 py-3 text-left">Attendance</th>
              <th className="px-4 py-3 text-left">Homework</th>
              <th className="px-4 py-3 text-left">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  No students found
                </td>
              </tr>
            )}
            {sorted.map((s) => (
              <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{s.class_name}</td>
                <td className="px-4 py-3 text-gray-600">{s.teacher_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 w-10 tabular-nums">{parseFloat(s.shs_score || 0).toFixed(1)}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 w-16 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.shs_score >= 80 ? "bg-emerald-500" : s.shs_score >= 60 ? "bg-blue-500" : s.shs_score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(100, s.shs_score)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 w-32"><ScoreBar value={s.video_rate} color="bg-emerald-500" /></td>
                <td className="px-4 py-3 w-32"><ScoreBar value={s.attendance_rate} color="bg-blue-500" /></td>
                <td className="px-4 py-3 w-32"><ScoreBar value={s.homework_rate} color="bg-indigo-500" /></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${RISK_COLORS[s.risk_level] || "bg-gray-100 text-gray-500"}`}>
                    {(s.risk_level || "unknown").replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Classes Tab ─────────────────────────────────────────────────────────────
function ClassesTab({ classes, loading }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.toLowerCase();
    return classes.filter(
      (c) =>
        c.class_name?.toLowerCase().includes(q) ||
        c.teacher_name?.toLowerCase().includes(q) ||
        c.branch_name?.toLowerCase().includes(q),
    );
  }, [classes, search]);
  const { sorted, sort, toggle } = useSort(filtered, "avg_cvi");

  if (loading) return <div className="h-48 animate-pulse bg-gray-50 rounded-xl" />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search class, teacher, branch…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <span className="text-xs text-gray-500">{filtered.length} classes</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Class" sortKey="class_name" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">Branch</th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Teacher" sortKey="teacher_name" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="CVI" sortKey="avg_cvi" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Avg SHS" sortKey="avg_shs" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-center">Students</th>
              <th className="px-4 py-3 text-center">Struggling</th>
              <th className="px-4 py-3 text-center">Excelling</th>
              <th className="px-4 py-3 text-left">Grade</th>
              <th className="px-4 py-3 text-left">CVI Alert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                  No classes found
                </td>
              </tr>
            )}
            {sorted.map((c) => (
              <tr key={c.class_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{c.class_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.branch_name}</td>
                <td className="px-4 py-3 text-gray-700">{c.teacher_name || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 w-8">{Math.round(c.avg_cvi)}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 w-16 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${c.avg_cvi >= 80 ? "bg-emerald-500" : c.avg_cvi >= 60 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(100, c.avg_cvi)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 font-mono tabular-nums">{parseFloat(c.avg_shs || 0).toFixed(1)}</td>
                <td className="px-4 py-3 text-center text-gray-700">{c.total_students ?? 0}</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-red-600 font-semibold">{c.struggling_count ?? 0}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-emerald-600 font-semibold">{c.excelling_count ?? 0}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${GRADE_COLORS[c.teacher_grade] || "bg-gray-100 text-gray-500"}`}>
                    {c.teacher_grade || "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.cvi_alert ? (
                    <span className="inline-block bg-amber-50 border border-amber-200 text-amber-700 text-[10px] px-2 py-0.5 rounded-lg max-w-xs truncate" title={c.cvi_alert}>
                      ⚠ {c.cvi_alert}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Teachers Tab ────────────────────────────────────────────────────────────
function TeachersTab({ teachers, loading }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return teachers;
    const q = search.toLowerCase();
    return teachers.filter((t) => t.teacher_name?.toLowerCase().includes(q));
  }, [teachers, search]);
  const { sorted, sort, toggle } = useSort(filtered, "avg_cvi");

  if (loading) return <div className="h-48 animate-pulse bg-gray-50 rounded-xl" />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teacher…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <span className="text-xs text-gray-500">{filtered.length} teachers</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Teacher" sortKey="teacher_name" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-center">Classes</th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="CVI" sortKey="avg_cvi" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Avg SHS" sortKey="avg_shs" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader label="Struggling" sortKey="struggling_students" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader label="Excelling" sortKey="excelling_students" current={sort} onSort={toggle} />
              </th>
              <th className="px-4 py-3 text-left">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  No teachers found
                </td>
              </tr>
            )}
            {sorted.map((t) => (
              <tr key={t.teacher_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{t.teacher_name}</td>
                <td className="px-4 py-3 text-center text-gray-700">{t.class_count}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 w-8">{Math.round(t.avg_cvi)}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 w-20 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${t.avg_cvi >= 80 ? "bg-emerald-500" : t.avg_cvi >= 60 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(100, t.avg_cvi)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-gray-700 tabular-nums">{parseFloat(t.avg_shs || 0).toFixed(1)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-red-600 font-semibold">{t.struggling_students}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-emerald-600 font-semibold">{t.excelling_students}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${GRADE_COLORS[t.teacher_grade] || "bg-gray-100 text-gray-500"}`}>
                    {t.teacher_grade || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
const TABS = [
  { key: "students", label: "Students", icon: UserGroupIcon },
  { key: "classes", label: "Classes", icon: TableCellsIcon },
  { key: "teachers", label: "Teachers", icon: AcademicCapIcon },
];

export default function ManagerReports() {
  const [activeTab, setActiveTab] = useState("students");
  const [spi, setSpi] = useState(null);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loadingSpi, setLoadingSpi] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    managerService.getAnalyticsOverview()
      .then((res) => setSpi(res.data?.spi || null))
      .catch((e) => setErrors((prev) => ({ ...prev, spi: e?.response?.data?.detail || e.message })))
      .finally(() => setLoadingSpi(false));

    managerService.getStudentsAnalytics()
      .then((res) => setStudents(res.data?.students || []))
      .catch((e) => setErrors((prev) => ({ ...prev, students: e?.response?.data?.detail || e.message })))
      .finally(() => setLoadingStudents(false));

    managerService.getClassAnalytics()
      .then((res) => setClasses(res.data?.classes || []))
      .catch((e) => setErrors((prev) => ({ ...prev, classes: e?.response?.data?.detail || e.message })))
      .finally(() => setLoadingClasses(false));

    managerService.getTeacherAnalytics()
      .then((res) => setTeachers(res.data?.teachers || []))
      .catch((e) => setErrors((prev) => ({ ...prev, teachers: e?.response?.data?.detail || e.message })))
      .finally(() => setLoadingTeachers(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">School Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Live performance data — students, classes, and teachers</p>
      </div>

      <SpiHeader spi={spi} loading={loadingSpi} />

      {Object.entries(errors).length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
          {Object.entries(errors).map(([key, msg]) => (
            <div key={key}><span className="font-semibold capitalize">{key}:</span> {msg}</div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "students" && (
        <StudentsTab students={students} loading={loadingStudents} />
      )}
      {activeTab === "classes" && (
        <ClassesTab classes={classes} loading={loadingClasses} />
      )}
      {activeTab === "teachers" && (
        <TeachersTab teachers={teachers} loading={loadingTeachers} />
      )}
    </div>
  );
}
