import { NavLink, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import { XMarkIcon } from "@heroicons/react/24/outline";
import * as HeroIcons from "@heroicons/react/24/outline";

/**
 * Role-aware collapsible sidebar.
 *
 * @param {string}    role
 * @param {boolean}   isOpen
 * @param {() => void} onClose
 */
export default function Sidebar({ role, isOpen, onClose }) {
  const navItems = NAV_BY_ROLE[role] || [];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-30 w-60 flex flex-col bg-white border-r border-gray-200 shadow-lg",
          "transition-transform duration-200",
          // Mobile: slide in/out; Desktop: always visible
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0 md:shadow-none md:z-auto",
        )}
      >
        {/* Mobile close */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 md:hidden">
          <span className="font-semibold text-gray-900">Menu</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ label, to, icon: iconName }) => {
            const Icon =
              HeroIcons[iconName] || HeroIcons.QuestionMarkCircleIcon;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* Version footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">Smart School v1.0</p>
        </div>
      </aside>
    </>
  );
}

// ── Nav config per role ───────────────────────────────────────────────────────
const NAV_BY_ROLE = {
  student: [
    { label: "Dashboard", to: "/student/dashboard", icon: "HomeIcon" },
    { label: "Profile", to: "/student/profile", icon: "UserCircleIcon" },
  ],
  teacher: [
    { label: "Dashboard", to: "/teacher/dashboard", icon: "HomeIcon" },
    { label: "My Classes", to: "/teacher/classes", icon: "AcademicCapIcon" },
    {
      label: "Attendance",
      to: "/teacher/attendance",
      icon: "ClipboardDocumentListIcon",
    },
    {
      label: "Publish Video",
      to: "/teacher/publish-video",
      icon: "VideoCameraIcon",
    },
    {
      label: "My Avatar Videos",
      to: "/teacher/avatar-videos",
      icon: "UserCircleIcon",
    },
    {
      label: "Lecture Viewer",
      to: "/teacher/lecture-viewer",
      icon: "PlayCircleIcon",
    },
    {
      label: "Generate Exam",
      to: "/teacher/generate-exam",
      icon: "DocumentTextIcon",
    },
    { label: "Reports", to: "/teacher/reports", icon: "ChartBarIcon" },
  ],
  manager: [
    { label: "Dashboard", to: "/manager/dashboard", icon: "HomeIcon" },
    { label: "Schools", to: "/manager/schools", icon: "BuildingOfficeIcon" },
    {
      label: "Student Reports",
      to: "/manager/student-reports",
      icon: "UserGroupIcon",
    },
    {
      label: "Class Reports",
      to: "/manager/class-reports",
      icon: "AcademicCapIcon",
    },
    {
      label: "Teacher Reports",
      to: "/manager/teacher-reports",
      icon: "ChartBarIcon",
    },
  ],
  admin: [
    { label: "Dashboard", to: "/admin/dashboard", icon: "HomeIcon" },
    { label: "Users", to: "/admin/users", icon: "UsersIcon" },
    { label: "Schools", to: "/admin/schools", icon: "BuildingOfficeIcon" },
    { label: "Curriculum", to: "/admin/curriculum", icon: "BookOpenIcon" },
    { label: "Videos", to: "/admin/videos", icon: "VideoCameraIcon" },
    { label: "Settings", to: "/admin/settings", icon: "CogIcon" },
  ],
};
