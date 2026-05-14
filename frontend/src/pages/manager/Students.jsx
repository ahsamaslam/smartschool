import { useEffect, useState, useCallback } from "react";
import managerService from "../../services/managerService";
import BulkImportModal from "../../components/common/BulkImportModal";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  KeyIcon,
  PlusIcon,
  UsersIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

// ── Add Student Modal ──────────────────────────────────────────────────────
function AddStudentModal({ isOpen, onClose, onSuccess, branches, classes }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    branch_id: "",
    class_id: "",
    student_roll_no: "",
    guardian_name: "",
    date_of_birth: "",
    gender: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const filteredClasses = form.branch_id
    ? classes.filter((c) => c.branch_id === form.branch_id)
    : classes;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required.");
    setSaving(true);
    try {
      await managerService.createStudent(form);
      toast.success("Student created successfully!");
      setForm({
        full_name: "",
        email: "",
        branch_id: "",
        class_id: "",
        student_roll_no: "",
        guardian_name: "",
        date_of_birth: "",
        gender: "",
      });
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create student.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Add Student</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                placeholder="Student's full name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="student@school.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <select
                name="branch_id"
                value={form.branch_id}
                onChange={(e) => {
                  handleChange(e);
                  setForm((f) => ({
                    ...f,
                    branch_id: e.target.value,
                    class_id: "",
                  }));
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select Branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class
              </label>
              <select
                name="class_id"
                value={form.class_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select Class —</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.grade_level
                      ? ` (Class ${c.grade_level}${c.section ? ` ${c.section}` : ""})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roll No.
              </label>
              <input
                type="text"
                name="student_roll_no"
                value={form.student_roll_no}
                onChange={handleChange}
                placeholder="Roll number"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guardian Name
              </label>
              <input
                type="text"
                name="guardian_name"
                value={form.guardian_name}
                onChange={handleChange}
                placeholder="Parent / Guardian"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                name="date_of_birth"
                value={form.date_of_birth}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Student Modal ──────────────────────────────────────────────────────
function EditStudentModal({ isOpen, onClose, onSuccess, student }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (student) {
      setForm({
        full_name: student.full_name || "",
        email: student.email || "",
        student_roll_no: student.student_roll_no || "",
        guardian_name: student.guardian_name || "",
        date_of_birth: student.date_of_birth
          ? student.date_of_birth.slice(0, 10)
          : "",
        gender: student.gender || "",
      });
    }
  }, [student]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required.");
    setSaving(true);
    try {
      await managerService.updateStudent(student.id, form);
      toast.success("Student updated successfully!");
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update student.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !student) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Edit Student</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roll No.
              </label>
              <input
                type="text"
                name="student_roll_no"
                value={form.student_roll_no}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guardian Name
              </label>
              <input
                type="text"
                name="guardian_name"
                value={form.guardian_name}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                name="date_of_birth"
                value={form.date_of_birth}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManagerStudents() {
  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes, schoolsRes] = await Promise.all([
        managerService.getStudents(),
        managerService.getClasses(),
        managerService.getSchools(),
      ]);
      const studentList = Array.isArray(sRes.data) ? sRes.data : [];
      const classList = Array.isArray(cRes.data) ? cRes.data : [];
      const schoolList = Array.isArray(schoolsRes.data) ? schoolsRes.data : [];
      setStudents(studentList);
      setClasses(classList);

      // Seed branches from classes first (fast)
      const branchMap = {};
      classList.forEach((c) => {
        if (c.branch_id && !branchMap[c.branch_id])
          branchMap[c.branch_id] = c.branch_name;
      });
      // Then fetch directly so branches show even when no classes exist yet
      const branchResults = await Promise.all(
        schoolList.map((sc) =>
          managerService.getSchoolBranches(sc.id).catch(() => ({ data: [] })),
        ),
      );
      branchResults.forEach((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        list.forEach((b) => {
          if (!branchMap[b.id]) branchMap[b.id] = b.name;
        });
      });
      setBranches(
        Object.entries(branchMap).map(([id, name]) => ({ id, name })),
      );
    } catch {
      toast.error("Failed to load students.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.is_active !== false).length;
  const inactiveStudents = students.filter((s) => s.is_active === false).length;

  const filteredClasses = filterBranchId
    ? classes.filter((c) => c.branch_id === filterBranchId)
    : classes;

  const q = search.toLowerCase();
  const filtered = students.filter((s) => {
    if (
      filterClassId &&
      s.class_name !== classes.find((c) => c.id === filterClassId)?.name
    )
      return false;
    if (
      filterBranchId &&
      s.branch_name !== branches.find((b) => b.id === filterBranchId)?.name
    )
      return false;
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.class_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage all student accounts across your schools.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            <KeyIcon className="h-4 w-4" />
            Upload Students
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-5">
          <p className="text-2xl font-bold text-blue-600">{totalStudents}</p>
          <p className="text-sm text-blue-500 mt-1">Total Students</p>
        </div>
        <div className="bg-green-50 rounded-xl p-5">
          <p className="text-2xl font-bold text-green-600">{activeStudents}</p>
          <p className="text-sm text-green-500 mt-1">Active</p>
        </div>
        <div className="bg-red-50 rounded-xl p-5">
          <p className="text-2xl font-bold text-red-500">{inactiveStudents}</p>
          <p className="text-sm text-red-400 mt-1">Inactive</p>
        </div>
      </div>

      <BulkImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Upload Students"
        templateFileName="student_import_template.xlsx"
        onDownloadTemplate={() =>
          managerService.downloadStudentImportTemplate()
        }
        onUpload={(file) => managerService.importStudents(file)}
        onSuccess={load}
        guidance={[
          "Use the Data sheet in the downloaded template.",
          "For manager accounts, uploads are saved only in your tenant/school scope.",
          "All imported users get default password from env and must reset on first login.",
        ]}
      />

      <AddStudentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={load}
        branches={branches}
        classes={classes}
      />
      <EditStudentModal
        isOpen={Boolean(editStudent)}
        onClose={() => setEditStudent(null)}
        onSuccess={load}
        student={editStudent}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white w-64"
          />
        </div>
        <select
          value={filterBranchId}
          onChange={(e) => {
            setFilterBranchId(e.target.value);
            setFilterClassId("");
          }}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">All Classes</option>
          {filteredClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.grade_level
                ? ` (Class ${c.grade_level}${c.section ? ` ${c.section}` : ""})`
                : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UsersIcon className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No students found.</p>
            <p className="text-xs mt-1">
              {students.length === 0
                ? "Add your first student using the button above."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Branch
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Session
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                        {s.full_name?.[0]?.toUpperCase() || "S"}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {s.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">
                    {s.email}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {s.class_name}
                      {s.grade_level ? ` (${s.grade_level})` : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 hidden md:table-cell">
                    {s.branch_name || "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 hidden lg:table-cell">
                    {s.academic_session || "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditStudent(s)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 bg-white"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Archive ${s.full_name}?`))
                            return;
                          try {
                            await managerService.deleteStudent(s.id);
                            toast.success("Student archived.");
                            load();
                          } catch (err) {
                            toast.error(
                              err?.response?.data?.detail ||
                                "Failed to archive.",
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 bg-white"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
