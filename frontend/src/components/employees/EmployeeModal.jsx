import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiShield,
  FiUser,
  FiX,
} from "react-icons/fi";

import {
  getDaysUntilExpiration,
  normalizeEmployeeStatus,
  normalizeText,
} from "../../utils/employees/employeeHelpers";
import {
  parseEmployeeDocuments,
} from "../../utils/employees/employeeFormHelpers";

import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import IconButton from "../ui/IconButton";

import {
  DOCUMENT_OPTIONS,
  getDocumentStatus as getExpirationStatus,
} from "./employeeConstants";

const API_BASE_URL = "http://localhost:5000";
const INCIDENT_API_URL = `${API_BASE_URL}/api/incidents`;

const EXPIRABLE_DOCUMENT_NAMES = new Set(
  DOCUMENT_OPTIONS.filter(({ expirable }) => expirable).map(({ name }) => name)
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

const STATUS_CLASSES = {
  Valid:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
  "Expiring Soon":
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",
  Expired:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
  "No Data":
    "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-300",
  Incomplete:
    "border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300",
  Inactive:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300",
  Deployed:
    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",
  "Floating / Standby":
    "border border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300",
  Open:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
  Investigating:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",
  "For Review":
    "border border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-300",
  Closed:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
};

const RISK_CLASSES = {
  "High Risk":
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
  Repeat:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",
  Monitor:
    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",
  "Low Risk":
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
};

const KPI_CLASSES = {
  "Critical Concern":
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
  "Needs Improvement":
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",
  "Minor Concern":
    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",
  "Good Standing":
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
};

const RECOMMENDATION_CLASSES = {
  Retain:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
  "Monitor Employee":
    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",
  "Final Warning":
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",
  "Suspension Review":
    "border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300",
  "Termination Review":
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
};

function getClassName(classes, value, fallback) {
  return classes[value] || classes[fallback];
}

function formatIncidentId(id) {
  if (!id) return "-";

  const value = String(id);
  if (value.startsWith("INC-")) return value;

  const numericValue = Number(value);
  return Number.isNaN(numericValue)
    ? value
    : `INC-${String(numericValue).padStart(4, "0")}`;
}

function formatDate(value) {
  if (!value) return "Not Set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

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

  if (value === "resolved" || value === "closed") return "Closed";
  if (value === "for review") return "For Review";
  if (value === "investigating") return "Investigating";

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
    return `Expired ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
  }

  if (daysRemaining === 0) return "Expires today";

  return `Expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
}

function getOverallCompliance(documents) {
  if (!documents.length) return "No Data";

  const statuses = documents.map(({ status }) => status);

  if (statuses.includes("Expired")) return "Expired";
  if (statuses.includes("Expiring Soon")) return "Expiring Soon";
  if (statuses.includes("No Data")) return "Incomplete";
  if (statuses.every((status) => status === "Valid")) return "Valid";

  return "Incomplete";
}

function getKPILevel(severityScore, totalIncidents) {
  if (severityScore >= 8) return "Critical Concern";
  if (severityScore >= 4) return "Needs Improvement";
  if (totalIncidents >= 1) return "Minor Concern";

  return "Good Standing";
}

function getRiskLevel({ kpiLevel, totalIncidents, criticalIncidents }) {
  if (criticalIncidents >= 1 || kpiLevel === "Critical Concern") {
    return "High Risk";
  }

  if (kpiLevel === "Needs Improvement") return "Repeat";
  if (kpiLevel === "Minor Concern" || totalIncidents >= 1) return "Monitor";

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
      reason: `Employee has ${criticalIncidents} critical incident(s), requiring termination review.`,
    };
  }

  if (criticalIncidents >= 1 || riskLevel === "High Risk") {
    return {
      recommendation: "Suspension Review",
      reason:
        "Employee has critical or high-risk incident records requiring suspension review.",
    };
  }

  if (totalIncidents >= 3 || riskLevel === "Repeat") {
    return {
      recommendation: "Final Warning",
      reason:
        "Employee has repeated violations and should receive final warning.",
    };
  }

  if (totalIncidents >= 1 || riskLevel === "Monitor") {
    return {
      recommendation: "Monitor Employee",
      reason: "Employee has recorded violation(s) and should be monitored.",
    };
  }

  return {
    recommendation: "Retain",
    reason: "Employee has no recorded violation and may be retained.",
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
    employee?.id || employee?.employeeId || employee?.employee_id || ""
  );
}

function getEmployeeName(employee) {
  return (
    employee?.name ||
    employee?.fullName ||
    employee?.full_name ||
    "Employee"
  );
}

function isSameEmployee(employee, incident) {
  const employeeId = getEmployeeId(employee);
  const employeeName = normalizeText(getEmployeeName(employee));

  const incidentEmployeeId = String(
    incident?.employeeId || incident?.employee_id || incident?.empId || ""
  );

  const incidentEmployeeName = normalizeText(
    incident?.employee ||
      incident?.employeeName ||
      incident?.employee_name ||
      ""
  );

  return (
    (Boolean(employeeId) && employeeId === incidentEmployeeId) ||
    (Boolean(employeeName) && employeeName === incidentEmployeeName)
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
  if (document.file?.url) return document.file;

  const rawPath =
    document.filePath ||
    document.file_path ||
    document.url ||
    (typeof document.file === "string" ? document.file : "");

  if (!rawPath) return null;

  const normalizedPath = String(rawPath).replace(/\\/g, "/");
  const url = /^(https?:|blob:|data:)/i.test(normalizedPath)
    ? normalizedPath
    : `${API_BASE_URL}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;

  const cleanPath = normalizedPath.toLowerCase().split("?")[0];

  return {
    url,
    name:
      document.fileName ||
      document.file_name ||
      normalizedPath.split("/").pop()?.split("?")[0] ||
      document.name ||
      "Uploaded file",
    type: cleanPath.endsWith(".pdf") ? "application/pdf" : "image/*",
  };
}

function normalizeDocument(document = {}) {
  const expirationDate =
    document.expirationDate || document.expiration_date || "";

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
  if (severity === "Critical") return "Critical Concern";
  if (severity === "Major") return "Needs Improvement";
  return "Minor Concern";
}

export default function EmployeeModal({ employee, onClose }) {
  const [previewFile, setPreviewFile] = useState(null);
  const [employeeIncidents, setEmployeeIncidents] = useState([]);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentError, setIncidentError] = useState("");

  const employeeName = getEmployeeName(employee);
  const employeeId = getEmployeeId(employee);
  const employeeStatus = normalizeEmployeeStatus(employee?.status);

  useEffect(() => {
    if (!employee) {
      setPreviewFile(null);
      setEmployeeIncidents([]);
      setIncidentError("");
      setIncidentLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    async function loadEmployeeIncidents() {
      try {
        setIncidentLoading(true);
        setIncidentError("");

        const response = await fetch(INCIDENT_API_URL, {
          signal: controller.signal,
        });

        const data = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `Failed to load incidents. Status ${response.status}`
          );
        }

        if (controller.signal.aborted) return;

        const incidents = Array.isArray(data)
          ? data
              .map(normalizeIncident)
              .filter((incident) => isSameEmployee(employee, incident))
          : [];

        setEmployeeIncidents(incidents);
      } catch (error) {
        if (error?.name === "AbortError") return;

        console.error("Employee incidents backend fetch failed:", error);

        if (!controller.signal.aborted) {
          setIncidentError(
            "Unable to load latest incidents from backend."
          );
          setEmployeeIncidents([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIncidentLoading(false);
        }
      }
    }

    void loadEmployeeIncidents();

    return () => controller.abort();
  }, [employee]);

  const documentSummary = useMemo(() => {
    const documents = parseEmployeeDocuments(employee?.documents).map(
      normalizeDocument
    );

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

  const incidentSummary = useMemo(() => {
    return employeeIncidents.reduce(
      (summary, incident) => {
        summary.total += 1;
        summary.severityScore += SEVERITY_WEIGHTS[incident.severity] || 0;

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
        total: 0,
        open: 0,
        closed: 0,
        critical: 0,
        severityScore: 0,
      }
    );
  }, [employeeIncidents]);

  const decisionSupport = useMemo(() => {
    const kpiLevel = getKPILevel(
      incidentSummary.severityScore,
      incidentSummary.total
    );

    const riskLevel = getRiskLevel({
      kpiLevel,
      totalIncidents: incidentSummary.total,
      criticalIncidents: incidentSummary.critical,
    });

    return {
      kpiLevel,
      riskLevel,
      ...getRecommendationDecision({
        totalIncidents: incidentSummary.total,
        criticalIncidents: incidentSummary.critical,
        riskLevel,
      }),
    };
  }, [incidentSummary]);

  const recentIncidents = useMemo(
    () =>
      [...employeeIncidents]
        .sort(
          (first, second) =>
            getIncidentTimestamp(second) - getIncidentTimestamp(first)
        )
        .slice(0, 5),
    [employeeIncidents]
  );

  if (!employee) return null;

  const { documents, expired, expiringSoon, noData } = documentSummary;
  const { kpiLevel, riskLevel, recommendation, reason } = decisionSupport;
  const overallCompliance = getOverallCompliance(documents);

  const hasAttentionNeeded =
    expired.length > 0 || expiringSoon.length > 0 || noData.length > 0;

  const companyDisplay =
    employeeStatus === "Floating / Standby" || employeeStatus === "Inactive"
      ? "Not Assigned"
      : employee.company || "Not Assigned";

  const employeeInitials = getEmployeeInitials(employeeName);

  const handleCloseEmployee = () => {
    if (!previewFile) onClose?.();
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
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4 dark:border-white/10 dark:from-slate-900 dark:to-slate-900 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {employeeInitials}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-bold text-gray-900 dark:text-white">
                    {employeeName}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200">
                      {employeeId || "-"}
                    </span>

                    <StatusPill
                      className={getClassName(
                        STATUS_CLASSES,
                        employeeStatus,
                        "No Data"
                      )}
                      icon={
                        employeeStatus === "Inactive" ? (
                          <FiShield aria-hidden="true" />
                        ) : null
                      }
                    >
                      {employeeStatus}
                    </StatusPill>

                    <StatusPill
                      className={getClassName(
                        STATUS_CLASSES,
                        overallCompliance,
                        "No Data"
                      )}
                      icon={
                        ["Expired", "Expiring Soon"].includes(
                          overallCompliance
                        ) ? (
                          <FiAlertTriangle aria-hidden="true" />
                        ) : null
                      }
                    >
                      Overall Compliance: {overallCompliance}
                    </StatusPill>

                    <StatusPill
                      className={getClassName(
                        RISK_CLASSES,
                        riskLevel,
                        "Low Risk"
                      )}
                      icon={
                        riskLevel === "High Risk" ? (
                          <FiAlertTriangle aria-hidden="true" />
                        ) : null
                      }
                    >
                      Risk: {riskLevel}
                    </StatusPill>

                    <StatusPill
                      className={getClassName(
                        KPI_CLASSES,
                        kpiLevel,
                        "Good Standing"
                      )}
                    >
                      KPI: {kpiLevel}
                    </StatusPill>
                  </div>
                </div>
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
          </header>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 text-gray-900 dark:text-white sm:px-6 sm:py-6 lg:px-8">
            {incidentError && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              >
                {incidentError}
              </div>
            )}

            {hasAttentionNeeded && (
              <div
                className={[
                  "rounded-2xl border p-5",
                  expired.length
                    ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                    : "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <FiAlertTriangle
                    aria-hidden="true"
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300"
                  />

                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-300">
                      Compliance Attention Needed
                    </p>

                    <div className="mt-1 space-y-1 text-sm text-amber-700/90 dark:text-amber-200">
                      {expired.length > 0 && (
                        <p>{expired.length} document(s) already expired.</p>
                      )}

                      {expiringSoon.length > 0 && (
                        <p>
                          {expiringSoon.length} document(s) expiring soon.
                        </p>
                      )}

                      {noData.length > 0 && (
                        <p>
                          {noData.length} document(s) missing proof or
                          expiration data.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <section>
              <SectionTitle>Basic Information</SectionTitle>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoBox
                  icon={<FiUser size={16} aria-hidden="true" />}
                  label="Employee Name"
                  value={employeeName}
                />

                <InfoBox
                  icon={<FiShield size={16} aria-hidden="true" />}
                  label="Employee ID"
                  value={employeeId}
                />

                <InfoBox
                  icon={<FiBriefcase size={16} aria-hidden="true" />}
                  label="Company Assignment"
                  value={companyDisplay}
                />
              </div>
            </section>

            <section>
              <SectionTitle>Employment Status</SectionTitle>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <BadgeBox
                  label="Current Status"
                  value={employeeStatus}
                  className={getClassName(
                    STATUS_CLASSES,
                    employeeStatus,
                    "No Data"
                  )}
                />

                <BadgeBox
                  label="Compliance Summary"
                  value={overallCompliance}
                  className={getClassName(
                    STATUS_CLASSES,
                    overallCompliance,
                    "No Data"
                  )}
                />
              </div>
            </section>

            <section>
              <SectionTitle>Incident and KPI Summary</SectionTitle>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatBox
                  label="Total Incidents"
                  value={incidentLoading ? "..." : incidentSummary.total}
                />

                <StatBox
                  label="Open Cases"
                  value={incidentLoading ? "..." : incidentSummary.open}
                  valueClassName="text-red-500"
                />

                <StatBox
                  label="Closed Cases"
                  value={incidentLoading ? "..." : incidentSummary.closed}
                  valueClassName="text-green-500"
                />

                <StatBox
                  label="Severity Score"
                  value={
                    incidentLoading ? "..." : incidentSummary.severityScore
                  }
                  valueClassName="text-indigo-500"
                />

                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    Risk Level
                  </p>

                  <StatusPill
                    className={getClassName(
                      RISK_CLASSES,
                      riskLevel,
                      "Low Risk"
                    )}
                    icon={
                      riskLevel === "High Risk" ? (
                        <FiAlertTriangle aria-hidden="true" />
                      ) : null
                    }
                  >
                    {riskLevel}
                  </StatusPill>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle>System Recommendation</SectionTitle>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <StatusPill
                      className={getClassName(
                        RECOMMENDATION_CLASSES,
                        recommendation,
                        "Retain"
                      )}
                    >
                      {recommendation}
                    </StatusPill>

                    <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {reason}
                    </p>
                  </div>

                  <StatusPill
                    className={getClassName(
                      KPI_CLASSES,
                      kpiLevel,
                      "Good Standing"
                    )}
                  >
                    KPI Level: {kpiLevel}
                  </StatusPill>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle>Recent Incident History</SectionTitle>

              {incidentLoading ? (
                <EmptyBox text="Loading incident history from backend..." />
              ) : recentIncidents.length === 0 ? (
                <EmptyBox text="No incident history found for this employee." />
              ) : (
                <div className="space-y-3">
                  {recentIncidents.map((incident, index) => (
                    <div
                      key={`${incident.id}-${index}`}
                      className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {incident.violation || "No violation type"}
                          </p>

                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {incident.displayId} •{" "}
                            {formatDate(incident.reportedAt || incident.date)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
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
                              getSeverityKPILevel(incident.severity),
                              "Minor Concern"
                            )}
                          >
                            {incident.severity || "Minor"}
                          </StatusPill>
                        </div>
                      </div>

                      {incident.description && (
                        <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                          {incident.description}
                        </p>
                      )}

                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          Disciplinary Action
                        </p>

                        <p className="mt-2 font-bold text-slate-800 dark:text-slate-100">
                          Sanction: {incident.sanction || "For HR Review"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle>Compliance Documents</SectionTitle>

              <div className="space-y-4">
                {documents.length === 0 ? (
                  <EmptyBox text="No compliance documents found for this employee." />
                ) : (
                  documents.map((document) => {
                    const isExpired = document.status === "Expired";
                    const isExpiringSoon =
                      document.status === "Expiring Soon";
                    const isNoData = document.status === "No Data";

                    return (
                      <div
                        key={document.name}
                        className={[
                          "rounded-2xl border p-5",
                          isExpired
                            ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                            : isExpiringSoon
                              ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                              : isNoData
                                ? "border-orange-300 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10"
                                : "border-gray-200 bg-white dark:border-white/10 dark:bg-slate-900/40",
                        ].join(" ")}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className={[
                                "mt-1",
                                isExpired
                                  ? "text-red-500"
                                  : isExpiringSoon
                                    ? "text-amber-500"
                                    : isNoData
                                      ? "text-orange-500"
                                      : "text-indigo-500",
                              ].join(" ")}
                            >
                              <FiFileText size={18} aria-hidden="true" />
                            </div>

                            <div>
                              <p className="text-base font-semibold text-gray-900 dark:text-white">
                                {document.name}
                              </p>

                              <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                {document.expirable ? (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <FiCalendar size={14} aria-hidden="true" />
                                      <span>
                                        Expiration Date:{" "}
                                        {document.expirationDate
                                          ? formatDate(document.expirationDate)
                                          : "Not Set"}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <FiClock size={14} aria-hidden="true" />
                                      <span>
                                        {getDaysLabel(
                                          document.expirationDate
                                        )}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Permanent compliance document
                                  </p>
                                )}

                                {!document.file && (
                                  <p className="text-sm font-medium text-orange-600 dark:text-orange-300">
                                    No uploaded file found
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-2 lg:items-end">
                            {document.file && (
                              <Button
                                variant="secondary"
                                size="sm"
                                leftIcon={<FiEye aria-hidden="true" />}
                                onClick={() => setPreviewFile(document.file)}
                              >
                                View File
                              </Button>
                            )}

                            <StatusPill
                              className={getClassName(
                                STATUS_CLASSES,
                                document.status,
                                "No Data"
                              )}
                              icon={
                                isExpired || isExpiringSoon || isNoData ? (
                                  <FiAlertTriangle aria-hidden="true" />
                                ) : null
                              }
                            >
                              {document.status}
                            </StatusPill>

                            {document.status === "Valid" && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-300">
                                <FiCheckCircle size={14} aria-hidden="true" />
                                Document verified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <footer className="flex shrink-0 justify-end border-t border-gray-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900 sm:px-6 lg:px-8">
            <Button onClick={handleCloseEmployee}>Close</Button>
          </footer>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        title="File Preview"
        description={previewFile?.name || "Uploaded compliance document"}
        size="xl"
        height="xl"
        tone="neutral"
        closeOnOverlay
        closeOnEscape
        scrollBody={false}
        bodyClassName="min-h-0 flex-1 p-4"
        footer={
          <Button variant="secondary" onClick={() => setPreviewFile(null)}>
            Close Preview
          </Button>
        }
      >
        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-slate-950/50">
          {previewFile?.type?.startsWith("image/") ||
          previewFile?.type === "image/*" ? (
            <img
              src={previewFile.url}
              alt={previewFile.name || "Uploaded file preview"}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <iframe
              src={previewFile?.url}
              title={previewFile?.name || "Uploaded file preview"}
              className="h-full min-h-[60vh] w-full rounded-lg border border-gray-200 dark:border-white/10"
            />
          )}
        </div>
      </Dialog>
    </>
  );
}

function StatusPill({ children, className, icon = null }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
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

function SectionTitle({ children }) {
  return (
    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </h3>
  );
}

function InfoBox({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-sm">{label}</span>
      </div>

      <p className="text-base font-semibold">{value || "-"}</p>
    </div>
  );
}

function BadgeBox({ label, value, className }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <StatusPill className={className}>{value}</StatusPill>
    </div>
  );
}

function StatBox({
  label,
  value,
  valueClassName = "text-gray-900 dark:text-white",
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={["text-2xl font-bold", valueClassName].join(" ")}>
        {value}
      </p>
    </div>
  );
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}