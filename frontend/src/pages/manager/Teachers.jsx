import { useEffect, useState, useCallback, useRef } from "react";
import managerService from "../../services/managerService";
import BulkImportModal from "../../components/common/BulkImportModal";
import toast from "react-hot-toast";
import {
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  DocumentArrowDownIcon,
  PencilSquareIcon,
  TrashIcon,
  EnvelopeIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// â"€â"€ Manual Add Form Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function AddTeacherModal({ isOpen, onClose, onSuccess, classes }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    branch_id: "",
    designation: "",
    contact: "",
    emergency_contact: "",
    employment_status: "active",
    date_of_joining: "",
    qualifications: "",
    experience_years: "",
    languages: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required.");
    if (!form.email.trim()) return toast.error("Email is required.");
    if (!form.password.trim()) return toast.error("Password is required.");

    setSaving(true);
    try {
      await managerService.createTeacher(form);
      toast.success("Teacher created successfully!");
      setForm({
        full_name: "",
        email: "",
        password: "",
        branch_id: "",
        designation: "",
        contact: "",
        emergency_contact: "",
        employment_status: "active",
        date_of_joining: "",
        qualifications: "",
        experience_years: "",
        languages: "",
      });
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create teacher.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Teacher Manually">
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
              placeholder="Teacher's full name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="teacher@school.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="Set a password"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              name="branch_id"
              value={form.branch_id}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">- Select Branch -</option>
              {(() => {
                const branches = {};
                classes?.forEach((c) => {
                  if (!branches[c.branch_id])
                    branches[c.branch_id] = c.branch_name;
                });
                return Object.entries(branches).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ));
              })()}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Designation
            </label>
            <input
              type="text"
              name="designation"
              value={form.designation}
              onChange={handleChange}
              placeholder="e.g., Senior Teacher"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact
            </label>
            <input
              type="tel"
              name="contact"
              value={form.contact}
              onChange={handleChange}
              placeholder="Phone number"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact
            </label>
            <input
              type="tel"
              name="emergency_contact"
              value={form.emergency_contact}
              onChange={handleChange}
              placeholder="Emergency contact"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employment Status
            </label>
            <select
              name="employment_status"
              value={form.employment_status}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Joining
            </label>
            <input
              type="date"
              name="date_of_joining"
              value={form.date_of_joining}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Qualifications
            </label>
            <input
              type="text"
              name="qualifications"
              value={form.qualifications}
              onChange={handleChange}
              placeholder="e.g., B.Ed, M.A"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Experience (Years)
            </label>
            <input
              type="number"
              name="experience_years"
              value={form.experience_years}
              onChange={handleChange}
              placeholder="Years of experience"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Languages
          </label>
          <input
            type="text"
            name="languages"
            value={form.languages}
            onChange={handleChange}
            placeholder="e.g., English, Urdu, Pashto"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4">
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
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Creating..." : "Create Teacher"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// â"€â"€ Edit Teacher Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function EditTeacherModal({ isOpen, onClose, onSuccess, teacher, branches = [], classes = [] }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", branch_id: "", designation: "",
    contact: "", emergency_contact: "", employment_status: "active",
    date_of_joining: "", qualifications: "", experience_years: "", languages: "",
  });
  const [assignmentRows, setAssignmentRows] = useState([{ branch_id: "", class_id: "", board_id: "", subject_id: "", book_id: "" }]);
  const [examScopeByClass, setExamScopeByClass] = useState({});
  const scopeCache = useRef({});

  const emptyRow = () => ({ branch_id: "", class_id: "", board_id: "", subject_id: "", book_id: "" });

  useEffect(() => {
    if (!isOpen || !teacher) return;
    setForm({
      full_name: teacher.full_name || "", email: teacher.email || "", password: "",
      branch_id: teacher.branch_id || "", designation: teacher.designation || "",
      contact: teacher.contact || "", emergency_contact: teacher.emergency_contact || "",
      employment_status: teacher.employment_status || "active",
      date_of_joining: teacher.date_of_joining || "", qualifications: teacher.qualifications || "",
      experience_years: teacher.experience_years || "", languages: teacher.languages || "",
    });
    setExamScopeByClass({});
    scopeCache.current = {};
    managerService.getTeacherAssignments(teacher.id).then((res) => {
      const cur = res.data?.curriculum_assignments || [];
      const cls = res.data?.class_assignments || [];
      if (cur.length) {
        setAssignmentRows(cur.map((r) => ({
          branch_id: r.branch_id ? String(r.branch_id) : "",
          class_id: r.class_id ? String(r.class_id) : "",
          board_id: r.library_board_id ? String(r.library_board_id) : "",
          subject_id: r.library_subject_id ? String(r.library_subject_id) : "",
          book_id: r.library_book_id ? String(r.library_book_id) : "",
        })));
      } else if (cls.length) {
        setAssignmentRows(cls.map((r) => ({
          branch_id: r.branch_id ? String(r.branch_id) : "",
          class_id: String(r.class_id), board_id: "", subject_id: "", book_id: "",
        })));
      } else {
        setAssignmentRows([emptyRow()]);
      }
    }).catch(() => setAssignmentRows([emptyRow()]));
  }, [isOpen, teacher]);

  const allBranches = [...new Map(
    (branches.length ? branches : classes.filter((c) => c.branch_id).map((c) => ({ id: c.branch_id, name: c.branch_name })))
      .map((b) => [b.id, b])
  ).values()];
  const classesForBranch = (branchId) => branchId ? classes.filter((c) => String(c.branch_id) === String(branchId)) : [];

  const fetchScope = async (classId) => {
    if (!classId) return;
    if (scopeCache.current[classId]) {
      setExamScopeByClass((p) => ({ ...p, [classId]: scopeCache.current[classId] }));
      return;
    }
    try {
      const { default: api } = await import("../../services/api");
      const { data } = await api.get(`/exams/class/${classId}/exam-scope`);
      scopeCache.current[classId] = data;
      setExamScopeByClass((p) => ({ ...p, [classId]: data }));
    } catch { /* no curriculum yet */ }
  };

  const updateRow = (i, patch) => setAssignmentRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const setRowBranch = (i, v) => updateRow(i, { branch_id: v, class_id: "", board_id: "", subject_id: "", book_id: "" });
  const setRowClass = (i, v) => { updateRow(i, { class_id: v, board_id: "", subject_id: "", book_id: "" }); if (v) fetchScope(v); };

  useEffect(() => {
    if (!isOpen) return;
    assignmentRows.forEach((r) => { if (r.class_id) fetchScope(r.class_id); });
  }, [isOpen]);

  const handleChange = (e) => { const { name, value } = e.target; setForm((f) => ({ ...f, [name]: value })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required.");
    if (!form.email.trim()) return toast.error("Email is required.");

    const incomplete = assignmentRows.some((r) => {
      if (!r.branch_id && !r.class_id) return false;
      if (!r.class_id) return true;
      return (r.board_id || r.subject_id || r.book_id) && !(r.subject_id && r.book_id);
    });
    if (incomplete) { toast.error("Each assignment needs a class. If selecting curriculum, subject and book are required."); return; }

    setSaving(true);
    try {
      const updateData = { ...form };
      if (!updateData.password) delete updateData.password;
      await managerService.updateTeacher(teacher.id, updateData);

      const curriculumRows = assignmentRows.filter((r) => r.class_id && r.subject_id && r.book_id).map((r) => ({
        class_id: r.class_id, branch_id: r.branch_id || null,
        library_board_id: r.board_id || null, library_subject_id: r.subject_id, library_book_id: r.book_id,
      }));
      const assignedClasses = [...new Set(assignmentRows.filter((r) => r.class_id).map((r) => r.class_id))];
      if (assignedClasses.length || curriculumRows.length) {
        await managerService.saveTeacherAssignments(teacher.id, {
          teacher_curriculum_assignments: curriculumRows,
          assigned_classes: assignedClasses,
        });
      }

      toast.success("Teacher updated successfully!");
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update teacher.");
    } finally {
      setSaving(false);
    }
  };

  const formatClass = (c) => {
    const parts = [];
    if (c.name) parts.push(c.name);
    if (c.grade_level != null && c.grade_level !== "") parts.push(`Grade ${c.grade_level}`);
    if (c.section) parts.push(`Sec ${c.section}`);
    return parts.join(" · ") || "Class";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Teacher">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" name="full_name" value={form.full_name} onChange={handleChange} required
              placeholder="Teacher's full name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required
              placeholder="teacher@school.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select name="branch_id" value={form.branch_id} onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">- Select Branch -</option>
              {allBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password (leave empty to keep current)</label>
            <input type="password" name="password" value={form.password} onChange={handleChange}
              placeholder="Set a new password (optional)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <select name="designation" value={form.designation} onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">- Select -</option>
              <option value="pre_school_teacher">Pre-School Teacher</option>
              <option value="junior_school_teacher">Junior School Teacher</option>
              <option value="middle_school_teacher">Middle School Teacher</option>
              <option value="senior_school_teacher">Senior School Teacher</option>
              <option value="o_level_faculty">O-Level Faculty</option>
              <option value="a_level_faculty">A-Level Faculty</option>
              <option value="coordinator">Coordinator</option>
              <option value="academic_head">Academic Head</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
            <select name="employment_status" value={form.employment_status} onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="resigned">Resigned</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input type="tel" name="contact" value={form.contact} onChange={handleChange}
              placeholder="Phone number"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
            <input type="tel" name="emergency_contact" value={form.emergency_contact} onChange={handleChange}
              placeholder="Emergency contact"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
            <input type="date" name="date_of_joining" value={form.date_of_joining} onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
            <input type="number" name="experience_years" value={form.experience_years} onChange={handleChange}
              placeholder="Years of experience"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications</label>
            <input type="text" name="qualifications" value={form.qualifications} onChange={handleChange}
              placeholder="e.g., B.Ed, M.A"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Languages</label>
            <input type="text" name="languages" value={form.languages} onChange={handleChange}
              placeholder="e.g., English, Urdu"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Teaching Assignments */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Teaching assignments</p>
            <p className="text-xs text-gray-500 mt-1">
              Optional — assign later once curriculum is set up. For each row: choose{" "}
              <strong>branch</strong> → <strong>class/section</strong> → <strong>board</strong> →{" "}
              <strong>subject</strong> → <strong>book</strong>. One subject per row.
            </p>
          </div>

          {assignmentRows.map((row, i) => {
            const scope = examScopeByClass[row.class_id];
            const boards = scope?.boards || [];
            const board = boards.find((b) => String(b.id) === String(row.board_id));
            const subject = board?.subjects?.find((s) => String(s.id) === String(row.subject_id));
            return (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">Assignment {i + 1}</p>
                  {assignmentRows.length > 1 && (
                    <button type="button" onClick={() => setAssignmentRows((p) => p.filter((_, idx) => idx !== i))}
                      className="text-xs font-semibold text-red-600 hover:underline">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
                    <select value={row.branch_id} onChange={(e) => setRowBranch(i, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">-- Select Branch --</option>
                      {allBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Class / section</label>
                    <select value={row.class_id} onChange={(e) => setRowClass(i, e.target.value)}
                      disabled={!row.branch_id}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                      <option value="">-- Select Class --</option>
                      {classesForBranch(row.branch_id).map((c) => <option key={c.id} value={c.id}>{formatClass(c)}</option>)}
                    </select>
                  </div>
                </div>

                {row.class_id && scope === undefined && (
                  <p className="text-xs text-gray-400">Loading curriculum...</p>
                )}
                {row.class_id && scope && !boards.length && (
                  <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    No library curriculum linked yet — class will be assigned to this teacher.
                    Add boards, subjects &amp; books in <strong>Admin → Curriculum</strong> to also assign subjects.
                  </p>
                )}
                {row.class_id && boards.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Board</label>
                      <select value={row.board_id} onChange={(e) => updateRow(i, { board_id: e.target.value, subject_id: "", book_id: "" })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select...</option>
                        {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                      <select value={row.subject_id} onChange={(e) => updateRow(i, { subject_id: e.target.value, book_id: "" })}
                        disabled={!row.board_id}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                        <option value="">Select...</option>
                        {(board?.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Book</label>
                      <select value={row.book_id} onChange={(e) => updateRow(i, { book_id: e.target.value })}
                        disabled={!row.subject_id}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                        <option value="">Select...</option>
                        {(subject?.books || []).map((bk) => <option key={bk.id} value={bk.id}>{bk.title}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button type="button" onClick={() => setAssignmentRows((p) => [...p, emptyRow()])}
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            + Add another assignment
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// â"€â"€ Excel Import Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function ExcelImportModal({ isOpen, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(xlsx?|csv)$/i)) {
        toast.error("Please upload an Excel or CSV file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return toast.error("Please select a file");

    setSaving(true);
    try {
      const result = await managerService.importTeachers(file);
      toast.success(
        `${result.data.success_count} teachers imported successfully!`,
      );
      if (result.data.error_count > 0) {
        const errorMsg =
          result.data.errors?.length > 0
            ? `${result.data.error_count} failed:\n${result.data.errors.slice(0, 5).join("\n")}`
            : `${result.data.error_count} teachers failed to import`;
        toast.error(errorMsg);
      }
      setFile(null);
      fileInputRef.current.value = "";
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          err.message ||
          "Failed to import teachers",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await managerService.downloadTeacherImportTemplate();
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "teacher_import_template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to download template");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Teachers from Excel">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <p className="font-semibold mb-2">Excel Format Required:</p>
          <p>Use the downloaded template and fill Data sheet rows only.</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
            <li>school_name (required for tenant admin)</li>
            <li>full_name (required)</li>
            <li>email</li>
            <li>employee_id</li>
            <li>branch_name</li>
            <li>designation, date_of_joining, employment_status</li>
            <li>qualifications, experience_years, languages, salary</li>
            <li>contact, emergency_contact</li>
          </ul>
          <p className="mt-2 text-xs">
            Imported teachers get the default password from environment and must
            reset on first login.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          Download Template
        </button>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-semibold"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            {file ? "Change File" : "Select File"}
          </button>
          {file && <p className="mt-3 text-sm text-gray-600">{file.name}</p>}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={saving || !file}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Importing..." : "Import Teachers"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// â"€â"€ Help Guide Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function HelpGuideModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Teacher Import Guide">
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">
            Method 1: Manual Addition
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Use the "Add Teacher" button to create individual teacher accounts.
            Fill in all required fields (name, email, password) and optional
            fields as needed.
          </p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Click "Add Teacher" button</li>
            <li>Fill in teacher details</li>
            <li>Click "Create Teacher"</li>
          </ul>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h3 className="font-semibold text-gray-900 mb-2">
            Method 2: Excel/CSV Import
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Import multiple teachers at once from an Excel or CSV file. Download
            the template to ensure your file has the correct format.
          </p>
          <p className="text-sm text-gray-600 mb-3 font-semibold">
            Required columns (in order):
          </p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 space-y-1 font-mono">
            <div>
              school_name | full_name | email | employee_id | branch_name |
              designation | date_of_joining | employment_status | qualifications
              | experience_years | contact | emergency_contact | languages |
              salary
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3 mb-3">
            <strong>Important:</strong> full_name is required (plus school_name
            for tenant admin). Imported users get the environment default
            password and are forced to reset on first login.
          </p>
          <button
            onClick={async () => {
              try {
                const res =
                  await managerService.downloadTeacherImportTemplate();
                const blob = new Blob([res.data], {
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "teacher_import_template.xlsx";
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                toast.error(
                  err?.response?.data?.detail || "Failed to download template",
                );
              }
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Download Template
          </button>
        </div>
      </div>
    </Modal>
  );
}

// -- Main Page ------------------------------------------------------------------
export default function ManagerTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deletingTeacher, setDeletingTeacher] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        managerService.getTeachers(),
        managerService.getClasses(),
      ]);
      const teachersList = Array.isArray(tRes.data) ? tRes.data : [];
      const classList = Array.isArray(cRes.data) ? cRes.data : [];

      setTeachers(teachersList);
      setClasses(classList);

      const branchMap = {};
      teachersList.forEach((t) => {
        if (t.branch_id) branchMap[t.branch_id] = t.branch_name;
      });
      classList.forEach((c) => {
        if (c.branch_id) branchMap[c.branch_id] = c.branch_name;
      });
      setBranches(
        Object.entries(branchMap).map(([id, name]) => ({ id, name })),
      );
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = teachers.filter((t) => {
    const matchesSearch =
      t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase());
    const matchesBranch = !filterBranchId || t.branch_id === filterBranchId;
    return matchesSearch && matchesBranch;
  });

  const handleDeleteTeacher = async () => {
    if (!deletingTeacher?.id) return;
    setDeletingLoading(true);
    try {
      await managerService.deleteTeacher(deletingTeacher.id);
      toast.success("Teacher deleted successfully!");
      setShowDeleteConfirm(false);
      setDeletingTeacher(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete teacher");
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage all teacher accounts across your schools.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            onClick={() => setShowImportModal(true)}
          >
            <KeyIcon className="h-4 w-4" />
            Upload Teachers
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            onClick={() => setShowAddModal(true)}
          >
            <PlusIcon className="h-4 w-4" />
            Add Teacher
          </button>
        </div>
      </div>

      <AddTeacherModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={load}
        classes={classes}
      />
      <EditTeacherModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingTeacher(null);
        }}
        onSuccess={load}
        teacher={editingTeacher}
        branches={branches}
        classes={classes}
      />
      <BulkImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Upload Teachers"
        templateFileName="teacher_import_template.xlsx"
        onDownloadTemplate={() =>
          managerService.downloadTeacherImportTemplate()
        }
        onUpload={(file) => managerService.importTeachers(file)}
        onSuccess={load}
        guidance={[
          "Use the provided template with Data and Allowed Values sheets.",
          "Uploads are scoped to your tenant.",
          "All uploaded users receive the default password and must reset at first login.",
        ]}
      />

      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Total Teachers",
            value: filtered.length,
            color: "text-indigo-700 bg-indigo-50",
          },
          {
            label: "Active",
            value: filtered.filter((t) => t.is_active).length,
            color: "text-green-700 bg-green-50",
          },
          {
            label: "Inactive",
            value: filtered.filter((t) => !t.is_active).length,
            color: "text-red-600 bg-red-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl p-4 ${stat.color} border border-transparent`}
          >
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={filterBranchId}
          onChange={(e) => setFilterBranchId(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search teachers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <AcademicCapIcon className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No teachers found.</p>
            <p className="text-xs mt-1">
              {teachers.length === 0
                ? "Add your first teacher using the button above."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  School
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Branch
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Designation
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((teacher) => (
                <tr
                  key={teacher.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                        {teacher.full_name?.[0] || "T"}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {teacher.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                      <EnvelopeIcon className="h-3.5 w-3.5" />
                      {teacher.email}
                    </span>
                  </td>
                  <td className={"px-5 py-3 text-sm text-gray-700 hidden md:table-cell"}>
                    {teacher.school_name || "N/A"}
                  </td>
                  <td className={"px-5 py-3 text-sm text-gray-700 hidden md:table-cell"}>
                    {teacher.branch_name || "N/A"}
                  </td>
                  <td className={"px-5 py-3 text-sm text-gray-700 hidden lg:table-cell"}>
                    {teacher.designation || "N/A"}
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        teacher.is_active !== false
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {teacher.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        onClick={() => {
                          setEditingTeacher(teacher);
                          setShowEditModal(true);
                        }}
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setDeletingTeacher(teacher);
                          setShowDeleteConfirm(true);
                        }}
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

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Delete Teacher
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <strong>{deletingTeacher?.full_name}</strong>? This action cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingTeacher(null);
                }}
                disabled={deletingLoading}
                className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeacher}
                disabled={deletingLoading}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {deletingLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
