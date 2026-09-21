
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiLock,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiUserX,
  FiUsers,
} from "react-icons/fi";

import { useAuth } from "../context/useAuth";
import { API_BASE } from "../config/api";

import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import FilterBar from "../components/ui/FilterBar";
import StatusBadge from "../components/ui/StatusBadge";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import SuccessToast from "../components/ui/SuccessToast";

import authenticatedFetch from "../utils/authenticatedFetch";

const REQUEST_TIMEOUT_MS = 15000;

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  HR_COORDINATOR: "HR Coordinator",
  IT_SUPPORT: "IT Support",
};

const SUPER_ADMIN_MANAGEABLE_ROLES = new Set([
  "HR_MANAGER",
  "HR_STAFF",
  "IT_SUPPORT",
]);

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeIdentity(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase();
}

function getInitials(value) {
  return (
    String(value || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
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

function getAccountKey(account, index) {
  return (
    account?.id ||
    account?.user_id ||
    account?.userId ||
    account?.username ||
    `account-${index}`
  );
}

/*
 * ==================================================
 * CURRENT USER / TARGET ACCOUNT MATCHING
 * ==================================================
 *
 * Frontend checks are for UI visibility only.
 * Backend authorization remains authoritative.
 */

function isSameAccount(currentUser, account) {
  if (!currentUser || !account) {
    return false;
  }

  const currentUsername = normalizeIdentity(
    currentUser?.username
  );

  const accountUsername = normalizeIdentity(
    account?.username
  );

  if (
    currentUsername &&
    accountUsername &&
    currentUsername === accountUsername
  ) {
    return true;
  }

  const currentInternalId = normalizeIdentity(
    currentUser?.id
  );

  const accountInternalId = normalizeIdentity(
    account?.id
  );

  if (
    currentInternalId &&
    accountInternalId &&
    currentInternalId === accountInternalId
  ) {
    return true;
  }

  const currentBusinessId = normalizeIdentity(
    currentUser?.user_id
  );

  const accountBusinessId = normalizeIdentity(
    account?.user_id ?? account?.userId
  );

  if (
    currentBusinessId &&
    accountBusinessId &&
    currentBusinessId === accountBusinessId
  ) {
    return true;
  }

  const currentFallbackUserId = normalizeIdentity(
    currentUser?.userId
  );

  if (
    currentFallbackUserId &&
    (
      currentFallbackUserId === accountInternalId ||
      currentFallbackUserId === accountBusinessId
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ==================================================
 * ACCOUNT STATUS MANAGEMENT POLICY
 * ==================================================
 *
 * These checks mirror the existing frontend policy.
 * They do not grant access to backend endpoints.
 *
 * Super Admin:
 * - May manage HR Manager, HR Staff, IT Support
 *
 * IT Support:
 * - May manage HR Staff
 *
 * No self-targeting.
 * Super Admin target accounts remain protected.
 */

function canManageAccountTarget(
  currentUser,
  account
) {
  if (!currentUser || !account) {
    return false;
  }

  if (isSameAccount(currentUser, account)) {
    return false;
  }

  const requesterRole = normalizeRole(
    currentUser?.role
  );

  const targetRole = normalizeRole(
    account?.role
  );

  if (targetRole === "SUPER_ADMIN") {
    return false;
  }

  if (requesterRole === "SUPER_ADMIN") {
    return SUPER_ADMIN_MANAGEABLE_ROLES.has(
      targetRole
    );
  }

  if (
    requesterRole === "IT_SUPPORT" &&
    targetRole === "HR_STAFF"
  ) {
    return true;
  }

  return false;
}

function getAccountRestriction(
  currentUser,
  account
) {
  if (isSameAccount(currentUser, account)) {
    return {
      label: "Own Account",
      title:
        "You cannot deactivate your own account.",
    };
  }

  const requesterRole = normalizeRole(
    currentUser?.role
  );

  const targetRole = normalizeRole(
    account?.role
  );

  if (targetRole === "SUPER_ADMIN") {
    return {
      label: "Protected",
      title:
        "Super Admin accounts are protected from account-status actions.",
    };
  }

  if (requesterRole === "IT_SUPPORT") {
    return {
      label: "Restricted",
      title:
        "IT Support may manage HR Staff account status only.",
    };
  }

  return {
    label: "No Access",
    title:
      "You are not authorized to manage this account.",
  };
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

async function requestJson(url, options = {}) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await authenticatedFetch(
      url,
      {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      }
    );

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

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
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

function RestrictedAction({
  label,
  title,
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500 dark:border-white/10 dark:bg-slate-800 dark:text-gray-400"
    >
      <FiLock
        size={13}
        aria-hidden="true"
      />

      {label}
    </span>
  );
}

/*
 * ==================================================
 * USER MANAGEMENT PAGE
 * ==================================================
 *
 * Password reset is intentionally NOT available here.
 *
 * Account recovery uses:
 * Forgot Password -> authorized review -> reset email.
 *
 * This page retains account status administration only.
 */

export default function Settings() {
  const { user } = useAuth();

  const currentRole = normalizeRole(
    user?.role
  );

  const isSuperAdmin =
    currentRole === "SUPER_ADMIN";

  const isItSupport =
    currentRole === "IT_SUPPORT";

  const [accounts, setAccounts] = useState([]);

  const [search, setSearch] = useState("");

  const [toggleTarget, setToggleTarget] =
    useState(null);

  const [pageError, setPageError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [isLoadingUsers, setIsLoadingUsers] =
    useState(true);

  const [
    isRefreshingUsers,
    setIsRefreshingUsers,
  ] = useState(false);

  const [
    processingAction,
    setProcessingAction,
  ] = useState("");

  const isMountedRef = useRef(true);

  const isProcessing = Boolean(
    processingAction
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canManageAccount = useCallback(
    (account) =>
      canManageAccountTarget(
        user,
        account
      ),
    [user]
  );

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

        const data = await requestJson(
          `${API_BASE}/users`
        );

        if (!isMountedRef.current) {
          return false;
        }

        setAccounts(
          Array.isArray(data) ? data : []
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

  const filteredAccounts = useMemo(() => {
    const normalizedSearch =
      normalizeSearchText(search);

    const searchTerms = normalizedSearch
      ? normalizedSearch.split(/\s+/)
      : [];

    if (searchTerms.length === 0) {
      return accounts;
    }

    return accounts.filter((account) => {
      const accountStatus =
        getAccountStatus(account);

      const roleLabel =
        ROLE_LABELS[account?.role] ||
        account?.role ||
        "";

      const searchableText =
        normalizeSearchText(
          [
            account?.id,
            account?.user_id,
            account?.userId,
            account?.full_name,
            account?.fullName,
            account?.name,
            account?.username,
            account?.role,
            roleLabel,
            accountStatus,
            account?.status,
          ]
            .filter(Boolean)
            .join(" ")
        );

      return searchTerms.every(
        (term) =>
          searchableText.includes(term)
      );
    });
  }, [accounts, search]);

  const accountSummary = useMemo(() => {
    const activeUsers = accounts.filter(
      (account) =>
        getAccountStatus(account) ===
        "Active"
    ).length;

    return {
      total: accounts.length,
      active: activeUsers,
      inactive:
        accounts.length - activeUsers,
    };
  }, [accounts]);

  const handleRefresh = useCallback(
    async () => {
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
    },
    [
      fetchUsers,
      isLoadingUsers,
      isProcessing,
      isRefreshingUsers,
    ]
  );

  const handleOpenToggle = useCallback(
    (account) => {
      if (
        !account?.id ||
        isProcessing ||
        !canManageAccount(account)
      ) {
        return;
      }

      setPageError("");
      setToggleTarget(account);
    },
    [
      canManageAccount,
      isProcessing,
    ]
  );

  const handleCloseToggleDialog = useCallback(
    () => {
      if (isProcessing) {
        return;
      }

      setToggleTarget(null);
    },
    [isProcessing]
  );

  const handleConfirmToggle = useCallback(
    async () => {
      if (
        !toggleTarget?.id ||
        isProcessing ||
        !canManageAccount(toggleTarget)
      ) {
        return;
      }

      const currentStatus =
        getAccountStatus(toggleTarget);

      const nextStatus =
        currentStatus === "Active"
          ? "Inactive"
          : "Active";

      const accountName =
        getAccountName(toggleTarget);

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
                String(toggleTarget.id)
                  ? {
                      ...account,
                      status: nextStatus,
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
    },
    [
      canManageAccount,
      fetchUsers,
      isProcessing,
      toggleTarget,
    ]
  );

  const toggleAccountName =
    getAccountName(toggleTarget);

  const toggleCurrentStatus =
    getAccountStatus(toggleTarget);

  const willActivate =
    toggleCurrentStatus !== "Active";

  const pageDescription = isSuperAdmin
    ? "Manage authorized account status changes. Super Admin accounts remain protected."
    : isItSupport
      ? "Review system accounts and manage authorized HR Staff account status changes."
      : "Review user-account maintenance information.";

  const maintenanceDescription =
    isSuperAdmin
      ? "Review user accounts and activate or deactivate authorized accounts."
      : isItSupport
        ? "Review system accounts and activate or deactivate authorized HR Staff accounts."
        : "Review system accounts.";

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Technical Administration"
        title="IT Support Maintenance"
        description={pageDescription}
        icon={<FiShield size={22} />}
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
            loading={isRefreshingUsers}
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
        <header className="border-b border-gray-200 px-5 py-5 sm:px-6 dark:border-white/10">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
            <FiUsers
              className="text-indigo-600 dark:text-indigo-400"
              aria-hidden="true"
            />

            User Account Maintenance
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {maintenanceDescription}
          </p>
        </header>

        <div className="border-b border-gray-200 p-5 sm:p-6 dark:border-white/10">
          <FilterBar
            resultCount={filteredAccounts.length}
            resultLabel="account"
            actions={
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  !search.trim() ||
                  isLoadingUsers ||
                  isRefreshingUsers ||
                  isProcessing
                }
                onClick={() => setSearch("")}
              >
                Clear Search
              </Button>
            }
          >
            <div className="w-full sm:col-span-2 xl:w-96">
              <SearchInput
                label="Search user accounts"
                hideLabel
                placeholder="Search ID, name, username, role, or status..."
                value={search}
                disabled={
                  isLoadingUsers ||
                  isRefreshingUsers ||
                  isProcessing
                }
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                onClear={() => setSearch("")}
              />
            </div>
          </FilterBar>
        </div>

        {isLoadingUsers ? (
          <div className="p-5 sm:p-6">
            <LoadingSkeleton
              rows={6}
              columns={6}
              showHeader
            />
          </div>
        ) : filteredAccounts.length > 0 ? (
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
                  (account, index) => {
                    const accountName =
                      getAccountName(account);

                    const accountStatus =
                      getAccountStatus(account);

                    const isActive =
                      accountStatus === "Active";

                    const mayManage =
                      canManageAccount(account);

                    const restriction = mayManage
                      ? null
                      : getAccountRestriction(
                          user,
                          account
                        );

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
                          {account.username || "-"}
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
                            status={accountStatus}
                            size="md"
                          />
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {mayManage ? (
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
                                disabled={isProcessing}
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
                            ) : (
                              <RestrictedAction
                                label={
                                  restriction?.label ||
                                  "Restricted"
                                }
                                title={
                                  restriction?.title ||
                                  "This account cannot be managed by the current user."
                                }
                              />
                            )}
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
                  ? () => setSearch("")
                  : undefined
              }
            />
          </div>
        )}
      </section>

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
          processingAction === "toggle"
        }
        disabled={
          !toggleTarget?.id ||
          !canManageAccount(toggleTarget)
        }
        closeOnBackdrop={!isProcessing}
        onClose={handleCloseToggleDialog}
        onConfirm={handleConfirmToggle}
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
        onClose={() => setSuccessMessage("")}
      />
    </main>
  );
}