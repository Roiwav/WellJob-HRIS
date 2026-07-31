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

const ROLE_CONFIGS = {
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

const DEFAULT_ROLE_CONFIG = {
  label: "US",
  color: "bg-gray-500",
  roleName: "User",
};

function getAlertKey(alert) {
  return String(alert?.alertKey || alert?.id || "");
}

export default function Navbar({
  title = "Welljob Solutions & General Services",
}) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [openProfile, setOpenProfile] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [animateNotificationBell, setAnimateNotificationBell] = useState(false);

  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const previousPopupAlertKeyRef = useRef("");
  const bellAnimationTimerRef = useRef(null);

  const currentRole = user?.role || "USER";

  const {
    canView,
    latestAlerts,
    popupAlert,
    unreadCount,
    readAlertCount,
    hasReadAlerts,
    isFetching,
    isClearingRead,
    refresh,
    markAlertAsRead,
    dismissAlert,
    clearReadAlerts,
  } = useSmartNotifications(user, {
    pollInterval: 10000,
  });

  const roleConfig = useMemo(
    () => ROLE_CONFIGS[currentRole] || DEFAULT_ROLE_CONFIG,
    [currentRole]
  );

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.fullname ||
    user?.full_name ||
    user?.username ||
    "User";

  const username = user?.username || "-";

  useEffect(() => {
    const currentAlertKey = getAlertKey(popupAlert);
    const previousAlertKey = previousPopupAlertKeyRef.current;

    if (!currentAlertKey) {
      previousPopupAlertKeyRef.current = "";
      return undefined;
    }

    previousPopupAlertKeyRef.current = currentAlertKey;

    if (currentAlertKey === previousAlertKey || openNotifications) {
      return undefined;
    }

    setAnimateNotificationBell(false);

    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setAnimateNotificationBell(true);
      });
    });

    if (bellAnimationTimerRef.current) {
      window.clearTimeout(bellAnimationTimerRef.current);
    }

    bellAnimationTimerRef.current = window.setTimeout(() => {
      setAnimateNotificationBell(false);
      bellAnimationTimerRef.current = null;
    }, 2600);

    return () => {
      window.cancelAnimationFrame(firstFrame);
    };
  }, [popupAlert, openNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setOpenProfile(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setOpenNotifications(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setOpenProfile(false);
        setOpenNotifications(false);
      }
    };

    if (openProfile || openNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [openProfile, openNotifications]);

  useEffect(() => {
    return () => {
      if (bellAnimationTimerRef.current) {
        window.clearTimeout(bellAnimationTimerRef.current);
      }
    };
  }, []);

  const stopBellAnimation = () => {
    setAnimateNotificationBell(false);

    if (bellAnimationTimerRef.current) {
      window.clearTimeout(bellAnimationTimerRef.current);
      bellAnimationTimerRef.current = null;
    }
  };

  const openAlertTarget = async (alert) => {
    if (!alert) return;

    setOpenNotifications(false);
    stopBellAnimation();

    try {
      await markAlertAsRead(alert.alertKey);
    } catch (error) {
      console.error("Failed to mark smart alert as read:", error);
    }

    if (alert.route === "/incidents" && alert.incidentId) {
      navigate("/incidents", {
        state: {
          incidentId: alert.incidentId,
          action: alert.action || alert.navigationAction || "view",
        },
      });
      return;
    }

    navigate(alert.route || "/notifications");
  };

  const handleToggleNotifications = async () => {
    if (!canView) return;

    stopBellAnimation();
    setOpenNotifications((current) => !current);
    setOpenProfile(false);

    try {
      await refresh({ silent: true });
    } catch (error) {
      console.error("Failed to refresh smart alerts:", error);
    }
  };

  const handleViewNotifications = () => {
    if (!canView) return;

    setOpenNotifications(false);
    navigate("/notifications");
  };

  const handleClearReadAlerts = async () => {
    if (!canView || !hasReadAlerts || isClearingRead) return;

    try {
      await clearReadAlerts();
    } catch (error) {
      console.error("Failed to clear read smart alerts:", error);
    }
  };

  const handleDismissToast = async (alert) => {
    if (!alert?.alertKey) return;

    try {
      await dismissAlert(alert.alertKey);
    } catch (error) {
      console.error("Failed to dismiss smart alert:", error);
    }
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
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                title="Smart Alerts"
                aria-label={`Smart Alerts${
                  unreadCount > 0 ? `, ${unreadCount} unread` : ""
                }`}
                aria-expanded={openNotifications}
                aria-haspopup="dialog"
              >
                <FiBell
                  size={20}
                  aria-hidden="true"
                  className={
                    animateNotificationBell && !openNotifications
                      ? "notification-bell-icon-new"
                      : ""
                  }
                />

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-slate-950">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {openNotifications && (
                <div
                  role="dialog"
                  aria-label="Smart Alerts"
                  className="absolute right-0 z-[80] mt-3 w-[min(420px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/10">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white">
                        Smart Alerts
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        Rule-based incident and priority notifications
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearReadAlerts}
                      disabled={!hasReadAlerts || isClearingRead}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-black text-amber-700 transition hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300 dark:hover:bg-amber-950/30 dark:hover:text-amber-200"
                      title={
                        hasReadAlerts
                          ? `Clear ${readAlertCount} read alert${
                              readAlertCount === 1 ? "" : "s"
                            }`
                          : "No read alerts to clear"
                      }
                    >
                      {isClearingRead
                        ? "Clearing..."
                        : `Clear Read${
                            readAlertCount > 0 ? ` (${readAlertCount})` : ""
                          }`}
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {isFetching && latestAlerts.length === 0 ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="space-y-3 px-5 py-5"
                      >
                        {[1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className="flex animate-pulse gap-3 rounded-2xl border border-slate-100 p-3 dark:border-slate-800"
                          >
                            <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                              <div className="h-2.5 w-full rounded bg-slate-100 dark:bg-slate-800" />
                              <div className="h-2.5 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
                            </div>
                          </div>
                        ))}
                        <span className="sr-only">Loading smart alerts...</span>
                      </div>
                    ) : latestAlerts.length > 0 ? (
                      latestAlerts.map((alert) => {
                        const styles = getAlertPriorityClasses(alert.priority);

                        return (
                          <button
                            type="button"
                            key={alert.alertKey}
                            onClick={() => openAlertTarget(alert)}
                            className={`flex w-full gap-3 border-b border-gray-100 px-5 py-4 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-indigo-500/10 dark:border-white/10 dark:hover:bg-white/5 ${
                              !alert.isRead
                                ? "bg-indigo-50/50 dark:bg-indigo-950/10"
                                : ""
                            }`}
                            aria-label={`${alert.title}. ${
                              alert.isRead ? "Read" : "Unread"
                            }. Open affected record.`}
                          >
                            <div
                              className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
                            >
                              {alert.priority === "High" ? (
                                <FiAlertTriangle aria-hidden="true" />
                              ) : (
                                <FiClock aria-hidden="true" />
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
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${styles.badge}`}
                                >
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
                          <FiBell size={22} aria-hidden="true" />
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
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                      >
                        <FiEye aria-hidden="true" />
                        View All Smart Alerts
                      </button>
                    </div>
                  )}

                  {isFetching && latestAlerts.length > 0 && (
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
                setOpenProfile((current) => !current);
                setOpenNotifications(false);
              }}
              className="flex max-w-[260px] items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:text-gray-300 dark:hover:bg-white/10"
              aria-expanded={openProfile}
              aria-haspopup="menu"
            >
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
                aria-hidden="true"
              />
            </button>

            {openProfile && (
              <div className="absolute right-0 z-[80] mt-3 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
                <div className="border-b border-gray-100 px-4 py-4 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${roleConfig.color}`}
                    >
                      <FiUser size={17} aria-hidden="true" />
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
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-500 transition hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  <FiLogOut aria-hidden="true" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SmartAlertToast
        alert={openNotifications ? null : popupAlert}
        onDismiss={handleDismissToast}
        onView={openAlertTarget}
      />
    </>
  );
}