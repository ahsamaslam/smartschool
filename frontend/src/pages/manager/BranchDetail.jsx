import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import managerService from "../../services/managerService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import {
  UsersIcon,
  AcademicCapIcon,
  BookOpenIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

export default function BranchDetail() {
  const { schoolId, branchId } = useParams();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    managerService
      .getBranchOverview(branchId)
      .then((res) => setOverview(res.data))
      .catch(() => setError("Failed to load branch overview."))
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return <PageSpinner />;

  const stats = overview?.statistics || {};
  const classes = overview?.classes || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Branch Overview</h1>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Stat
          icon={<AcademicCapIcon className="h-5 w-5 text-blue-600" />}
          label="Classes"
          value={stats.total_classes || 0}
        />
        <Stat
          icon={<UsersIcon className="h-5 w-5 text-green-600" />}
          label="Students"
          value={stats.total_students || 0}
        />
        <Stat
          icon={<UserIcon className="h-5 w-5 text-indigo-600" />}
          label="Teachers"
          value={stats.total_teachers || 0}
        />
        <Stat
          icon={<BookOpenIcon className="h-5 w-5 text-purple-600" />}
          label="Subjects"
          value={stats.total_subjects || 0}
        />
      </div>

      {/* Classes table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Classes
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left py-3 px-4">Class</th>
                <th className="text-left py-3 px-4">Grade</th>
                <th className="text-left py-3 px-4">Teacher</th>
                <th className="text-center py-3 px-4">Students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {c.name}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{c.grade_level}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {c.teacher_name || "—"}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-700">
                    {c.student_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {classes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No classes in this branch.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}
