import clsx from "clsx";
import { TrashIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-700",
  manager: "bg-purple-100 text-purple-700",
  teacher: "bg-blue-100 text-blue-700",
  student: "bg-green-100 text-green-700",
};

export default function UserTable({ users = [], onDeactivate, onEditRole }) {
  if (!users.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">No users found.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
            <th className="text-left py-3 px-4">Name</th>
            <th className="text-left py-3 px-4">Email</th>
            <th className="text-center py-3 px-4">Role</th>
            <th className="text-center py-3 px-4">Status</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-900">
                {u.full_name}
              </td>
              <td className="py-3 px-4 text-gray-500">{u.email}</td>
              <td className="py-3 px-4 text-center">
                <span
                  className={clsx(
                    "inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize",
                    ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600",
                  )}
                >
                  {u.role}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span
                  className={clsx(
                    "text-xs font-medium",
                    u.is_active ? "text-green-600" : "text-gray-400",
                  )}
                >
                  {u.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEditRole?.(u)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Change role"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  {u.is_active && (
                    <button
                      onClick={() => onDeactivate?.(u)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Deactivate user"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
