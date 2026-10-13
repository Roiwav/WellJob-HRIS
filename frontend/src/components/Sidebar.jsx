
import { NavLink } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiClipboard,
  FiFileText,
  FiHome,
  FiMapPin,
  FiMoon,
  FiShield,
  FiSliders,
  FiSun,
  FiTool,
  FiUsers,
} from "react-icons/fi";

import logo from "../assets/Logo.png";
import { sidebarItems } from "../config/sidebarItems";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/useAuth";

// Sidebar icons.
// Supports both original and updated navigation titles.
const iconMap = {
  Dashboard: <FiHome />,
  Employees: <FiUsers />,
  Attendance: <FiClipboard />,
  Deployments: <FiMapPin />,
  Deployed: <FiMapPin />,
  "KPI Reports": <FiBarChart2 />,
  Incidents: <FiAlertTriangle />,
  Notifications: <FiBell />,
  "User Management": <FiUsers />,
  "Super Admin Portal": <FiShield />,
  "System Configuration": <FiSliders />,
  Administration: <FiSliders />,
  "Technical Audit": <FiShield />,
  "Operational Audit": <FiFileText />,
};

// Display-only navigation labels.
// Original paths, permissions, and module behavior remain unchanged.
const sidebarDisplayLabels = {
  Deployments: "Deployed",
  "System Configuration": "Administration",
};

const getSidebarLabel = (title) => {
  return sidebarDisplayLabels[title] || title;
};

export default function Sidebar({ toggleTheme, darkMode }) {
  const { user } = useAuth();
  const userRole = user?.role;

  const filteredItems = userRole
    ? sidebarItems.filter((item) =>
        item.allowedRoles.includes(userRole)
      )
    : [];

  return (
    <aside
      className="
        group/sidebar relative z-50 flex h-screen w-16 shrink-0
        flex-col justify-between overflow-hidden border-r border-gray-200
        bg-white transition-[width] duration-200 ease-out hover:w-48
        dark:border-white/10 dark:bg-slate-950
      "
    >
      <div className="min-w-0">
        {/* Logo and system name */}
        <div className="flex h-16 items-center justify-center px-3 transition-all duration-200 group-hover/sidebar:justify-start group-hover/sidebar:gap-3">
          <img
            src={logo}
            alt="Welljob Logo"
            draggable="false"
            className="h-8 shrink-0 select-none object-contain"
          />

          <span
            className="
              pointer-events-none absolute -translate-x-2 whitespace-nowrap
              text-lg font-semibold text-gray-900 opacity-0 transition-all
              duration-150 group-hover/sidebar:relative
              group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100
              dark:text-white
            "
          >
            HR System
          </span>
        </div>

        {/* Main navigation */}
        <nav
          className="mt-5 flex flex-col gap-1"
          aria-label="Main navigation"
        >
          {filteredItems.map((item) => (
            <SidebarItem
              key={item.path}
              to={item.path}
              icon={iconMap[item.title] || <FiHome />}
              label={getSidebarLabel(item.title)}
            />
          ))}

          {/* IT Support navigation */}
          {userRole === ROLES.IT_SUPPORT && (
            <SidebarItem
              to="/system-maintenance"
              icon={<FiTool className="text-red-500" />}
              label="System Maintenance"
            />
          )}
        </nav>
      </div>

      {/* Theme toggle */}
      <div className="border-t border-gray-200 p-3 dark:border-white/10">
        <button
          type="button"
          onClick={toggleTheme}
          className="
            flex w-full items-center justify-center gap-0 rounded-lg p-3
            transition-colors duration-150 hover:bg-gray-200
            group-hover/sidebar:justify-start group-hover/sidebar:gap-3
            dark:hover:bg-white/10
          "
          aria-label={
            darkMode
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
        >
          <span
            className={`shrink-0 text-xl ${
              darkMode
                ? "text-yellow-400"
                : "text-slate-700 dark:text-gray-300"
            }`}
          >
            {darkMode ? <FiSun /> : <FiMoon />}
          </span>

          <span
            className="
              pointer-events-none absolute -translate-x-2 whitespace-nowrap
              text-sm font-medium text-gray-900 opacity-0 transition-all
              duration-150 group-hover/sidebar:relative
              group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100
              dark:text-white
            "
          >
            {darkMode ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `
          mx-2 flex items-center justify-center gap-0 rounded-lg p-3
          transition-colors duration-150 group-hover/sidebar:justify-start
          group-hover/sidebar:gap-4
          ${
            isActive
              ? "bg-indigo-600 text-white"
              : "text-gray-600 hover:bg-gray-200 hover:text-black dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          }
        `
      }
    >
      <span className="shrink-0 text-xl">{icon}</span>

      <span
        className="
          pointer-events-none absolute -translate-x-2 whitespace-nowrap
          text-sm font-medium opacity-0 transition-all duration-150
          group-hover/sidebar:relative group-hover/sidebar:translate-x-0
          group-hover/sidebar:opacity-100
        "
      >
        {label}
      </span>
    </NavLink>
  );
}
