import { useCallback, useEffect, useMemo, useState, } from "react";
import { FiBell, FiCheckCircle, FiClock, FiRefreshCw, FiShield, FiUserCheck, FiXCircle, } from "react-icons/fi";
import { useNavigate, } from "react-router-dom";
import NotificationTable from "../components/notifications/NotificationTable";
import { useAuth } from "../context/useAuth";
import useSmartNotifications from "../hooks/useSmartNotifications";
import { API_BASE } from "../config/api";
import { sortSmartAlertsByRecency, } from "../utils/notifications/smartNotifications";
const NOTIFICATION_ALERT_ROLES = new Set([
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR",
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
const NOTIFICATION_TIME_ZONE = "Asia/Manila";
function getPageSubtitle(role) {
    if (role === "SUPER_ADMIN") {
        return "Review HR notifications and password reset requests available for your approval.";
    }
    if (role === "IT_SUPPORT") {
        return "Review password reset requests available for IT Support approval.";
    }
    if (role === "HR_COORDINATOR") {
        return "View incident notifications within your assigned client company scope.";
    }
    if (role === "HR_STAFF") {
        return "View employee, deployment, compliance, and incident notifications available to your role.";
    }
    if (role === "HR_MANAGER") {
        return "Review workforce, compliance, deployment, and incident notifications requiring HR attention.";
    }
    return "View notifications available to your account.";
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
    if (normalized === "for review" ||
        normalized === "resolved") {
        return "For Review";
    }
    if (normalized === "closed") {
        return "Closed";
    }
    return "Open";
}
function isComplianceNotification(alert) {
    const sourceType = String(alert?.sourceType ||
        "")
        .trim()
        .toUpperCase();
    const purpose = String(alert?.notificationPurpose ||
        "")
        .trim()
        .toUpperCase();
    return (sourceType === "COMPLIANCE" ||
        purpose === "COMPLIANCE_EXPIRED" ||
        purpose === "COMPLIANCE_EXPIRING_SOON");
}
function getComplianceNavigationTarget(alert) {
    return {
        employeeId: alert?.employeeId ??
            alert?.employee_id ??
            alert?.employeeRecordId ??
            alert?.employee_record_id ??
            alert?.employee?.id ??
            null,
        documentId: alert?.documentId ??
            alert?.document_id ??
            alert?.document?.id ??
            null,
        documentName: String(alert?.documentName ??
            alert?.document_name ??
            alert?.document?.name ??
            "").trim(),
    };
}
function isIncidentNotification(alert) {
    const sourceType = String(alert?.sourceType ||
        "")
        .trim()
        .toUpperCase();
    return (sourceType === "INCIDENT" ||
        (alert?.route === "/incidents" &&
            Boolean(alert?.incidentId ||
                alert?.incident_id)));
}
function getUniqueNotificationKey(alert, index) {
    return String(alert?.alertKey ||
        alert?.incidentId ||
        alert?.incident_id ||
        alert?.caseId ||
        alert?.case_id ||
        `alert-${index}`);
}
function isActiveNotification(alert, includeClosed = false) {
    if (!isIncidentNotification(alert)) {
        return true;
    }
    if (includeClosed) {
        return true;
    }
    return ACTIVE_CASE_STATUSES.has(normalizeCaseStatus(alert?.status));
}
function filterAlerts(alerts, activeFilter, caseStatusFilter, search, includeClosed = false) {
    let filtered = Array.isArray(alerts)
        ? [...alerts]
        : [];
    filtered =
        filtered.filter((alert) => isActiveNotification(alert, includeClosed));
    if (activeFilter === "UNREAD") {
        filtered =
            filtered.filter((alert) => !alert?.isRead);
    }
    if (activeFilter === "HIGH") {
        filtered =
            filtered.filter((alert) => alert?.priority ===
                "High");
    }
    if (activeFilter === "MEDIUM") {
        filtered =
            filtered.filter((alert) => alert?.priority ===
                "Medium");
    }
    if (activeFilter === "LOW") {
        filtered =
            filtered.filter((alert) => alert?.priority ===
                "Low");
    }
    /*

     * Case Status is an incident-only filter.

     * Compliance/deployment notifications are intentionally

     * excluded when a specific incident case status is selected.

     */
    if (caseStatusFilter !==
        "ALL") {
        filtered =
            filtered.filter((alert) => isIncidentNotification(alert) &&
                normalizeCaseStatus(alert?.status) ===
                    caseStatusFilter);
    }
    if (search.trim()) {
        const keyword = normalizeText(search);
        filtered =
            filtered.filter((alert) => [
                alert?.title,
                alert?.message,
                alert?.employee,
                alert?.employeeName,
                alert?.documentName,
                alert?.violation,
                alert?.priority,
                alert?.status,
                alert?.reason,
                alert?.recommendedAction,
            ]
                .join(" ")
                .toLowerCase()
                .includes(keyword));
    }
    return sortSmartAlertsByRecency(filtered);
}
function buildAlertCounts(alerts = [], includeClosed = false) {
    const safeAlerts = Array.isArray(alerts)
        ? alerts
        : [];
    const activeAlerts = safeAlerts.filter((alert) => isActiveNotification(alert, includeClosed));
    const uniqueActiveNotifications = new Set(activeAlerts.map(getUniqueNotificationKey));
    return {
        active: uniqueActiveNotifications.size,
        unread: activeAlerts.filter((alert) => !alert?.isRead).length,
        high: activeAlerts.filter((alert) => alert?.priority ===
            "High").length,
        medium: activeAlerts.filter((alert) => alert?.priority ===
            "Medium").length,
        low: activeAlerts.filter((alert) => alert?.priority ===
            "Low").length,
    };
}
function formatRequestDate(value) {
    if (value === null ||
        value === undefined ||
        value === "") {
        return "Not available";
    }
    let parsed = null;
    if (value instanceof Date) {
        parsed = value;
    }
    else if (typeof value ===
        "number") {
        const milliseconds = value <
            100000000000
            ? value * 1000
            : value;
        parsed =
            new Date(milliseconds);
    }
    else {
        const normalized = String(value).trim();
        if (!normalized) {
            return "Not available";
        }
        if (/^\d{10,13}$/.test(normalized)) {
            const numericValue = Number(normalized);
            const milliseconds = numericValue <
                100000000000
                ? numericValue * 1000
                : numericValue;
            parsed =
                new Date(milliseconds);
        }
        else {
            /*

             * Historical password reset DATETIME values may

             * arrive without an explicit timezone. Preserve

             * the stored Welljob wall-clock value as Manila

             * time instead of applying an unverified blanket

             * UTC conversion.

             *

             * ISO values that already contain Z or an offset

             * are treated as absolute instants and formatted

             * in Asia/Manila below.

             */
            const timezoneLessMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?$/);
            if (timezoneLessMatch) {
                const millisecondsPart = timezoneLessMatch[3]
                    ? `.${timezoneLessMatch[3].padEnd(3, "0")}`
                    : "";
                parsed =
                    new Date(`${timezoneLessMatch[1]}T${timezoneLessMatch[2]}${millisecondsPart}+08:00`);
            }
            else {
                parsed =
                    new Date(normalized);
            }
        }
    }
    if (!parsed ||
        Number.isNaN(parsed.getTime())) {
        return "Not available";
    }
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: NOTIFICATION_TIME_ZONE,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    }).format(parsed);
}
async function readJsonResponse(response) {
    try {
        return await response.json();
    }
    catch {
        return null;
    }
}
function getSessionToken() {
    return String(localStorage.getItem("token") || "").trim();
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
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [confirmRejectId, setConfirmRejectId,] = useState(null);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage,] = useState("");
    const loadRequests = useCallback(async ({ signal, initial = false } = {}) => {
        if (initial) {
            setIsLoading(true);
        }
        else {
            setIsRefreshing(true);
        }
        setError("");
        try {
            const token = getSessionToken();
            if (!token) {
                throw new Error("Your session is unavailable. Please sign in again.");
            }
            const response = await fetch(`${API_BASE}/auth/password-reset-requests`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
                signal,
            });
            const data = await readJsonResponse(response);
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Your session has expired. Please sign in again.");
                }
                if (response.status === 403) {
                    throw new Error("You are not authorized to review password reset requests.");
                }
                throw new Error(
                    "Unable to load password reset requests. Please try again."
                );
            }
            if (!signal?.aborted) {
                setRequests(Array.isArray(data?.requests)
                    ? data.requests
                    : []);
            }
        }
        catch (requestError) {
            if (signal?.aborted ||
                requestError?.name === "AbortError") {
                return;
            }
            setError([
                "Your session has expired. Please sign in again.",
                "Your session is unavailable. Please sign in again.",
                "You are not authorized to review password reset requests.",
            ].includes(requestError?.message)
                ? requestError.message
                : "Unable to load password reset requests. Please try again.");
        }
        finally {
            if (!signal?.aborted) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, []);
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
        if (isProcessing ||
            isRefreshing ||
            isLoading) {
            return;
        }
        await loadRequests();
    };
    const submitDecision = async ({ requestId, decision, }) => {
        if (isProcessing) {
            return;
        }
        if (!/^[1-9]\d*$/.test(String(requestId ?? ""))) {
            setError("Invalid password reset request.");
            return;
        }
        if (!["approve", "reject"].includes(decision)) {
            setError("Invalid review decision.");
            return;
        }
        setIsProcessing(true);
        setError("");
        setSuccessMessage("");
        try {
            const token = getSessionToken();
            if (!token) {
                throw new Error("Your session is unavailable. Please sign in again.");
            }
            const response = await fetch(`${API_BASE}/auth/password-reset-requests/${encodeURIComponent(String(requestId))}/${decision}`, {
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
            });
            await readJsonResponse(response);
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Your session has expired. Please sign in again.");
                }
                if (response.status === 403) {
                    throw new Error("You are not authorized to process this request.");
                }
                if (response.status === 409) {
                    throw new Error("This request is unavailable, expired, or already processed. Refresh the list.");
                }
                throw new Error(
                    "The request could not be processed. Refresh the list to check its current status."
                );
            }
            setSuccessMessage(decision === "approve"
                ? "Password reset request approved."
                : "Password reset request rejected.");
            setConfirmRejectId(null);
            /*

             * The processed request should disappear

             * from the pending queue.

             */
            await loadRequests();
        }
        catch (decisionError) {
            /*

             * If the network fails after the backend has

             * processed the decision, do not automatically

             * resend the approval.

             */
            setError([
                "Your session has expired. Please sign in again.",
                "Your session is unavailable. Please sign in again.",
                "You are not authorized to process this request.",
                "This request is unavailable, expired, or already processed. Refresh the list.",
                "The request could not be processed. Refresh the list to check its current status.",
            ].includes(decisionError?.message)
                ? decisionError.message
                : "The request outcome could not be confirmed. Refresh the list before trying again.");
        }
        finally {
            setIsProcessing(false);
        }
    };
    return (<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div>

          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">

            <FiUserCheck aria-hidden="true"/>

            Account Recovery

          </div>

          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">

            Password Reset Requests

          </h2>

          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">

            Review each account-recovery request before

            approving or rejecting it. Approved requests

            generate a reset link sent only to the

            account&apos;s registered and verified

            recovery email.

          </p>

        </div>

        <button type="button" onClick={refreshRequests} disabled={isLoading ||
            isRefreshing ||
            isProcessing} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">

          <FiRefreshCw aria-hidden="true" className={isRefreshing
            ? "animate-spin"
            : ""}/>

          {isRefreshing
            ? "Refreshing..."
            : "Refresh Requests"}

        </button>

      </div>

      {error && (<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">

          {error}

        </div>)}

      {successMessage && (<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">

          {successMessage}

        </div>)}

      {isLoading ? (<div role="status" className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm text-gray-600 dark:border-white/10 dark:bg-slate-800/60 dark:text-gray-300">

          Loading password reset requests...

        </div>) : requests.length === 0 ? (<div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">

          <FiCheckCircle size={30} className="mx-auto text-emerald-600 dark:text-emerald-400" aria-hidden="true"/>

          <p className="mt-3 font-bold text-gray-900 dark:text-white">

            No Pending Requests

          </p>

          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">

            New eligible requests will appear here

            when available for your review.

          </p>

        </div>) : (<div className="space-y-4">

          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">

            {requests.length} request

            {requests.length === 1 ? "" : "s"} available

            for review

          </p>

          {requests.map((request) => {
                const requestId = String(request.id);
                const isConfirmingRejection = String(confirmRejectId) ===
                    requestId;
                return (<article key={requestId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/30">

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

                        {String(request.requesterRole || "").replace(/_/g, " ")}

                      </span>

                    </p>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">

                      <span className="inline-flex items-center gap-1.5">

                        <FiClock aria-hidden="true"/>

                        Requested:{" "}

                        {formatRequestDate(request.requestedAt)}

                      </span>

                      <span>

                        Expires:{" "}

                        {formatRequestDate(request.expiresAt)}

                      </span>

                    </div>

                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">

                    <button type="button" disabled={isProcessing} onClick={() => submitDecision({
                        requestId,
                        decision: "approve",
                    })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">

                      <FiCheckCircle aria-hidden="true"/>

                      {isProcessing
                        ? "Processing..."
                        : "Approve"}

                    </button>

                    <button type="button" disabled={isProcessing} onClick={() => {
                        setError("");
                        setSuccessMessage("");
                        setConfirmRejectId(isConfirmingRejection
                            ? null
                            : requestId);
                    }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10">

                      <FiXCircle aria-hidden="true"/>

                      Reject

                    </button>

                  </div>

                </div>

                {isConfirmingRejection && (<div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">

                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">

                      Reject this password reset request?

                    </p>

                    <p className="text-xs leading-5 text-red-700 dark:text-red-300">

                      A rejected request will not generate

                      a password reset email.

                    </p>

                    <div className="flex flex-wrap gap-2">

                      <button type="button" disabled={isProcessing} onClick={() => submitDecision({
                            requestId,
                            decision: "reject",
                        })} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">

                        {isProcessing
                            ? "Processing..."
                            : "Confirm Rejection"}

                      </button>

                      <button type="button" disabled={isProcessing} onClick={() => setConfirmRejectId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-slate-600 dark:text-gray-200">

                        Cancel

                      </button>

                    </div>

                  </div>)}

              </article>);
            })}

        </div>)}

      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">

        Only one authorized reviewer can process each

        request. Requests may become unavailable when

        they expire, the account changes, or another

        reviewer processes them first.

      </p>

    </section>);
}
/*

 * EXISTING SMART INCIDENT ALERTS

 *

 * Preserve incident-alert functionality for internal

 * HR roles and expose assigned-company reviewer outcomes

 * to HR Coordinator.

 */
function NotificationAlertsSection({ user }) {
    const navigate = useNavigate();
    /*

     * Notifications is the long-term history feed.

     * Read and closed workflow notifications remain

     * available here for every authorized role.

     */
    const includeClosed = true;
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [caseStatusFilter, setCaseStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const { alerts, isLoading, isFetching, error, refresh, markAlertAsRead, markAllAsRead, } = useSmartNotifications(user, {
        pollInterval: 0,
    });
    const counts = useMemo(() => buildAlertCounts(alerts, includeClosed), [
        alerts,
        includeClosed,
    ]);
    const visibleAlerts = useMemo(() => filterAlerts(alerts, activeFilter, caseStatusFilter, search, includeClosed), [
        alerts,
        activeFilter,
        caseStatusFilter,
        search,
        includeClosed,
    ]);
    const handleRefresh = async () => {
        try {
            await refresh();
        }
        catch (refreshError) {
            console.error("Failed to refresh notifications:", refreshError);
        }
    };
    const handleViewAlert = async (alert) => {
        if (!alert) {
            return;
        }
        try {
            await markAlertAsRead(alert.alertKey);
        }
        catch (readError) {
            console.error("Failed to mark notification as read:", readError);
        }
        if (alert.route ===
            "/incidents" &&
            alert.incidentId) {
            navigate("/incidents", {
                state: {
                    incidentId: alert.incidentId,
                    action: alert.navigationAction ||
                        alert.action ||
                        "view",
                },
            });
            return;
        }
        if (isComplianceNotification(alert)) {
            const complianceTarget = getComplianceNavigationTarget(alert);
            if (complianceTarget.employeeId) {
                navigate("/employees", {
                    state: {
                        smartAlertEmployeeTarget: {
                            employeeId: complianceTarget.employeeId,
                            openCompliance: true,
                            documentId: complianceTarget.documentId ||
                                null,
                            documentName: complianceTarget.documentName,
                            alertKey: alert.alertKey ||
                                "",
                        },
                    },
                });
                return;
            }
        }
        navigate(alert.route ||
            "/notifications");
    };
    return (<section className="space-y-3">

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">

            HR Notifications

          </h2>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">

            {includeClosed
            ? "Review workforce, compliance, deployment, and incident notifications available to your role."
            : "Review workforce, compliance, deployment, and incident notifications available to your role."}

          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          <button type="button" onClick={handleRefresh} disabled={isFetching} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">

            <FiRefreshCw aria-hidden="true" className={isFetching
            ? "animate-spin"
            : ""}/>

            {isFetching
            ? "Refreshing..."
            : "Refresh Notifications"}

          </button>

          <button type="button" onClick={markAllAsRead} disabled={alerts.length === 0 ||
            counts.unread === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">

            <FiCheckCircle aria-hidden="true"/>

            Mark all as read

          </button>

        </div>

      </div>

      {error && (<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">

          {error}

        </div>)}

      {isLoading ? (<div role="status" className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center text-sm font-semibold text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">

          Loading notifications...

        </div>) : (<NotificationTable notifications={visibleAlerts} counts={counts} activeFilter={activeFilter} onFilterChange={setActiveFilter} caseStatusFilter={caseStatusFilter} onCaseStatusFilterChange={setCaseStatusFilter} search={search} onSearchChange={setSearch} onViewAlert={handleViewAlert} onMarkRead={markAlertAsRead}/>)}

    </section>);
}
/*

 * NOTIFICATIONS PAGE

 */
export default function Notifications() {
    const { user } = useAuth();
    const role = user?.role;
    const canViewNotifications = NOTIFICATION_ALERT_ROLES.has(role);
    const canReviewPasswordResets = PASSWORD_RESET_REVIEWER_ROLES.has(role);
    return (<div className="space-y-5">

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6">

        <div className="flex items-start gap-4">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">

            <FiBell size={20} aria-hidden="true"/>

          </div>

          <div className="min-w-0">

            <div className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">

              <FiShield aria-hidden="true"/>

              Notifications &amp; Account Requests

            </div>

            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">

              Notifications

            </h1>

            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">

              {getPageSubtitle(role)}

            </p>

          </div>

        </div>

      </section>

      {canReviewPasswordResets && (<PasswordResetRequestsSection />)}

      {canViewNotifications && (<NotificationAlertsSection user={user}/>)}

      {!canReviewPasswordResets &&
            !canViewNotifications && (<div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">

            No notifications are currently available

            on this page for your account.

          </div>)}

    </div>);
}