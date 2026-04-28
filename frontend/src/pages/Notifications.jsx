import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
} from "react-icons/fi";

import NotificationCard from "../components/notifications/NotificationCard";
import NotificationTable from "../components/notifications/NotificationTable";
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
    company: employee.company || employee.clientCompany || "",
    status: employee.status || "Unknown",
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
    "No violation type";

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
      "Unknown Employee",
    employeeName:
      incident.employeeName ||
      incident.employee ||
      incident.employee_name ||
      "Unknown Employee",
    violation,
    violationType: violation,
    severity: incident.severity || "Minor",
    status: normalizeStatus(incident.status || "Open"),
    reportedBy:
      incident.reportedBy ||
      incident.reported_by ||
      incident.createdBy ||
      "Unknown",
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
    incident?.employee ||
      incident?.employeeName ||
      incident?.employee_name ||
      ""
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

function getIncidentDateByRole(incident, role) {
  if (role === "SUPER_ADMIN") {
    return (
      incident?.resolution?.submittedAt ||
      incident?.updatedAt ||
      incident?.reportedAt ||
      incident?.date
    );
  }

  return incident?.updatedAt || incident?.reportedAt || incident?.date;
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

function getPageSubtitle(role) {
  if (role === "SUPER_ADMIN") {
    return "Cases submitted by HR for Super Admin review and approval.";
  }

  if (role === "IT_SUPPORT") {
    return "Incident notifications are not assigned to IT Support.";
  }

  return "Incident alerts assigned to HR Staff and HR Manager for monitoring and investigation.";
}

export default function Notifications() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      setFetchError("");

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

      const filteredIncidents = incidents.filter((incident) => {
        const employeeIsActive = activeEmployees.some((employee) =>
          isSameEmployee(employee, incident)
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
          employee: incident.employee || incident.employeeName || "-",
          violation: incident.violation || incident.violationType || "-",
          severity: incident.severity || "Minor",
          status: normalizeStatus(incident.status || "Open"),
          date: getIncidentDateByRole(incident, user?.role),
          timestamp: getIncidentTimeByRole(incident, user?.role),
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      setNotifications(mapped);

      localStorage.setItem("employees", JSON.stringify(activeEmployees));
      localStorage.setItem("incidents", JSON.stringify(incidents));
      window.dispatchEvent(new Event("dataUpdated"));
    } catch (error) {
      console.error("Notification backend fetch error:", error);
      setFetchError(error.message || "Unable to load notifications.");
      setNotifications([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role) {
      localStorage.setItem(getReadKey(user.role), new Date().toISOString());
      window.dispatchEvent(new Event("dataUpdated"));
    }

    loadNotifications();
  }, [loadNotifications, user?.role]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
  };

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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            <FiRefreshCw className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
            Total Notifications:{" "}
            <span className="font-extrabold text-gray-900 dark:text-white">
              {counts.total}
            </span>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {fetchError}
        </div>
      )}

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

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center text-sm font-semibold text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
          Loading notifications from backend...
        </div>
      ) : (
        <NotificationTable notifications={notifications} />
      )}
    </div>
  );
}