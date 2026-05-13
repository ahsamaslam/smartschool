import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import adminService from "../../services/adminService";
import examService from "../../services/examService";
import { summarizeScope, formatHistoryClass } from "../../utils/studentPreviewScope";
import { PageSpinner } from "../../components/common/Spinner";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import Dropdown from "../../components/common/Dropdown";
import Button from "../../components/common/Button";
import toast from "react-hot-toast";
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  EyeIcon,
  ArrowUpCircleIcon,
  ArrowPathRoundedSquareIcon,
  ArrowsRightLeftIcon,
  ArchiveBoxIcon,
  WrenchScrewdriverIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusCircleIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";

const COUNTRY_CODES = [
  { code: "+92", country: "Pakistan", flag: "🇵🇰" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
];

const EMPTY_FORM = {
  full_name: "",
  email: "",
  student_roll_no: "",
  school_id: "",
  branch_id: "",
  class_id: "",
  academic_start_year: "",
  academic_session: "",
  guardian_name: "",
  primary_contact: "",
  primary_country_code: "+92",
  emergency_contact: "",
  emergency_country_code: "+92",
  date_of_birth: "",
  gender: "",
  address: "",
  blood_group: "",
  medical_notes: "",
};

export default function AdminStudents() {
  const navigate = useNavigate();
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detail, setDetail] = useState(null);
  const [schools, setSchools] = useState([]);
  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [saving, setSaving] = useState(false);
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
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [pwdStudent, setPwdStudent] = useState(null);
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [savingStudentPwd, setSavingStudentPwd] = useState(false);
  const [sectionManagerOpen, setSectionManagerOpen] = useState(false);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState("");
  const [sectionForm, setSectionForm] = useState({ grade_level: "", section: "" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [curriculumPreview, setCurriculumPreview] = useState(null);
  /** Loaded when viewing a student: curriculum inherited via active enrollment → section */
  const [accessPreview, setAccessPreview] = useState(null);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await adminService.getStudentsLedger();
      setStudents(res.data || []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    adminService.getSchools().then((res) => setSchools(res.data || []));
  }, []);

  useEffect(() => {
    if (!form.school_id) {
      setBranches([]);
      setClasses([]);
      return;
    }
    adminService.getSchoolBranches(form.school_id).then((res) => setBranches(res.data || []));
  }, [form.school_id]);

  useEffect(() => {
    if (!form.branch_id) {
      setClasses([]);
      return;
    }
    adminService.getBranchClasses(form.branch_id).then((res) => setClasses(res.data || []));
  }, [form.branch_id]);

  useEffect(() => {
    if (!form.class_id) {
      setCurriculumPreview(null);
      return;
    }
    examService
      .getClassExamScope(form.class_id)
      .then((res) => {
        const body = res.data;
        let subjects = 0;
        let books = 0;
        let topics = 0;
        if (body.mode === "flat_legacy") {
          subjects = body.subjects?.length || 0;
          (body.subjects || []).forEach((s) => {
            topics += (s.topics || []).length;
          });
        } else if (body.mode === "library_tree") {
          for (const board of body.boards || []) {
            for (const sub of board.subjects || []) {
              subjects += 1;
              for (const bk of sub.books || []) {
                books += 1;
                for (const ch of bk.chapters || []) {
                  topics += (ch.topics || []).length;
                }
              }
            }
          }
        }
        setCurriculumPreview({
          subjects,
          books,
          topics,
          mode: body.mode || "",
        });
      })
      .catch(() => setCurriculumPreview(null));
  }, [form.class_id]);

  useEffect(() => {
    if (!detail) {
      setAccessPreview(null);
      return;
    }
    const active = detail.history?.find((h) => h.is_active);
    if (!active?.class_id) {
      setAccessPreview({
        loading: false,
        error:
          "No active enrollment — assign a section (enrollment repair / create student with class) to see curriculum.",
        activeEnrollment: null,
        summary: null,
      });
      return;
    }
    let cancelled = false;
    setAccessPreview({
      loading: true,
      error: null,
      activeEnrollment: active,
      summary: null,
    });
    examService
      .getClassExamScope(active.class_id)
      .then((res) => {
        if (cancelled) return;
        setAccessPreview({
          loading: false,
          error: null,
          activeEnrollment: active,
          summary: summarizeScope(res.data),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAccessPreview({
          loading: false,
          error: "Could not load curriculum for this section.",
          activeEnrollment: active,
          summary: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [detail]);

  const openDetail = useCallback(async (student) => {
    setSelectedStudent(student);
    setDetail(null);
    const res = await adminService.getStudentDetail(student.id);
    setDetail(res.data);
  }, []);

  useEffect(() => {
    const openId = location.state?.openStudentId;
    if (!openId || loading || students.length === 0) return;
    const st = students.find((s) => String(s.id) === String(openId));
    if (st) {
      openDetail(st);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, students, loading, openDetail, navigate, location.pathname]);

  const filtered = students.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageSpinner />;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (onlyDigits(form.primary_contact).length !== 10) {
      toast.error("Primary phone number must be exactly 10 digits.");
      return;
    }
    if (onlyDigits(form.emergency_contact).length !== 10) {
      toast.error("Emergency phone number must be exactly 10 digits.");
      return;
    }
    if (
      form.primary_country_code === form.emergency_country_code &&
      onlyDigits(form.primary_contact) === onlyDigits(form.emergency_contact)
    ) {
      toast.error("Emergency contact must be different from primary contact.");
      return;
    }
    if (!/^\d{4}-\d{4}$/.test(form.academic_session)) {
      toast.error("Academic session must be in format 2025-2026.");
      return;
    }
    setSaving(true);
    try {
      await adminService.createStudent({
        ...form,
        primary_contact: `${form.primary_country_code}${onlyDigits(form.primary_contact)}`,
        emergency_contact: `${form.emergency_country_code}${onlyDigits(form.emergency_contact)}`,
      });
      toast.success("Student created");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      loadStudents();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create student");
    } finally {
      setSaving(false);
    }
  };

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
    if (type === "section" && selectedStudent) {
      try {
        const res = await adminService.getStudentSectionOptions(selectedStudent.id);
        setSectionOptions(res.data?.options || []);
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to load sections");
        return;
      }
    }
    setActionOpen(true);
  };

  const submitAction = async () => {
    if (!selectedStudent) return;
    const normalizedSession = normalizeSession(actionSession);
    if (!/^\d{4}-\d{4}$/.test(normalizedSession)) {
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
        await adminService.promoteStudent(selectedStudent.id, {
          academic_session: normalizedSession,
          notes: actionNotes,
        });
      }
      if (actionType === "repeat") {
        await adminService.repeatStudent(selectedStudent.id, {
          academic_session: normalizedSession,
          notes: actionNotes,
        });
      }
      if (actionType === "section") {
        await adminService.changeStudentSection(selectedStudent.id, {
          target_class_id: targetSectionClassId,
          academic_session: normalizedSession,
          notes: actionNotes,
        });
      }
      toast.success("Student updated");
      setActionOpen(false);
      await loadStudents();
      await openDetail(selectedStudent);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Action failed");
    } finally {
      setSubmittingAction(false);
    }
  };

  const archiveStudent = async () => {
    if (!selectedStudent) return;
    const ok = window.confirm(`Archive ${selectedStudent.full_name}?`);
    if (!ok) return;
    try {
      await adminService.archiveStudent(selectedStudent.id);
      toast.success("Student archived");
      setSelectedStudent(null);
      setDetail(null);
      loadStudents();
    } catch {
      toast.error("Failed to archive student");
    }
  };

  const openRepair = async () => {
    if (!detail?.profile?.branch_id) {
      toast.error("Student branch is not set.");
      return;
    }
    const res = await adminService.getBranchClasses(detail.profile.branch_id);
    setSectionOptions(res.data || []);
    setRepairClassId("");
    setRepairSession(getNextSession() || "");
    setRepairOpen(true);
  };

  const reloadClasses = async () => {
    if (!form.branch_id) return;
    const res = await adminService.getBranchClasses(form.branch_id);
    setClasses(res.data || []);
  };

  const openSectionManager = () => {
    if (!form.branch_id) {
      toast.error("Select branch first.");
      return;
    }
    setEditingSectionId("");
    setSectionForm({ grade_level: "", section: "" });
    setSectionManagerOpen(true);
  };

  const handleSaveSection = async (e) => {
    e.preventDefault();
    if (!sectionForm.grade_level.trim() || !sectionForm.section.trim()) {
      toast.error("Class and section are required.");
      return;
    }
    setSectionSaving(true);
    try {
      const payload = {
        branch_id: form.branch_id,
        grade_level: sectionForm.grade_level.trim(),
        section: sectionForm.section.trim(),
        name: `Class ${sectionForm.grade_level.trim()} - ${sectionForm.section.trim()}`,
      };
      if (editingSectionId) {
        await adminService.updateClass(editingSectionId, payload);
        toast.success("Section updated.");
      } else {
        await adminService.createClass(payload);
        toast.success("Section added.");
      }
      setEditingSectionId("");
      setSectionForm({ grade_level: "", section: "" });
      await reloadClasses();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save section.");
    } finally {
      setSectionSaving(false);
    }
  };

  const editSection = (cls) => {
    setEditingSectionId(cls.id);
    setSectionForm({
      grade_level: cls.grade_level || "",
      section: cls.section || "",
    });
  };

  const deleteSection = async (cls) => {
    const ok = window.confirm(`Delete ${formatClass(cls)}?`);
    if (!ok) return;
    try {
      await adminService.deleteClass(cls.id);
      if (form.class_id === cls.id) {
        setForm((f) => ({ ...f, class_id: "" }));
      }
      toast.success("Section deleted.");
      await reloadClasses();
    } catch {
      toast.error("Failed to delete section.");
    }
  };

  const submitRepair = async () => {
    if (!selectedStudent) return;
    if (!repairClassId) return toast.error("Select class/section");
    if (!/^\d{4}-\d{4}$/.test(normalizeSession(repairSession))) {
      toast.error("Academic session must be in format 2026-2027.");
      return;
    }
    setRepairSaving(true);
    try {
      await adminService.setCurrentEnrollment(selectedStudent.id, {
        class_id: repairClassId,
        academic_session: normalizeSession(repairSession),
        notes: "Manual repair from admin panel",
      });
      toast.success("Current enrollment repaired.");
      setRepairOpen(false);
      await loadStudents();
      await openDetail(selectedStudent);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to set enrollment");
    } finally {
      setRepairSaving(false);
    }
  };

  const openEditStudent = () => {
    if (!detail) return;
    const p = detail.profile;
    setEditForm({
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
    setEditOpen(true);
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setEditSaving(true);
    try {
      await adminService.updateStudent(selectedStudent.id, editForm);
      toast.success("Student updated");
      setEditOpen(false);
      await openDetail(selectedStudent);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update student");
    } finally {
      setEditSaving(false);
    }
  };

  const classOptions = classes.map((c) => ({ value: c.id, label: formatClass(c) }));
  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }));
  const schoolOptions = schools.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage all student accounts across your schools.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <PlusIcon className="h-4 w-4" />
          Add Student
        </button>
      </div>

      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Students", value: students.length, color: "text-indigo-700 bg-indigo-50" },
          { label: "Active", value: students.filter((s) => s.is_active).length, color: "text-green-700 bg-green-50" },
          { label: "Inactive", value: students.filter((s) => !s.is_active).length, color: "text-red-600 bg-red-50" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl p-4 ${stat.color} border border-transparent`}>
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search students…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UserGroupIcon className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No students found.</p>
            <p className="text-xs mt-1">
              {students.length === 0
                ? "Add your first student using the button above."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((student) => (
                <tr
                  key={student.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/students/${student.id}/view`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/admin/students/${student.id}/view`);
                    }
                  }}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                        {student.full_name?.[0] || "S"}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {student.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                      <EnvelopeIcon className="h-3.5 w-3.5" />
                      {student.email}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {student.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {student.created_at
                      ? new Date(student.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(student);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Student" size="xl">
        <form onSubmit={handleCreate} className="space-y-3 max-h-[70vh] overflow-y-auto">
          <Input label="Full Name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
          <Input
            label="Email (optional)"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            hint="Leave blank to auto-generate from Student ID"
          />
          <Input
            label="Student ID (Roll No)"
            value={form.student_roll_no}
            onChange={(e) => setForm((f) => ({ ...f, student_roll_no: e.target.value }))}
            hint="Used as the initial login password"
            required
          />
          <Dropdown label="School" options={schoolOptions} value={form.school_id} onChange={(v) => setForm((f) => ({ ...f, school_id: v, branch_id: "", class_id: "" }))} required />
          <Dropdown label="Branch" options={branchOptions} value={form.branch_id} onChange={(v) => setForm((f) => ({ ...f, branch_id: v, class_id: "" }))} required />
          <Dropdown label="Class & Section" options={classOptions} value={form.class_id} onChange={(v) => setForm((f) => ({ ...f, class_id: v }))} required />
          {curriculumPreview && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold mb-1">Section curriculum preview</p>
              <p className="text-emerald-800">
                This section has approximately{" "}
                <strong>{curriculumPreview.subjects}</strong> subject
                {curriculumPreview.subjects !== 1 ? "s" : ""},{" "}
                <strong>{curriculumPreview.books}</strong> book
                {curriculumPreview.books !== 1 ? "s" : ""},{" "}
                <strong>{curriculumPreview.topics}</strong> topic
                {curriculumPreview.topics !== 1 ? "s" : ""}{" "}
                {curriculumPreview.mode === "flat_legacy"
                  ? "(legacy curriculum)"
                  : "(library)"}
                .
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openSectionManager}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <PlusCircleIcon className="h-4 w-4" />
              Manage Sections
            </button>
          </div>
          <Input
            label="Academic Start Year"
            type="number"
            min="2000"
            max="2100"
            value={form.academic_start_year}
            onChange={(e) => {
              const year = onlyDigits(e.target.value).slice(0, 4);
              const end = year ? String(Number(year) + 1) : "";
              setForm((f) => ({ ...f, academic_start_year: year, academic_session: year && end ? `${year}-${end}` : "" }));
            }}
            required
          />
          <Input label="Academic Session" value={form.academic_session} disabled hint="Auto generated from start year" required />
          <Input label="Guardian Name" value={form.guardian_name} onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))} />
          <PhoneField
            label="Primary Contact"
            countryCode={form.primary_country_code}
            number={form.primary_contact}
            onCodeChange={(v) => setForm((f) => ({ ...f, primary_country_code: v }))}
            onNumberChange={(v) => setForm((f) => ({ ...f, primary_contact: v }))}
          />
          <PhoneField
            label="Emergency Contact"
            countryCode={form.emergency_country_code}
            number={form.emergency_contact}
            onCodeChange={(v) => setForm((f) => ({ ...f, emergency_country_code: v }))}
            onNumberChange={(v) => setForm((f) => ({ ...f, emergency_contact: v }))}
          />
          <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
          <Input label="Gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} />
          <Input label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <Input label="Blood Group" value={form.blood_group} onChange={(e) => setForm((f) => ({ ...f, blood_group: e.target.value }))} />
          <Input label="Medical Notes" value={form.medical_notes} onChange={(e) => setForm((f) => ({ ...f, medical_notes: e.target.value }))} />
          <Button type="submit" fullWidth loading={saving}>Save Student</Button>
        </form>
      </Modal>

      <Modal
        isOpen={sectionManagerOpen}
        onClose={() => setSectionManagerOpen(false)}
        title="Manage Class Sections"
        size="xl"
      >
        <div className="space-y-4">
          <form onSubmit={handleSaveSection} className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              label="Class"
              value={sectionForm.grade_level}
              onChange={(e) => setSectionForm((f) => ({ ...f, grade_level: e.target.value }))}
              placeholder="e.g. 1"
              required
            />
            <Input
              label="Section"
              value={sectionForm.section}
              onChange={(e) => setSectionForm((f) => ({ ...f, section: e.target.value }))}
              placeholder="e.g. A"
              required
            />
            <div className="flex items-end gap-2">
              <Button type="submit" loading={sectionSaving}>
                {editingSectionId ? "Update" : "Add"}
              </Button>
              {editingSectionId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingSectionId("");
                    setSectionForm({ grade_level: "", section: "" });
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {classes.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-800">{formatClass(cls)}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => editSection(cls)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    <PencilSquareIcon className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSection(cls)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {classes.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-5">No sections yet for this branch.</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(selectedStudent)}
        onClose={() => {
          setSelectedStudent(null);
          setDetail(null);
          setAccessPreview(null);
        }}
        title="Student detail & access (testing)"
        size="xl"
      >
        {!detail ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
              For testing: below is what this student&apos;s <strong>active enrollment</strong> ties them to — same
              section curriculum the student app uses (My Courses), independent of login status.
            </p>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
                Section access & curriculum
              </p>
              {accessPreview?.loading && (
                <p className="text-sm text-indigo-900">Loading curriculum for enrolled section…</p>
              )}
              {accessPreview?.error && (
                <p className="text-sm text-amber-800">{accessPreview.error}</p>
              )}
              {!accessPreview?.loading && accessPreview?.activeEnrollment && (
                <>
                  <div className="text-sm text-indigo-950 space-y-1">
                    <p>
                      <span className="text-indigo-700">School:</span>{" "}
                      {accessPreview.activeEnrollment.school_name || "—"}
                    </p>
                    <p>
                      <span className="text-indigo-700">Branch:</span>{" "}
                      {accessPreview.activeEnrollment.branch_name || "—"}
                    </p>
                    <p>
                      <span className="text-indigo-700">Class / section:</span>{" "}
                      {formatHistoryClass(accessPreview.activeEnrollment)}
                      {accessPreview.activeEnrollment.class_name &&
                        accessPreview.activeEnrollment.class_name !==
                          `Class ${accessPreview.activeEnrollment.grade_level}` && (
                          <span className="text-indigo-600">
                            {" "}
                            ({accessPreview.activeEnrollment.class_name})
                          </span>
                        )}
                    </p>
                    <p>
                      <span className="text-indigo-700">Academic session:</span>{" "}
                      {accessPreview.activeEnrollment.academic_session || "—"}
                    </p>
                    <p className="text-xs font-mono text-indigo-600 break-all">
                      class_id: {String(accessPreview.activeEnrollment.class_id)}
                    </p>
                  </div>
                  {accessPreview.summary && (
                    <div className="rounded-xl bg-white/90 border border-indigo-100 px-3 py-2 text-sm text-gray-800">
                      <p className="font-semibold text-gray-900 mb-1">Curriculum linked to this section</p>
                      <p>
                        Approximately{" "}
                        <strong>{accessPreview.summary.subjects}</strong> subject
                        {accessPreview.summary.subjects !== 1 ? "s" : ""},{" "}
                        <strong>{accessPreview.summary.books}</strong> book
                        {accessPreview.summary.books !== 1 ? "s" : ""},{" "}
                        <strong>{accessPreview.summary.topics}</strong> topic
                        {accessPreview.summary.topics !== 1 ? "s" : ""}{" "}
                        <span className="text-gray-500">
                          (
                          {accessPreview.summary.mode === "flat_legacy"
                            ? "legacy flat curriculum"
                            : "library tree"}
                          )
                        </span>
                      </p>
                      {accessPreview.summary.boardsDetail?.length > 0 && (
                        <details className="mt-2 group">
                          <summary className="cursor-pointer text-xs font-medium text-indigo-700 hover:underline">
                            Expand structure (boards → subjects → books)
                          </summary>
                          <div className="mt-2 max-h-52 overflow-y-auto text-xs space-y-2 border-t border-indigo-100 pt-2">
                            {accessPreview.summary.mode === "library_tree" &&
                              accessPreview.summary.boardsDetail.map((board, bi) => (
                                <div key={`board-${bi}`} className="pl-1">
                                  <p className="font-semibold text-gray-800">Board: {board.name}</p>
                                  <ul className="mt-1 ml-3 space-y-1.5 text-gray-700">
                                    {(board.subjects || []).map((sub, si) => (
                                      <li key={`sub-${bi}-${si}`}>
                                        <span className="font-medium">{sub.name}</span>
                                        <ul className="ml-3 mt-0.5 text-gray-600">
                                          {(sub.books || []).map((bk, bki) => (
                                            <li key={`bk-${bi}-${si}-${bki}`}>
                                              {bk.title}{" "}
                                              <span className="text-gray-400">
                                                ({bk.topicCount} topics
                                                {bk.chapters ? `, ${bk.chapters} ch.` : ""})
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            {accessPreview.summary.mode === "flat_legacy" &&
                              accessPreview.summary.boardsDetail.map((row, ri) => (
                                <div key={`leg-${ri}`} className="text-gray-800">
                                  <span className="font-medium">{row.name}</span>{" "}
                                  <span className="text-gray-500">
                                    — {row.topicCount} topic{row.topicCount !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <Info label="Name" value={detail.profile.full_name} />
              <Info label="Email" value={detail.profile.email} />
              <Info label="Student ID (Roll No)" value={detail.profile.student_roll_no} />
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Account status</p>
                <div className="flex items-center justify-between mt-1">
                  <p className={`font-medium ${detail.profile.is_active ? "text-green-700" : "text-red-600"}`}>
                    {detail.profile.is_active ? "Active (can log in)" : "Inactive (cannot log in)"}
                  </p>
                  {detail.profile.is_active ? (
                    <button
                      onClick={async () => {
                        const ok = window.confirm(`Deactivate ${detail.profile.full_name}? They won't be able to log in.`);
                        if (!ok) return;
                        try {
                          await adminService.deactivateUser(selectedStudent.id);
                          toast.success("Account deactivated");
                          await openDetail(selectedStudent);
                        } catch {
                          toast.error("Failed to deactivate");
                        }
                      }}
                      className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          await adminService.activateUser(selectedStudent.id);
                          toast.success("Account activated");
                          await openDetail(selectedStudent);
                        } catch {
                          toast.error("Failed to activate");
                        }
                      }}
                      className="text-xs px-2 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
              <Info label="Profile school (record)" value={detail.profile.school_name} />
              <Info label="Profile branch (record)" value={detail.profile.branch_name} />
              <Info label="Guardian" value={detail.profile.guardian_name} />
              <Info label="Primary Contact" value={detail.profile.primary_contact} />
              <Info label="Emergency Contact" value={detail.profile.emergency_contact} />
              <Info label="DOB" value={detail.profile.date_of_birth} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={openEditStudent} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                <PencilSquareIcon className="h-4 w-4" /> Edit Info
              </button>
              <button onClick={() => { setPwdStudent(selectedStudent); setNewStudentPassword(""); }} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
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
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Enrollment History</h3>
              <div className="space-y-2">
                {detail.history.map((h) => (
                  <div
                    key={h.id}
                    className={`rounded-lg border p-3 text-xs text-gray-700 ${
                      h.is_active
                        ? "border-green-200 bg-green-50/40"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <p className="font-medium flex flex-wrap items-center gap-2">
                      {h.is_active && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">
                          Active enrollment
                        </span>
                      )}
                      <span>
                        {h.school_name} / {h.branch_name} / {formatHistoryClass(h)}
                      </span>
                    </p>
                    <p>
                      Session: {h.academic_session || "—"} | Status: {h.status} | Result:{" "}
                      {h.promotion_result || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={actionOpen}
        onClose={() => setActionOpen(false)}
        title={actionType === "promote" ? "Promote Student" : actionType === "repeat" ? "Fail/Repeat Student" : "Change Section"}
      >
        <div className="space-y-3">
          <Input
            label="Academic Session"
            value={actionSession}
            onChange={(e) => setActionSession(e.target.value)}
            placeholder="2026-2027"
          />
          {actionType === "section" && (
            <Dropdown
              label="Target Section"
              options={sectionOptions.map((c) => ({ value: c.id, label: formatClass(c) }))}
              value={targetSectionClassId}
              onChange={setTargetSectionClassId}
              placeholder="Select section"
            />
          )}
          <Input
            label="Notes (optional)"
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
          />
          <Button onClick={submitAction} loading={submittingAction} fullWidth>
            Confirm
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={repairOpen}
        onClose={() => setRepairOpen(false)}
        title="Set Current Enrollment"
      >
        <div className="space-y-3">
          <Dropdown
            label="Class & Section"
            options={sectionOptions.map((c) => ({ value: c.id, label: formatClass(c) }))}
            value={repairClassId}
            onChange={setRepairClassId}
            placeholder="Select class"
          />
          <Input
            label="Academic Session"
            value={repairSession}
            onChange={(e) => setRepairSession(e.target.value)}
            placeholder="2026-2027"
          />
          <Button onClick={submitRepair} loading={repairSaving} fullWidth>
            Set as Current
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Student"
        size="xl"
      >
        <form onSubmit={handleEditStudent} className="space-y-3 max-h-[70vh] overflow-y-auto">
          <Input
            label="Full Name"
            value={editForm.full_name || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
            required
          />
          <Input
            label="Student ID (Roll No)"
            value={editForm.student_roll_no || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, student_roll_no: e.target.value }))}
            hint="Also used as the login password — update password separately if needed"
          />
          <Input
            label="Email"
            value={editForm.email || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            hint="Leave blank to keep current email"
          />
          <Input
            label="Guardian Name"
            value={editForm.guardian_name || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, guardian_name: e.target.value }))}
          />
          <Input
            label="Primary Contact"
            value={editForm.primary_contact || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, primary_contact: e.target.value }))}
          />
          <Input
            label="Emergency Contact"
            value={editForm.emergency_contact || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact: e.target.value }))}
          />
          <Input
            label="Date of Birth"
            type="date"
            value={editForm.date_of_birth || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, date_of_birth: e.target.value }))}
          />
          <Input
            label="Gender"
            value={editForm.gender || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
          />
          <Input
            label="Address"
            value={editForm.address || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Input
            label="Blood Group"
            value={editForm.blood_group || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, blood_group: e.target.value }))}
          />
          <Input
            label="Medical Notes"
            value={editForm.medical_notes || ""}
            onChange={(e) => setEditForm((f) => ({ ...f, medical_notes: e.target.value }))}
          />
          <Button type="submit" fullWidth loading={editSaving}>Save Changes</Button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(pwdStudent)}
        onClose={() => setPwdStudent(null)}
        title={`Set Password — ${pwdStudent?.full_name || ""}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Enter a new password for this student. They will use it to log in.
          </p>
          <Input
            label="New Password"
            type="password"
            value={newStudentPassword}
            onChange={(e) => setNewStudentPassword(e.target.value)}
            hint="Tip: use their Student ID / Roll No as the password"
            required
          />
          <Button
            fullWidth
            loading={savingStudentPwd}
            onClick={async () => {
              if (!newStudentPassword || newStudentPassword.length < 4) {
                toast.error("Password must be at least 4 characters.");
                return;
              }
              setSavingStudentPwd(true);
              try {
                await adminService.setStudentPassword(pwdStudent.id, newStudentPassword);
                toast.success("Password updated. Student can now log in.");
                setPwdStudent(null);
                setNewStudentPassword("");
              } catch (err) {
                toast.error(err?.response?.data?.detail || "Failed to set password.");
              } finally {
                setSavingStudentPwd(false);
              }
            }}
          >
            Save Password
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900 mt-1">{value || "—"}</p>
    </div>
  );
}

function onlyDigits(value) {
  return (value || "").replace(/\D/g, "");
}

function formatClass(cls) {
  return `Class ${cls.grade_level || "—"}${cls.section ? ` - ${cls.section}` : ""}`;
}

function normalizeSession(value) {
  return (value || "").trim().replace(/–/g, "-").replace(/—/g, "-");
}

function PhoneField({ label, countryCode, number, onCodeChange, onNumberChange }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="grid grid-cols-[220px_1fr] gap-2">
        <select
          value={countryCode}
          onChange={(e) => onCodeChange(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.country} ({c.code})
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={number}
          onChange={(e) => onNumberChange(onlyDigits(e.target.value).slice(0, 10))}
          placeholder="10 digits"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <p className="text-xs text-gray-500">
        Selected: {countryCode} + {number || "__________"}
      </p>
    </div>
  );
}
