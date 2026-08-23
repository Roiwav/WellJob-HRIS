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
  FiUserPlus,
  FiUserX,
  FiUsers,
} from "react-icons/fi";

import { ROLES } from "../constants/roles";
import { PERMISSIONS } from "../constants/permissions";
import { API_BASE } from "../config/api";

import RoleGuard from "../components/auth/RoleGuard";

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

const USERS_API_URL = `${API_BASE}/users`;

const REQUEST_TIMEOUT_MS = 15000;
const TEMP_PASSWORD_BYTES = 8;

const TAB_CREATE = "CREATE";
const TAB_ACCOUNTS = "ACCOUNTS";

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

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  IT_SUPPORT: "IT Support",
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

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function generateTemporaryPassword() {
  if (
    !window.crypto ||
    typeof window.crypto.getRandomValues !== "function"
  ) {
    throw new Error(
      "Secure temporary password generation is unavailable in this browser."
    );
  }

  const randomBytes = new Uint8Array(
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

function extractNumberFromUserId(
  userId,
  prefix
) {
  const normalizedUserId = String(
    userId || ""
  ).trim();

  if (
    !normalizedUserId.startsWith(
      prefix
    )
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

  return Number.isNaN(
    parsedNumber
  )
    ? 0
    : parsedNumber;
}

function getApiError(
  error,
  fallbackMessage
) {
  if (
    error?.name === "AbortError"
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

    if (!response.ok) {
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

function getRoleLabel(
  roleValue
) {
  const normalizedRole =
    normalizeRole(
      roleValue
    );

  return (
    ROLE_LABELS[
      normalizedRole
    ] ||
    ROLE_CONFIG[
      roleValue
    ]?.label ||
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

function getAccountName(account) {
  return (
    account?.full_name ||
    account?.fullName ||
    account?.name ||
    account?.username ||
    "Unknown User"
  );
}

function getAccountStatus(
  account
) {
  const normalizedStatus =
    String(
      account?.status ||
        "Inactive"
    )
      .trim()
      .toLowerCase();

  return normalizedStatus ===
    "active"
    ? "Active"
    : "Inactive";
}

function isProtectedAccount(
  account
) {
  return (
    normalizeRole(
      account?.role
    ) === "SUPER_ADMIN"
  );
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

function PortalTab({
  active,
  icon,
  label,
  count,
  onClick,
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3",
        "text-sm font-extrabold transition",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/30",

        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white",
      ].join(" ")}
    >
      {icon}

      <span>{label}</span>

      {count !== undefined && (
        <span
          className={[
            "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-extrabold",

            active
              ? "bg-white/20 text-white"
              : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-200",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ProtectedAction() {
  return (
    <span
      title="Super Admin accounts are protected from administrative password reset and account-status actions."
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500 dark:border-white/10 dark:bg-slate-800 dark:text-gray-400"
    >
      <FiLock
        size={13}
        aria-hidden="true"
      />

      Protected
    </span>
  );
}

export default function SuperAdminPortal() {
  const [
    activeTab,
    setActiveTab,
  ] = useState(
    TAB_CREATE
  );

  const [accounts, setAccounts] =
    useState([]);

  const [name, setName] =
    useState("");

  const [role, setRole] =
    useState(
      ROLES.HR_STAFF
    );

  const [
    userRoleFilter,
    setUserRoleFilter,
  ] = useState("ALL");

  const [search, setSearch] =
    useState("");

  const [userId, setUserId] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [
    validationError,
    setValidationError,
  ] = useState("");

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    copyMessage,
    setCopyMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

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
    processingAction,
    setProcessingAction,
  ] = useState("");

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

  const [
    resetTarget,
    setResetTarget,
  ] = useState(null);

  const [
    resetTemporaryPassword,
    setResetTemporaryPassword,
  ] = useState("");

  const [
    resetCopyMessage,
    setResetCopyMessage,
  ] = useState("");

  const [
    toggleTarget,
    setToggleTarget,
  ] = useState(null);

  const isMountedRef =
    useRef(true);

  const selectedRoleConfig =
    ROLE_CONFIG[role] ||
    ROLE_CONFIG[
      ROLES.HR_STAFF
    ];

  const isProcessing =
    Boolean(
      processingAction
    );

  const isBusy =
    isSubmitting ||
    isProcessing;

  useEffect(() => {
    isMountedRef.current =
      true;

    return () => {
      isMountedRef.current =
        false;
    };
  }, []);

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
          setIsLoadingAccounts(
            true
          );
        }

        if (
          showRefreshing
        ) {
          setIsRefreshingAccounts(
            true
          );
        }

        try {
          if (showError) {
            setPageError("");
          }

          const data =
            await requestJson(
              USERS_API_URL
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
              setIsLoadingAccounts(
                false
              );
            }

            if (
              showRefreshing
            ) {
              setIsRefreshingAccounts(
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

  const nextGeneratedAccount =
    useMemo(() => {
      const prefix =
        selectedRoleConfig.prefix;

      const usernamePrefix =
        selectedRoleConfig.usernamePrefix;

      const sameRoleAccounts =
        accounts.filter(
          (account) =>
            normalizeRole(
              account?.role
            ) ===
            normalizeRole(
              role
            )
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
        String(
          nextNumber
        ).padStart(
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
  }, [
    nextGeneratedAccount,
  ]);

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

      return accounts.filter(
        (account) => {
          const matchesRole =
            userRoleFilter ===
              "ALL" ||
            normalizeRole(
              account?.role
            ) ===
              normalizeRole(
                userRoleFilter
              );

          if (!matchesRole) {
            return false;
          }

          if (
            searchTerms.length ===
            0
          ) {
            return true;
          }

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
                getRoleLabel(
                  account?.role
                ),
                getAccountStatus(
                  account
                ),
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
      userRoleFilter,
    ]);

  const hasActiveFilters =
    Boolean(
      search.trim() ||
      userRoleFilter !== "ALL"
    );

  const handleClearFilters =
    useCallback(() => {
      setSearch("");

      setUserRoleFilter(
        "ALL"
      );
    }, []);

  const handleRefresh =
    useCallback(async () => {
      if (
        isLoadingAccounts ||
        isRefreshingAccounts ||
        isBusy
      ) {
        return;
      }

      await fetchUsers({
        showRefreshing: true,
      });
    }, [
      fetchUsers,
      isBusy,
      isLoadingAccounts,
      isRefreshingAccounts,
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

        if (isBusy) {
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

        setIsConfirmDialogOpen(
          true
        );
      },
      [
        isBusy,
        validateForm,
      ]
    );

  const handleCloseConfirmDialog =
    useCallback(() => {
      if (isSubmitting) {
        return;
      }

      setIsConfirmDialogOpen(
        false
      );
    }, [isSubmitting]);

  const confirmCreateAccount =
    useCallback(async () => {
      if (isBusy) {
        return;
      }

      const errorMessage =
        validateForm();

      if (errorMessage) {
        setValidationError(
          errorMessage
        );

        setIsConfirmDialogOpen(
          false
        );

        return;
      }

      const trimmedName =
        name.trim();

      try {
        setIsSubmitting(true);
        setPageError("");

        const generatedPassword =
          generateTemporaryPassword();

        const data =
          await requestJson(
            USERS_API_URL,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  name:
                    trimmedName,

                  role,

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

        setCreatedAccount({
          userId:
            data?.account?.userId ||
            data?.account?.user_id ||
            "",

          username:
            data?.account?.username ||
            "",

          temporaryPassword:
            generatedPassword,

          name:
            trimmedName,

          roleLabel:
            getRoleLabel(
              role
            ),
        });

        setIsConfirmDialogOpen(
          false
        );

        setIsSuccessDialogOpen(
          true
        );

        setName("");

        setRole(
          ROLES.HR_STAFF
        );

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
        if (
          isMountedRef.current
        ) {
          setIsSubmitting(
            false
          );
        }
      }
    }, [
      fetchUsers,
      isBusy,
      name,
      role,
      validateForm,
    ]);

  const handleCloseSuccessDialog =
    useCallback(() => {
      setIsSuccessDialogOpen(
        false
      );

      setCopyMessage("");

      setCreatedAccount(
        (currentAccount) => ({
          ...currentAccount,

          temporaryPassword:
            "",
        })
      );
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
      const clipboard =
        globalThis.navigator?.clipboard;

      if (
        clipboard &&
        typeof clipboard.writeText ===
          "function"
      ) {
        await clipboard.writeText(
          credentials
        );

        setCopyMessage(
          "Credentials copied to clipboard."
        );

        return;
      }

      /*
       * LAN HTTP fallback:
       * navigator.clipboard may be unavailable
       * outside a secure browser context.
       */
      const textarea =
        document.createElement(
          "textarea"
        );

      const previouslyFocusedElement =
        document.activeElement;

      textarea.value =
        credentials;

      textarea.setAttribute(
        "readonly",
        ""
      );

      textarea.style.position =
        "fixed";

      textarea.style.top = "0";
      textarea.style.left =
        "-9999px";

      textarea.style.opacity =
        "0";

      textarea.style.pointerEvents =
        "none";

      document.body.appendChild(
        textarea
      );

      try {
        textarea.focus();
        textarea.select();

        textarea.setSelectionRange(
          0,
          textarea.value.length
        );

        const copied =
          document.execCommand(
            "copy"
          );

        if (!copied) {
          throw new Error(
            "Browser rejected the clipboard copy operation."
          );
        }
      } finally {
        textarea.remove();

        if (
          previouslyFocusedElement &&
          typeof previouslyFocusedElement.focus ===
            "function"
        ) {
          previouslyFocusedElement.focus();
        }
      }

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

  const handleOpenReset =
    useCallback(
      (account) => {
        if (
          !account?.id ||
          isBusy ||
          isProtectedAccount(
            account
          )
        ) {
          return;
        }

        setPageError("");

        setResetTemporaryPassword(
          ""
        );

        setResetCopyMessage(
          ""
        );

        setResetTarget(
          account
        );
      },
      [
        isBusy,
      ]
    );

  const handleCloseReset =
    useCallback(() => {
      if (isProcessing) {
        return;
      }

      setResetTarget(null);

      setResetTemporaryPassword(
        ""
      );

      setResetCopyMessage(
        ""
      );
    }, [
      isProcessing,
    ]);

  const handleConfirmReset =
    useCallback(async () => {
      if (
        !resetTarget?.id ||
        isBusy ||
        isProtectedAccount(
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
          `${USERS_API_URL}/reset/${encodeURIComponent(
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

        setResetTemporaryPassword(
          generatedPassword
        );

        await fetchUsers({
          showError: false,
        });
      } catch (error) {
        console.error(
          "Reset account password error:",
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

          setResetTemporaryPassword(
            ""
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
      fetchUsers,
      isBusy,
      resetTarget,
    ]);

  const handleCopyResetPassword =
    useCallback(async () => {
      if (
        !resetTemporaryPassword
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          resetTemporaryPassword
        );

        setResetCopyMessage(
          "Temporary password copied."
        );
      } catch (error) {
        console.error(
          "Copy reset password error:",
          error
        );

        setResetCopyMessage(
          "Unable to copy automatically."
        );
      }
    }, [
      resetTemporaryPassword,
    ]);

  const handleOpenToggle =
    useCallback(
      (account) => {
        if (
          !account?.id ||
          isBusy ||
          isProtectedAccount(
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
        isBusy,
      ]
    );

  const handleCloseToggle =
    useCallback(() => {
      if (isProcessing) {
        return;
      }

      setToggleTarget(
        null
      );
    }, [
      isProcessing,
    ]);

  const handleConfirmToggle =
    useCallback(async () => {
      if (
        !toggleTarget?.id ||
        isBusy ||
        isProtectedAccount(
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
        currentStatus === "Active"
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
          `${USERS_API_URL}/toggle/${encodeURIComponent(
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
      fetchUsers,
      isBusy,
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

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="System Administration"
        title="Super Admin Portal"
        description="Create, review, and securely manage internal system accounts."
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
              isBusy
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
          title="User account error"
          message={pageError}
          retryLabel="Reload accounts"
          onRetry={
            handleRefresh
          }
        />
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div
          role="tablist"
          aria-label="Super Admin Portal sections"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          <PortalTab
            active={
              activeTab ===
              TAB_CREATE
            }
            icon={
              <FiUserPlus
                aria-hidden="true"
              />
            }
            label="Create New Account"
            onClick={() =>
              setActiveTab(
                TAB_CREATE
              )
            }
          />

          <PortalTab
            active={
              activeTab ===
              TAB_ACCOUNTS
            }
            icon={
              <FiUsers
                aria-hidden="true"
              />
            }
            label="Created Accounts"
            count={
              accounts.length
            }
            onClick={() =>
              setActiveTab(
                TAB_ACCOUNTS
              )
            }
          />
        </div>
      </section>

      {activeTab ===
        TAB_CREATE && (
        <RoleGuard
          permission={
            PERMISSIONS.CAN_CREATE_SYSTEM_USERS
          }
        >
          <section
            role="tabpanel"
            className="mx-auto max-w-5xl rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6 lg:p-8"
          >
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <FiUserPlus
                  size={21}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
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
                    disabled={isBusy}
                    maxLength={150}
                    autoComplete="name"
                    placeholder="Enter full name"
                    className={
                      CONTROL_CLASS_NAME
                    }
                    onChange={(
                      event
                    ) => {
                      setName(
                        event.target
                          .value
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
                    disabled={isBusy}
                    className={
                      CONTROL_CLASS_NAME
                    }
                    onChange={(
                      event
                    ) => {
                      setRole(
                        event.target
                          .value
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
                <strong>
                  Account preview:
                </strong>{" "}
                This account will be
                created as{" "}
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
              </div>

              {validationError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  {
                    validationError
                  }
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
                  loading={
                    isSubmitting
                  }
                  disabled={
                    isBusy ||
                    isLoadingAccounts
                  }
                >
                  Create Account
                </Button>
              </div>
            </form>
          </section>
        </RoleGuard>
      )}

      {activeTab ===
        TAB_ACCOUNTS && (
        <section
          role="tabpanel"
          className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
        >
          <header className="border-b border-gray-200 px-5 py-5 sm:px-6 dark:border-white/10">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
              <FiUsers
                className="text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />

              Created Accounts
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Review and manage existing internal system accounts. Super Admin accounts remain protected.
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
                    !hasActiveFilters ||
                    isLoadingAccounts ||
                    isRefreshingAccounts ||
                    isBusy
                  }
                  onClick={
                    handleClearFilters
                  }
                >
                  Clear Filters
                </Button>
              }
            >
              <div className="w-full sm:col-span-2 xl:w-96">
                <SearchInput
                  label="Search created accounts"
                  hideLabel
                  placeholder="Search ID, name, username, role, or status..."
                  value={search}
                  disabled={
                    isLoadingAccounts ||
                    isRefreshingAccounts ||
                    isBusy
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

              <div className="min-w-0 xl:w-56">
                <label
                  htmlFor="account-role-filter"
                  className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Filter by Role
                </label>

                <select
                  id="account-role-filter"
                  value={
                    userRoleFilter
                  }
                  disabled={
                    isLoadingAccounts ||
                    isRefreshingAccounts ||
                    isBusy
                  }
                  className={
                    CONTROL_CLASS_NAME
                  }
                  onChange={(
                    event
                  ) =>
                    setUserRoleFilter(
                      event.target
                        .value
                    )
                  }
                >
                  <option value="ALL">
                    All Roles
                  </option>

                  <option value="SUPER_ADMIN">
                    Super Admin
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
                      ROLES.HR_STAFF
                    }
                  >
                    HR Staff
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
            </FilterBar>
          </div>

          {isLoadingAccounts ? (
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
              <table className="w-full min-w-[1020px] border-separate border-spacing-0 text-left text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                  <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-4 sm:px-6">
                      User ID
                    </th>

                    <th className="px-5 py-4 sm:px-6">
                      Full Name
                    </th>

                    <th className="px-5 py-4 sm:px-6">
                      Username
                    </th>

                    <th className="px-5 py-4 sm:px-6">
                      Role
                    </th>

                    <th className="px-5 py-4 sm:px-6">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right sm:px-6">
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
                      const accountStatus =
                        getAccountStatus(
                          account
                        );

                      const accountName =
                        getAccountName(
                          account
                        );

                      const isActive =
                        accountStatus ===
                        "Active";

                      const isProtected =
                        isProtectedAccount(
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
                              account.id ||
                              "-"}
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <p className="max-w-[260px] truncate font-semibold text-gray-900 dark:text-white">
                              {
                                accountName
                              }
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-700 sm:px-6 dark:text-gray-300">
                            {account.username ||
                              "-"}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {getRoleLabel(
                                account.role
                              )}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            <StatusBadge
                              status={
                                accountStatus
                              }
                              size="md"
                            />
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <div className="flex items-center justify-end gap-2">
                              {isProtected ? (
                                <ProtectedAction />
                              ) : (
                                <>
                                  <IconButton
                                    label={`Reset password for ${accountName}`}
                                    title="Reset Password"
                                    variant="primary"
                                    size="md"
                                    disabled={
                                      isBusy
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
                                      isBusy
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
                    : userRoleFilter !==
                        "ALL"
                      ? "filter"
                      : "records"
                }
                title={
                  search.trim()
                    ? "No accounts matched"
                    : userRoleFilter !==
                        "ALL"
                      ? "No role-filter results"
                      : "No accounts found"
                }
                description={
                  search.trim()
                    ? "No internal user accounts matched the current search and role filter."
                    : userRoleFilter !==
                        "ALL"
                      ? "Internal accounts exist, but none match the selected role."
                      : "No internal user accounts are currently available."
                }
                secondaryActionLabel={
                  hasActiveFilters
                    ? "Clear filters"
                    : ""
                }
                onSecondaryAction={
                  hasActiveFilters
                    ? handleClearFilters
                    : undefined
                }
              />
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={
          isConfirmDialogOpen
        }
        title="Confirm Account Creation"
        tone="info"
        confirmLabel="Create Account"
        cancelLabel="Cancel"
        loading={
          isSubmitting
        }
        disabled={
          isSubmitting ||
          !name.trim() ||
          !userId ||
          !username
        }
        closeOnBackdrop={
          !isSubmitting
        }
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
            value={
              getRoleLabel(role)
            }
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
        open={
          isSuccessDialogOpen
        }
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

      <ConfirmDialog
        open={
          Boolean(
            resetTarget
          ) &&
          !resetTemporaryPassword
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
          isBusy ||
          isProtectedAccount(
            resetTarget
          )
        }
        closeOnBackdrop={
          !isProcessing
        }
        onClose={
          handleCloseReset
        }
        onConfirm={
          handleConfirmReset
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
          The user will be required to change this temporary password during the next login.
        </div>
      </ConfirmDialog>

      <Dialog
        open={
          Boolean(
            resetTarget
          ) &&
          Boolean(
            resetTemporaryPassword
          )
        }
        onClose={
          handleCloseReset
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
                handleCopyResetPassword
              }
            >
              Copy Password
            </Button>

            <Button
              type="button"
              variant="success"
              onClick={
                handleCloseReset
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
            The account password was reset successfully.
          </p>
        </div>

        <div>
          <label
            htmlFor="super-admin-reset-password"
            className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Temporary Password
          </label>

          <input
            id="super-admin-reset-password"
            type="text"
            readOnly
            value={
              resetTemporaryPassword
            }
            className="ui-control font-mono font-bold"
          />
        </div>

        {resetCopyMessage && (
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            {
              resetCopyMessage
            }
          </p>
        )}

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          Provide this password securely to the account owner. Do not send it through public channels.
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
          isBusy ||
          isProtectedAccount(
            toggleTarget
          )
        }
        closeOnBackdrop={
          !isProcessing
        }
        onClose={
          handleCloseToggle
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
        message={
          successMessage
        }
        duration={3500}
        onClose={() =>
          setSuccessMessage("")
        }
      />
    </main>
  );
}