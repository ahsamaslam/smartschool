import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import managerService from "../../services/managerService";
import SchoolCard from "../../components/manager/SchoolCard";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import {
  BuildingOffice2Icon,
  UsersIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

export default function ManagerDashboard() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    managerService
      .getSchools()
      .then((res) => setSchools(res.data || []))
      .catch(() => setError("Failed to load schools."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  const totalSchools = schools.length;
  const totalBranches = schools.reduce((s, x) => s + (x.branch_count || 0), 0);
  const totalClasses = schools.reduce((s, x) => s + (x.class_count || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Manager Dashboard
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Overview of all schools and branches.
      </p>

      {error && <Alert type="error" message={error} className="mb-6" />}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<BuildingOffice2Icon className="h-6 w-6 text-blue-600" />}
          label="Schools"
          value={totalSchools}
        />
        <StatCard
          icon={<BuildingOffice2Icon className="h-6 w-6 text-indigo-600" />}
          label="Branches"
          value={totalBranches}
        />
        <StatCard
          icon={<AcademicCapIcon className="h-6 w-6 text-green-600" />}
          label="Classes"
          value={totalClasses}
        />
      </div>

      {/* Quick links */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <QuickLink to="/manager/student-reports" label="Student Reports" />
        <QuickLink to="/manager/class-reports" label="Class Reports" />
        <QuickLink to="/manager/teacher-reports" label="Teacher Reports" />
      </div>

      <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
        Schools
      </h2>
      {schools.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          No schools found.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((s) => (
            <SchoolCard key={s.id} school={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link
      to={to}
      className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
    >
      {label} →
    </Link>
  );
}
