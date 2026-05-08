import logo from "../assets/logo.png";
import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import {
  FiHome,
  FiUsers,
  FiMapPin,
  FiBarChart2,
  FiAlertTriangle,
  FiBell,
  FiSettings,
  FiSun,
  FiMoon,
  FiShield,
  FiFileText,
  FiTool, // --- NEW: Icon for Maintenance ---
} from "react-icons/fi";
import { sidebarItems } from "../config/sidebarItems";
import { useAuth } from "../context/useAuth";
import { ROLES } from "../constants/roles"; // --- NEW: Import ROLES ---

const iconMap = {
  Dashboard: <FiHome />,
  Employees: <FiUsers />,
  Deployments: <FiMapPin />,
  "KPI Reports": <FiBarChart2 />,
  Incidents: <FiAlertTriangle />,
  Notifications: <FiBell />,
  "User Management": <FiUsers />,
  "Super Admin Portal": <FiShield />,
  "System Configuration": <FiSettings />,
  "Technical Audit": <FiShield />,
  "Operational Audit": <FiFileText />,
};

export default function Sidebar({ toggleTheme, darkMode }) {
  const { user } = useAuth();

  const filteredItems = useMemo(() => {
    if (!user?.role) return [];
    return sidebarItems.filter((item) => item.allowedRoles.includes(user.role));
  }, [user]);

  return (
    <aside
      className="
        group/sidebar relative z-50 h-screen w-16 shrink-0
        overflow-hidden border-r border-gray-200 bg-white
        transition-[width] duration-200 ease-out hover:w-48
        dark:border-white/10 dark:bg-slate-950
        flex flex-col justify-between
      "
    >
      <div className="min-w-0">
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
              text-lg font-semibold text-gray-900 opacity-0
              transition-all duration-150 dark:text-white
              group-hover/sidebar:relative group-hover/sidebar:translate-x-0
              group-hover/sidebar:opacity-100
            "
          >
            HR System
          </span>
        </div>

        <nav className="mt-5 flex flex-col gap-1">
          {/* Default dynamically mapped items */}
          {filteredItems.map((item) => (
            <SidebarItem
              key={item.path}
              to={item.path}
              icon={iconMap[item.title] || <FiHome />}
              label={item.title}
            />
          ))}

          {/* --- NEW: SYSTEM MAINTENANCE LINK (IT SUPPORT ONLY) --- */}
          {user?.role === ROLES.IT_SUPPORT && (
            <SidebarItem
              to="/system-maintenance"
              icon={<FiTool className="text-red-500" />} // Gumamit tayo ng FiTool na may kulay red
              label="System Maintenance"
            />
          )}
        </nav>
      </div>

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
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span
            className={`shrink-0 text-xl ${
              darkMode ? "text-yellow-400" : "text-slate-700 dark:text-gray-300"
            }`}
          >
            {darkMode ? <FiSun /> : <FiMoon />}
          </span>

          <span
            className="
              pointer-events-none absolute -translate-x-2 whitespace-nowrap
              text-sm font-medium text-gray-900 opacity-0
              transition-all duration-150 dark:text-white
              group-hover/sidebar:relative group-hover/sidebar:translate-x-0
              group-hover/sidebar:opacity-100
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
          pointer-events-none absolute 
          -translate-x-2 whitespace-nowrap
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