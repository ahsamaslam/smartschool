import { Link } from "react-router-dom";
import { BuildingOfficeIcon } from "@heroicons/react/24/outline";

export default function SchoolCard({ school }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <BuildingOfficeIcon className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {school.name}
          </h3>
          {school.address && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {school.address}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-6 text-xs text-gray-500 mb-4">
        <span>{school.branch_count ?? 0} branches</span>
        <span>{school.class_count ?? 0} classes</span>
      </div>
      <Link
        to={`/manager/schools/${school.id}`}
        state={{ schoolName: school.name }}
        className="block w-full text-center text-sm font-medium text-blue-600 border border-blue-200 rounded-xl py-2 hover:bg-blue-50 transition-colors"
      >
        View Branches
      </Link>
    </div>
  );
}
