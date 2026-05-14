import { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Input from "../common/Input";
import Dropdown from "../common/Dropdown";
import Button from "../common/Button";
import adminService from "../../services/adminService";
import toast from "react-hot-toast";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

export default function CreateUserModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "student",
    school_id: "",
  });
  const [schools, setSchools] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const schoolOptions = useMemo(
    () => [
      { value: "", label: "Select school" },
      ...schools.map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [schools],
  );

  useEffect(() => {
    if (!isOpen) return;
    setCreatedCredentials(null);
    adminService
      .getSchools()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setSchools(list);
      })
      .catch(() => setSchools([]));
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      ["student", "teacher", "manager"].includes(form.role) &&
      !form.school_id
    ) {
      toast.error("School is required for this role.");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        ...(form.school_id ? { school_id: form.school_id } : {}),
      };
      const res = await adminService.createUser(payload);
      const tempPassword = res?.data?.temporary_password;
      toast.success("User created!");
      setCreatedCredentials({
        email: payload.email,
        full_name: payload.full_name,
        temporary_password: tempPassword,
      });
      onCreated?.();
      setForm({ email: "", full_name: "", role: "student", school_id: "" });
    } catch {
      toast.error("Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          value={form.full_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, full_name: e.target.value }))
          }
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <Dropdown
            options={ROLES}
            value={form.role}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                role: v,
                school_id: ["student", "teacher", "manager"].includes(v)
                  ? f.school_id
                  : "",
              }))
            }
          />
        </div>
        {["student", "teacher", "manager"].includes(form.role) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School
            </label>
            <Dropdown
              options={schoolOptions}
              value={form.school_id}
              onChange={(v) => setForm((f) => ({ ...f, school_id: v }))}
            />
          </div>
        )}
        <Button type="submit" variant="primary" fullWidth loading={creating}>
          Create User
        </Button>

        {createdCredentials?.temporary_password && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-semibold text-amber-900">
              Temporary password generated
            </p>
            <p className="text-amber-800 mt-1">
              Email: {createdCredentials.email}
            </p>
            <p className="text-amber-800">
              Password: {createdCredentials.temporary_password}
            </p>
            <p className="text-amber-700 mt-2">
              User will be forced to reset password on first login.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
