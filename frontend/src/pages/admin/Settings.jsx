import ModelTrainer from "../../components/admin/ModelTrainer";
import { CpuChipIcon } from "@heroicons/react/24/outline";
import { UsersIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminSettings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        {isSuperAdmin
          ? "System configuration and AI management."
          : "Tenant user settings and management."}
      </p>

      <div className="space-y-6">
        {isSuperAdmin && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CpuChipIcon className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                AI Model
              </h2>
            </div>
            <ModelTrainer />
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <UsersIcon className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              User Management
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-sm">
            <p className="text-gray-500 mb-4">
              {isSuperAdmin
                ? "Manage all users from Settings instead of the sidebar."
                : "Manage users in your tenant only."}
            </p>
            <Link
              to="/admin/users"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {isSuperAdmin ? "Open Users" : "Open Tenant Users"}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
