import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiChevronDown, FiLogOut, FiUser } from "react-icons/fi";
import { useAuth } from "../context/useAuth";

const INCIDENTS_KEY = "incidents";
const NOTIFICATIONS_LAST_READ_KEY = "notifications_last_read";

function safeParse(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getIncidentTime(incident) {
  const raw = incident.reportedAt || incident.createdAt || incident.date;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function Navbar({
  title = "Welljob Solutions & General Services",
}) {
  const [openProfile, setOpenProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const roleConfig = useMemo(() => {
    const configs = {
      HR_MANAGER: { label: "HM", color: "bg-blue-600", roleName: "HR Manager" },
      HR_STAFF: { label: "HS", color: "bg-amber-500", roleName: "HR Staff" },
      IT_SUPPORT: { label: "IT", color: "bg-green-600", roleName: "IT Support" },
      SUPER_ADMIN: { label: "SA", color: "bg-red-600", roleName: "Super Admin" },
    };

    return configs[user?.role] || {
      label: "US",
      color: "bg-gray-500",
      roleName: "User",
    };
  }, [user?.role]);

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.fullname ||
    user?.full_name ||
    user?.username ||
    "User";

  const refreshUnreadCount = () => {
    const incidents = safeParse(INCIDENTS_KEY);
    const lastRead = localStorage.getItem(NOTIFICATIONS_LAST_READ_KEY);
    const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;

    const count = incidents.filter((incident) => {
      const incidentTime = getIncidentTime(incident);
      return incidentTime > lastReadTime;
    }).length;

    setUnreadCount(count);
  };

  useEffect(() => {
    const reload = () => {
      setTimeout(() => {
        refreshUnreadCount();
      }, 0);
    };
    
    // Initial load
    reload();
    
    window.addEventListener("dataUpdated", reload);
    window.addEventListener("storage", reload);

    return () => {
      window.removeEventListener("dataUpdated", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenProfile(false);
      }
    };

    if (openProfile) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openProfile]);

  const handleOpenNotifications = () => {
    navigate("/notifications");
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
    setOpenProfile(false);
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleOpenNotifications}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          title="Notifications"
        >
          <FiBell size={20} />

          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-slate-950">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpenProfile((prev) => !prev)}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${roleConfig.color}`}
            >
              {roleConfig.label}
            </div>

            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {roleConfig.roleName}
              </p>
            </div>

            <FiChevronDown
              className={`text-sm transition-transform ${
                openProfile ? "rotate-180" : ""
              }`}
            />
          </button>

          {openProfile && (
            <div className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
              <div className="border-b border-gray-100 px-4 py-4 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${roleConfig.color}`}
                  >
                    <FiUser size={17} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {user?.username || "-"} • {roleConfig.roleName}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-500 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <FiLogOut />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}