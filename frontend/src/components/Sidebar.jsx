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
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`
        ${expanded ? "w-64" : "w-20"}
        bg-white dark:bg-slate-950
        border-r border-gray-200 dark:border-white/10
        h-screen
        flex flex-col
        justify-between
        transition-all duration-300
      `}
    >
      {/* LOGO */}
      <div>
        <div className="p-4 flex items-center gap-3">
          <div className="flex items-center justify-center">
  <img
    src={logo}
    alt="Welljob Logo"
    className={`
      ${expanded ? "h-10" : "h-8"}
      object-contain
      transition-all duration-300
      select-none
    `}
    draggable="false"
  />
</div>
          {expanded && (
            <span className="font-semibold text-gray-900 dark:text-white text-lg">
              HR System
            </span>
          )}
        </div>

        {/* MENU */}
        <nav className="mt-6 flex flex-col gap-2">
          <SidebarItem to="/" icon={<FiHome />} label="Dashboard" expanded={expanded} />
          <SidebarItem to="/employees" icon={<FiUsers />} label="Employee Records" expanded={expanded} />
          <SidebarItem to="/deployment" icon={<FiMapPin />} label="Deployment Tracking" expanded={expanded} />
          <SidebarItem to="/kpi" icon={<FiBarChart2 />} label="KPI & Reports" expanded={expanded} />
          <SidebarItem to="/incidents" icon={<FiAlertTriangle />} label="Incidents & Disciplinary" expanded={expanded} />
          <SidebarItem to="/notifications" icon={<FiBell />} label="Notifications" expanded={expanded} />
          <SidebarItem to="/users" icon={<FiSettings />} label="User Management" expanded={expanded} />
        </nav>
      </div>

      {/* BOTTOM SECTION */}
      <div className="p-4 border-t border-gray-200 dark:border-white/10">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full hover:bg-gray-200 dark:hover:bg-white/10 p-2 rounded-lg transition"
        >
          {darkMode ? <FiSun /> : <FiMoon />}
          {expanded && (
            <span className="text-gray-900 dark:text-white">
              {darkMode ? "Light Mode" : "Dark Mode"}
            </span>
          )}
        </button>

        {expanded && (
          <div className="mt-4 flex items-center gap-3 bg-gray-100 dark:bg-white/5 p-3 rounded-xl">
            <div className="bg-indigo-500 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold">
              A
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Admin User
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                HR Manager
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ to, icon, label, expanded }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        flex items-center gap-4 mx-3 p-3 rounded-xl
        transition-all duration-200
        ${
          isActive
            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
        }
      `
      }
    >
      <span className="text-xl">{icon}</span>
      {expanded && <span className="text-sm font-medium">{label}</span>}
    </NavLink>
  );
}
