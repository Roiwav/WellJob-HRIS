import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiActivity,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";
import axios from "axios";
import { useAuth } from "../context/useAuth";
import { API_BASE } from "../config/api";
import { ROLES } from "../constants/roles";
import DeploymentTable from "../components/deployments/table/DeploymentTable";
import DeploymentModal from "../components/deployments/modals/DeploymentModal";
import DeploymentToast from "../components/deployments/shared/DeploymentToast";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import {
  buildDeploymentStatusPayload,
  getMonthOptions,
  normalizeDeploymentStatus,
  normalizeSeparationReason,
} from "../utils/deployments/deploymentHelpers";
const DEPLOYMENT_API_URL =
  `${API_BASE}/deployments`;
const DEPLOYMENT_ATTEMPT_API_URL =
  `${API_BASE}/deployment-attempts`;
const DEPLOYMENT_MOVEMENT_REPORT_API_URL =
  `${API_BASE}/deployment-movements/report`;
const DEPLOYMENT_VIEW = Object.freeze({
  RECORDS: "records",
  MOVEMENT: "movement",
});
const DATA_EVENT_SOURCE =
  "deployments-page";
const REQUEST_TIMEOUT_MS =
  15000;
const DATA_UPDATE_DEBOUNCE_MS =
  300;
const SEARCH_DEBOUNCE_MS =
  350;
const DEPLOYMENT_PAGE_SIZE =
  50;
const DEPLOYMENT_STATUS_OPTIONS = [
  {
    label:
      "All Statuses",
    value:
      "",
  },
  {
    label:
      "Deployed",
    value:
      "Deployed",
  },
  {
    label:
      "Resigned",
    value:
      "Resigned",
  },
  {
    label:
      "Terminated",
    value:
      "Terminated",
  },
  {
    label:
      "AWOL",
    value:
      "AWOL",
  },
  {
    label:
      "Other Separation",
    value:
      "Ended",
  },
];
const DEPLOYMENT_REFRESH_DOMAINS =
  new Set([
    "deployment",
    "deployments",
    "employee",
    "employees",
  ]);
const SELECT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5",
  "text-sm font-semibold text-gray-900 shadow-sm outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");
/*
 * ==================================================
 * DEPLOYMENT PAGE AUTH HEADERS
 * ==================================================
 *
 * Login stores the authenticated JWT in:
 *
 * localStorage["token"]
 *
 * Axios requests may already receive the token from
 * the global Axios interceptor, but this page also
 * uses native fetch() through requestJson().
 *
 * Native fetch does NOT use Axios interceptors, so
 * Authorization must be attached explicitly here.
 */
function getAuthenticatedHeaders(
  additionalHeaders = {}
) {
  const token =
    String(
      localStorage.getItem(
        "token"
      ) || ""
    ).trim();
  let normalizedHeaders =
    {};
  /*
   * Support either a plain object or a Headers
   * instance without losing existing request headers.
   */
  if (
    typeof Headers !==
      "undefined" &&
    additionalHeaders instanceof
      Headers
  ) {
    normalizedHeaders =
      Object.fromEntries(
        additionalHeaders.entries()
      );
  } else if (
    additionalHeaders &&
    typeof additionalHeaders ===
      "object"
  ) {
    normalizedHeaders = {
      ...additionalHeaders,
    };
  }
  return {
    Accept:
      "application/json",
    ...normalizedHeaders,
    ...(token
      ? {
          Authorization:
            `Bearer ${token}`,
        }
      : {}),
  };
}
function emitDataUpdated(
  action = "DEPLOYMENTS_UPDATED"
) {
  window.dispatchEvent(
    new CustomEvent(
      "dataUpdated",
      {
        detail: {
          source:
            DATA_EVENT_SOURCE,
          domain:
            "deployments",
          action,
          at:
            Date.now(),
        },
      }
    )
  );
}
/*
 * ==================================================
 * AUTHENTICATED FETCH WRAPPER
 * ==================================================
 *
 * Important:
 * fetch() does not receive Axios interceptors.
 *
 * Every deployment GET request therefore receives
 * the JWT explicitly through getAuthenticatedHeaders.
 */
async function requestJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();
  const timeoutId =
    window.setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS
    );
  try {
    const response =
      await fetch(
        url,
        {
          ...options,
          headers:
            getAuthenticatedHeaders(
              options.headers ||
                {}
            ),
          signal:
            controller.signal,
        }
      );
    const data =
      await response
        .json()
        .catch(
          () => null
        );
    if (!response.ok) {
      if (
        response.status ===
        401
      ) {
        throw new Error(
          "Your sign-in session has expired. Please sign in again."
        );
      }
      if (
        response.status ===
        403
      ) {
        throw new Error(
          data?.error ||
            data?.message ||
            "You do not have permission to view deployment records."
        );
      }
      if (
        response.status ===
        503
      ) {
        throw new Error(
          data?.error ||
            data?.message ||
            "The system is currently under maintenance. Please try again later."
        );
      }
      throw new Error(
        data?.error ||
          data?.message ||
          "Unable to complete the request. Please try again."
      );
    }
    return data;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "The request took too long. Please try again."
      );
    }
    throw error;
  } finally {
    window.clearTimeout(
      timeoutId
    );
  }
}
function normalizeDeployment(
  item = {}
) {
  const employeeId =
    item.employeeId ||
    item.employee_id ||
    item.empId ||
    item.employeeID ||
    "";
  const deploymentId =
    item.deploymentId ||
    item.deployment_id ||
    item.id ||
    "";
  const start =
    item.start ||
    item.deploymentDate ||
    item.deployment_date ||
    item.contractStart ||
    item.contract_start ||
    item.startDate ||
    item.start_date ||
    "-";
  const separationDate =
    item.separationDate ||
    item.separation_date ||
    item.contractEnd ||
    item.contract_end ||
    item.endDate ||
    item.end_date ||
    item.deploymentEnd ||
    item.deployment_end ||
    "-";
  const separationRemarks =
    item.separationRemarks ||
    item.separation_remarks ||
    item.endRemarks ||
    item.end_remarks ||
    "";
  return {
    ...item,
    id:
      employeeId ||
      deploymentId,
    deploymentId,
    employeeId,
    employee:
      item.employee ||
      item.employeeName ||
      item.employee_name ||
      item.name ||
      "Unknown Employee",
    company:
      item.company ||
      item.clientCompany ||
      item.client_company ||
      "-",
    location:
      item.location ||
      item.deploymentLocation ||
      item.deployment_location ||
      item.company ||
      "-",
    start,
    status:
      normalizeDeploymentStatus(
        item.status ||
          item.deploymentStatus ||
          item.deployment_status ||
          "Active"
      ),
    employmentType:
      item.employmentType ||
      item.employment_type ||
      "Permanent",
    contractStart:
      item.contractStart ||
      item.contract_start ||
      item.deploymentDate ||
      item.deployment_date ||
      start,
    contractEnd:
      separationDate,
    separationDate,
    separationReason:
      normalizeSeparationReason(
        item.separationReason ||
          item.separation_reason ||
          item.endReason ||
          item.end_reason,
        separationRemarks
      ),
    separationRemarks,
    createdAt:
      item.createdAt ||
      item.created_at ||
      null,
    updatedAt:
      item.updatedAt ||
      item.updated_at ||
      null,
  };
}
function getRequestError(
  error,
  fallbackMessage
) {
  const status =
    Number(
      error?.response?.status ||
      0
    );

  if (status === 401) {
    return "Your sign-in session has expired. Please sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (status === 503) {
    return "The system is currently under maintenance. Please try again later.";
  }

  if (
    error?.code ===
      "ECONNABORTED" ||
    error?.name ===
      "AbortError"
  ) {
    return "The request took too long. Please try again.";
  }

  if (
    [
      400,
      409,
      422,
    ].includes(
      status
    )
  ) {
    const businessMessage =
      String(
        error?.response?.data
          ?.message ||
        error?.response?.data
          ?.error ||
        ""
      ).trim();

    if (businessMessage) {
      return businessMessage;
    }
  }

  return fallbackMessage;
}
function shouldRefreshDeployments(
  event
) {
  if (
    event?.detail
      ?.source ===
    DATA_EVENT_SOURCE
  ) {
    return false;
  }

  const domain =
    String(
      event?.detail?.domain ||
        ""
    )
      .trim()
      .toLowerCase();

  return (
    DEPLOYMENT_REFRESH_DOMAINS.has(
      domain
    )
  );
}

function getGeneratedByName(
  user
) {
  return (
    user?.full_name ||
    user?.fullName ||
    user?.fullname ||
    user?.display_name ||
    user?.displayName ||
    user?.name ||
    user?.username ||
    "Unknown User"
  );
}

function formatReportDate(
  value
) {
  const raw =
    String(
      value || ""
    ).trim();

  if (
    !raw ||
    raw === "-"
  ) {
    return "-";
  }

  const dateOnlyMatch =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  const date =
    dateOnlyMatch
      ? new Date(
          Date.UTC(
            Number(
              dateOnlyMatch[1]
            ),
            Number(
              dateOnlyMatch[2]
            ) - 1,
            Number(
              dateOnlyMatch[3]
            )
          )
        )
      : new Date(
          raw
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return raw;
  }

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

function formatReportTime(
  value
) {
  const raw =
    String(
      value || ""
    ).trim();

  const match =
    raw.match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/
    );

  if (!match) {
    return "";
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

function getMovementEventDateTimeLabel(
  event
) {
  const dateLabel =
    formatReportDate(
      event?.eventDate
    );

  const timeLabel =
    formatReportTime(
      event?.scheduledTime ??
      event?.scheduled_time
    );

  if (!timeLabel) {
    return dateLabel;
  }

  return `${dateLabel} • ${timeLabel}`;
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

function getMonthLabel(
  monthValue
) {
  if (
    monthValue ===
      undefined ||
    monthValue ===
      null ||
    String(
      monthValue
    ).trim() ===
      ""
  ) {
    return "All Months";
  }

  const monthIndex =
    Number.parseInt(
      String(
        monthValue
      ),
      10
    );

  if (
    !Number.isInteger(
      monthIndex
    ) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return "All Months";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "long",
      timeZone:
        "UTC",
    }
  ).format(
    new Date(
      Date.UTC(
        2026,
        monthIndex,
        1
      )
    )
  );
}

function getReportingPeriodLabel(
  monthValue,
  yearValue
) {
  const monthLabel =
    getMonthLabel(
      monthValue
    );

  const normalizedYear =
    String(
      yearValue || ""
    ).trim();

  if (
    monthLabel !==
      "All Months" &&
    normalizedYear
  ) {
    return `${monthLabel} ${normalizedYear}`;
  }

  if (
    monthLabel !==
    "All Months"
  ) {
    return `${monthLabel} · All Years`;
  }

  if (
    normalizedYear
  ) {
    return `All Months · ${normalizedYear}`;
  }

  return "All Available Records";
}

function getVisibleDeploymentStatus(
  deployment
) {
  const backendDisplayStatus =
    String(
      deployment
        ?.displayStatus ||
      deployment
        ?.display_status ||
      ""
    ).trim();

  if (
    backendDisplayStatus
  ) {
    if (
      [
        "Active",
        "active",
      ].includes(
        backendDisplayStatus
      )
    ) {
      return "Deployed";
    }

    if (
      [
        "Cancelled",
        "Canceled",
        "Separated",
        "Ended",
      ].includes(
        backendDisplayStatus
      )
    ) {
      return "Other Separation";
    }

    return backendDisplayStatus;
  }

  const internalStatus =
    normalizeDeploymentStatus(
      deployment?.status ||
      deployment
        ?.deploymentStatus ||
      deployment
        ?.deployment_status ||
      ""
    );

  if (
    internalStatus ===
    "Active"
  ) {
    return "Deployed";
  }

  if (
    internalStatus ===
    "Completed"
  ) {
    return "Completed";
  }

  const reason =
    normalizeSeparationReason(
      deployment
        ?.separationReason ||
      deployment
        ?.separation_reason ||
      deployment
        ?.endReason ||
      deployment
        ?.end_reason,
      deployment
        ?.separationRemarks ||
      deployment
        ?.separation_remarks ||
      deployment
        ?.endRemarks ||
      deployment
        ?.end_remarks ||
      ""
    );

  if (
    [
      "Resigned",
      "Terminated",
      "AWOL",
    ].includes(
      reason
    )
  ) {
    return reason;
  }

  return "Other Separation";
}

function sanitizeReportFileName(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .slice(
      0,
      90
    );
}

async function exportDeploymentReportPDF({
  reportData,
  user,
  selectedStatus,
  selectedMonth,
  selectedYear,
}) {
  const [
    jsPdfModule,
    autoTableModule,
  ] =
    await Promise.all([
      import(
        "jspdf"
      ),
      import(
        "jspdf-autotable"
      ),
    ]);

  const JsPdf =
    jsPdfModule.jsPDF;

  const autoTable =
    autoTableModule.default ||
    autoTableModule.autoTable;

  if (
    typeof JsPdf !==
      "function" ||
    typeof autoTable !==
      "function"
  ) {
    throw new Error(
      "PDF export library is unavailable."
    );
  }

  const deployments =
    Array.isArray(
      reportData?.deployments
    )
      ? reportData.deployments
      : [];

  const summary =
    reportData?.summary ||
    {};

  const scopedCompany =
    String(
      reportData?.scope
        ?.company ||
      ""
    ).trim();

  const period =
    getReportingPeriodLabel(
      selectedMonth,
      selectedYear
    );

  const generatedBy =
    getGeneratedByName(
      user
    );

  const selectedStatusLabel =
    selectedStatus ===
    "Ended"
      ? "Other Separation"
      : (
          String(
            selectedStatus ||
            "All Statuses"
          ).trim() ||
          "All Statuses"
        );

  const generatedAt =
    reportData
      ?.generatedAt ||
    new Date()
      .toISOString();

  const document =
    new JsPdf({
      orientation:
        "landscape",
      unit:
        "mm",
      format:
        "a4",
    });

  const pageWidth =
    document.internal
      .pageSize
      .getWidth();

  document.setFont(
    "helvetica",
    "bold"
  );

  document.setFontSize(
    15
  );

  document.text(
    "WELLJOB SOLUTIONS & GENERAL SERVICES INC.",
    14,
    14
  );

  document.setFontSize(
    12
  );

  document.text(
    "DEPLOYMENT & SEPARATION REPORT",
    14,
    22
  );

  document.setFont(
    "helvetica",
    "normal"
  );

  document.setFontSize(
    8.5
  );

  document.text(
    `Client Company: ${
      scopedCompany ||
      "All Client Companies"
    }`,
    14,
    29
  );

  document.text(
    `Period: ${period}`,
    14,
    34
  );

  document.text(
    `Status: ${selectedStatusLabel}`,
    14,
    39
  );

  document.text(
    `Generated By: ${generatedBy}`,
    pageWidth / 2,
    29
  );

  document.text(
    `Generated On: ${formatReportDate(
      generatedAt
    )}`,
    pageWidth / 2,
    34
  );

  document.setFont(
    "helvetica",
    "bold"
  );

  document.text(
    [
      `Total ${Number(
        summary.totalRecords ||
          deployments.length ||
          0
      )}`,
      `Deployed ${Number(
        summary.deployed ||
          0
      )}`,
      `Resigned ${Number(
        summary.resigned ||
          0
      )}`,
      `Terminated ${Number(
        summary.terminated ||
          0
      )}`,
      `AWOL ${Number(
        summary.awol ||
          0
      )}`,
      `Other Separation ${Number(
        summary.ended ||
          0
      )}`,
    ].join(
      "   |   "
    ),
    14,
    47
  );

  const includeCompanyColumn =
    !scopedCompany;

  const head = [[
    "Employee ID",
    "Employee",
    "Position",
    ...(includeCompanyColumn
      ? [
          "Client Company",
        ]
      : []),
    "Deployment Date",
    "End Date",
    "Status",
    "Reason",
  ]];

  const body =
    deployments.map(
      (deployment) => {
        const endReason =
          deployment
            ?.endReason ||
          deployment
            ?.end_reason ||
          deployment
            ?.separationReason ||
          deployment
            ?.separation_reason ||
          "-";

        return [
          String(
            deployment
              ?.employeeId ||
            deployment
              ?.employee_id ||
            "-"
          ),
          String(
            deployment
              ?.employee ||
            deployment
              ?.employeeName ||
            deployment
              ?.employee_name ||
            "Unknown Employee"
          ),
          String(
            deployment
              ?.position ||
            "-"
          ),
          ...(includeCompanyColumn
            ? [
                String(
                  deployment
                    ?.company ||
                  "-"
                ),
              ]
            : []),
          formatReportDate(
            deployment
              ?.contractStart ||
            deployment
              ?.start ||
            deployment
              ?.startDate ||
            deployment
              ?.start_date
          ),
          formatReportDate(
            deployment
              ?.contractEnd ||
            deployment
              ?.endDate ||
            deployment
              ?.end_date
          ),
          getVisibleDeploymentStatus(
            deployment
          ),
          String(
            endReason ||
            "-"
          ),
        ];
      }
    );

  autoTable(
    document,
    {
      startY:
        53,
      head,
      body:
        body.length
          ? body
          : [[
              "-",
              "No deployment records matched the selected filters.",
              "-",
              ...(includeCompanyColumn
                ? [
                    "-",
                  ]
                : []),
              "-",
              "-",
              "-",
              "-",
            ]],
      theme:
        "grid",
      margin: {
        left:
          10,
        right:
          10,
        bottom:
          14,
      },
      styles: {
        font:
          "helvetica",
        fontSize:
          7.5,
        cellPadding:
          2,
        overflow:
          "linebreak",
        valign:
          "middle",
      },
      headStyles: {
        fillColor: [
          30,
          41,
          59,
        ],
        textColor: [
          255,
          255,
          255,
        ],
        fontStyle:
          "bold",
      },
      alternateRowStyles: {
        fillColor: [
          248,
          250,
          252,
        ],
      },
      didDrawPage:
        () => {
          const currentPage =
            document.internal
              .getNumberOfPages();

          document.setFont(
            "helvetica",
            "normal"
          );

          document.setFontSize(
            7
          );

          document.text(
            `Page ${currentPage}`,
            pageWidth - 18,
            document.internal
              .pageSize
              .getHeight() -
              6,
            {
              align:
                "right",
            }
          );
        },
    }
  );

  const companyFilePart =
    sanitizeReportFileName(
      scopedCompany ||
      "All_Companies"
    );

  const periodFilePart =
    sanitizeReportFileName(
      period
    );

  const statusFilePart =
    sanitizeReportFileName(
      selectedStatusLabel
    );

  document.save(
    `Deployment_Separation_${companyFilePart}_${periodFilePart}_${statusFilePart}.pdf`
  );
}

function formatRoleLabel(
  value
) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .toLowerCase();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map(
      (part) => {
        if (
          [
            "hr",
            "it",
          ].includes(
            part
          )
        ) {
          return part
            .toUpperCase();
        }

        return part
          ? part
              .charAt(0)
              .toUpperCase() +
            part.slice(1)
          : "";
      }
    )
    .join(" ");
}

function getMovementSummaryItems(
  summary = {}
) {
  return [
    {
      key:
        "scheduled",
      label:
        "Scheduled",
      value:
        Number(
          summary.scheduled ||
          0
        ),
      tone:
        "indigo",
    },
    {
      key:
        "successfullyDeployed",
      label:
        "Successfully Deployed",
      value:
        Number(
          summary.successfullyDeployed ||
          0
        ),
      tone:
        "emerald",
    },
    {
      key:
        "noShow",
      label:
        "No Show",
      value:
        Number(
          summary.noShow ||
          0
        ),
      tone:
        "amber",
    },
    {
      key:
        "withdrawn",
      label:
        "Withdrawn",
      value:
        Number(
          summary.withdrawn ||
          0
        ),
      tone:
        "slate",
    },
    {
      key:
        "resigned",
      label:
        "Resigned",
      value:
        Number(
          summary.resigned ||
          0
        ),
      tone:
        "sky",
    },
    {
      key:
        "terminated",
      label:
        "Terminated",
      value:
        Number(
          summary.terminated ||
          0
        ),
      tone:
        "rose",
    },
    {
      key:
        "awol",
      label:
        "AWOL",
      value:
        Number(
          summary.awol ||
          0
        ),
      tone:
        "orange",
    },
    {
      key:
        "otherSeparation",
      label:
        "Other Separation",
      value:
        Number(
          summary.otherSeparation ||
          0
        ),
      tone:
        "violet",
    },
  ];
}

function getMovementBadgeClass(
  movement
) {
  const normalized =
    String(
      movement || ""
    )
      .trim()
      .toLowerCase();

  if (
    normalized ===
    "scheduled for deployment"
  ) {
    return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300";
  }

  if (
    normalized ===
    "successfully deployed"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (
    normalized ===
    "no show"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300";
  }

  if (
    normalized ===
    "withdrawn"
  ) {
    return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }

  if (
    normalized ===
    "resigned"
  ) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300";
  }

  if (
    normalized ===
    "terminated"
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300";
  }

  if (
    normalized ===
    "awol"
  ) {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300";
  }

  return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300";
}

async function exportDeploymentMovementReportPDF({
  reportData,
  user,
}) {
  const [
    jsPdfModule,
    autoTableModule,
  ] =
    await Promise.all([
      import(
        "jspdf"
      ),
      import(
        "jspdf-autotable"
      ),
    ]);

  const JsPdf =
    jsPdfModule.jsPDF;

  const autoTable =
    autoTableModule.default ||
    autoTableModule.autoTable;

  if (
    typeof JsPdf !==
      "function" ||
    typeof autoTable !==
      "function"
  ) {
    throw new Error(
      "PDF export library is unavailable."
    );
  }

  const events =
    Array.isArray(
      reportData?.events
    )
      ? reportData.events
      : [];

  const companies =
    Array.isArray(
      reportData?.companies
    )
      ? reportData.companies
      : [];

  const summary =
    reportData?.summary ||
    {};

  const scopedCompany =
    String(
      reportData?.scope
        ?.company ||
      ""
    ).trim();

  const periodLabel =
    String(
      reportData?.filters
        ?.periodLabel ||
      "Selected Period"
    );

  const generatedBy =
    getGeneratedByName(
      user
    );

  const generatedAt =
    reportData?.meta
      ?.generatedAt ||
    new Date()
      .toISOString();

  const document =
    new JsPdf({
      orientation:
        "landscape",
      unit:
        "mm",
      format:
        "a4",
    });

  const pageWidth =
    document.internal
      .pageSize
      .getWidth();

  document.setFont(
    "helvetica",
    "bold"
  );

  document.setFontSize(
    15
  );

  document.text(
    "WELLJOB SOLUTIONS & GENERAL SERVICES INC.",
    14,
    14
  );

  document.setFontSize(
    12
  );

  document.text(
    "DEPLOYMENT HISTORY REPORT",
    14,
    22
  );

  document.setFont(
    "helvetica",
    "normal"
  );

  document.setFontSize(
    8.5
  );

  document.text(
    `Client Company: ${
      scopedCompany ||
      "All Client Companies"
    }`,
    14,
    29
  );

  document.text(
    `Period: ${periodLabel}`,
    14,
    34
  );

  document.text(
    `Generated By: ${generatedBy}`,
    pageWidth / 2,
    29
  );

  document.text(
    `Generated On: ${formatReportDate(
      generatedAt
    )}`,
    pageWidth / 2,
    34
  );

  document.setFont(
    "helvetica",
    "bold"
  );

  document.setFontSize(
    7.5
  );

  document.text(
    [
      `Total ${Number(
        summary.totalEvents ||
        events.length ||
        0
      )}`,
      `Scheduled ${Number(
        summary.scheduled ||
        0
      )}`,
      `Successfully Deployed ${Number(
        summary.successfullyDeployed ||
        0
      )}`,
      `No Show ${Number(
        summary.noShow ||
        0
      )}`,
      `Withdrawn ${Number(
        summary.withdrawn ||
        0
      )}`,
    ].join(
      "   |   "
    ),
    14,
    43
  );

  document.text(
    [
      `Resigned ${Number(
        summary.resigned ||
        0
      )}`,
      `Terminated ${Number(
        summary.terminated ||
        0
      )}`,
      `AWOL ${Number(
        summary.awol ||
        0
      )}`,
      `Other Separation ${Number(
        summary.otherSeparation ||
        0
      )}`,
    ].join(
      "   |   "
    ),
    14,
    48
  );

  let nextStartY =
    55;

  if (
    !scopedCompany &&
    companies.length >
      0
  ) {
    autoTable(
      document,
      {
        startY:
          nextStartY,
        head: [[
          "Client Company",
          "Total",
          "Scheduled",
          "Deployed",
          "No Show",
          "Withdrawn",
          "Resigned",
          "Terminated",
          "AWOL",
          "Other Separation",
        ]],
        body:
          companies.map(
            (company) => [
              company.company ||
                "Unassigned",
              Number(
                company.totalEvents ||
                0
              ),
              Number(
                company.scheduled ||
                0
              ),
              Number(
                company.successfullyDeployed ||
                0
              ),
              Number(
                company.noShow ||
                0
              ),
              Number(
                company.withdrawn ||
                0
              ),
              Number(
                company.resigned ||
                0
              ),
              Number(
                company.terminated ||
                0
              ),
              Number(
                company.awol ||
                0
              ),
              Number(
                company.otherSeparation ||
                0
              ),
            ]
          ),
        theme:
          "grid",
        styles: {
          font:
            "helvetica",
          fontSize:
            6.8,
          cellPadding:
            1.6,
          overflow:
            "linebreak",
        },
        headStyles: {
          fillColor: [
            30,
            41,
            59,
          ],
          textColor: [
            255,
            255,
            255,
          ],
          fontStyle:
            "bold",
        },
        margin: {
          left:
            10,
          right:
            10,
        },
      }
    );

    nextStartY =
      (
        document.lastAutoTable
          ?.finalY ||
        nextStartY
      ) +
      8;
  }

  const includeCompanyColumn =
    !scopedCompany;

  autoTable(
    document,
    {
      startY:
        nextStartY,
      head: [[
        "Date / Time",
        "Employee ID",
        "Employee",
        "Position",
        ...(includeCompanyColumn
          ? [
              "Client Company",
            ]
          : []),
        "Activity",
        "Previous Status",
        "New Status",
        "Performed By",
        "Reason",
      ]],
      body:
        events.length >
        0
          ? events.map(
              (event) => [
                getMovementEventDateTimeLabel(
                  event
                ),
                String(
                  event.employeeId ||
                  "-"
                ),
                String(
                  event.employeeName ||
                  "Unknown Employee"
                ),
                String(
                  event.position ||
                  "-"
                ),
                ...(includeCompanyColumn
                  ? [
                      String(
                        event.company ||
                        "Unassigned"
                      ),
                    ]
                  : []),
                String(
                  event.movement ||
                  "-"
                ),
                String(
                  event.fromStatus ||
                  "-"
                ),
                String(
                  event.toStatus ||
                  "-"
                ),
                [
                  event.performedBy ||
                    "-",
                  formatRoleLabel(
                    event.performedByRole
                  ),
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    " · "
                  ),
                String(
                  event.reason ||
                  "-"
                ),
              ]
            )
          : [[
              "-",
              "-",
              "No history events matched the selected period.",
              "-",
              ...(includeCompanyColumn
                ? [
                    "-",
                  ]
                : []),
              "-",
              "-",
              "-",
              "-",
              "-",
            ]],
      theme:
        "grid",
      styles: {
        font:
          "helvetica",
        fontSize:
          6.7,
        cellPadding:
          1.6,
        overflow:
          "linebreak",
        valign:
          "middle",
      },
      headStyles: {
        fillColor: [
          79,
          70,
          229,
        ],
        textColor: [
          255,
          255,
          255,
        ],
        fontStyle:
          "bold",
      },
      alternateRowStyles: {
        fillColor: [
          248,
          250,
          252,
        ],
      },
      margin: {
        left:
          10,
        right:
          10,
        bottom:
          14,
      },
      didDrawPage:
        () => {
          const currentPage =
            document.internal
              .getNumberOfPages();

          document.setFont(
            "helvetica",
            "normal"
          );

          document.setFontSize(
            7
          );

          document.text(
            `Page ${currentPage}`,
            pageWidth - 18,
            document.internal
              .pageSize
              .getHeight() -
              6,
            {
              align:
                "right",
            }
          );
        },
    }
  );

  const companyFilePart =
    sanitizeReportFileName(
      scopedCompany ||
      "All_Companies"
    );

  const periodFilePart =
    sanitizeReportFileName(
      periodLabel
    );

  document.save(
    `Deployment_History_${companyFilePart}_${periodFilePart}.pdf`
  );
}

export default function Deployments() {
  const {
    user,
  } = useAuth();
  const isSuperAdmin =
    user?.role ===
    ROLES.SUPER_ADMIN;
  const isHRCoordinator =
    user?.role ===
    ROLES.HR_COORDINATOR;
  const [
    activeView,
    setActiveView,
  ] = useState(
    DEPLOYMENT_VIEW.RECORDS
  );
  /*
   * Super Admin remains view-only for actual deployment
   * assignment records.
   *
   * HR Coordinator also remains view-only for the existing
   * deployment-assignment table, but has a separate,
   * company-scoped operational workflow for pending arrivals:
   * Confirm Arrival or No Show.
   */
  const isReadOnlyDeploymentAccess =
    isSuperAdmin ||
    isHRCoordinator;
  const assignedCompany =
    String(
      user?.assignedCompany ??
        user?.assigned_company ??
        ""
    ).trim();
  const [
    selectedDeployment,
    setSelectedDeployment,
  ] = useState(null);
  const [
    deployments,
    setDeployments,
  ] = useState([]);
  const [
    isLoading,
    setIsLoading,
  ] = useState(true);
  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);
  const [
    isExporting,
    setIsExporting,
  ] = useState(false);
  const [
    fetchError,
    setFetchError,
  ] = useState("");
  const [
    toastTitle,
    setToastTitle,
  ] = useState(
    "Deployment Updated"
  );
  const [
    toastMessage,
    setToastMessage,
  ] = useState("");
  const [
    search,
    setSearch,
  ] = useState("");
  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState("");
  const [
    page,
    setPage,
  ] = useState(1);
  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    pageSize:
      DEPLOYMENT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [
    deploymentSummary,
    setDeploymentSummary,
  ] = useState({
    companies: [],
    totalDeployments: 0,
    totalCompanies: 0,
    deployedDeployments: 0,
    activeDeployments: 0,
    completedDeployments: 0,
    resignedDeployments: 0,
    terminatedDeployments: 0,
    awolDeployments: 0,
    endedDeployments: 0,
    topCompany: null,
  });
  const [
    availableYears,
    setAvailableYears,
  ] = useState([]);
  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("");
  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState("");
  const [
    selectedYear,
    setSelectedYear,
  ] = useState("");
  const [
    movementMonth,
    setMovementMonth,
  ] = useState("");
  const [
    movementYear,
    setMovementYear,
  ] = useState(
    String(
      new Date()
        .getFullYear()
    )
  );
  const [
    movementReport,
    setMovementReport,
  ] = useState({
    summary: {
      totalEvents: 0,
      scheduled: 0,
      successfullyDeployed: 0,
      noShow: 0,
      withdrawn: 0,
      resigned: 0,
      terminated: 0,
      awol: 0,
      otherSeparation: 0,
    },
    companies: [],
    overallTotal: {
      totalEvents: 0,
      scheduled: 0,
      successfullyDeployed: 0,
      noShow: 0,
      withdrawn: 0,
      resigned: 0,
      terminated: 0,
      awol: 0,
      otherSeparation: 0,
    },
    events: [],
    count: 0,
    filterMeta: {
      years: [],
    },
    filters: null,
    scope: null,
    meta: null,
  });
  const [
    movementLoading,
    setMovementLoading,
  ] = useState(false);
  const [
    movementRefreshing,
    setMovementRefreshing,
  ] = useState(false);

  const [
    pendingArrivals,
    setPendingArrivals,
  ] = useState([]);

  const [
    pendingArrivalsLoading,
    setPendingArrivalsLoading,
  ] = useState(false);

  const [
    pendingArrivalsRefreshing,
    setPendingArrivalsRefreshing,
  ] = useState(false);

  const [
    coordinatorActionTarget,
    setCoordinatorActionTarget,
  ] = useState(null);

  const [
    coordinatorActionMode,
    setCoordinatorActionMode,
  ] = useState("");

  const [
    coordinatorActionDate,
    setCoordinatorActionDate,
  ] = useState(
    getPhilippinesTodayISO()
  );

  const [
    coordinatorActionRemarks,
    setCoordinatorActionRemarks,
  ] = useState("");

  const [
    coordinatorActionSubmitting,
    setCoordinatorActionSubmitting,
  ] = useState(false);

  const [
    coordinatorActionError,
    setCoordinatorActionError,
  ] = useState("");

  const isMountedRef =
    useRef(true);
  const isFetchingRef =
    useRef(false);
  const latestRequestIdRef =
    useRef(0);
  const movementRequestIdRef =
    useRef(0);
  const movementFetchingRef =
    useRef(false);
  const movementLoadedRef =
    useRef(false);
  const pendingArrivalRequestIdRef =
    useRef(0);
  const pendingArrivalsFetchingRef =
    useRef(false);
  const pendingArrivalsLoadedRef =
    useRef(false);
  const hasInitialLoadStartedRef =
    useRef(false);
  const dataUpdateTimerRef =
    useRef(null);
  const monthOptions =
    useMemo(
      () =>
        getMonthOptions(),
      []
    );
  const yearOptions =
    useMemo(
      () => [
        {
          label:
            "All Years",
          value:
            "",
        },
        ...availableYears.map(
          (year) => ({
            label:
              String(
                year
              ),
            value:
              String(
                year
              ),
          })
        ),
      ],
      [
        availableYears,
      ]
    );
  const movementYearOptions =
    useMemo(
      () => {
        const years =
          new Set([
            Number(
              new Date()
                .getFullYear()
            ),
            Number(
              movementYear
            ),
          ]);

        (
          Array.isArray(
            movementReport
              ?.filterMeta
              ?.years
          )
            ? movementReport
                .filterMeta
                .years
            : []
        ).forEach(
          (year) => {
            const numericYear =
              Number(
                year
              );

            if (
              Number.isInteger(
                numericYear
              )
            ) {
              years.add(
                numericYear
              );
            }
          }
        );

        return Array.from(
          years
        )
          .filter(
            Number.isInteger
          )
          .sort(
            (
              firstYear,
              secondYear
            ) =>
              secondYear -
              firstYear
          )
          .map(
            (year) => ({
              label:
                String(
                  year
                ),
              value:
                String(
                  year
                ),
            })
          );
      },
      [
        movementReport,
        movementYear,
      ]
    );
  useEffect(() => {
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
    };
  }, []);
  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setDebouncedSearch(
            search.trim()
          );
        },
        SEARCH_DEBOUNCE_MS
      );
    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    search,
  ]);
  const fetchDeployments =
    useCallback(
      async ({
        showInitialLoading =
          false,
        showRefreshing =
          false,
        showError =
          true,
      } = {}) => {
        const requestId =
          latestRequestIdRef.current +
          1;
        latestRequestIdRef.current =
          requestId;
        isFetchingRef.current =
          true;
        if (
          showInitialLoading &&
          isMountedRef.current
        ) {
          setIsLoading(
            true
          );
        }
        if (
          showRefreshing &&
          isMountedRef.current
        ) {
          setIsRefreshing(
            true
          );
        }
        try {
          if (
            showError &&
            isMountedRef.current
          ) {
            setFetchError(
              ""
            );
          }
          const params =
            new URLSearchParams({
              view:
                "summary",
              page:
                String(
                  page
                ),
              pageSize:
                String(
                  DEPLOYMENT_PAGE_SIZE
                ),
              search:
                debouncedSearch,
              status:
                selectedStatus,
              month:
                selectedMonth,
              year:
                selectedYear,
            });
          /*
           * SECURITY:
           *
           * Do NOT send a company query parameter for
           * HR Coordinator.
           *
           * Backend authMiddleware +
           * deploymentController determine the company
           * from req.user.assignedCompany.
           */
          const data =
            await requestJson(
              `${DEPLOYMENT_API_URL}?${params.toString()}`
            );
          if (
            !isMountedRef.current ||
            requestId !==
              latestRequestIdRef.current
          ) {
            return false;
          }
          const normalized =
            Array.isArray(
              data?.deployments
            )
              ? data.deployments.map(
                  normalizeDeployment
                )
              : [];
          const nextPagination =
            data?.pagination ||
            {};
          const nextTotalPages =
            Number(
              nextPagination.totalPages ||
                0
            );
          setDeployments(
            normalized
          );
          setPagination({
            page:
              Number(
                nextPagination.page
              ) ||
              page,
            pageSize:
              Number(
                nextPagination.pageSize
              ) ||
              DEPLOYMENT_PAGE_SIZE,
            total:
              Number(
                nextPagination.total
              ) ||
              0,
            totalPages:
              nextTotalPages,
          });
          setDeploymentSummary({
            companies:
              Array.isArray(
                data?.summary
                  ?.companies
              )
                ? data.summary.companies
                : [],
            totalDeployments:
              Number(
                data?.summary
                  ?.totalDeployments
              ) ||
              0,
            totalCompanies:
              Number(
                data?.summary
                  ?.totalCompanies
              ) ||
              0,
            deployedDeployments:
              Number(
                data?.summary
                  ?.deployedDeployments ??
                data?.summary
                  ?.activeDeployments
              ) ||
              0,
            activeDeployments:
              Number(
                data?.summary
                  ?.activeDeployments ??
                data?.summary
                  ?.deployedDeployments
              ) ||
              0,
            completedDeployments:
              Number(
                data?.summary
                  ?.completedDeployments
              ) ||
              0,
            resignedDeployments:
              Number(
                data?.summary
                  ?.resignedDeployments
              ) ||
              0,
            terminatedDeployments:
              Number(
                data?.summary
                  ?.terminatedDeployments
              ) ||
              0,
            awolDeployments:
              Number(
                data?.summary
                  ?.awolDeployments
              ) ||
              0,
            endedDeployments:
              Number(
                data?.summary
                  ?.endedDeployments
              ) ||
              0,
            topCompany:
              data?.summary
                ?.topCompany ||
              null,
          });
          setAvailableYears(
            Array.isArray(
              data?.filterMeta
                ?.years
            )
              ? data.filterMeta.years
                  .map(
                    (year) =>
                      Number(
                        year
                      )
                  )
                  .filter(
                    Number.isInteger
                  )
              : []
          );
          if (
            nextTotalPages >
              0 &&
            page >
              nextTotalPages
          ) {
            setPage(
              nextTotalPages
            );
          }
          return true;
        } catch (error) {
          if (
            requestId !==
              latestRequestIdRef.current
          ) {
            return false;
          }
          console.error(
            "Fetch deployments error:",
            error
          );
          if (
            showError &&
            isMountedRef.current
          ) {
            setFetchError(
              getRequestError(
                error,
                "Unable to load deployment records."
              )
            );
          }
          return false;
        } finally {
          if (
            requestId ===
            latestRequestIdRef.current
          ) {
            isFetchingRef.current =
              false;
            if (
              isMountedRef.current
            ) {
              setIsLoading(
                false
              );
              setIsRefreshing(
                false
              );
            }
          }
        }
      },
      [
        debouncedSearch,
        page,
        selectedStatus,
        selectedMonth,
        selectedYear,
      ]
    );

  const fetchMovementReport =
    useCallback(
      async ({
        showLoading =
          false,
        showRefreshing =
          false,
        showError =
          true,
      } = {}) => {
        const requestId =
          movementRequestIdRef
            .current +
          1;

        movementRequestIdRef.current =
          requestId;

        movementFetchingRef.current =
          true;

        if (
          showLoading &&
          isMountedRef.current
        ) {
          setMovementLoading(
            true
          );
        }

        if (
          showRefreshing &&
          isMountedRef.current
        ) {
          setMovementRefreshing(
            true
          );
        }

        try {
          if (
            showError &&
            isMountedRef.current
          ) {
            setFetchError(
              ""
            );
          }

          const params =
            new URLSearchParams({
              year:
                String(
                  movementYear
                ),
            });

          if (
            movementMonth !==
            ""
          ) {
            params.set(
              "month",
              movementMonth
            );
          }

          const data =
            await requestJson(
              `${DEPLOYMENT_MOVEMENT_REPORT_API_URL}?${params.toString()}`
            );

          if (
            !isMountedRef.current ||
            requestId !==
              movementRequestIdRef
                .current
          ) {
            return false;
          }

          setMovementReport({
            summary:
              data?.summary ||
              {
                totalEvents: 0,
                scheduled: 0,
                successfullyDeployed: 0,
                noShow: 0,
                withdrawn: 0,
                resigned: 0,
                terminated: 0,
                awol: 0,
                otherSeparation: 0,
              },

            companies:
              Array.isArray(
                data?.companies
              )
                ? data.companies
                : [],

            overallTotal:
              data?.overallTotal ||
              {},

            events:
              Array.isArray(
                data?.events
              )
                ? data.events
                : [],

            count:
              Number(
                data?.count ||
                0
              ),

            filterMeta:
              data?.filterMeta ||
              {
                years: [],
              },

            filters:
              data?.filters ||
              null,

            scope:
              data?.scope ||
              null,

            meta:
              data?.meta ||
              null,
          });

          movementLoadedRef.current =
            true;

          return true;
        } catch (error) {
          if (
            requestId !==
              movementRequestIdRef
                .current
          ) {
            return false;
          }

          console.error(
            "Fetch deployment movement report error:",
            error
          );

          if (
            showError &&
            isMountedRef.current
          ) {
            setFetchError(
              getRequestError(
                error,
                "Unable to load deployment history."
              )
            );
          }

          return false;
        } finally {
          if (
            requestId ===
              movementRequestIdRef
                .current
          ) {
            movementFetchingRef.current =
              false;

            if (
              isMountedRef.current
            ) {
              setMovementLoading(
                false
              );

              setMovementRefreshing(
                false
              );
            }
          }
        }
      },
      [
        movementMonth,
        movementYear,
      ]
    );

  const fetchPendingArrivals =
    useCallback(
      async ({
        showLoading =
          false,
        showRefreshing =
          false,
        showError =
          true,
      } = {}) => {
        if (
          !isHRCoordinator
        ) {
          if (
            isMountedRef.current
          ) {
            setPendingArrivals(
              []
            );
          }

          return true;
        }

        const requestId =
          pendingArrivalRequestIdRef
            .current +
          1;

        pendingArrivalRequestIdRef.current =
          requestId;

        pendingArrivalsFetchingRef.current =
          true;

        if (
          showLoading &&
          isMountedRef.current
        ) {
          setPendingArrivalsLoading(
            true
          );
        }

        if (
          showRefreshing &&
          isMountedRef.current
        ) {
          setPendingArrivalsRefreshing(
            true
          );
        }

        try {
          if (
            showError &&
            isMountedRef.current
          ) {
            setFetchError(
              ""
            );
          }

          const params =
            new URLSearchParams({
              status:
                "For Deployment",
              limit:
                "100",
            });

          const data =
            await requestJson(
              `${DEPLOYMENT_ATTEMPT_API_URL}?${params.toString()}`
            );

          if (
            !isMountedRef.current ||
            requestId !==
              pendingArrivalRequestIdRef
                .current
          ) {
            return false;
          }

          const attempts =
            Array.isArray(
              data?.data
            )
              ? data.data
              : [];

          setPendingArrivals(
            attempts
          );

          pendingArrivalsLoadedRef.current =
            true;

          return true;
        } catch (error) {
          if (
            requestId !==
              pendingArrivalRequestIdRef
                .current
          ) {
            return false;
          }

          console.error(
            "Fetch pending deployment arrivals error:",
            error
          );

          if (
            showError &&
            isMountedRef.current
          ) {
            setFetchError(
              getRequestError(
                error,
                "Unable to load pending deployment arrivals."
              )
            );
          }

          return false;
        } finally {
          if (
            requestId ===
              pendingArrivalRequestIdRef
                .current
          ) {
            pendingArrivalsFetchingRef.current =
              false;

            if (
              isMountedRef.current
            ) {
              setPendingArrivalsLoading(
                false
              );

              setPendingArrivalsRefreshing(
                false
              );
            }
          }
        }
      },
      [
        isHRCoordinator,
      ]
    );

  useEffect(() => {
    const showInitialLoading =
      !hasInitialLoadStartedRef.current;
    hasInitialLoadStartedRef.current =
      true;
    void fetchDeployments({
      showInitialLoading,
    });
  }, [
    fetchDeployments,
  ]);

  useEffect(() => {
    if (
      activeView !==
      DEPLOYMENT_VIEW.MOVEMENT
    ) {
      return;
    }

    void fetchMovementReport({
      showLoading:
        !movementLoadedRef.current,
    });
  }, [
    activeView,
    fetchMovementReport,
  ]);

  useEffect(() => {
    if (
      !isHRCoordinator ||
      activeView !==
        DEPLOYMENT_VIEW.RECORDS
    ) {
      return;
    }

    void fetchPendingArrivals({
      showLoading:
        !pendingArrivalsLoadedRef.current,
    });
  }, [
    activeView,
    fetchPendingArrivals,
    isHRCoordinator,
  ]);

  useEffect(() => {
    const scheduleRefresh =
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
              if (
                activeView ===
                DEPLOYMENT_VIEW.MOVEMENT
              ) {
                void fetchMovementReport({
                  showError:
                    false,
                });

                return;
              }

              void fetchDeployments({
                showError:
                  false,
              });

              if (
                isHRCoordinator
              ) {
                void fetchPendingArrivals({
                  showError:
                    false,
                });
              }
            },
            DATA_UPDATE_DEBOUNCE_MS
          );
      };
    const handleDataUpdated =
      (event) => {
        if (
          shouldRefreshDeployments(
            event
          )
        ) {
          scheduleRefresh();
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
      }
      window.removeEventListener(
        "dataUpdated",
        handleDataUpdated
      );
    };
  }, [
    activeView,
    fetchDeployments,
    fetchMovementReport,
    fetchPendingArrivals,
    isHRCoordinator,
  ]);
  const openView =
    useCallback(
      (deployment) => {
        if (!deployment) {
          return;
        }
        setSelectedDeployment(
          deployment
        );
      },
      []
    );
  const closeDeploymentModal =
    useCallback(() => {
      setSelectedDeployment(
        null
      );
    }, []);
  const handleCloseToast =
    useCallback(() => {
      setToastMessage(
        ""
      );
    }, []);
  const handleInlineUpdateRow =
    useCallback(
      async (
        updatedDeployment
      ) => {
        /*
         * Frontend defense in depth.
         *
         * Backend PATCH route remains authoritative,
         * but read-only roles should never attempt
         * the request from the UI.
         */
        if (
          isReadOnlyDeploymentAccess
        ) {
          setFetchError(
            isHRCoordinator
              ? "HR Coordinators can review deployment records but cannot change existing deployment records."
              : "Super Admin can review deployment records but cannot change existing deployment records."
          );
          return false;
        }
        const deploymentId =
          updatedDeployment
            ?.deploymentId ||
          updatedDeployment
            ?.deployment_id;
        if (!deploymentId) {
          setFetchError(
            "Unable to update this deployment record. Please refresh and try again."
          );
          return false;
        }
        try {
          setFetchError(
            ""
          );
          const statusPayload =
            buildDeploymentStatusPayload(
              updatedDeployment
            );
          const response =
            await axios.patch(
              `${DEPLOYMENT_API_URL}/${encodeURIComponent(
                deploymentId
              )}/status`,
              statusPayload,
              {
                timeout:
                  REQUEST_TIMEOUT_MS,
                headers:
                  getAuthenticatedHeaders(),
              }
            );
          await fetchDeployments({
            showError:
              false,
          });
          emitDataUpdated(
            "DEPLOYMENT_STATUS_UPDATED"
          );
          setToastTitle(
            "Deployment Updated"
          );

          setToastMessage(
            response?.data?.message ||
              "Deployment status updated successfully."
          );
          return true;
        } catch (error) {
          console.error(
            "Error updating deployment status:",
            error
          );
          setFetchError(
            getRequestError(
              error,
              "Failed to update deployment status. Please try again."
            )
          );
          return false;
        }
      },
      [
        fetchDeployments,
        isHRCoordinator,
        isReadOnlyDeploymentAccess,
      ]
    );
  const openCoordinatorAction =
    useCallback(
      (
        attempt,
        mode
      ) => {
        if (
          !isHRCoordinator ||
          !attempt ||
          ![
            "confirm",
            "no-show",
          ].includes(
            mode
          )
        ) {
          return;
        }

        setCoordinatorActionTarget(
          attempt
        );

        setCoordinatorActionMode(
          mode
        );

        setCoordinatorActionDate(
          getPhilippinesTodayISO()
        );

        setCoordinatorActionRemarks(
          ""
        );

        setCoordinatorActionError(
          ""
        );
      },
      [
        isHRCoordinator,
      ]
    );

  const closeCoordinatorAction =
    useCallback(
      () => {
        if (
          coordinatorActionSubmitting
        ) {
          return;
        }

        setCoordinatorActionTarget(
          null
        );

        setCoordinatorActionMode(
          ""
        );

        setCoordinatorActionRemarks(
          ""
        );

        setCoordinatorActionError(
          ""
        );
      },
      [
        coordinatorActionSubmitting,
      ]
    );

  const submitCoordinatorAction =
    useCallback(
      async () => {
        if (
          !isHRCoordinator ||
          !coordinatorActionTarget ||
          coordinatorActionSubmitting
        ) {
          return;
        }

        const attemptId =
          coordinatorActionTarget
            ?.attemptId ||
          coordinatorActionTarget
            ?.id;

        if (!attemptId) {
          setCoordinatorActionError(
            "Unable to process this deployment schedule. Please refresh and try again."
          );
          return;
        }

        if (
          coordinatorActionMode ===
            "confirm" &&
          !coordinatorActionDate
        ) {
          setCoordinatorActionError(
            "Actual arrival date is required."
          );
          return;
        }

        try {
          setCoordinatorActionSubmitting(
            true
          );

          setCoordinatorActionError(
            ""
          );

          const isConfirm =
            coordinatorActionMode ===
            "confirm";

          const endpoint =
            isConfirm
              ? "confirm-arrival"
              : "no-show";

          const payload =
            isConfirm
              ? {
                  actualArrivalDate:
                    coordinatorActionDate,
                  remarks:
                    coordinatorActionRemarks.trim(),
                }
              : {
                  remarks:
                    coordinatorActionRemarks.trim(),
                };

          const response =
            await axios.patch(
              `${DEPLOYMENT_ATTEMPT_API_URL}/${encodeURIComponent(
                attemptId
              )}/${endpoint}`,
              payload,
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

          setCoordinatorActionTarget(
            null
          );

          setCoordinatorActionMode(
            ""
          );

          setCoordinatorActionRemarks(
            ""
          );

          setToastTitle(
            isConfirm
              ? "Arrival Confirmed"
              : "No Show Recorded"
          );

          setToastMessage(
            response?.data?.message ||
              (
                isConfirm
                  ? "Employee arrival confirmed and deployment started."
                  : "No Show recorded. The employee was returned to Floating / Standby."
              )
          );

          await Promise.all([
            fetchPendingArrivals({
              showError:
                false,
            }),

            fetchDeployments({
              showError:
                false,
            }),
          ]);

          emitDataUpdated(
            isConfirm
              ? "DEPLOYMENT_ARRIVAL_CONFIRMED"
              : "DEPLOYMENT_NO_SHOW"
          );
        } catch (error) {
          console.error(
            "Coordinator deployment action error:",
            error
          );

          setCoordinatorActionError(
            getRequestError(
              error,
              coordinatorActionMode ===
                "confirm"
                ? "Unable to confirm employee arrival."
                : "Unable to mark the employee as No Show."
            )
          );
        } finally {
          if (
            isMountedRef.current
          ) {
            setCoordinatorActionSubmitting(
              false
            );
          }
        }
      },
      [
        coordinatorActionDate,
        coordinatorActionMode,
        coordinatorActionRemarks,
        coordinatorActionSubmitting,
        coordinatorActionTarget,
        fetchDeployments,
        fetchPendingArrivals,
        isHRCoordinator,
      ]
    );

  const handleRefresh =
    useCallback(
      async () => {
        if (
          activeView ===
          DEPLOYMENT_VIEW.MOVEMENT
        ) {
          if (
            movementFetchingRef.current ||
            movementRefreshing
          ) {
            return;
          }

          await fetchMovementReport({
            showRefreshing:
              true,
          });

          return;
        }

        if (
          isFetchingRef.current ||
          isRefreshing
        ) {
          return;
        }

        if (
          isHRCoordinator
        ) {
          if (
            pendingArrivalsFetchingRef.current ||
            pendingArrivalsRefreshing
          ) {
            return;
          }

          await Promise.all([
            fetchDeployments({
              showRefreshing:
                true,
            }),

            fetchPendingArrivals({
              showRefreshing:
                true,
            }),
          ]);

          return;
        }

        await fetchDeployments({
          showRefreshing:
            true,
        });
      },
      [
        activeView,
        fetchDeployments,
        fetchMovementReport,
        fetchPendingArrivals,
        isHRCoordinator,
        isRefreshing,
        movementRefreshing,
        pendingArrivalsRefreshing,
      ]
    );
  const handleExportPDF =
    useCallback(
      async () => {
        if (
          isExporting
        ) {
          return;
        }

        setIsExporting(
          true
        );

        setFetchError(
          ""
        );

        try {
          const params =
            new URLSearchParams();

          const currentSearch =
            search.trim();

          if (
            currentSearch
          ) {
            params.set(
              "search",
              currentSearch
            );
          }

          if (
            selectedStatus
          ) {
            params.set(
              "status",
              selectedStatus
            );
          }

          if (
            selectedMonth !==
            ""
          ) {
            params.set(
              "month",
              selectedMonth
            );
          }

          if (
            selectedYear !==
            ""
          ) {
            params.set(
              "year",
              selectedYear
            );
          }

          const query =
            params.toString();

          const reportData =
            await requestJson(
              `${DEPLOYMENT_API_URL}/report${
                query
                  ? `?${query}`
                  : ""
              }`
            );

          await exportDeploymentReportPDF({
            reportData,
            user,
            selectedStatus,
            selectedMonth,
            selectedYear,
          });

          const exportedCount =
            Number(
              reportData?.total ||
              reportData
                ?.deployments
                ?.length ||
              0
            );

          setToastTitle(
            "PDF Exported"
          );

          setToastMessage(
            `${exportedCount} deployment ${
              exportedCount ===
              1
                ? "record"
                : "records"
            } included in the PDF.`
          );
        } catch (error) {
          console.error(
            "Export deployment PDF error:",
            error
          );

          setFetchError(
            getRequestError(
              error,
              "Unable to export the deployment PDF."
            )
          );
        } finally {
          if (
            isMountedRef.current
          ) {
            setIsExporting(
              false
            );
          }
        }
      },
      [
        isExporting,
        search,
        selectedMonth,
        selectedStatus,
        selectedYear,
        user,
      ]
    );

  const handleExportMovementPDF =
    useCallback(
      async () => {
        if (
          isExporting
        ) {
          return;
        }

        setIsExporting(
          true
        );

        setFetchError(
          ""
        );

        try {
          const params =
            new URLSearchParams({
              year:
                String(
                  movementYear
                ),
            });

          if (
            movementMonth !==
            ""
          ) {
            params.set(
              "month",
              movementMonth
            );
          }

          const reportData =
            await requestJson(
              `${DEPLOYMENT_MOVEMENT_REPORT_API_URL}?${params.toString()}`
            );

          await exportDeploymentMovementReportPDF({
            reportData,
            user,
          });

          const exportedCount =
            Number(
              reportData?.count ||
              reportData
                ?.events
                ?.length ||
              0
            );

          setToastTitle(
            "PDF Exported"
          );

          setToastMessage(
            `${exportedCount} history ${
              exportedCount ===
              1
                ? "record"
                : "records"
            } included in the PDF.`
          );
        } catch (error) {
          console.error(
            "Export deployment history PDF error:",
            error
          );

          setFetchError(
            getRequestError(
              error,
              "Unable to export the deployment history PDF."
            )
          );
        } finally {
          if (
            isMountedRef.current
          ) {
            setIsExporting(
              false
            );
          }
        }
      },
      [
        isExporting,
        movementMonth,
        movementYear,
        user,
      ]
    );

  const handleResetFilters =
    useCallback(() => {
      setSearch("");
      setSelectedStatus(
        ""
      );
      setSelectedMonth(
        ""
      );
      setSelectedYear(
        ""
      );
      setPage(
        1
      );
    }, []);
  const visibleDeployments =
    deployments;
  const hasActiveFilters =
    Boolean(
      search.trim() ||
      selectedStatus ||
      selectedMonth ||
      selectedYear
    );
  const isMovementView =
    activeView ===
    DEPLOYMENT_VIEW.MOVEMENT;

  const currentViewLoading =
    isMovementView
      ? movementLoading
      : (
          isLoading ||
          (
            isHRCoordinator &&
            pendingArrivalsLoading
          )
        );

  const currentViewRefreshing =
    isMovementView
      ? movementRefreshing
      : (
          isRefreshing ||
          (
            isHRCoordinator &&
            pendingArrivalsRefreshing
          )
        );

  const pageDescription =
    isMovementView
      ? isHRCoordinator
        ? assignedCompany
          ? `Review deployment history for ${assignedCompany}.`
          : "Review deployment history for your assigned client company."
        : "Review deployment scheduling, arrival outcomes, and separation history across client companies."
      : isHRCoordinator
        ? assignedCompany
          ? `Review deployment records and process expected employee arrivals for ${assignedCompany}.`
          : "Review deployment records and process expected employee arrivals for your assigned client company."
        : isSuperAdmin
          ? "Review employee assignments to client companies and deployment history. Super Admin can view records without making changes."
          : "Manage employee assignments to client companies and maintain deployment history.";
  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Workforce Assignment"
        title="Deployment Tracking"
        description={
          pageDescription
        }
        icon={
          <FiBriefcase
            size={22}
          />
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={
                <FiRefreshCw
                  className={
                    currentViewRefreshing
                      ? "animate-spin"
                      : ""
                  }
                />
              }
              loading={
                currentViewRefreshing
              }
              disabled={
                currentViewLoading ||
                currentViewRefreshing ||
                isExporting ||
                (
                  isMovementView
                    ? movementFetchingRef.current
                    : (
                        isFetchingRef.current ||
                        (
                          isHRCoordinator &&
                          pendingArrivalsFetchingRef.current
                        )
                      )
                )
              }
              onClick={
                handleRefresh
              }
            >
              Refresh
            </Button>

            <Button
              variant="success"
              leftIcon={
                <FiDownload
                  aria-hidden="true"
                />
              }
              loading={
                isExporting
              }
              disabled={
                currentViewLoading ||
                currentViewRefreshing ||
                isExporting
              }
              onClick={
                isMovementView
                  ? handleExportMovementPDF
                  : handleExportPDF
              }
            >
              Export PDF
            </Button>
          </>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          role="tablist"
          aria-label="Deployment views"
          className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={
              activeView ===
              DEPLOYMENT_VIEW.RECORDS
            }
            onClick={() =>
              setActiveView(
                DEPLOYMENT_VIEW.RECORDS
              )
            }
            className={[
              "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
              activeView ===
              DEPLOYMENT_VIEW.RECORDS
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(
              " "
            )}
          >
            <FiBriefcase
              aria-hidden="true"
            />
            Deployment Records
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={
              activeView ===
              DEPLOYMENT_VIEW.MOVEMENT
            }
            onClick={() =>
              setActiveView(
                DEPLOYMENT_VIEW.MOVEMENT
              )
            }
            className={[
              "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
              activeView ===
              DEPLOYMENT_VIEW.MOVEMENT
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(
              " "
            )}
          >
            <FiActivity
              aria-hidden="true"
            />
            Deployment History
          </button>
        </div>
      </section>

      {fetchError && (
        <ErrorState
          compact
          title={
            isMovementView
              ? "Unable to Load Deployment History"
              : "Unable to Load Deployments"
          }
          message={
            fetchError
          }
          retryLabel="Try Again"
          onRetry={
            handleRefresh
          }
        />
      )}
      {isMovementView ? (
        <DeploymentMovementActivity
          report={
            movementReport
          }
          isLoading={
            movementLoading
          }
          isRefreshing={
            movementRefreshing
          }
          isExporting={
            isExporting
          }
          monthOptions={
            monthOptions
          }
          selectedMonth={
            movementMonth
          }
          onMonthChange={
            setMovementMonth
          }
          yearOptions={
            movementYearOptions
          }
          selectedYear={
            movementYear
          }
          onYearChange={
            setMovementYear
          }
          isHRCoordinator={
            isHRCoordinator
          }
          assignedCompany={
            assignedCompany
          }
        />
      ) : (
        <>
      {isHRCoordinator && (
        <CoordinatorPendingArrivals
          attempts={
            pendingArrivals
          }
          isLoading={
            pendingArrivalsLoading
          }
          isRefreshing={
            pendingArrivalsRefreshing
          }
          assignedCompany={
            assignedCompany
          }
          onConfirmArrival={(
            attempt
          ) =>
            openCoordinatorAction(
              attempt,
              "confirm"
            )
          }
          onNoShow={(
            attempt
          ) =>
            openCoordinatorAction(
              attempt,
              "no-show"
            )
          }
        />
      )}

      {!isLoading && (
        <ClientDeploymentSummary
          summary={
            deploymentSummary
          }
          isHRCoordinator={
            isHRCoordinator
          }
        />
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-5">
            <SearchInput
              label="Search Deployment Records"
              placeholder={
                isHRCoordinator
                  ? "Search employee, status, or deployment ID..."
                  : "Search employee, ID, client company, location, or status..."
              }
              value={search}
              disabled={
                isLoading ||
                isRefreshing ||
                isExporting
              }
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
            />
          </div>

          <div className="min-w-0 xl:col-span-3">
            <label
              htmlFor="deployment-status-filter"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Status
            </label>
            <select
              id="deployment-status-filter"
              value={selectedStatus}
              disabled={
                isLoading ||
                isRefreshing ||
                isExporting
              }
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setPage(1);
              }}
              className={SELECT_CLASS_NAME}
            >
              {DEPLOYMENT_STATUS_OPTIONS.map((statusOption) => (
                <option
                  key={`${statusOption.label}-${statusOption.value}`}
                  value={statusOption.value}
                >
                  {statusOption.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 xl:col-span-2">
            <label
              htmlFor="deployment-month-filter"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Month
            </label>
            <div className="relative">
              <FiCalendar
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"
              />
              <select
                id="deployment-month-filter"
                value={selectedMonth}
                disabled={
                  isLoading ||
                  isRefreshing ||
                  isExporting
                }
                onChange={(event) => {
                  setSelectedMonth(event.target.value);
                  setPage(1);
                }}
                className={`${SELECT_CLASS_NAME} pl-10`}
              >
                {monthOptions.map((month) => (
                  <option
                    key={`${month.label}-${month.value}`}
                    value={month.value}
                  >
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-w-0 xl:col-span-2">
            <label
              htmlFor="deployment-year-filter"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Year
            </label>
            <select
              id="deployment-year-filter"
              value={selectedYear}
              disabled={
                isLoading ||
                isRefreshing ||
                isExporting
              }
              onChange={(event) => {
                setSelectedYear(event.target.value);
                setPage(1);
              }}
              className={SELECT_CLASS_NAME}
            >
              {yearOptions.map((year) => (
                <option
                  key={`${year.label}-${year.value}`}
                  value={year.value}
                >
                  {year.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {pagination.total}
            </span>
            <span>
              {pagination.total === 1
                ? "deployment record"
                : "deployment records"}{" "}
              shown
            </span>
            {debouncedSearch !== search.trim() && (
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
              isLoading ||
              isRefreshing
            }
            onClick={handleResetFilters}
          >
            Clear Filters
          </Button>
        </div>
      </section>
      {isLoading ? (
        <LoadingSkeleton
          rows={6}
          columns={8}
          showHeader
        />
      ) : visibleDeployments
          .length > 0 ? (
        <DeploymentTable
          deployments={
            visibleDeployments
          }
          openView={
            openView
          }
          onUpdateRow={
            handleInlineUpdateRow
          }
          isSuperAdmin={
            isSuperAdmin
          }
          isReadOnly={
            isHRCoordinator
          }
          isHrCoordinator={
            isHRCoordinator
          }
        />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <EmptyState
            icon={
              hasActiveFilters
                ? "search"
                : "records"
            }
            title={
              hasActiveFilters
                ? "No deployments matched"
                : "No deployment records"
            }
            description={
              hasActiveFilters
                ? "No deployment records matched the current search and filters."
                : isHRCoordinator
                  ? "No deployment records are currently available for your assigned company."
                  : "Deployment records will appear once employees are assigned."
            }
            secondaryActionLabel={
              hasActiveFilters
                ? "Clear filters"
                : ""
            }
            onSecondaryAction={
              hasActiveFilters
                ? handleResetFilters
                : undefined
            }
          />
        </section>
      )}
      {!isLoading &&
        pagination.totalPages >
          1 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total} deployment{" "}
            {pagination.total === 1 ? "record" : "records"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={
                isLoading ||
                isRefreshing ||
                page <= 1
              }
              onClick={() =>
                setPage(
                  (
                    currentPage
                  ) =>
                    Math.max(
                      1,
                      currentPage -
                        1
                    )
                )
              }
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={
                isLoading ||
                isRefreshing ||
                page >=
                  pagination.totalPages
              }
              onClick={() =>
                setPage(
                  (
                    currentPage
                  ) =>
                    Math.min(
                      pagination.totalPages,
                      currentPage +
                        1
                    )
                )
              }
            >
              Next
            </Button>
          </div>
        </section>
      )}
        </>
      )}

      {isHRCoordinator &&
        coordinatorActionTarget && (
        <CoordinatorDeploymentActionModal
          attempt={
            coordinatorActionTarget
          }
          mode={
            coordinatorActionMode
          }
          actualArrivalDate={
            coordinatorActionDate
          }
          onActualArrivalDateChange={
            setCoordinatorActionDate
          }
          remarks={
            coordinatorActionRemarks
          }
          onRemarksChange={
            setCoordinatorActionRemarks
          }
          error={
            coordinatorActionError
          }
          submitting={
            coordinatorActionSubmitting
          }
          onClose={
            closeCoordinatorAction
          }
          onSubmit={
            submitCoordinatorAction
          }
        />
      )}

      {selectedDeployment && (
        <DeploymentModal
          deployment={
            selectedDeployment
          }
          mode="view"
          close={
            closeDeploymentModal
          }
        />
      )}
      <DeploymentToast
        show={
          Boolean(
            toastMessage
          )
        }
        title={
          toastTitle
        }
        message={
          toastMessage
        }
        onClose={
          handleCloseToast
        }
      />
    </main>
  );
}
function CoordinatorPendingArrivals({
  attempts = [],
  isLoading = false,
  isRefreshing = false,
  assignedCompany = "",
  onConfirmArrival,
  onNoShow,
}) {
  const normalizedAttempts =
    Array.isArray(
      attempts
    )
      ? attempts
      : [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <FiClock
              size={15}
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Pending Deployment Arrivals
            </h2>

            <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {assignedCompany
                ? `Employees expected to arrive at ${assignedCompany}.`
                : "Employees expected to arrive at your assigned client company."}
            </p>
          </div>
        </div>

        {!isLoading && (
          <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
            {normalizedAttempts.length} pending
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="px-4 py-3">
          <LoadingSkeleton
            rows={2}
            columns={5}
            showHeader
          />
        </div>
      ) : normalizedAttempts.length >
        0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2.5 font-semibold">
                  Employee
                </th>

                <th className="px-3 py-2.5 font-semibold">
                  Position
                </th>

                <th className="px-3 py-2.5 font-semibold">
                  Expected Arrival Date
                </th>

                <th className="px-3 py-2.5 font-semibold">
                  Expected Arrival Time
                </th>

                <th className="px-3 py-2.5 font-semibold">
                  HR Staff Remarks
                </th>

                <th className="px-4 py-2.5 text-right font-semibold">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {normalizedAttempts.map(
                (attempt) => {
                  const attemptId =
                    attempt?.attemptId ||
                    attempt?.id;

                  return (
                    <tr
                      key={
                        attemptId
                      }
                      className="text-slate-700 hover:bg-slate-50/70 dark:text-slate-200 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {attempt?.employeeName ||
                            "Unknown Employee"}
                        </p>

                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          Employee ID: {attempt?.employeeId ||
                            "-"}
                        </p>
                      </td>

                      <td className="px-3 py-2.5">
                        {attempt?.position ||
                          "-"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold">
                        {formatReportDate(
                          attempt?.scheduledDate
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                          <FiClock
                            size={13}
                            aria-hidden="true"
                          />
                          {formatReportTime(
                            attempt?.scheduledTime ??
                            attempt?.scheduled_time
                          ) ||
                            "Time not set"}
                        </span>
                      </td>

                      <td className="max-w-[250px] px-3 py-2.5">
                        <p
                          className="line-clamp-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300"
                          title={
                            attempt?.remarks ||
                            ""
                          }
                        >
                          {attempt?.remarks ||
                            "—"}
                        </p>
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            leftIcon={
                              <FiCheckCircle
                                aria-hidden="true"
                              />
                            }
                            disabled={
                              isRefreshing
                            }
                            onClick={() =>
                              onConfirmArrival?.(
                                attempt
                              )
                            }
                          >
                            Confirm Arrival
                          </Button>

                          <Button
                            variant="warning"
                            size="sm"
                            leftIcon={
                              <FiXCircle
                                aria-hidden="true"
                              />
                            }
                            disabled={
                              isRefreshing
                            }
                            onClick={() =>
                              onNoShow?.(
                                attempt
                              )
                            }
                          >
                            No Show
                          </Button>
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
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <FiCheckCircle
              size={15}
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              No pending arrivals
            </p>

            <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {assignedCompany
                ? `No employees are currently expected to arrive at ${assignedCompany}.`
                : "No employees are currently expected to arrive at your assigned client company."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function CoordinatorDeploymentActionModal({
  attempt,
  mode,
  actualArrivalDate,
  onActualArrivalDateChange,
  remarks,
  onRemarksChange,
  error = "",
  submitting = false,
  onClose,
  onSubmit,
}) {
  if (!attempt) {
    return null;
  }

  const isConfirm =
    mode ===
    "confirm";

  const today =
    getPhilippinesTodayISO();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !submitting
        ) {
          onClose?.();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="coordinator-deployment-action-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                isConfirm
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
              ].join(
                " "
              )}
            >
              {isConfirm ? (
                <FiCheckCircle
                  aria-hidden="true"
                />
              ) : (
                <FiXCircle
                  aria-hidden="true"
                />
              )}
            </span>

            <div className="min-w-0">
              <h2
                id="coordinator-deployment-action-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                {isConfirm
                  ? "Confirm Employee Arrival"
                  : "Mark as No Show"}
              </h2>

              <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {isConfirm
                  ? "Confirm that the employee arrived at the assigned client site."
                  : "Record that the employee did not arrive for the scheduled deployment."}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            title="Close"
            disabled={
              submitting
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

        <div className="space-y-4 p-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950/40">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Employee
              </p>

              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {attempt?.employeeName ||
                  "Unknown Employee"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Position
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {attempt?.position ||
                  "-"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Client Company
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {attempt?.company ||
                  "-"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Expected Arrival
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {formatReportDate(
                  attempt?.scheduledDate
                )}
              </p>

              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                <FiClock
                  size={13}
                  aria-hidden="true"
                />
                {formatReportTime(
                  attempt?.scheduledTime ??
                  attempt?.scheduled_time
                ) ||
                  "Time not set"}
              </p>
            </div>
          </div>

          {attempt?.remarks && (
            <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                HR HR Staff Remarks
              </p>

              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
                {attempt.remarks}
              </p>
            </div>
          )}

          {isConfirm && (
            <div>
              <label
                htmlFor="coordinator-actual-arrival-date"
                className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Actual Arrival Date
              </label>

              <div className="relative max-w-sm">
                <FiCalendar
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="coordinator-actual-arrival-date"
                  type="date"
                  max={
                    today
                  }
                  value={
                    actualArrivalDate
                  }
                  disabled={
                    submitting
                  }
                  onChange={(
                    event
                  ) =>
                    onActualArrivalDateChange?.(
                      event.target
                        .value
                    )
                  }
                  className={`${SELECT_CLASS_NAME} pl-10`}
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="coordinator-action-remarks"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Remarks (Optional)
            </label>

            <textarea
              id="coordinator-action-remarks"
              rows={3}
              maxLength={2000}
              value={
                remarks
              }
              disabled={
                submitting
              }
              placeholder={
                isConfirm
                  ? "Add an optional arrival note..."
                  : "Add an optional No Show note..."
              }
              onChange={(
                event
              ) =>
                onRemarksChange?.(
                  event.target
                    .value
                )
              }
              className={`${SELECT_CLASS_NAME} min-h-[92px] resize-y`}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
            <Button
              variant="secondary"
              disabled={
                submitting
              }
              onClick={
                onClose
              }
            >
              Cancel
            </Button>

            <Button
              variant={
                isConfirm
                  ? "success"
                  : "warning"
              }
              leftIcon={
                isConfirm ? (
                  <FiCheckCircle
                    aria-hidden="true"
                  />
                ) : (
                  <FiXCircle
                    aria-hidden="true"
                  />
                )
              }
              loading={
                submitting
              }
              disabled={
                submitting ||
                (
                  isConfirm &&
                  !actualArrivalDate
                )
              }
              onClick={
                onSubmit
              }
            >
              {isConfirm
                ? "Confirm Arrival"
                : "Record No Show"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DeploymentMovementActivity({
  report,
  isLoading = false,
  isRefreshing = false,
  isExporting = false,
  monthOptions = [],
  selectedMonth = "",
  onMonthChange,
  yearOptions = [],
  selectedYear,
  onYearChange,
  isHRCoordinator = false,
  assignedCompany = "",
}) {
  const summary =
    report?.summary ||
    {};

  const summaryItems =
    getMovementSummaryItems(
      summary
    );

  const companies =
    Array.isArray(
      report?.companies
    )
      ? report.companies
      : [];

  const events =
    Array.isArray(
      report?.events
    )
      ? report.events
      : [];

  const overallTotal =
    report?.overallTotal ||
    {};

  const periodLabel =
    report?.filters
      ?.periodLabel ||
    getReportingPeriodLabel(
      selectedMonth,
      selectedYear
    );

  const controlsDisabled =
    isLoading ||
    isRefreshing ||
    isExporting;

  return (
    <section
      role="tabpanel"
      aria-label="Deployment history"
      className="space-y-4"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <FiActivity
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Deployment History
                </h2>

                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {isHRCoordinator
                    ? assignedCompany
                      ? `Deployment history for ${assignedCompany}.`
                      : "Deployment history for your assigned company."
                    : "Deployment schedules, arrival outcomes, and separation history across client companies."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[430px]">
            <div>
              <label
                htmlFor="movement-month-filter"
                className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Month
              </label>

              <div className="relative">
                <FiCalendar
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"
                />

                <select
                  id="movement-month-filter"
                  value={
                    selectedMonth
                  }
                  disabled={
                    controlsDisabled
                  }
                  onChange={(
                    event
                  ) =>
                    onMonthChange?.(
                      event.target
                        .value
                    )
                  }
                  className={`${SELECT_CLASS_NAME} pl-10`}
                >
                  {monthOptions.map(
                    (month) => (
                      <option
                        key={`${month.label}-${month.value}`}
                        value={
                          month.value
                        }
                      >
                        {month.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="movement-year-filter"
                className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Year
              </label>

              <select
                id="movement-year-filter"
                value={
                  selectedYear
                }
                disabled={
                  controlsDisabled
                }
                onChange={(
                  event
                ) =>
                  onYearChange?.(
                    event.target
                      .value
                  )
                }
                className={
                  SELECT_CLASS_NAME
                }
              >
                {yearOptions.map(
                  (year) => (
                    <option
                      key={`${year.label}-${year.value}`}
                      value={
                        year.value
                      }
                    >
                      {year.label}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {periodLabel}
          </span>

          <span>
            {Number(
              summary.totalEvents ||
              events.length ||
              0
            )}{" "}
            activity{" "}
            {Number(
              summary.totalEvents ||
              events.length ||
              0
            ) === 1
              ? "record"
              : "records"}
          </span>

          {isRefreshing && (
            <span>
              Updating history...
            </span>
          )}
        </div>
      </section>

      {isLoading ? (
        <LoadingSkeleton
          rows={6}
          columns={8}
          showHeader
        />
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                History Summary
              </h3>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Overall deployment history counts for {periodLabel}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <MovementSummaryCard
                label="Total Activity"
                value={
                  Number(
                    summary.totalEvents ||
                    events.length ||
                    0
                  )
                }
                tone="slate"
              />

              {summaryItems.map(
                (item) => (
                  <MovementSummaryCard
                    key={
                      item.key
                    }
                    label={
                      item.label
                    }
                    value={
                      item.value
                    }
                    tone={
                      item.tone
                    }
                  />
                )
              )}
            </div>
          </section>

          {!isHRCoordinator &&
            companies.length >
              0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Client Client Company Summary
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Deployment history totals by client company.
                </p>
              </div>

              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[1120px] text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">
                        Client Company
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Total
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Scheduled
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Deployed
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        No Show
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Withdrawn
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Resigned
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Terminated
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        AWOL
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold">
                        Other Separation
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                    {companies.map(
                      (company) => (
                        <tr
                          key={
                            company.company
                          }
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                            {company.company ||
                              "Unassigned"}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(
                              company.totalEvents ||
                              0
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(
                              company.scheduled ||
                              0
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(
                              company.successfullyDeployed ||
                              0
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(
                              company.noShow ||
                              0
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(
                              company.withdrawn ||
                              0
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(
                              company.resigned ||
                              0
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(
                              company.terminated ||
                              0
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(
                              company.awol ||
                              0
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {Number(
                              company.otherSeparation ||
                              0
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    <tr className="bg-slate-100 font-bold text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <td className="px-4 py-2.5">
                        OVERALL TOTAL
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.totalEvents ||
                          0
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.scheduled ||
                          0
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.successfullyDeployed ||
                          0
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.noShow ||
                          0
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.withdrawn ||
                          0
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.resigned ||
                          0
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.terminated ||
                          0
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.awol ||
                          0
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {Number(
                          overallTotal.otherSeparation ||
                          0
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Deployment Activity Records
              </h3>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Detailed deployment activity recorded during {periodLabel}.
              </p>
            </div>

            {events.length >
            0 ? (
              <div className="max-h-[560px] overflow-auto">
                <table className={`w-full ${
                  isHRCoordinator
                    ? "min-w-[980px]"
                    : "min-w-[1160px]"
                } text-left text-xs`}>
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">
                        Date / Time
                      </th>
                      <th className="px-4 py-2.5 font-semibold">
                        Employee
                      </th>
                      <th className="px-4 py-2.5 font-semibold">
                        Position
                      </th>

                      {!isHRCoordinator && (
                        <th className="px-4 py-2.5 font-semibold">
                          Client Company
                        </th>
                      )}

                      <th className="px-4 py-2.5 font-semibold">
                        Activity
                      </th>
                      <th className="px-4 py-2.5 font-semibold">
                        Status Change
                      </th>
                      <th className="px-4 py-2.5 font-semibold">
                        Performed By
                      </th>
                      <th className="px-4 py-2.5 font-semibold">
                        Reason
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                    {events.map(
                      (event) => (
                        <tr
                          key={
                            event.id
                          }
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <p>
                              {formatReportDate(
                                event.eventDate
                              )}
                            </p>

                            {formatReportTime(
                              event?.scheduledTime ??
                              event?.scheduled_time
                            ) && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                                <FiClock
                                  size={11}
                                  aria-hidden="true"
                                />
                                {formatReportTime(
                                  event?.scheduledTime ??
                                  event?.scheduled_time
                                )}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {event.employeeName ||
                                "Unknown Employee"}
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                              Employee ID: {event.employeeId ||
                                "-"}
                            </p>
                          </td>

                          <td className="px-4 py-2.5">
                            {event.position ||
                              "-"}
                          </td>

                          {!isHRCoordinator && (
                            <td className="px-4 py-2.5">
                              {event.company ||
                                "Unassigned"}
                            </td>
                          )}

                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${getMovementBadgeClass(
                                event.movement
                              )}`}
                            >
                              {event.movement ||
                                "-"}
                            </span>
                          </td>

                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span>
                                {event.fromStatus ||
                                  "-"}
                              </span>

                              <span
                                aria-hidden="true"
                                className="text-slate-400"
                              >
                                →
                              </span>

                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {event.toStatus ||
                                  "-"}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-800 dark:text-slate-200">
                              {event.performedBy ||
                                "-"}
                            </p>

                            {event.performedByRole && (
                              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                {formatRoleLabel(
                                  event.performedByRole
                                )}
                              </p>
                            )}
                          </td>

                          <td className="max-w-[260px] px-4 py-2.5">
                            <p
                              className="line-clamp-2"
                              title={
                                event.reason ||
                                ""
                              }
                            >
                              {event.reason ||
                                "-"}
                            </p>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <EmptyState
                  icon="records"
                  title="No deployment activity"
                  description={`No deployment activity was recorded for ${periodLabel}.`}
                />
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function MovementSummaryCard({
  label,
  value,
  tone = "slate",
}) {
  const toneStyles = {
    slate:
      "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200",
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
    sky:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300",
    rose:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300",
    orange:
      "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300",
    violet:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300",
  };

  return (
    <div
      className={[
        "flex min-w-[145px] max-w-[180px] flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-2",
        toneStyles[tone] ||
          toneStyles.slate,
      ].join(
        " "
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-75">
        {label}
      </p>

      <p className="text-base font-extrabold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function ClientDeploymentSummary({
  summary,
  isHRCoordinator = false,
}) {
  const [
    showAllCompanies,
    setShowAllCompanies,
  ] =
    useState(false);

  const summaryData =
    useMemo(
      () => ({
        companies:
          Array.isArray(
            summary?.companies
          )
            ? summary.companies
            : [],

        totalDeployments:
          Number(
            summary?.totalDeployments ||
            0
          ),

        totalCompanies:
          Number(
            summary?.totalCompanies ||
            0
          ),
      }),
      [
        summary,
      ]
    );

  const visibleCompanies =
    showAllCompanies
      ? summaryData.companies
      : summaryData.companies.slice(
          0,
          6
        );

  if (
    summaryData.totalDeployments ===
    0
  ) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {isHRCoordinator
                ? "Assigned Client Company Summary"
                : "Client Company Summary"}
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {isHRCoordinator
                ? "Deployment activity and separation history for your assigned client company."
                : `Historical and active deployment records across ${summaryData.totalCompanies} client companies. Showing ${visibleCompanies.length}.`}
            </p>
          </div>

          {!isHRCoordinator &&
            summaryData.companies
              .length >
              6 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setShowAllCompanies(
                    (
                      currentValue
                    ) =>
                      !currentValue
                  )
                }
              >
                {showAllCompanies
                  ? "Show Top 6"
                  : `View All ${summaryData.companies.length}`}
              </Button>
            )}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visibleCompanies.map(
            (
              item,
              index
            ) => (
              <ClientCompanyRow
                key={
                  item.company
                }
                item={
                  item
                }
                rank={
                  index + 1
                }
                totalDeployments={
                  summaryData.totalDeployments
                }
                showRank={
                  !isHRCoordinator
                }
              />
            )
          )}
        </div>
      </div>
    </section>
  );
}

function ClientCompanyRow({
  item,
  rank,
  totalDeployments,
  showRank = true,
}) {
  const total = Number(item?.total || 0);
  const deployed =
    Number(
      item?.deployed ??
      item?.active ??
      0
    );
  const resigned =
    Number(
      item?.resigned ||
      0
    );
  const terminated =
    Number(
      item?.terminated ||
      0
    );
  const awol =
    Number(
      item?.awol ||
      0
    );
  const ended =
    Number(
      item?.ended ||
      0
    );
  const percentage =
    totalDeployments > 0
      ? Math.round((total / totalDeployments) * 100)
      : 0;
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start gap-3">
        {showRank && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            #{rank}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {item.company}
              </h4>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {percentage}% of all deployment records
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {total} records
              </p>
            </div>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-label={`${item.company} deployment percentage`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
          >
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{
                width: `${Math.min(percentage, 100)}%`,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-600 dark:text-emerald-300">
              {deployed} deployed
            </span>

            <span className="font-semibold text-sky-600 dark:text-sky-300">
              {resigned} resigned
            </span>

            <span className="font-semibold text-rose-600 dark:text-rose-300">
              {terminated} terminated
            </span>

            <span className="font-semibold text-amber-600 dark:text-amber-300">
              {awol} AWOL
            </span>

            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {ended} other separation
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}