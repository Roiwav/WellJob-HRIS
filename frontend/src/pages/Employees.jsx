import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  FiArchive,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiPlus,
  FiRotateCcw,
  FiSend,
  FiShield,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";
import axios from "axios";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/useAuth";
import { API_BASE } from "../config/api";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";
import EditEmployeeModal from "../components/employees/EditEmployeeModal";
import EmployeeModal from "../components/employees/EmployeeModal";
import EmployeeTable from "../components/employees/EmployeeTable";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ErrorState from "../components/ui/ErrorState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import SuccessToast from "../components/ui/SuccessToast";
import {
  EMPLOYEE_API_URL,
  getEmployeeApiError,
  parseEmployeeDocuments,
} from "../utils/employees/employeeFormHelpers";
import {
  COMPLIANCE_OPTIONS,
  getComplianceStatus,
} from "../utils/employees/employeeHelpers";

const DATA_EVENT_SOURCE =
  "employees-page";

const REQUEST_TIMEOUT_MS =
  45 * 1000;

const DATA_UPDATE_DEBOUNCE_MS =
  300;

const SEARCH_DEBOUNCE_MS =
  350;

const EMPLOYEE_PAGE_SIZE =
  50;

const DEPLOYMENT_ATTEMPT_API_URL =
  `${API_BASE}/deployment-attempts`;

const MOBILE_HANDOFF_SESSION_KEY =
  "welljob_employee_mobile_handoff";

const MOBILE_HANDOFF_SESSION_MAX_AGE_MS =
  30 * 60 * 1000;

const MOBILE_HANDOFF_PURPOSE =
  "EMPLOYEE_DOCUMENT_CAPTURE";

const EMPLOYEE_REFRESH_DOMAINS =
  new Set([
    "employees",
    "employee",
    "deployments",
    "deployment",
  ]);

const WORKFORCE_STATUS_OPTIONS = [
  {
    value:
      "All",
    label:
      "All Workforce Statuses",
  },
  {
    value:
      "Floating / Standby",
    label:
      "Floating / Standby",
  },
  {
    value:
      "For Deployment",
    label:
      "For Deployment",
  },
  {
    value:
      "Deployed",
    label:
      "Deployed",
  },
];

const SELECT_CLASS_NAME =
  "min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 " +
  "text-sm font-medium text-slate-800 outline-none transition " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 " +
  "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 " +
  "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 " +
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15 " +
  "dark:disabled:bg-slate-800 dark:disabled:text-slate-500";

function getAuthenticatedHeaders(
  additionalHeaders = {}
) {
  const token =
    String(
      localStorage.getItem(
        "token"
      ) || ""
    ).trim();
  return {
    Accept:
      "application/json",
    ...additionalHeaders,
    ...(token
      ? {
          Authorization:
            `Bearer ${token}`,
        }
      : {}),
  };
}

function emitDataUpdated(
  action = "EMPLOYEES_UPDATED"
) {
  window.dispatchEvent(
    new CustomEvent(
      "dataUpdated",
      {
        detail: {
          source:
            DATA_EVENT_SOURCE,
          domain:
            "employees",
          action,
          at:
            Date.now(),
        },
      }
    )
  );
}

function shouldRefreshEmployees(
  event
) {
  const detail =
    event?.detail || {};
  if (
    detail.source ===
    DATA_EVENT_SOURCE
  ) {
    return false;
  }
  const domain =
    String(
      detail.domain || ""
    )
      .trim()
      .toLowerCase();
  if (!domain) {
    return true;
  }
  return (
    EMPLOYEE_REFRESH_DOMAINS.has(
      domain
    )
  );
}

function normalizeEmployeePageRole(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function getEmployeeId(
  employee
) {
  return String(
    employee?.id ||
      employee?.employeeId ||
      employee?.employee_id ||
      ""
  );
}

function getEmployeeName(
  employee
) {
  return String(
    employee?.name ||
      employee?.full_name ||
      employee?.fullName ||
      getEmployeeId(
        employee
      ) ||
      "the employee"
  ).trim();
}

function getEmployeePosition(
  employee
) {
  return String(
    employee?.position ||
      employee?.jobPosition ||
      employee?.job_position ||
      employee?.positionName ||
      employee?.position_name ||
      ""
  ).trim();
}

function getEmployeeCompany(
  employee
) {
  return String(
    employee?.company ||
      employee?.clientCompany ||
      employee?.client_company ||
      employee?.companyName ||
      employee?.company_name ||
      ""
  ).trim();
}

function getPhilippinesTodayISO() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Manila",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    );

  return `${values.year}-${values.month}-${values.day}`;
}

function getPhilippinesCurrentTimeISO() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Manila",
        hour:
          "2-digit",
        minute:
          "2-digit",
        hourCycle:
          "h23",
      }
    ).formatToParts(
      new Date()
    );

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    );

  return `${values.hour}:${values.minute}`;
}

function formatWorkflowTime(
  value
) {
  const normalized =
    String(
      value || ""
    ).trim();

  const match =
    normalized.match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/
    );

  if (!match) {
    return "-";
  }

  const hour24 =
    Number(
      match[1]
    );

  const minute =
    match[2];

  const period =
    hour24 >= 12
      ? "PM"
      : "AM";

  const hour12 =
    hour24 % 12 ||
    12;

  return `${hour12}:${minute} ${period}`;
}

function formatWorkflowDate(
  value
) {
  const normalized =
    String(
      value || ""
    ).trim();

  if (!normalized) {
    return "-";
  }

  const match =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (!match) {
    return normalized;
  }

  const date =
    new Date(
      Date.UTC(
        Number(
          match[1]
        ),
        Number(
          match[2]
        ) - 1,
        Number(
          match[3]
        )
      )
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
      timeZone:
        "UTC",
    }
  ).format(
    date
  );
}

function normalizeSmartAlertEmployeeTarget(
  value
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const employeeId =
    Number(
      value.employeeId ??
        value.employee_id
    );

  if (
    !Number.isSafeInteger(
      employeeId
    ) ||
    employeeId <= 0 ||
    value.openCompliance !==
      true
  ) {
    return null;
  }

  const rawDocumentId =
    Number(
      value.documentId ??
        value.document_id
    );

  const documentId =
    Number.isSafeInteger(
      rawDocumentId
    ) &&
    rawDocumentId > 0
      ? rawDocumentId
      : null;

  const documentName =
    String(
      value.documentName ??
        value.document_name ??
        ""
    ).trim();

  const alertKey =
    String(
      value.alertKey ??
        value.alert_key ??
        ""
    ).trim();

  return {
    employeeId,
    openCompliance:
      true,
    documentId,
    documentName,
    alertKey,
  };
}

function normalizeMobileHandoffTarget(
  value
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const employeeId =
    Number(
      value.employeeId
    );

  const purpose =
    String(
      value.purpose || ""
    ).trim();

  const resolvedAt =
    Number(
      value.resolvedAt
    );

  if (
    !Number.isSafeInteger(
      employeeId
    ) ||
    employeeId <= 0 ||
    purpose !==
      MOBILE_HANDOFF_PURPOSE ||
    value.openCompliance !==
      true ||
    !Number.isFinite(
      resolvedAt
    ) ||
    resolvedAt <= 0 ||
    Date.now() -
      resolvedAt >
      MOBILE_HANDOFF_SESSION_MAX_AGE_MS
  ) {
    return null;
  }

  return {
    employeeId,
    purpose,
    openCompliance:
      true,
    resolvedAt,
  };
}

function readMobileHandoffSession() {
  try {
    const storedValue =
      sessionStorage.getItem(
        MOBILE_HANDOFF_SESSION_KEY
      );

    if (!storedValue) {
      return null;
    }

    const parsedValue =
      JSON.parse(
        storedValue
      );

    const normalizedTarget =
      normalizeMobileHandoffTarget(
        parsedValue
      );

    if (!normalizedTarget) {
      sessionStorage.removeItem(
        MOBILE_HANDOFF_SESSION_KEY
      );
    }

    return normalizedTarget;
  } catch {
    try {
      sessionStorage.removeItem(
        MOBILE_HANDOFF_SESSION_KEY
      );
    } catch {
      // Browser storage may be unavailable.
    }

    return null;
  }
}

function clearMobileHandoffSession() {
  try {
    sessionStorage.removeItem(
      MOBILE_HANDOFF_SESSION_KEY
    );
  } catch {
    // Browser storage may be unavailable.
  }
}

function normalizeEmployee(
  employee = {}
) {
  const workforceStatus =
    String(
      employee?.workforceStatus ||
      employee?.workforce_status ||
      (
        [
          "Floating / Standby",
          "For Deployment",
          "Deployed",
        ].includes(
          employee?.status
        )
          ? employee.status
          : ""
      )
    ).trim();

  const employmentStatus =
    String(
      employee?.employmentStatus ||
      employee?.employment_status ||
      ""
    ).trim();

  const dateHired =
    String(
      employee?.dateHired ||
      employee?.date_hired ||
      ""
    ).trim();

  return {
    ...employee,

    /*
     * Keep canonical fields available in both camelCase
     * and snake_case because the Employee UI is still
     * being migrated component-by-component.
     *
     * `status` remains a compatibility display field on
     * the active Employee page and mirrors canonical
     * workforce status when available.
     */
    status:
      workforceStatus ||
      employee?.status ||
      "",

    workforceStatus,
    workforce_status:
      workforceStatus,

    employmentStatus,
    employment_status:
      employmentStatus,

    dateHired,
    date_hired:
      dateHired,

    documents:
      parseEmployeeDocuments(
        employee.documents
      ),
  };
}

function isCanceledRequest(
  error
) {
  return (
    error?.code ===
      "ERR_CANCELED" ||
    error?.name ===
      "CanceledError" ||
    error?.name ===
      "AbortError"
  );
}

function normalizePagination(
  pagination = {},
  fallbackPage = 1
) {
  const page =
    Number.parseInt(
      String(
        pagination?.page ??
          fallbackPage
      ),
      10
    ) ||
    fallbackPage;
  const pageSize =
    Number.parseInt(
      String(
        pagination?.pageSize ??
          EMPLOYEE_PAGE_SIZE
      ),
      10
    ) ||
    EMPLOYEE_PAGE_SIZE;
  const total =
    Math.max(
      Number(
        pagination?.total ||
          0
      ),
      0
    );
  const activeTotal =
    Math.max(
      Number(
        pagination?.activeTotal ||
          0
      ),
      0
    );
  const totalPages =
    Number.parseInt(
      String(
        pagination?.totalPages ??
          ""
      ),
      10
    ) ||
    (
      total > 0
        ? Math.ceil(
            total /
              pageSize
          )
        : 0
    );
  return {
    page:
      Math.max(
        page,
        1
      ),
    pageSize:
      Math.max(
        pageSize,
        1
      ),
    total,
    totalPages:
      Math.max(
        totalPages,
        0
      ),
    activeTotal,
  };
}

function SelectFilter({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
  className = "",
}) {
  return (
    <div
      className={`min-w-0 ${className}`}
    >
      <label
        htmlFor={
          id
        }
        className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400"
      >
        {label}
      </label>
      <select
        id={
          id
        }
        value={
          value
        }
        disabled={
          disabled
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className={
          SELECT_CLASS_NAME
        }
      >
        {options.map(
          (
            option
          ) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          )
        )}
      </select>
    </div>
  );
}

function DeploymentSchedulingModal({
  employee,
  onClose,
  onWorkflowUpdated,
}) {
  const employeeId =
    getEmployeeId(
      employee
    );

  const employeeName =
    getEmployeeName(
      employee
    );

  const employeeCompany =
    getEmployeeCompany(
      employee
    );

  const employeePosition =
    getEmployeePosition(
      employee
    );

  const workforceStatus =
    String(
      employee?.workforceStatus ||
      employee?.workforce_status ||
      employee?.status ||
      ""
    ).trim();

  const isPendingSchedule =
    workforceStatus ===
    "For Deployment";

  const [
    scheduledDate,
    setScheduledDate,
  ] =
    useState(
      getPhilippinesTodayISO()
    );

  const [
    scheduledTime,
    setScheduledTime,
  ] =
    useState("");

  const [
    showScheduleRemarks,
    setShowScheduleRemarks,
  ] =
    useState(false);

  const [
    scheduleRemarks,
    setScheduleRemarks,
  ] =
    useState("");

  const [
    pendingAttempt,
    setPendingAttempt,
  ] =
    useState(null);

  const [
    showWithdrawForm,
    setShowWithdrawForm,
  ] =
    useState(false);

  const [
    withdrawReason,
    setWithdrawReason,
  ] =
    useState("");

  const [
    withdrawRemarks,
    setWithdrawRemarks,
  ] =
    useState("");

  const [
    isLoadingAttempt,
    setIsLoadingAttempt,
  ] =
    useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  const [
    modalError,
    setModalError,
  ] =
    useState("");

  const attemptAbortRef =
    useRef(null);

  const canSchedule =
    Boolean(
      employeeId &&
      employeeCompany &&
      employeePosition &&
      scheduledDate &&
      scheduledTime &&
      workforceStatus ===
        "Floating / Standby"
    );

  const loadPendingAttempt =
    useCallback(
      async () => {
        if (
          !employeeId ||
          !isPendingSchedule
        ) {
          setPendingAttempt(
            null
          );
          return;
        }

        attemptAbortRef
          .current
          ?.abort();

        const controller =
          new AbortController();

        attemptAbortRef.current =
          controller;

        try {
          setIsLoadingAttempt(
            true
          );

          setModalError(
            ""
          );

          const {
            data,
          } =
            await axios.get(
              DEPLOYMENT_ATTEMPT_API_URL,
              {
                timeout:
                  REQUEST_TIMEOUT_MS,
                signal:
                  controller.signal,
                headers:
                  getAuthenticatedHeaders(),
                params: {
                  status:
                    "For Deployment",
                  employeeId,
                  limit:
                    10,
                },
              }
            );

          if (
            controller.signal
              .aborted
          ) {
            return;
          }

          const attempts =
            Array.isArray(
              data?.data
            )
              ? data.data
              : [];

          const exactAttempt =
            attempts.find(
              (
                attempt
              ) =>
                String(
                  attempt
                    ?.employeeId ||
                  attempt
                    ?.employee_id ||
                  ""
                ) ===
                String(
                  employeeId
                )
            ) ||
            null;

          setPendingAttempt(
            exactAttempt
          );

          if (
            !exactAttempt
          ) {
            setModalError(
              "No pending deployment schedule was found for this employee. Refresh the Employee page and try again."
            );
          }
        } catch (
          error
        ) {
          if (
            isCanceledRequest(
              error
            )
          ) {
            return;
          }

          console.error(
            "Load employee deployment schedule error:",
            error
          );

          setModalError(
            getEmployeeApiError(
              error,
              "Unable to load this employee's deployment schedule."
            )
          );
        } finally {
          if (
            attemptAbortRef
              .current ===
            controller
          ) {
            attemptAbortRef.current =
              null;

            setIsLoadingAttempt(
              false
            );
          }
        }
      },
      [
        employeeId,
        isPendingSchedule,
      ]
    );

  useEffect(
    () => {
      setModalError(
        ""
      );

      setShowWithdrawForm(
        false
      );

      setWithdrawReason(
        ""
      );

      setWithdrawRemarks(
        ""
      );

      setScheduleRemarks(
        ""
      );

      setShowScheduleRemarks(
        false
      );

      setScheduledDate(
        getPhilippinesTodayISO()
      );

      setScheduledTime(
        ""
      );

      if (
        isPendingSchedule
      ) {
        void loadPendingAttempt();
      } else {
        setPendingAttempt(
          null
        );
      }

      return () => {
        attemptAbortRef
          .current
          ?.abort();
      };
    },
    [
      employeeId,
      isPendingSchedule,
      loadPendingAttempt,
    ]
  );

  const handleSchedule =
    useCallback(
      async () => {
        if (
          !canSchedule ||
          isSubmitting
        ) {
          return;
        }

        const today =
          getPhilippinesTodayISO();

        if (
          scheduledDate ===
            today &&
          scheduledTime <
            getPhilippinesCurrentTimeISO()
        ) {
          setModalError(
            "Expected arrival time cannot be earlier than the current Philippine time."
          );

          return;
        }

        try {
          setIsSubmitting(
            true
          );

          setModalError(
            ""
          );

          const {
            data,
          } =
            await axios.post(
              `${EMPLOYEE_API_URL}/${encodeURIComponent(
                employeeId
              )}/deployment-attempts`,
              {
                scheduledDate,
                scheduledTime,
                remarks:
                  scheduleRemarks.trim(),
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

          await onWorkflowUpdated?.({
            action:
              "SCHEDULE_DEPLOYMENT",
            message:
              data?.message ||
              `${employeeName} was scheduled for ${formatWorkflowDate(
                scheduledDate
              )} at ${formatWorkflowTime(
                scheduledTime
              )}.`,
          });

          onClose?.();
        } catch (
          error
        ) {
          console.error(
            "Schedule employee deployment error:",
            error
          );

          setModalError(
            getEmployeeApiError(
              error,
              "Failed to schedule the employee for deployment."
            )
          );
        } finally {
          setIsSubmitting(
            false
          );
        }
      },
      [
        canSchedule,
        employeeId,
        employeeName,
        isSubmitting,
        onClose,
        onWorkflowUpdated,
        scheduleRemarks,
        scheduledDate,
        scheduledTime,
      ]
    );

  const handleWithdraw =
    useCallback(
      async () => {
        const attemptId =
          pendingAttempt
            ?.attemptId ||
          pendingAttempt
            ?.id;

        if (
          !attemptId ||
          !withdrawReason.trim() ||
          isSubmitting
        ) {
          return;
        }

        try {
          setIsSubmitting(
            true
          );

          setModalError(
            ""
          );

          const {
            data,
          } =
            await axios.patch(
              `${DEPLOYMENT_ATTEMPT_API_URL}/${encodeURIComponent(
                attemptId
              )}/withdraw`,
              {
                reason:
                  withdrawReason.trim(),
                remarks:
                  withdrawRemarks.trim(),
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

          await onWorkflowUpdated?.({
            action:
              "WITHDRAW_DEPLOYMENT_ATTEMPT",
            message:
              data?.message ||
              `${employeeName}'s deployment schedule was withdrawn.`,
          });

          onClose?.();
        } catch (
          error
        ) {
          console.error(
            "Withdraw deployment schedule error:",
            error
          );

          setModalError(
            getEmployeeApiError(
              error,
              "Failed to withdraw the deployment schedule."
            )
          );
        } finally {
          setIsSubmitting(
            false
          );
        }
      },
      [
        employeeName,
        isSubmitting,
        onClose,
        onWorkflowUpdated,
        pendingAttempt,
        withdrawReason,
        withdrawRemarks,
      ]
    );

  if (!employee) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !isSubmitting
        ) {
          onClose?.();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-deployment-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <FiBriefcase
                aria-hidden="true"
              />
            </span>

            <div className="min-w-0">
              <h2
                id="employee-deployment-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                {isPendingSchedule
                  ? "Deployment Schedule"
                  : "Schedule for Deployment"}
              </h2>

              <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {isPendingSchedule
                  ? "Review the employee's expected arrival date and time at the client site."
                  : "Set the expected arrival date and time for this employee."}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close deployment modal"
            title="Close"
            disabled={
              isSubmitting
            }
            onClick={
              onClose
            }
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <FiXCircle
              size={20}
              aria-hidden="true"
            />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {modalError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
              {modalError}
            </div>
          )}

          {isPendingSchedule ? (
            isLoadingAttempt ? (
              <LoadingSkeleton
                rows={4}
                columns={2}
                showHeader
              />
            ) : pendingAttempt ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Employee
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {employeeName}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Workforce Status
                    </p>
                    <p className="mt-1 text-sm font-bold text-indigo-600 dark:text-indigo-300">
                      For Deployment
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Company
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={
                        pendingAttempt
                          ?.company ||
                        employeeCompany
                      }
                      className={`${SELECT_CLASS_NAME} cursor-default bg-slate-50 dark:bg-slate-900`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Position
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={
                        pendingAttempt
                          ?.position ||
                        employeePosition
                      }
                      className={`${SELECT_CLASS_NAME} cursor-default bg-slate-50 dark:bg-slate-900`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Expected Arrival Date
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={
                        formatWorkflowDate(
                          pendingAttempt
                            ?.scheduledDate
                        )
                      }
                      className={`${SELECT_CLASS_NAME} cursor-default bg-slate-50 dark:bg-slate-900`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Expected Arrival Time
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={
                        formatWorkflowTime(
                          pendingAttempt
                            ?.scheduledTime ??
                          pendingAttempt
                            ?.scheduled_time
                        )
                      }
                      className={`${SELECT_CLASS_NAME} cursor-default bg-slate-50 dark:bg-slate-900`}
                    />
                  </div>
                </div>

                {pendingAttempt
                  ?.remarks && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Remarks
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
                      {
                        pendingAttempt
                          .remarks
                      }
                    </p>
                  </div>
                )}

                {!showWithdrawForm ? (
                  <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
                    <Button
                      variant="secondary"
                      disabled={
                        isSubmitting
                      }
                      onClick={
                        onClose
                      }
                    >
                      Close
                    </Button>

                    <Button
                      variant="warning"
                      disabled={
                        isSubmitting
                      }
                      onClick={() =>
                        setShowWithdrawForm(
                          true
                        )
                      }
                    >
                      Withdraw Schedule
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <div>
                      <label
                        htmlFor="deployment-withdraw-reason"
                        className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Withdrawal Reason
                      </label>

                      <input
                        id="deployment-withdraw-reason"
                        type="text"
                        maxLength={100}
                        value={
                          withdrawReason
                        }
                        disabled={
                          isSubmitting
                        }
                        placeholder="Enter the reason for withdrawal"
                        onChange={(
                          event
                        ) =>
                          setWithdrawReason(
                            event.target
                              .value
                          )
                        }
                        className={
                          SELECT_CLASS_NAME
                        }
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="deployment-withdraw-remarks"
                        className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Remarks (Optional)
                      </label>

                      <textarea
                        id="deployment-withdraw-remarks"
                        rows={3}
                        maxLength={2000}
                        value={
                          withdrawRemarks
                        }
                        disabled={
                          isSubmitting
                        }
                        placeholder="Add optional details..."
                        onChange={(
                          event
                        ) =>
                          setWithdrawRemarks(
                            event.target
                              .value
                          )
                        }
                        className={`${SELECT_CLASS_NAME} min-h-[92px] resize-y`}
                      />
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="secondary"
                        disabled={
                          isSubmitting
                        }
                        onClick={() => {
                          setShowWithdrawForm(
                            false
                          );
                          setWithdrawReason(
                            ""
                          );
                          setWithdrawRemarks(
                            ""
                          );
                        }}
                      >
                        Cancel
                      </Button>

                      <Button
                        variant="warning"
                        loading={
                          isSubmitting
                        }
                        disabled={
                          !withdrawReason.trim() ||
                          isSubmitting
                        }
                        onClick={
                          handleWithdraw
                        }
                      >
                        Confirm Withdraw
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950/40">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Employee
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {employeeName}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Workforce Status
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Floating / Standby
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="deployment-company-display"
                    className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Company
                  </label>

                  <input
                    id="deployment-company-display"
                    type="text"
                    readOnly
                    value={
                      employeeCompany
                    }
                    placeholder="No client company assigned"
                    className={`${SELECT_CLASS_NAME} cursor-default bg-slate-50 dark:bg-slate-900`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="deployment-position-display"
                    className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Position
                  </label>

                  <input
                    id="deployment-position-display"
                    type="text"
                    readOnly
                    value={
                      employeePosition
                    }
                    placeholder="No designated position"
                    className={`${SELECT_CLASS_NAME} cursor-default bg-slate-50 dark:bg-slate-900`}
                  />
                </div>
              </div>

              {(
                !employeeCompany ||
                !employeePosition
              ) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                  Client Company and Position must be set on the employee record before deployment can be scheduled.
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="deployment-scheduled-date"
                    className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Expected Arrival Date
                  </label>

                  <div className="relative">
                    <FiCalendar
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="deployment-scheduled-date"
                      type="date"
                      min={
                        getPhilippinesTodayISO()
                      }
                      value={
                        scheduledDate
                      }
                      disabled={
                        isSubmitting
                      }
                      onChange={(
                        event
                      ) => {
                        setScheduledDate(
                          event.target
                            .value
                        );

                        if (
                          event.target
                            .value !==
                          getPhilippinesTodayISO()
                        ) {
                          setModalError(
                            ""
                          );
                        }
                      }}
                      className={`${SELECT_CLASS_NAME} pl-10`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="deployment-scheduled-time"
                    className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Expected Arrival Time
                  </label>

                  <div className="relative">
                    <FiClock
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="deployment-scheduled-time"
                      type="time"
                      min={
                        scheduledDate ===
                        getPhilippinesTodayISO()
                          ? getPhilippinesCurrentTimeISO()
                          : undefined
                      }
                      value={
                        scheduledTime
                      }
                      disabled={
                        isSubmitting
                      }
                      onChange={(
                        event
                      ) => {
                        setScheduledTime(
                          event.target
                            .value
                        );

                        setModalError(
                          ""
                        );
                      }}
                      className={`${SELECT_CLASS_NAME} pl-10`}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-xs leading-5 text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200">
                The assigned HR Coordinator will use this schedule to prepare for the employee's arrival at the client site.
              </div>

              <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/20">
                <button
                  type="button"
                  disabled={
                    isSubmitting
                  }
                  onClick={() => {
                    setShowScheduleRemarks(
                      (
                        currentValue
                      ) =>
                        !currentValue
                    );

                    if (
                      showScheduleRemarks
                    ) {
                      setScheduleRemarks(
                        ""
                      );
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800/50"
                >
                  <span>
                    Remarks (Optional)
                  </span>

                  <span
                    aria-hidden="true"
                    className="text-lg leading-none text-indigo-600 dark:text-indigo-300"
                  >
                    {showScheduleRemarks
                      ? "−"
                      : "+"}
                  </span>
                </button>

                {showScheduleRemarks && (
                  <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                    <textarea
                      id="deployment-schedule-remarks"
                      rows={3}
                      maxLength={2000}
                      value={
                        scheduleRemarks
                      }
                      disabled={
                        isSubmitting
                      }
                      placeholder="Add an optional note or instruction..."
                      onChange={(
                        event
                      ) =>
                        setScheduleRemarks(
                          event.target
                            .value
                        )
                      }
                      className={`${SELECT_CLASS_NAME} min-h-[92px] resize-y`}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
                <Button
                  variant="secondary"
                  disabled={
                    isSubmitting
                  }
                  onClick={
                    onClose
                  }
                >
                  Cancel
                </Button>

                <Button
                  leftIcon={
                    <FiSend
                      aria-hidden="true"
                    />
                  }
                  loading={
                    isSubmitting
                  }
                  disabled={
                    !canSchedule ||
                    isSubmitting
                  }
                  onClick={
                    handleSchedule
                  }
                >
                  Confirm Schedule
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Employees() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    user,
  } =
    useAuth();

  const normalizedRole =
    normalizeEmployeePageRole(
      user?.role
    );

  const isHRStaff =
    normalizedRole ===
    normalizeEmployeePageRole(
      ROLES.HR_STAFF
    );

  const isSuperAdmin =
    normalizedRole ===
    normalizeEmployeePageRole(
      ROLES.SUPER_ADMIN
    );

  const isHRManager =
    normalizedRole ===
    normalizeEmployeePageRole(
      ROLES.HR_MANAGER
    );

  const isHRCoordinator =
    normalizedRole ===
    normalizeEmployeePageRole(
      ROLES.HR_COORDINATOR
    );
  /*
   * ==================================================
   * EMPLOYEE PAGE ACCESS
   * ==================================================
   *
   * HR STAFF:
   * - operational employee encoder/maintainer
   * - add and edit employee records
   * - maintain employee compliance documents
   *
   * HR MANAGER:
   * - review employee records
   * - archive separated/inactive employee records
   * - no routine employee encoding or document mutation
   *
   * SUPER ADMIN:
   * - governance / view only on active Employee records
   *
   * HR COORDINATOR:
   * - view Deployed and For Deployment employees within
   *   the assigned-company backend scope
   * - view authorized employee/compliance information
   * - no employee encoding or archive authority
   *
   * Backend remains authoritative for role and company scope.
   */
  const canManageEmployeeRecords =
    isHRStaff;

  const canArchiveEmployeeRecords =
    isHRManager;

  const assignedCompany =
    String(
      user?.assignedCompany ??
        user?.assigned_company ??
        ""
    ).trim();
  const [
    employees,
    setEmployees,
  ] =
    useState([]);
  const [
    pagination,
    setPagination,
  ] =
    useState(
      () =>
        normalizePagination(
          {
            page:
              1,
            pageSize:
              EMPLOYEE_PAGE_SIZE,
          },
          1
        )
    );
  const [
    page,
    setPage,
  ] =
    useState(1);
  const [
    showEmployeeForm,
    setShowEmployeeForm,
  ] =
    useState(false);
  const [
    generatedId,
    setGeneratedId,
  ] =
    useState("");
  const [
    editingEmployee,
    setEditingEmployee,
  ] =
    useState(null);

  const [
    openComplianceOnEdit,
    setOpenComplianceOnEdit,
  ] =
    useState(false);

  const [
    editComplianceTarget,
    setEditComplianceTarget,
  ] =
    useState(null);

  const [
    viewComplianceTarget,
    setViewComplianceTarget,
  ] =
    useState(null);

  const [
    viewEmployee,
    setViewEmployee,
  ] =
    useState(null);
  const [
    archiveTarget,
    setArchiveTarget,
  ] =
    useState(null);
  const [
    search,
    setSearch,
  ] =
    useState("");
  const [
    debouncedSearch,
    setDebouncedSearch,
  ] =
    useState("");
  const [
    filterStatus,
    setFilterStatus,
  ] =
    useState("All");
  const [
    filterCompany,
    setFilterCompany,
  ] =
    useState("All");
  const [
    companyOptions,
    setCompanyOptions,
  ] =
    useState([]);
  const [
    filterCompliance,
    setFilterCompliance,
  ] =
    useState("All");
  const [
    filterPosition,
    setFilterPosition,
  ] =
    useState("All");
  const [
    knownPositions,
    setKnownPositions,
  ] =
    useState([]);
  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");
  const [
    pageError,
    setPageError,
  ] =
    useState("");
  const [
    isLoadingEmployees,
    setIsLoadingEmployees,
  ] =
    useState(true);
  const [
    isRefreshingEmployees,
    setIsRefreshingEmployees,
  ] =
    useState(false);
  const [
    isOpeningAddEmployee,
    setIsOpeningAddEmployee,
  ] =
    useState(false);
  const [
    deploymentActionEmployee,
    setDeploymentActionEmployee,
  ] =
    useState(null);
  const [
    isArchiving,
    setIsArchiving,
  ] =
    useState(false);
  const isMountedRef =
    useRef(true);
  const hasCompletedInitialLoadRef =
    useRef(false);
  const dataUpdateTimerRef =
    useRef(null);
  const searchDebounceTimerRef =
    useRef(null);
  const employeeListAbortRef =
    useRef(null);
  const employeeDetailAbortRef =
    useRef(null);
  const employeeFormMetaAbortRef =
    useRef(null);

  const mobileHandoffHandledRef =
    useRef(false);

  const smartAlertTargetHandledRef =
    useRef("");

  useEffect(
    () => {
      isMountedRef.current =
        true;
      return () => {
        isMountedRef.current =
          false;
        if (
          dataUpdateTimerRef.current
        ) {
          window.clearTimeout(
            dataUpdateTimerRef.current
          );
        }
        if (
          searchDebounceTimerRef.current
        ) {
          window.clearTimeout(
            searchDebounceTimerRef.current
          );
        }
        employeeListAbortRef
          .current
          ?.abort();
        employeeDetailAbortRef
          .current
          ?.abort();
        employeeFormMetaAbortRef
          .current
          ?.abort();
      };
    },
    []
  );
  useEffect(
    () => {
      if (
        searchDebounceTimerRef.current
      ) {
        window.clearTimeout(
          searchDebounceTimerRef.current
        );
      }
      searchDebounceTimerRef.current =
        window.setTimeout(
          () => {
            setDebouncedSearch(
              String(
                search || ""
              ).trim()
            );
            searchDebounceTimerRef.current =
              null;
          },
          SEARCH_DEBOUNCE_MS
        );
      return () => {
        if (
          searchDebounceTimerRef.current
        ) {
          window.clearTimeout(
            searchDebounceTimerRef.current
          );
          searchDebounceTimerRef.current =
            null;
        }
      };
    },
    [
      search,
    ]
  );
  const fetchEmployees =
    useCallback(
      async ({
        showLoading =
          false,
        showRefreshing =
          false,
        showError =
          true,
      } = {}) => {
        employeeListAbortRef
          .current
          ?.abort();
        const controller =
          new AbortController();
        employeeListAbortRef.current =
          controller;
        if (
          isMountedRef.current
        ) {
          if (
            showLoading
          ) {
            setIsLoadingEmployees(
              true
            );
          }
          if (
            showRefreshing
          ) {
            setIsRefreshingEmployees(
              true
            );
          }
          if (
            showError
          ) {
            setPageError(
              ""
            );
          }
        }
        try {
          const {
            data,
          } =
            await axios.get(
              EMPLOYEE_API_URL,
              {
                timeout:
                  REQUEST_TIMEOUT_MS,
                signal:
                  controller.signal,
                headers:
                  getAuthenticatedHeaders(),
                params: {
                  view:
                    "summary",
                  page,
                  pageSize:
                    EMPLOYEE_PAGE_SIZE,
                  /*
                   * HR Coordinator cannot override
                   * backend scope with this value.
                   *
                   * employeeController forces active
                   * company-scoped records for the
                   * coordinator role.
                   */
                  scope:
                    "active",
                  search:
                    isHRCoordinator &&
                    filterPosition !==
                      "All"
                      ? filterPosition
                      : debouncedSearch,
                  status:
                    filterStatus,
                  company:
                    isHRCoordinator
                      ? "All"
                      : filterCompany,
                  compliance:
                    filterCompliance,
                  ...(isHRCoordinator &&
                  filterPosition !==
                    "All"
                    ? {
                        position:
                          filterPosition,
                      }
                    : {}),
                },
              }
            );
          if (
            controller.signal
              .aborted ||
            !isMountedRef.current
          ) {
            return false;
          }
          const records =
            Array.isArray(
              data?.employees
            )
              ? data.employees
              : [];
          const nextPagination =
            normalizePagination(
              data?.pagination,
              page
            );

          if (
            !isHRCoordinator
          ) {
            const nextCompanies =
              Array.isArray(
                data?.filterMeta?.companies
              )
                ? data.filterMeta.companies
                    .map(
                      (company) =>
                        String(
                          company || ""
                        ).trim()
                    )
                    .filter(Boolean)
                : [];

            setCompanyOptions(
              nextCompanies
            );

            if (
              filterCompany !== "All" &&
              nextCompanies.length > 0 &&
              !nextCompanies.includes(
                filterCompany
              )
            ) {
              setFilterCompany(
                "All"
              );
            }
          }

          if (
            isHRCoordinator
          ) {
            const discoveredPositions =
              records
                .map(
                  getEmployeePosition
                )
                .filter(Boolean);
            if (
              discoveredPositions.length
            ) {
              setKnownPositions(
                (
                  currentPositions
                ) =>
                  [
                    ...new Set([
                      ...currentPositions,
                      ...discoveredPositions,
                    ]),
                  ].sort((a, b) =>
                    a.localeCompare(b)
                  )
              );
            }
          }
          setEmployees(
            records.map(
              normalizeEmployee
            )
          );
          setPagination(
            nextPagination
          );
          if (
            nextPagination
              .totalPages >
              0 &&
            page >
              nextPagination
                .totalPages
          ) {
            setPage(
              nextPagination
                .totalPages
            );
          }
          return true;
        } catch (
          error
        ) {
          if (
            isCanceledRequest(
              error
            )
          ) {
            return false;
          }
          console.error(
            "Fetch employees error:",
            error
          );
          if (
            showError &&
            isMountedRef.current
          ) {
            setPageError(
              getEmployeeApiError(
                error,
                "Unable to load employee records."
              )
            );
          }
          return false;
        } finally {
          if (
            employeeListAbortRef
              .current ===
            controller
          ) {
            employeeListAbortRef.current =
              null;
            if (
              isMountedRef.current
            ) {
              hasCompletedInitialLoadRef.current =
                true;
              if (
                showLoading
              ) {
                setIsLoadingEmployees(
                  false
                );
              }
              if (
                showRefreshing
              ) {
                setIsRefreshingEmployees(
                  false
                );
              }
            }
          }
        }
      },
      [
        debouncedSearch,
        filterCompany,
        filterCompliance,
        filterPosition,
        filterStatus,
        isHRCoordinator,
        page,
      ]
    );
  useEffect(
    () => {
      void fetchEmployees({
        showLoading:
          !hasCompletedInitialLoadRef.current,
      });
    },
    [
      fetchEmployees,
    ]
  );
  useEffect(
    () => {
      const scheduleEmployeeRefresh =
        () => {
          if (
            dataUpdateTimerRef.current
          ) {
            window.clearTimeout(
              dataUpdateTimerRef.current
            );
          }
          dataUpdateTimerRef.current =
            window.setTimeout(
              () => {
                void fetchEmployees({
                  showError:
                    false,
                });
                dataUpdateTimerRef.current =
                  null;
              },
              DATA_UPDATE_DEBOUNCE_MS
            );
        };
      const handleDataUpdated =
        (
          event
        ) => {
          if (
            shouldRefreshEmployees(
              event
            )
          ) {
            scheduleEmployeeRefresh();
          }
        };
      window.addEventListener(
        "dataUpdated",
        handleDataUpdated
      );
      return () => {
        if (
          dataUpdateTimerRef.current
        ) {
          window.clearTimeout(
            dataUpdateTimerRef.current
          );
          dataUpdateTimerRef.current =
            null;
        }
        window.removeEventListener(
          "dataUpdated",
          handleDataUpdated
        );
      };
    },
    [
      fetchEmployees,
    ]
  );
  const hasActiveFilters =
    useMemo(
      () =>
        Boolean(
          String(
            search || ""
          ).trim()
        ) ||
        filterStatus !==
          "All" ||
        filterCompliance !==
          "All" ||
        (
          !isHRCoordinator &&
          filterCompany !==
            "All"
        ) ||
        (
          isHRCoordinator &&
          filterPosition !==
            "All"
        ),
      [
        filterCompany,
        filterCompliance,
        filterPosition,
        filterStatus,
        isHRCoordinator,
        search,
      ]
    );

  const workforceStatusOptions =
    useMemo(
      () =>
        isHRCoordinator
          ? WORKFORCE_STATUS_OPTIONS.filter(
              ({ value }) =>
                value !==
                "Floating / Standby"
            )
          : WORKFORCE_STATUS_OPTIONS,
      [
        isHRCoordinator,
      ]
    );

  const companyFilterOptions =
    useMemo(
      () => [
        {
          value:
            "All",
          label:
            "All Companies",
        },
        ...companyOptions.map(
          (
            company
          ) => ({
            value:
              company,
            label:
              company,
          })
        ),
      ],
      [
        companyOptions,
      ]
    );

  const positionOptions =
    useMemo(
      () => [
        {
          value:
            "All",
          label:
            "All Positions",
        },
        ...knownPositions.map(
          (
            position
          ) => ({
            value:
              position,
            label:
              position,
          })
        ),
      ],
      [
        knownPositions,
      ]
    );
  const activeEmployeeCount =
    pagination.activeTotal;
  const matchingEmployeeCount =
    pagination.total;
  const totalPages =
    pagination.totalPages;
  const pageStart =
    matchingEmployeeCount >
    0
      ? (
          page -
          1
        ) *
          pagination.pageSize +
        1
      : 0;
  const pageEnd =
    matchingEmployeeCount >
    0
      ? Math.min(
          page *
            pagination.pageSize,
          matchingEmployeeCount
        )
      : 0;
  const handleSearchChange =
    useCallback(
      (
        event
      ) => {
        const nextSearch =
          event.target.value;
        setSearch(
          nextSearch
        );
        if (
          isHRCoordinator &&
          nextSearch.trim()
        ) {
          setFilterPosition(
            "All"
          );
        }
        setPage(
          1
        );
      },
      [
        isHRCoordinator,
      ]
    );
  const handleClearSearch =
    useCallback(
      () => {
        if (
          searchDebounceTimerRef.current
        ) {
          window.clearTimeout(
            searchDebounceTimerRef.current
          );
          searchDebounceTimerRef.current =
            null;
        }
        setSearch(
          ""
        );
        setDebouncedSearch(
          ""
        );
        setPage(
          1
        );
      },
      []
    );
  const handleStatusChange =
    useCallback(
      (
        value
      ) => {
        setFilterStatus(
          value
        );
        setPage(
          1
        );
      },
      []
    );
  const handlePositionChange =
    useCallback(
      (
        value
      ) => {
        if (
          searchDebounceTimerRef.current
        ) {
          window.clearTimeout(
            searchDebounceTimerRef.current
          );
          searchDebounceTimerRef.current =
            null;
        }
        setFilterPosition(
          value
        );
        setSearch(
          ""
        );
        setDebouncedSearch(
          ""
        );
        setPage(
          1
        );
      },
      []
    );
  const handleCompanyChange =
    useCallback(
      (
        value
      ) => {
        setFilterCompany(
          value
        );
        setPage(
          1
        );
      },
      []
    );

  const handleComplianceChange =
    useCallback(
      (
        value
      ) => {
        setFilterCompliance(
          value
        );
        setPage(
          1
        );
      },
      []
    );
  const handleResetFilters =
    useCallback(
      () => {
        if (
          searchDebounceTimerRef.current
        ) {
          window.clearTimeout(
            searchDebounceTimerRef.current
          );
          searchDebounceTimerRef.current =
            null;
        }
        setSearch(
          ""
        );
        setDebouncedSearch(
          ""
        );
        setFilterStatus(
          "All"
        );
        setFilterCompany(
          "All"
        );
        setFilterCompliance(
          "All"
        );
        setFilterPosition(
          "All"
        );
        setPage(
          1
        );
      },
      []
    );
  const handleRefresh =
    useCallback(
      async () => {
        if (
          isRefreshingEmployees
        ) {
          return;
        }
        await fetchEmployees({
          showRefreshing:
            true,
        });
      },
      [
        fetchEmployees,
        isRefreshingEmployees,
      ]
    );
  const handleDeploymentWorkflowUpdated =
    useCallback(
      async ({
        action,
        message,
      }) => {
        setSuccessMessage(
          message ||
          "Deployment workflow updated successfully."
        );

        emitDataUpdated(
          action ||
          "DEPLOYMENT_WORKFLOW_UPDATED"
        );

        await fetchEmployees({
          showError:
            false,
        });
      },
      [
        fetchEmployees,
      ]
    );

  const fetchEmployeeById =
    useCallback(
      async (
        employee
      ) => {
        const employeeId =
          getEmployeeId(
            employee
          );
        if (
          !employeeId
        ) {
          return null;
        }
        employeeDetailAbortRef
          .current
          ?.abort();
        const controller =
          new AbortController();
        employeeDetailAbortRef.current =
          controller;
        try {
          setPageError(
            ""
          );
          const {
            data,
          } =
            await axios.get(
              `${EMPLOYEE_API_URL}/${encodeURIComponent(
                employeeId
              )}`,
              {
                timeout:
                  REQUEST_TIMEOUT_MS,
                signal:
                  controller.signal,
                headers:
                  getAuthenticatedHeaders(),
              }
            );
          if (
            controller.signal
              .aborted ||
            !isMountedRef.current
          ) {
            return null;
          }
          return normalizeEmployee(
            data
          );
        } catch (
          error
        ) {
          if (
            isCanceledRequest(
              error
            )
          ) {
            return null;
          }
          console.error(
            "Fetch employee detail error:",
            error
          );
          if (
            isMountedRef.current
          ) {
            setPageError(
              getEmployeeApiError(
                error,
                "Unable to load the employee record."
              )
            );
          }
          return null;
        } finally {
          if (
            employeeDetailAbortRef
              .current ===
            controller
          ) {
            employeeDetailAbortRef.current =
              null;
          }
        }
      },
      []
    );

  /*
   * ==================================================
   * SMART ALERT EMPLOYEE DEEP LINK
   * ==================================================
   *
   * Compliance Smart Alerts navigate to Employees with
   * an employee-specific target in router state.
   *
   * HR Staff:
   * - opens Edit Employee
   * - opens the Compliance section
   *
   * HR Manager / Super Admin:
   * - opens the exact employee in the view-only modal
   * - opens the Compliance accordion
   * - passes the exact document target for highlighting
   *
   * The one-time router state is cleared after the
   * employee record is opened so browser Back/Forward
   * navigation does not unexpectedly reopen the modal.
   */
  useEffect(
    () => {
      const alertTarget =
        normalizeSmartAlertEmployeeTarget(
          location.state
            ?.smartAlertEmployeeTarget
        );

      if (!alertTarget) {
        smartAlertTargetHandledRef.current =
          "";
        return;
      }

      const targetSignature =
        alertTarget.alertKey ||
        [
          alertTarget.employeeId,
          alertTarget.documentId ||
            "",
          alertTarget.documentName ||
            "",
        ].join(":");

      if (
        smartAlertTargetHandledRef.current ===
        targetSignature
      ) {
        return;
      }

      smartAlertTargetHandledRef.current =
        targetSignature;

      if (
        !isHRStaff &&
        !isHRManager &&
        !isSuperAdmin
      ) {
        navigate(
          "/employees",
          {
            replace:
              true,
            state:
              null,
          }
        );

        return;
      }

      let isActive =
        true;

      const openSmartAlertEmployeeTarget =
        async () => {
          setPageError(
            ""
          );

          const fullEmployee =
            await fetchEmployeeById({
              id:
                alertTarget
                  .employeeId,
            });

          if (
            !isActive ||
            !isMountedRef.current
          ) {
            return;
          }

          if (!fullEmployee) {
            smartAlertTargetHandledRef.current =
              "";
            return;
          }

          setDeploymentActionEmployee(
            null
          );

          if (isHRStaff) {
            setViewEmployee(
              null
            );

            setViewComplianceTarget(
              null
            );

            setEditingEmployee(
              fullEmployee
            );

            setGeneratedId(
              getEmployeeId(
                fullEmployee
              )
            );

            setOpenComplianceOnEdit(
              true
            );

            setEditComplianceTarget({
              documentId:
                alertTarget
                  .documentId,

              documentName:
                alertTarget
                  .documentName,
            });

            setShowEmployeeForm(
              true
            );
          } else {
            setShowEmployeeForm(
              false
            );

            setEditingEmployee(
              null
            );

            setGeneratedId(
              ""
            );

            setOpenComplianceOnEdit(
              false
            );

            setEditComplianceTarget(
              null
            );

            setViewComplianceTarget({
              openCompliance:
                true,

              documentId:
                alertTarget
                  .documentId,

              documentName:
                alertTarget
                  .documentName,
            });

            setViewEmployee(
              fullEmployee
            );
          }

          navigate(
            "/employees",
            {
              replace:
                true,
              state:
                null,
            }
          );
        };

      void openSmartAlertEmployeeTarget();

      return () => {
        isActive =
          false;
      };
    },
    [
      fetchEmployeeById,
      isHRManager,
      isHRStaff,
      isSuperAdmin,
      location.state,
      navigate,
    ]
  );

  useEffect(
    () => {
      if (
        mobileHandoffHandledRef.current
      ) {
        return;
      }

      const stateTarget =
        normalizeMobileHandoffTarget(
          location.state
            ?.mobileDocumentHandoff
        );

      const sessionTarget =
        readMobileHandoffSession();

      const handoffTarget =
        stateTarget ||
        sessionTarget;

      if (!handoffTarget) {
        if (
          !isHRStaff
        ) {
          clearMobileHandoffSession();
        }

        return;
      }

      /*
       * The mobile handoff route is already HR Staff
       * only, but keep this check here as defense in
       * depth in case stale sessionStorage survives an
       * account switch in the same browser.
       */
      if (!isHRStaff) {
        clearMobileHandoffSession();
        mobileHandoffHandledRef.current =
          true;
        return;
      }

      mobileHandoffHandledRef.current =
        true;

      let isActive =
        true;

      const openMobileDocumentCapture =
        async () => {
          setPageError(
            ""
          );

          const fullEmployee =
            await fetchEmployeeById({
              id:
                handoffTarget
                  .employeeId,
            });

          if (
            !isActive ||
            !isMountedRef.current
          ) {
            return;
          }

          if (!fullEmployee) {
            /*
             * Keep the session fallback when the
             * detail request fails so a browser
             * refresh can retry the already-resolved
             * handoff target without reusing the QR.
             */
            mobileHandoffHandledRef.current =
              false;
            return;
          }

          setViewEmployee(
            null
          );

          setViewComplianceTarget(
            null
          );

          setEditingEmployee(
            fullEmployee
          );

          setGeneratedId(
            getEmployeeId(
              fullEmployee
            )
          );

          setOpenComplianceOnEdit(
            true
          );

          setEditComplianceTarget(
            null
          );

          setShowEmployeeForm(
            true
          );

          clearMobileHandoffSession();

          /*
           * Remove the one-time navigation state after
           * the target employee has been opened. This
           * prevents accidental re-opening when the
           * user later navigates back to Employees.
           */
          navigate(
            "/employees",
            {
              replace:
                true,
              state:
                null,
            }
          );
        };

      void openMobileDocumentCapture();

      return () => {
        isActive =
          false;
      };
    },
    [
      fetchEmployeeById,
      isHRStaff,
      location.state,
      navigate,
    ]
  );

  const handleOpenAddEmployee =
    useCallback(
      async () => {
        if (
          !canManageEmployeeRecords ||
          isOpeningAddEmployee
        ) {
          return;
        }
        employeeFormMetaAbortRef
          .current
          ?.abort();
        const controller =
          new AbortController();
        employeeFormMetaAbortRef.current =
          controller;
        try {
          setIsOpeningAddEmployee(
            true
          );
          setPageError(
            ""
          );
          const {
            data,
          } =
            await axios.get(
              `${EMPLOYEE_API_URL}/form-meta`,
              {
                timeout:
                  REQUEST_TIMEOUT_MS,
                signal:
                  controller.signal,
                headers:
                  getAuthenticatedHeaders(),
              }
            );
          if (
            controller.signal
              .aborted ||
            !isMountedRef.current
          ) {
            return;
          }
          const previewId =
            String(
              data?.employeeIdPreview ||
                ""
            ).trim();
          if (
            !previewId
          ) {
            throw new Error(
              "Employee ID preview is unavailable."
            );
          }
          setGeneratedId(
            previewId
          );
          setEditingEmployee(
            null
          );

          setEditComplianceTarget(
            null
          );

          setShowEmployeeForm(
            true
          );
        } catch (
          error
        ) {
          if (
            isCanceledRequest(
              error
            )
          ) {
            return;
          }
          console.error(
            "Prepare employee form error:",
            error
          );
          if (
            isMountedRef.current
          ) {
            setPageError(
              getEmployeeApiError(
                error,
                "Unable to prepare the employee form."
              )
            );
          }
        } finally {
          if (
            employeeFormMetaAbortRef
              .current ===
            controller
          ) {
            employeeFormMetaAbortRef.current =
              null;
            if (
              isMountedRef.current
            ) {
              setIsOpeningAddEmployee(
                false
              );
            }
          }
        }
      },
      [
        canManageEmployeeRecords,
        isOpeningAddEmployee,
      ]
    );
  const handleCloseEmployeeForm =
    useCallback(
      () => {
        setShowEmployeeForm(
          false
        );

        setEditingEmployee(
          null
        );

        setOpenComplianceOnEdit(
          false
        );

        setEditComplianceTarget(
          null
        );

        setGeneratedId(
          ""
        );
      },
      []
    );
  const handleViewEmployee =
    useCallback(
      async (
        employee
      ) => {
        if (
          !employee
        ) {
          return;
        }

        setViewComplianceTarget(
          null
        );

        const fullEmployee =
          await fetchEmployeeById(
            employee
          );
        if (
          fullEmployee &&
          isMountedRef.current
        ) {
          setViewEmployee(
            fullEmployee
          );
        }
      },
      [
        fetchEmployeeById,
      ]
    );
  const handleEditEmployee =
    useCallback(
      async (
        employee
      ) => {
        if (
          !canManageEmployeeRecords ||
          !employee
        ) {
          return;
        }

        setViewEmployee(
          null
        );

        setViewComplianceTarget(
          null
        );

        const fullEmployee =
          await fetchEmployeeById(
            employee
          );
        if (
          !fullEmployee ||
          !isMountedRef.current
        ) {
          return;
        }
        setOpenComplianceOnEdit(
          false
        );

        setEditComplianceTarget(
          null
        );

        setEditingEmployee(
          fullEmployee
        );

        setGeneratedId(
          getEmployeeId(
            fullEmployee
          )
        );

        setShowEmployeeForm(
          true
        );
      },
      [
        canManageEmployeeRecords,
        fetchEmployeeById,
      ]
    );
  const handleDeploymentAction =
    useCallback(
      (
        employee
      ) => {
        if (
          !isHRStaff ||
          !employee
        ) {
          return;
        }

        const workforceStatus =
          String(
            employee
              ?.workforceStatus ||
            employee
              ?.workforce_status ||
            employee
              ?.status ||
            ""
          ).trim();

        if (
          ![
            "Floating / Standby",
            "For Deployment",
          ].includes(
            workforceStatus
          )
        ) {
          return;
        }

        setPageError(
          ""
        );

        setDeploymentActionEmployee(
          employee
        );
      },
      [
        isHRStaff,
      ]
    );

  const handleOpenArchiveDialog =
    useCallback(
      (
        employee
      ) => {
        if (
          !canArchiveEmployeeRecords ||
          !employee ||
          isArchiving
        ) {
          return;
        }
        setArchiveTarget(
          employee
        );
        setPageError(
          ""
        );
      },
      [
        canArchiveEmployeeRecords,
        isArchiving,
      ]
    );
  const handleCloseArchiveDialog =
    useCallback(
      () => {
        if (
          !isArchiving
        ) {
          setArchiveTarget(
            null
          );
        }
      },
      [
        isArchiving,
      ]
    );
  const handleConfirmArchive =
    useCallback(
      async () => {
        const employeeId =
          getEmployeeId(
            archiveTarget
          );
        if (
          !employeeId ||
          isArchiving ||
          !canArchiveEmployeeRecords
        ) {
          return;
        }
        const employeeName =
          getEmployeeName(
            archiveTarget
          );
        try {
          setIsArchiving(
            true
          );
          setPageError(
            ""
          );
          await axios.put(
            `${EMPLOYEE_API_URL}/archive/${encodeURIComponent(
              employeeId
            )}`,
            {},
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
          setEmployees(
            (
              currentEmployees
            ) =>
              currentEmployees.filter(
                (
                  employee
                ) =>
                  getEmployeeId(
                    employee
                  ) !==
                  employeeId
              )
          );
          setArchiveTarget(
            null
          );
          setSuccessMessage(
            `${employeeName} was archived successfully.`
          );
          emitDataUpdated(
            "ARCHIVE_EMPLOYEE"
          );
          await fetchEmployees({
            showError:
              false,
          });
        } catch (
          error
        ) {
          console.error(
            "Archive employee error:",
            error
          );
          setPageError(
            getEmployeeApiError(
              error,
              "Failed to archive the employee record."
            )
          );
        } finally {
          if (
            isMountedRef.current
          ) {
            setIsArchiving(
              false
            );
          }
        }
      },
      [
        archiveTarget,
        fetchEmployees,
        canArchiveEmployeeRecords,
        isArchiving,
      ]
    );
  const handleSaveSuccess =
    useCallback(
      async (
        employeeName,
        mode
      ) => {
        /*
         * Add/Edit modals cannot be mounted for
         * read-only roles. Keep this guard as
         * defense in depth.
         */
        if (
          !canManageEmployeeRecords
        ) {
          handleCloseEmployeeForm();
          return;
        }
        const safeEmployeeName =
          employeeName ||
          "the employee";
        const isEditMode =
          mode === "edit";
        handleCloseEmployeeForm();
        setSuccessMessage(
          isEditMode
            ? `${safeEmployeeName}'s information was updated successfully.`
            : `${safeEmployeeName} was saved successfully.`
        );
        emitDataUpdated(
          isEditMode
            ? "EDIT_EMPLOYEE"
            : "ADD_EMPLOYEE"
        );
        if (
          !isEditMode &&
          page !==
            1
        ) {
          setPage(
            1
          );
          return;
        }
        await fetchEmployees({
          showError:
            false,
        });
      },
      [
        fetchEmployees,
        canManageEmployeeRecords,
        handleCloseEmployeeForm,
        page,
      ]
    );
  const employeeDescription =
    isHRCoordinator
      ? assignedCompany
        ? `Review Deployed and For Deployment employees within ${assignedCompany}, including position and compliance status.`
        : "Review Deployed and For Deployment employees within your assigned client company."
      : isSuperAdmin
        ? "Review employee records, workforce status, deployment details, and compliance status. Super Admin access is view-only."
        : isHRManager
          ? "Review employee records and archive separated or inactive employees. Employee record updates remain with HR Staff."
          : "Manage employee records, hiring dates, workforce status, compliance documents, and deployment actions.";
  const archiveEmployeeId =
    getEmployeeId(
      archiveTarget
    );
  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-7">
      <PageHeader
        eyebrow="Workforce Management"
        title="Employee Management"
        description={
          employeeDescription
        }
        icon={
          <FiUsers
            size={22}
            aria-hidden="true"
          />
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={
                <FiRotateCcw
                  aria-hidden="true"
                />
              }
              loading={
                isRefreshingEmployees
              }
              disabled={
                isLoadingEmployees ||
                isRefreshingEmployees
              }
              onClick={
                handleRefresh
              }
            >
              Refresh
            </Button>
            {isHRManager && (
              <Button
                variant="secondary"
                leftIcon={
                  <FiArchive
                    aria-hidden="true"
                  />
                }
                disabled={
                  isArchiving
                }
                onClick={() =>
                  navigate(
                    "/employees/archive"
                  )
                }
              >
                Archived Employees
              </Button>
            )}
            {canManageEmployeeRecords && (
              <RoleGuard
                permission={
                  PERMISSIONS.CAN_ADD_EMPLOYEE
                }
              >
                <Button
                  leftIcon={
                    <FiPlus
                      aria-hidden="true"
                    />
                  }
                  loading={
                    isOpeningAddEmployee
                  }
                  disabled={
                    isLoadingEmployees ||
                    isArchiving ||
                    isOpeningAddEmployee
                  }
                  onClick={
                    handleOpenAddEmployee
                  }
                >
                  Add Employee
                </Button>
              </RoleGuard>
            )}
          </>
        }
      />
      {isHRCoordinator && (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                <FiBriefcase
                  size={17}
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Assigned Client Company
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                  {assignedCompany || "Assigned Client Company"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Showing Deployed and For Deployment employees within your assigned client company.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <FiShield
                aria-hidden="true"
              />
              View only
              <span aria-hidden="true">•</span>
              {activeEmployeeCount} active{" "}
              {activeEmployeeCount === 1
                ? "employee"
                : "employees"}
            </div>
          </div>
        </section>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-4">
            <SearchInput
              label="Search Employees"
              placeholder={
                isHRCoordinator
                  ? "Search by name or employee ID..."
                  : "Search by name, employee ID, or client company..."
              }
              value={search}
              disabled={isLoadingEmployees}
              onChange={handleSearchChange}
              onClear={handleClearSearch}
            />
          </div>

          {!isHRCoordinator && (
            <SelectFilter
              id="employee-company-filter"
              label="Client Company"
              value={filterCompany}
              options={companyFilterOptions}
              disabled={isLoadingEmployees}
              onChange={handleCompanyChange}
              className="min-w-0 xl:col-span-3"
            />
          )}

          {isHRCoordinator && (
            <SelectFilter
              id="employee-position-filter"
              label="Position"
              value={filterPosition}
              options={positionOptions}
              disabled={isLoadingEmployees}
              onChange={handlePositionChange}
              className="min-w-0 xl:col-span-3"
            />
          )}

          <SelectFilter
            id="employee-status-filter"
            label="Workforce Status"
            value={filterStatus}
            options={workforceStatusOptions}
            disabled={isLoadingEmployees}
            onChange={handleStatusChange}
            className="min-w-0 xl:col-span-2"
          />

          <SelectFilter
            id="employee-compliance-filter"
            label="Compliance Status"
            value={filterCompliance}
            options={COMPLIANCE_OPTIONS}
            disabled={isLoadingEmployees}
            onChange={handleComplianceChange}
            className="min-w-0 xl:col-span-3"
          />
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {matchingEmployeeCount}
            </span>
            <span>
              {matchingEmployeeCount === 1 ? "employee" : "employees"} shown
            </span>
            {debouncedSearch && debouncedSearch !== search.trim() && (
              <>
                <span aria-hidden="true">•</span>
                <span>Updating results...</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={
              !hasActiveFilters ||
              isLoadingEmployees
            }
            onClick={handleResetFilters}
          >
            Clear Filters
          </Button>
        </div>
      </section>
      {pageError && (
        <ErrorState
          compact
          title="Unable to Load Employees"
          message={
            pageError
          }
          retryLabel="Try Again"
          onRetry={
            handleRefresh
          }
        />
      )}
      {isLoadingEmployees ? (
        <LoadingSkeleton
          rows={6}
          columns={6}
          showHeader
        />
      ) : (
        <>
          <EmployeeTable
            employees={
              employees
            }
            totalRecords={
              matchingEmployeeCount
            }
            searchQuery={
              search
            }
            hasFilters={
              filterStatus !==
                "All" ||
              filterCompliance !==
                "All" ||
              (
                !isHRCoordinator &&
                filterCompany !==
                  "All"
              ) ||
              (
                isHRCoordinator &&
                filterPosition !==
                  "All"
              )
            }
            onClearSearch={
              handleClearSearch
            }
            onClearFilters={
              handleResetFilters
            }
            openModal={
              handleViewEmployee
            }
            onEdit={
              canManageEmployeeRecords
                ? handleEditEmployee
                : undefined
            }
            onDeploymentAction={
              isHRStaff
                ? handleDeploymentAction
                : undefined
            }
            getComplianceStatus={
              getComplianceStatus
            }
            onArchive={
              canArchiveEmployeeRecords
                ? handleOpenArchiveDialog
                : undefined
            }
            isHRManager={
              isHRManager
            }
            isSuperAdmin={
              isSuperAdmin
            }
            isHRCoordinator={
              isHRCoordinator
            }
          />
          {totalPages >
            1 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Showing{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {
                    pageStart
                  }
                </span>
                {" - "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {
                    pageEnd
                  }
                </span>
                {" of "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {
                    matchingEmployeeCount
                  }
                </span>{" "}
                employees
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    page <=
                    1
                  }
                  onClick={() =>
                    setPage(
                      (
                        currentPage
                      ) =>
                        Math.max(
                          currentPage -
                            1,
                          1
                        )
                    )
                  }
                >
                  Previous
                </Button>
                <span className="min-w-24 text-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Page{" "}
                  {
                    page
                  }{" "}
                  of{" "}
                  {
                    totalPages
                  }
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    page >=
                    totalPages
                  }
                  onClick={() =>
                    setPage(
                      (
                        currentPage
                      ) =>
                        Math.min(
                          currentPage +
                            1,
                          totalPages
                        )
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          {matchingEmployeeCount >
            0 &&
            totalPages <=
              1 && (
            <p className="px-1 text-sm text-gray-500 dark:text-gray-400">
              Showing{" "}
              {
                matchingEmployeeCount
              }{" "}
              of{" "}
              {
                activeEmployeeCount
              }{" "}
              active employees.
            </p>
          )}
        </>
      )}
      {isHRStaff &&
        deploymentActionEmployee && (
        <DeploymentSchedulingModal
          employee={
            deploymentActionEmployee
          }
          onClose={() =>
            setDeploymentActionEmployee(
              null
            )
          }
          onWorkflowUpdated={
            handleDeploymentWorkflowUpdated
          }
        />
      )}
      {canManageEmployeeRecords &&
        showEmployeeForm &&
        !editingEmployee && (
        <AddEmployeeModal
          generatedId={
            generatedId
          }
          employees={
            employees
          }
          onClose={
            handleCloseEmployeeForm
          }
          onSaveSuccess={(
            employeeName
          ) =>
            handleSaveSuccess(
              employeeName,
              "add"
            )
          }
        />
      )}
      {canManageEmployeeRecords &&
        showEmployeeForm &&
        editingEmployee && (
        <EditEmployeeModal
          employeeToEdit={
            editingEmployee
          }
          employees={
            employees
          }
          initialOpenCompliance={
            openComplianceOnEdit
          }
          initialComplianceDocumentId={
            editComplianceTarget
              ?.documentId ||
            ""
          }
          initialComplianceDocumentName={
            editComplianceTarget
              ?.documentName ||
            ""
          }
          onClose={
            handleCloseEmployeeForm
          }
          onSaveSuccess={(
            employeeName
          ) =>
            handleSaveSuccess(
              employeeName,
              "edit"
            )
          }
        />
      )}
      {viewEmployee && (
        <EmployeeModal
          employee={
            viewEmployee
          }
          initialOpenCompliance={
            Boolean(
              viewComplianceTarget
                ?.openCompliance
            )
          }
          initialComplianceDocumentId={
            viewComplianceTarget
              ?.documentId ||
            ""
          }
          initialComplianceDocumentName={
            viewComplianceTarget
              ?.documentName ||
            ""
          }
          onClose={() => {
            setViewEmployee(
              null
            );

            setViewComplianceTarget(
              null
            );
          }}
        />
      )}
      <ConfirmDialog
        open={
          Boolean(
            archiveTarget
          ) &&
          canArchiveEmployeeRecords
        }
        title="Archive Employee"
        tone="warning"
        confirmLabel="Archive Employee"
        cancelLabel="Cancel"
        loading={
          isArchiving
        }
        disabled={
          !archiveEmployeeId
        }
        closeOnBackdrop={
          !isArchiving
        }
        onClose={
          handleCloseArchiveDialog
        }
        onConfirm={
          handleConfirmArchive
        }
      >
        <p>
          Are you sure you want
          to archive{" "}
          <strong className="font-bold text-gray-900 dark:text-white">
            {
              getEmployeeName(
                archiveTarget
              )
            }
          </strong>
          ?
        </p>
        <p className="mt-2">
          The employee will be
          marked as{" "}
          <strong className="font-bold">
            Inactive
          </strong>{" "}
          and removed from the
          active employee
          list. The
          historical record will
          remain available in
          Archived Employees.
        </p>
      </ConfirmDialog>
      {successMessage && (
        <SuccessToast
          title="Update Completed"
          message={
            successMessage
          }
          duration={
            3500
          }
          onClose={() =>
            setSuccessMessage(
              ""
            )
          }
        />
      )}
    </main>
  );
}