import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import adminService from "../../services/adminService";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

export default function Tenants() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showCreds, setShowCreds] = useState(null);

  const [form, setForm] = useState({
    name: "",
    admin_full_name: "",
    admin_email: "",
  });

  const loadTenants = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getTenants();
      setTenants(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to load tenants.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const tenantCount = tenants.length;
  const activeCount = useMemo(
    () => tenants.filter((t) => t.is_active).length,
    [tenants],
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.admin_full_name.trim() ||
      !form.admin_email.trim()
    ) {
      toast.error("All fields are required.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        admin_full_name: form.admin_full_name.trim(),
        admin_email: form.admin_email.trim().toLowerCase(),
      };
      const { data } = await adminService.createTenant(payload);

      setForm({ name: "", admin_full_name: "", admin_email: "" });
      setShowCreds(data?.default_admin || null);
      toast.success("Tenant created.");
      await loadTenants();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to create tenant.";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (tenant) => {
    const intent = tenant.is_active ? "deactivate" : "activate";
    const proceed = window.confirm(
      intent === "deactivate"
        ? `Deactivate tenant "${tenant.name}" and deactivate all its users?`
        : `Activate tenant "${tenant.name}"?`,
    );
    if (!proceed) return;

    setSavingId(tenant.id);
    try {
      const { data } = await adminService.updateTenant(tenant.id, {
        is_active: !tenant.is_active,
      });
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id ? { ...t, is_active: !tenant.is_active } : t,
        ),
      );
      if (tenant.is_active) {
        const affected = data?.affected_users || 0;
        toast.success(`Tenant deactivated. ${affected} user(s) deactivated.`);
      } else {
        toast.success("Tenant activated.");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to update tenant.";
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteTenant = async (tenant) => {
    const proceed = window.confirm(
      `Delete tenant "${tenant.name}"? This will deactivate related users and remove the tenant record.`,
    );
    if (!proceed) return;

    setDeletingId(tenant.id);
    try {
      const { data } = await adminService.deleteTenant(tenant.id);
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
      const affected = data?.affected_users || 0;
      toast.success(`Tenant deleted. ${affected} related user(s) deactivated.`);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to delete tenant.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <p className="text-sm text-gray-600 mt-1">
          Create and manage isolated tenant workspaces for schools.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Total tenants
          </p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {tenantCount}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Active tenants
          </p>
          <p className="text-2xl font-semibold text-emerald-700 mt-1">
            {activeCount}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Create Tenant
        </h2>

        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Input
            label="Tenant Name"
            value={form.name}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            required
          />
          <Input
            label="Default Admin Name"
            value={form.admin_full_name}
            onChange={(e) =>
              setForm((v) => ({ ...v, admin_full_name: e.target.value }))
            }
            required
          />
          <div className="md:col-span-2">
            <Input
              label="Default Admin Email"
              type="email"
              value={form.admin_email}
              onChange={(e) =>
                setForm((v) => ({ ...v, admin_email: e.target.value }))
              }
              required
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" loading={creating}>
              Create Tenant
            </Button>
          </div>
        </form>

        {showCreds && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Default admin credentials
            </p>
            <p className="text-sm text-amber-800 mt-2">
              Email: {showCreds.email}
            </p>
            <p className="text-sm text-amber-800">
              Temporary Password: {showCreds.temporary_password}
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Share securely. The admin will be forced to change password at
              first login.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">All Tenants</h2>
          <Button variant="secondary" onClick={loadTenants} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">
                  Name
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">
                  Schools
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">
                  Admins
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">
                  Created
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">
                  Status
                </th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-6 py-5 text-gray-500" colSpan={6}>
                    Loading tenants...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td className="px-6 py-5 text-gray-500" colSpan={6}>
                    No tenants found.
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-t border-gray-100">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {tenant.name}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {tenant.school_count || 0}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {tenant.admin_count || 0}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {fmtDate(tenant.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          tenant.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {tenant.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant={tenant.is_active ? "danger" : "primary"}
                          onClick={() => handleToggleActive(tenant)}
                          loading={savingId === tenant.id}
                        >
                          {tenant.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleDeleteTenant(tenant)}
                          loading={deletingId === tenant.id}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
