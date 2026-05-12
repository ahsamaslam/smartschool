import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Modal from "../common/Modal";
import Input from "../common/Input";
import Dropdown from "../common/Dropdown";
import Button from "../common/Button";
import adminService from "../../services/adminService";
import examService from "../../services/examService";
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
  designation: "",
  date_of_joining: "",
  employment_status: "active",
  qualifications: "",
  experience_years: "",
  languages: "",
  salary: "",
};

const emptyAssignmentRow = () => ({
  branch_id: "",
  class_id: "",
  board_id: "",
  subject_id: "",
  book_id: "",
});

export default function TeacherProfileModal({ isOpen, onClose, onSaved, initialData }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [schools, setSchools] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [assignmentRows, setAssignmentRows] = useState([emptyAssignmentRow()]);
  const [examScopeByClass, setExamScopeByClass] = useState({});
  const scopeCacheRef = useRef({});
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    adminService.getSchools().then((res) => setSchools(res.data || []));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    adminService.getClasses().then((res) => {
      const rows = res.data?.data ?? res.data ?? [];
      setAllClasses(Array.isArray(rows) ? rows : []);
    });
  }, [isOpen]);

  useEffect(() => {
    if (form.school_id) {
      setLoadingBranches(true);
      adminService
        .getSchoolBranches(form.school_id)
        .then((res) => setBranches(res.data || []))
        .finally(() => setLoadingBranches(false));
    } else {
      setBranches([]);
    }
  }, [form.school_id]);

  useEffect(() => {
    if (!isOpen) return;
    if (!initialData) {
      setForm(EMPTY_FORM);
      setAssignmentRows([emptyAssignmentRow()]);
      setExamScopeByClass({});
      scopeCacheRef.current = {};
      return;
    }
    setForm(toFormState(initialData));
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen || !allClasses.length) return;

    const tc = normalizeTeacherAssignments(initialData?.teacher_curriculum_assignments);
    if (tc.length) {
      setAssignmentRows(
        tc.map((a) => ({
          branch_id: a.branch_id ? String(a.branch_id) : "",
          class_id: String(a.class_id || ""),
          board_id: a.library_board_id ? String(a.library_board_id) : "",
          subject_id: String(a.library_subject_id || ""),
          book_id: String(a.library_book_id || ""),
        })),
      );
      return;
    }

    if (!initialData?.id) return;

    const rawIds = normalizeIdList(initialData.assigned_class_ids ?? initialData.assigned_classes);
    if (!rawIds.length) {
      setAssignmentRows([
        {
          ...emptyAssignmentRow(),
          branch_id: initialData.branch_id || "",
        },
      ]);
      return;
    }

    setAssignmentRows(
      rawIds.map((cid) => {
        const cls = allClasses.find((c) => String(c.id) === String(cid));
        return {
          branch_id: cls?.branch_id ? String(cls.branch_id) : initialData.branch_id || "",
          class_id: String(cid),
          board_id: "",
          subject_id: "",
          book_id: "",
        };
      }),
    );
  }, [isOpen, initialData, allClasses]);

  const classesForBranch = useCallback(
    (branchId) => {
      if (!branchId) return [];
      return allClasses.filter((c) => String(c.branch_id) === String(branchId));
    },
    [allClasses],
  );

  const fetchExamScope = useCallback(async (classId) => {
    if (!classId) return null;
    if (scopeCacheRef.current[classId]) {
      return scopeCacheRef.current[classId];
    }
    try {
      const res = await examService.getClassExamScope(classId);
      const data = res.data;
      scopeCacheRef.current[classId] = data;
      setExamScopeByClass((prev) => ({ ...prev, [classId]: data }));
      return data;
    } catch {
      toast.error("Could not load curriculum for this section.");
      return null;
    }
  }, []);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const updateRow = (index, patch) => {
    setAssignmentRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const setRowBranch = (index, branchId) => {
    updateRow(index, {
      branch_id: branchId,
      class_id: "",
      board_id: "",
      subject_id: "",
      book_id: "",
    });
  };

  const setRowClass = async (index, classId) => {
    updateRow(index, {
      class_id: classId,
      board_id: "",
      subject_id: "",
      book_id: "",
    });
    if (classId) await fetchExamScope(classId);
  };

  const addAssignmentRow = () => {
    setAssignmentRows((prev) => [...prev, emptyAssignmentRow()]);
  };

  const removeAssignmentRow = (index) => {
    setAssignmentRows((prev) =>
      prev.length <= 1 ? [emptyAssignmentRow()] : prev.filter((_, i) => i !== index),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const curriculumRows = assignmentRows
      .filter((r) => r.class_id && r.subject_id && r.book_id)
      .map((r) => ({
        school_id: form.school_id || null,
        branch_id: r.branch_id || null,
        library_board_id: r.board_id || null,
        class_id: r.class_id,
        library_subject_id: r.subject_id,
        library_book_id: r.book_id,
      }));

    const incomplete = assignmentRows.some(
      (r) =>
        (r.branch_id || r.class_id || r.board_id || r.subject_id || r.book_id) &&
        !(r.class_id && r.subject_id && r.book_id),
    );
    if (incomplete || curriculumRows.length === 0) {
      toast.error(
        curriculumRows.length === 0
          ? "Add at least one assignment: branch → class/section → board → subject → book."
          : "Complete each started assignment row (class, subject, and book are required).",
      );
      return;
    }

    setSaving(true);
    try {
      const primaryBranchId = curriculumRows[0]?.branch_id || assignmentRows[0]?.branch_id || null;

      const payload = {
        ...form,
        role: "teacher",
        school_id: form.school_id || null,
        branch_id: primaryBranchId,
        date_of_joining: form.date_of_joining || null,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        contact: normalizePhone(form.contact),
        emergency_contact: normalizePhone(form.emergency_contact),
        teacher_curriculum_assignments: curriculumRows,
        ...(!isEdit && form.employee_id ? { password: form.employee_id } : {}),
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

  const classIdsKey = useMemo(
    () =>
      assignmentRows
        .map((r) => r.class_id || "")
        .join("|"),
    [assignmentRows],
  );

  useEffect(() => {
    if (!isOpen) return;
    assignmentRows.forEach((r) => {
      if (r.class_id) fetchExamScope(r.class_id);
    });
  }, [isOpen, classIdsKey, fetchExamScope]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Teacher Profile" : "Add Teacher"}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
        <Input
          label="Full Name"
          value={form.full_name}
          onChange={(e) => handleChange("full_name", e.target.value)}
          required
        />
        <Input
          label="Email (optional)"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          hint={!isEdit ? "Leave blank to auto-generate from Employee ID" : undefined}
          disabled={isEdit}
        />
        <Input
          label="Employee ID"
          value={form.employee_id}
          onChange={(e) => handleChange("employee_id", e.target.value)}
          hint={!isEdit ? "Used as the initial login password" : undefined}
          required
        />
        <Input
          label="Contact"
          value={form.contact}
          onChange={(e) => handleChange("contact", onlyDigits(e.target.value))}
          inputMode="numeric"
        />
        <Input
          label="Emergency Contact"
          value={form.emergency_contact}
          onChange={(e) => handleChange("emergency_contact", onlyDigits(e.target.value))}
          inputMode="numeric"
        />

        <Dropdown
          label="School"
          options={schools.map((s) => ({ value: s.id, label: s.name }))}
          value={form.school_id}
          onChange={(v) => {
            handleChange("school_id", v);
            setAssignmentRows([emptyAssignmentRow()]);
            setExamScopeByClass({});
            scopeCacheRef.current = {};
          }}
          required
        />

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Teaching assignments</p>
            <p className="text-xs text-gray-600 mt-1">
              For each row: choose <strong>branch</strong> → <strong>class/section</strong> →{" "}
              <strong>board</strong> → <strong>subject</strong> → <strong>book</strong> (curriculum
              must be linked to that section in your library). One subject per section per row; add
              more rows for other sections or subjects.
            </p>
          </div>

          {!form.school_id && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Select a school first.
            </p>
          )}

          {assignmentRows.map((row, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-700">Assignment {index + 1}</p>
                {assignmentRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAssignmentRow(index)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Dropdown
                  label="Branch"
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  value={row.branch_id}
                  onChange={(v) => setRowBranch(index, v)}
                  required={false}
                  disabled={!form.school_id || loadingBranches}
                />
                <Dropdown
                  label="Class / section"
                  options={classesForBranch(row.branch_id).map((c) => ({
                    value: c.id,
                    label: formatClassLabel(c),
                  }))}
                  value={row.class_id}
                  onChange={(v) => setRowClass(index, v)}
                  required={false}
                  disabled={!row.branch_id}
                />
              </div>

              {row.class_id && (
                <CurriculumPickers
                  row={row}
                  examScope={examScopeByClass[row.class_id]}
                  onChangeBoard={(v) =>
                    updateRow(index, { board_id: v, subject_id: "", book_id: "" })
                  }
                  onChangeSubject={(v) => updateRow(index, { subject_id: v, book_id: "" })}
                  onChangeBook={(v) => updateRow(index, { book_id: v })}
                />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addAssignmentRow}
            disabled={!form.school_id}
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 disabled:text-gray-400"
          >
            + Add another assignment
          </button>
        </div>

        <Dropdown
          label="Designation"
          options={DESIGNATIONS}
          value={form.designation}
          onChange={(v) => handleChange("designation", v)}
          required
        />
        <Input
          label="Date of Joining"
          type="date"
          value={form.date_of_joining}
          onChange={(e) => handleChange("date_of_joining", e.target.value)}
        />
        <Dropdown
          label="Employment Status"
          options={EMPLOYMENT_STATUS}
          value={form.employment_status}
          onChange={(v) => handleChange("employment_status", v)}
        />

        <Input
          label="Qualifications"
          value={form.qualifications}
          onChange={(e) => handleChange("qualifications", e.target.value)}
        />
        <Input
          label="Experience (Years)"
          type="number"
          min="0"
          step="0.5"
          value={form.experience_years}
          onChange={(e) => handleChange("experience_years", e.target.value)}
        />
        <Input
          label="Languages"
          value={form.languages}
          onChange={(e) => handleChange("languages", e.target.value)}
        />
        <Input
          label="Salary"
          value={form.salary}
          onChange={(e) => handleChange("salary", e.target.value)}
        />

        <Button type="submit" variant="primary" fullWidth loading={saving}>
          {isEdit ? "Update Teacher" : "Save Teacher"}
        </Button>
      </form>
    </Modal>
  );
}

function CurriculumPickers({ row, examScope, onChangeBoard, onChangeSubject, onChangeBook }) {
  if (!examScope) {
    return <p className="text-xs text-gray-500">Loading curriculum…</p>;
  }
  if (examScope.mode === "flat_legacy") {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        This section uses legacy subjects only. Link <strong>library books</strong> to this section
        in Curriculum so you can pick board → subject → book.
      </p>
    );
  }
  const boards = examScope.boards || [];
  if (!boards.length) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        No library curriculum for this section yet. Assign boards, subjects, and books in
        Admin → Curriculum for this class.
      </p>
    );
  }

  const board = boards.find((b) => String(b.id) === String(row.board_id));
  const subject = board?.subjects?.find((s) => String(s.id) === String(row.subject_id));

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Dropdown
        label="Board"
        options={boards.map((b) => ({ value: b.id, label: b.name }))}
        value={row.board_id}
        onChange={onChangeBoard}
        required={false}
      />
      <Dropdown
        label="Subject"
        options={(board?.subjects || []).map((s) => ({ value: s.id, label: s.name }))}
        value={row.subject_id}
        onChange={onChangeSubject}
        required={false}
        disabled={!row.board_id}
      />
      <Dropdown
        label="Book"
        options={(subject?.books || []).map((bk) => ({ value: bk.id, label: bk.title }))}
        value={row.book_id}
        onChange={onChangeBook}
        required={false}
        disabled={!row.subject_id}
      />
    </div>
  );
}

function normalizeTeacherAssignments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeIdList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
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
  const parts = [];
  if (cls.name) parts.push(cls.name);
  if (cls.grade_level != null && cls.grade_level !== "") parts.push(`Grade ${cls.grade_level}`);
  if (cls.section) parts.push(`Sec ${cls.section}`);
  return parts.length ? parts.join(" · ") : "Class";
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
    designation: data.designation ?? "",
    date_of_joining: data.date_of_joining ?? "",
    employment_status: data.employment_status ?? "active",
    qualifications: data.qualifications ?? "",
    experience_years: data.experience_years ?? "",
    languages: data.languages ?? "",
    salary: data.salary ?? "",
  };
}
