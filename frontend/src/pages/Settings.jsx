import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiCheckCircle,
  FiCopy,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiUserX,
  FiUsers,
} from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import StatusBadge from "../components/ui/StatusBadge";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Dialog from "../components/ui/Dialog";
import SuccessToast from "../components/ui/SuccessToast";

const API_BASE =
  "http://localhost:5000/api";

const REQUEST_TIMEOUT_MS = 15000;

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  IT_SUPPORT: "IT Support",
};

function getInitials(value) {
  return (
    String(value || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part[0]?.toUpperCase()
      )
      .join("") || "U"
  );
}

function getAccountName(account) {
  return (
    account?.full_name ||
    account?.fullName ||
    account?.name ||
    account?.username ||
    "Unknown User"
  );
}

function getAccountStatus(account) {
  const status = String(
    account?.status || "Inactive"
  )
    .trim()
    .toLowerCase();

  return status === "active"
    ? "Active"
    : "Inactive";
}

function getAccountKey(
  account,
  index
) {
  return (
    account?.id ||
    account?.user_id ||
    account?.userId ||
    account?.username ||
    `account-${index}`
  );
}

function getApiError(
  error,
  fallbackMessage
) {
  if (error?.name === "AbortError") {
    return "The server took too long to respond. Check that the backend and database are running, then try again.";
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

async function requestJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function AccountSummaryCard({
  label,
  value,
  helper,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
        {value}
      </p>

      {helper && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {helper}
        </p>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();

  const isSuperAdmin =
    user?.role === "SUPER_ADMIN";

  const [accounts, setAccounts] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [
    resetTarget,
    setResetTarget,
  ] = useState(null);

  const [
    toggleTarget,
    setToggleTarget,
  ] = useState(null);

  const [
    temporaryPassword,
    setTemporaryPassword,
  ] = useState("");

  const [pageError, setPageError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [copyText, setCopyText] =
    useState("Copy Password");

  const [
    isLoadingUsers,
    setIsLoadingUsers,
  ] = useState(true);

  const [
    isRefreshingUsers,
    setIsRefreshingUsers,
  ] = useState(false);

  const [
    processingAction,
    setProcessingAction,
  ] = useState("");

  const isMountedRef =
    useRef(true);

  const copyResetTimerRef =
    useRef(null);

  const isProcessing =
    Boolean(processingAction);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (copyResetTimerRef.current) {
        window.clearTimeout(
          copyResetTimerRef.current
        );
      }
    };
  }, []);

  const fetchUsers = useCallback(
    async ({
      showInitialLoading = false,
      showRefreshing = false,
      showError = true,
    } = {}) => {
      if (showInitialLoading) {
        setIsLoadingUsers(true);
      }

      if (showRefreshing) {
        setIsRefreshingUsers(true);
      }

      try {
        if (showError) {
          setPageError("");
        }

        const data =
          await requestJson(
            `${API_BASE}/users`
          );

        if (!isMountedRef.current) {
          return false;
        }

        setAccounts(
          Array.isArray(data)
            ? data
            : []
        );

        return true;
      } catch (error) {
        console.error(
          "Fetch users error:",
          error
        );

        if (
          showError &&
          isMountedRef.current
        ) {
          setPageError(
            getApiError(
              error,
              "Unable to load user accounts."
            )
          );
        }

        return false;
      } finally {
        if (isMountedRef.current) {
          if (showInitialLoading) {
            setIsLoadingUsers(false);
          }

          if (showRefreshing) {
            setIsRefreshingUsers(false);
          }
        }
      }
    },
    []
  );

  useEffect(() => {
    void fetchUsers({
      showInitialLoading: true,
    });
  }, [fetchUsers]);

  const filteredAccounts =
    useMemo(() => {
      const keyword = search
        .trim()
        .toLowerCase();

      if (!keyword) {
        return accounts;
      }

      return accounts.filter(
        (account) => {
          const searchableText = [
            account?.id,
            account?.user_id,
            account?.userId,
            account?.full_name,
            account?.fullName,
            account?.name,
            account?.username,
            account?.role,
            account?.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            keyword
          );
        }
      );
    }, [accounts, search]);

  const accountSummary =
    useMemo(() => {
      const activeUsers =
        accounts.filter(
          (account) =>
            getAccountStatus(account) ===
            "Active"
        ).length;

      return {
        total: accounts.length,
        active: activeUsers,
        inactive:
          accounts.length -
          activeUsers,
      };
    }, [accounts]);

  const handleRefresh =
    useCallback(async () => {
      if (
        isRefreshingUsers ||
        isLoadingUsers ||
        isProcessing
      ) {
        return;
      }

      await fetchUsers({
        showRefreshing: true,
      });
    }, [
      fetchUsers,
      isLoadingUsers,
      isProcessing,
      isRefreshingUsers,
    ]);

  const handleOpenReset =
    useCallback(
      (account) => {
        if (
          !account?.id ||
          isProcessing ||
          isSuperAdmin
        ) {
          return;
        }

        setPageError("");
        setTemporaryPassword("");
        setCopyText("Copy Password");
        setResetTarget(account);
      },
      [
        isProcessing,
        isSuperAdmin,
      ]
    );

  const handleCloseResetDialog =
    useCallback(() => {
      if (isProcessing) {
        return;
      }

      setResetTarget(null);
    }, [isProcessing]);

  const handleResetPassword =
    useCallback(async () => {
      if (
        !resetTarget?.id ||
        isProcessing ||
        isSuperAdmin
      ) {
        return;
      }

      try {
        setProcessingAction("reset");
        setPageError("");

        const data =
          await requestJson(
            `${API_BASE}/users/reset/${encodeURIComponent(
              resetTarget.id
            )}`,
            {
              method: "PUT",
            }
          );

        if (!isMountedRef.current) {
          return;
        }

        const generatedPassword =
          data?.temporaryPassword ||
          data?.temporary_password ||
          data?.password ||
          data?.newPassword ||
          data?.new_password ||
          "";

        if (!generatedPassword) {
          throw new Error(
            "The password was reset, but the server did not return a temporary password."
          );
        }

        setTemporaryPassword(
          generatedPassword
        );

        await fetchUsers({
          showError: false,
        });
      } catch (error) {
        console.error(
          "Reset password error:",
          error
        );

        if (isMountedRef.current) {
          setPageError(
            getApiError(
              error,
              "Unable to reset the account password."
            )
          );

          setResetTarget(null);
        }
      } finally {
        if (isMountedRef.current) {
          setProcessingAction("");
        }
      }
    }, [
      fetchUsers,
      isProcessing,
      isSuperAdmin,
      resetTarget,
    ]);

  const handleCloseResetSuccess =
    useCallback(() => {
      setResetTarget(null);
      setTemporaryPassword("");
      setCopyText("Copy Password");
    }, []);

  const handleCopyPassword =
    useCallback(async () => {
      if (!temporaryPassword) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          temporaryPassword
        );

        setCopyText("Copied");

        if (copyResetTimerRef.current) {
          window.clearTimeout(
            copyResetTimerRef.current
          );
        }

        copyResetTimerRef.current =
          window.setTimeout(() => {
            setCopyText(
              "Copy Password"
            );
          }, 1500);
      } catch (error) {
        console.error(
          "Copy password error:",
          error
        );

        setCopyText("Copy Failed");
      }
    }, [temporaryPassword]);

  const handleOpenToggle =
    useCallback(
      (account) => {
        if (
          !account?.id ||
          isProcessing ||
          isSuperAdmin
        ) {
          return;
        }

        setPageError("");
        setToggleTarget(account);
      },
      [
        isProcessing,
        isSuperAdmin,
      ]
    );

  const handleCloseToggleDialog =
    useCallback(() => {
      if (isProcessing) {
        return;
      }

      setToggleTarget(null);
    }, [isProcessing]);

  const handleConfirmToggle =
    useCallback(async () => {
      if (
        !toggleTarget?.id ||
        isProcessing ||
        isSuperAdmin
      ) {
        return;
      }

      const currentStatus =
        getAccountStatus(
          toggleTarget
        );

      const nextStatus =
        currentStatus === "Active"
          ? "Inactive"
          : "Active";

      const accountName =
        getAccountName(
          toggleTarget
        );

      try {
        setProcessingAction("toggle");
        setPageError("");

        await requestJson(
          `${API_BASE}/users/toggle/${encodeURIComponent(
            toggleTarget.id
          )}`,
          {
            method: "PUT",
          }
        );

        if (!isMountedRef.current) {
          return;
        }

        setAccounts(
          (currentAccounts) =>
            currentAccounts.map(
              (account) =>
                String(account?.id) ===
                String(
                  toggleTarget.id
                )
                  ? {
                      ...account,
                      status:
                        nextStatus,
                    }
                  : account
            )
        );

        setToggleTarget(null);

        setSuccessMessage(
          `${accountName} was ${
            nextStatus === "Active"
              ? "activated"
              : "deactivated"
          } successfully.`
        );

        void fetchUsers({
          showError: false,
        });
      } catch (error) {
        console.error(
          "Toggle account status error:",
          error
        );

        if (isMountedRef.current) {
          setPageError(
            getApiError(
              error,
              "Unable to update the account status."
            )
          );
        }
      } finally {
        if (isMountedRef.current) {
          setProcessingAction("");
        }
      }
    }, [
      fetchUsers,
      isProcessing,
      isSuperAdmin,
      toggleTarget,
    ]);

  const resetAccountName =
    getAccountName(resetTarget);

  const toggleAccountName =
    getAccountName(toggleTarget);

  const toggleCurrentStatus =
    getAccountStatus(toggleTarget);

  const willActivate =
    toggleCurrentStatus !== "Active";

  const pageDescription =
    isSuperAdmin
      ? "View user-account maintenance information. Super Admin access is view-only."
      : "Reset temporary passwords and activate or deactivate system accounts.";

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Technical Administration"
        title="IT Support Maintenance"
        description={pageDescription}
        icon={
          <FiShield size={22} />
        }
        actions={
          <Button
            variant="secondary"
            leftIcon={
              <FiRefreshCw
                className={
                  isRefreshingUsers
                    ? "animate-spin"
                    : ""
                }
                aria-hidden="true"
              />
            }
            loading={
              isRefreshingUsers
            }
            disabled={
              isLoadingUsers ||
              isRefreshingUsers ||
              isProcessing
            }
            onClick={handleRefresh}
          >
            Refresh Accounts
          </Button>
        }
      />

      {pageError && (
        <ErrorState
          compact
          title="Account maintenance error"
          message={pageError}
          retryLabel="Reload accounts"
          onRetry={handleRefresh}
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <AccountSummaryCard
          label="Total Accounts"
          value={accountSummary.total}
          helper="All system users"
        />

        <AccountSummaryCard
          label="Active Users"
          value={accountSummary.active}
          helper="Accounts with access"
        />

        <AccountSummaryCard
          label="Inactive Users"
          value={accountSummary.inactive}
          helper="Access currently disabled"
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <header className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 lg:flex-row lg:items-end lg:justify-between sm:px-6 dark:border-white/10">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
              <FiUsers
                className="text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />

              User Account Maintenance
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Review accounts and perform authorized technical support actions.
            </p>
          </div>

          <div className="w-full lg:w-96">
            <SearchInput
              label="Search user accounts"
              hideLabel
              placeholder="Search user, role, username, or status..."
              value={search}
              disabled={
                isLoadingUsers ||
                isProcessing
              }
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              onClear={() =>
                setSearch("")
              }
            />
          </div>
        </header>

        {isLoadingUsers ? (
          <div className="p-5 sm:p-6">
            <LoadingSkeleton
              rows={6}
              columns={6}
              showHeader
            />
          </div>
        ) : filteredAccounts.length >
          0 ? (
          <div className="max-h-[650px] overflow-auto">
            <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    User ID
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    Name
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    Username
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    Role
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    Status
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4 text-right"
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredAccounts.map(
                  (
                    account,
                    index
                  ) => {
                    const accountName =
                      getAccountName(
                        account
                      );

                    const accountStatus =
                      getAccountStatus(
                        account
                      );

                    const isActive =
                      accountStatus ===
                      "Active";

                    return (
                      <tr
                        key={getAccountKey(
                          account,
                          index
                        )}
                        className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-white/5"
                      >
                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">
                          {account.user_id ||
                            account.userId ||
                            account.id ||
                            "-"}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                              {getInitials(
                                accountName
                              )}
                            </div>

                            <p className="max-w-[240px] truncate font-semibold text-gray-900 dark:text-white">
                              {accountName}
                            </p>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-700 dark:text-gray-300">
                          {account.username ||
                            "-"}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {ROLE_LABELS[
                              account.role
                            ] ||
                              account.role ||
                              "-"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          <StatusBadge
                            status={
                              accountStatus
                            }
                            size="md"
                          />
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <RoleGuard
                              permission={
                                PERMISSIONS.CAN_MAINTAIN_IT_USERS
                              }
                            >
                              <IconButton
                                label={`Reset password for ${accountName}`}
                                title="Reset Password"
                                variant="primary"
                                size="md"
                                disabled={
                                  isProcessing
                                }
                                onClick={() =>
                                  handleOpenReset(
                                    account
                                  )
                                }
                              >
                                <FiShield
                                  aria-hidden="true"
                                />
                              </IconButton>

                              <IconButton
                                label={`${
                                  isActive
                                    ? "Deactivate"
                                    : "Activate"
                                } ${accountName}`}
                                title={
                                  isActive
                                    ? "Deactivate Account"
                                    : "Activate Account"
                                }
                                variant={
                                  isActive
                                    ? "danger"
                                    : "success"
                                }
                                size="md"
                                disabled={
                                  isProcessing
                                }
                                onClick={() =>
                                  handleOpenToggle(
                                    account
                                  )
                                }
                              >
                                {isActive ? (
                                  <FiUserX
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <FiUserCheck
                                    aria-hidden="true"
                                  />
                                )}
                              </IconButton>
                            </RoleGuard>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <EmptyState
              icon={
                search.trim()
                  ? "search"
                  : "records"
              }
              title={
                search.trim()
                  ? "No accounts matched"
                  : "No accounts found"
              }
              description={
                search.trim()
                  ? "No user accounts matched the current search."
                  : "System accounts will appear here once they are created."
              }
              secondaryActionLabel={
                search.trim()
                  ? "Clear search"
                  : ""
              }
              onSecondaryAction={
                search.trim()
                  ? () =>
                      setSearch("")
                  : undefined
              }
            />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={
          Boolean(resetTarget) &&
          !temporaryPassword
        }
        title="Reset Account Password"
        tone="warning"
        confirmLabel="Generate Password"
        cancelLabel="Cancel"
        loading={
          processingAction ===
          "reset"
        }
        disabled={
          !resetTarget?.id ||
          isSuperAdmin
        }
        closeOnBackdrop={
          !isProcessing
        }
        onClose={
          handleCloseResetDialog
        }
        onConfirm={
          handleResetPassword
        }
      >
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          Generate a new temporary password for{" "}
          <strong className="font-extrabold text-gray-900 dark:text-white">
            {resetAccountName}
          </strong>
          ?
        </p>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          The user will be required to change the temporary password during the next login.
        </div>
      </ConfirmDialog>

      <Dialog
        open={
          Boolean(resetTarget) &&
          Boolean(temporaryPassword)
        }
        onClose={
          handleCloseResetSuccess
        }
        title="Password Reset Successful"
        description={`A temporary password was generated for ${resetAccountName}.`}
        tone="success"
        size="md"
        closeOnOverlay
        closeOnEscape
        showCloseButton
        bodyClassName="space-y-5 p-6"
        footer={
          <div className="flex w-full flex-col-reverse justify-end gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              leftIcon={
                <FiCopy
                  aria-hidden="true"
                />
              }
              onClick={
                handleCopyPassword
              }
            >
              {copyText}
            </Button>

            <Button
              type="button"
              variant="success"
              onClick={
                handleCloseResetSuccess
              }
            >
              Done
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <FiCheckCircle
            className="mt-0.5 shrink-0"
            size={20}
            aria-hidden="true"
          />

          <p className="text-sm leading-6">
            The password reset was completed successfully.
          </p>
        </div>

        <div>
          <label
            htmlFor="temporary-reset-password"
            className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Temporary Password
          </label>

          <input
            id="temporary-reset-password"
            type="text"
            readOnly
            value={temporaryPassword}
            className="ui-control font-mono font-bold"
          />
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          Provide this password securely to the account owner. Do not send it through public channels.
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={
          willActivate
            ? "Activate Account"
            : "Deactivate Account"
        }
        tone={
          willActivate
            ? "success"
            : "danger"
        }
        confirmLabel={
          willActivate
            ? "Activate Account"
            : "Deactivate Account"
        }
        cancelLabel="Cancel"
        loading={
          processingAction ===
          "toggle"
        }
        disabled={
          !toggleTarget?.id ||
          isSuperAdmin
        }
        closeOnBackdrop={
          !isProcessing
        }
        onClose={
          handleCloseToggleDialog
        }
        onConfirm={
          handleConfirmToggle
        }
      >
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          Are you sure you want to{" "}
          <strong>
            {willActivate
              ? "activate"
              : "deactivate"}
          </strong>{" "}
          the account of{" "}
          <strong className="font-extrabold text-gray-900 dark:text-white">
            {toggleAccountName}
          </strong>
          ?
        </p>

        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {willActivate
            ? "The user will regain access to the system."
            : "The user will no longer be able to sign in until the account is activated again."}
        </p>
      </ConfirmDialog>

      <SuccessToast
        title="Account Status Updated"
        message={successMessage}
        duration={3500}
        onClose={() =>
          setSuccessMessage("")
        }
      />
    </main>
  );
}