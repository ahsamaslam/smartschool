import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import adminService from "../../services/adminService";
import UserTable from "../../components/admin/UserTable";
import CreateUserModal from "../../components/admin/CreateUserModal";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Dropdown from "../../components/common/Dropdown";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";

const ROLE_OPTS = [
  { value: "", label: "All Roles" },
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const ROLE_OPT2 = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

export default function AdminUsers() {
  const [searchParams] = useSearchParams();
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState("student");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminService
      .getUsers(roleFilter || undefined)
      .then((res) => setUsers(res.data || []))
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [roleFilter]);

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Deactivate ${user.full_name}?`)) return;
    try {
      await adminService.deactivateUser(user.id);
      toast.success("User deactivated.");
      load();
    } catch {
      toast.error("Failed to deactivate user.");
    }
  };

  const handleEditRole = (user) => {
    setEditingUser(user);
    setNewRole(user.role);
  };

  const handleSaveRole = async () => {
    setSaving(true);
    try {
      await adminService.assignRole(editingUser.id, newRole);
      toast.success("Role updated!");
      setEditingUser(null);
      load();
    } catch {
      toast.error("Failed to update role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          + Create User
        </Button>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="mb-4 max-w-xs">
        <Dropdown
          options={ROLE_OPTS}
          value={roleFilter}
          onChange={setRoleFilter}
          placeholder="Filter by role…"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Loading…
          </div>
        ) : (
          <UserTable
            users={users}
            onDeactivate={handleDeactivate}
            onEditRole={handleEditRole}
          />
        )}
      </div>

      <CreateUserModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
      />

      {/* Edit role modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Change Role"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Changing role for <strong>{editingUser?.full_name}</strong>
          </p>
          <Dropdown options={ROLE_OPT2} value={newRole} onChange={setNewRole} />
          <Button
            variant="primary"
            fullWidth
            onClick={handleSaveRole}
            loading={saving}
          >
            Save Role
          </Button>
        </div>
      </Modal>
    </div>
  );
}
