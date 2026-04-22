import { Bars3Icon } from "@heroicons/react/24/outline";
import { clsx } from "clsx";
import Navbar from "../common/Navbar";

const PORTAL_NAMES = {
  student: "Smart School — Student",
  teacher: "Smart School — Teacher",
  manager: "Smart School — Manager",
  admin: "Smart School — Admin",
};

/**
 * Sticky top header bar.
 *
 * @param {string}    role      Current user role (for portal title).
 * @param {boolean}   sidebarOpen
 * @param {() => void} onToggleSidebar
 */
export default function Header({ role, sidebarOpen, onToggleSidebar }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 shadow-sm">
      {/* Left — hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          {/* Logo mark */}
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm hidden sm:block">
            {PORTAL_NAMES[role] || "Smart School"}
          </span>
        </div>
      </div>

      {/* Right — user dropdown */}
      <Navbar />
    </header>
  );
}
