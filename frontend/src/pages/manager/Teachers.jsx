import { useEffect, useState, useCallback } from "react";
import managerService from "../../services/managerService";
import toast from "react-hot-toast";
import {
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  UserCircleIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Assign Class Modal ────────────────────────────────────────────────────────
function AssignClassModal({ isOpen, onClose, teacher, classes }) {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isOpen) setSelectedClassId(""); }, [isOpen]);

  const handleAssign = async () => {
    if (!selectedClassId) return toast.error("Select a class first.");
    setSaving(true);
    try {
      await managerService.assignTeacherClass(teacher.id, selectedClassId);
      toast.success("Teacher assigned to class!");
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to assign class.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Class — ${teacher?.full_name}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Select a class to assign this teacher to:</p>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">— Choose a class —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.branch_name} / {c.name} {c.grade_level ? `(Class ${c.grade_level}${c.section ? ` ${c.section}` : ""})` : ""}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
            Cancel
          </button>
          <button type="button" onClick={handleAssign} disabled={saving || !selectedClassId}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Assign"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Credentials Card ──────────────────────────────────────────────────────────
function CredentialsModal({ isOpen, onClose, teacher }) {
  const [copied, setCopied] = useState(null);
  if (!isOpen || !teacher) return null;

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const CopyBtn = ({ text, id }) => (
    <button type="button" onClick={() => copy(text, id)} className="ml-2 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
      {copied === id ? <CheckIcon className="h-3.5 w-3.5 text-green-500" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Teacher Account Created">
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          Teacher account created. Save credentials — password won't be shown again.
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">Name</p>
            <p className="text-sm font-medium text-gray-800">{teacher.full_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Email (Login)</p>
            <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm font-mono flex-1">{teacher.email}</span>
              <CopyBtn text={teacher.email} id="email" />
            </div>
          </div>
          {teacher.plain_password && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Password</p>
              <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm font-mono flex-1">{teacher.plain_password}</span>
                <CopyBtn text={teacher.plain_password} id="password" />
              </div>
            </div>
          )}
        </div>
        <button type="button" onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          Done
        </button>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManagerTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", designation: "", contact: "" });
  const [saving, setSaving] = useState(false);

  const [assignFor, setAssignFor] = useState(null);
  const [createdTeacher, setCreatedTeacher] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        managerService.getTeachers(),
        managerService.getClasses(),
      ]);
      setTeachers(Array.isArray(tRes.data) ? tRes.data : []);
      setClasses(Array.isArray(cRes.data) ? cRes.data : []);
    } catch {
      toast.error("Failed to load teachers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ full_name: "", email: "", password: "", designation: "", contact: "" });
    setShowAddModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required.");
    if (!form.email.trim()) return toast.error("Email is required.");
    if (!form.password.trim()) return toast.error("Password is required.");
    setSaving(true);
    try {
      const res = await managerService.createTeacher(form);
      const teacher = res?.data?.data ?? res?.data ?? {};
      setShowAddModal(false);
      setCreatedTeacher(teacher);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create teacher.");
    } finally {
      setSaving(false);
    }
  };

  const q = search.toLowerCase();
  const filtered = teachers.filter(
    (t) =>
      t.full_name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.branch_name?.toLowerCase().includes(q)
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage teachers in your school</p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          <PlusIcon className="h-4 w-4" /> Add Teacher
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text" placeholder="Search teachers…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserCircleIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{teachers.length === 0 ? "No teachers yet." : "No teachers match your search."}</p>
          {teachers.length === 0 && (
            <button onClick={openAdd} className="mt-3 text-sm text-blue-600 hover:underline">Add the first teacher →</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Branch</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Classes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-700">{t.full_name?.[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{t.full_name}</p>
                        {t.designation && <p className="text-xs text-gray-400">{t.designation}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{t.email}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.branch_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      <AcademicCapIcon className="h-3.5 w-3.5" />
                      {t.class_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setAssignFor(t)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
                    >
                      Assign Class
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Teacher Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Teacher">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Teacher's full name" required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="teacher@school.com" required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
            <input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Set a password" required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              placeholder="e.g. Senior Teacher"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              placeholder="Phone number"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Creating…" : "Create Teacher"}
          </button>
        </form>
      </Modal>

      <AssignClassModal
        isOpen={!!assignFor}
        onClose={() => { setAssignFor(null); load(); }}
        teacher={assignFor}
        classes={classes}
      />

      <CredentialsModal
        isOpen={!!createdTeacher}
        onClose={() => setCreatedTeacher(null)}
        teacher={createdTeacher}
      />
    </div>
  );
}
