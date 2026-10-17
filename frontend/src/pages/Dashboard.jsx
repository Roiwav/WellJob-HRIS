import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FiBarChart2,
  FiDownload,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";
import ExecutiveActionItems from "../components/dashboard/insights/ExecutiveActionItems";
import WorkforceHealthBanner from "../components/dashboard/insights/WorkforceHealthBanner";
import ExecutiveInsightTabs from "../components/dashboard/insights/ExecutiveInsightTabs";
import DashboardDrilldownModal from "../components/dashboard/modals/DashboardDrilldownModal";
import EditEmployeeModal from "../components/employees/EditEmployeeModal";
import { buildExecutiveActionItems } from "../utils/dashboard/prescriptiveAnalytics";
import { buildDashboardInsights } from "../utils/dashboard/dashboardInsights";
import authenticatedFetch from "../utils/authenticatedFetch";
import { API_BASE } from "../config/api";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import KPICards from "../components/dashboard/cards/KPICards";
import DeploymentTrendChart from "../components/dashboard/charts/DeploymentTrendChart";
import IncidentTrendChart from "../components/dashboard/charts/IncidentTrendChart";
import SeverityPieChart from "../components/dashboard/charts/SeverityPieChart";
import CaseAgingChart from "../components/dashboard/charts/CaseAgingChart";
const EMPLOYEE_API_URL = `${API_BASE}/employees`;
const DASHBOARD_API_URL = `${API_BASE}/dashboard/overview`;
const DASHBOARD_MONTHLY_WORKFORCE_API_URL =
  `${API_BASE}/dashboard/monthly-workforce`;
const DATA_EVENT_SOURCE = "dashboard-page";
const REQUEST_TIMEOUT_MS = 45 * 1000;
const DATA_UPDATE_DEBOUNCE_MS = 300;

const DASHBOARD_TIME_ZONE =
  "Asia/Manila";

const MILLISECONDS_PER_DAY =
  24 * 60 * 60 * 1000;

const activeRequests = new Map();

function getManilaDateOnly(
  value = new Date()
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          DASHBOARD_TIME_ZONE,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            [
              "year",
              "month",
              "day",
            ].includes(
              part.type
            )
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  if (
    !values.year ||
    !values.month ||
    !values.day
  ) {
    return "";
  }

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

function getManilaCurrentDateParts() {
  const dateOnly =
    getManilaDateOnly();

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dateOnly
    );

  if (!match) {
    return {
      dateOnly: "",
      year: "",
      month: 1,
      day: 1,
    };
  }

  return {
    dateOnly,
    year:
      match[1],
    month:
      Number(
        match[2]
      ),
    day:
      Number(
        match[3]
      ),
  };
}

function businessDateToDayIndex(
  value
) {
  const normalized =
    normalizeDateValue(
      value
    );

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      normalized
    );

  if (!match) {
    return null;
  }

  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );

  const timestamp =
    Date.UTC(
      year,
      month - 1,
      day
    );

  const validationDate =
    new Date(
      timestamp
    );

  if (
    validationDate.getUTCFullYear() !==
      year ||
    validationDate.getUTCMonth() !==
      month - 1 ||
    validationDate.getUTCDate() !==
      day
  ) {
    return null;
  }

  return Math.floor(
    timestamp /
      MILLISECONDS_PER_DAY
  );
}

const monthList = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const FULL_MONTH_LIST = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const FORECAST_RANGES = [
  "weekly",
  "monthly",
  "yearly",
];
const INSIGHT_CARD_TONES = {
  indigo:
    "from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900",
  red:
    "from-red-50 to-white dark:from-red-950/30 dark:to-slate-900",
  amber:
    "from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900",
  emerald:
    "from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900",
};
function emitDataUpdated(
  action = "DASHBOARD_UPDATED"
) {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: DATA_EVENT_SOURCE,
        domain: "dashboard",
        action,
        at: Date.now(),
      },
    })
  );
}
function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
function shouldRefreshDashboardForEvent(
  event
) {
  const domain =
    normalizeText(
      event?.detail?.domain
    ).replace(
      /[_\s]+/g,
      "-"
    );
  if (!domain) {
    return true;
  }
  return (
    domain.startsWith(
      "employee"
    ) ||
    domain.startsWith(
      "incident"
    ) ||
    domain.startsWith(
      "deployment"
    ) ||
    domain.includes(
      "document"
    ) ||
    domain.includes(
      "compliance"
    )
  );
}
function normalizeStatus(status) {
  const value = normalizeText(status);
  if (
    value === "for_review" ||
    value === "for review"
  ) {
    return "For Review";
  }
  if (
    value === "resolved" ||
    value === "closed"
  ) {
    return "Closed";
  }
  if (value === "investigating") {
    return "Investigating";
  }
  return "Open";
}
function isArchivedEmployee(employee) {
  return (
    employee?.archived === true ||
    Number(employee?.archived) === 1
  );
}
function parseDocuments(documents) {
  if (Array.isArray(documents)) {
    return documents;
  }
  if (typeof documents !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(documents);
    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}
function normalizeBackendEmployee(
  employee = {}
) {
  const employeeId =
    employee.id ||
    employee.employeeId ||
    employee.employee_id ||
    "";
  return {
    ...employee,
    id: employeeId,
    employeeId,
    name:
      employee.name ||
      employee.full_name ||
      employee.fullName ||
      "Unknown Employee",
    company:
      employee.company ||
      employee.clientCompany ||
      "Unassigned",
    status:
      employee.status ||
      "Unknown",
    employmentType:
      employee.employmentType ||
      employee.employment_type ||
      "",
    contractStart:
      employee.contractStart ||
      employee.contract_start ||
      null,
    contractEnd:
      employee.contractEnd ||
      employee.contract_end ||
      null,
    createdAt:
      employee.createdAt ||
      employee.created_at ||
      null,
    archived:
      isArchivedEmployee(employee),
    documents:
      parseDocuments(
        employee.documents
      ),
  };
}
function normalizeBackendIncident(
  incident = {}
) {
  const date =
    incident.incidentDate ||
    incident.incident_date ||
    incident.date ||
    incident.reportedAt ||
    incident.reported_at ||
    incident.createdAt ||
    incident.created_at ||
    new Date().toISOString();
  return {
    ...incident,
    id: incident.id,
    employeeId:
      incident.employeeId ||
      incident.employee_id ||
      incident.empId ||
      incident.employeeID ||
      "",
    employee:
      incident.employee ||
      incident.employeeName ||
      incident.employee_name ||
      "Unknown Employee",
    company:
      incident.company ||
      "",
    violation:
      incident.violation ||
      incident.violationType ||
      incident.violation_type ||
      "No violation type",
    severity:
      incident.severity ||
      "Minor",
    status:
      normalizeStatus(
        incident.status ||
          "Open"
      ),
    date,
    reportedAt:
      incident.reportedAt ||
      incident.reported_at ||
      date,
    createdAt:
      incident.createdAt ||
      incident.created_at ||
      date,
  };
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
      await authenticatedFetch(url, {
        ...options,
        signal:
          controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });

    const data =
      await response
        .json()
        .catch(() => null);

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
          "You do not have permission to view this dashboard information."
        );
      }

      if (
        response.status ===
        503
      ) {
        throw new Error(
          "The system is currently under maintenance. Please try again later."
        );
      }

      throw new Error(
        "Unable to load the requested dashboard information. Please try again."
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
function getSharedRequest(url) {
  if (!activeRequests.has(url)) {
    const requestPromise =
      requestJson(url).finally(() => {
        activeRequests.delete(url);
      });
    activeRequests.set(
      url,
      requestPromise
    );
  }
  return activeRequests.get(url);
}
function normalizeDateValue(value) {
  if (!value) {
    return "";
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalized =
      value.trim();

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        normalized
      )
    ) {
      return normalized;
    }

    /*
     * Business-date compatibility:
     * preserve the stored calendar date for legacy
     * timezone-less MySQL DATETIME strings instead
     * of applying an unverified timezone shift.
     */
    if (
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(
        normalized
      )
    ) {
      return normalized.slice(
        0,
        10
      );
    }
  }

  return getManilaDateOnly(
    value
  );
}
function getRecordDate(record) {
  return (
    record?.incidentDate ||
    record?.incident_date ||
    record?.date ||
    record?.reportedAt ||
    record?.reported_at ||
    record?.createdAt ||
    record?.created_at ||
    ""
  );
}
function isInSelectedDashboardRange(
  value,
  selectedYear,
  selectedMonth
) {
  const dateValue =
    normalizeDateValue(value);
  if (!dateValue) {
    return false;
  }
  const recordYear =
    dateValue.slice(0, 4);
  const recordMonth =
    dateValue.slice(5, 7);
  if (
    recordYear !==
    String(selectedYear)
  ) {
    return false;
  }
  if (
    Number(selectedMonth) > 0
  ) {
    return (
      recordMonth ===
      String(
        selectedMonth
      ).padStart(2, "0")
    );
  }
  return true;
}
function aggregateByMonth(
  dataset = [],
  key,
  year,
  isCurrentYear
) {
  const currentMonthIndex =
    Math.max(
      0,
      getManilaCurrentDateParts()
        .month - 1
    );
  return monthList
    .map((month, index) => {
      const monthNumber =
        String(index + 1).padStart(
          2,
          "0"
        );
      const total =
        dataset.reduce(
          (sum, item) => {
            const itemDate =
              normalizeDateValue(
                item?.date
              );
            if (
              !itemDate ||
              !itemDate.startsWith(
                String(year)
              ) ||
              itemDate.slice(5, 7) !==
                monthNumber
            ) {
              return sum;
            }
            return (
              sum +
              (Number(
                item?.[key]
              ) || 0)
            );
          },
          0
        );
      return {
        label: month,
        value: total,
        index,
      };
    })
    .filter(
      (item) =>
        !isCurrentYear ||
        item.index <=
          currentMonthIndex
    );
}
function buildMultiYearMonthlyTrend({
  source = [],
  valueKey,
  years = [],
  selectedYear,
  currentYear,
  currentMonth,
}) {
  const selectedIsCurrentYear =
    String(selectedYear) ===
    String(currentYear);
  const visibleMonthLimit =
    selectedIsCurrentYear
      ? Math.max(
          1,
          Number(currentMonth) || 1
        )
      : 12;
  return monthList
    .slice(0, visibleMonthLimit)
    .map((month, index) => {
      const monthNumber =
        String(index + 1).padStart(
          2,
          "0"
        );
      const row = {
        label: month,
      };
      years.forEach((year) => {
        row[String(year)] =
          source.reduce(
            (sum, item) => {
              const itemDate =
                normalizeDateValue(
                  item?.date
                );
              if (
                itemDate &&
                itemDate.slice(0, 4) ===
                  String(year) &&
                itemDate.slice(5, 7) ===
                  monthNumber
              ) {
                return (
                  sum +
                  (Number(
                    item?.[valueKey]
                  ) || 0)
                );
              }
              return sum;
            },
            0
          );
      });
      return row;
    });
}
function formatLastUpdated(
  value = new Date()
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        DASHBOARD_TIME_ZONE,
      year:
        "numeric",
      month:
        "long",
      day:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
      hour12:
        true,
    }
  ).format(
    date
  );
}
function getCaseAgeInDays(
  dateString
) {
  if (!dateString) {
    return null;
  }

  const incidentDayIndex =
    businessDateToDayIndex(
      dateString
    );

  const todayDayIndex =
    businessDateToDayIndex(
      getManilaCurrentDateParts()
        .dateOnly
    );

  if (
    incidentDayIndex ===
      null ||
    todayDayIndex ===
      null
  ) {
    return null;
  }

  return (
    todayDayIndex -
    incidentDayIndex
  );
}
function isActiveIncident(status) {
  return [
    "Open",
    "Investigating",
    "For Review",
  ].includes(
    normalizeStatus(status)
  );
}
function buildSeverityDistribution(
  incidents = []
) {
  const severityMap = {
    Minor: 0,
    Major: 0,
    Critical: 0,
  };
  incidents.forEach(
    (incident) => {
      const severity =
        incident.severity ||
        "Minor";
      if (
        severityMap[severity] !==
        undefined
      ) {
        severityMap[severity] +=
          1;
      }
    }
  );
  return Object.entries(
    severityMap
  ).map(([name, value]) => ({
    name,
    value,
  }));
}
function buildCaseAgingDistribution(
  incidents = []
) {
  const agingBuckets = {
    "0-7 Days": 0,
    "8-30 Days": 0,
    "30+ Days": 0,
  };
  incidents.forEach(
    (incident) => {
      if (
        !isActiveIncident(
          incident.status
        )
      ) {
        return;
      }
      const age =
        getCaseAgeInDays(
          getRecordDate(incident)
        );
      if (age === null) {
        return;
      }
      if (age <= 7) {
        agingBuckets[
          "0-7 Days"
        ] += 1;
      } else if (age <= 30) {
        agingBuckets[
          "8-30 Days"
        ] += 1;
      } else {
        agingBuckets[
          "30+ Days"
        ] += 1;
      }
    }
  );
  return Object.entries(
    agingBuckets
  ).map(([name, value]) => ({
    name,
    value,
  }));
}
function normalizeMonthlyWorkforceBucket(
  value = {}
) {
  return {
    totalEmployees:
      Number(
        value?.totalEmployees
      ) || 0,
    deployed:
      Number(
        value?.deployed
      ) || 0,
    forDeployment:
      Number(
        value?.forDeployment
      ) || 0,
    floatingStandby:
      Number(
        value?.floatingStandby
      ) || 0,
    resigned:
      Number(
        value?.resigned
      ) || 0,
    terminated:
      Number(
        value?.terminated
      ) || 0,
    awol:
      Number(
        value?.awol
      ) || 0,
    otherSeparation:
      Number(
        value?.otherSeparation
      ) || 0,
  };
}

function normalizeMonthlyWorkforceReport(
  payload = {}
) {
  const overall =
    normalizeMonthlyWorkforceBucket(
      payload?.overall ||
        payload?.summary
    );

  const companies =
    Array.isArray(
      payload?.companies
    )
      ? payload.companies.map(
          (company) => ({
            company:
              String(
                company?.company ||
                  "Unassigned"
              ).trim() ||
              "Unassigned",
            ...normalizeMonthlyWorkforceBucket(
              company
            ),
          })
        )
      : [];

  return {
    overall,
    companies,
    overallTotal:
      normalizeMonthlyWorkforceBucket(
        payload?.overallTotal ||
          overall
      ),
    filters:
      payload?.filters || {},
    filterMeta: {
      years:
        Array.isArray(
          payload?.filterMeta?.years
        )
          ? payload.filterMeta.years
              .map(
                (year) =>
                  Number(
                    year
                  )
              )
              .filter(
                Number.isInteger
              )
          : [],
    },
    meta: {
      generatedAt:
        payload?.meta
          ?.generatedAt ||
        new Date()
          .toISOString(),
      totalsMatch:
        payload?.meta
          ?.totalsMatch !==
        false,
    },
  };
}

function getMonthlyWorkforcePeriodLabel(
  selectedMonth,
  selectedYear
) {
  const monthIndex =
    Number(
      selectedMonth
    ) - 1;

  const monthLabel =
    FULL_MONTH_LIST[
      monthIndex
    ] ||
    "Selected Month";

  return `${monthLabel} ${selectedYear}`;
}

function getDashboardUserDisplayName(
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
    "Authorized User"
  );
}

function formatReportGeneratedAt(
  value
) {
  if (!value) {
    return formatLastUpdated();
  }

  let date = null;

  if (
    value instanceof Date
  ) {
    date = value;
  } else if (
    typeof value ===
      "number"
  ) {
    const milliseconds =
      value <
      100000000000
        ? value * 1000
        : value;

    date =
      new Date(
        milliseconds
      );
  } else {
    const normalized =
      String(
        value
      ).trim();

    if (
      /^\d{10,13}$/.test(
        normalized
      )
    ) {
      const numericValue =
        Number(
          normalized
        );

      const milliseconds =
        numericValue <
        100000000000
          ? numericValue * 1000
          : numericValue;

      date =
        new Date(
          milliseconds
        );
    } else {
      const timezoneLessMatch =
        normalized.match(
          /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?$/
        );

      if (
        timezoneLessMatch
      ) {
        const millisecondsPart =
          timezoneLessMatch[3]
            ? `.${timezoneLessMatch[3].padEnd(
                3,
                "0"
              )}`
            : "";

        date =
          new Date(
            `${timezoneLessMatch[1]}T${timezoneLessMatch[2]}${millisecondsPart}+08:00`
          );
      } else {
        date =
          new Date(
            normalized
          );
      }
    }
  }

  if (
    !date ||
    Number.isNaN(
      date.getTime()
    )
  ) {
    return formatLastUpdated();
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        DASHBOARD_TIME_ZONE,
      year:
        "numeric",
      month:
        "long",
      day:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
      hour12:
        true,
    }
  ).format(
    date
  );
}

function MonthlyWorkforceSummary({
  report,
  loading = false,
  error = "",
  selectedMonth,
  selectedYear,
}) {
  const overall =
    report?.overall ||
    normalizeMonthlyWorkforceBucket();

  const companies =
    Array.isArray(
      report?.companies
    )
      ? report.companies
      : [];

  const overallTotal =
    report?.overallTotal ||
    overall;

  const periodLabel =
    getMonthlyWorkforcePeriodLabel(
      selectedMonth,
      selectedYear
    );

  const summaryItems = [
    {
      label:
        "Total Employees",
      value:
        overall.totalEmployees,
      tone:
        "slate",
    },
    {
      label:
        "Deployed",
      value:
        overall.deployed,
      tone:
        "emerald",
    },
    {
      label:
        "For Deployment",
      value:
        overall.forDeployment,
      tone:
        "indigo",
    },
    {
      label:
        "Floating / Standby",
      value:
        overall.floatingStandby,
      tone:
        "amber",
    },
    {
      label:
        "Resigned",
      value:
        overall.resigned,
      tone:
        "sky",
    },
    {
      label:
        "Terminated",
      value:
        overall.terminated,
      tone:
        "rose",
    },
    {
      label:
        "AWOL",
      value:
        overall.awol,
      tone:
        "orange",
    },
    {
      label:
        "Other Separation",
      value:
        overall.otherSeparation,
      tone:
        "violet",
    },
  ];

  const toneClasses = {
    slate:
      "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40",
    emerald:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10",
    indigo:
      "border-indigo-200 bg-indigo-50 dark:border-indigo-500/25 dark:bg-indigo-500/10",
    amber:
      "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10",
    sky:
      "border-sky-200 bg-sky-50 dark:border-sky-500/25 dark:bg-sky-500/10",
    rose:
      "border-rose-200 bg-rose-50 dark:border-rose-500/25 dark:bg-rose-500/10",
    orange:
      "border-orange-200 bg-orange-50 dark:border-orange-500/25 dark:bg-orange-500/10",
    violet:
      "border-violet-200 bg-violet-50 dark:border-violet-500/25 dark:bg-violet-500/10",
  };

  return (
    <section
      aria-labelledby="monthly-workforce-summary-title"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="monthly-workforce-summary-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Monthly Workforce Summary
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Overall workforce counts by client company for {periodLabel}.
            </p>
          </div>

          <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            Month-End Snapshot
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 xl:grid-cols-8 sm:p-6">
          {Array.from({
            length:
              8,
          }).map(
            (
              _,
              index
            ) => (
              <div
                key={
                  index
                }
                className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
              />
            )
          )}
        </div>
      ) : error ? (
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
            {error}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 xl:grid-cols-8 sm:p-6">
            {summaryItems.map(
              (item) => (
                <article
                  key={
                    item.label
                  }
                  className={`min-w-0 rounded-xl border px-3 py-3 ${toneClasses[
                    item.tone
                  ]}`}
                >
                  <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {
                      item.label
                    }
                  </p>

                  <p className="mt-1.5 text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {
                      item.value
                    }
                  </p>
                </article>
              )
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col gap-1 px-5 py-4 sm:px-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Client Company Summary
              </h3>

              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Workforce totals for each client company in the selected period.
              </p>
            </div>

            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:bg-slate-800 dark:text-slate-300 dark:shadow-[0_1px_0_0_rgba(51,65,85,1)]">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide">
                      Client Company
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                      Deployed
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                      For Deployment
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                      Floating / Standby
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                      Resigned
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                      Terminated
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                      AWOL
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                      Other Separation
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                  {companies.length >
                  0 ? (
                    companies.map(
                      (
                        company
                      ) => (
                        <tr
                          key={
                            company.company
                          }
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                            {
                              company.company
                            }
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {
                              company.totalEmployees
                            }
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {
                              company.deployed
                            }
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {
                              company.forDeployment
                            }
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {
                              company.floatingStandby
                            }
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {
                              company.resigned
                            }
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {
                              company.terminated
                            }
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {
                              company.awol
                            }
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {
                              company.otherSeparation
                            }
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan={
                          9
                        }
                        className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        No workforce records are available for {periodLabel}.
                      </td>
                    </tr>
                  )}
                </tbody>

                {companies.length >
                  0 && (
                  <tfoot className="sticky bottom-0 bg-slate-100 font-bold text-slate-900 shadow-[0_-1px_0_0_rgba(226,232,240,1)] dark:bg-slate-800 dark:text-slate-100 dark:shadow-[0_-1px_0_0_rgba(51,65,85,1)]">
                    <tr>
                      <td className="px-4 py-3">
                        OVERALL TOTAL
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {
                          overallTotal.totalEmployees
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {
                          overallTotal.deployed
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {
                          overallTotal.forDeployment
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {
                          overallTotal.floatingStandby
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {
                          overallTotal.resigned
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {
                          overallTotal.terminated
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {
                          overallTotal.awol
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {
                          overallTotal.otherSeparation
                        }
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {!report?.meta
              ?.totalsMatch && (
              <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 sm:px-6">
                Client company totals do not match the overall summary. Please refresh before exporting.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function InsightCard({
  title,
  value,
  tone = "indigo",
}) {
  return (
    <article
      className={[
        "rounded-xl border border-slate-200 bg-gradient-to-br px-4 py-3.5 shadow-sm dark:border-white/10",
        INSIGHT_CARD_TONES[tone] ||
          INSIGHT_CARD_TONES.indigo,
      ].join(" ")}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <h3 className="mt-1.5 text-lg font-extrabold text-slate-900 dark:text-white">
        {value}
      </h3>
    </article>
  );
}
function PredictiveInsightsPanel({
  predictions = {
    weekly: [],
    monthly: [],
    yearly: [],
  },
}) {
  const [
    forecastRange,
    setForecastRange,
  ] = useState("weekly");
  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState(
    "All Categories"
  );
  const categories = [
    "All Categories",
    "I. ABSENCES AND TARDINESS",
    "II. DISORDERLY CONDUCT AND MISBEHAVIOR",
    "III. INSUBORDINATION / DISOBEDIENCE",
    "IV. NEGLECT OF DUTY",
    "V. BETRAYAL OF TRUST / DISHONESTY",
    "VI. HEALTH, SAFETY, SECURITY, AND SANITATION",
    "VII. SEXUAL HARASSMENT",
    "VIII. HABITUAL VIOLATIONS",
  ];
  const basePredictions =
    useMemo(() => {
      return Array.isArray(
        predictions?.[
          forecastRange
        ]
      )
        ? predictions[
            forecastRange
          ]
        : [];
    }, [
      predictions,
      forecastRange,
    ]);
  const activePredictions =
    useMemo(() => {
      return basePredictions.filter(
        (prediction) =>
          selectedCategory ===
            "All Categories" ||
          prediction.category ===
            selectedCategory
      );
    }, [
      basePredictions,
      selectedCategory,
    ]);
  return (
    <section
      aria-labelledby="forecasting-panel-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
            aria-hidden="true"
          >
            <FiTrendingUp size={19} />
          </div>
          <div className="min-w-0">
            <h2
              id="forecasting-panel-title"
              className="text-base font-extrabold text-slate-900 dark:text-white"
            >
              Workforce Forecast &amp; Recommended Actions
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Forecast based on current workforce and incident records.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            aria-label="Filter forecast by violation category"
            value={
              selectedCategory
            }
            onChange={(event) =>
              setSelectedCategory(
                event.target.value
              )
            }
            className="h-9 max-w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:max-w-[320px]"
          >
            {categories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}
          </select>
          <div
            className="flex shrink-0 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
            role="group"
            aria-label="Forecast period"
          >
            {FORECAST_RANGES.map(
              (range) => {
                const isActive =
                  forecastRange ===
                  range;
                return (
                  <button
                    key={range}
                    type="button"
                    aria-pressed={
                      isActive
                    }
                    onClick={() =>
                      setForecastRange(
                        range
                      )
                    }
                    className={[
                      "min-h-8 rounded-lg px-3 py-1.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      isActive
                        ? "bg-white text-indigo-700 shadow-sm dark:bg-indigo-600 dark:text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
                    ].join(" ")}
                  >
                    {range
                      .charAt(0)
                      .toUpperCase() +
                      range.slice(1)}
                  </button>
                );
              }
            )}
          </div>
        </div>
      </div>
      {activePredictions.length ===
      0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/30 sm:flex-row sm:items-center">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            aria-hidden="true"
          >
            <FiBarChart2 size={17} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              No Forecast Alert
            </p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Current records have not reached the level that would trigger a forecast alert for this category and period.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {activePredictions.map(
            (
              prediction,
              index
            ) => {
              const rawAction =
                String(
                  prediction?.action ||
                    ""
                );
              const isForecast =
                rawAction.includes(
                  "Forecast:"
                );
              const actionText =
                rawAction.replace(
                  "Forecast: ",
                  ""
                );
              const caseCount =
                Number(
                  prediction?.count
                ) || 0;
              return (
                <article
                  key={
                    prediction?.id ||
                    `${prediction?.category || "prediction"}-${index}`
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-300">
                        {prediction?.percentage ||
                          "0%"}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Share of Cases
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                      {caseCount}{" "}
                      {caseCount === 1
                        ? "case"
                        : "cases"}
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                    {prediction?.category ||
                      "Uncategorized"}
                  </p>
                  <h3 className="mt-1.5 text-sm font-bold leading-5 text-slate-900 dark:text-white">
                    {prediction?.title ||
                      "Workforce Notice"}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {isForecast && (
                      <span className="font-bold text-indigo-600 dark:text-indigo-300">
                        Forecast:{" "}
                      </span>
                    )}
                    {actionText ||
                      "No suggested action available."}
                  </p>
                </article>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}
export default function Dashboard() {
  const navigate = useNavigate();

  const {
    user,
  } = useAuth();

  const currentDateParts =
    getManilaCurrentDateParts();

  const currentYear =
    currentDateParts.year;

  const currentMonth =
    currentDateParts.month;
  const [
    selectedYear,
    setSelectedYear,
  ] = useState(currentYear);
  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(0);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    refreshing,
    setRefreshing,
  ] = useState(false);
  const [
    lastUpdated,
    setLastUpdated,
  ] = useState("");
  const [
    fetchError,
    setFetchError,
  ] = useState("");
  const [
    monthlyWorkforceLoading,
    setMonthlyWorkforceLoading,
  ] = useState(true);
  const [
    monthlyWorkforceError,
    setMonthlyWorkforceError,
  ] = useState("");
  const [
    monthlyWorkforceReport,
    setMonthlyWorkforceReport,
  ] = useState(() =>
    normalizeMonthlyWorkforceReport()
  );
  const [
    exportingPDF,
    setExportingPDF,
  ] = useState(false);
  const [
    activeDrilldown,
    setActiveDrilldown,
  ] = useState(null);
  const [
    editingEmployee,
    setEditingEmployee,
  ] = useState(null);
  const isLoadingRef =
    useRef(false);
  const monthlyWorkforceRequestIdRef =
    useRef(0);
  const refreshTimerRef =
    useRef(null);
  const isMountedRef =
    useRef(true);
  const [data, setData] =
    useState({
      kpis: {
        total: 0,
        deployed: 0,
        available: 0,
        activeIncidents: 0,
        expiringDocs: 0,
      },
      workforce: [],
      incidents: [],
      rawEmployees: [],
      rawIncidents: [],
    });
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current =
        false;
      if (
        refreshTimerRef.current
      ) {
        window.clearTimeout(
          refreshTimerRef.current
        );
      }
    };
  }, []);
  const loadData = useCallback(
    async ({
      silent = false,
      showError = true,
    } = {}) => {
      if (isLoadingRef.current) {
        return false;
      }
      isLoadingRef.current = true;
      if (!silent) {
        setLoading(true);
      }
      try {
        if (showError) {
          setFetchError("");
        }
        const overview =
          await getSharedRequest(
            DASHBOARD_API_URL
          );
        if (
          !overview ||
          typeof overview !==
            "object"
        ) {
          throw new Error(
            "Dashboard data is unavailable."
          );
        }
        const employeesRaw =
          Array.isArray(
            overview.employees
          )
            ? overview.employees.map(
                normalizeBackendEmployee
              )
            : [];
        const incidentsRaw =
          Array.isArray(
            overview.incidents
          )
            ? overview.incidents.map(
                normalizeBackendIncident
              )
            : [];
        const nonArchivedEmployees =
          employeesRaw.filter(
            (employee) =>
              !employee.archived
          );
        const workforce =
          Array.isArray(
            overview.deploymentTrend
          )
            ? overview.deploymentTrend
                .map((record) => ({
                  date:
                    normalizeDateValue(
                      record?.date
                    ),
                  employees:
                    Number(
                      record?.employees
                    ) || 0,
                }))
                .filter(
                  (item) => item.date
                )
            : [];
        const incidents =
          incidentsRaw
            .map((incident) => ({
              date:
                normalizeDateValue(
                  getRecordDate(
                    incident
                  )
                ),
              incidents: 1,
            }))
            .filter(
              (item) => item.date
            );
        const backendKpis =
          overview.kpis || {};
        if (!isMountedRef.current) {
          return false;
        }
        setData({
          kpis: {
            total:
              Number(
                backendKpis.total
              ) || 0,
            deployed:
              Number(
                backendKpis.deployed
              ) || 0,
            available:
              Number(
                backendKpis.available
              ) || 0,
            activeIncidents:
              Number(
                backendKpis.activeIncidents
              ) || 0,
            expiringDocs:
              Number(
                backendKpis.expiringDocs
              ) || 0,
          },
          workforce,
          incidents,
          rawEmployees:
            nonArchivedEmployees,
          rawIncidents:
            incidentsRaw,
        });
        setLastUpdated(
          formatLastUpdated()
        );
        return true;
      } catch (error) {
        console.error(
          "Dashboard backend fetch error:",
          error
        );
        if (
          showError &&
          isMountedRef.current
        ) {
          setFetchError(
            "Unable to load dashboard information. Please try again."
          );
        }
        return false;
      } finally {
        isLoadingRef.current =
          false;
        if (
          !silent &&
          isMountedRef.current
        ) {
          setLoading(false);
        }
      }
    },
    []
  );
  const loadMonthlyWorkforce =
    useCallback(
      async ({
        silent = false,
        showError = true,
      } = {}) => {
        const requestId =
          monthlyWorkforceRequestIdRef
            .current +
          1;

        monthlyWorkforceRequestIdRef.current =
          requestId;

        if (
          !silent &&
          isMountedRef.current
        ) {
          setMonthlyWorkforceLoading(
            true
          );
        }

        if (
          showError &&
          isMountedRef.current
        ) {
          setMonthlyWorkforceError(
            ""
          );
        }

        try {
          if (
            Number(
              selectedMonth
            ) === 0
          ) {
            if (
              isMountedRef.current &&
              requestId ===
                monthlyWorkforceRequestIdRef
                  .current
            ) {
              setMonthlyWorkforceError(
                ""
              );

              setMonthlyWorkforceLoading(
                false
              );
            }

            return true;
          }

          const params =
            new URLSearchParams({
              month:
                String(
                  Number(
                    selectedMonth
                  ) - 1
                ),
              year:
                String(
                  selectedYear
                ),
            });

          const payload =
            await requestJson(
              `${DASHBOARD_MONTHLY_WORKFORCE_API_URL}?${params.toString()}`
            );

          if (
            !isMountedRef.current ||
            requestId !==
              monthlyWorkforceRequestIdRef
                .current
          ) {
            return false;
          }

          setMonthlyWorkforceReport(
            normalizeMonthlyWorkforceReport(
              payload
            )
          );

          return true;
        } catch (error) {
          console.error(
            "Dashboard monthly workforce fetch error:",
            error
          );

          if (
            showError &&
            isMountedRef.current &&
            requestId ===
              monthlyWorkforceRequestIdRef
                .current
          ) {
            setMonthlyWorkforceError(
              "Unable to load the monthly workforce summary. Please try again."
            );
          }

          return false;
        } finally {
          if (
            isMountedRef.current &&
            requestId ===
              monthlyWorkforceRequestIdRef
                .current
          ) {
            setMonthlyWorkforceLoading(
              false
            );
          }
        }
      },
      [
        selectedMonth,
        selectedYear,
      ]
    );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadMonthlyWorkforce();
  }, [
    loadMonthlyWorkforce,
  ]);
  useEffect(() => {
    const scheduleRefresh = () => {
      if (
        refreshTimerRef.current
      ) {
        window.clearTimeout(
          refreshTimerRef.current
        );
      }
      refreshTimerRef.current =
        window.setTimeout(() => {
          void Promise.all([
            loadData({
              silent: true,
              showError: false,
            }),
            loadMonthlyWorkforce({
              silent: true,
              showError: false,
            }),
          ]);
        }, DATA_UPDATE_DEBOUNCE_MS);
    };
    const handleDataUpdated = (
      event
    ) => {
      if (
        event?.detail?.source ===
          DATA_EVENT_SOURCE ||
        !shouldRefreshDashboardForEvent(
          event
        )
      ) {
        return;
      }
      scheduleRefresh();
    };
    window.addEventListener(
      "dataUpdated",
      handleDataUpdated
    );
    return () => {
      if (
        refreshTimerRef.current
      ) {
        window.clearTimeout(
          refreshTimerRef.current
        );
      }
      window.removeEventListener(
        "dataUpdated",
        handleDataUpdated
      );
    };
  }, [
    loadData,
    loadMonthlyWorkforce,
  ]);
  const handleRefresh =
    useCallback(async () => {
      if (
        refreshing ||
        isLoadingRef.current
      ) {
        return;
      }
      setRefreshing(true);
      try {
        await Promise.all([
          loadData({
            silent: true,
            showError: true,
          }),
          loadMonthlyWorkforce({
            silent: true,
            showError: true,
          }),
        ]);
      } finally {
        if (
          isMountedRef.current
        ) {
          setRefreshing(false);
        }
      }
    }, [
      loadData,
      loadMonthlyWorkforce,
      refreshing,
    ]);
  const isCurrentYear =
    selectedYear ===
    currentYear;
  const availableYears =
    useMemo(() => {
      const years = new Set([
        currentYear,
        String(
          selectedYear
        ),
      ]);

      data.workforce.forEach(
        (item) => {
          if (item?.date) {
            years.add(
              item.date.slice(0, 4)
            );
          }
        }
      );

      data.incidents.forEach(
        (item) => {
          if (item?.date) {
            years.add(
              item.date.slice(0, 4)
            );
          }
        }
      );

      (
        monthlyWorkforceReport
          ?.filterMeta?.years ||
        []
      ).forEach(
        (year) => {
          if (
            Number.isInteger(
              Number(
                year
              )
            )
          ) {
            years.add(
              String(
                year
              )
            );
          }
        }
      );

      return [...years].sort(
        (first, second) =>
          Number(second) -
          Number(first)
      );
    }, [
      data.workforce,
      data.incidents,
      monthlyWorkforceReport,
      currentYear,
      selectedYear,
    ]);
  const availableMonths =
    useMemo(() => {
      return monthList.map(
        (month, index) => {
          const monthNumber =
            index + 1;
          const isFutureMonth =
            selectedYear ===
              currentYear &&
            monthNumber >
              currentMonth;
          return {
            name: month,
            value: monthNumber,
            available:
              !isFutureMonth,
          };
        }
      );
    }, [
      selectedYear,
      currentYear,
      currentMonth,
    ]);
  const handleYearChange =
    useCallback(
      (event) => {
        const nextYear =
          event.target.value;
        const nextMonth =
          nextYear ===
            currentYear &&
          Number(selectedMonth) >
            currentMonth
            ? 0
            : selectedMonth;
        setSelectedYear(nextYear);
        setSelectedMonth(nextMonth);
      },
      [
        currentYear,
        currentMonth,
        selectedMonth,
      ]
    );
  const handleMonthChange =
    useCallback(
      (event) => {
        const nextMonth =
          Number(
            event.target.value
          );
        if (
          selectedYear ===
            currentYear &&
          nextMonth > currentMonth
        ) {
          setSelectedMonth(0);
          return;
        }
        setSelectedMonth(nextMonth);
      },
      [
        selectedYear,
        currentYear,
        currentMonth,
      ]
    );
  const workforceTrend =
    useMemo(
      () =>
        aggregateByMonth(
          data.workforce,
          "employees",
          selectedYear,
          isCurrentYear
        ),
      [
        data.workforce,
        selectedYear,
        isCurrentYear,
      ]
    );
  const incidentTrend =
    useMemo(
      () =>
        aggregateByMonth(
          data.incidents,
          "incidents",
          selectedYear,
          isCurrentYear
        ),
      [
        data.incidents,
        selectedYear,
        isCurrentYear,
      ]
    );
  const comparisonYears =
    useMemo(() => {
      const selected = Number(
        selectedYear
      );
      const availableYearSet =
        new Set(
          availableYears.map(Number)
        );
      return [
        selected - 1,
        selected,
      ].filter(
        (year) =>
          year >= 2024 &&
          availableYearSet.has(year)
      );
    }, [
      selectedYear,
      availableYears,
    ]);
  const deploymentComparisonTrend =
    useMemo(() => {
      return buildMultiYearMonthlyTrend(
        {
          source:
            data.workforce,
          valueKey:
            "employees",
          years:
            comparisonYears,
          selectedYear,
          currentYear,
          currentMonth,
        }
      );
    }, [
      data.workforce,
      comparisonYears,
      selectedYear,
      currentYear,
      currentMonth,
    ]);
  const incidentComparisonTrend =
    useMemo(() => {
      return buildMultiYearMonthlyTrend(
        {
          source:
            data.incidents,
          valueKey:
            "incidents",
          years:
            comparisonYears,
          selectedYear,
          currentYear,
          currentMonth,
        }
      );
    }, [
      data.incidents,
      comparisonYears,
      selectedYear,
      currentYear,
      currentMonth,
    ]);
  const reportScope =
    useMemo(() => {
      const scopedIncidents =
        data.rawIncidents.filter(
          (incident) =>
            isInSelectedDashboardRange(
              getRecordDate(
                incident
              ),
              selectedYear,
              selectedMonth
            )
        );
      return {
        incidents:
          scopedIncidents,
      };
    }, [
      data.rawIncidents,
      selectedYear,
      selectedMonth,
    ]);
  const currentKPIS =
    data.kpis;
  const utilizationRate =
    useMemo(() => {
      const total =
        Number(
          currentKPIS.total
        ) || 0;
      const deployed =
        Number(
          currentKPIS.deployed
        ) || 0;
      if (!total) {
        return 0;
      }
      return Number(
        (
          (deployed / total) *
          100
        ).toFixed(1)
      );
    }, [currentKPIS]);
  const filteredSeverity =
    useMemo(
      () =>
        buildSeverityDistribution(
          reportScope.incidents
        ),
      [reportScope.incidents]
    );
  const filteredAging =
    useMemo(
      () =>
        buildCaseAgingDistribution(
          reportScope.incidents
        ),
      [reportScope.incidents]
    );
  const selectedPeriodLabel =
    getMonthlyWorkforcePeriodLabel(
      selectedMonth,
      selectedYear
    );
  const executiveActions =
    useMemo(() => {
      return buildExecutiveActionItems(
        {
          employees:
            data.rawEmployees,
          incidents:
            data.rawIncidents,
          kpis:
            currentKPIS,
          utilizationRate,
        }
      );
    }, [
      data.rawEmployees,
      data.rawIncidents,
      currentKPIS,
      utilizationRate,
    ]);
  const dashboardInsights =
    useMemo(() => {
      return buildDashboardInsights({
        employees:
          data.rawEmployees,
        incidents:
          data.rawIncidents,
        selectedYear,
        selectedMonth,
        kpis:
          currentKPIS,
        utilizationRate,
      });
    }, [
      data.rawEmployees,
      data.rawIncidents,
      selectedYear,
      selectedMonth,
      currentKPIS,
      utilizationRate,
    ]);
  const kpiTrendData =
    useMemo(
      () => ({
        total: {
          label:
            "Current snapshot",
          direction: "flat",
          tone: "neutral",
        },
        deployed: {
          label:
            "Current deployed",
          direction: "flat",
          tone: "neutral",
        },
        available: {
          label:
            "Current available",
          direction: "flat",
          tone: "neutral",
        },
        utilizationRate: {
          label: `${utilizationRate}% current`,
          direction: "flat",
          tone:
            utilizationRate >= 80
              ? "good"
              : utilizationRate < 60
                ? "bad"
                : "neutral",
        },
        activeIncidents: {
          label:
            "Current active cases",
          direction: "flat",
          tone:
            currentKPIS.activeIncidents >
            0
              ? "bad"
              : "good",
        },
        expiringDocs: {
          label: `${currentKPIS.expiringDocs} due soon`,
          direction:
            currentKPIS.expiringDocs >
            0
              ? "up"
              : "flat",
          tone:
            currentKPIS.expiringDocs >
            0
              ? "bad"
              : "good",
        },
      }),
      [
        currentKPIS,
        utilizationRate,
      ]
    );
  const handleOpenDrilldown =
    useCallback(
      (key) => {
        const disabledKeys = [
          "total",
          "deployed",
          "available",
        ];
        if (
          disabledKeys.includes(
            key
          )
        ) {
          return;
        }
        if (
          key ===
          "activeIncidents"
        ) {
          navigate("/incidents");
          return;
        }
        const detail =
          dashboardInsights
            ?.drilldowns?.[key];
        if (detail) {
          setActiveDrilldown(
            detail
          );
        }
      },
      [
        dashboardInsights,
        navigate,
      ]
    );
  const handleCloseDrilldown =
    useCallback(() => {
      setActiveDrilldown(null);
    }, []);
  const handleCloseEmployeeModal =
    useCallback(() => {
      setEditingEmployee(null);
    }, []);
  const handleRowClick =
    useCallback(
      async (row) => {
        const employeeId =
          row?.employeeId ??
          row?.employee_id;
        if (
          employeeId === null ||
          employeeId === undefined ||
          String(employeeId).trim() ===
            ""
        ) {
          return;
        }
        try {
          setFetchError("");
          const employee =
            await getSharedRequest(
              `${EMPLOYEE_API_URL}/${encodeURIComponent(
                String(employeeId)
              )}`
            );
          if (!isMountedRef.current) {
            return;
          }
          setEditingEmployee(
            normalizeBackendEmployee(
              employee
            )
          );
          setActiveDrilldown(
            null
          );
        } catch (error) {
          console.error(
            "Dashboard employee detail fetch error:",
            error
          );
          if (isMountedRef.current) {
            setFetchError(
              "Unable to load employee details. Please try again."
            );
          }
        }
      },
      []
    );
  const handleEmployeeSaveSuccess =
    useCallback(async () => {
      setEditingEmployee(null);
      await loadData({
        silent: true,
        showError: false,
      });
      emitDataUpdated(
        "DASHBOARD_EMPLOYEE_EDIT"
      );
    }, [loadData]);
  const totalIncidentsForYear =
    useMemo(
      () =>
        incidentTrend.reduce(
          (
            sum,
            item
          ) =>
            sum +
            (
              Number(
                item?.value
              ) ||
              0
            ),
          0
        ),
      [
        incidentTrend,
      ]
    );

  const totalIncidentsForPeriod =
    reportScope.incidents.length;
  const peakDeploymentMonth =
    useMemo(() => {
      if (
        !workforceTrend.length
      ) {
        return "N/A";
      }
      const highest =
        workforceTrend.reduce(
          (currentHighest, item) =>
            Number(item?.value) >
            Number(
              currentHighest?.value
            )
              ? item
              : currentHighest,
          workforceTrend[0]
        );
      return highest?.value
        ? `${highest.label} (${highest.value})`
        : "N/A";
    }, [workforceTrend]);
  const highestIncidentMonth =
    useMemo(() => {
      if (
        !incidentTrend.length
      ) {
        return "N/A";
      }
      const highest =
        incidentTrend.reduce(
          (currentHighest, item) =>
            Number(item?.value) >
            Number(
              currentHighest?.value
            )
              ? item
              : currentHighest,
          incidentTrend[0]
        );
      return highest?.value
        ? `${highest.label} (${highest.value})`
        : "N/A";
    }, [incidentTrend]);
  const topSeverity =
    useMemo(() => {
      if (
        !filteredSeverity.length
      ) {
        return "N/A";
      }
      const highest =
        filteredSeverity.reduce(
          (currentHighest, item) =>
            Number(item?.value) >
            Number(
              currentHighest?.value
            )
              ? item
              : currentHighest,
          filteredSeverity[0]
        );
      return highest?.value
        ? highest.name
        : "N/A";
    }, [filteredSeverity]);
  const handleExportPDF =
    useCallback(() => {
      const hasSpecificMonth =
        Number(
          selectedMonth
        ) > 0;

      if (
        exportingPDF ||
        (
          hasSpecificMonth &&
          monthlyWorkforceLoading
        )
      ) {
        return;
      }

      if (
        hasSpecificMonth &&
        monthlyWorkforceError
      ) {
        setFetchError(
          "Monthly workforce information is unavailable. Refresh the dashboard before exporting."
        );
        return;
      }

      if (
        hasSpecificMonth &&
        !monthlyWorkforceReport
          ?.meta?.totalsMatch
      ) {
        setFetchError(
          "Monthly workforce totals need to be refreshed before exporting."
        );
        return;
      }

      setExportingPDF(
        true
      );

      try {
        if (
          !hasSpecificMonth
        ) {
          const doc =
            new jsPDF();

          doc.setFontSize(
            16
          );

          doc.text(
            "Welljob Solutions & General Services Inc.",
            14,
            18
          );

          doc.setFontSize(
            12
          );

          doc.text(
            "Workforce Operations Dashboard Report",
            14,
            26
          );

          doc.text(
            `Reporting Period: ${selectedPeriodLabel}`,
            14,
            34
          );

          doc.text(
            `Generated: ${
              lastUpdated ||
              formatLastUpdated()
            }`,
            14,
            42
          );

          autoTable(
            doc,
            {
              startY:
                52,
              head: [
                [
                  "Metric",
                  "Value",
                ],
              ],
              body: [
                [
                  "Total Employees",
                  currentKPIS.total,
                ],
                [
                  "Deployed Employees",
                  currentKPIS.deployed,
                ],
                [
                  "Available Workers",
                  currentKPIS.available,
                ],
                [
                  "Utilization Rate",
                  `${utilizationRate}%`,
                ],
                [
                  "Current Active Incidents",
                  currentKPIS.activeIncidents,
                ],
                [
                  "Expiring Documents",
                  currentKPIS.expiringDocs,
                ],
                [
                  "Incident Reports in Scope",
                  totalIncidentsForPeriod,
                ],
                [
                  "Total Year Incidents",
                  totalIncidentsForYear,
                ],
                [
                  "Peak Deployment Activity",
                  peakDeploymentMonth,
                ],
                [
                  "Highest Incident Activity",
                  highestIncidentMonth,
                ],
                [
                  "Most Common Severity in Scope",
                  topSeverity,
                ],
              ],
              theme:
                "grid",
              headStyles: {
                fillColor: [
                  79,
                  70,
                  229,
                ],
              },
            }
          );

          const firstTableFinalY =
            doc.lastAutoTable
              ?.finalY ||
            52;

          autoTable(
            doc,
            {
              startY:
                firstTableFinalY +
                10,
              head: [
                [
                  "Priority",
                  "Type",
                  "Recommendation",
                  "Basis",
                ],
              ],
              body:
                executiveActions.length >
                0
                  ? executiveActions.map(
                      (action) => [
                        action?.priority ||
                          "-",
                        action?.type ||
                          "-",
                        action?.recommendation ||
                          "-",
                        action?.basis ||
                          "-",
                      ]
                    )
                  : [
                      [
                        "-",
                        "No Alert",
                        "No priority action item detected.",
                        "-",
                      ],
                    ],
              theme:
                "grid",
              headStyles: {
                fillColor: [
                  22,
                  163,
                  74,
                ],
              },
              styles: {
                fontSize:
                  8,
              },
              columnStyles: {
                0: {
                  cellWidth:
                    24,
                },
                1: {
                  cellWidth:
                    28,
                },
                2: {
                  cellWidth:
                    78,
                },
                3: {
                  cellWidth:
                    52,
                },
              },
            }
          );

          const secondTableFinalY =
            doc.lastAutoTable
              ?.finalY ||
            firstTableFinalY +
              10;

          autoTable(
            doc,
            {
              startY:
                secondTableFinalY +
                10,
              head: [
                [
                  "Month",
                  "Deployment",
                  "Incidents",
                ],
              ],
              body:
                monthList.map(
                  (month) => {
                    const deployment =
                      workforceTrend.find(
                        (item) =>
                          item.label ===
                          month
                      );

                    const incident =
                      incidentTrend.find(
                        (item) =>
                          item.label ===
                          month
                      );

                    return [
                      month,
                      deployment?.value ??
                        0,
                      incident?.value ??
                        0,
                    ];
                  }
                ),
              theme:
                "striped",
              headStyles: {
                fillColor: [
                  30,
                  41,
                  59,
                ],
              },
            }
          );

          doc.save(
            `Welljob_Dashboard_Report_${selectedYear}.pdf`
          );

          return;
        }

        const doc =
          new jsPDF({
            orientation:
              "landscape",
            unit:
              "mm",
            format:
              "a4",
          });

        const pageWidth =
          doc.internal
            .pageSize
            .getWidth();

        const generatedBy =
          getDashboardUserDisplayName(
            user
          );

        const generatedRole =
          String(
            user?.role ||
              "Authorized User"
          )
            .trim()
            .replace(
              /_/g,
              " "
            );

        const generatedAt =
          formatReportGeneratedAt(
            monthlyWorkforceReport
              ?.meta
              ?.generatedAt
          );

        const overall =
          monthlyWorkforceReport
            ?.overall ||
          normalizeMonthlyWorkforceBucket();

        const companies =
          Array.isArray(
            monthlyWorkforceReport
              ?.companies
          )
            ? monthlyWorkforceReport
                .companies
            : [];

        const overallTotal =
          monthlyWorkforceReport
            ?.overallTotal ||
          overall;

        /*
         * ==================================================
         * PAGE 1 — MONTHLY WORKFORCE SUMMARY
         * ==================================================
         */
        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          16
        );

        doc.text(
          "Welljob Solutions & General Services Inc.",
          14,
          16
        );

        doc.setFontSize(
          12
        );

        doc.text(
          "Monthly Workforce Summary",
          14,
          24
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          9
        );

        doc.text(
          `Reporting Period: ${selectedPeriodLabel}`,
          14,
          31
        );

        doc.text(
          `Generated By: ${generatedBy}`,
          14,
          37
        );

        doc.text(
          `Role: ${generatedRole}`,
          14,
          43
        );

        doc.text(
          `Generated On: ${generatedAt}`,
          pageWidth / 2,
          31
        );

        doc.text(
          "Scope: Overall workforce by client company",
          pageWidth / 2,
          37
        );

        autoTable(
          doc,
          {
            startY:
              50,
            head: [
              [
                "Workforce Metric",
                "Count",
              ],
            ],
            body: [
              [
                "Total Employees",
                overall.totalEmployees,
              ],
              [
                "Deployed",
                overall.deployed,
              ],
              [
                "For Deployment",
                overall.forDeployment,
              ],
              [
                "Floating / Standby",
                overall.floatingStandby,
              ],
              [
                "Resigned",
                overall.resigned,
              ],
              [
                "Terminated",
                overall.terminated,
              ],
              [
                "AWOL",
                overall.awol,
              ],
              [
                "Other Separation",
                overall.otherSeparation,
              ],
            ],
            theme:
              "grid",
            headStyles: {
              fillColor: [
                79,
                70,
                229,
              ],
            },
            styles: {
              fontSize:
                9,
              cellPadding:
                2.5,
            },
            columnStyles: {
              0: {
                cellWidth:
                  70,
              },
              1: {
                cellWidth:
                  30,
                halign:
                  "right",
              },
            },
          }
        );

        const summaryFinalY =
          doc.lastAutoTable
            ?.finalY ||
          50;

        autoTable(
          doc,
          {
            startY:
              summaryFinalY +
              8,
            head: [
              [
                "Current KPI Summary",
                "Value",
              ],
            ],
            body: [
              [
                "Current Total Employees",
                currentKPIS.total,
              ],
              [
                "Current Deployed Employees",
                currentKPIS.deployed,
              ],
              [
                "Current Available Workers",
                currentKPIS.available,
              ],
              [
                "Current Utilization Rate",
                `${utilizationRate}%`,
              ],
              [
                "Current Active Incidents",
                currentKPIS.activeIncidents,
              ],
              [
                "Expiring Documents",
                currentKPIS.expiringDocs,
              ],
              [
                `Incident Reports (${selectedPeriodLabel})`,
                totalIncidentsForPeriod,
              ],
              [
                "Peak Deployment Activity",
                peakDeploymentMonth,
              ],
              [
                "Highest Incident Activity",
                highestIncidentMonth,
              ],
              [
                "Most Common Severity",
                topSeverity,
              ],
            ],
            theme:
              "grid",
            headStyles: {
              fillColor: [
                30,
                41,
                59,
              ],
            },
            styles: {
              fontSize:
                8,
              cellPadding:
                2,
            },
            columnStyles: {
              0: {
                cellWidth:
                  78,
              },
              1: {
                cellWidth:
                  42,
              },
            },
          }
        );

        /*
         * ==================================================
         * PAGE 2 — COMPANY BREAKDOWN
         * ==================================================
         */
        doc.addPage(
          "a4",
          "landscape"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          14
        );

        doc.text(
          "Client Company Summary",
          14,
          16
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          9
        );

        doc.text(
          `Reporting Period: ${selectedPeriodLabel}`,
          14,
          23
        );

        autoTable(
          doc,
          {
            startY:
              29,
            head: [
              [
                "Client Company",
                "Total",
                "Deployed",
                "For Deployment",
                "Floating / Standby",
                "Resigned",
                "Terminated",
                "AWOL",
                "Other Separation",
              ],
            ],
            body: [
              ...companies.map(
                (company) => [
                  company.company,
                  company.totalEmployees,
                  company.deployed,
                  company.forDeployment,
                  company.floatingStandby,
                  company.resigned,
                  company.terminated,
                  company.awol,
                  company.otherSeparation,
                ]
              ),
              [
                "OVERALL TOTAL",
                overallTotal.totalEmployees,
                overallTotal.deployed,
                overallTotal.forDeployment,
                overallTotal.floatingStandby,
                overallTotal.resigned,
                overallTotal.terminated,
                overallTotal.awol,
                overallTotal.otherSeparation,
              ],
            ],
            theme:
              "grid",
            headStyles: {
              fillColor: [
                79,
                70,
                229,
              ],
              fontSize:
                7.5,
            },
            styles: {
              fontSize:
                7.5,
              cellPadding:
                1.8,
              valign:
                "middle",
            },
            columnStyles: {
              0: {
                cellWidth:
                  52,
              },
              1: {
                halign:
                  "right",
              },
              2: {
                halign:
                  "right",
              },
              3: {
                halign:
                  "right",
              },
              4: {
                halign:
                  "right",
              },
              5: {
                halign:
                  "right",
              },
              6: {
                halign:
                  "right",
              },
              7: {
                halign:
                  "right",
              },
              8: {
                halign:
                  "right",
              },
            },
            didParseCell: (
              hookData
            ) => {
              const isOverallTotal =
                hookData.section ===
                  "body" &&
                hookData.row.index ===
                  companies.length;

              if (
                isOverallTotal
              ) {
                hookData.cell.styles.fontStyle =
                  "bold";

                hookData.cell.styles.fillColor = [
                  241,
                  245,
                  249,
                ];
              }
            },
          }
        );

        /*
         * ==================================================
         * PAGE 3 — MANAGEMENT ACTIONS
         * ==================================================
         */
        doc.addPage(
          "a4",
          "landscape"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          14
        );

        doc.text(
          "Management Actions & Historical Activity",
          14,
          16
        );

        autoTable(
          doc,
          {
            startY:
              24,
            head: [
              [
                "Priority",
                "Type",
                "Recommendation",
                "Basis",
              ],
            ],
            body:
              executiveActions.length >
              0
                ? executiveActions.map(
                    (action) => [
                      action?.priority ||
                        "-",
                      action?.type ||
                        "-",
                      action?.recommendation ||
                        "-",
                      action?.basis ||
                        "-",
                    ]
                  )
                : [
                    [
                      "-",
                      "No Alert",
                      "No priority action item detected.",
                      "-",
                    ],
                  ],
            theme:
              "grid",
            headStyles: {
              fillColor: [
                22,
                163,
                74,
              ],
            },
            styles: {
              fontSize:
                8,
            },
            columnStyles: {
              0: {
                cellWidth:
                  24,
              },
              1: {
                cellWidth:
                  32,
              },
              2: {
                cellWidth:
                  112,
              },
              3: {
                cellWidth:
                  100,
              },
            },
          }
        );

        const actionsFinalY =
          doc.lastAutoTable
            ?.finalY ||
          24;

        autoTable(
          doc,
          {
            startY:
              actionsFinalY +
              8,
            head: [
              [
                "Month",
                "Deployment Activity",
                "Incident Reports",
              ],
            ],
            body:
              monthList.map(
                (month) => {
                  const deployment =
                    workforceTrend.find(
                      (item) =>
                        item.label ===
                        month
                    );

                  const incident =
                    incidentTrend.find(
                      (item) =>
                        item.label ===
                        month
                    );

                  return [
                    month,
                    deployment?.value ??
                      0,
                    incident?.value ??
                      0,
                  ];
                }
              ),
            theme:
              "striped",
            headStyles: {
              fillColor: [
                30,
                41,
                59,
              ],
            },
            styles: {
              fontSize:
                8,
            },
          }
        );

        const safePeriod =
          selectedPeriodLabel.replace(
            /[^a-zA-Z0-9_-]+/g,
            "_"
          );

        doc.save(
          `Welljob_Dashboard_Report_${safePeriod}.pdf`
        );
      } finally {
        setExportingPDF(
          false
        );
      }
    }, [
      exportingPDF,
      monthlyWorkforceLoading,
      monthlyWorkforceError,
      monthlyWorkforceReport,
      selectedMonth,
      selectedYear,
      selectedPeriodLabel,
      lastUpdated,
      user,
      currentKPIS,
      utilizationRate,
      totalIncidentsForPeriod,
      totalIncidentsForYear,
      peakDeploymentMonth,
      highestIncidentMonth,
      topSeverity,
      executiveActions,
      workforceTrend,
      incidentTrend,
    ]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-[70vh] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      >
        <FiRefreshCw
          className="animate-spin text-2xl text-indigo-500"
          aria-hidden="true"
        />
        <p className="font-semibold">
          Loading dashboard...
        </p>
        <p className="text-xs text-slate-400">
          Please wait while the latest workforce information is prepared.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {fetchError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{fetchError}</p>
            <button
              type="button"
              onClick={
                handleRefresh
              }
              disabled={
                refreshing ||
                isLoadingRef.current
              }
              className="w-fit rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      <section
        aria-labelledby="dashboard-page-title"
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
      >
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-slate-900 px-6 py-5 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/90">
                <FiBarChart2
                  aria-hidden="true"
                />
                HR Operations Overview
              </div>
              <h1
                id="dashboard-page-title"
                className="text-3xl font-extrabold tracking-tight"
              >
                Workforce Operations Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                Current workforce snapshot with monthly workforce reporting, deployment, incidents, compliance, and HR monitoring.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
                <span>
                  Last Updated:{" "}
                  {lastUpdated ||
                    "Not yet updated"}
                </span>

                <span className="font-semibold">
                  Selected Period:{" "}
                  {
                    selectedPeriodLabel
                  }
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <select
                aria-label="Filter dashboard by month"
                value={
                  selectedMonth
                }
                onChange={
                  handleMonthChange
                }
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white outline-none backdrop-blur focus:border-white/50 focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <option
                  className="text-slate-900"
                  value={0}
                >
                  All Months
                </option>

                {availableMonths.map(
                  (month) => (
                    <option
                      className="text-slate-900"
                      key={
                        month.name
                      }
                      value={
                        month.value
                      }
                      disabled={
                        !month.available
                      }
                    >
                      {month.name}
                    </option>
                  )
                )}
              </select>
              <select
                aria-label="Filter dashboard by year"
                value={
                  selectedYear
                }
                onChange={
                  handleYearChange
                }
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white outline-none backdrop-blur focus:border-white/50 focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {availableYears.map(
                  (year) => (
                    <option
                      className="text-slate-900"
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}
              </select>
              <button
                type="button"
                onClick={
                  handleRefresh
                }
                disabled={
                  refreshing ||
                  isLoadingRef.current
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCw
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                  aria-hidden="true"
                />
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
              <RoleGuard
                permission={
                  PERMISSIONS.CAN_EXPORT_PDF
                }
              >
                <button
                  type="button"
                  onClick={
                    handleExportPDF
                  }
                  disabled={
                    exportingPDF ||
                    monthlyWorkforceLoading ||
                    Boolean(
                      monthlyWorkforceError
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiDownload
                    aria-hidden="true"
                  />
                  {exportingPDF
                    ? "Exporting..."
                    : "Export PDF"}
                </button>
              </RoleGuard>
            </div>
          </div>
        </div>
      </section>
      <KPICards
        kpis={currentKPIS}
        utilizationRate={
          utilizationRate
        }
        trendData={kpiTrendData}
        onCardClick={
          handleOpenDrilldown
        }
      />
      {Number(
        selectedMonth
      ) > 0 ? (
        <MonthlyWorkforceSummary
          report={
            monthlyWorkforceReport
          }
          loading={
            monthlyWorkforceLoading
          }
          error={
            monthlyWorkforceError
          }
          selectedMonth={
            selectedMonth
          }
          selectedYear={
            selectedYear
          }
        />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Monthly Workforce Summary
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            All Months is selected. The charts and trends below cover the full selected year. Select a specific month to view the month-end workforce summary by client company.
          </p>
        </section>
      )}
      <WorkforceHealthBanner
        health={
          dashboardInsights.health
        }
      />
      <ExecutiveActionItems
        actions={executiveActions}
      />
      <ExecutiveInsightTabs
        insights={
          dashboardInsights
        }
        onOpenDrilldown={
          handleOpenDrilldown
        }
      />
      <section
        aria-labelledby="period-highlights-title"
        className="space-y-3"
      >
        <div>
          <h2
            id="period-highlights-title"
            className="text-lg font-bold text-slate-900 dark:text-slate-100"
          >
            Period Highlights
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Summary for {selectedPeriodLabel}. Current workforce KPIs above continue to show the latest available figures.
          </p>
        </div>
        <div
          aria-label="Dashboard highlights"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
        <InsightCard
          title="Peak Deployment Activity"
          value={
            peakDeploymentMonth
          }
          tone="indigo"
        />
        <InsightCard
          title="Highest Incident Activity"
          value={
            highestIncidentMonth
          }
          tone="red"
        />
        <InsightCard
          title={`Most Common Severity (${selectedPeriodLabel})`}
          value={topSeverity}
          tone="amber"
        />
        <InsightCard
          title={`Incident Reports (${selectedPeriodLabel})`}
          value={
            totalIncidentsForPeriod
          }
          tone="emerald"
        />
        </div>
      </section>
      <section
        aria-labelledby="historical-analytics-title"
        className="space-y-4"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="historical-analytics-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Trends &amp; Distribution
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Yearly activity trends for {selectedYear}, with incident severity and case age for {selectedPeriodLabel}.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Selected Period: {selectedPeriodLabel}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <DeploymentTrendChart
            data={workforceTrend}
            comparisonData={
              deploymentComparisonTrend
            }
            years={
              comparisonYears
            }
            selectedYear={
              selectedYear
            }
            isCurrentYear={
              isCurrentYear
            }
            currentMonth={
              currentMonth
            }
          />
          <IncidentTrendChart
            data={incidentTrend}
            comparisonData={
              incidentComparisonTrend
            }
            years={
              comparisonYears
            }
            selectedYear={
              selectedYear
            }
            isCurrentYear={
              isCurrentYear
            }
            currentMonth={
              currentMonth
            }
          />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SeverityPieChart
            data={
              filteredSeverity
            }
          />
          <CaseAgingChart
            data={
              filteredAging
            }
          />
        </div>
      </section>
      <PredictiveInsightsPanel
        predictions={
          dashboardInsights.predictions
        }
      />
      <DashboardDrilldownModal
        detail={activeDrilldown}
        onClose={
          handleCloseDrilldown
        }
        onRowClick={
          handleRowClick
        }
      />
      {editingEmployee && (
        <EditEmployeeModal
          employeeToEdit={
            editingEmployee
          }
          employees={
            data.rawEmployees
          }
          onClose={
            handleCloseEmployeeModal
          }
          onSaveSuccess={
            handleEmployeeSaveSuccess
          }
        />
      )}
    </div>
  );
}