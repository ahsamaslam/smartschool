import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import managerService from "../../services/managerService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import {
  MagnifyingGlassIcon,
  BuildingStorefrontIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

export default function SchoolBranches() {
  const { schoolId } = useParams();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  const [branches, setBranches] = useState([]);
  const [schoolName, setSchoolName] = useState(
    location.state?.schoolName || "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    managerService
      .getSchoolBranches(schoolId)
      .then((res) => setBranches(res.data || []))
      .catch(() => setError("Failed to load branches."))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const filtered = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.address || "").toLowerCase().includes(search.toLowerCase()),
  );

  const backPath = isAdmin ? "/admin/schools" : "/manager/schools";

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to={backPath}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          {schoolName && (
            <p className="text-sm text-gray-500 mt-0.5">{schoolName}</p>
          )}
        </div>
        <span className="ml-auto text-sm text-gray-400">
          {branches.length} {branches.length === 1 ? "branch" : "branches"}{" "}
          total
        </span>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search branches…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          {branches.length === 0
            ? "No branches found for this school."
            : "No branches match your search."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <BuildingStorefrontIcon className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {b.name}
                  </h3>
                  {b.address && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {b.address}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-6 text-xs text-gray-500 mb-4">
                <span>{b.class_count ?? 0} classes</span>
                <span>{b.student_count ?? 0} students</span>
              </div>

              <Link
                to={`/manager/schools/${schoolId}/branches/${b.id}`}
                className="block w-full text-center text-sm font-medium text-blue-600 border border-blue-200 rounded-xl py-2 hover:bg-blue-50 transition-colors"
              >
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
