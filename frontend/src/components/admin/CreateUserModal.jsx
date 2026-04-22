import { useState } from "react";
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
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await adminService.createUser(form);
      toast.success("User created!");
      onCreated?.();
      onClose();
      setForm({ email: "", full_name: "", role: "student" });
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
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
          />
        </div>
        <Button type="submit" variant="primary" fullWidth loading={creating}>
          Create User
        </Button>
      </form>
    </Modal>
  );
}
