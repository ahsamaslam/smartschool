import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/common/Input";
import Dropdown from "../../components/common/Dropdown";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import UserTable from "../../components/admin/UserTable";
import managerService from "../../services/managerService";
import toast from "react-hot-toast";

const ROLE_FILTER_OPTS = [
  { value: "", label: "All Roles" },
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

export default function ManagerSettings() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [schools, setSchools] = useState([]);
  const [branches, setBranches] = useState([]);
  const [savingUser, setSavingUser] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "teacher",
    school_id: user?.school_id || "",
    branch_id: "",
  });

  const isManager = user?.role === "manager";
  const roleOptions = [
    { value: "teacher", label: "Teacher" },
    { value: "student", label: "Student" },
    { value: "manager", label: "Manager" },
  ];
  const schoolOptions = useMemo(
    () => [
      { value: "", label: "Select school" },
      ...schools.map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [schools],
  );
  const branchOptions = useMemo(
    () => [
      { value: "", label: "No branch" },
      ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches],
  );

  const loadUsers = () => {
    setLoadingUsers(true);
    const params = {
      ...(isManager && user?.school_id ? { school_id: user.school_id } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
    };
    managerService
      .getUsers(params)
      .then((res) => setUsers(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {
        setUsers([]);
        toast.error("Failed to load users.");
      })
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    managerService
      .getSchools()
      .then((res) => setSchools(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setSchools([]));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  useEffect(() => {
    if (!showCreateModal) return;
    const sid = form.school_id || user?.school_id;
    if (!sid) {
      setBranches([]);
      return;
    }
    managerService
      .getSchoolBranches(sid)
      .then((res) => setBranches(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setBranches([]));
  }, [showCreateModal, form.school_id, user?.school_id]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatedCredentials(null);

    const schoolId = isManager ? user?.school_id : form.school_id;
    if (!schoolId) {
      toast.error("School is required.");
      return;
    }
    if (!form.full_name.trim()) {
      toast.error("Full name is required.");
      return;
    }

    setSavingUser(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        role: form.role,
        school_id: schoolId,
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.branch_id ? { branch_id: form.branch_id } : {}),
      };
      const res = await managerService.createUser(payload);
      setCreatedCredentials({
        email: res?.data?.user?.email,
        temporary_password: res?.data?.temporary_password,
      });
      toast.success("User created successfully.");
      setShowCreateModal(false);
      setForm((prev) => ({
        ...prev,
        full_name: "",
        email: "",
        role: "teacher",
        branch_id: "",
      }));
      loadUsers();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create user.");
    } finally {
      setSavingUser(false);
    }
  };

  const handleToggleActive = async (targetUser) => {
    const isSelf =
      String(targetUser.id) === String(user?.user_id || user?.id || "");
    if (isSelf) {
      toast.error("You cannot deactivate your own account.");
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
        await managerService.deactivateUser(targetUser.id);
        toast.success("User deactivated.");
      } else {
        await managerService.activateUser(targetUser.id);
        toast.success("User activated.");
      }
      loadUsers();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || `Failed to ${actionLabel} user.`,
      );
    }
  };

  const handleResetTemporaryPassword = async (targetUser) => {
    const ok = window.confirm(
      `Assign a new temporary password for ${targetUser.full_name}? They will be forced to reset on next login.`,
    );
    if (!ok) return;

    try {
      const res = await managerService.resetUserTemporaryPassword(
        targetUser.id,
      );
      const tempPassword = res?.data?.temporary_password;
      if (!tempPassword) {
        toast.error("Temporary password was not returned.");
        return;
      }
      setCreatedCredentials({
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button
          variant="primary"
          onClick={() => {
            setCreatedCredentials(null);
            setShowCreateModal(true);
          }}
        >
          + Create User
        </Button>
      </div>

      <div className="mb-4 max-w-xs">
        <Dropdown
          options={ROLE_FILTER_OPTS}
          value={roleFilter}
          onChange={setRoleFilter}
          placeholder="Filter by role..."
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loadingUsers ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Loading...
          </div>
        ) : (
          <UserTable
            users={users}
            onToggleActive={handleToggleActive}
            onResetTemporaryPassword={handleResetTemporaryPassword}
            currentUserId={user?.user_id || user?.id || null}
          />
        )}
      </div>

      {createdCredentials?.temporary_password && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm mt-4">
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

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create User"
      >
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={handleCreateUser}
        >
          <Input
            label="Full Name"
            value={form.full_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, full_name: e.target.value }))
            }
            required
          />
          <Input
            label="Email (optional)"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <Dropdown
              options={roleOptions}
              value={form.role}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, role: value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School
            </label>
            <Dropdown
              options={schoolOptions}
              value={isManager ? user?.school_id || "" : form.school_id}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  school_id: value,
                  branch_id: "",
                }))
              }
              disabled={isManager}
            />
          </div>
          {form.role === "teacher" && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch (optional)
              </label>
              <Dropdown
                options={branchOptions}
                value={form.branch_id}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, branch_id: value }))
                }
              />
            </div>
          )}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingUser}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
