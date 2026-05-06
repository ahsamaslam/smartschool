import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Input from "../common/Input";
import Dropdown from "../common/Dropdown";
import Button from "../common/Button";
import adminService from "../../services/adminService";
import toast from "react-hot-toast";

const DESIGNATIONS = [
  { value: "pre_school_teacher", label: "Pre-School Teacher" },
  { value: "junior_school_teacher", label: "Junior School Teacher" },
  { value: "middle_school_teacher", label: "Middle School Teacher" },
  { value: "senior_school_teacher", label: "Senior School Teacher" },
  { value: "o_level_faculty", label: "O-Level Faculty" },
  { value: "a_level_faculty", label: "A-Level Faculty" },
  { value: "coordinator", label: "Coordinator" },
  { value: "academic_head", label: "Academic Head" },
];
const EMPLOYMENT_STATUS = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "resigned", label: "Resigned" },
];

const EMPTY_FORM = {
  full_name: "",
  email: "",
  employee_id: "",
  dob: "",
  gender: "",
  contact: "",
  emergency_contact: "",
  school_id: "",
  branch_id: "",
  designation: "",
  date_of_joining: "",
  employment_status: "active",
  subjects: [],
  qualifications: "",
  experience_years: "",
  languages: "",
  assigned_classes: "",
  salary: "",
};

export default function TeacherProfileModal({ isOpen, onClose, onSaved, initialData }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [schools, setSchools] = useState([]);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [branchClasses, setBranchClasses] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    adminService.getSchools().then(res => setSchools(res.data || []));
    adminService.getSubjects().then((res) => setSubjects(res.data || []));
  }, []);

  useEffect(() => {
    if (form.school_id) {
      setLoadingBranches(true);
      adminService.getSchoolBranches(form.school_id)
        .then(res => setBranches(res.data || []))
        .finally(() => setLoadingBranches(false));
    } else {
      setBranches([]);
    }
  }, [form.school_id]);

  useEffect(() => {
    if (form.branch_id) {
      setLoadingClasses(true);
      adminService
        .getBranchClasses(form.branch_id)
        .then((res) => setBranchClasses(res.data || []))
        .finally(() => setLoadingClasses(false));
    } else {
      setBranchClasses([]);
    }
  }, [form.branch_id]);

  useEffect(() => {
    if (initialData) {
      setForm(toFormState(initialData));
    } else {
      setForm(EMPTY_FORM);
    }
  }, [initialData]);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        role: "teacher",
        school_id: form.school_id || null,
        branch_id: form.branch_id || null,
        date_of_joining: form.date_of_joining || null,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        contact: normalizePhone(form.contact),
        emergency_contact: normalizePhone(form.emergency_contact),
      };
      if (isEdit) {
        await adminService.updateUser(initialData.id, payload);
      } else {
        await adminService.createUser(payload);
      }
      toast.success(isEdit ? "Teacher updated!" : "Teacher saved!");
      onSaved?.();
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to save teacher.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Teacher Profile" : "Teacher Profile"} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
        <Input label="Full Name" value={form.full_name} onChange={e => handleChange("full_name", e.target.value)} required />
        <Input label="Email" type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} required disabled={isEdit} />
        <Input label="Employee ID" value={form.employee_id} onChange={e => handleChange("employee_id", e.target.value)} required />
        <Input label="Contact" value={form.contact} onChange={e => handleChange("contact", onlyDigits(e.target.value))} inputMode="numeric" />
        <Input label="Emergency Contact" value={form.emergency_contact} onChange={e => handleChange("emergency_contact", onlyDigits(e.target.value))} inputMode="numeric" />
        <Dropdown label="School" options={schools.map(s => ({ value: s.id, label: s.name }))} value={form.school_id} onChange={v => handleChange("school_id", v)} required />
        <Dropdown
          label="Branch"
          options={branches.map(b => ({ value: b.id, label: b.name }))}
          value={form.branch_id}
          onChange={v => {
            handleChange("branch_id", v);
            handleChange("assigned_classes", []);
          }}
          required
          disabled={!form.school_id || loadingBranches}
        />
        <Dropdown label="Designation" options={DESIGNATIONS} value={form.designation} onChange={v => handleChange("designation", v)} required />
        <Input label="Date of Joining" type="date" value={form.date_of_joining} onChange={e => handleChange("date_of_joining", e.target.value)} />
        <Dropdown label="Employment Status" options={EMPLOYMENT_STATUS} value={form.employment_status} onChange={v => handleChange("employment_status", v)} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Subjects Taught</span>
          <select
            multiple
            value={form.subjects}
            onChange={(e) =>
              handleChange(
                "subjects",
                Array.from(e.target.selectedOptions, (o) => o.value),
              )
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-28"
          >
            {subjects.map((subj) => (
              <option key={subj.id} value={subj.id}>
                {subj.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">Hold Ctrl/Cmd to select multiple subjects.</p>
        </div>
        <Input label="Qualifications" value={form.qualifications} onChange={e => handleChange("qualifications", e.target.value)} />
        <Input label="Experience (Years)" type="number" min="0" step="0.5" value={form.experience_years} onChange={e => handleChange("experience_years", e.target.value)} />
        <Input label="Languages" value={form.languages} onChange={e => handleChange("languages", e.target.value)} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Assigned Classes</span>
          <select
            multiple
            value={form.assigned_classes}
            onChange={(e) =>
              handleChange(
                "assigned_classes",
                Array.from(e.target.selectedOptions, (o) => o.value),
              )
            }
            disabled={!form.branch_id || loadingClasses}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-28 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {branchClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {formatClassLabel(cls)}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {!form.branch_id
              ? "Select branch first."
              : "Hold Ctrl/Cmd to select multiple classes."}
          </p>
        </div>
        <Input label="Salary" value={form.salary} onChange={e => handleChange("salary", e.target.value)} />
        <Button type="submit" variant="primary" fullWidth loading={saving}>{isEdit ? "Update Teacher" : "Save"}</Button>
      </form>
    </Modal>
  );
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function onlyDigits(value) {
  return (value || "").replace(/\D/g, "");
}

function normalizePhone(value) {
  const digits = onlyDigits(value);
  return digits || null;
}

function formatClassLabel(cls) {
  const base = cls.grade_level ? `Class ${cls.grade_level}` : cls.name || "Class";
  if (cls.section) return `${base} - ${cls.section}`;
  return base;
}

function toFormState(data = {}) {
  return {
    ...EMPTY_FORM,
    full_name: data.full_name ?? "",
    email: data.email ?? "",
    employee_id: data.employee_id ?? "",
    contact: data.contact ?? "",
    emergency_contact: data.emergency_contact ?? "",
    school_id: data.school_id ?? "",
    branch_id: data.branch_id ?? "",
    designation: data.designation ?? "",
    date_of_joining: data.date_of_joining ?? "",
    employment_status: data.employment_status ?? "active",
    subjects: normalizeStringArray(data.subjects),
    qualifications: data.qualifications ?? "",
    experience_years: data.experience_years ?? "",
    languages: data.languages ?? "",
    assigned_classes: normalizeStringArray(data.assigned_classes),
    salary: data.salary ?? "",
  };
}
