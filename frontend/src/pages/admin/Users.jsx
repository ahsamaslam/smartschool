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
import { useAuth } from "../../context/AuthContext";

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
  const { user } = useAuth();
  const currentUserId = user?.user_id || user?.id || null;
  const isSuperAdmin = user?.role === "super_admin";
  const canHardDelete = ["admin", "super_admin"].includes(user?.role);
  const [searchParams] = useSearchParams();
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState("student");
  const [saving, setSaving] = useState(false);
  const [schools, setSchools] = useState([]);
  const [editingSchoolUser, setEditingSchoolUser] = useState(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [savingSchool, setSavingSchool] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState(null);

  const load = () => {
    setLoading(true);
    adminService
      .getUsers(roleFilter || undefined)
      .then((res) => setUsers(res.data || []))
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [roleFilter]);

  useEffect(() => {
    adminService
      .getSchools()
      .then((res) => setSchools(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setSchools([]));
  }, []);

  const handleToggleActive = async (targetUser) => {
    if (currentUserId && String(targetUser.id) === String(currentUserId)) {
      toast.error("You cannot disable or enable your own account.");
      return;
    }
    const actionLabel = targetUser.is_active ? "deactivate" : "activate";
    if (
      !window.confirm(
        `${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} ${targetUser.full_name}?`,
      )
    ) {
      return;
    }
    try {
      if (targetUser.is_active) {
        await adminService.deactivateUser(targetUser.id);
        toast.success("User deactivated.");
      } else {
        await adminService.activateUser(targetUser.id);
        toast.success("User activated.");
      }
      load();
    } catch {
      toast.error(`Failed to ${actionLabel} user.`);
    }
  };

  const handleHardDelete = async (targetUser) => {
    if (!canHardDelete) return;
    if (currentUserId && String(targetUser.id) === String(currentUserId)) {
      toast.error("You cannot delete your own account.");
      return;
    }
    const ok = window.confirm(
      `Permanently delete ${targetUser.full_name}? This cannot be undone.`,
    );
    if (!ok) return;
    try {
      await adminService.hardDeleteUser(targetUser.id);
      toast.success("User permanently deleted.");
      load();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Failed to delete user permanently.",
      );
    }
  };

  const handleEditRole = (user) => {
    setEditingUser(user);
    setNewRole(user.role);
  };

  const handleEditSchool = (user) => {
    setEditingSchoolUser(user);
    setSelectedSchoolId(user?.school_id ? String(user.school_id) : "");
  };

  const handleResetTemporaryPassword = async (targetUser) => {
    const ok = window.confirm(
      `Assign a new temporary password for ${targetUser.full_name}? They will be forced to reset on next login.`,
    );
    if (!ok) return;
    try {
      const res = await adminService.resetUserTemporaryPassword(targetUser.id);
      const tempPassword = res?.data?.temporary_password;
      if (!tempPassword) {
        toast.error("Temporary password was not returned.");
        return;
      }
      setTempPasswordResult({
        full_name: targetUser.full_name,
        email: targetUser.email,
        temporary_password: tempPassword,
      });
      toast.success("Temporary password assigned.");
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Failed to assign temporary password.",
      );
    }
  };

  const handleSaveSchool = async () => {
    if (!editingSchoolUser) return;
    setSavingSchool(true);
    try {
      await adminService.updateUser(editingSchoolUser.id, {
        school_id: selectedSchoolId || null,
        branch_id: null,
      });
      toast.success("School updated!");
      setEditingSchoolUser(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update school.");
    } finally {
      setSavingSchool(false);
    }
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
            onToggleActive={handleToggleActive}
            onEditRole={handleEditRole}
            onEditSchool={handleEditSchool}
            onResetTemporaryPassword={handleResetTemporaryPassword}
            onHardDelete={canHardDelete ? handleHardDelete : undefined}
            canHardDelete={canHardDelete}
            showTenantColumn={isSuperAdmin}
            currentUserId={currentUserId}
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

      <Modal
        isOpen={!!editingSchoolUser}
        onClose={() => setEditingSchoolUser(null)}
        title="Switch School"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Update school for <strong>{editingSchoolUser?.full_name}</strong>
          </p>
          <Dropdown
            options={[
              { value: "", label: "No school" },
              ...schools.map((s) => ({ value: String(s.id), label: s.name })),
            ]}
            value={selectedSchoolId}
            onChange={setSelectedSchoolId}
          />
          <Button
            variant="primary"
            fullWidth
            onClick={handleSaveSchool}
            loading={savingSchool}
          >
            Save School
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!tempPasswordResult}
        onClose={() => setTempPasswordResult(null)}
        title="Temporary Password"
      >
        <div className="space-y-3 text-sm">
          <p className="text-gray-700">
            Temporary password generated for{" "}
            <strong>{tempPasswordResult?.full_name}</strong>.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-amber-900">Email: {tempPasswordResult?.email}</p>
            <p className="text-amber-900 font-semibold">
              Password: {tempPasswordResult?.temporary_password}
            </p>
          </div>
          <p className="text-amber-700">
            User must reset this password at next login.
          </p>
        </div>
      </Modal>
    </div>
  );
}
