import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import NotificationCard from "../components/notifications/NotificationCard";
import NotificationTable from "../components/notifications/NotificationTable";
import { useAuth } from "../context/useAuth";

const INCIDENTS_KEY = "incidents";
const EMPLOYEES_KEY = "employees";

function safeParse(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getReadKey(role) {
  return `notifications_last_read_${role || "USER"}`;
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
  const status = incident?.status || "Open";

  if (role === "IT_SUPPORT") return false;

  if (role === "SUPER_ADMIN") {
    return status === "For Review";
  }

  if (role === "HR_MANAGER" || role === "HR_STAFF") {
    return ["Open", "Investigating"].includes(status);
  }

  return false;
}

function getPageSubtitle(role) {
  if (role === "SUPER_ADMIN") {
    return "Cases submitted by HR for Super Admin review and approval.";
  }

  return "Incident alerts assigned to HR Staff and HR Manager for monitoring and investigation.";
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = () => {
    const incidents = safeParse(INCIDENTS_KEY);
    const employees = safeParse(EMPLOYEES_KEY);
    const activeEmployees = employees.filter((emp) => !emp.archived);

    const filteredIncidents = incidents.filter((incident) => {
      const employeeIsActive = activeEmployees.some(
        (emp) =>
          String(emp.id) === String(incident.employeeId) ||
          String(emp.name) === String(incident.employee)
      );

      return (
        employeeIsActive &&
        isNotificationVisibleForRole(incident, user?.role)
      );
    });

    const mapped = filteredIncidents
      .map((incident) => ({
        id: incident.id,
        reportedBy: incident.reportedBy || "Unknown",
        employee: incident.employee,
        violation: incident.violation,
        severity: incident.severity || "Minor",
        status: incident.status || "Open",
        date:
          user?.role === "SUPER_ADMIN"
            ? incident?.resolution?.submittedAt ||
              incident?.updatedAt ||
              incident?.reportedAt ||
              incident?.date
            : incident?.updatedAt ||
              incident?.reportedAt ||
              incident?.date,
        timestamp: getIncidentTimeByRole(incident, user?.role),
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    setNotifications(mapped);
  };

  useEffect(() => {
    if (user?.role) {
      localStorage.setItem(getReadKey(user.role), new Date().toISOString());
      window.dispatchEvent(new Event("dataUpdated"));
    }

    const reload = () => {
      setTimeout(loadNotifications, 0);
    };

    window.addEventListener("dataUpdated", reload);
    window.addEventListener("storage", reload);

    // Initial load - defer to avoid synchronous setState
    setTimeout(loadNotifications, 0);

    return () => {
      window.removeEventListener("dataUpdated", reload);
      window.removeEventListener("storage", reload);
    };
  }, [user?.role]);

  const counts = useMemo(
    () => ({
      critical: notifications.filter((n) => n.severity === "Critical").length,
      major: notifications.filter((n) => n.severity === "Major").length,
      minor: notifications.filter((n) => n.severity === "Minor").length,
      total: notifications.length,
    }),
    [notifications]
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
            <span className="rounded-2xl bg-indigo-100 p-3 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              <FiBell />
            </span>
            Incident Notifications
          </h1>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {getPageSubtitle(user?.role)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
          Total Notifications:{" "}
          <span className="font-extrabold text-gray-900 dark:text-white">
            {counts.total}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <NotificationCard
          type="High"
          icon={<FiAlertTriangle />}
          message={`${counts.critical} Critical Incidents`}
          date={
            user?.role === "SUPER_ADMIN"
              ? "Pending review priority"
              : "Requires immediate HR action"
          }
        />

        <NotificationCard
          type="Medium"
          icon={<FiClock />}
          message={`${counts.major} Major Incidents`}
          date={
            user?.role === "SUPER_ADMIN"
              ? "Needs approval review"
              : "Needs investigation follow-up"
          }
        />

        <NotificationCard
          type="Low"
          icon={<FiCheckCircle />}
          message={`${counts.minor} Minor Incidents`}
          date="Standard monitoring"
        />
      </div>

      <NotificationTable notifications={notifications} />
    </div>
  );
}