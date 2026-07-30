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
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";

import { ROLES } from "../constants/roles";
import { PERMISSIONS } from "../constants/permissions";

import RoleGuard from "../components/auth/RoleGuard";

import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Dialog from "../components/ui/Dialog";

const USERS_API_URL =
  "http://localhost:5000/api/users";

const REQUEST_TIMEOUT_MS = 15000;

const ROLE_CONFIG = {
  [ROLES.HR_STAFF]: {
    label: "HR Staff",
    prefix: "HR",
    usernamePrefix: "hr",
  },

  [ROLES.HR_MANAGER]: {
    label: "HR Manager",
    prefix: "HM",
    usernamePrefix: "hm",
  },

  [ROLES.IT_SUPPORT]: {
    label: "IT Support",
    prefix: "IT",
    usernamePrefix: "it",
  },
};

const CONTROL_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5",
  "text-sm text-gray-900 shadow-sm outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

const READ_ONLY_CONTROL_CLASS_NAME = [
  CONTROL_CLASS_NAME,
  "cursor-not-allowed bg-gray-100 font-semibold text-gray-600",
  "dark:bg-slate-800 dark:text-gray-300",
].join(" ");

function extractNumberFromUserId(
  userId,
  prefix
) {
  const normalizedUserId =
    String(userId || "").trim();

  if (
    !normalizedUserId.startsWith(prefix)
  ) {
    return 0;
  }

  const numericPart =
    normalizedUserId.replace(
      prefix,
      ""
    );

  const parsedNumber =
    Number.parseInt(
      numericPart,
      10
    );

  return Number.isNaN(parsedNumber)
    ? 0
    : parsedNumber;
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

function getRoleLabel(roleValue) {
  return (
    ROLE_CONFIG[roleValue]?.label ||
    roleValue ||
    "Unknown Role"
  );
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

function getAccountStatus(account) {
  const status = String(
    account?.status || "Active"
  ).trim();

  return status || "Active";
}

function AccountDetailRow({
  label,
  value,
  monospace = false,
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5 dark:border-white/5">
      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </span>

      <span
        className={[
          "break-all text-sm font-extrabold text-gray-900 sm:text-right dark:text-white",
          monospace
            ? "font-mono"
            : "",
        ].join(" ")}
      >
        {value || "-"}
      </span>
    </div>
  );
}

export default function SuperAdminPortal() {
  const [accounts, setAccounts] =
    useState([]);

  const [name, setName] =
    useState("");

  const [role, setRole] =
    useState(ROLES.HR_STAFF);

  const [
    userRoleFilter,
    setUserRoleFilter,
  ] = useState("ALL");

  const [userId, setUserId] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [
    validationError,
    setValidationError,
  ] = useState("");

  const [pageError, setPageError] =
    useState("");

  const [copyMessage, setCopyMessage] =
    useState("");

  const [
    isLoadingAccounts,
    setIsLoadingAccounts,
  ] = useState(true);

  const [
    isRefreshingAccounts,
    setIsRefreshingAccounts,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
  ] = useState(false);

  const [
    isSuccessDialogOpen,
    setIsSuccessDialogOpen,
  ] = useState(false);

  const [
    createdAccount,
    setCreatedAccount,
  ] = useState({
    userId: "",
    username: "",
    temporaryPassword: "",
    name: "",
    roleLabel: "",
  });

  const isMountedRef =
    useRef(true);

  const selectedRoleConfig =
    ROLE_CONFIG[role] ||
    ROLE_CONFIG[ROLES.HR_STAFF];

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchUsers = useCallback(
    async ({
      showInitialLoading = false,
      showRefreshing = false,
      showError = true,
    } = {}) => {
      if (showInitialLoading) {
        setIsLoadingAccounts(true);
      }

      if (showRefreshing) {
        setIsRefreshingAccounts(true);
      }

      try {
        if (showError) {
          setPageError("");
        }

        const data =
          await requestJson(
            USERS_API_URL
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
            setIsLoadingAccounts(false);
          }

          if (showRefreshing) {
            setIsRefreshingAccounts(false);
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

  const nextGeneratedAccount =
    useMemo(() => {
      const prefix =
        selectedRoleConfig.prefix;

      const usernamePrefix =
        selectedRoleConfig.usernamePrefix;

      const sameRoleAccounts =
        accounts.filter(
          (account) =>
            account?.role === role
        );

      const maxNumber =
        sameRoleAccounts.reduce(
          (
            currentMaximum,
            account
          ) => {
            const sourceId =
              account?.user_id ||
              account?.userId ||
              "";

            const currentNumber =
              extractNumberFromUserId(
                sourceId,
                prefix
              );

            return currentNumber >
              currentMaximum
              ? currentNumber
              : currentMaximum;
          },
          0
        );

      const nextNumber =
        maxNumber + 1;

      const paddedNumber =
        String(nextNumber).padStart(
          2,
          "0"
        );

      return {
        userId: `${prefix}${paddedNumber}`,
        username: `${usernamePrefix}${paddedNumber}`,
      };
    }, [
      accounts,
      role,
      selectedRoleConfig.prefix,
      selectedRoleConfig.usernamePrefix,
    ]);

  useEffect(() => {
    setUserId(
      nextGeneratedAccount.userId
    );

    setUsername(
      nextGeneratedAccount.username
    );
  }, [nextGeneratedAccount]);

  const filteredAccounts =
    useMemo(() => {
      if (
        userRoleFilter === "ALL"
      ) {
        return accounts;
      }

      return accounts.filter(
        (account) =>
          account?.role ===
          userRoleFilter
      );
    }, [
      accounts,
      userRoleFilter,
    ]);

  const handleRefresh =
    useCallback(async () => {
      if (
        isLoadingAccounts ||
        isRefreshingAccounts ||
        isSubmitting
      ) {
        return;
      }

      await fetchUsers({
        showRefreshing: true,
      });
    }, [
      fetchUsers,
      isLoadingAccounts,
      isRefreshingAccounts,
      isSubmitting,
    ]);

  const validateForm =
    useCallback(() => {
      const trimmedName =
        name.trim();

      if (!trimmedName) {
        return "Full name is required.";
      }

      if (
        !/^[A-Za-zÀ-ÖØ-öø-ÿÑñ\s.'-]+$/.test(
          trimmedName
        )
      ) {
        return "Full name may contain letters, spaces, apostrophes, periods, and hyphens only.";
      }

      if (
        trimmedName.length < 2
      ) {
        return "Full name must contain at least 2 characters.";
      }

      if (
        trimmedName.length > 150
      ) {
        return "Full name must not exceed 150 characters.";
      }

      if (
        !role ||
        !ROLE_CONFIG[role]
      ) {
        return "Please select a valid role.";
      }

      if (
        !userId ||
        !username
      ) {
        return "Generated account details are incomplete.";
      }

      return "";
    }, [
      name,
      role,
      userId,
      username,
    ]);

  const handleCreateAccount =
    useCallback(
      (event) => {
        event.preventDefault();

        if (isSubmitting) {
          return;
        }

        const errorMessage =
          validateForm();

        if (errorMessage) {
          setValidationError(
            errorMessage
          );
          return;
        }

        setValidationError("");
        setPageError("");
        setIsConfirmDialogOpen(true);
      },
      [
        isSubmitting,
        validateForm,
      ]
    );

  const handleCloseConfirmDialog =
    useCallback(() => {
      if (isSubmitting) {
        return;
      }

      setIsConfirmDialogOpen(false);
    }, [isSubmitting]);

  const confirmCreateAccount =
    useCallback(async () => {
      if (isSubmitting) {
        return;
      }

      const errorMessage =
        validateForm();

      if (errorMessage) {
        setValidationError(
          errorMessage
        );

        setIsConfirmDialogOpen(false);
        return;
      }

      const trimmedName =
        name.trim();

      try {
        setIsSubmitting(true);
        setPageError("");

        const data =
          await requestJson(
            USERS_API_URL,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },

              body: JSON.stringify({
                name: trimmedName,
                role,
              }),
            }
          );

        if (!isMountedRef.current) {
          return;
        }

        setCreatedAccount({
          userId:
            data?.account?.userId ||
            data?.account?.user_id ||
            "",

          username:
            data?.account?.username ||
            "",

          temporaryPassword:
            data?.temporaryPassword ||
            data?.temporary_password ||
            "",

          name: trimmedName,

          roleLabel:
            getRoleLabel(role),
        });

        setIsConfirmDialogOpen(false);
        setIsSuccessDialogOpen(true);

        setName("");
        setRole(ROLES.HR_STAFF);
        setValidationError("");

        await fetchUsers({
          showError: false,
        });
      } catch (error) {
        console.error(
          "Create account error:",
          error
        );

        if (
          isMountedRef.current
        ) {
          setPageError(
            getApiError(
              error,
              "Unable to create the user account."
            )
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    }, [
      fetchUsers,
      isSubmitting,
      name,
      role,
      validateForm,
    ]);

  const handleCloseSuccessDialog =
    useCallback(() => {
      setIsSuccessDialogOpen(false);
      setCopyMessage("");
    }, []);

  const handleCopyCredentials =
    useCallback(async () => {
      const credentials = [
        `Full Name: ${createdAccount.name}`,
        `Role: ${createdAccount.roleLabel}`,
        `User ID: ${createdAccount.userId}`,
        `Username: ${createdAccount.username}`,
        `Temporary Password: ${createdAccount.temporaryPassword}`,
      ].join("\n");

      try {
        await navigator.clipboard.writeText(
          credentials
        );

        setCopyMessage(
          "Credentials copied to clipboard."
        );
      } catch (error) {
        console.error(
          "Copy credentials error:",
          error
        );

        setCopyMessage(
          "Unable to copy automatically. Please copy the credentials manually."
        );
      }
    }, [createdAccount]);

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="System Administration"
        title="Super Admin Portal"
        description="Create and review internal user accounts."
        icon={
          <FiShield size={22} />
        }
        actions={
          <Button
            variant="secondary"
            leftIcon={
              <FiRefreshCw
                className={
                  isRefreshingAccounts
                    ? "animate-spin"
                    : ""
                }
                aria-hidden="true"
              />
            }
            loading={
              isRefreshingAccounts
            }
            disabled={
              isLoadingAccounts ||
              isRefreshingAccounts ||
              isSubmitting
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
          title="User account error"
          message={pageError}
          retryLabel="Reload accounts"
          onRetry={handleRefresh}
        />
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <RoleGuard
          permission={
            PERMISSIONS.CAN_CREATE_SYSTEM_USERS
          }
        >
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <FiUserPlus
                  size={21}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                  Create New Account
                </h2>

                <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  Create an internal account and assign an authorized system role.
                </p>
              </div>
            </div>

            <form
              className="space-y-5"
              onSubmit={
                handleCreateAccount
              }
              noValidate
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="super-admin-full-name"
                    className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Full Name
                  </label>

                  <input
                    id="super-admin-full-name"
                    type="text"
                    value={name}
                    disabled={isSubmitting}
                    maxLength={150}
                    autoComplete="name"
                    placeholder="Enter full name"
                    className={
                      CONTROL_CLASS_NAME
                    }
                    onChange={(event) => {
                      setName(
                        event.target.value
                      );

                      setValidationError(
                        ""
                      );
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="super-admin-role"
                    className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Assign Role
                  </label>

                  <select
                    id="super-admin-role"
                    value={role}
                    disabled={isSubmitting}
                    className={
                      CONTROL_CLASS_NAME
                    }
                    onChange={(event) => {
                      setRole(
                        event.target.value
                      );

                      setValidationError(
                        ""
                      );
                    }}
                  >
                    <option
                      value={
                        ROLES.HR_STAFF
                      }
                    >
                      HR Staff
                    </option>

                    <option
                      value={
                        ROLES.HR_MANAGER
                      }
                    >
                      HR Manager
                    </option>

                    <option
                      value={
                        ROLES.IT_SUPPORT
                      }
                    >
                      IT Support
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="super-admin-user-id"
                    className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    System User ID
                  </label>

                  <input
                    id="super-admin-user-id"
                    type="text"
                    value={userId}
                    readOnly
                    aria-readonly="true"
                    tabIndex={-1}
                    className={
                      READ_ONLY_CONTROL_CLASS_NAME
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="super-admin-username"
                    className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Username
                  </label>

                  <input
                    id="super-admin-username"
                    type="text"
                    value={username}
                    readOnly
                    aria-readonly="true"
                    tabIndex={-1}
                    className={
                      READ_ONLY_CONTROL_CLASS_NAME
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                <p>
                  <strong>
                    Account preview:
                  </strong>{" "}
                  This account will be created as{" "}
                  <strong>
                    {
                      selectedRoleConfig.label
                    }
                  </strong>{" "}
                  with User ID{" "}
                  <strong>
                    {userId}
                  </strong>{" "}
                  and username{" "}
                  <strong>
                    {username}
                  </strong>
                  .
                </p>
              </div>

              {validationError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  {validationError}
                </div>
              )}

              <div className="flex justify-end border-t border-gray-200 pt-5 dark:border-white/10">
                <Button
                  type="submit"
                  leftIcon={
                    <FiUserPlus
                      aria-hidden="true"
                    />
                  }
                  loading={isSubmitting}
                  disabled={
                    isSubmitting ||
                    isLoadingAccounts
                  }
                >
                  Create Account
                </Button>
              </div>
            </form>
          </section>
        </RoleGuard>

        <section className="flex min-h-[450px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <header className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6 dark:border-white/10">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
                <FiUsers
                  className="text-indigo-600 dark:text-indigo-400"
                  aria-hidden="true"
                />

                Created Accounts
              </h2>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Review existing internal system accounts.
              </p>
            </div>

            <div className="w-full sm:w-56">
              <label
                htmlFor="account-role-filter"
                className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-gray-400"
              >
                Filter by Role
              </label>

              <select
                id="account-role-filter"
                value={userRoleFilter}
                disabled={
                  isLoadingAccounts ||
                  isSubmitting
                }
                className={
                  CONTROL_CLASS_NAME
                }
                onChange={(event) =>
                  setUserRoleFilter(
                    event.target.value
                  )
                }
              >
                <option value="ALL">
                  All Roles
                </option>

                <option
                  value={
                    ROLES.HR_STAFF
                  }
                >
                  HR Staff
                </option>

                <option
                  value={
                    ROLES.HR_MANAGER
                  }
                >
                  HR Manager
                </option>

                <option
                  value={
                    ROLES.IT_SUPPORT
                  }
                >
                  IT Support
                </option>
              </select>
            </div>
          </header>

          {isLoadingAccounts ? (
            <div className="p-5 sm:p-6">
              <LoadingSkeleton
                rows={6}
                columns={5}
                showHeader
              />
            </div>
          ) : filteredAccounts.length >
            0 ? (
            <div className="max-h-[560px] flex-1 overflow-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                  <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th
                      scope="col"
                      className="px-5 py-4 text-left sm:px-6"
                    >
                      User ID
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-left sm:px-6"
                    >
                      Full Name
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-left sm:px-6"
                    >
                      Username
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-left sm:px-6"
                    >
                      Role
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-left sm:px-6"
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredAccounts.map(
                    (
                      account,
                      index
                    ) => {
                      const accountStatus =
                        getAccountStatus(
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
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-500 sm:px-6 dark:text-gray-400">
                            {account.user_id ||
                              account.userId ||
                              "-"}
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <p className="max-w-[240px] truncate font-semibold text-gray-900 dark:text-white">
                              {account.full_name ||
                                account.fullName ||
                                account.name ||
                                "-"}
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-700 sm:px-6 dark:text-gray-300">
                            {account.username ||
                              "-"}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-700 sm:px-6 dark:text-gray-300">
                            {getRoleLabel(
                              account.role
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            <StatusBadge
                              status={
                                accountStatus
                              }
                              size="md"
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-1 items-center p-5 sm:p-6">
              <EmptyState
                icon="records"
                title="No accounts found"
                description={
                  userRoleFilter ===
                  "ALL"
                    ? "No internal user accounts are currently available."
                    : "No accounts match the selected role filter."
                }
                secondaryActionLabel={
                  userRoleFilter !==
                  "ALL"
                    ? "Show all roles"
                    : ""
                }
                onSecondaryAction={
                  userRoleFilter !==
                  "ALL"
                    ? () =>
                        setUserRoleFilter(
                          "ALL"
                        )
                    : undefined
                }
              />
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={isConfirmDialogOpen}
        title="Confirm Account Creation"
        tone="info"
        confirmLabel="Create Account"
        cancelLabel="Cancel"
        loading={isSubmitting}
        disabled={
          isSubmitting ||
          !name.trim() ||
          !userId ||
          !username
        }
        closeOnBackdrop={!isSubmitting}
        onClose={
          handleCloseConfirmDialog
        }
        onConfirm={
          confirmCreateAccount
        }
      >
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          Review the following information before creating the account.
        </p>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 dark:border-white/10 dark:bg-slate-800/60">
          <AccountDetailRow
            label="Full Name"
            value={name.trim()}
          />

          <AccountDetailRow
            label="Role"
            value={getRoleLabel(role)}
          />

          <AccountDetailRow
            label="User ID"
            value={userId}
            monospace
          />

          <AccountDetailRow
            label="Username"
            value={username}
            monospace
          />
        </div>
      </ConfirmDialog>

      <Dialog
        open={isSuccessDialogOpen}
        onClose={
          handleCloseSuccessDialog
        }
        title="Account Created Successfully"
        description="Save these temporary credentials and provide them securely to the authorized user."
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
                handleCopyCredentials
              }
            >
              Copy Credentials
            </Button>

            <Button
              type="button"
              variant="success"
              onClick={
                handleCloseSuccessDialog
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
            The internal user account was created successfully.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 dark:border-white/10 dark:bg-slate-800/60">
          <AccountDetailRow
            label="Full Name"
            value={
              createdAccount.name
            }
          />

          <AccountDetailRow
            label="Role"
            value={
              createdAccount.roleLabel
            }
          />

          <AccountDetailRow
            label="User ID"
            value={
              createdAccount.userId
            }
            monospace
          />

          <AccountDetailRow
            label="Username"
            value={
              createdAccount.username
            }
            monospace
          />

          <AccountDetailRow
            label="Temporary Password"
            value={
              createdAccount.temporaryPassword
            }
            monospace
          />
        </div>

        {copyMessage && (
          <div
            role="status"
            className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
          >
            {copyMessage}
          </div>
        )}

        <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">
          Do not send temporary credentials through public or unsecured channels.
        </p>
      </Dialog>
    </main>
  );
}