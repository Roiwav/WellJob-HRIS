import logo from "../assets/logo.png";
import { NavLink } from "react-router-dom";
import { useMemo, useState } from "react";
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
} from "react-icons/fi";
import { sidebarItems } from "../config/sidebarItems";
import { useAuth } from "../context/useAuth";

const iconMap = {
  Dashboard: <FiHome />,
  Employees: <FiUsers />,
  Deployments: <FiMapPin />,
  "KPI Reports": <FiBarChart2 />,
  Incidents: <FiAlertTriangle />,
  Notifications: <FiBell />,
  Settings: <FiSettings />,
  "Super Admin Portal": <FiShield />,
};

export default function Sidebar({ toggleTheme, darkMode }) {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();

  const filteredItems = useMemo(() => {
    if (!user?.role) return [];
    return sidebarItems.filter((item) => item.allowedRoles.includes(user.role));
  }, [user]);

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
      <div>
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
              ${
                expanded
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-2 absolute"
              }
            `}
          >
            HR System
          </span>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {filteredItems.map((item) => (
            <SidebarItem
              key={item.path}
              to={item.path}
              icon={iconMap[item.title] || <FiHome />}
              label={item.title}
              expanded={expanded}
            />
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-white/10 space-y-4">
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
              ${
                expanded
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-2 absolute"
              }
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
          ${
            expanded
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-2 absolute"
          }
        `}
      >
        {label}
      </span>
    </NavLink>
  );
}