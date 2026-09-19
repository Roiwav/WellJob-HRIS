import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiBriefcase,
  FiLock,
  FiMail,
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
const CREATE_ACCOUNT_TIMEOUT_MS = 90000;

const TAB_CREATE = "CREATE";
const TAB_ACCOUNTS = "ACCOUNTS";

const ROLE_CONFIG = {
  [ROLES.HR_STAFF]: {
    label: "HR Staff",
  },

  [ROLES.HR_MANAGER]: {
    label: "HR Manager",
  },

  [ROLES.HR_COORDINATOR]: {
    label: "HR Coordinator",
  },

  [ROLES.IT_SUPPORT]: {
    label: "IT Support",
  },
};

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  HR_COORDINATOR:
    "HR Coordinator",
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

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function validRecoveryEmail(value) {
  if (!value.trim()) return true;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 &&
    /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(normalized) &&
    !normalized.split("@")[1].split(".").some(part => part.startsWith("-") || part.endsWith("-"));
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
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

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
      const requestError = new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );

      // Preserve HTTP status for field-specific form errors.
      requestError.status = response.status;

      throw requestError;
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

/*
 * The backend exposes this state to Super Admin only.
 * Do not infer resend eligibility from Inactive alone.
 */
function getCredentialsDeliveryStatus(account) {
  const status = String(
    account?.account_credentials_delivery_status || ""
  ).trim().toUpperCase();

  return ["PENDING", "SENDING", "FAILED", "SMTP_ACCEPTED"]
    .includes(status)
    ? status
    : null;
}

function isInitialDeliveryBlocked(account) {
  return ["PENDING", "SENDING", "FAILED"].includes(
    getCredentialsDeliveryStatus(account)
  );
}

function canResendInitialCredentials(account) {
  return (
    !isProtectedAccount(account) &&
    getAccountStatus(account) === "Inactive" &&
    getCredentialsDeliveryStatus(account) === "FAILED" &&
    account?.can_resend_initial_credentials === true
  );
}

function getAssignedCompany(
  account
) {
  return String(
    account?.assignedCompany ??
      account?.assigned_company ??
      ""
  ).trim();
}

function isHrCoordinatorAccount(
  account
) {
  return (
    normalizeRole(
      account?.role
    ) ===
    ROLES.HR_COORDINATOR
  );
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
      title="Super Admin accounts are protected from administrative account-status actions."
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

  const [
    companyOptions,
    setCompanyOptions,
  ] = useState([]);

  const [
    selectedCompany,
    setSelectedCompany,
  ] = useState("");

  const [name, setName] =
    useState("");

  const [email, setEmail] = useState("");

  // Create-account form error. Separate from the
  // recovery-email editor's emailError state.
  const [
    createEmailError,
    setCreateEmailError,
  ] = useState("");

  const [emailTarget, setEmailTarget] = useState(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState("");

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

  const [
    validationError,
    setValidationError,
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
    isLoadingAccounts,
    setIsLoadingAccounts,
  ] = useState(true);

  const [
    isRefreshingAccounts,
    setIsRefreshingAccounts,
  ] = useState(false);

  const [
    isLoadingCompanyOptions,
    setIsLoadingCompanyOptions,
  ] = useState(true);

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
    toggleTarget,
    setToggleTarget,
  ] = useState(null);

  const [
    resendTarget,
    setResendTarget,
  ] = useState(null);

  const [
    assignmentTarget,
    setAssignmentTarget,
  ] = useState(null);

  const [
    assignmentCompany,
    setAssignmentCompany,
  ] = useState("");

  const isMountedRef =
    useRef(true);

  const selectedRoleConfig =
    ROLE_CONFIG[role] ||
    ROLE_CONFIG[
      ROLES.HR_STAFF
    ];

  const isCreatingHrCoordinator =
    role ===
    ROLES.HR_COORDINATOR;

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

  const fetchCompanyOptions =
    useCallback(
      async ({
        showLoading = false,
        showError = true,
      } = {}) => {
        if (
          showLoading
        ) {
          setIsLoadingCompanyOptions(
            true
          );
        }

        try {
          if (showError) {
            setPageError("");
          }

          const data =
            await requestJson(
              `${USERS_API_URL}/company-options`
            );

          if (
            !isMountedRef.current
          ) {
            return false;
          }

          const companies =
            Array.isArray(
              data?.companies
            )
              ? data.companies
                  .map(
                    (company) =>
                      String(
                        company ||
                          ""
                      ).trim()
                  )
                  .filter(Boolean)
              : [];

          setCompanyOptions(
            Array.from(
              new Set(
                companies
              )
            ).sort(
              (
                first,
                second
              ) =>
                first.localeCompare(
                  second
                )
            )
          );

          return true;
        } catch (error) {
          console.error(
            "Fetch company options error:",
            error
          );

          if (
            showError &&
            isMountedRef.current
          ) {
            setPageError(
              getApiError(
                error,
                "Unable to load client company options."
              )
            );
          }

          return false;
        } finally {
          if (
            showLoading &&
            isMountedRef.current
          ) {
            setIsLoadingCompanyOptions(
              false
            );
          }
        }
      },
      []
    );

  useEffect(() => {
    void Promise.all([
      fetchUsers({
        showInitialLoading:
          true,
      }),

      fetchCompanyOptions({
        showLoading:
          true,
      }),
    ]);
  }, [
    fetchCompanyOptions,
    fetchUsers,
  ]);

  useEffect(() => {
    if (
      !isCreatingHrCoordinator
    ) {
      if (selectedCompany) {
        setSelectedCompany(
          ""
        );
      }

      return;
    }

    if (
      selectedCompany &&
      !companyOptions.some(
        (company) =>
          company ===
          selectedCompany
      )
    ) {
      setSelectedCompany(
        ""
      );
    }
  }, [
    companyOptions,
    isCreatingHrCoordinator,
    selectedCompany,
  ]);

  const visibleAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            normalizeRole(
              account?.role
            ) !==
            "SUPER_ADMIN"
        ),
      [accounts]
    );

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

      return visibleAccounts.filter(
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
                account?.full_name,
                account?.fullName,
                account?.name,
                account?.email,
                account?.role,
                getRoleLabel(
                  account?.role
                ),
                getAssignedCompany(
                  account
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
      search,
      userRoleFilter,
      visibleAccounts,
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

      await Promise.all([
        fetchUsers({
          showRefreshing:
            true,
        }),

        fetchCompanyOptions({
          showError:
            true,
        }),
      ]);
    }, [
      fetchCompanyOptions,
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

      if (!email.trim() || !validRecoveryEmail(email)) {
        return "Enter a valid account email address to receive the new user credentials.";
      }

      if (
        !role ||
        !ROLE_CONFIG[role]
      ) {
        return "Please select a valid role.";
      }

      if (
        isCreatingHrCoordinator
      ) {
        if (
          !selectedCompany
        ) {
          return "Please assign a client company to the HR Coordinator account.";
        }

        if (
          !companyOptions.includes(
            selectedCompany
          )
        ) {
          return "Please select a valid client company assignment.";
        }
      }

      return "";
    }, [
      companyOptions,
      isCreatingHrCoordinator,
      email,
      name,
      role,
      selectedCompany,
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
        setCreateEmailError("");
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
        setValidationError("");
        setCreateEmailError("");

        await requestJson(
          USERS_API_URL,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: trimmedName,
              email: email.trim(),
              role,
              assignedCompany: isCreatingHrCoordinator
                ? selectedCompany
                : undefined,
            }),
          },
          CREATE_ACCOUNT_TIMEOUT_MS
        );

        if (!isMountedRef.current) {
          return;
        }

        setIsConfirmDialogOpen(false);
        setName("");
        setEmail("");
        setRole(ROLES.HR_STAFF);
        setSelectedCompany("");
        setValidationError("");
        setCreateEmailError("");
        setSuccessMessage(
          "Account created. Credentials email accepted for delivery to the registered email address."
        );

        await fetchUsers({ showError: false });
      } catch (error) {
        if (isMountedRef.current) {
          const message = getApiError(
            error,
            "Unable to create the user account."
          );

          const isDuplicateRecoveryEmail =
            error?.status === 409 &&
            /recovery email\s+is\s+already registered/i.test(
              message
            );

          // The confirmation dialog must close so the
          // error is visible beside the editable field.
          // Keep all entered form values unchanged.
          setIsConfirmDialogOpen(false);

          if (isDuplicateRecoveryEmail) {
            setCreateEmailError(
              "This recovery email is already registered. Please use a different recovery email."
            );
            setValidationError("");
            setPageError("");
          } else {
            setCreateEmailError("");
            setValidationError(
              error?.name === "AbortError"
                ? "The account request timed out. Check Created Accounts before trying again; the account may already exist."
                : message
            );
            setPageError("");
          }
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
      isCreatingHrCoordinator,
      email,
      name,
      role,
      selectedCompany,
      validateForm,
    ]);

  const handleOpenToggle =
    useCallback(
      (account) => {
        if (
          !account?.id ||
          isBusy ||
          isProtectedAccount(account)
        ) {
          return;
        }

        if (
          getAccountStatus(account) === "Inactive" &&
          isInitialDeliveryBlocked(account)
        ) {
          setPageError(
            "This account cannot be activated while initial credentials delivery is pending or failed. Use Resend Credentials when available."
          );
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

      if (
        currentStatus === "Inactive" &&
        isInitialDeliveryBlocked(toggleTarget)
      ) {
        setToggleTarget(null);
        setPageError(
          "Initial credentials delivery is incomplete. Refresh the accounts before attempting activation."
        );
        return;
      }

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

  const handleOpenResend = useCallback(
    (account) => {
      if (
        isBusy ||
        !account?.id ||
        !canResendInitialCredentials(account)
      ) {
        return;
      }

      setPageError("");
      setResendTarget(account);
    },
    [isBusy]
  );

  const handleCloseResend = useCallback(() => {
    if (isProcessing) return;
    setResendTarget(null);
  }, [isProcessing]);

  const handleConfirmResend = useCallback(async () => {
    if (
      isBusy ||
      !resendTarget?.id ||
      !canResendInitialCredentials(resendTarget)
    ) {
      return;
    }

    try {
      setProcessingAction("resend");
      setPageError("");

      const data = await requestJson(
        `${USERS_API_URL}/${encodeURIComponent(
          resendTarget.id
        )}/resend-credentials`,
        { method: "POST" },
        CREATE_ACCOUNT_TIMEOUT_MS
      );

      if (!isMountedRef.current) return;

      setResendTarget(null);
      setSuccessMessage(
        data?.message ||
          "New account credentials email accepted for delivery. The account is now active."
      );

      await fetchUsers({ showError: true });
    } catch (error) {
      if (!isMountedRef.current) return;

      setResendTarget(null);
      setPageError(
        error?.name === "AbortError"
          ? "The resend request timed out. Refresh Created Accounts before trying again; the email may already have been accepted for delivery."
          : getApiError(
              error,
              "Unable to resend initial account credentials."
            )
      );

      // The server may have changed the account state even
      // when this request timed out. Reload before another try.
      await fetchUsers({ showError: false });
    } finally {
      if (isMountedRef.current) {
        setProcessingAction("");
      }
    }
  }, [fetchUsers, isBusy, resendTarget]);

  const handleOpenRecoveryEmail = useCallback((account) => {
    if (!account?.id || isBusy || isProtectedAccount(account)) return;
    setPageError("");
    setEmailTarget(account);
    setEmailDraft(account.email || "");
    setEmailError("");
  }, [isBusy]);

  const handleCloseRecoveryEmail = useCallback(() => {
    if (isProcessing) return;
    setEmailTarget(null);
    setEmailDraft("");
    setEmailError("");
  }, [isProcessing]);

  const handleSaveRecoveryEmail = useCallback(async () => {
    if (!emailTarget?.id || isBusy) return;
    if (!validRecoveryEmail(emailDraft)) {
      setEmailError("Enter a valid recovery email address (maximum 254 characters).");
      return;
    }
    try {
      setProcessingAction("email");
      setEmailError("");
      const data = await requestJson(
        `${USERS_API_URL}/${encodeURIComponent(emailTarget.id)}/recovery-email`,
        { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailDraft.trim() }) }
      );
      if (!isMountedRef.current) return;
      setAccounts(current => current.map(account =>
        String(account.id) === String(emailTarget.id)
          ? { ...account, email: data.email, email_verified: data.unchanged ? account.email_verified : false }
          : account
      ));
      setEmailTarget(null);
      setEmailDraft("");
      setEmailError("");
      setSuccessMessage(data.message || "Recovery email updated.");
      void fetchUsers({ showError: false });
    } catch (error) {
      if (isMountedRef.current) setEmailError(getApiError(error, "Unable to save recovery email."));
    } finally {
      if (isMountedRef.current) setProcessingAction("");
    }
  }, [emailTarget, emailDraft, isBusy, fetchUsers]);

  const handleOpenAssignment =
    useCallback(
      (account) => {
        if (
          !account?.id ||
          isBusy ||
          !isHrCoordinatorAccount(
            account
          )
        ) {
          return;
        }

        setPageError("");

        setAssignmentTarget(
          account
        );

        setAssignmentCompany(
          getAssignedCompany(
            account
          )
        );
      },
      [
        isBusy,
      ]
    );

  const handleCloseAssignment =
    useCallback(() => {
      if (
        processingAction ===
        "assignment"
      ) {
        return;
      }

      setAssignmentTarget(
        null
      );

      setAssignmentCompany(
        ""
      );
    }, [
      processingAction,
    ]);

  const handleConfirmAssignment =
    useCallback(async () => {
      if (
        !assignmentTarget?.id ||
        isBusy ||
        !isHrCoordinatorAccount(
          assignmentTarget
        )
      ) {
        return;
      }

      const normalizedCompany =
        String(
          assignmentCompany ||
            ""
        ).trim();

      if (
        !normalizedCompany ||
        !companyOptions.includes(
          normalizedCompany
        )
      ) {
        setPageError(
          "Please select a valid client company assignment."
        );

        return;
      }

      const accountName =
        getAccountName(
          assignmentTarget
        );

      try {
        setProcessingAction(
          "assignment"
        );

        setPageError("");

        const data =
          await requestJson(
            `${USERS_API_URL}/${encodeURIComponent(
              assignmentTarget.id
            )}/assigned-company`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  assignedCompany:
                    normalizedCompany,
                }),
            }
          );

        if (
          !isMountedRef.current
        ) {
          return;
        }

        const updatedCompany =
          String(
            data?.assignedCompany ||
              data?.assigned_company ||
              normalizedCompany
          ).trim();

        setAccounts(
          (currentAccounts) =>
            currentAccounts.map(
              (account) =>
                String(
                  account?.id
                ) ===
                String(
                  assignmentTarget.id
                )
                  ? {
                      ...account,

                      assigned_company:
                        updatedCompany,

                      assignedCompany:
                        updatedCompany,
                    }
                  : account
            )
        );

        setAssignmentTarget(
          null
        );

        setAssignmentCompany(
          ""
        );

        setSuccessMessage(
          `${accountName} is now assigned to ${updatedCompany}. The coordinator must sign in again if an existing session was active.`
        );

        void fetchUsers({
          showError:
            false,
        });
      } catch (error) {
        console.error(
          "Update HR Coordinator company assignment error:",
          error
        );

        if (
          isMountedRef.current
        ) {
          setPageError(
            getApiError(
              error,
              "Unable to update the HR Coordinator company assignment."
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
      assignmentCompany,
      assignmentTarget,
      companyOptions,
      fetchUsers,
      isBusy,
    ]);

  const toggleAccountName =
    getAccountName(
      toggleTarget
    );

  const toggleCurrentStatus =
    getAccountStatus(
      toggleTarget
    );

  const assignmentAccountName =
    getAccountName(
      assignmentTarget
    );

  const assignmentCurrentCompany =
    getAssignedCompany(
      assignmentTarget
    );

  const willActivate =
    toggleCurrentStatus !==
    "Active";

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="System Administration"
        title="Super Admin Portal"
        description="Create, review, and securely manage internal system accounts, including company-scoped HR Coordinator access."
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
              visibleAccounts.length
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
                  Create an internal account, assign an authorized system role, and bind HR Coordinator access to a specific client company.
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
                      const nextRole =
                        event.target
                          .value;

                      setRole(
                        nextRole
                      );

                      if (
                        nextRole !==
                        ROLES.HR_COORDINATOR
                      ) {
                        setSelectedCompany(
                          ""
                        );
                      }

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
                        ROLES.HR_COORDINATOR
                      }
                    >
                      HR Coordinator
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

              <div>
                <label htmlFor="super-admin-recovery-email"
                  className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Account Email (required)
                </label>
                <input
                  id="super-admin-recovery-email"
                  type="email"
                  value={email}
                  disabled={isBusy}
                  maxLength={254}
                  autoComplete="off"
                  placeholder="name@example.com"
                  required
                  aria-invalid={Boolean(createEmailError)}
                  aria-describedby={
                    createEmailError
                      ? "super-admin-recovery-email-error"
                      : undefined
                  }
                  className={[
                    CONTROL_CLASS_NAME,
                    createEmailError
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "",
                  ].join(" ")}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setCreateEmailError("");
                    setValidationError("");
                  }}
                />
                {createEmailError && (
                  <p
                    id="super-admin-recovery-email-error"
                    role="alert"
                    className="mt-2 text-sm font-semibold text-red-700 dark:text-red-400"
                  >
                    {createEmailError}
                  </p>
                )}
                <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  The new user receives their account credentials at this address. They must verify the address before using Forgot Password.
                </p>
              </div>

              {isCreatingHrCoordinator && (
                <div>
                  <label
                    htmlFor="super-admin-assigned-company"
                    className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Assigned Client Company
                  </label>

                  <select
                    id="super-admin-assigned-company"
                    value={
                      selectedCompany
                    }
                    disabled={
                      isBusy ||
                      isLoadingCompanyOptions
                    }
                    className={
                      CONTROL_CLASS_NAME
                    }
                    onChange={(
                      event
                    ) => {
                      setSelectedCompany(
                        event.target
                          .value
                      );

                      setValidationError(
                        ""
                      );
                    }}
                  >
                    <option value="">
                      {isLoadingCompanyOptions
                        ? "Loading client companies..."
                        : companyOptions.length
                          ? "Select client company"
                          : "No client companies available"}
                    </option>

                    {companyOptions.map(
                      (
                        company
                      ) => (
                        <option
                          key={
                            company
                          }
                          value={
                            company
                          }
                        >
                          {
                            company
                          }
                        </option>
                      )
                    )}
                  </select>

                  <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                    HR Coordinator access will be limited to employee, deployment, and incident data for this assigned client company.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                The system generates the User ID, username, and temporary password on the server. All login credentials are emailed directly to the account owner, not displayed here.
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                The account will be created as <strong>{selectedRoleConfig.label}</strong>
                {isCreatingHrCoordinator && selectedCompany
                  ? <> and assigned to <strong>{selectedCompany}</strong>.</>
                  : "."}
                {" "}Login credentials will be sent only to the account email address.
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
                    isLoadingAccounts ||
                    (
                      isCreatingHrCoordinator &&
                      isLoadingCompanyOptions
                    )
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
              Review and manage internal accounts created for HR, HR Coordinator, and IT support roles.
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
                  placeholder="Search name, email, role, company, or status..."
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
                      ROLES.HR_COORDINATOR
                    }
                  >
                    HR Coordinator
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
                columns={8}
                showHeader
              />
            </div>
          ) : filteredAccounts.length >
            0 ? (
            <div className="max-h-[650px] overflow-auto">
              <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                  <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-4 sm:px-6">
                      Full Name
                    </th>

                    <th className="px-5 py-4 sm:px-6">Recovery Email</th>

                    <th className="px-5 py-4 sm:px-6">
                      Role
                    </th>

                    <th className="px-5 py-4 sm:px-6">
                      Assigned Company
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

                      const isHrCoordinator =
                        isHrCoordinatorAccount(
                          account
                        );

                      const assignedCompany =
                        getAssignedCompany(
                          account
                        );

                      const deliveryStatus =
                        getCredentialsDeliveryStatus(account);

                      const isActivationBlocked =
                        !isActive && isInitialDeliveryBlocked(account);

                      const canResend =
                        canResendInitialCredentials(account);

                      return (
                        <tr
                          key={getAccountKey(
                            account,
                            index
                          )}
                          className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-white/5"
                        >
                          <td className="px-5 py-4 sm:px-6">
                            <p className="max-w-[260px] truncate font-semibold text-gray-900 dark:text-white">
                              {
                                accountName
                              }
                            </p>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <span className="block max-w-[240px] truncate text-gray-700 dark:text-gray-300" title={account.email || "Not registered"}>
                              {account.email || "Not registered"}
                            </span>
                            {account.email && (
                              <span className={account.email_verified ? "text-xs font-semibold text-emerald-700 dark:text-emerald-400" : "text-xs font-semibold text-amber-700 dark:text-amber-400"}>
                                {account.email_verified ? "Verified" : "Unverified"}
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {getRoleLabel(
                                account.role
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            {isHrCoordinator ? (
                              <span
                                title={
                                  assignedCompany ||
                                  "No company assigned"
                                }
                                className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                              >
                                <FiBriefcase
                                  size={12}
                                  aria-hidden="true"
                                  className="shrink-0"
                                />

                                <span className="truncate">
                                  {assignedCompany ||
                                    "Not Assigned"}
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">
                                —
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            <div className="flex flex-col items-start gap-1.5">
                              <StatusBadge
                                status={accountStatus}
                                size="md"
                              />

                              {deliveryStatus === "FAILED" && (
                                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                                  Credentials email failed
                                </span>
                              )}

                              {deliveryStatus === "PENDING" && (
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                  Credentials email pending
                                </span>
                              )}

                              {deliveryStatus === "SENDING" && (
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                  Sending credentials email
                                </span>
                              )}

                              {deliveryStatus === "SMTP_ACCEPTED" && (
                                <span
                                  className="text-xs text-gray-500 dark:text-gray-400"
                                  title="SMTP acceptance does not guarantee inbox delivery."
                                >
                                  Credentials email accepted
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <div className="flex items-center justify-end gap-2">
                              {isProtected ? (
                                <ProtectedAction />
                              ) : (
                                <>
                                  {isHrCoordinator && (
                                    <IconButton
                                      label={`Assign client company for ${accountName}`}
                                      title="Assign Client Company"
                                      variant="secondary"
                                      size="md"
                                      disabled={
                                        isBusy ||
                                        isLoadingCompanyOptions
                                      }
                                      onClick={() =>
                                        handleOpenAssignment(
                                          account
                                        )
                                      }
                                    >
                                      <FiBriefcase
                                        aria-hidden="true"
                                      />
                                    </IconButton>
                                  )}

                                  <IconButton
                                    label={`Register or edit recovery email for ${accountName}`}
                                    title="Recovery Email" variant="secondary" size="md"
                                    disabled={isBusy} onClick={() => handleOpenRecoveryEmail(account)}
                                  ><FiMail aria-hidden="true" /></IconButton>

                                  {canResend && (
                                    <IconButton
                                      label={`Resend initial account credentials to ${accountName}`}
                                      title="Resend Credentials"
                                      variant="secondary"
                                      size="md"
                                      disabled={isBusy}
                                      onClick={() => handleOpenResend(account)}
                                    >
                                      <FiRefreshCw aria-hidden="true" />
                                    </IconButton>
                                  )}

                                  {isActivationBlocked ? (
                                    <span
                                      title={
                                        canResend
                                          ? "Resend initial credentials before activating this account."
                                          : "Initial credentials delivery must be resolved before activation."
                                      }
                                      className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                    >
                                      Activation blocked
                                    </span>
                                  ) : (
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
                                  )}
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
          !email.trim() ||
          !validRecoveryEmail(email) ||
          (
            isCreatingHrCoordinator &&
            !selectedCompany
          )
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

          {isCreatingHrCoordinator && (
            <AccountDetailRow
              label="Assigned Company"
              value={
                selectedCompany
              }
            />
          )}

          <AccountDetailRow label="Account Email" value={email.trim()} />
        </div>
      </ConfirmDialog>

      <Dialog open={Boolean(emailTarget)} onClose={handleCloseRecoveryEmail}
        title="Register Recovery Email"
        description={`Register or update the recovery email for ${getAccountName(emailTarget)}. Email ownership must be verified before Forgot Password can use it.`}
        tone="info" size="md" closeOnOverlay={!isProcessing}
        closeOnEscape={!isProcessing} showCloseButton bodyClassName="space-y-5 p-6"
        footer={<div className="flex w-full justify-end gap-3">
          <Button type="button" variant="secondary" disabled={isProcessing} onClick={handleCloseRecoveryEmail}>Cancel</Button>
          <Button type="button" loading={processingAction === "email"}
            disabled={isBusy || !emailTarget?.id || !validRecoveryEmail(emailDraft)}
            onClick={handleSaveRecoveryEmail}>Save Recovery Email</Button>
        </div>}
      >
        <label htmlFor="edit-recovery-email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Recovery Email</label>
        <input id="edit-recovery-email" type="email" value={emailDraft}
          disabled={isProcessing} maxLength={254} autoComplete="off"
          placeholder="name@example.com" className={CONTROL_CLASS_NAME}
          onChange={event => { setEmailDraft(event.target.value); setEmailError(""); }} />
        {emailError && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-400">{emailError}</p>}
        <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
          Leave blank to remove the address. Changing or removing it revokes existing login sessions and pending recovery links. The account owner must verify the updated email before it can be used for Forgot Password.
        </p>
      </Dialog>

      <Dialog
        open={
          Boolean(
            assignmentTarget
          )
        }
        onClose={
          handleCloseAssignment
        }
        title="Assign HR Coordinator Company"
        description={`Set the client company scope for ${assignmentAccountName}. Changing the assignment invalidates the coordinator's existing login session.`}
        tone="info"
        size="md"
        closeOnOverlay={
          processingAction !==
          "assignment"
        }
        closeOnEscape={
          processingAction !==
          "assignment"
        }
        showCloseButton
        bodyClassName="space-y-5 p-6"
        footer={
          <div className="flex w-full flex-col-reverse justify-end gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              disabled={
                processingAction ===
                "assignment"
              }
              onClick={
                handleCloseAssignment
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              leftIcon={
                <FiBriefcase
                  aria-hidden="true"
                />
              }
              loading={
                processingAction ===
                "assignment"
              }
              disabled={
                isBusy ||
                !assignmentTarget?.id ||
                !assignmentCompany ||
                !companyOptions.includes(
                  assignmentCompany
                )
              }
              onClick={
                handleConfirmAssignment
              }
            >
              Save Assignment
            </Button>
          </div>
        }
      >
        <div>
          <label
            htmlFor="hr-coordinator-company-assignment"
            className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300"
          >
            Assigned Client Company
          </label>

          <select
            id="hr-coordinator-company-assignment"
            value={
              assignmentCompany
            }
            disabled={
              processingAction ===
                "assignment" ||
              isLoadingCompanyOptions
            }
            className={
              CONTROL_CLASS_NAME
            }
            onChange={(
              event
            ) =>
              setAssignmentCompany(
                event.target
                  .value
              )
            }
          >
            <option value="">
              {isLoadingCompanyOptions
                ? "Loading client companies..."
                : companyOptions.length
                  ? "Select client company"
                  : "No client companies available"}
            </option>

            {companyOptions.map(
              (
                company
              ) => (
                <option
                  key={
                    company
                  }
                  value={
                    company
                  }
                >
                  {
                    company
                  }
                </option>
              )
            )}
          </select>

          <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
            Current assignment:{" "}
            <strong className="font-bold text-gray-700 dark:text-gray-200">
              {assignmentCurrentCompany ||
                "Not Assigned"}
            </strong>
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          The coordinator will only access Employees, Deployment Tracking, and Incident Report data allowed for the selected company. Any existing coordinator session is revoked when the company changes.
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(resendTarget)}
        title="Resend Initial Account Credentials"
        tone="info"
        confirmLabel="Resend Credentials"
        cancelLabel="Cancel"
        loading={processingAction === "resend"}
        disabled={
          isBusy ||
          !resendTarget?.id ||
          !canResendInitialCredentials(resendTarget)
        }
        closeOnBackdrop={!isProcessing}
        onClose={handleCloseResend}
        onConfirm={handleConfirmResend}
      >
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          Send a new temporary password to the registered email for{" "}
          <strong className="font-extrabold text-gray-900 dark:text-white">
            {getAccountName(resendTarget)}
          </strong>
          ?
        </p>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 dark:border-white/10 dark:bg-slate-800/60">
          <AccountDetailRow
            label="Account Email"
            value={resendTarget?.email || "Not registered"}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          The backend will replace the previous temporary password before
          sending a new one. The account stays inactive if delivery fails.
          No password will be displayed here. Do not submit the resend
          request again if it times out; refresh the account list first.
        </p>
      </ConfirmDialog>

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
          ) ||
          (willActivate && isInitialDeliveryBlocked(toggleTarget))
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
        title="Account Notification"
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
