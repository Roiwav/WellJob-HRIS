import { useMemo, useState } from "react";
import {
  FiBell,
  FiCheckCircle,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import NotificationTable from "../components/notifications/NotificationTable";
import { useAuth } from "../context/useAuth";
import useSmartNotifications from "../hooks/useSmartNotifications";

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
  return String(value || "").trim().toLowerCase();
}

function filterAlerts(alerts, activeFilter, search) {
  let filtered = Array.isArray(alerts) ? [...alerts] : [];

  if (activeFilter === "DISMISSED") {
    filtered = filtered.filter((alert) => alert.isDismissed);
  } else {
    filtered = filtered.filter((alert) => !alert.isDismissed);
  }

  if (activeFilter === "UNREAD") {
    filtered = filtered.filter((alert) => !alert.isRead);
  }

  if (activeFilter === "HIGH") {
    filtered = filtered.filter((alert) => alert.priority === "High");
  }

  if (activeFilter === "MEDIUM") {
    filtered = filtered.filter((alert) => alert.priority === "Medium");
  }

  if (activeFilter === "LOW") {
    filtered = filtered.filter((alert) => alert.priority === "Low");
  }

  if (search.trim()) {
    const keyword = normalizeText(search);

    filtered = filtered.filter((alert) =>
      [
        alert.title,
        alert.message,
        alert.employee,
        alert.violation,
        alert.priority,
        alert.status,
        alert.reason,
        alert.recommendedAction,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }

  return filtered;
}

function buildAlertCounts(alerts = []) {
  const activeAlerts = alerts.filter((alert) => !alert.isDismissed);

  return {
    active: activeAlerts.length,
    unread: activeAlerts.filter((alert) => !alert.isRead).length,
    high: activeAlerts.filter((alert) => alert.priority === "High").length,
    medium: activeAlerts.filter((alert) => alert.priority === "Medium").length,
    low: activeAlerts.filter((alert) => alert.priority === "Low").length,
    dismissed: alerts.filter((alert) => alert.isDismissed).length,
  };
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const {
    alerts,
    isLoading,
    isFetching,
    error,
    refresh,
    markAlertAsRead,
    dismissAlert,
    markAllAsRead,
  } = useSmartNotifications(user, {
    pollInterval: 10000,
  });

  const counts = useMemo(() => buildAlertCounts(alerts), [alerts]);

  const visibleAlerts = useMemo(() => {
    return filterAlerts(alerts, activeFilter, search);
  }, [alerts, activeFilter, search]);

  const handleRefresh = async () => {
    await refresh();
  };

  const handleViewAlert = async (alert) => {
    if (!alert) return;

    await markAlertAsRead(alert.alertKey);

    if (alert.route === "/incidents" && alert.incidentId) {
      navigate("/incidents", {
        state: { incidentId: alert.incidentId },
      });
      return;
    }

    navigate(alert.route || "/notifications");
  };

  const handleDismissAlert = async (alert) => {
    if (!alert?.alertKey) return;
    await dismissAlert(alert.alertKey);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-slate-900 p-6 text-white lg:p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-indigo-300/20 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white/90">
                <FiShield />
                Smart Monitoring
              </div>

              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
                <span className="rounded-2xl bg-white/15 p-3">
                  <FiBell />
                </span>
                Smart Alerts Center
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">
                {getPageSubtitle(user?.role)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCw className={isFetching ? "animate-spin" : ""} />
                {isFetching ? "Syncing..." : "Sync Alerts"}
              </button>

              <button
                type="button"
                onClick={markAllAsRead}
                disabled={alerts.length === 0 || counts.unread === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheckCircle />
                Mark All Read
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center text-sm font-semibold text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
          Loading smart alerts...
        </div>
      ) : (
        <NotificationTable
          notifications={visibleAlerts}
          counts={counts}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          search={search}
          onSearchChange={setSearch}
          onViewAlert={handleViewAlert}
          onMarkRead={markAlertAsRead}
          onDismissAlert={handleDismissAlert}
        />
      )}
    </div>
  );
}