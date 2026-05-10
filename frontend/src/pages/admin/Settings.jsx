import ModelTrainer from "../../components/admin/ModelTrainer";
import { CpuChipIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { UsersIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

export default function AdminSettings() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        System configuration and AI management.
      </p>

      <div className="space-y-6">
        {/* AI Model Training */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CpuChipIcon className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              AI Model
            </h2>
          </div>
          <ModelTrainer />
        </section>

        {/* System Info */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Cog6ToothIcon className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              System Info
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-sm">
            <InfoRow label="AI Provider" value="Anthropic Claude" />
            <InfoRow label="QA Model" value="claude-sonnet-4-20250514" />
            <InfoRow label="Exam Model" value="claude-sonnet-4-20250514" />
            <InfoRow label="Grading Model" value="claude-haiku-4-20250514" />
            <InfoRow label="Cache" value="Redis (Upstash)" />
            <InfoRow label="Database" value="PostgreSQL (Supabase)" />
          </div>
        </section>

        {/* User Management */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <UsersIcon className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              User Management
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-sm">
            <p className="text-gray-500 mb-4">
              Manage all users from Settings instead of the sidebar.
            </p>
            <Link
              to="/admin/users"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Open Users
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 font-mono text-xs">
        {value}
      </span>
    </div>
  );
}
