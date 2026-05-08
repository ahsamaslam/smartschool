import { useEffect, useState } from "react";
import managerService from "../../services/managerService";
import SchoolCard from "../../components/manager/SchoolCard";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function ManagerSchools() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    managerService
      .getSchools()
      .then((res) => setSchools(res.data || []))
      .catch(() => setError("Failed to load schools."))
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const filtered = schools.filter((s) => {
    const name = String(s?.name ?? "");
    const addr = String(s?.address ?? "");
    return name.toLowerCase().includes(q) || addr.toLowerCase().includes(q);
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Schools</h1>
      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search schools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          {schools.length === 0
            ? "No schools found."
            : "No schools match your search."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SchoolCard key={s.id} school={s} />
          ))}
        </div>
      )}
    </div>
  );
}
