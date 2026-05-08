import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const API_BASE = "http://localhost:5000/api";
const EMPLOYEE_API_URL = `${API_BASE}/employees`;
const INCIDENT_API_URL = `${API_BASE}/incidents`;

function getReadKey(role) {
  return `notifications_last_read_${role || "USER"}`;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(status) {
  const value = normalizeText(status);

  if (value === "resolved") return "For Review";
  if (value === "for_review") return "For Review";
  if (value === "for review") return "For Review";
  if (value === "closed") return "Closed";
  if (value === "investigating") return "Investigating";

  return "Open";
}

function isArchivedEmployee(employee) {
  return employee?.archived === true || Number(employee?.archived) === 1;
}

function normalizeBackendEmployee(employee) {
  return {
    ...employee,
    id: employee.id || employee.employeeId || employee.employee_id,
    employeeId: employee.id || employee.employeeId || employee.employee_id,
    name:
      employee.name ||
      employee.full_name ||
      employee.fullName ||
      "Unknown Employee",
    archived: isArchivedEmployee(employee),
  };
}

function normalizeBackendIncident(incident) {
  const date =
    incident.reportedAt ||
    incident.reported_at ||
    incident.date ||
    incident.incidentDate ||
    incident.incident_date ||
    incident.createdAt ||
    incident.created_at ||
    new Date().toISOString();

  const violation =
    incident.violation ||
    incident.violationType ||
    incident.violation_type ||
    "No violation specified";

  return {
    ...incident,
    id: incident.id,
    employeeId:
      incident.employeeId ||
      incident.employee_id ||
      incident.empId ||
      incident.employeeID ||
      "",
    employee:
      incident.employee ||
      incident.employeeName ||
      incident.employee_name ||
      "Unknown employee",
    employeeName:
      incident.employeeName ||
      incident.employee ||
      incident.employee_name ||
      "Unknown employee",
    violation,
    violationType: violation,
    severity: incident.severity || "Minor",
    status: normalizeStatus(incident.status || "Open"),
    date,
    reportedAt: incident.reportedAt || incident.reported_at || date,
    createdAt: incident.createdAt || incident.created_at || date,
    updatedAt: incident.updatedAt || incident.updated_at || date,
    resolution: incident.resolution || null,
    review: incident.review || null,
  };
}

async function requestJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function isSameEmployee(employee, incident) {
  const employeeId = String(
    employee?.id || employee?.employeeId || employee?.employee_id || ""
  );

  const employeeName = normalizeText(
    employee?.name || employee?.full_name || employee?.fullName || ""
  );

  const incidentEmployeeId = String(
    incident?.employeeId || incident?.employee_id || incident?.empId || ""
  );

  const incidentEmployeeName = normalizeText(
    incident?.employee || incident?.employeeName || incident?.employee_name || ""
  );

  return (
    (!!employeeId && employeeId === incidentEmployeeId) ||
    (!!employeeName && employeeName === incidentEmployeeName)
  );
}

function getIncidentTimeByRole(incident, role) {
  const raw =
    role === "SUPER_ADMIN"
      ? incident?.resolution?.submittedAt ||
        incident?.review?.reviewedAt ||
        incident?.updatedAt ||
        incident?.reportedAt ||
        incident?.createdAt ||
        incident?.date
      : incident?.updatedAt ||
        incident?.reportedAt ||
        incident?.createdAt ||
        incident?.date;

  const time = new Date(raw).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function isNotificationVisibleForRole(incident, role) {
  const status = normalizeStatus(incident?.status || "Open");

  if (role === "IT_SUPPORT") return false;

  if (role === "SUPER_ADMIN") {
    return status === "For Review";
  }

  if (role === "HR_MANAGER" || role === "HR_STAFF") {
    return ["Open", "Investigating"].includes(status);
  }

  return false;
}

function formatNotificationDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getNotificationTitle(incident, role) {
  const incidentId = incident?.displayId || incident?.id || "Incident";

  if (role === "SUPER_ADMIN") {
    return `Case for Review: ${incidentId}`;
  }

  return `New Incident: ${incidentId}`;
}

function getNotificationMessage(incident) {
  const employee =
    incident?.employee || incident?.employeeName || "Unknown employee";

  const violation =
    incident?.violation || incident?.violationType || "No violation specified";

  return `${employee} • ${violation}`;
}

export default function Navbar({
  title = "Welljob Solutions & General Services",
}) {
  const [openProfile, setOpenProfile] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotifications, setLatestNotifications] = useState([]);

  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const currentRole = user?.role || "USER";

  const canViewNotifications = useMemo(() => {
    return ["HR_MANAGER", "HR_STAFF", "SUPER_ADMIN"].includes(currentRole);
  }, [currentRole]);

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

  const refreshNotifications = useCallback(async () => {
    if (!canViewNotifications) {
      setUnreadCount(0);
      setLatestNotifications([]);
      return;
    }

    try {
      const [employeeData, incidentData] = await Promise.all([
        requestJson(EMPLOYEE_API_URL),
        requestJson(INCIDENT_API_URL),
      ]);

      const activeEmployees = Array.isArray(employeeData)
        ? employeeData
            .map(normalizeBackendEmployee)
            .filter((employee) => !employee.archived)
        : [];

      const incidents = Array.isArray(incidentData)
        ? incidentData.map(normalizeBackendIncident)
        : [];

      const lastRead = localStorage.getItem(getReadKey(currentRole));
      const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;

      const visibleNotifications = incidents
        .filter((incident) => {
          const employeeIsActive = activeEmployees.some((employee) =>
            isSameEmployee(employee, incident)
          );

          return (
            employeeIsActive &&
            isNotificationVisibleForRole(incident, currentRole)
          );
        })
        .map((incident) => ({
          ...incident,
          notificationTime: getIncidentTimeByRole(incident, currentRole),
        }))
        .sort((a, b) => b.notificationTime - a.notificationTime);

      const unread = visibleNotifications.filter(
        (incident) => incident.notificationTime > lastReadTime
      ).length;

      setUnreadCount(unread);
      setLatestNotifications(visibleNotifications.slice(0, 5));
    } catch (error) {
      console.error("Navbar notification backend fetch failed:", error);
      setUnreadCount(0);
      setLatestNotifications([]);
    }
  }, [canViewNotifications, currentRole]);

  useEffect(() => {
    refreshNotifications();

    const handleDataUpdated = () => refreshNotifications();
    const handleWindowFocus = () => refreshNotifications();
    const intervalId = window.setInterval(refreshNotifications, 30000);

    window.addEventListener("dataUpdated", handleDataUpdated);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdated);
      window.removeEventListener("focus", handleWindowFocus);
      window.clearInterval(intervalId);
    };
  }, [refreshNotifications]);

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

  const markNotificationsAsRead = useCallback(() => {
    if (!canViewNotifications) return;

    localStorage.setItem(getReadKey(currentRole), new Date().toISOString());
    setUnreadCount(0);
  }, [canViewNotifications, currentRole]);

  const handleToggleNotifications = () => {
    if (!canViewNotifications) return;

    setOpenNotifications((prev) => !prev);
    setOpenProfile(false);
    refreshNotifications();
  };

  const handleViewNotifications = () => {
    if (!canViewNotifications) return;

    markNotificationsAsRead();
    setOpenNotifications(false);
    navigate("/notifications");
  };

  const handleViewIncident = (incidentId) => {
    markNotificationsAsRead();
    setOpenNotifications(false);

    navigate("/incidents", {
      state: { incidentId },
    });
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
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>

      <div className="flex items-center gap-3">
        {canViewNotifications && (
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={handleToggleNotifications}
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

            {openNotifications && (
              <div className="absolute right-0 z-50 mt-3 w-96 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      Notifications
                    </h3>

                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Latest incident workflow updates
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleViewNotifications}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                  >
                    View All
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {latestNotifications.length > 0 ? (
                    latestNotifications.map((incident) => {
                      const isCritical = incident.severity === "Critical";

                      return (
                        <button
                          type="button"
                          key={incident.id}
                          onClick={() => handleViewIncident(incident.id)}
                          className="flex w-full gap-3 border-b border-gray-100 px-5 py-4 text-left transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                        >
                          <div
                            className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              isCritical
                                ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"
                                : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                            }`}
                          >
                            {isCritical ? <FiAlertTriangle /> : <FiClock />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                {getNotificationTitle(incident, currentRole)}
                              </p>

                              <span className="shrink-0 text-[11px] text-gray-400">
                                {formatNotificationDate(
                                  incident.notificationTime
                                )}
                              </span>
                            </div>

                            <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                              {getNotificationMessage(incident)}
                            </p>

                            <div className="mt-2 flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {incident.status || "Open"}
                              </span>

                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {incident.severity || "Minor"}
                              </span>
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
                        No notifications
                      </p>

                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Incident workflow updates will appear here.
                      </p>
                    </div>
                  )}
                </div>

                {latestNotifications.length > 0 && (
                  <div className="border-t border-gray-100 px-5 py-3 dark:border-white/10">
                    <button
                      type="button"
                      onClick={handleViewNotifications}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                    >
                      <FiEye />
                      View Notification Page
                    </button>
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
  );
}