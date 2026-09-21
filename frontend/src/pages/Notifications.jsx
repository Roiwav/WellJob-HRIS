import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiBell,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiXCircle,
} from "react-icons/fi";

import {
  useNavigate,
} from "react-router-dom";

import NotificationTable from "../components/notifications/NotificationTable";
import { useAuth } from "../context/useAuth";
import useSmartNotifications from "../hooks/useSmartNotifications";
import { API_BASE } from "../config/api";

const INCIDENT_ALERT_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
]);

const PASSWORD_RESET_REVIEWER_ROLES = new Set([
  "SUPER_ADMIN",
  "IT_SUPPORT",
]);

const ACTIVE_CASE_STATUSES = new Set([
  "Open",
  "Investigating",
  "For Review",
]);

function getPageSubtitle(role) {
  if (role === "SUPER_ADMIN") {
    return "Review assigned incident alerts and authorized password-reset requests.";
  }

  if (role === "IT_SUPPORT") {
    return "Review password-reset requests assigned to authorized IT Support personnel.";
  }

  if (role === "HR_COORDINATOR") {
    return "View notifications available to your account.";
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

function getUniqueIncidentKey(alert, index) {
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
    normalizeCaseStatus(alert?.status)
  );
}

function filterAlerts(
  alerts,
  activeFilter,
  caseStatusFilter,
  search
) {
  let filtered = Array.isArray(alerts)
    ? [...alerts]
    : [];

  if (activeFilter === "ALL") {
    filtered = filtered.filter(isActiveCase);
  }

  if (activeFilter === "UNREAD") {
    filtered = filtered.filter(
      (alert) =>
        isActiveCase(alert) &&
        !alert?.isRead
    );
  }

  if (activeFilter === "HIGH") {
    filtered = filtered.filter(
      (alert) =>
        isActiveCase(alert) &&
        alert?.priority === "High"
    );
  }

  if (activeFilter === "MEDIUM") {
    filtered = filtered.filter(
      (alert) =>
        isActiveCase(alert) &&
        alert?.priority === "Medium"
    );
  }

  if (activeFilter === "LOW") {
    filtered = filtered.filter(
      (alert) =>
        isActiveCase(alert) &&
        alert?.priority === "Low"
    );
  }

  if (caseStatusFilter !== "ALL") {
    filtered = filtered.filter(
      (alert) =>
        normalizeCaseStatus(alert?.status) ===
        caseStatusFilter
    );
  }

  if (search.trim()) {
    const keyword = normalizeText(search);

    filtered = filtered.filter((alert) =>
      [
        alert?.title,
        alert?.message,
        alert?.employee,
        alert?.violation,
        alert?.priority,
        normalizeCaseStatus(alert?.status),
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

function buildAlertCounts(alerts = []) {
  const safeAlerts = Array.isArray(alerts)
    ? alerts
    : [];

  const activeAlerts = safeAlerts.filter(
    isActiveCase
  );

  const uniqueActiveCases = new Set(
    activeAlerts.map(getUniqueIncidentKey)
  );

  return {
    active: uniqueActiveCases.size,

    unread: activeAlerts.filter(
      (alert) => !alert?.isRead
    ).length,

    high: activeAlerts.filter(
      (alert) => alert?.priority === "High"
    ).length,

    medium: activeAlerts.filter(
      (alert) => alert?.priority === "Medium"
    ).length,

    low: activeAlerts.filter(
      (alert) => alert?.priority === "Low"
    ).length,
  };
}

function formatRequestDate(value) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleString();
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getSessionToken() {
  return String(
    localStorage.getItem("token") || ""
  ).trim();
}

/*
 * PASSWORD RESET APPROVAL QUEUE
 *
 * Reviewers can approve or reject without selecting
 * an identity-verification method.
 *
 * The backend controls reviewer authorization,
 * request ownership, and reset-email delivery.
 */

function PasswordResetRequestsSection() {
  const [requests, setRequests] = useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [
    confirmRejectId,
    setConfirmRejectId,
  ] = useState(null);

  const [error, setError] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const loadRequests = useCallback(
    async ({ signal, initial = false } = {}) => {
      if (initial) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError("");

      try {
        const token = getSessionToken();

        if (!token) {
          throw new Error(
            "Your session is unavailable. Please sign in again."
          );
        }

        const response = await fetch(
          `${API_BASE}/auth/password-reset-requests`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            signal,
          }
        );

        const data = await readJsonResponse(
          response
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Your session has expired. Please sign in again."
            );
          }

          if (response.status === 403) {
            throw new Error(
              "You are not authorized to review password-reset requests."
            );
          }

          throw new Error(
            data?.message ||
              "Unable to load password-reset requests."
          );
        }

        if (!signal?.aborted) {
          setRequests(
            Array.isArray(data?.requests)
              ? data.requests
              : []
          );
        }
      } catch (requestError) {
        if (
          signal?.aborted ||
          requestError?.name === "AbortError"
        ) {
          return;
        }

        setError(
          requestError?.message ||
            "Unable to load password-reset requests."
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    loadRequests({
      signal: controller.signal,
      initial: true,
    });

    return () => {
      controller.abort();
    };
  }, [loadRequests]);

  const refreshRequests = async () => {
    if (
      isProcessing ||
      isRefreshing ||
      isLoading
    ) {
      return;
    }

    await loadRequests();
  };

  const submitDecision = async ({
    requestId,
    decision,
  }) => {
    if (isProcessing) {
      return;
    }

    if (
      !/^[1-9]\d*$/.test(
        String(requestId ?? "")
      )
    ) {
      setError(
        "Invalid password-reset request."
      );

      return;
    }

    if (
      !["approve", "reject"].includes(decision)
    ) {
      setError(
        "Invalid review decision."
      );

      return;
    }

    setIsProcessing(true);
    setError("");
    setSuccessMessage("");

    try {
      const token = getSessionToken();

      if (!token) {
        throw new Error(
          "Your session is unavailable. Please sign in again."
        );
      }

      const response = await fetch(
        `${API_BASE}/auth/password-reset-requests/${encodeURIComponent(
          String(requestId)
        )}/${decision}`,
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          /*
           * The backend no longer requires
           * verificationMethod or identityVerified.
           */
          body: JSON.stringify({}),
        }
      );

      const data = await readJsonResponse(
        response
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "You are not authorized to process this request."
          );
        }

        if (response.status === 409) {
          throw new Error(
            "This request is unavailable, expired, or already processed. Refresh the queue."
          );
        }

        throw new Error(
          data?.message ||
            "The request could not be processed. Refresh the queue to check its current status."
        );
      }

      setSuccessMessage(
        data?.message ||
          (decision === "approve"
            ? "Password-reset request approved."
            : "Password-reset request rejected.")
      );

      setConfirmRejectId(null);

      /*
       * The processed request should disappear
       * from the pending queue.
       */
      await loadRequests();
    } catch (decisionError) {
      /*
       * If the network fails after the backend has
       * processed the decision, do not automatically
       * resend the approval.
       */

      setError(
        decisionError?.message ||
          "The request outcome could not be confirmed. Refresh the queue before trying again."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <FiUserCheck aria-hidden="true" />
            Account recovery
          </div>

          <h2 className="text-xl font-black text-gray-900 dark:text-white">
            Pending Password Reset Requests
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Review each account-recovery request before
            approving or rejecting it. Approved requests
            generate a reset link sent only to the
            account&apos;s registered and verified
            recovery email.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshRequests}
          disabled={
            isLoading ||
            isRefreshing ||
            isProcessing
          }
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          <FiRefreshCw
            aria-hidden="true"
            className={
              isRefreshing
                ? "animate-spin"
                : ""
            }
          />

          {isRefreshing
            ? "Refreshing..."
            : "Refresh Requests"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div
          role="status"
          className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm text-gray-600 dark:border-white/10 dark:bg-slate-800/60 dark:text-gray-300"
        >
          Loading password-reset requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <FiCheckCircle
            size={30}
            className="mx-auto text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />

          <p className="mt-3 font-bold text-gray-900 dark:text-white">
            No pending requests available
          </p>

          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            New eligible requests will appear here
            when available for your review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            {requests.length} request
            {requests.length === 1 ? "" : "s"} available
            for review
          </p>

          {requests.map((request) => {
            const requestId = String(request.id);

            const isConfirmingRejection =
              String(confirmRejectId) ===
              requestId;

            return (
              <article
                key={requestId}
                className="rounded-2xl border border-gray-200 p-4 sm:p-5 dark:border-slate-700"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        PENDING
                      </span>

                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Request #{requestId}
                      </span>
                    </div>

                    <h3 className="break-words text-base font-bold text-gray-900 dark:text-white">
                      {request.fullName ||
                        "Account holder"}
                    </h3>

                    <p className="break-words text-sm text-gray-600 dark:text-gray-300">
                      Username:{" "}
                      <span className="font-semibold">
                        {request.username}
                      </span>
                    </p>

                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Role:{" "}
                      <span className="font-semibold">
                        {String(
                          request.requesterRole || ""
                        ).replace(/_/g, " ")}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5">
                        <FiClock aria-hidden="true" />

                        Requested:{" "}
                        {formatRequestDate(
                          request.requestedAt
                        )}
                      </span>

                      <span>
                        Expires:{" "}
                        {formatRequestDate(
                          request.expiresAt
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        submitDecision({
                          requestId,
                          decision: "approve",
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiCheckCircle aria-hidden="true" />

                      {isProcessing
                        ? "Processing..."
                        : "Approve"}
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setError("");
                        setSuccessMessage("");

                        setConfirmRejectId(
                          isConfirmingRejection
                            ? null
                            : requestId
                        );
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <FiXCircle aria-hidden="true" />

                      Reject
                    </button>
                  </div>
                </div>

                {isConfirmingRejection && (
                  <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                      Reject this password-reset request?
                    </p>

                    <p className="text-xs leading-5 text-red-700 dark:text-red-300">
                      A rejected request will not generate
                      a password-reset email.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          submitDecision({
                            requestId,
                            decision: "reject",
                          })
                        }
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isProcessing
                          ? "Processing..."
                          : "Confirm Rejection"}
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          setConfirmRejectId(null)
                        }
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-slate-600 dark:text-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
        Only one authorized reviewer can process each
        request. Requests may become unavailable when
        they expire, the account changes, or another
        reviewer processes them first.
      </p>
    </section>
  );
}

/*
 * EXISTING SMART INCIDENT ALERTS
 *
 * Preserve incident-alert functionality for
 * Super Admin, HR Manager, and HR Staff.
 *
 * Do not fetch incident alerts for IT Support
 * or HR Coordinator.
 */

function IncidentAlertsSection({ user }) {
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] =
    useState("ALL");

  const [caseStatusFilter, setCaseStatusFilter] =
    useState("ALL");

  const [search, setSearch] = useState("");

  const {
    alerts,
    isLoading,
    isFetching,
    error,
    refresh,
    markAlertAsRead,
    markAllAsRead,
  } = useSmartNotifications(user, {
    pollInterval: 0,
  });

  const counts = useMemo(
    () => buildAlertCounts(alerts),
    [alerts]
  );

  const visibleAlerts = useMemo(
    () =>
      filterAlerts(
        alerts,
        activeFilter,
        caseStatusFilter,
        search
      ),
    [
      alerts,
      activeFilter,
      caseStatusFilter,
      search,
    ]
  );

  const handleRefresh = async () => {
    try {
      await refresh();
    } catch (refreshError) {
      console.error(
        "Failed to refresh smart alerts:",
        refreshError
      );
    }
  };

  const handleViewAlert = async (alert) => {
    if (!alert) {
      return;
    }

    if (
      alert.route === "/incidents" &&
      alert.incidentId
    ) {
      navigate("/incidents", {
        state: {
          incidentId: alert.incidentId,
        },
      });
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
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">
            Smart Incident Alerts
          </h2>

          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {getPageSubtitle(user?.role)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw
              aria-hidden="true"
              className={
                isFetching
                  ? "animate-spin"
                  : ""
              }
            />

            {isFetching
              ? "Syncing..."
              : "Sync Alerts"}
          </button>

          <button
            type="button"
            onClick={markAllAsRead}
            disabled={
              alerts.length === 0 ||
              counts.unread === 0
            }
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-slate-800"
          >
            <FiCheckCircle aria-hidden="true" />

            Mark All Read
          </button>
        </div>
      </div>

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
          notifications={visibleAlerts}
          counts={counts}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          caseStatusFilter={caseStatusFilter}
          onCaseStatusFilterChange={
            setCaseStatusFilter
          }
          search={search}
          onSearchChange={setSearch}
          onViewAlert={handleViewAlert}
          onMarkRead={markAlertAsRead}
        />
      )}
    </section>
  );
}

/*
 * NOTIFICATIONS PAGE
 */

export default function Notifications() {
  const { user } = useAuth();

  const role = user?.role;

  const canViewIncidentAlerts =
    INCIDENT_ALERT_ROLES.has(role);

  const canReviewPasswordResets =
    PASSWORD_RESET_REVIEWER_ROLES.has(role);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-sm">
        <div className="relative overflow-hidden px-6 py-7 sm:px-8">
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white/90">
              <FiShield aria-hidden="true" />

              Account &amp; Incident Monitoring
            </div>

            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
              <span className="rounded-2xl bg-white/15 p-3">
                <FiBell aria-hidden="true" />
              </span>

              Notifications Center
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">
              {getPageSubtitle(role)}
            </p>
          </div>
        </div>
      </section>

      {canReviewPasswordResets && (
        <PasswordResetRequestsSection />
      )}

      {canViewIncidentAlerts && (
        <IncidentAlertsSection user={user} />
      )}

      {!canReviewPasswordResets &&
        !canViewIncidentAlerts && (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
            No notifications are currently available
            on this page for your account.
          </div>
        )}
    </div>
  );
}
