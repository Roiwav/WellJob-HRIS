import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FiAlertTriangle,
  FiPower,
  FiRefreshCw,
  FiServer,
  FiShield,
} from "react-icons/fi";
import axios from "axios";

import { API_BASE } from "../config/api";

import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ErrorState from "../components/ui/ErrorState";
import SuccessToast from "../components/ui/SuccessToast";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";

const MAINTENANCE_STATUS_URL =
  `${API_BASE}/settings/maintenance-status`;

const TOGGLE_MAINTENANCE_URL =
  `${API_BASE}/settings/toggle-maintenance`;

const REQUEST_TIMEOUT_MS = 15000;

function getAuthenticatedHeaders(
  additionalHeaders = {}
) {
  const token = String(
    localStorage.getItem("token") || ""
  ).trim();

  return {
    Accept: "application/json",
    ...additionalHeaders,
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

function getApiError(
  error,
  fallbackMessage
) {
  if (
    error?.code === "ECONNABORTED" ||
    error?.name === "AbortError"
  ) {
    return "The server took too long to respond. Check that the backend and database are running, then try again.";
  }

  if (error?.response?.status === 401) {
    return "Your session is missing or expired. Please log in again.";
  }

  if (error?.response?.status === 403) {
    return "You do not have permission to access system maintenance controls.";
  }

  if (error?.response?.status === 503) {
    return "The system is currently unavailable. Please try again later.";
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

function normalizeMaintenanceStatus(data) {
  return (
    data?.isMaintenanceOn === true ||
    data?.isMaintenanceOn === 1 ||
    data?.isMaintenanceOn === "1" ||
    data?.maintenanceMode === true ||
    data?.maintenanceMode === 1 ||
    data?.maintenanceMode === "1" ||
    data?.status === true ||
    data?.status === 1 ||
    data?.status === "1"
  );
}

export default function SystemMaintenance() {
  const [
    isMaintenanceOn,
    setIsMaintenanceOn,
  ] = useState(false);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    isUpdating,
    setIsUpdating,
  ] = useState(false);

  const [
    showConfirmDialog,
    setShowConfirmDialog,
  ] = useState(false);

  const [pageError, setPageError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchMaintenanceStatus =
    useCallback(
      async ({
        showInitialLoading = false,
        showRefreshing = false,
        showError = true,
      } = {}) => {
        if (showInitialLoading) {
          setIsLoading(true);
        }

        if (showRefreshing) {
          setIsRefreshing(true);
        }

        try {
          if (showError) {
            setPageError("");
          }

          const response =
            await axios.get(
              MAINTENANCE_STATUS_URL,
              {
                timeout:
                  REQUEST_TIMEOUT_MS,

                headers:
                  getAuthenticatedHeaders(),
              }
            );

          if (!isMountedRef.current) {
            return false;
          }

          setIsMaintenanceOn(
            normalizeMaintenanceStatus(
              response.data
            )
          );

          return true;
        } catch (error) {
          console.error(
            "Error fetching maintenance status:",
            error
          );

          if (
            showError &&
            isMountedRef.current
          ) {
            setPageError(
              getApiError(
                error,
                "Unable to load the current maintenance status."
              )
            );
          }

          return false;
        } finally {
          if (isMountedRef.current) {
            if (showInitialLoading) {
              setIsLoading(false);
            }

            if (showRefreshing) {
              setIsRefreshing(false);
            }
          }
        }
      },
      []
    );

  useEffect(() => {
    void fetchMaintenanceStatus({
      showInitialLoading: true,
    });
  }, [fetchMaintenanceStatus]);

  const handleRefresh =
    useCallback(async () => {
      if (
        isLoading ||
        isRefreshing ||
        isUpdating
      ) {
        return;
      }

      await fetchMaintenanceStatus({
        showRefreshing: true,
      });
    }, [
      fetchMaintenanceStatus,
      isLoading,
      isRefreshing,
      isUpdating,
    ]);

  const handleOpenConfirmation =
    useCallback(() => {
      if (
        isLoading ||
        isRefreshing ||
        isUpdating
      ) {
        return;
      }

      setPageError("");
      setShowConfirmDialog(true);
    }, [
      isLoading,
      isRefreshing,
      isUpdating,
    ]);

  const handleCloseConfirmation =
    useCallback(() => {
      if (isUpdating) {
        return;
      }

      setShowConfirmDialog(false);
    }, [isUpdating]);

  const handleConfirmToggle =
    useCallback(async () => {
      if (isUpdating) {
        return;
      }

      const nextMaintenanceStatus =
        !isMaintenanceOn;

      try {
        setIsUpdating(true);
        setPageError("");

        await axios.post(
          TOGGLE_MAINTENANCE_URL,
          {
            status:
              nextMaintenanceStatus,
          },
          {
            timeout:
              REQUEST_TIMEOUT_MS,

            headers:
              getAuthenticatedHeaders({
                "Content-Type":
                  "application/json",
              }),
          }
        );

        if (!isMountedRef.current) {
          return;
        }

        setIsMaintenanceOn(
          nextMaintenanceStatus
        );

        setShowConfirmDialog(false);

        setSuccessMessage(
          nextMaintenanceStatus
            ? "Maintenance mode was enabled successfully."
            : "Maintenance mode was disabled successfully."
        );

        window.dispatchEvent(
          new CustomEvent(
            "dataUpdated",
            {
              detail: {
                source:
                  "system-maintenance-page",

                domain:
                  "system-settings",

                action:
                  nextMaintenanceStatus
                    ? "ENABLE_MAINTENANCE_MODE"
                    : "DISABLE_MAINTENANCE_MODE",

                at: Date.now(),
              },
            }
          )
        );
      } catch (error) {
        console.error(
          "Error toggling maintenance mode:",
          error
        );

        if (isMountedRef.current) {
          setPageError(
            getApiError(
              error,
              "Unable to update maintenance mode."
            )
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsUpdating(false);
        }
      }
    }, [
      isMaintenanceOn,
      isUpdating,
    ]);

  const targetStatus =
    isMaintenanceOn
      ? "disabled"
      : "enabled";

  const confirmationTitle =
    isMaintenanceOn
      ? "Disable Maintenance Mode"
      : "Enable Maintenance Mode";

  const confirmationLabel =
    isMaintenanceOn
      ? "Disable Maintenance"
      : "Enable Maintenance";

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Technical Administration"
        title="System Maintenance Control"
        description="Control system-wide maintenance access for authorized technical operations."
        icon={
          <FiServer size={22} />
        }
        actions={
          <Button
            variant="secondary"
            leftIcon={
              <FiRefreshCw
                className={
                  isRefreshing
                    ? "animate-spin"
                    : ""
                }
                aria-hidden="true"
              />
            }
            loading={isRefreshing}
            disabled={
              isLoading ||
              isRefreshing ||
              isUpdating
            }
            onClick={handleRefresh}
          >
            Refresh Status
          </Button>
        }
      />

      {pageError && (
        <ErrorState
          compact
          title="Maintenance control error"
          message={pageError}
          retryLabel="Reload status"
          onRetry={handleRefresh}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton
          rows={3}
          columns={2}
          showHeader
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <header className="border-b border-gray-200 px-5 py-5 sm:px-6 dark:border-white/10">
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                    isMaintenanceOn
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
                  ].join(" ")}
                >
                  <FiPower
                    size={22}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                    Maintenance Mode
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Enable this mode only during scheduled maintenance, critical fixes, or controlled system recovery.
                  </p>
                </div>
              </div>
            </header>

            <div className="space-y-5 p-5 sm:p-6">
              <div
                className={[
                  "rounded-2xl border p-5",
                  isMaintenanceOn
                    ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                    : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Current Status
                    </p>

                    <p
                      className={[
                        "mt-2 text-2xl font-black",
                        isMaintenanceOn
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-emerald-700 dark:text-emerald-300",
                      ].join(" ")}
                    >
                      {isMaintenanceOn
                        ? "Maintenance Active"
                        : "System Available"}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {isMaintenanceOn
                        ? "Regular users are currently blocked from accessing the system."
                        : "Authorized users can currently access the system normally."}
                    </p>
                  </div>

                  <span
                    className={[
                      "inline-flex w-fit items-center rounded-full px-4 py-2 text-xs font-extrabold",
                      isMaintenanceOn
                        ? "bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
                        : "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
                    ].join(" ")}
                  >
                    {isMaintenanceOn
                      ? "ON"
                      : "OFF"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-500/30 dark:bg-red-500/10">
                <div className="flex items-start gap-3">
                  <FiAlertTriangle
                    className="mt-0.5 shrink-0 text-red-600 dark:text-red-300"
                    size={20}
                    aria-hidden="true"
                  />

                  <div>
                    <h3 className="font-extrabold text-red-800 dark:text-red-300">
                      Restricted Access Warning
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-red-700 dark:text-red-300">
                      When maintenance mode is enabled, HR Staff, HR Manager, and Super Admin accounts are blocked. Only authorized IT Support users retain access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-200 pt-5 dark:border-white/10">
                <Button
                  variant={
                    isMaintenanceOn
                      ? "success"
                      : "danger"
                  }
                  leftIcon={
                    <FiPower
                      aria-hidden="true"
                    />
                  }
                  loading={isUpdating}
                  disabled={
                    isRefreshing ||
                    isUpdating
                  }
                  onClick={
                    handleOpenConfirmation
                  }
                >
                  {isMaintenanceOn
                    ? "Turn Maintenance Off"
                    : "Turn Maintenance On"}
                </Button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  <FiShield
                    size={20}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h2 className="font-extrabold text-gray-900 dark:text-white">
                    Authorized Access
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    IT Support remains available during maintenance for technical recovery and system validation.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
              <h2 className="font-extrabold text-gray-900 dark:text-white">
                Recommended Procedure
              </h2>

              <ol className="mt-4 space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                <li>
                  <strong>1.</strong> Inform affected users before enabling maintenance.
                </li>

                <li>
                  <strong>2.</strong> Complete database, backend, or deployment work.
                </li>

                <li>
                  <strong>3.</strong> Validate login, API, and database connectivity.
                </li>

                <li>
                  <strong>4.</strong> Disable maintenance only after validation succeeds.
                </li>
              </ol>
            </section>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={showConfirmDialog}
        title={confirmationTitle}
        tone={
          isMaintenanceOn
            ? "success"
            : "danger"
        }
        confirmLabel={
          confirmationLabel
        }
        cancelLabel="Cancel"
        loading={isUpdating}
        disabled={isUpdating}
        closeOnBackdrop={!isUpdating}
        onClose={
          handleCloseConfirmation
        }
        onConfirm={
          handleConfirmToggle
        }
      >
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          Are you sure you want maintenance mode to be{" "}
          <strong className="font-extrabold text-gray-900 dark:text-white">
            {targetStatus}
          </strong>
          ?
        </p>

        <div
          className={[
            "mt-4 rounded-2xl border p-4 text-sm leading-6",
            isMaintenanceOn
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
          ].join(" ")}
        >
          {isMaintenanceOn
            ? "Disabling maintenance mode will restore normal system access for authorized users."
            : "Enabling maintenance mode will immediately block HR Staff, HR Manager, and Super Admin access. IT Support will remain available."}
        </div>
      </ConfirmDialog>

      <SuccessToast
        title="Maintenance Mode Updated"
        message={successMessage}
        duration={3500}
        onClose={() =>
          setSuccessMessage("")
        }
      />
    </main>
  );
}