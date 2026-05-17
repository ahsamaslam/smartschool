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
  EyeIcon,
  ArrowUpCircleIcon,
  ArrowPathRoundedSquareIcon,
  ArrowsRightLeftIcon,
  ArchiveBoxIcon,
  WrenchScrewdriverIcon,
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
function EditStudentModal({ isOpen, onClose, onSuccess, studentId, initialData }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    const loadDetail = async () => {
      if (studentId) {
        try {
          const res = await managerService.getStudentDetail(studentId);
          const p = res.data?.profile || {};
          setForm({
            full_name: p.full_name || "",
            email: p.email || "",
            student_roll_no: p.student_roll_no || "",
            guardian_name: p.guardian_name || "",
            primary_contact: p.primary_contact || "",
            emergency_contact: p.emergency_contact || "",
            date_of_birth: p.date_of_birth ? p.date_of_birth.slice(0, 10) : "",
            gender: p.gender || "",
            address: p.address || "",
            blood_group: p.blood_group || "",
            medical_notes: p.medical_notes || "",
          });
          return;
        } catch {
          // fall through to initialData
        }
      }
      if (initialData) {
        setForm({
          full_name: initialData.full_name || "",
          email: initialData.email || "",
          student_roll_no: initialData.student_roll_no || "",
          guardian_name: initialData.guardian_name || "",
          primary_contact: "",
          emergency_contact: "",
          date_of_birth: initialData.date_of_birth ? initialData.date_of_birth.slice(0, 10) : "",
          gender: initialData.gender || "",
          address: "",
          blood_group: "",
          medical_notes: "",
        });
      }
    };
    loadDetail();
  }, [isOpen, studentId, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required.");
    setSaving(true);
    try {
      await managerService.updateStudent(studentId, form);
      toast.success("Student updated successfully!");
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update student.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Edit Student</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input type="text" name="full_name" value={form.full_name || ""} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={form.email || ""} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Roll No.</label>
              <input type="text" name="student_roll_no" value={form.student_roll_no || ""} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
              <input type="text" name="guardian_name" value={form.guardian_name || ""} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Contact</label>
              <input type="text" name="primary_contact" value={form.primary_contact || ""} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
              <input type="text" name="emergency_contact" value={form.emergency_contact || ""} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" name="date_of_birth" value={form.date_of_birth || ""} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select name="gender" value={form.gender || ""} onChange={handleChange} className={inputCls}>
                <option value="">-- Select --</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" name="address" value={form.address || ""} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
              <input type="text" name="blood_group" value={form.blood_group || ""} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medical Notes</label>
            <input type="text" name="medical_notes" value={form.medical_notes || ""} onChange={handleChange} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Manage Student Modal ─────────────────────────────────────────────────────
function ManageStudentModal({ isOpen, onClose, student, onRefresh, classes }) {
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState("");
  const [actionSession, setActionSession] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [sectionOptions, setSectionOptions] = useState([]);
  const [targetSectionClassId, setTargetSectionClassId] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairClassId, setRepairClassId] = useState("");
  const [repairSession, setRepairSession] = useState("");
  const [repairSaving, setRepairSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!student) return;
    setLoadingDetail(true);
    try {
      const res = await managerService.getStudentDetail(student.id);
      setDetail(res.data);
    } catch {
      toast.error("Failed to load student detail.");
    } finally {
      setLoadingDetail(false);
    }
  }, [student]);

  useEffect(() => {
    if (isOpen && student) loadDetail();
    else setDetail(null);
  }, [isOpen, student, loadDetail]);

  const getNextSession = () => {
    const active = detail?.history?.find((h) => h.is_active);
    const session = active?.academic_session || "";
    if (!/^\d{4}-\d{4}$/.test(session)) return "";
    const [a] = session.split("-").map(Number);
    return `${a + 1}-${a + 2}`;
  };

  const openActionModal = async (type) => {
    setActionType(type);
    setActionNotes("");
    setTargetSectionClassId("");
    setSectionOptions([]);
    setActionSession(getNextSession());
    if (type === "section" && student) {
      try {
        const res = await managerService.getStudentSectionOptions(student.id);
        setSectionOptions(res.data?.options || []);
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to load sections");
        return;
      }
    }
    setActionOpen(true);
  };

  const normalizeSession = (v) => (v || "").trim().replace(/–/g, "-").replace(/—/g, "-");

  const submitAction = async () => {
    if (!student) return;
    const ns = normalizeSession(actionSession);
    if (!/^\d{4}-\d{4}$/.test(ns)) {
      toast.error("Academic session must be in format 2026-2027.");
      return;
    }
    if (actionType === "section" && !targetSectionClassId) {
      toast.error("Please select target section.");
      return;
    }
    setSubmittingAction(true);
    try {
      if (actionType === "promote") {
        await managerService.promoteStudent(student.id, { academic_session: ns, notes: actionNotes });
      } else if (actionType === "repeat") {
        await managerService.repeatStudent(student.id, { academic_session: ns, notes: actionNotes });
      } else if (actionType === "section") {
        await managerService.changeStudentSection(student.id, { target_class_id: targetSectionClassId, academic_session: ns, notes: actionNotes });
      }
      toast.success("Student updated");
      setActionOpen(false);
      await loadDetail();
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Action failed");
    } finally {
      setSubmittingAction(false);
    }
  };

  const openRepair = async () => {
    if (!detail?.profile?.branch_id) {
      const active = detail?.history?.find((h) => h.is_active);
      if (!active) {
        toast.error("No branch found for repair. Set a branch on the student first.");
        return;
      }
    }
    setRepairClassId("");
    setRepairSession(getNextSession() || "");
    setRepairOpen(true);
  };

  const submitRepair = async () => {
    if (!student) return;
    if (!repairClassId) return toast.error("Select class/section");
    const ns = normalizeSession(repairSession);
    if (!/^\d{4}-\d{4}$/.test(ns)) {
      toast.error("Academic session must be in format 2026-2027.");
      return;
    }
    setRepairSaving(true);
    try {
      await managerService.setCurrentEnrollment(student.id, { class_id: repairClassId, academic_session: ns, notes: "Manual repair from manager panel" });
      toast.success("Current enrollment set.");
      setRepairOpen(false);
      await loadDetail();
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to set enrollment");
    } finally {
      setRepairSaving(false);
    }
  };

  const archiveStudent = async () => {
    if (!student) return;
    const ok = window.confirm(`Archive ${student.full_name}?`);
    if (!ok) return;
    try {
      await managerService.deleteStudent(student.id);
      toast.success("Student archived");
      onClose();
      onRefresh();
    } catch {
      toast.error("Failed to archive student");
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const formatHistoryClass = (h) => {
    if (!h) return "—";
    if (h.grade_level && h.section) return `Grade ${h.grade_level} Sec ${h.section}`;
    if (h.grade_level) return `Grade ${h.grade_level}`;
    return h.class_name || "—";
  };

  if (!isOpen || !student) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">Manage Student</h2>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {loadingDetail && !detail ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
          ) : detail ? (
            <div className="space-y-4">
              {/* Profile info grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <InfoBox label="Name" value={detail.profile.full_name} />
                <InfoBox label="Email" value={detail.profile.email} />
                <InfoBox label="Roll No." value={detail.profile.student_roll_no} />
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Account status</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className={`font-medium ${detail.profile.is_active ? "text-green-700" : "text-red-600"}`}>
                      {detail.profile.is_active ? "Active" : "Inactive"}
                    </p>
                    {detail.profile.is_active ? (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Deactivate ${detail.profile.full_name}?`)) return;
                          try {
                            await managerService.deactivateUser(student.id);
                            toast.success("Account deactivated");
                            await loadDetail();
                          } catch { toast.error("Failed to deactivate"); }
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      >Deactivate</button>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            await managerService.activateUser(student.id);
                            toast.success("Account activated");
                            await loadDetail();
                          } catch { toast.error("Failed to activate"); }
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50"
                      >Activate</button>
                    )}
                  </div>
                </div>
                <InfoBox label="Guardian" value={detail.profile.guardian_name} />
                <InfoBox label="Primary Contact" value={detail.profile.primary_contact} />
                <InfoBox label="Emergency Contact" value={detail.profile.emergency_contact} />
                <InfoBox label="Date of Birth" value={detail.profile.date_of_birth} />
                <InfoBox label="School" value={detail.profile.school_name} />
                <InfoBox label="Branch" value={detail.profile.branch_name} />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                  <PencilSquareIcon className="h-4 w-4" /> Edit Info
                </button>
                <button onClick={() => { setPwdOpen(true); setNewPwd(""); }} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <KeyIcon className="h-4 w-4" /> Set Password
                </button>
                <button onClick={() => openActionModal("promote")} className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                  <ArrowUpCircleIcon className="h-4 w-4" /> Promote
                </button>
                <button onClick={() => openActionModal("repeat")} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <ArrowPathRoundedSquareIcon className="h-4 w-4" /> Fail/Repeat
                </button>
                <button onClick={() => openActionModal("section")} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                  <ArrowsRightLeftIcon className="h-4 w-4" /> Change Section
                </button>
                <button onClick={archiveStudent} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                  <ArchiveBoxIcon className="h-4 w-4" /> Archive
                </button>
                <button onClick={openRepair} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <WrenchScrewdriverIcon className="h-4 w-4" /> Set Current Enrollment
                </button>
              </div>

              {/* Enrollment history */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Enrollment History</h3>
                <div className="space-y-2">
                  {detail.history.length === 0 && (
                    <p className="text-sm text-gray-400">No enrollment records yet.</p>
                  )}
                  {detail.history.map((h) => (
                    <div key={h.id} className={`rounded-lg border p-3 text-xs text-gray-700 ${h.is_active ? "border-green-200 bg-green-50/40" : "border-gray-200 bg-gray-50"}`}>
                      <p className="font-medium flex flex-wrap items-center gap-2">
                        {h.is_active && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">Active</span>}
                        <span>{h.school_name} / {h.branch_name} / {formatHistoryClass(h)}</span>
                      </p>
                      <p>Session: {h.academic_session || "—"} | Status: {h.status} | Result: {h.promotion_result || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Edit modal from inside Manage */}
      <EditStudentModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={async () => { await loadDetail(); onRefresh(); }}
        studentId={student?.id}
        initialData={null}
      />

      {/* Set Password */}
      {pwdOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Set Password</h3>
              <button onClick={() => setPwdOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Enter a new password for {student?.full_name}.</p>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="New password (min 4 chars)" className={inputCls + " mb-3"} />
            <button
              disabled={savingPwd}
              onClick={async () => {
                if (!newPwd || newPwd.length < 4) { toast.error("Password must be at least 4 characters."); return; }
                setSavingPwd(true);
                try {
                  await managerService.setStudentPassword(student.id, newPwd);
                  toast.success("Password updated.");
                  setPwdOpen(false);
                } catch (err) { toast.error(err?.response?.data?.detail || "Failed to set password."); }
                finally { setSavingPwd(false); }
              }}
              className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingPwd ? "Saving…" : "Save Password"}
            </button>
          </div>
        </div>
      )}

      {/* Action modal (promote / repeat / change-section) */}
      {actionOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                {actionType === "promote" ? "Promote Student" : actionType === "repeat" ? "Fail/Repeat Student" : "Change Section"}
              </h3>
              <button onClick={() => setActionOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Session</label>
                <input type="text" value={actionSession} onChange={(e) => setActionSession(e.target.value)} placeholder="2026-2027" className={inputCls} />
              </div>
              {actionType === "section" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Section</label>
                  <select value={targetSectionClassId} onChange={(e) => setTargetSectionClassId(e.target.value)} className={inputCls}>
                    <option value="">-- Select --</option>
                    {sectionOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name || `Grade ${c.grade_level}${c.section ? ` Sec ${c.section}` : ""}`}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input type="text" value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} className={inputCls} />
              </div>
              <button disabled={submittingAction} onClick={submitAction} className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {submittingAction ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Current Enrollment modal */}
      {repairOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Set Current Enrollment</h3>
              <button onClick={() => setRepairOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class &amp; Section</label>
                <select value={repairClassId} onChange={(e) => setRepairClassId(e.target.value)} className={inputCls}>
                  <option value="">-- Select --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || `Grade ${c.grade_level}${c.section ? ` Sec ${c.section}` : ""}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Session</label>
                <input type="text" value={repairSession} onChange={(e) => setRepairSession(e.target.value)} placeholder="2026-2027" className={inputCls} />
              </div>
              <button disabled={repairSaving} onClick={submitRepair} className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {repairSaving ? "Saving…" : "Set as Current"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900 mt-1 text-sm">{value || "—"}</p>
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
  const [editStudentId, setEditStudentId] = useState(null);
  const [editStudentData, setEditStudentData] = useState(null);
  const [manageStudent, setManageStudent] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPromoteOpen, setBulkPromoteOpen] = useState(false);
  const [bulkSession, setBulkSession] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkPromoting, setBulkPromoting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

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

  const openBulkPromote = () => {
    const nextYear = new Date().getFullYear();
    setBulkSession(`${nextYear}-${nextYear + 1}`);
    setBulkNotes("");
    setBulkProgress({ done: 0, total: 0 });
    setBulkPromoteOpen(true);
  };

  const submitBulkPromote = async () => {
    const session = (bulkSession || "").trim().replace(/–/g, "-").replace(/—/g, "-");
    if (!/^\d{4}-\d{4}$/.test(session)) {
      toast.error("Academic session must be in format 2025-2026.");
      return;
    }
    const ids = [...selectedIds];
    setBulkPromoting(true);
    setBulkProgress({ done: 0, total: ids.length });
    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        await managerService.promoteStudent(ids[i], { academic_session: session, notes: bulkNotes });
        succeeded++;
      } catch {
        failed++;
      }
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkPromoting(false);
    setBulkPromoteOpen(false);
    setSelectedIds(new Set());
    if (failed === 0) toast.success(`${succeeded} student${succeeded !== 1 ? "s" : ""} promoted.`);
    else toast.error(`${succeeded} promoted, ${failed} failed.`);
    load();
  };

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
        isOpen={Boolean(editStudentId)}
        onClose={() => { setEditStudentId(null); setEditStudentData(null); }}
        onSuccess={load}
        studentId={editStudentId}
        initialData={editStudentData}
      />
      <ManageStudentModal
        isOpen={Boolean(manageStudent)}
        onClose={() => setManageStudent(null)}
        student={manageStudent}
        onRefresh={load}
        classes={classes}
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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5">
          <span className="text-sm font-semibold text-indigo-800">{selectedIds.size} student{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <button
            onClick={openBulkPromote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <ArrowUpCircleIcon className="h-4 w-4" /> Promote Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-indigo-500 hover:text-indigo-700"
          >
            Clear selection
          </button>
        </div>
      )}

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
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="pl-4 pr-2 py-3">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(filtered.map((s) => s.id)));
                      else setSelectedIds(new Set());
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
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
                  <td className="pl-4 pr-2 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        setSelectedIds(next);
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
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
                      {s.class_name
                        ? [s.grade_level && `Grade ${s.grade_level}`, s.section && `Sec ${s.section}`].filter(Boolean).join(" · ") || s.class_name
                        : "—"}
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
                        onClick={() => { setEditStudentId(s.id); setEditStudentData(s); }}
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
                      <button
                        type="button"
                        onClick={() => setManageStudent(s)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 bg-white"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Bulk Promote Modal */}
      {bulkPromoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              Promote {selectedIds.size} Student{selectedIds.size !== 1 ? "s" : ""}
            </h2>
            <p className="text-sm text-gray-500">
              All selected students will be promoted to the next grade in the given academic session.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Academic Session</label>
              <input
                type="text"
                value={bulkSession}
                onChange={(e) => setBulkSession(e.target.value)}
                placeholder="2025-2026"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {bulkPromoting && (
              <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                Promoting… {bulkProgress.done} / {bulkProgress.total}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={submitBulkPromote}
                disabled={bulkPromoting}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {bulkPromoting ? "Promoting…" : "Confirm Promote All"}
              </button>
              <button
                onClick={() => setBulkPromoteOpen(false)}
                disabled={bulkPromoting}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
