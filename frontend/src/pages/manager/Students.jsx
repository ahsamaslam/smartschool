import { useEffect, useState, useCallback } from "react";
import managerService from "../../services/managerService";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  UsersIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

export default function ManagerStudents() {
  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        managerService.getStudents(),
        managerService.getClasses(),
      ]);
      const studentList = Array.isArray(sRes.data) ? sRes.data : [];
      const classList = Array.isArray(cRes.data) ? cRes.data : [];
      setStudents(studentList);
      setClasses(classList);
      // Derive unique branches
      const branchMap = {};
      classList.forEach((c) => {
        if (!branchMap[c.branch_id]) {
          branchMap[c.branch_id] = c.branch_name;
        }
      });
      setBranches(Object.entries(branchMap).map(([id, name]) => ({ id, name })));
    } catch {
      toast.error("Failed to load students.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredClasses = filterBranchId
    ? classes.filter((c) => c.branch_id === filterBranchId)
    : classes;

  const q = search.toLowerCase();
  const filtered = students.filter((s) => {
    if (filterClassId && s.class_name !== classes.find((c) => c.id === filterClassId)?.name) return false;
    if (filterBranchId && s.branch_name !== branches.find((b) => b.id === filterBranchId)?.name) return false;
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.class_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {students.length} student{students.length !== 1 ? "s" : ""} enrolled in your school
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text" placeholder="Search students…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-64"
          />
        </div>
        <select
          value={filterBranchId}
          onChange={(e) => { setFilterBranchId(e.target.value); setFilterClassId(""); }}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Classes</option>
          {filteredClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.grade_level ? `(Class ${c.grade_level}${c.section ? ` ${c.section}` : ""})` : ""}
            </option>
          ))}
        </select>
        {(filterBranchId || filterClassId || search) && (
          <button
            onClick={() => { setFilterBranchId(""); setFilterClassId(""); setSearch(""); }}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-1"
          >
            <FunnelIcon className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{students.length === 0 ? "No students enrolled yet." : "No students match your filters."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {filtered.length} student{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Branch</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-indigo-700">{s.full_name?.[0]?.toUpperCase()}</span>
                      </div>
                      <p className="font-medium text-gray-800">{s.full_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{s.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {s.class_name} {s.grade_level ? `(${s.grade_level})` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{s.branch_name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
