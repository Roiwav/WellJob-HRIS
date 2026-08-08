import {
  useMemo,
  useState,
} from "react";

import {
  FiBell,
  FiCheckCircle,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";

import {
  useNavigate,
} from "react-router-dom";

import NotificationTable from "../components/notifications/NotificationTable";
import { useAuth } from "../context/useAuth";
import useSmartNotifications from "../hooks/useSmartNotifications";

const ACTIVE_CASE_STATUSES = new Set([
  "Open",
  "Investigating",
  "For Review",
]);

function getPageSubtitle(role) {
  if (role === "SUPER_ADMIN") {
    return "Smart alerts for cases submitted to Super Admin for review and approval.";
  }

  if (role === "IT_SUPPORT") {
    return "Smart incident alerts are not assigned to IT Support.";
  }

  return "Smart incident alerts assigned to HR for monitoring, investigation, and intervention.";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeCaseStatus(status) {
  const normalized = normalizeText(status)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "open") {
    return "Open";
  }

  if (normalized === "investigating") {
    return "Investigating";
  }

  if (
    normalized === "for review" ||
    normalized === "resolved"
  ) {
    return "For Review";
  }

  if (normalized === "closed") {
    return "Closed";
  }

  return "Open";
}

function getUniqueIncidentKey(
  alert,
  index
) {
  return String(
    alert?.incidentId ||
      alert?.incident_id ||
      alert?.caseId ||
      alert?.case_id ||
      alert?.alertKey ||
      `alert-${index}`
  );
}

function isActiveCase(alert) {
  return ACTIVE_CASE_STATUSES.has(
    normalizeCaseStatus(
      alert?.status
    )
  );
}

function filterAlerts(
  alerts,
  activeFilter,
  caseStatusFilter,
  search
) {
  let filtered =
    Array.isArray(alerts)
      ? [...alerts]
      : [];

  if (activeFilter === "ALL") {
    filtered =
      filtered.filter(
        isActiveCase
      );
  }

  if (activeFilter === "UNREAD") {
    filtered =
      filtered.filter(
        (alert) =>
          isActiveCase(alert) &&
          !alert?.isRead
      );
  }

  if (activeFilter === "HIGH") {
    filtered =
      filtered.filter(
        (alert) =>
          isActiveCase(alert) &&
          alert?.priority ===
            "High"
      );
  }

  if (activeFilter === "MEDIUM") {
    filtered =
      filtered.filter(
        (alert) =>
          isActiveCase(alert) &&
          alert?.priority ===
            "Medium"
      );
  }

  if (activeFilter === "LOW") {
    filtered =
      filtered.filter(
        (alert) =>
          isActiveCase(alert) &&
          alert?.priority ===
            "Low"
      );
  }

  if (
    caseStatusFilter !== "ALL"
  ) {
    filtered =
      filtered.filter(
        (alert) =>
          normalizeCaseStatus(
            alert?.status
          ) ===
          caseStatusFilter
      );
  }

  if (search.trim()) {
    const keyword =
      normalizeText(search);

    filtered =
      filtered.filter(
        (alert) =>
          [
            alert?.title,
            alert?.message,
            alert?.employee,
            alert?.violation,
            alert?.priority,
            normalizeCaseStatus(
              alert?.status
            ),
            alert?.reason,
            alert?.recommendedAction,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
      );
  }

  return filtered;
}

function buildAlertCounts(
  alerts = []
) {
  const safeAlerts =
    Array.isArray(alerts)
      ? alerts
      : [];

  const activeAlerts =
    safeAlerts.filter(
      isActiveCase
    );

  const uniqueActiveCases =
    new Set(
      activeAlerts.map(
        getUniqueIncidentKey
      )
    );

  return {
    active:
      uniqueActiveCases.size,

    unread:
      activeAlerts.filter(
        (alert) =>
          !alert?.isRead
      ).length,

    high:
      activeAlerts.filter(
        (alert) =>
          alert?.priority ===
          "High"
      ).length,

    medium:
      activeAlerts.filter(
        (alert) =>
          alert?.priority ===
          "Medium"
      ).length,

    low:
      activeAlerts.filter(
        (alert) =>
          alert?.priority ===
          "Low"
      ).length,
  };
}

export default function Notifications() {
  const { user } = useAuth();

  const navigate =
    useNavigate();

  const [
    activeFilter,
    setActiveFilter,
  ] = useState("ALL");

  const [
    caseStatusFilter,
    setCaseStatusFilter,
  ] = useState("ALL");

  const [
    search,
    setSearch,
  ] = useState("");

  const {
    alerts,
    isLoading,
    isFetching,
    error,
    refresh,
    markAlertAsRead,
    markAllAsRead,
  } = useSmartNotifications(
    user,
    {
      pollInterval: 0,
    }
  );

  const counts = useMemo(
    () =>
      buildAlertCounts(
        alerts
      ),
    [alerts]
  );

  const visibleAlerts =
    useMemo(() => {
      return filterAlerts(
        alerts,
        activeFilter,
        caseStatusFilter,
        search
      );
    }, [
      alerts,
      activeFilter,
      caseStatusFilter,
      search,
    ]);

  const handleRefresh =
    async () => {
      try {
        await refresh();
      } catch (
        refreshError
      ) {
        console.error(
          "Failed to refresh smart alerts:",
          refreshError
        );
      }
    };

  const handleViewAlert =
    async (alert) => {
      if (!alert) {
        return;
      }

      if (
        alert.route ===
          "/incidents" &&
        alert.incidentId
      ) {
        navigate(
          "/incidents",
          {
            state: {
              incidentId:
                alert.incidentId,
            },
          }
        );
      } else {
        navigate(
          alert.route ||
            "/notifications"
        );
      }

      try {
        await markAlertAsRead(
          alert.alertKey
        );
      } catch (readError) {
        console.error(
          "Failed to mark smart alert as read:",
          readError
        );
      }
    };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-sm">
        <div className="relative overflow-hidden px-6 py-7 sm:px-8">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white/90">
                <FiShield
                  aria-hidden="true"
                />

                Smart Monitoring
              </div>

              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
                <span className="rounded-2xl bg-white/15 p-3">
                  <FiBell
                    aria-hidden="true"
                  />
                </span>

                Smart Alerts Center
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">
                {getPageSubtitle(
                  user?.role
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={
                  handleRefresh
                }
                disabled={
                  isFetching
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCw
                  className={
                    isFetching
                      ? "animate-spin"
                      : ""
                  }
                  aria-hidden="true"
                />

                {isFetching
                  ? "Syncing..."
                  : "Sync Alerts"}
              </button>

              <button
                type="button"
                onClick={
                  markAllAsRead
                }
                disabled={
                  alerts.length ===
                    0 ||
                  counts.unread ===
                    0
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheckCircle
                  aria-hidden="true"
                />

                Mark All Read
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div
          role="status"
          className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center text-sm font-semibold text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400"
        >
          Loading smart alerts...
        </div>
      ) : (
        <NotificationTable
          notifications={
            visibleAlerts
          }
          counts={counts}
          activeFilter={
            activeFilter
          }
          onFilterChange={
            setActiveFilter
          }
          caseStatusFilter={
            caseStatusFilter
          }
          onCaseStatusFilterChange={
            setCaseStatusFilter
          }
          search={search}
          onSearchChange={
            setSearch
          }
          onViewAlert={
            handleViewAlert
          }
          onMarkRead={
            markAlertAsRead
          }
        />
      )}
    </div>
  );
}