import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import {
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { useAuth } from "../../context/AuthContext";
import { getInitials } from "../../utils/helpers";
import { capitalise } from "../../utils/helpers";

const ROLE_LABELS = {
  student: "Student",
  teacher: "Teacher",
  manager: "Manager",
  admin: "Admin",
};

/**
 * Top-right user avatar dropdown in the navbar.
 */
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (!user) return null;

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
        {user.profile_picture_url ? (
          <img
            src={user.profile_picture_url}
            alt={user.full_name}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
          />
        ) : (
          <span className="h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">
            {getInitials(user.full_name)}
          </span>
        )}
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
            {user.full_name}
          </span>
          <span className="text-xs text-gray-500">
            {ROLE_LABELS[user.role] || capitalise(user.role)}
          </span>
        </div>
        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-52 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-30 py-1">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>

          <Menu.Item>
            {({ active }) => (
              <button
                onClick={() => navigate(`/${user.role}/profile`)}
                className={clsx(
                  "flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700",
                  active && "bg-gray-50",
                )}
              >
                <UserCircleIcon className="h-4 w-4 text-gray-400" />
                My Profile
              </button>
            )}
          </Menu.Item>

          <Menu.Item>
            {({ active }) => (
              <button
                onClick={handleLogout}
                className={clsx(
                  "flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600",
                  active && "bg-red-50",
                )}
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Sign Out
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
