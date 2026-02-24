import logo from "../assets/logo.png";
import { NavLink } from "react-router-dom";
import { useState } from "react";
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
} from "react-icons/fi";

export default function Sidebar({ toggleTheme, darkMode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`
        ${expanded ? "w-60" : "w-20"}
        sticky top-0
        h-screen
        bg-white dark:bg-slate-950
        border-r border-gray-200 dark:border-white/10
        flex flex-col justify-between
        transition-[width] duration-200 ease-out
        overflow-hidden
      `}
    >
      {/* ================= TOP ================= */}
      <div>
        {/* LOGO */}
        <div className="p-4 flex items-center gap-3">
          <img
            src={logo}
            alt="Welljob Logo"
            draggable="false"
            className="h-9 object-contain select-none"
          />

          <span
            className={`
              text-lg font-semibold text-gray-900 dark:text-white
              whitespace-nowrap transition-all duration-150
              ${expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 absolute"}
            `}
          >
            HR System
          </span>
        </div>

        {/* NAVIGATION */}
        <nav className="mt-6 flex flex-col gap-1">
          <SidebarItem to="/" icon={<FiHome />} label="Dashboard" expanded={expanded} />
          <SidebarItem to="/employees" icon={<FiUsers />} label="Employee Records" expanded={expanded} />
          <SidebarItem to="/deployment" icon={<FiMapPin />} label="Deployment Tracking" expanded={expanded} />
          <SidebarItem to="/kpi" icon={<FiBarChart2 />} label="KPI & Reports" expanded={expanded} />
          <SidebarItem to="/incidents" icon={<FiAlertTriangle />} label="Incidents & Disciplinary" expanded={expanded} />
          <SidebarItem to="/notifications" icon={<FiBell />} label="Notifications" expanded={expanded} />
          <SidebarItem to="/users" icon={<FiSettings />} label="User Management" expanded={expanded} />
        </nav>
      </div>

      {/* ================= BOTTOM ================= */}
      <div className="p-4 border-t border-gray-200 dark:border-white/10 space-y-4">

        {/* THEME TOGGLE */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors duration-150"
        >
          <span
            className={`text-xl ${
              darkMode ? "text-yellow-400" : "text-slate-700 dark:text-gray-300"
            }`}
          >
            {darkMode ? <FiSun /> : <FiMoon />}
          </span>

          <span
            className={`
              text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap
              transition-all duration-150
              ${expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 absolute"}
            `}
          >
            {darkMode ? "Light Mode" : "Dark Mode"}
          </span>
        </button>

      </div>
    </aside>
  );
}

function SidebarItem({ to, icon, label, expanded }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        flex items-center gap-4 mx-3 p-3 rounded-lg
        transition-colors duration-150
        ${
          isActive
            ? "bg-indigo-600 text-white"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
        }
      `
      }
    >
      <span className="text-xl">{icon}</span>

      <span
        className={`
          text-sm font-medium whitespace-nowrap
          transition-all duration-150
          ${expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 absolute"}
        `}
      >
        {label}
      </span>
    </NavLink>
  );
}