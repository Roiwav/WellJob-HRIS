import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiShield,
  FiX,
} from "react-icons/fi";
import {
  getDaysUntilExpiration,
  normalizeEmployeeStatus,
} from "../../utils/employees/employeeHelpers";
import {
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
const SEVERITY_WEIGHTS = {
  Critical: 5,
  Major: 3,
  Minor: 1,
};
const EMPTY_INCIDENT_SUMMARY = Object.freeze({
  total: 0,
  open: 0,
  closed: 0,
  critical: 0,
  severityScore: 0,
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
  Deployed:
    "border border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300",
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
function formatDate(value) {
  if (!value) return "Not Set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
function getOverallCompliance(documents) {
  if (!documents.length) {
    return "No Data";
  }
  const statuses = documents.map(({ status }) => status);
  if (statuses.includes("Expired")) {
    return "Expired";
  }
  if (statuses.includes("Expiring Soon")) {
    return "Expiring Soon";
  }
  if (statuses.includes("No Data")) {
    return "Incomplete";
  }
  if (statuses.every((status) => status === "Valid")) {
    return "Valid";
  }
  return "Incomplete";
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
  const file = buildDocumentFile(document);
  const expirable = EXPIRABLE_DOCUMENT_NAMES.has(document.name);
  return {
    ...document,
    expirationDate,
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
    "severityScore",
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
  if (
    validated.open + validated.closed !== validated.total ||
    validated.critical > validated.total
  ) {
    throw new Error("Inconsistent incident summary totals.");
  }
  return validated;
}
export default function EmployeeModal({ employee, onClose }) {
  const { user } = useAuth();
  const isHRCoordinator =
    user?.role === "HR_COORDINATOR";
  const employeeName = getEmployeeName(employee);
  const employeeId = getEmployeeId(employee);
  const employeeStatus = normalizeEmployeeStatus(employee?.status);
  const hasEmployee = Boolean(employee);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [previewError, setPreviewError] = useState("");
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
            "Unable to load the latest incident history from backend.",
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
    return employeeIncidents.reduce(
      (summary, incident) => {
        summary.total += 1;
        summary.severityScore +=
          SEVERITY_WEIGHTS[incident.severity] || 0;
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
      incidentSummary.severityScore,
      incidentSummary.total
    );
    const riskLevel = getRiskLevel({
      kpiLevel,
      totalIncidents: incidentSummary.total,
      criticalIncidents: incidentSummary.critical,
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
        totalIncidents: incidentSummary.total,
        criticalIncidents: incidentSummary.critical,
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
  const overallCompliance =
    getOverallCompliance(documents);
  const hasAttentionNeeded =
    expired.length > 0 ||
    expiringSoon.length > 0 ||
    noData.length > 0;
  const companyDisplay =
    employeeStatus === "Floating / Standby" ||
    employeeStatus === "Inactive"
      ? "Not Assigned"
      : employee.company || "Not Assigned";
  const positionDisplay =
    employeeStatus === "Deployed"
      ? employee?.position ||
        employee?.jobTitle ||
        employee?.job_title ||
        ""
      : "";
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
      setPreviewError(
        error?.message ||
          "Unable to load this document preview."
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
        description="View employee profile, compliance condition, incident history, and system recommendation."
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
                  Core employee assignment and compliance information.
                </p>
              </div>
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <FiBriefcase aria-hidden="true" />
                        {companyDisplay}
                      </span>
                      {positionDisplay && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="font-medium">{positionDisplay}</span>
                        </>
                      )}
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <FiShield aria-hidden="true" />
                        {employeeStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                  <StatusPill
                    className={getClassName(
                      STATUS_CLASSES,
                      overallCompliance,
                      "No Data"
                    )}
                    icon={
                      ["Expired", "Expiring Soon"].includes(overallCompliance) ? (
                        <FiAlertTriangle aria-hidden="true" />
                      ) : null
                    }
                  >
                    Compliance: {overallCompliance}
                  </StatusPill>
                  <StatusPill
                    className={getClassName(
                      RISK_CLASSES,
                      displayedRiskLevel,
                      "Unavailable"
                    )}
                    icon={
                      riskLevel === "High Risk" && !incidentSummaryLoading ? (
                        <FiAlertTriangle aria-hidden="true" />
                      ) : null
                    }
                  >
                    Risk: {displayedRiskLevel}
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
              {hasAttentionNeeded && (
                <div
                  className={[
                    "rounded-2xl border px-4 py-3",
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
                        Compliance attention needed
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
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SectionTitle
                  title="Incident & KPI Summary"
                  description={
                    isHRCoordinator
                      ? "Overall statistics may include incidents from previous and current company assignments."
                      : "Current incident totals and system-generated employee indicators."
                  }
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
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
                    label="Severity Score"
                    value={getDisplayedStatistic("severityScore")}
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
                  title="System Recommendation"
                  description="Decision-support guidance based on the incident indicators currently available."
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
                  <EmptyBox text="Loading incident history from backend..." />
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
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SectionTitle
                  title="Compliance Documents"
                  description="Uploaded compliance files and their current expiration condition."
                />
                {documents.length === 0 ? (
                  <EmptyBox text="No compliance documents found for this employee." />
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {documents.map((document) => {
                      const isExpired =
                        document.status === "Expired";
                      const isExpiringSoon =
                        document.status === "Expiring Soon";
                      const isNoData =
                        document.status === "No Data";
                      return (
                        <article
                          key={document.name}
                          className="px-4 py-3"
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
                                    No uploaded file found
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
                                {document.status}
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
function StatBox({
  label,
  value,
  valueClassName = "text-slate-900 dark:text-slate-100",
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={[
          "mt-1 text-xl font-bold tabular-nums",
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="mb-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <StatusPill className={className}>
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