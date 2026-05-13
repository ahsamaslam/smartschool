
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { PageSpinner } from "../../components/common/Spinner";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import toast from "react-hot-toast";
import adminService from "../../services/adminService";
import Input from "../../components/common/Input";
import {
  AcademicCapIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import TeacherProfileModal from "../../components/admin/TeacherProfileModal";
import { setAdminPreviewTeacher } from "../../utils/adminPreviewTeacher";

export default function AdminTeachers() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSchoolId, setFilterSchoolId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [pwdTeacher, setPwdTeacher] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTeacher, setDeletingTeacher] = useState(null);

  const loadTeachers = () => {
    setLoading(true);
    Promise.all([
      api.get("/admins/users", { params: { role: "teacher" } }),
      api.get("/admins/schools")
    ])
      .then(([teachersRes, schoolsRes]) => {
        setTeachers(
          (teachersRes.data || []).map((teacher) => ({
            ...teacher,
            subjects: normalizeStringArray(teacher.subjects),
            subject_names: normalizeStringArray(teacher.subject_names),
          })),
        );
        setSchools(schoolsRes.data || []);
      })
      .catch(() => {
        setTeachers([]);
        setSchools([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const filtered = teachers.filter(
    (t) => {
      const matchesSearch = t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.email?.toLowerCase().includes(search.toLowerCase());
      const matchesSchool = !filterSchoolId || t.school_id === filterSchoolId;
      return matchesSearch && matchesSchool;
    }
  );

  const handleDeleteTeacher = async () => {
    if (!deletingTeacher?.id) return;
    try {
      await adminService.deactivateUser(deletingTeacher.id);
      toast.success("Teacher deleted successfully!");
      setShowDeleteConfirm(false);
      setDeletingTeacher(null);
      loadTeachers();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete teacher");
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage all teacher accounts across your schools.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          onClick={() => setShowModal(true)}
        >
          <PlusIcon className="h-4 w-4" />
          Add Teacher
        </button>
      </div>

      <TeacherProfileModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTeacher(null);
        }}
        onSaved={loadTeachers}
        initialData={editingTeacher}
      />

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={filterSchoolId}
          onChange={(e) => setFilterSchoolId(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">All Schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search teachers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
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
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  School
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
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
                  <td className="px-5 py-3 text-sm text-gray-700">
                    {teacher.school_name || "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700">
                    {teacher.branch_name || "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700">
                    {formatDesignation(teacher.designation) || "—"}
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        teacher.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {teacher.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        onClick={() => {
                          setEditingTeacher(teacher);
                          setShowModal(true);
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

      <Modal
        isOpen={Boolean(selectedTeacher)}
        onClose={() => setSelectedTeacher(null)}
        title="Teacher Information"
        size="xl"
      >
        {selectedTeacher && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Info label="Full Name" value={selectedTeacher.full_name} />
            <Info label="Email" value={selectedTeacher.email} />
            <Info label="Employee ID" value={selectedTeacher.employee_id} />
            <Info label="School" value={selectedTeacher.school_name} />
            <Info label="Branch" value={selectedTeacher.branch_name} />
            <Info label="Designation" value={formatDesignation(selectedTeacher.designation)} />
            <Info label="Joining Date" value={selectedTeacher.date_of_joining ? new Date(selectedTeacher.date_of_joining).toLocaleDateString() : ""} />
            <Info label="Employment Status" value={selectedTeacher.employment_status} />
            <Info label="Contact" value={selectedTeacher.contact} />
            <Info label="Emergency Contact" value={selectedTeacher.emergency_contact} />
            <Info label="Experience (Years)" value={selectedTeacher.experience_years} />
            <Info label="Languages" value={selectedTeacher.languages} />
            <Info label="Salary" value={selectedTeacher.salary} />
            <div className="md:col-span-2">
              <Info label="Qualifications" value={selectedTeacher.qualifications} />
            </div>
            <div className="md:col-span-2">
              <Info
                label="Teaching assignments"
                value={formatTeachingAssignments(selectedTeacher)}
                multiline
              />
            </div>
            <div className="md:col-span-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingTeacher(selectedTeacher);
                  setSelectedTeacher(null);
                  setShowModal(true);
                }}
              >
                Edit This Teacher
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(pwdTeacher)}
        onClose={() => setPwdTeacher(null)}
        title={`Set Password — ${pwdTeacher?.full_name || ""}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Enter a new password for this teacher. They will use it to log in.
          </p>
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="Tip: use their Employee ID as the password"
            required
          />
          <Button
            fullWidth
            loading={savingPwd}
            onClick={async () => {
              if (!newPassword || newPassword.length < 4) {
                toast.error("Password must be at least 4 characters.");
                return;
              }
              setSavingPwd(true);
              try {
                await adminService.setUserPassword(pwdTeacher.id, newPassword);
                toast.success("Password updated. Teacher can now log in.");
                setPwdTeacher(null);
                setNewPassword("");
              } catch (err) {
                toast.error(err?.response?.data?.detail || "Failed to set password.");
              } finally {
                setSavingPwd(false);
              }
            }}
          >
            Save Password
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingTeacher(null);
        }}
        title="Delete Teacher"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold">{deletingTeacher?.full_name}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletingTeacher(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleDeleteTeacher}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value, multiline }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`font-medium text-gray-900 mt-1 ${multiline ? "whitespace-pre-line text-sm leading-relaxed" : ""}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function formatDesignation(value) {
  if (!value) return "";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function renderSubjectSummary(subjectNames = []) {
  const normalized = normalizeStringArray(subjectNames);
  if (!normalized.length) return "—";
  const firstTwo = normalized.slice(0, 2).join(", ");
  if (normalized.length <= 2) return firstTwo;
  return `${firstTwo} +${normalized.length - 2} more`;
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

function formatTeachingAssignments(teacher) {
  const raw = teacher?.teacher_curriculum_assignments;
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) list = p;
    } catch {
      /* ignore */
    }
  }
  if (list.length) {
    return list
      .map((a) => {
        const cls = [
          a.class_name,
          a.grade_level != null && a.grade_level !== "" ? `Grade ${a.grade_level}` : null,
          a.section ? `Sec ${a.section}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const board = a.board_name ? `${a.board_name} · ` : "";
        return `${cls || "Section"} → ${board}${a.subject_name || ""} (${a.book_title || "book"})`;
      })
      .join("\n");
  }
  const subs = normalizeStringArray(teacher.subject_names);
  if (subs.length) return subs.join(", ");
  return "—";
}

function formatAssignedClasses(value) {
  const classes = normalizeStringArray(value);
  if (!classes.length) return "—";
  return classes.join(", ");
}
