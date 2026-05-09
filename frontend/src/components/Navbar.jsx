import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBell,
  FiChevronDown,
  FiClock,
  FiEye,
  FiLogOut,
  FiUser,
} from "react-icons/fi";

import { useAuth } from "../context/useAuth";
import useSmartNotifications from "../hooks/useSmartNotifications";
import SmartAlertToast from "./notifications/SmartAlertToast";
import {
  formatSmartAlertDate,
  getAlertPriorityClasses,
} from "../utils/notifications/smartNotifications";

export default function Navbar({
  title = "Welljob Solutions & General Services",
}) {
  const [openProfile, setOpenProfile] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);

  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const currentRole = user?.role || "USER";

  const {
    canView,
    latestAlerts,
    popupAlert,
    unreadCount,
    isFetching,
    refresh,
    markAlertAsRead,
    dismissAlert,
  } = useSmartNotifications(user, {
    pollInterval: 10000,
  });

  const roleConfig = useMemo(() => {
    const configs = {
      HR_MANAGER: {
        label: "HM",
        color: "bg-blue-600",
        roleName: "HR Manager",
      },
      HR_STAFF: {
        label: "HS",
        color: "bg-amber-500",
        roleName: "HR Staff",
      },
      IT_SUPPORT: {
        label: "IT",
        color: "bg-green-600",
        roleName: "IT Support",
      },
      SUPER_ADMIN: {
        label: "SA",
        color: "bg-red-600",
        roleName: "Super Admin",
      },
    };

    return (
      configs[currentRole] || {
        label: "US",
        color: "bg-gray-500",
        roleName: "User",
      }
    );
  }, [currentRole]);

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.fullname ||
    user?.full_name ||
    user?.username ||
    "User";

  const username = user?.username || "-";

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setOpenProfile(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setOpenNotifications(false);
      }
    };

    if (openProfile || openNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openProfile, openNotifications]);

  const openAlertTarget = async (alert) => {
    if (!alert) return;

    await markAlertAsRead(alert.alertKey);
    setOpenNotifications(false);

    if (alert.route === "/incidents" && alert.incidentId) {
      navigate("/incidents", {
        state: { incidentId: alert.incidentId },
      });
      return;
    }

    navigate(alert.route || "/notifications");
  };

  const handleToggleNotifications = async () => {
    if (!canView) return;

    setOpenNotifications((prev) => !prev);
    setOpenProfile(false);
    await refresh({ silent: true });
  };

  const handleViewNotifications = () => {
    if (!canView) return;

    setOpenNotifications(false);
    navigate("/notifications");
  };

  const handleDismissToast = async (alert) => {
    await dismissAlert(alert.alertKey);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    setUser(null);
    setOpenProfile(false);
    setOpenNotifications(false);

    navigate("/login", { replace: true });
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>

        <div className="flex items-center gap-3">
          {canView && (
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white ${
                  unreadCount > 0 ? "animate-pulse" : ""
                }`}
                title="Smart Alerts"
              >
                <FiBell size={20} />

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-slate-950">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {openNotifications && (
                <div className="absolute right-0 z-50 mt-3 w-[420px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white">
                        Smart Alerts
                      </h3>

                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Rule-based incident and priority notifications
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleViewNotifications}
                      className="text-xs font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                    >
                      View All
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {latestAlerts.length > 0 ? (
                      latestAlerts.map((alert) => {
                        const styles = getAlertPriorityClasses(alert.priority);

                        return (
                          <button
                            type="button"
                            key={alert.alertKey}
                            onClick={() => openAlertTarget(alert)}
                            className={`flex w-full gap-3 border-b border-gray-100 px-5 py-4 text-left transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5 ${
                              !alert.isRead
                                ? "bg-indigo-50/50 dark:bg-indigo-950/10"
                                : ""
                            }`}
                          >
                            <div
                              className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
                            >
                              {alert.priority === "High" ? (
                                <FiAlertTriangle />
                              ) : (
                                <FiClock />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-sm font-black text-gray-900 dark:text-white">
                                  {alert.title}
                                </p>

                                <span className="shrink-0 text-[11px] text-gray-400">
                                  {formatSmartAlertDate(alert.date)}
                                </span>
                              </div>

                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                {alert.message}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${styles.badge}`}>
                                  {alert.priority}
                                </span>

                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {alert.status}
                                </span>

                                {!alert.isRead && (
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                    New
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-5 py-10 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-slate-800">
                          <FiBell size={22} />
                        </div>

                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          No smart alerts
                        </p>

                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Priority incident alerts will appear here.
                        </p>
                      </div>
                    )}
                  </div>

                  {latestAlerts.length > 0 && (
                    <div className="border-t border-gray-100 px-5 py-3 dark:border-white/10">
                      <button
                        type="button"
                        onClick={handleViewNotifications}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                      >
                        <FiEye />
                        Open Smart Alerts Center
                      </button>
                    </div>
                  )}

                  {isFetching && (
                    <div className="border-t border-gray-100 px-5 py-2 text-center text-[11px] font-semibold text-gray-400 dark:border-white/10">
                      Syncing alerts...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setOpenProfile((prev) => !prev);
                setOpenNotifications(false);
              }}
className="flex max-w-[260px] items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"            >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${roleConfig.color}`}
            >
              {roleConfig.label}
            </div>

            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-[190px] truncate text-sm font-bold leading-5 text-gray-900 dark:text-white">
                {displayName}
              </p>
            </div>

            <FiChevronDown
              className={`shrink-0 text-sm transition-transform ${
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
                        {username} • {roleConfig.roleName}
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

      <SmartAlertToast
        alert={popupAlert}
        onDismiss={handleDismissToast}
        onView={openAlertTarget}
      />
    </>
  );
}