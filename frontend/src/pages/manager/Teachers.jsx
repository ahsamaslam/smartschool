import { useEffect, useState, useCallback, useRef } from "react";
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
  QuestionMarkCircleIcon,
  DocumentArrowDownIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
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
};

// ── Manual Add Form Modal ──────────────────────────────────────────────────
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
    setForm(f => ({ ...f, [name]: value }));
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required
              placeholder="Set a password"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select name="branch_id" value={form.branch_id} onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select Branch —</option>
              {(() => {
                const branches = {};
                classes?.forEach(c => { if (!branches[c.branch_id]) branches[c.branch_id] = c.branch_name; });
                return Object.entries(branches).map(([id, name]) => <option key={id} value={id}>{name}</option>);
              })()}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <input type="text" name="designation" value={form.designation} onChange={handleChange}
              placeholder="e.g., Senior Teacher"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
            <select name="employment_status" value={form.employment_status} onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
            <input type="date" name="date_of_joining" value={form.date_of_joining} onChange={handleChange}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
            <input type="number" name="experience_years" value={form.experience_years} onChange={handleChange}
              placeholder="Years of experience"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Languages</label>
          <input type="text" name="languages" value={form.languages} onChange={handleChange}
            placeholder="e.g., English, Urdu, Pashto"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Creating…" : "Create Teacher"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Teacher Modal ─────────────────────────────────────────────────────
function EditTeacherModal({ isOpen, onClose, onSuccess, teacher, branches = [] }) {
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

  useEffect(() => {
    if (teacher) {
      setForm({
        full_name: teacher.full_name || "",
        email: teacher.email || "",
        password: "",
        branch_id: teacher.branch_id || "",
        designation: teacher.designation || "",
        contact: teacher.contact || "",
        emergency_contact: teacher.emergency_contact || "",
        employment_status: teacher.employment_status || "active",
        date_of_joining: teacher.date_of_joining || "",
        qualifications: teacher.qualifications || "",
        experience_years: teacher.experience_years || "",
        languages: teacher.languages || "",
      });
    }
  }, [teacher, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required.");
    if (!form.email.trim()) return toast.error("Email is required.");

    setSaving(true);
    try {
      const updateData = { ...form };
      if (!updateData.password) delete updateData.password;

      await managerService.updateTeacher(teacher.id, updateData);
      toast.success("Teacher updated successfully!");
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update teacher.");
    } finally {
      setSaving(false);
    }
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
              <option value="">— Select Branch —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
            <input type="text" name="designation" value={form.designation} onChange={handleChange}
              placeholder="e.g., Senior Teacher"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
            <select name="employment_status" value={form.employment_status} onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
            <input type="date" name="date_of_joining" value={form.date_of_joining} onChange={handleChange}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
            <input type="number" name="experience_years" value={form.experience_years} onChange={handleChange}
              placeholder="Years of experience"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Languages</label>
          <input type="text" name="languages" value={form.languages} onChange={handleChange}
            placeholder="e.g., English, Urdu, Pashto"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Excel Import Modal ─────────────────────────────────────────────────────
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
      toast.success(`${result.data.success_count} teachers imported successfully!`);
      if (result.data.error_count > 0) {
        const errorMsg = result.data.errors?.length > 0
          ? `${result.data.error_count} failed:\n${result.data.errors.slice(0, 5).join('\n')}`
          : `${result.data.error_count} teachers failed to import`;
        toast.error(errorMsg);
      }
      setFile(null);
      fileInputRef.current.value = "";
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Failed to import teachers");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Teachers from Excel">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <p className="font-semibold mb-2">Excel Format Required:</p>
          <p>Your Excel file should have these columns (in order):</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
            <li>Full Name</li>
            <li>Email</li>
            <li>Password</li>
            <li>Designation (optional)</li>
            <li>Contact (optional)</li>
            <li>Emergency Contact (optional)</li>
            <li>Employment Status (optional)</li>
            <li>Date of Joining (optional)</li>
            <li>Qualifications (optional)</li>
            <li>Experience Years (optional)</li>
            <li>Languages (optional)</li>
          </ul>
        </div>

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
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
            Cancel
          </button>
          <button type="button" onClick={handleImport} disabled={saving || !file}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Importing…" : "Import Teachers"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Help Guide Modal ───────────────────────────────────────────────────────
function HelpGuideModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Teacher Import Guide">
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Method 1: Manual Addition</h3>
          <p className="text-sm text-gray-600 mb-3">
            Use the "Add Teacher" button to create individual teacher accounts. Fill in all required fields (name, email, password) and optional fields as needed.
          </p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Click "Add Teacher" button</li>
            <li>Fill in teacher details</li>
            <li>Click "Create Teacher"</li>
          </ul>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h3 className="font-semibold text-gray-900 mb-2">Method 2: Excel/CSV Import</h3>
          <p className="text-sm text-gray-600 mb-3">
            Import multiple teachers at once from an Excel or CSV file. Download the template to ensure your file has the correct format.
          </p>
          <p className="text-sm text-gray-600 mb-3 font-semibold">Required columns (in order):</p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 space-y-1 font-mono">
            <div>Full Name | Email | Password | Branch | Designation | Contact | Emergency Contact | Employment Status | Date of Joining | Qualifications | Experience Years | Languages</div>
          </div>
          <p className="text-sm text-gray-600 mt-3 mb-3">
            <strong>Important:</strong> Only Full Name, Email, and Password are required. Other fields are optional. Branch should be the branch name (exact match). Employment Status values: "active", "on_leave", "inactive"
          </p>
          <button
            onClick={() => {
              const csv = "Full Name,Email,Password,Branch,Designation,Contact,Emergency Contact,Employment Status,Date of Joining,Qualifications,Experience Years,Languages\nJohn Doe,john@school.com,password123,Main Branch,Senior Teacher,+1234567890,+0987654321,active,2024-01-01,B.Ed M.A,5,English|Urdu";
              const blob = new Blob([csv], { type: "text/csv" });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "teacher_import_template.csv";
              a.click();
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ManagerTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [assignFor, setAssignFor] = useState(null);
  const [viewClassesFor, setViewClassesFor] = useState(null);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deletingTeacher, setDeletingTeacher] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

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

      // Extract unique branches from both teachers and classes
      const branchMap = {};
      teachersList.forEach(t => {
        if (t.branch_id) branchMap[t.branch_id] = t.branch_name;
      });
      classList.forEach(c => {
        if (c.branch_id) branchMap[c.branch_id] = c.branch_name;
      });
      setBranches(Object.entries(branchMap).map(([id, name]) => ({ id, name })));
    } catch (err) {
      console.error("Failed to load data:", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = teachers.filter(t =>
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.branch_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewClasses = (teacher) => {
    setViewClassesFor(teacher);
    const teacherClasses = classes.filter(c =>
      c.teacher_id === teacher.id ||
      c.teacher_name === teacher.full_name
    );
    setAssignedClasses(teacherClasses);
  };

  const handleAssignClass = async (classId) => {
    if (!assignFor?.id || !classId) return;
    try {
      await managerService.assignTeacherClass(assignFor.id, classId);
      toast.success("Teacher assigned to class!");
      setAssignFor(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to assign class");
    }
  };

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
      console.error("Delete teacher error:", err);
      const errorMsg = err?.response?.data?.detail || err?.message || "Failed to delete teacher";
      toast.error(errorMsg);
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleBulkDeleteTeachers = async () => {
    if (selectedTeachers.size === 0) return;
    setDeletingLoading(true);
    try {
      await managerService.deleteTeachers(Array.from(selectedTeachers));
      toast.success(`${selectedTeachers.size} teacher(s) deleted successfully!`);
      setShowBulkDeleteConfirm(false);
      setSelectedTeachers(new Set());
      load();
    } catch (err) {
      console.error("Bulk delete teachers error:", err);
      const errorMsg = err?.response?.data?.detail || err?.message || "Failed to delete teachers";
      toast.error(errorMsg);
    } finally {
      setDeletingLoading(false);
    }
  };

  const toggleTeacherSelection = (teacherId) => {
    const newSelected = new Set(selectedTeachers);
    if (newSelected.has(teacherId)) {
      newSelected.delete(teacherId);
    } else {
      newSelected.add(teacherId);
    }
    setSelectedTeachers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTeachers.size === filtered.length) {
      setSelectedTeachers(new Set());
    } else {
      setSelectedTeachers(new Set(filtered.map(t => t.id)));
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage teachers in your school</p>
        </div>
        <div className="flex gap-2">
          {selectedTeachers.size > 0 && (
            <button onClick={() => setShowBulkDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700">
              <TrashIcon className="h-4 w-4" />
              Delete Selected ({selectedTeachers.size})
            </button>
          )}
          <button onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200">
            <QuestionMarkCircleIcon className="h-4 w-4" />
            Guide
          </button>
          <button onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700">
            <DocumentArrowDownIcon className="h-4 w-4" />
            Import Excel
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            <PlusIcon className="h-4 w-4" />
            Add Teacher
          </button>
        </div>
      </div>

      <div className="relative mb-5 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text" placeholder="Search teachers…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserCircleIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{teachers.length === 0 ? "No teachers yet." : "No teachers match your search."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedTeachers.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Branch</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Classes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-50 ${selectedTeachers.has(t.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedTeachers.has(t.id)}
                      onChange={() => toggleTeacherSelection(t.id)}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-700">{t.full_name?.[0]?.toUpperCase()}</span>
                      </div>
                      <p className="font-medium text-gray-800">{t.full_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell text-xs">{t.email}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{t.branch_name || "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleViewClasses(t)}
                      className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium hover:bg-indigo-100">
                      <AcademicCapIcon className="h-3.5 w-3.5" />
                      {t.class_count ?? 0}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                    <button onClick={() => { setAssignFor(t); setShowAssignModal(true); }}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold">
                      Assign
                    </button>
                    <button onClick={() => { setEditingTeacher(t); setShowEditModal(true); }}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setDeletingTeacher(t); setShowDeleteConfirm(true); }}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddTeacherModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={load} classes={classes} />
      <EditTeacherModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} onSuccess={load} teacher={editingTeacher} branches={branches} />
      <ExcelImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onSuccess={load} />
      <HelpGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      {assignFor && (
        <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title={`Assign Class — ${assignFor?.full_name}`}>
          <div className="space-y-4">
            <select
              onChange={(e) => { if (e.target.value) handleAssignClass(e.target.value); e.target.value = ""; }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a class —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.branch_name} / {c.name}
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}

      {viewClassesFor && (
        <Modal isOpen={!!viewClassesFor} onClose={() => setViewClassesFor(null)} title={`${viewClassesFor.full_name}'s Classes`}>
          <div className="space-y-2">
            {loadingAssigned ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading…</p>
            ) : assignedClasses.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No classes assigned</p>
            ) : (
              assignedClasses.map((c) => (
                <div key={c.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.branch_name} • {c.student_count} students</p>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {deletingTeacher && (
        <Modal isOpen={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setDeletingTeacher(null); }} title="Delete Teacher">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <span className="font-semibold">{deletingTeacher.full_name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeletingTeacher(null); }} disabled={deletingLoading}
                className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={handleDeleteTeacher} disabled={deletingLoading}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {deletingLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                {deletingLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={showBulkDeleteConfirm} onClose={() => { setShowBulkDeleteConfirm(false); }} title="Delete Selected Teachers">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold">{selectedTeachers.size}</span> teacher{selectedTeachers.size !== 1 ? 's' : ''}? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => { setShowBulkDeleteConfirm(false); }} disabled={deletingLoading}
              className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60">
              Cancel
            </button>
            <button onClick={handleBulkDeleteTeachers} disabled={deletingLoading}
              className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {deletingLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {deletingLoading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
