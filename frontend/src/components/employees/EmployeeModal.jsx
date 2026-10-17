import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiDownload,
  FiEye,
  FiFileText,
  FiPrinter,
  FiShield,
  FiX,
} from "react-icons/fi";
import welljobLogoUrl from "../../assets/Logo.png";
import {
  getDaysUntilExpiration,
} from "../../utils/employees/employeeHelpers";
import {
  calculateSeveritySnapshot,
} from "../../utils/kpi/severityDecayHelpers";
import {
  normalizeEmployeeDocumentNumber,
  parseEmployeeDocuments,
} from "../../utils/employees/employeeFormHelpers";
import authenticatedFetch from "../../utils/authenticatedFetch";
import { fetchEmployeeDocumentPreview } from "../../utils/employees/employeeDocumentPreview";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../context/useAuth";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import IconButton from "../ui/IconButton";
import {
  DOCUMENT_OPTIONS,
  getDocumentStatus as getExpirationStatus,
} from "./employeeConstants";
const INCIDENT_API_URL = `${API_BASE}/incidents`;
const EMPLOYEE_TIME_ZONE = "Asia/Manila";

const DOCUMENT_OPTIONS_BY_NAME = new Map(
  DOCUMENT_OPTIONS.map((option) => [
    option.name,
    option,
  ])
);

const EXPIRABLE_DOCUMENT_NAMES = new Set(
  DOCUMENT_OPTIONS
    .filter(({ expirable }) => expirable)
    .map(({ name }) => name)
);
const OPEN_INCIDENT_STATUSES = new Set([
  "Open",
  "Investigating",
  "For Review",
]);
const EMPTY_INCIDENT_SUMMARY = Object.freeze({
  total: 0,
  activeTotal: 0,
  open: 0,
  closed: 0,
  critical: 0,
  activeCritical: 0,
  severityScore: 0,
  historicalSeverityScore: 0,
  activeSeverityScore: 0,
  behaviorTrend: "Good Standing",
  monthsWithoutNewIncident: null,
});
const STATUS_CLASSES = {
  Valid:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  "Expiring Soon":
    "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
  Expired:
    "border border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300",
  "No Data":
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Incomplete:
    "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
  Inactive:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Active:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  Resigned:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Terminated:
    "border border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300",
  Deployed:
    "border border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300",
  "For Deployment":
    "border border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300",
  "Floating / Standby":
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Open:
    "border border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300",
  Investigating:
    "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
  "For Review":
    "border border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300",
  Closed:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
};
const RISK_CLASSES = {
  "High Risk":
    "border border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300",
  Repeat:
    "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
  Monitor:
    "border border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300",
  "Low Risk":
    "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  Unavailable:
    "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
const KPI_CLASSES = {
  "Critical Concern":
    "border border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300",
  "Needs Improvement":
    "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
  "Minor Concern":
    "border border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300",
  "Good Standing":
    "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  Unavailable:
    "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
const RECOMMENDATION_CLASSES = {
  Retain:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  "Monitor Employee":
    "border border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300",
  "Final Warning":
    "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
  "Suspension Review":
    "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
  "Termination Review":
    "border border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300",
  "HR Review Required":
    "border border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300",
  Unavailable:
    "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
function getClassName(classes, value, fallback) {
  return classes[value] || classes[fallback];
}
function formatIncidentId(id) {
  if (!id) return "-";
  const value = String(id);
  if (value.startsWith("INC-")) {
    return value;
  }
  const numericValue = Number(value);
  return Number.isNaN(numericValue)
    ? value
    : `INC-${String(numericValue).padStart(4, "0")}`;
}
function normalizeEmployeeBusinessDate(
  value
) {
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
          EMPLOYEE_TIME_ZONE,
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

function formatDate(value) {
  if (!value) {
    return "Not Set";
  }

  const dateOnly =
    normalizeEmployeeBusinessDate(
      value
    );

  if (!dateOnly) {
    return "Invalid date";
  }

  const parsed =
    new Date(
      `${dateOnly}T00:00:00+08:00`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        EMPLOYEE_TIME_ZONE,
      year:
        "numeric",
      month:
        "long",
      day:
        "numeric",
    }
  ).format(
    parsed
  );
}

function formatEmployeeReportGeneratedAt() {
  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        EMPLOYEE_TIME_ZONE,
      year:
        "numeric",
      month:
        "short",
      day:
        "2-digit",
      hour:
        "numeric",
      minute:
        "2-digit",
      second:
        "2-digit",
      hour12:
        true,
    }
  ).format(
    new Date()
  );
}

function getEmployeeReportFilenameDate() {
  return normalizeEmployeeBusinessDate(
    new Date()
  );
}
function normalizeIncidentStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (value === "resolved" || value === "closed") {
    return "Closed";
  }
  if (value === "for review") {
    return "For Review";
  }
  if (value === "investigating") {
    return "Investigating";
  }
  return "Open";
}
function getDaysLabel(expirationDate) {
  const daysRemaining = getDaysUntilExpiration(expirationDate);
  if (daysRemaining === null) {
    return expirationDate
      ? "Invalid expiration date"
      : "No expiration date recorded";
  }
  if (daysRemaining < 0) {
    const elapsedDays = Math.abs(daysRemaining);
    return `Expired ${elapsedDays} day${
      elapsedDays === 1 ? "" : "s"
    } ago`;
  }
  if (daysRemaining === 0) {
    return "Expires today";
  }
  return `Expires in ${daysRemaining} day${
    daysRemaining === 1 ? "" : "s"
  }`;
}
function getKPILevel(severityScore, totalIncidents) {
  if (severityScore >= 8) {
    return "Critical Concern";
  }
  if (severityScore >= 4) {
    return "Needs Improvement";
  }
  if (totalIncidents >= 1) {
    return "Minor Concern";
  }
  return "Good Standing";
}
function getRiskLevel({
  kpiLevel,
  totalIncidents,
  criticalIncidents,
}) {
  if (
    criticalIncidents >= 1 ||
    kpiLevel === "Critical Concern"
  ) {
    return "High Risk";
  }
  if (kpiLevel === "Needs Improvement") {
    return "Repeat";
  }
  if (
    kpiLevel === "Minor Concern" ||
    totalIncidents >= 1
  ) {
    return "Monitor";
  }
  return "Low Risk";
}
function getRecommendationDecision({
  totalIncidents,
  criticalIncidents,
  riskLevel,
}) {
  if (criticalIncidents >= 2) {
    return {
      recommendation: "Termination Review",
      reason:
        `Employee has ${criticalIncidents} critical incident(s), ` +
        "requiring termination review.",
    };
  }
  if (
    criticalIncidents >= 1 ||
    riskLevel === "High Risk"
  ) {
    return {
      recommendation: "Suspension Review",
      reason:
        "Employee has critical or high-risk incident records requiring suspension review.",
    };
  }
  if (
    totalIncidents >= 3 ||
    riskLevel === "Repeat"
  ) {
    return {
      recommendation: "Final Warning",
      reason:
        "Employee has repeated violations and should receive final warning.",
    };
  }
  if (
    totalIncidents >= 1 ||
    riskLevel === "Monitor"
  ) {
    return {
      recommendation: "Monitor Employee",
      reason:
        "Employee has recorded violation(s) and should be monitored.",
    };
  }
  return {
    recommendation: "Retain",
    reason:
      "Employee has no recorded violation and may be retained.",
  };
}
function getIncidentTimestamp(incident) {
  const dateValue =
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.createdAt ||
    incident?.created_at ||
    "";
  const timestamp = new Date(dateValue).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
function getEmployeeId(employee) {
  return String(
    employee?.id ??
      employee?.employeeId ??
      employee?.employee_id ??
      ""
  ).trim();
}
function getEmployeeName(employee) {
  return (
    employee?.name ||
    employee?.fullName ||
    employee?.full_name ||
    "Employee"
  );
}

function cleanReportValue(
  value,
  fallback = "-"
) {
  const normalized =
    String(
      value ?? ""
    ).trim();

  return normalized ||
    fallback;
}

function normalizeUserRole(value) {
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

function getReportGeneratedBy(
  user
) {
  const firstName =
    cleanReportValue(
      user?.first_name ||
        user?.firstName,
      ""
    );

  const lastName =
    cleanReportValue(
      user?.last_name ||
        user?.lastName,
      ""
    );

  const composedName =
    [
      firstName,
      lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  return cleanReportValue(
    user?.full_name ||
      user?.fullName ||
      composedName ||
      user?.name,
    "Authorized User"
  );
}

function sanitizeReportFilePart(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /[^a-z0-9_-]+/gi,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .slice(
      0,
      80
    ) ||
    "Employee";
}

function fileToDataUrl(
  blob
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onload =
        () =>
          resolve(
            String(
              reader.result ||
                ""
            )
          );

      reader.onerror =
        () =>
          reject(
            new Error(
              "Unable to read Welljob logo."
            )
          );

      reader.readAsDataURL(
        blob
      );
    }
  );
}

async function loadEmployeeReportLogoDataUrl() {
  try {
    const response =
      await fetch(
        welljobLogoUrl
      );

    if (!response.ok) {
      return "";
    }

    const blob =
      await response.blob();

    return await fileToDataUrl(
      blob
    );
  } catch {
    /*
     * The employee report remains available even if
     * the bundled logo cannot be decoded by the browser.
     */
    return "";
  }
}

function getEmployeeReportIncidentDate(
  incident
) {
  const value =
    incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.createdAt ||
    incident?.created_at;

  if (!value) {
    return "-";
  }

  const dateOnly =
    normalizeEmployeeBusinessDate(
      value
    );

  if (!dateOnly) {
    return cleanReportValue(
      value
    );
  }

  const parsed =
    new Date(
      `${dateOnly}T00:00:00+08:00`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return cleanReportValue(
      value
    );
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        EMPLOYEE_TIME_ZONE,
      year:
        "numeric",
      month:
        "short",
      day:
        "2-digit",
    }
  ).format(
    parsed
  );
}

function getEmployeeReportIncidentDetails(
  incident
) {
  const description =
    cleanReportValue(
      incident?.description,
      ""
    );

  const sanction =
    cleanReportValue(
      incident?.sanction ||
        incident?.policySanction ||
        incident?.policy_sanction ||
        incident?.actionTaken ||
        incident?.action_taken,
      "For HR Review"
    );

  return [
    description
      ? `Description: ${description}`
      : "",
    `Sanction: ${sanction}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function addEmployeeReportFooters(
  doc
) {
  const pageCount =
    doc.internal
      .getNumberOfPages();

  for (
    let pageNumber = 1;
    pageNumber <=
    pageCount;
    pageNumber += 1
  ) {
    doc.setPage(
      pageNumber
    );

    const pageWidth =
      doc.internal.pageSize
        .getWidth();

    const pageHeight =
      doc.internal.pageSize
        .getHeight();

    doc.setFontSize(
      7
    );

    doc.setFont(
      undefined,
      "normal"
    );

    doc.setTextColor(
      100
    );

    doc.text(
      `Employee Profile Report | Page ${pageNumber} of ${pageCount}`,
      pageWidth - 14,
      pageHeight - 7,
      {
        align:
          "right",
      }
    );
  }
}

async function buildEmployeeProfilePdf({
  employee,
  employeeIncidents,
  user,
  isHRCoordinator,
}) {
  const doc =
    new jsPDF({
      orientation:
        "portrait",
      unit:
        "mm",
      format:
        "a4",
    });

  const logoDataUrl =
    await loadEmployeeReportLogoDataUrl();

  if (logoDataUrl) {
    try {
      doc.addImage(
        logoDataUrl,
        "PNG",
        14,
        9,
        18,
        18
      );
    } catch {
      /*
       * Keep report generation resilient if the
       * browser cannot decode the bundled image.
       */
    }
  }

  const employeeName =
    getEmployeeName(
      employee
    );

  const employeeId =
    getEmployeeId(
      employee
    );

  const workforceStatus =
    getEmployeeWorkforceStatus(
      employee
    );

  const employmentStatus =
    getEmployeeEmploymentStatus(
      employee,
      workforceStatus
    );

  const workforceLabel =
    getWorkforceStatusLabel(
      workforceStatus
    );

  const birthday =
    getEmployeeBirthday(
      employee
    );

  const age =
    getEmployeeAge(
      birthday
    );

  const dateHired =
    getEmployeeDateHired(
      employee
    );

  const deploymentDate =
    getEmployeeDeploymentDate(
      employee,
      workforceStatus
    );

  const company =
    cleanReportValue(
      employee?.company,
      "Not recorded"
    );

  const position =
    cleanReportValue(
      employee?.position ||
        employee?.jobTitle ||
        employee?.job_title ||
        employee?.jobPosition ||
        employee?.job_position,
      "Not recorded"
    );

  const companyLabel =
    "Client Company";

  const positionLabel =
    "Position";

  const generatedBy =
    getReportGeneratedBy(
      user
    );

  const pageWidth =
    doc.internal.pageSize
      .getWidth();

  doc.setFontSize(
    13
  );

  doc.setFont(
    undefined,
    "bold"
  );

  doc.setTextColor(
    30,
    41,
    59
  );

  doc.text(
    "WELLJOB SOLUTIONS & GENERAL SERVICES INC.",
    38,
    14
  );

  /*
   * Keep the report title visually separate from the
   * Welljob logo/company header. Centering it gives the
   * document a clearer formal-report hierarchy.
   */
  doc.setFontSize(
    14
  );

  doc.text(
    "EMPLOYEE PROFILE REPORT",
    pageWidth / 2,
    31,
    {
      align:
        "center",
    }
  );

  doc.setFontSize(
    8.5
  );

  doc.setFont(
    undefined,
    "normal"
  );

  doc.setTextColor(
    71,
    85,
    105
  );

  doc.text(
    `Generated by: ${generatedBy}`,
    14,
    43
  );

  doc.text(
    `Generated on: ${formatEmployeeReportGeneratedAt()}`,
    14,
    48
  );

  doc.setFontSize(
    11
  );

  doc.setFont(
    undefined,
    "bold"
  );

  doc.setTextColor(
    15,
    23,
    42
  );

  doc.text(
    "Employee Information",
    14,
    61
  );

  autoTable(
    doc,
    {
      startY:
        65,

      /*
       * Employee identity belongs in the profile table.
       * The report header is reserved for report metadata
       * such as generated-by and generated-on details.
       */
      body: [
        [
          "Employee Name",
          employeeName,
          "Employee ID",
          employeeId ||
            "-",
        ],
        [
          "Employment Status",
          employmentStatus ||
            "Not recorded",
          "Workforce Status",
          workforceLabel,
        ],
        [
          "Birthday",
          birthday
            ? formatDate(
                birthday
              )
            : "Not yet recorded",
          "Age",
          age !== null
            ? `${age} year${
                age === 1
                  ? ""
                  : "s"
              } old`
            : "Not available",
        ],
        [
          "Date Hired",
          dateHired
            ? formatDate(
                dateHired
              )
            : "Not yet recorded",
          companyLabel,
          company,
        ],
        [
          positionLabel,
          position,
          "Deployment Date",
          workforceStatus ===
            "Deployed"
            ? (
                deploymentDate
                  ? formatDate(
                      deploymentDate
                    )
                  : "Not recorded"
              )
            : "Not yet deployed",
        ],
      ],

      theme:
        "grid",

      styles: {
        fontSize: 8,
        cellPadding: 2.6,
        valign:
          "middle",
        lineColor: [
          203,
          213,
          225,
        ],
        lineWidth: 0.15,
      },

      columnStyles: {
        0: {
          cellWidth: 31,
          fontStyle:
            "bold",
          fillColor: [
            248,
            250,
            252,
          ],
          textColor: [
            51,
            65,
            85,
          ],
        },
        1: {
          cellWidth: 60,
        },
        2: {
          cellWidth: 31,
          fontStyle:
            "bold",
          fillColor: [
            248,
            250,
            252,
          ],
          textColor: [
            51,
            65,
            85,
          ],
        },
        3: {
          cellWidth: 60,
        },
      },
    }
  );

  const incidentSectionY =
    (
      doc.lastAutoTable
        ?.finalY ||
      92
    ) + 10;

  doc.setFontSize(
    11
  );

  doc.setFont(
    undefined,
    "bold"
  );

  doc.setTextColor(
    15,
    23,
    42
  );

  doc.text(
    "Incident History",
    14,
    incidentSectionY
  );

  doc.setFontSize(
    7.5
  );

  doc.setFont(
    undefined,
    "normal"
  );

  doc.setTextColor(
    71,
    85,
    105
  );

  doc.text(
    isHRCoordinator
      ? "Detailed incident records are limited to cases authorized for the coordinator's assigned company."
      : "Incident records shown below are the authorized history available for this employee.",
    14,
    incidentSectionY +
      5
  );

  const sortedIncidents =
    (
      Array.isArray(
        employeeIncidents
      )
        ? [
            ...employeeIncidents,
          ]
        : []
    ).sort(
      (
        first,
        second
      ) =>
        getIncidentTimestamp(
          second
        ) -
        getIncidentTimestamp(
          first
        )
    );

  const incidentRows =
    sortedIncidents.length >
    0
      ? sortedIncidents.map(
          (incident) => [
            formatIncidentId(
              incident?.id
            ),
            getEmployeeReportIncidentDate(
              incident
            ),
            cleanReportValue(
              incident?.violation ||
                incident?.violationType ||
                incident?.violation_type,
              "No violation type"
            ),
            cleanReportValue(
              incident?.severity,
              "Minor"
            ),
            cleanReportValue(
              incident?.status,
              "Open"
            ),
            getEmployeeReportIncidentDetails(
              incident
            ),
          ]
        )
      : [[
          "-",
          "-",
          "No authorized incident history found for this employee.",
          "-",
          "-",
          "-",
        ]];

  autoTable(
    doc,
    {
      startY:
        incidentSectionY +
        9,

      margin: {
        top: 18,
        left: 14,
        right: 14,
        bottom: 14,
      },

      head: [[
        "Incident ID",
        "Date",
        "Violation",
        "Severity",
        "Status",
        "Details",
      ]],

      body:
        incidentRows,

      theme:
        "grid",

      styles: {
        fontSize: 6.8,
        cellPadding: 1.8,
        overflow:
          "linebreak",
        valign:
          "top",
      },

      headStyles: {
        fillColor: [
          30,
          41,
          59,
        ],
        fontSize: 7.5,
      },

      alternateRowStyles: {
        fillColor: [
          248,
          250,
          252,
        ],
      },

      columnStyles: {
        0: {
          cellWidth: 20,
        },
        1: {
          cellWidth: 22,
        },
        2: {
          cellWidth: 37,
        },
        3: {
          cellWidth: 17,
        },
        4: {
          cellWidth: 18,
        },
        5: {
          cellWidth: 68,
        },
      },

      didDrawPage: (
        data
      ) => {
        if (
          data.pageNumber >
          1
        ) {
          doc.setFontSize(
            9
          );

          doc.setFont(
            undefined,
            "bold"
          );

          doc.setTextColor(
            30,
            41,
            59
          );

          doc.text(
            "Employee Incident History",
            14,
            10
          );
        }
      },
    }
  );

  /*
   * SECURITY / PRIVACY:
   *
   * The PDF intentionally excludes:
   * - Compliance Status
   * - compliance document status
   * - government reference/document numbers
   * - compliance files
   *
   * Incident rows use only the already-authorized
   * EmployeeModal incident dataset. No extra Incident
   * request is performed for PDF generation.
   */
  addEmployeeReportFooters(
    doc
  );

  return doc;
}

function getEmployeeBirthday(employee) {
  return (
    employee?.birthday ||
    employee?.dateOfBirth ||
    employee?.date_of_birth ||
    ""
  );
}

function getEmployeeDateHired(
  employee
) {
  return String(
    employee?.dateHired ||
      employee?.date_hired ||
      ""
  ).trim();
}

function getEmployeeDeploymentDate(
  employee,
  workforceStatus
) {
  if (
    workforceStatus !==
    "Deployed"
  ) {
    return "";
  }

  return String(
    employee?.contractStart ||
      employee?.contract_start ||
      employee?.deploymentStart ||
      employee?.deployment_start ||
      ""
  ).trim();
}

function getEmployeeWorkforceStatus(
  employee
) {
  const value =
    String(
      employee?.workforceStatus ||
      employee?.workforce_status ||
      employee?.status ||
      ""
    ).trim();

  if (
    [
      "Floating / Standby",
      "For Deployment",
      "Deployed",
    ].includes(
      value
    )
  ) {
    return value;
  }

  return "";
}

function getEmployeeEmploymentStatus(
  employee,
  workforceStatus
) {
  const value =
    String(
      employee?.employmentStatus ||
      employee?.employment_status ||
      ""
    ).trim();

  if (
    [
      "Active",
      "Resigned",
      "Terminated",
    ].includes(
      value
    )
  ) {
    return value;
  }

  if (
    [
      "Floating / Standby",
      "For Deployment",
      "Deployed",
    ].includes(
      workforceStatus
    )
  ) {
    return "Active";
  }

  if (
    [
      "Resigned",
      "Terminated",
    ].includes(
      String(
        employee?.status ||
        ""
      ).trim()
    )
  ) {
    return String(
      employee.status
    ).trim();
  }

  return "";
}

function getWorkforceStatusLabel(
  workforceStatus
) {
  return (
    workforceStatus ||
    "Not recorded"
  );
}

function getPlacementWorkflowNote(
  workforceStatus
) {
  if (
    workforceStatus ===
    "Deployed"
  ) {
    return "Currently deployed to the assigned client company.";
  }

  if (
    workforceStatus ===
    "For Deployment"
  ) {
    return "Deployment is scheduled and awaiting arrival confirmation by the HR Coordinator.";
  }

  if (
    workforceStatus ===
    "Floating / Standby"
  ) {
    return "The employee is Floating / Standby with a designated client company and position before deployment.";
  }

  return "Deployment information is not available.";
}

function getEmployeeAge(birthday) {
  if (!birthday) {
    return null;
  }

  const normalizedBirthday =
    normalizeEmployeeBusinessDate(
      birthday
    );

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      normalizedBirthday
    );

  if (!match) {
    return null;
  }

  const birthYear =
    Number(match[1]);

  const birthMonth =
    Number(match[2]);

  const birthDay =
    Number(match[3]);

  const validationDate =
    new Date(
      Date.UTC(
        birthYear,
        birthMonth - 1,
        birthDay
      )
    );

  if (
    validationDate.getUTCFullYear() !==
      birthYear ||
    validationDate.getUTCMonth() !==
      birthMonth - 1 ||
    validationDate.getUTCDate() !==
      birthDay
  ) {
    return null;
  }

  const today =
    normalizeEmployeeBusinessDate(
      new Date()
    );

  const todayMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      today
    );

  if (!todayMatch) {
    return null;
  }

  const currentYear =
    Number(
      todayMatch[1]
    );

  const currentMonth =
    Number(
      todayMatch[2]
    );

  const currentDay =
    Number(
      todayMatch[3]
    );

  let age =
    currentYear -
    birthYear;

  const birthdayHasNotOccurredThisYear =
    currentMonth <
      birthMonth ||
    (
      currentMonth ===
        birthMonth &&
      currentDay <
        birthDay
    );

  if (
    birthdayHasNotOccurredThisYear
  ) {
    age -= 1;
  }

  if (
    age < 0 ||
    age > 150
  ) {
    return null;
  }

  return age;
}
function normalizeIncident(incident = {}) {
  const date =
    incident.reportedAt ||
    incident.reported_at ||
    incident.date ||
    incident.incidentDate ||
    incident.incident_date ||
    incident.createdAt ||
    incident.created_at ||
    "";
  const violation =
    incident.violation ||
    incident.violationType ||
    incident.violation_type ||
    "No violation type";
  return {
    ...incident,
    id: incident.id,
    displayId: formatIncidentId(incident.id),
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
    violation,
    violationType: violation,
    severity: incident.severity || "Minor",
    status: normalizeIncidentStatus(incident.status),
    date,
    reportedAt: incident.reportedAt || incident.reported_at || date,
    createdAt: incident.createdAt || incident.created_at || date,
    description: incident.description || "",
    recommendation: incident.recommendation || "",
    sanction:
      incident.sanction ||
      incident.actionTaken ||
      incident.action_taken ||
      "For HR Review",
  };
}
function buildDocumentFile(document = {}) {
  const rawPath =
    document.filePath ||
    document.file_path ||
    document.url ||
    (typeof document.file === "string" ? document.file : "");
  if (!rawPath) {
    return null;
  }
  const normalizedPath = String(rawPath).split("\\").join("/");
  const cleanPath = normalizedPath.toLowerCase().split("?")[0];
  return {
    documentId: document.id,
    name:
      document.fileName ||
      document.file_name ||
      normalizedPath.split("/").pop()?.split("?")[0] ||
      document.name ||
      "Uploaded file",
    type: cleanPath.endsWith(".pdf")
      ? "application/pdf"
      : "image/*",
  };
}
function normalizeDocument(document = {}) {
  const expirationDate =
    document.expirationDate ||
    document.expiration_date ||
    "";

  const file =
    buildDocumentFile(document);

  const documentOption =
    DOCUMENT_OPTIONS_BY_NAME.get(
      document.name
    );

  const expirable =
    EXPIRABLE_DOCUMENT_NAMES.has(
      document.name
    );

  const documentNumber =
    normalizeEmployeeDocumentNumber(
      document.documentNumber ??
        document.document_number
    );

  return {
    ...document,
    expirationDate,
    documentNumber,
    documentNumberLabel:
      documentOption?.documentNumberLabel ||
      "Document Number",
    requiresDocumentNumber:
      Boolean(
        documentOption?.requiresDocumentNumber
      ),
    file,
    expirable,
    status: !file
      ? "No Data"
      : expirable
        ? getExpirationStatus(expirationDate)
        : "Valid",
  };
}
function getEmployeeInitials(name) {
  return (
    String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E"
  );
}
function getSeverityKPILevel(severity) {
  if (severity === "Critical") {
    return "Critical Concern";
  }
  if (severity === "Major") {
    return "Needs Improvement";
  }
  return "Minor Concern";
}
function parseHistoricalSummary(data, expectedEmployeeId) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error("Invalid incident summary response.");
  }
  if (
    String(data.employeeId ?? "") !==
    String(expectedEmployeeId)
  ) {
    throw new Error("Incident summary employee ID mismatch.");
  }
  const summary = data.summary;
  if (
    !summary ||
    typeof summary !== "object" ||
    Array.isArray(summary)
  ) {
    throw new Error("Incident summary is unavailable.");
  }
  const requiredFields = [
    "total",
    "open",
    "closed",
    "critical",
  ];
  const validated = {};
  for (const field of requiredFields) {
    const rawValue = summary[field];
    if (
      rawValue === null ||
      rawValue === undefined ||
      rawValue === ""
    ) {
      throw new Error(`Missing incident summary field: ${field}`);
    }
    const value = Number(rawValue);
    if (
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      throw new Error(`Invalid incident summary field: ${field}`);
    }
    validated[field] = value;
  }

  const decimalFields = [
    "severityScore",
    "historicalSeverityScore",
    "activeSeverityScore",
  ];

  for (const field of decimalFields) {
    const value = Number(summary[field]);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid incident summary field: ${field}`);
    }
    validated[field] = value;
  }

  validated.activeTotal = Number(summary.activeTotal || 0);
  validated.activeCritical = Number(summary.activeCritical || 0);
  validated.behaviorTrend =
    String(summary.behaviorTrend || "Insufficient Data");
  validated.monthsWithoutNewIncident =
    summary.monthsWithoutNewIncident === null ||
    summary.monthsWithoutNewIncident === undefined
      ? null
      : Number(summary.monthsWithoutNewIncident);
  if (
    validated.open + validated.closed !== validated.total ||
    validated.critical > validated.total
  ) {
    throw new Error("Inconsistent incident summary totals.");
  }
  return validated;
}
export default function EmployeeModal({
  employee,
  onClose,
  initialOpenCompliance = false,
  initialComplianceDocumentId = "",
  initialComplianceDocumentName = "",
}) {
  const { user } = useAuth();

  const userRole =
    normalizeUserRole(
      user?.role
    );

  const isHRCoordinator =
    userRole ===
    "HR_COORDINATOR";

  const canExportEmployeeProfile =
    [
      "SUPER_ADMIN",
      "HR_MANAGER",
      "HR_STAFF",
      "HR_COORDINATOR",
    ].includes(
      userRole
    );

  const employeeName = getEmployeeName(employee);
  const employeeId = getEmployeeId(employee);

  const complianceTargetDocumentId =
    String(
      initialComplianceDocumentId ??
        ""
    ).trim();

  const complianceTargetDocumentName =
    String(
      initialComplianceDocumentName ??
        ""
    )
      .trim()
      .toLowerCase();

  const employeeBirthday = getEmployeeBirthday(employee);
  const employeeAge = getEmployeeAge(employeeBirthday);
  const employeeDateHired =
    getEmployeeDateHired(
      employee
    );
  const employeeWorkforceStatus =
    getEmployeeWorkforceStatus(
      employee
    );
  const employeeDeploymentDate =
    getEmployeeDeploymentDate(
      employee,
      employeeWorkforceStatus
    );
  const employeeEmploymentStatus =
    getEmployeeEmploymentStatus(
      employee,
      employeeWorkforceStatus
    );
  const employeeWorkforceStatusLabel =
    getWorkforceStatusLabel(
      employeeWorkforceStatus
    );
  const hasEmployee = Boolean(employee);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [isComplianceOpen, setIsComplianceOpen] =
    useState(
      Boolean(
        initialOpenCompliance
      )
    );
  const [reportAction, setReportAction] = useState("");
  const [reportError, setReportError] = useState("");
  const [historyRequest, setHistoryRequest] = useState({
    employeeId: "",
    incidents: [],
    loading: true,
    error: "",
  });
  const [summaryRequest, setSummaryRequest] = useState({
    employeeId: "",
    summary: null,
    loading: true,
    error: "",
  });
  const previewControllerRef = useRef(null);
  const previewUrlRef = useRef("");
  const complianceSectionRef = useRef(null);
  /*
   * ==================================================
   * COMPANY-SCOPED DETAILED INCIDENT HISTORY
   * ==================================================
   *
   * This endpoint must NOT be replaced by the
   * historical summary endpoint.
   *
   * HR Coordinators must never receive other-company
   * descriptions, sanctions, or evidence through the
   * Employee Modal.
   */
  useEffect(() => {
    if (!hasEmployee || !employeeId) {
      setHistoryRequest({
        employeeId: "",
        incidents: [],
        loading: false,
        error: "",
      });
      return undefined;
    }
    const controller = new AbortController();
    setHistoryRequest({
      employeeId,
      incidents: [],
      loading: true,
      error: "",
    });
    async function loadEmployeeIncidents() {
      try {
        const response = await authenticatedFetch(
          `${INCIDENT_API_URL}/employee/${encodeURIComponent(employeeId)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `Failed to load incidents. Status ${response.status}`
          );
        }
        if (!Array.isArray(data)) {
          throw new Error("Invalid incident history response.");
        }
        if (controller.signal.aborted) {
          return;
        }
        setHistoryRequest({
          employeeId,
          incidents: data.map(normalizeIncident),
          loading: false,
          error: "",
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          error?.name === "AbortError"
        ) {
          return;
        }
        console.error(
          "Employee incidents backend fetch failed:",
          error
        );
        setHistoryRequest({
          employeeId,
          incidents: [],
          loading: false,
          error:
            "Unable to load the latest incident history.",
        });
      }
    }
    void loadEmployeeIncidents();
    return () => {
      controller.abort();
    };
  }, [employeeId, hasEmployee]);
  /*
   * ==================================================
   * PROTECTED HISTORICAL INCIDENT SUMMARY
   * ==================================================
   *
   * Only HR_COORDINATOR calls this endpoint.
   *
   * The backend independently verifies that the
   * employee is currently assigned to the coordinator's
   * company before returning aggregate values.
   *
   * The response must contain statistics only.
   */
  useEffect(() => {
    if (
      !hasEmployee ||
      !employeeId ||
      !isHRCoordinator
    ) {
      setSummaryRequest({
        employeeId: "",
        summary: null,
        loading: false,
        error: "",
      });
      return undefined;
    }
    const controller = new AbortController();
    setSummaryRequest({
      employeeId,
      summary: null,
      loading: true,
      error: "",
    });
    async function loadHistoricalSummary() {
      try {
        const response = await authenticatedFetch(
          `${INCIDENT_API_URL}/employee/${encodeURIComponent(employeeId)}/summary`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `Failed to load historical summary. Status ${response.status}`
          );
        }
        const summary = parseHistoricalSummary(
          data,
          employeeId
        );
        if (controller.signal.aborted) {
          return;
        }
        setSummaryRequest({
          employeeId,
          summary,
          loading: false,
          error: "",
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          error?.name === "AbortError"
        ) {
          return;
        }
        console.error(
          "Employee historical incident summary fetch failed:",
          error
        );
        setSummaryRequest({
          employeeId,
          summary: null,
          loading: false,
          error:
            "Unable to load historical incident statistics. Risk and KPI indicators are unavailable.",
        });
      }
    }
    void loadHistoricalSummary();
    return () => {
      controller.abort();
    };
  }, [employeeId, hasEmployee, isHRCoordinator]);
  useEffect(() => {
    return () => {
      previewControllerRef.current?.abort();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
    };
  }, []);

  useEffect(() => {
    if (!hasEmployee) {
      return;
    }

    setIsComplianceOpen(
      Boolean(
        initialOpenCompliance
      )
    );
  }, [
    employeeId,
    hasEmployee,
    initialOpenCompliance,
  ]);

  useEffect(() => {
    if (!isComplianceOpen) {
      return undefined;
    }

    const scrollTimer =
      window.setTimeout(() => {
        const targetedDocument =
          complianceSectionRef.current
            ?.querySelector(
              '[data-compliance-notification-target="true"]'
            );

        (
          targetedDocument ||
          complianceSectionRef.current
        )?.scrollIntoView({
          behavior: "smooth",
          block:
            targetedDocument
              ? "center"
              : "start",
        });
      }, 120);

    return () => {
      window.clearTimeout(
        scrollTimer
      );
    };
  }, [
    complianceTargetDocumentId,
    complianceTargetDocumentName,
    isComplianceOpen,
  ]);
  /*
   * ==================================================
   * DOCUMENT SUMMARY
   * ==================================================
   */
  const documentSummary = useMemo(() => {
    const documents = parseEmployeeDocuments(
      employee?.documents
    ).map(normalizeDocument);
    return documents.reduce(
      (summary, document) => {
        summary.documents.push(document);
        if (document.status === "Expired") {
          summary.expired.push(document);
        } else if (document.status === "Expiring Soon") {
          summary.expiringSoon.push(document);
        } else if (document.status === "No Data") {
          summary.noData.push(document);
        }
        return summary;
      },
      {
        documents: [],
        expired: [],
        expiringSoon: [],
        noData: [],
      }
    );
  }, [employee?.documents]);
  /*
   * Guard against showing stale incident data when
   * the modal switches to a different employee.
   */
  const historyIsCurrent =
    historyRequest.employeeId === employeeId &&
    Boolean(employeeId);
  const historyLoading =
    hasEmployee &&
    (!historyIsCurrent || historyRequest.loading);
  const historyError = historyIsCurrent
    ? historyRequest.error
    : "";
  const historyAvailable =
    historyIsCurrent &&
    !historyRequest.loading &&
    !historyRequest.error;
  const employeeIncidents = useMemo(
    () => (historyAvailable ? historyRequest.incidents : []),
    [historyAvailable, historyRequest.incidents]
  );
  /*
   * Detailed incident summary for non-coordinator
   * roles. This preserves the original modal behavior.
   */
  const detailedIncidentSummary = useMemo(() => {
    const historicalSummary = employeeIncidents.reduce(
      (summary, incident) => {
        summary.total += 1;
        if (OPEN_INCIDENT_STATUSES.has(incident.status)) {
          summary.open += 1;
        }
        if (incident.status === "Closed") {
          summary.closed += 1;
        }
        if (incident.severity === "Critical") {
          summary.critical += 1;
        }
        return summary;
      },
      {
        ...EMPTY_INCIDENT_SUMMARY,
      }
    );
    const severitySnapshot =
      calculateSeveritySnapshot(employeeIncidents);

    return {
      ...historicalSummary,
      activeTotal:
        severitySnapshot.activeViolationCount,
      activeCritical:
        severitySnapshot.activeCriticalIncidentCount,
      severityScore:
        severitySnapshot.activeSeverityScore,
      historicalSeverityScore:
        severitySnapshot.historicalSeverityScore,
      activeSeverityScore:
        severitySnapshot.activeSeverityScore,
      behaviorTrend:
        severitySnapshot.behaviorTrend,
      monthsWithoutNewIncident:
        severitySnapshot.monthsWithoutNewIncident,
    };
  }, [employeeIncidents]);
  /*
   * The coordinator's historical summary is usable
   * only when it belongs to the selected employee
   * and the request completed successfully.
   */
  const summaryIsCurrent =
    summaryRequest.employeeId === employeeId &&
    Boolean(employeeId);
  const historicalSummaryLoading =
    hasEmployee &&
    isHRCoordinator &&
    (!summaryIsCurrent || summaryRequest.loading);
  const historicalSummaryError =
    isHRCoordinator && summaryIsCurrent
      ? summaryRequest.error
      : "";
  const historicalSummaryAvailable =
    isHRCoordinator &&
    summaryIsCurrent &&
    !summaryRequest.loading &&
    !summaryRequest.error &&
    summaryRequest.summary !== null;
  /*
   * IMPORTANT:
   * Never fall back to company-scoped incidents when
   * the coordinator's historical summary fails.
   *
   * Such a fallback would incorrectly turn a previous
   * company's incident history into zero incidents.
   */
  const incidentSummary = isHRCoordinator
    ? historicalSummaryAvailable
      ? summaryRequest.summary
      : null
    : historyAvailable
      ? detailedIncidentSummary
      : null;
  const incidentSummaryLoading = isHRCoordinator
    ? historicalSummaryLoading
    : historyLoading;
  const incidentSummaryAvailable =
    incidentSummary !== null;
  /*
   * KPI and Risk computation uses the SAME incident
   * totals currently displayed in the summary cards.
   *
   * This preserves the existing score thresholds:
   *
   * Minor = 1
   * Major = 3
   * Critical = 5
   */
  const decisionSupport = useMemo(() => {
    if (!incidentSummary) {
      return {
        kpiLevel: "Unavailable",
        riskLevel: "Unavailable",
        recommendation: "Unavailable",
        reason:
          "Incident statistics are unavailable. No recommendation can be generated from incomplete data.",
      };
    }
    const kpiLevel = getKPILevel(
      incidentSummary.activeSeverityScore ??
        incidentSummary.severityScore,
      incidentSummary.activeTotal ??
        incidentSummary.total
    );
    const riskLevel = getRiskLevel({
      kpiLevel,
      totalIncidents:
        incidentSummary.activeTotal ??
        incidentSummary.total,
      criticalIncidents:
        incidentSummary.activeCritical ??
        incidentSummary.critical,
    });
    /*
     * Historical aggregate statistics may contain
     * confidential cases from previous companies.
     *
     * Do not generate a disciplinary recommendation
     * for HR Coordinator solely from those aggregates.
     */
    if (isHRCoordinator) {
      if (incidentSummary.total > 0) {
        return {
          kpiLevel,
          riskLevel,
          recommendation: "HR Review Required",
          reason:
            "The incident indicators include recorded cases from previous and current company assignments. " +
            "This summary is for awareness only. Detailed assessment and any disciplinary action require review " +
            "by authorized HR management.",
        };
      }
      return {
        kpiLevel,
        riskLevel,
        recommendation: "Retain",
        reason:
          "No recorded incidents were found in the employee's overall incident summary. " +
          "Continue regular HR monitoring.",
      };
    }
    return {
      kpiLevel,
      riskLevel,
      ...getRecommendationDecision({
        totalIncidents:
          incidentSummary.activeTotal ??
          incidentSummary.total,
        criticalIncidents:
          incidentSummary.activeCritical ??
          incidentSummary.critical,
        riskLevel,
      }),
    };
  }, [incidentSummary, isHRCoordinator]);
  const recentIncidents = useMemo(
    () =>
      [...employeeIncidents]
        .sort(
          (first, second) =>
            getIncidentTimestamp(second) -
            getIncidentTimestamp(first)
        )
        .slice(0, 5),
    [employeeIncidents]
  );
  if (!employee) {
    return null;
  }
  const {
    documents,
    expired,
    expiringSoon,
    noData,
  } = documentSummary;
  const {
    kpiLevel,
    riskLevel,
    recommendation,
    reason,
  } = decisionSupport;
  const hasAttentionNeeded =
    expired.length > 0 ||
    expiringSoon.length > 0 ||
    noData.length > 0;
  const companyDisplay =
    String(
      employee?.company ||
      ""
    ).trim() ||
    "Not recorded";

  const positionDisplay =
    String(
      employee?.position ||
      employee?.jobTitle ||
      employee?.job_title ||
      employee?.jobPosition ||
      employee?.job_position ||
      ""
    ).trim() ||
    "Not recorded";

  const placementWorkflowNote =
    getPlacementWorkflowNote(
      employeeWorkforceStatus
    );

  const employeeInitials =
    getEmployeeInitials(employeeName);
  /*
   * Loading and unavailable indicators must not be
   * displayed as genuine KPI or Risk classifications.
   */
  const displayedRiskLevel = incidentSummaryLoading
    ? "Loading..."
    : riskLevel;
  const displayedKPILevel = incidentSummaryLoading
    ? "Loading..."
    : kpiLevel;
  const displayedRecommendation = incidentSummaryLoading
    ? "Loading..."
    : recommendation;
  const displayedRecommendationReason = incidentSummaryLoading
    ? "Loading incident statistics..."
    : reason;
  const getDisplayedStatistic = (field) => {
    if (incidentSummaryLoading) {
      return "...";
    }
    if (!incidentSummaryAvailable) {
      return "Unavailable";
    }
    return incidentSummary[field];
  };

  const employeeReportReady =
    canExportEmployeeProfile &&
    historyAvailable &&
    !historyLoading &&
    !historyError;

  const employeeReportDisabled =
    !employeeReportReady ||
    Boolean(
      reportAction
    );

  const handleDownloadEmployeeReport =
    async () => {
      if (
        !employeeReportReady
      ) {
        setReportError(
          historyLoading
            ? "Please wait until the employee incident history finishes loading."
            : "Employee incident history is unavailable. A complete profile report cannot be generated."
        );

        return;
      }

      setReportError(
        ""
      );

      setReportAction(
        "download"
      );

      try {
        const doc =
          await buildEmployeeProfilePdf({
            employee,
            employeeIncidents,
            user,
            isHRCoordinator,
          });

        const safeName =
          sanitizeReportFilePart(
            employeeName
          );

        const safeId =
          sanitizeReportFilePart(
            employeeId ||
              "No_ID"
          );

        const dateStamp =
          getEmployeeReportFilenameDate();

        doc.save(
          `Welljob_Employee_Profile_${safeId}_${safeName}_${dateStamp}.pdf`
        );
      } catch (error) {
        console.error(
          "Employee profile PDF download failed:",
          error
        );

        setReportError(
          "Unable to generate the employee profile PDF."
        );
      } finally {
        setReportAction(
          ""
        );
      }
    };

  const handlePrintEmployeeReport =
    async () => {
      if (
        !employeeReportReady
      ) {
        setReportError(
          historyLoading
            ? "Please wait until the employee incident history finishes loading."
            : "Employee incident history is unavailable. A complete profile report cannot be generated."
        );

        return;
      }

      /*
       * Open the print target immediately from the user
       * click so browser popup blockers do not treat the
       * later PDF navigation as an unsolicited popup.
       */
      const printWindow =
        window.open(
          "",
          "_blank"
        );

      if (!printWindow) {
        setReportError(
          "The browser blocked the print window. Please allow pop-ups for this site and try again."
        );

        return;
      }

      printWindow.opener =
        null;

      printWindow.document.write(
        "<!doctype html><html><head><title>Preparing Employee Profile Report</title></head><body style='font-family:Arial,sans-serif;padding:24px'>Preparing employee profile report...</body></html>"
      );

      setReportError(
        ""
      );

      setReportAction(
        "print"
      );

      try {
        const doc =
          await buildEmployeeProfilePdf({
            employee,
            employeeIncidents,
            user,
            isHRCoordinator,
          });

        if (
          typeof doc.autoPrint ===
          "function"
        ) {
          doc.autoPrint();
        }

        const blob =
          doc.output(
            "blob"
          );

        const blobUrl =
          URL.createObjectURL(
            blob
          );

        printWindow.location.replace(
          blobUrl
        );

        window.setTimeout(
          () => {
            URL.revokeObjectURL(
              blobUrl
            );
          },
          60_000
        );
      } catch (error) {
        console.error(
          "Employee profile PDF print failed:",
          error
        );

        printWindow.close();

        setReportError(
          "Unable to prepare the employee profile report for printing."
        );
      } finally {
        setReportAction(
          ""
        );
      }
    };

  const handleToggleCompliance = () => {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(12);
    }

    setIsComplianceOpen((current) => !current);
  };

  const handleCloseEmployee = () => {
    if (!previewFile) {
      onClose?.();
    }
  };
  const handleClosePreview = () => {
    previewControllerRef.current?.abort();
    previewControllerRef.current = null;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewFile(null);
    setPreviewLoadingId(null);
  };
  const handleViewDocument = async (file) => {
    previewControllerRef.current?.abort();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    const controller = new AbortController();
    previewControllerRef.current = controller;
    setPreviewFile(null);
    setPreviewError("");
    setPreviewLoadingId(file.documentId);
    try {
      const result = await fetchEmployeeDocumentPreview(
        file.documentId,
        {
          signal: controller.signal,
        }
      );
      if (controller.signal.aborted) {
        URL.revokeObjectURL(result.url);
        return;
      }
      previewUrlRef.current = result.url;
      setPreviewFile({
        url: result.url,
        type: result.mimeType,
        name: file.name,
      });
    } catch (error) {
      if (
        error?.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }

      console.error(
        "Employee document preview failed:",
        error
      );

      setPreviewError(
        "Unable to open this document. Please try again."
      );
    } finally {
      if (!controller.signal.aborted) {
        setPreviewLoadingId(null);
      }
    }
  };
  return (
    <>
      <Dialog
        open={!previewFile}
        onClose={handleCloseEmployee}
        title={`${employeeName} employee record`}
        description="View employee information, incidents, compliance records, and recommended actions."
        size="xl"
        height="xl"
        showHeader={false}
        showCloseButton={false}
        closeOnOverlay
        closeOnEscape
        scrollBody={false}
        bodyClassName="min-h-0 flex-1 p-0"
        className="border-slate-200 dark:border-slate-800"
      >
        <div className="flex h-full min-h-0 flex-col bg-slate-50/60 dark:bg-slate-950">
          <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Employee Overview
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Employee identity and record overview.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canExportEmployeeProfile && (
                  <>
                    <IconButton
                      label={`Download ${employeeName} employee profile PDF`}
                      title={
                        historyLoading
                          ? "Incident history is still loading"
                          : historyError
                            ? "Incident history is unavailable"
                            : reportAction === "download"
                              ? "Generating PDF..."
                              : "Download employee profile PDF"
                      }
                      variant="ghost"
                      size="md"
                      disabled={
                        employeeReportDisabled
                      }
                      onClick={() =>
                        void handleDownloadEmployeeReport()
                      }
                    >
                      <FiDownload
                        aria-hidden="true"
                      />
                    </IconButton>

                    <IconButton
                      label={`Print ${employeeName} employee profile`}
                      title={
                        historyLoading
                          ? "Incident history is still loading"
                          : historyError
                            ? "Incident history is unavailable"
                            : reportAction === "print"
                              ? "Preparing print report..."
                              : "Print employee profile"
                      }
                      variant="ghost"
                      size="md"
                      disabled={
                        employeeReportDisabled
                      }
                      onClick={() =>
                        void handlePrintEmployeeReport()
                      }
                    >
                      <FiPrinter
                        aria-hidden="true"
                      />
                    </IconButton>
                  </>
                )}

                <IconButton
                  label="Close employee details"
                  title="Close"
                  variant="ghost"
                  size="md"
                  onClick={handleCloseEmployee}
                >
                  <FiX aria-hidden="true" />
                </IconButton>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {employeeInitials}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
                        {employeeName}
                      </p>

                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {employeeId || "-"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Employee record and workforce information
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <StatusPill
                    className={getClassName(
                      STATUS_CLASSES,
                      employeeEmploymentStatus,
                      "Inactive"
                    )}
                    icon={
                      <FiShield aria-hidden="true" />
                    }
                  >
                    Employment:{" "}
                    {employeeEmploymentStatus ||
                      "Not recorded"}
                  </StatusPill>

                  <StatusPill
                    className={getClassName(
                      STATUS_CLASSES,
                      employeeWorkforceStatus,
                      "Floating / Standby"
                    )}
                    icon={
                      <FiBriefcase aria-hidden="true" />
                    }
                  >
                    Workforce:{" "}
                    {employeeWorkforceStatusLabel}
                  </StatusPill>
                </div>
              </div>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-slate-900 dark:text-slate-100 sm:px-6 sm:py-5">
            <div className="mx-auto max-w-[1500px] space-y-5">
              {historicalSummaryError && (
                <AlertBox tone="warning">
                  {historicalSummaryError}
                </AlertBox>
              )}
              {historyError && (
                <AlertBox tone="warning">
                  {historyError}
                </AlertBox>
              )}
              {previewError && (
                <AlertBox tone="danger">
                  {previewError}
                </AlertBox>
              )}

              {reportError && (
                <AlertBox tone="danger">
                  {reportError}
                </AlertBox>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SectionTitle
                  title="Employee Information"
                  description="Employment, personal, and workforce placement details."
                />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoBox
                    label="Birthday"
                    value={
                      employeeBirthday
                        ? formatDate(
                            employeeBirthday
                          )
                        : "Not yet recorded"
                    }
                  />

                  <InfoBox
                    label="Age"
                    value={
                      employeeAge !== null
                        ? `${employeeAge} year${employeeAge === 1 ? "" : "s"} old`
                        : "Not available"
                    }
                  />

                  <InfoBox
                    label="Date Hired"
                    value={
                      employeeDateHired
                        ? formatDate(
                            employeeDateHired
                          )
                        : "Not yet recorded"
                    }
                  />

                  <InfoBox
                    label="Client Company"
                    value={
                      companyDisplay
                    }
                  />

                  <InfoBox
                    label="Position"
                    value={
                      positionDisplay
                    }
                  />

                  <InfoBox
                    label="Deployment Date"
                    value={
                      employeeWorkforceStatus ===
                        "Deployed"
                        ? (
                            employeeDeploymentDate
                              ? formatDate(
                                  employeeDeploymentDate
                                )
                              : "Not recorded"
                          )
                        : "Not yet deployed"
                    }
                  />
                </div>

                <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-200">
                  {placementWorkflowNote}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SectionTitle
                  title="Incident & KPI Summary"
                  description={
                    isHRCoordinator
                      ? "Overall statistics may include incidents from previous and current company assignments."
                      : "Current incident totals and system-generated employee indicators."
                  }
                />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatBox
                    label="Total Incidents"
                    value={getDisplayedStatistic("total")}
                  />
                  <StatBox
                    label="Open Cases"
                    value={getDisplayedStatistic("open")}
                    valueClassName="text-rose-600 dark:text-rose-300"
                  />
                  <StatBox
                    label="Closed Cases"
                    value={getDisplayedStatistic("closed")}
                    valueClassName="text-emerald-600 dark:text-emerald-300"
                  />
                  <StatBox
                    label="Current Severity Score"
                    value={getDisplayedStatistic("activeSeverityScore")}
                  />
                  <StatBox
                    label="Historical Severity Score"
                    value={getDisplayedStatistic("historicalSeverityScore")}
                  />
                  <StatBox
                    label="Behavior Trend"
                    value={getDisplayedStatistic("behaviorTrend")}
                  />
                  <MetricBadgeBox
                    label="Risk Level"
                    value={displayedRiskLevel}
                    className={getClassName(
                      RISK_CLASSES,
                      displayedRiskLevel,
                      "Unavailable"
                    )}
                  />
                  <MetricBadgeBox
                    label="KPI Level"
                    value={displayedKPILevel}
                    className={getClassName(
                      KPI_CLASSES,
                      displayedKPILevel,
                      "Unavailable"
                    )}
                  />
                </div>
                {isHRCoordinator && (
                  <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Previous-company incident details remain restricted. Only authorized incident details are shown below.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SectionTitle
                  title="Recommended Action"
                  description="Suggested action based on the available incident indicators. Final decisions remain with authorized HR management."
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <StatusPill
                    className={getClassName(
                      RECOMMENDATION_CLASSES,
                      displayedRecommendation,
                      "Unavailable"
                    )}
                  >
                    {displayedRecommendation}
                  </StatusPill>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {displayedRecommendationReason}
                  </p>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SectionTitle
                  title="Recent Incident History"
                  description={
                    isHRCoordinator
                      ? "Detailed records are limited to incidents you are authorized to view for your assigned company."
                      : "Up to five of the most recent incident records for this employee."
                  }
                />
                {historyLoading ? (
                  <EmptyBox text="Loading incident history..." />
                ) : historyError ? (
                  <EmptyBox text="Incident history is unavailable." />
                ) : recentIncidents.length === 0 ? (
                  <EmptyBox
                    text={
                      isHRCoordinator &&
                      incidentSummaryAvailable &&
                      incidentSummary.total > 0
                        ? "The overall summary contains recorded incidents, but no detailed incident records are available for your assigned company."
                        : "No incident history found for this employee."
                    }
                  />
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {recentIncidents.map((incident, index) => (
                      <article
                        key={`${incident.id}-${index}`}
                        className="px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {incident.violation || "No violation type"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {incident.displayId} •{" "}
                              {formatDate(
                                incident.reportedAt ||
                                  incident.date
                              )}
                            </p>
                            {incident.description && (
                              <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                                {incident.description}
                              </p>
                            )}
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                Sanction:
                              </span>{" "}
                              {incident.sanction || "For HR Review"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <StatusPill
                              className={getClassName(
                                STATUS_CLASSES,
                                incident.status,
                                "Open"
                              )}
                            >
                              {incident.status || "Open"}
                            </StatusPill>
                            <StatusPill
                              className={getClassName(
                                KPI_CLASSES,
                                getSeverityKPILevel(
                                  incident.severity
                                ),
                                "Minor Concern"
                              )}
                            >
                              {incident.severity || "Minor"}
                            </StatusPill>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <section
                ref={complianceSectionRef}
                className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset dark:hover:bg-slate-800/50"
                  aria-expanded={isComplianceOpen}
                  aria-controls="employee-compliance-documents"
                  onClick={handleToggleCompliance}
                >
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Compliance Documents
                  </span>

                  <FiChevronDown
                    aria-hidden="true"
                    className={[
                      "shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400",
                      isComplianceOpen ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </button>

                {isComplianceOpen && (
                  <div
                    id="employee-compliance-documents"
                    className="border-t border-slate-200 px-4 pb-4 pt-4 dark:border-slate-800"
                  >
                    <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Document numbers, submitted files, and expiration details.
                    </p>

                    {hasAttentionNeeded && (
                      <div
                        className={[
                          "mb-4 rounded-xl border px-4 py-3",
                          expired.length
                            ? "border-rose-200 bg-rose-50 dark:border-rose-500/25 dark:bg-rose-500/10"
                            : "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-3">
                          <FiAlertTriangle
                            aria-hidden="true"
                            className={[
                              "mt-0.5 shrink-0",
                              expired.length
                                ? "text-rose-600 dark:text-rose-300"
                                : "text-amber-600 dark:text-amber-300",
                            ].join(" ")}
                          />

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              Compliance Follow-up Needed
                            </p>

                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                              {expired.length > 0 && (
                                <span>{expired.length} expired</span>
                              )}

                              {expiringSoon.length > 0 && (
                                <span>{expiringSoon.length} expiring soon</span>
                              )}

                              {noData.length > 0 && (
                                <span>{noData.length} missing file or date</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {documents.length === 0 ? (
                      <EmptyBox text="No compliance documents are recorded for this employee." />
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {documents.map((document) => {
                          const isExpired =
                            document.status === "Expired";
                          const isExpiringSoon =
                            document.status === "Expiring Soon";
                          const isNoData =
                            document.status === "No Data";

                          const documentId =
                            String(
                              document?.id ??
                                document?.documentId ??
                                document?.document_id ??
                                ""
                            ).trim();

                          const documentName =
                            String(
                              document?.name ||
                                ""
                            )
                              .trim()
                              .toLowerCase();

                          const isComplianceNotificationTarget =
                            (
                              Boolean(
                                complianceTargetDocumentId
                              ) &&
                              documentId ===
                                complianceTargetDocumentId
                            ) ||
                            (
                              Boolean(
                                complianceTargetDocumentName
                              ) &&
                              documentName ===
                                complianceTargetDocumentName
                            );

                          return (
                            <article
                              key={document.name}
                              data-compliance-notification-target={
                                isComplianceNotificationTarget
                                  ? "true"
                                  : undefined
                              }
                              className={[
                                "px-4 py-3 transition-colors",
                                isComplianceNotificationTarget
                                  ? isExpired
                                    ? "bg-rose-50/80 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/30"
                                    : isExpiringSoon
                                      ? "bg-amber-50/80 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30"
                                      : "bg-indigo-50/70 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-500/30"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                  <div
                                    className={[
                                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                      isExpired
                                        ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
                                        : isExpiringSoon
                                          ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
                                          : isNoData
                                            ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                            : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300",
                                    ].join(" ")}
                                  >
                                    <FiFileText
                                      size={16}
                                      aria-hidden="true"
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                      {document.name}
                                    </p>

                                    {document.requiresDocumentNumber && (
                                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                                          {document.documentNumberLabel}:
                                        </span>

                                        <span
                                          className={[
                                            "break-all font-bold tabular-nums",
                                            document.documentNumber
                                              ? "text-slate-800 dark:text-slate-200"
                                              : "text-amber-600 dark:text-amber-300",
                                          ].join(" ")}
                                        >
                                          {document.documentNumber ||
                                            "Not yet recorded"}
                                        </span>
                                      </div>
                                    )}

                                    {document.expirable ? (
                                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center gap-1.5">
                                          <FiCalendar aria-hidden="true" />
                                          {document.expirationDate
                                            ? formatDate(
                                                document.expirationDate
                                              )
                                            : "Expiration not set"}
                                        </span>

                                        <span className="inline-flex items-center gap-1.5">
                                          <FiClock aria-hidden="true" />
                                          {getDaysLabel(
                                            document.expirationDate
                                          )}
                                        </span>
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Permanent compliance document
                                      </p>
                                    )}

                                    {!document.file && (
                                      <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-300">
                                        File not uploaded
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                  <StatusPill
                                    className={getClassName(
                                      STATUS_CLASSES,
                                      document.status,
                                      "No Data"
                                    )}
                                    icon={
                                      isExpired ||
                                      isExpiringSoon ||
                                      isNoData ? (
                                        <FiAlertTriangle aria-hidden="true" />
                                      ) : (
                                        <FiCheckCircle aria-hidden="true" />
                                      )
                                    }
                                  >
                                    {document.status ===
                                    "No Data"
                                      ? "Incomplete"
                                      : document.status}
                                  </StatusPill>

                                  {document.file && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      leftIcon={
                                        <FiEye aria-hidden="true" />
                                      }
                                      loading={
                                        previewLoadingId ===
                                        document.file.documentId
                                      }
                                      disabled={
                                        previewLoadingId !== null
                                      }
                                      onClick={() =>
                                        void handleViewDocument(
                                          document.file
                                        )
                                      }
                                    >
                                      View File
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
          <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            <Button onClick={handleCloseEmployee}>
              Close
            </Button>
          </footer>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(previewFile)}
        onClose={handleClosePreview}
        title="File Preview"
        description={
          previewFile?.name ||
          "Uploaded compliance document"
        }
        size="xl"
        height="xl"
        tone="neutral"
        closeOnOverlay
        closeOnEscape
        scrollBody={false}
        bodyClassName="min-h-0 flex-1 p-4"
        footer={
          <Button
            variant="secondary"
            onClick={handleClosePreview}
          >
            Close Preview
          </Button>
        }
      >
        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-950/50">
          {previewFile?.type?.startsWith("image/") ||
          previewFile?.type === "image/*" ? (
            <img
              src={previewFile.url}
              alt={
                previewFile.name ||
                "Uploaded file preview"
              }
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <iframe
              src={previewFile?.url}
              title={
                previewFile?.name ||
                "Uploaded file preview"
              }
              className="h-full min-h-[60vh] w-full rounded-lg border border-slate-200 dark:border-slate-800"
            />
          )}
        </div>
      </Dialog>
    </>
  );
}
function StatusPill({
  children,
  className,
  icon = null,
}) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      {children}
    </span>
  );
}
function SectionTitle({
  title,
  description,
}) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}
function InfoBox({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
  valueClassName = "text-slate-900 dark:text-slate-100",
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={[
          "mt-1 break-words text-lg font-bold leading-tight tabular-nums sm:text-xl",
          valueClassName,
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
function MetricBadgeBox({
  label,
  value,
  className,
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="mb-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <StatusPill
        className={[
          "max-w-full whitespace-normal break-words text-center leading-4",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </StatusPill>
    </div>
  );
}
function EmptyBox({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 dark:border-slate-700 dark:bg-slate-950/60">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {text}
      </p>
    </div>
  );
}
function AlertBox({
  children,
  tone = "warning",
}) {
  const toneClasses =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300";
  return (
    <div
      role="alert"
      className={[
        "rounded-xl border px-4 py-3 text-sm font-medium",
        toneClasses,
      ].join(" ")}
    >
      {children}
    </div>
  );
}