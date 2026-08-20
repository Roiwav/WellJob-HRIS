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
import Dialog from "../components/ui/Dialog";
import SuccessToast from "../components/ui/SuccessToast";

import authenticatedFetch from "../utils/authenticatedFetch";

const REQUEST_TIMEOUT_MS = 15000;

const TEMP_PASSWORD_BYTES = 8;

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  IT_SUPPORT: "IT Support",
};

const SUPER_ADMIN_MANAGEABLE_ROLES =
  new Set([
    "HR_MANAGER",
    "HR_STAFF",
    "IT_SUPPORT",
  ]);

function generateTemporaryPassword() {
  if (
    !window.crypto ||
    typeof window.crypto
      .getRandomValues !== "function"
  ) {
    throw new Error(
      "Secure temporary password generation is unavailable in this browser."
    );
  }

  const randomBytes =
    new Uint8Array(
      TEMP_PASSWORD_BYTES
    );

  window.crypto.getRandomValues(
    randomBytes
  );

  return Array.from(
    randomBytes,
    (value) =>
      value
        .toString(16)
        .padStart(2, "0")
  ).join("");
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeIdentity(value) {
  if (
    value === undefined ||
    value === null
  ) {
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

/*
 * ==================================================
 * CURRENT USER / TARGET ACCOUNT MATCHING
 * ==================================================
 *
 * The backend remains the security authority.
 *
 * This helper is only for frontend UX so the UI
 * does not offer an action that the backend will
 * reject.
 *
 * It supports both:
 * - numeric database IDs
 * - business-facing user IDs
 * - usernames
 */
function isSameAccount(
  currentUser,
  account
) {
  if (
    !currentUser ||
    !account
  ) {
    return false;
  }

  const currentUsername =
    normalizeIdentity(
      currentUser?.username
    );

  const accountUsername =
    normalizeIdentity(
      account?.username
    );

  if (
    currentUsername &&
    accountUsername &&
    currentUsername ===
      accountUsername
  ) {
    return true;
  }

  const currentInternalId =
    normalizeIdentity(
      currentUser?.id
    );

  const accountInternalId =
    normalizeIdentity(
      account?.id
    );

  if (
    currentInternalId &&
    accountInternalId &&
    currentInternalId ===
      accountInternalId
  ) {
    return true;
  }

  const currentBusinessId =
    normalizeIdentity(
      currentUser?.user_id
    );

  const accountBusinessId =
    normalizeIdentity(
      account?.user_id ??
        account?.userId
    );

  if (
    currentBusinessId &&
    accountBusinessId &&
    currentBusinessId ===
      accountBusinessId
  ) {
    return true;
  }

  /*
   * Some authentication payloads use userId
   * for either the internal numeric ID or the
   * business-facing ID.
   */
  const currentFallbackUserId =
    normalizeIdentity(
      currentUser?.userId
    );

  if (
    currentFallbackUserId &&
    (
      currentFallbackUserId ===
        accountInternalId ||
      currentFallbackUserId ===
        accountBusinessId
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ==================================================
 * FRONTEND ACCOUNT-MANAGEMENT POLICY
 * ==================================================
 *
 * Mirrors the backend policy for UX only.
 *
 * Backend remains the final authority.
 *
 * SUPER_ADMIN:
 *   HR_MANAGER ✅
 *   HR_STAFF   ✅
 *   IT_SUPPORT ✅
 *   SUPER_ADMIN ❌
 *
 * IT_SUPPORT:
 *   HR_STAFF ✅
 *   all other roles ❌
 *
 * Self-targeting is always blocked.
 */
function canManageAccountTarget(
  currentUser,
  account
) {
  if (
    !currentUser ||
    !account
  ) {
    return false;
  }

  if (
    isSameAccount(
      currentUser,
      account
    )
  ) {
    return false;
  }

  const requesterRole =
    normalizeRole(
      currentUser?.role
    );

  const targetRole =
    normalizeRole(
      account?.role
    );

  if (
    targetRole ===
    "SUPER_ADMIN"
  ) {
    return false;
  }

  if (
    requesterRole ===
    "SUPER_ADMIN"
  ) {
    return (
      SUPER_ADMIN_MANAGEABLE_ROLES.has(
        targetRole
      )
    );
  }

  if (
    requesterRole ===
      "IT_SUPPORT" &&
    targetRole ===
      "HR_STAFF"
  ) {
    return true;
  }

  return false;
}

function getAccountRestriction(
  currentUser,
  account
) {
  if (
    isSameAccount(
      currentUser,
      account
    )
  ) {
    return {
      label: "Own Account",
      title:
        "Use Change Password for your own account.",
    };
  }

  const requesterRole =
    normalizeRole(
      currentUser?.role
    );

  const targetRole =
    normalizeRole(
      account?.role
    );

  if (
    targetRole ===
    "SUPER_ADMIN"
  ) {
    return {
      label: "Protected",
      title:
        "Super Admin accounts are protected from administrative reset and status actions.",
    };
  }

  if (
    requesterRole ===
      "IT_SUPPORT"
  ) {
    return {
      label: "Restricted",
      title:
        "IT Support may manage HR Staff accounts only.",
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
  if (
    error?.name ===
    "AbortError"
  ) {
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
    const response =
      await authenticatedFetch(
        url,
        {
          ...options,

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            ...(options.headers ||
              {}),
          },
        }
      );

    const data =
      await response
        .json()
        .catch(() => null);

    if (
      !response.ok
    ) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } finally {
    window.clearTimeout(
      timeoutId
    );
  }
}

function normalizeSearchText(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
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

export default function Settings() {
  const { user } = useAuth();

  const currentRole =
    normalizeRole(
      user?.role
    );

  const isSuperAdmin =
    currentRole ===
    "SUPER_ADMIN";

  const isItSupport =
    currentRole ===
    "IT_SUPPORT";

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

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    copyText,
    setCopyText,
  ] = useState(
    "Copy Password"
  );

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
    Boolean(
      processingAction
    );

  useEffect(() => {
    isMountedRef.current =
      true;

    return () => {
      isMountedRef.current =
        false;

      if (
        copyResetTimerRef.current
      ) {
        window.clearTimeout(
          copyResetTimerRef.current
        );
      }
    };
  }, []);

  const canManageAccount =
    useCallback(
      (account) =>
        canManageAccountTarget(
          user,
          account
        ),
      [user]
    );

  const fetchUsers =
    useCallback(
      async ({
        showInitialLoading = false,
        showRefreshing = false,
        showError = true,
      } = {}) => {
        if (
          showInitialLoading
        ) {
          setIsLoadingUsers(
            true
          );
        }

        if (
          showRefreshing
        ) {
          setIsRefreshingUsers(
            true
          );
        }

        try {
          if (
            showError
          ) {
            setPageError("");
          }

          const data =
            await requestJson(
              `${API_BASE}/users`
            );

          if (
            !isMountedRef.current
          ) {
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
          if (
            isMountedRef.current
          ) {
            if (
              showInitialLoading
            ) {
              setIsLoadingUsers(
                false
              );
            }

            if (
              showRefreshing
            ) {
              setIsRefreshingUsers(
                false
              );
            }
          }
        }
      },
      []
    );

  useEffect(() => {
    void fetchUsers({
      showInitialLoading:
        true,
    });
  }, [fetchUsers]);

  const filteredAccounts =
    useMemo(() => {
      const normalizedSearch =
        normalizeSearchText(
          search
        );

      const searchTerms =
        normalizedSearch
          ? normalizedSearch.split(
              /\s+/
            )
          : [];

      if (
        searchTerms.length ===
        0
      ) {
        return accounts;
      }

      return accounts.filter(
        (account) => {
          const accountStatus =
            getAccountStatus(
              account
            );

          const roleLabel =
            ROLE_LABELS[
              account?.role
            ] ||
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
              searchableText.includes(
                term
              )
          );
        }
      );
    }, [
      accounts,
      search,
    ]);

  const accountSummary =
    useMemo(() => {
      const activeUsers =
        accounts.filter(
          (account) =>
            getAccountStatus(
              account
            ) === "Active"
        ).length;

      return {
        total:
          accounts.length,

        active:
          activeUsers,

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
        showRefreshing:
          true,
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
          !canManageAccount(
            account
          )
        ) {
          return;
        }

        setPageError("");
        setTemporaryPassword(
          ""
        );
        setCopyText(
          "Copy Password"
        );
        setResetTarget(
          account
        );
      },
      [
        canManageAccount,
        isProcessing,
      ]
    );

  const handleCloseResetDialog =
    useCallback(() => {
      if (
        isProcessing
      ) {
        return;
      }

      setResetTarget(
        null
      );
    }, [isProcessing]);

  const handleResetPassword =
    useCallback(async () => {
      if (
        !resetTarget?.id ||
        isProcessing ||
        !canManageAccount(
          resetTarget
        )
      ) {
        return;
      }

      try {
        setProcessingAction(
          "reset"
        );

        setPageError("");

        const generatedPassword =
          generateTemporaryPassword();

        await requestJson(
          `${API_BASE}/users/reset/${encodeURIComponent(
            resetTarget.id
          )}`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                temporaryPassword:
                  generatedPassword,
              }),
          }
        );

        if (
          !isMountedRef.current
        ) {
          return;
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

        if (
          isMountedRef.current
        ) {
          setPageError(
            getApiError(
              error,
              "Unable to reset the account password."
            )
          );

          setResetTarget(
            null
          );
        }
      } finally {
        if (
          isMountedRef.current
        ) {
          setProcessingAction(
            ""
          );
        }
      }
    }, [
      canManageAccount,
      fetchUsers,
      isProcessing,
      resetTarget,
    ]);

  const handleCloseResetSuccess =
    useCallback(() => {
      setResetTarget(null);

      setTemporaryPassword(
        ""
      );

      setCopyText(
        "Copy Password"
      );
    }, []);

  const handleCopyPassword =
    useCallback(async () => {
      if (
        !temporaryPassword
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          temporaryPassword
        );

        setCopyText(
          "Copied"
        );

        if (
          copyResetTimerRef.current
        ) {
          window.clearTimeout(
            copyResetTimerRef.current
          );
        }

        copyResetTimerRef.current =
          window.setTimeout(
            () => {
              setCopyText(
                "Copy Password"
              );
            },
            1500
          );
      } catch (error) {
        console.error(
          "Copy password error:",
          error
        );

        setCopyText(
          "Copy Failed"
        );
      }
    }, [temporaryPassword]);

  const handleOpenToggle =
    useCallback(
      (account) => {
        if (
          !account?.id ||
          isProcessing ||
          !canManageAccount(
            account
          )
        ) {
          return;
        }

        setPageError("");
        setToggleTarget(
          account
        );
      },
      [
        canManageAccount,
        isProcessing,
      ]
    );

  const handleCloseToggleDialog =
    useCallback(() => {
      if (
        isProcessing
      ) {
        return;
      }

      setToggleTarget(
        null
      );
    }, [isProcessing]);

  const handleConfirmToggle =
    useCallback(async () => {
      if (
        !toggleTarget?.id ||
        isProcessing ||
        !canManageAccount(
          toggleTarget
        )
      ) {
        return;
      }

      const currentStatus =
        getAccountStatus(
          toggleTarget
        );

      const nextStatus =
        currentStatus ===
        "Active"
          ? "Inactive"
          : "Active";

      const accountName =
        getAccountName(
          toggleTarget
        );

      try {
        setProcessingAction(
          "toggle"
        );

        setPageError("");

        await requestJson(
          `${API_BASE}/users/toggle/${encodeURIComponent(
            toggleTarget.id
          )}`,
          {
            method: "PUT",
          }
        );

        if (
          !isMountedRef.current
        ) {
          return;
        }

        setAccounts(
          (currentAccounts) =>
            currentAccounts.map(
              (account) =>
                String(
                  account?.id
                ) ===
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

        setToggleTarget(
          null
        );

        setSuccessMessage(
          `${accountName} was ${
            nextStatus ===
            "Active"
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

        if (
          isMountedRef.current
        ) {
          setPageError(
            getApiError(
              error,
              "Unable to update the account status."
            )
          );
        }
      } finally {
        if (
          isMountedRef.current
        ) {
          setProcessingAction(
            ""
          );
        }
      }
    }, [
      canManageAccount,
      fetchUsers,
      isProcessing,
      toggleTarget,
    ]);

  const resetAccountName =
    getAccountName(
      resetTarget
    );

  const toggleAccountName =
    getAccountName(
      toggleTarget
    );

  const toggleCurrentStatus =
    getAccountStatus(
      toggleTarget
    );

  const willActivate =
    toggleCurrentStatus !==
    "Active";

  const pageDescription =
    isSuperAdmin
      ? "Manage HR Manager, HR Staff, and IT Support accounts. Super Admin accounts remain protected."
      : isItSupport
        ? "Reset temporary passwords and activate or deactivate HR Staff accounts. Privileged accounts are protected."
        : "Review user-account maintenance information.";

  const maintenanceDescription =
    isSuperAdmin
      ? "Review accounts and perform authorized account-administration actions."
      : isItSupport
        ? "Review system accounts and perform authorized HR Staff technical-support actions."
        : "Review system accounts.";

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Technical Administration"
        title="IT Support Maintenance"
        description={
          pageDescription
        }
        icon={
          <FiShield
            size={22}
          />
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
            onClick={
              handleRefresh
            }
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
          onRetry={
            handleRefresh
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <AccountSummaryCard
          label="Total Accounts"
          value={
            accountSummary.total
          }
          helper="All system users"
        />

        <AccountSummaryCard
          label="Active Users"
          value={
            accountSummary.active
          }
          helper="Accounts with access"
        />

        <AccountSummaryCard
          label="Inactive Users"
          value={
            accountSummary.inactive
          }
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
            resultCount={
              filteredAccounts.length
            }
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
                onClick={() =>
                  setSearch("")
                }
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
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                onClear={() =>
                  setSearch("")
                }
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

                    const mayManage =
                      canManageAccount(
                        account
                      );

                    const restriction =
                      mayManage
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
                              {
                                accountName
                              }
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
                              account
                                .role
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
                            {mayManage ? (
                              <>
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
                              </>
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
                  ? () =>
                      setSearch(
                        ""
                      )
                  : undefined
              }
            />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={
          Boolean(
            resetTarget
          ) &&
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
          !canManageAccount(
            resetTarget
          )
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
          Generate a new
          temporary password for{" "}
          <strong className="font-extrabold text-gray-900 dark:text-white">
            {
              resetAccountName
            }
          </strong>
          ?
        </p>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          The user will be
          required to change the
          temporary password
          during the next login.
        </div>
      </ConfirmDialog>

      <Dialog
        open={
          Boolean(
            resetTarget
          ) &&
          Boolean(
            temporaryPassword
          )
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
            The password reset
            was completed
            successfully.
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
            value={
              temporaryPassword
            }
            className="ui-control font-mono font-bold"
          />
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          Provide this password
          securely to the account
          owner. Do not send it
          through public channels.
        </div>
      </Dialog>

      <ConfirmDialog
        open={
          Boolean(
            toggleTarget
          )
        }
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
          !canManageAccount(
            toggleTarget
          )
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
          Are you sure you want
          to{" "}
          <strong>
            {willActivate
              ? "activate"
              : "deactivate"}
          </strong>{" "}
          the account of{" "}
          <strong className="font-extrabold text-gray-900 dark:text-white">
            {
              toggleAccountName
            }
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
        message={
          successMessage
        }
        duration={3500}
        onClose={() =>
          setSuccessMessage(
            ""
          )
        }
      />
    </main>
  );
}