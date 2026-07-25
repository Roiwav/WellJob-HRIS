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

import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import IconButton from "../ui/IconButton";

const API_BASE = "http://localhost:5000";
const INCIDENT_API_URL = `${API_BASE}/api/incidents`;

const EXPIRABLE_DOCUMENTS = [
  "Barangay Clearance",
  "NBI/Police Clearance",
];

function isExpirableDocument(docName) {
  return EXPIRABLE_DOCUMENTS.includes(docName);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function parseDocuments(documents) {
  if (typeof documents === "string") {
    try {
      const parsed = JSON.parse(documents);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(documents) ? documents : [];
}

function formatIncidentId(id) {
  if (!id) return "-";

  const value = String(id);

  if (value.startsWith("INC-")) {
    return value;
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return value;
  }

  return `INC-${String(numeric).padStart(4, "0")}`;
}

function formatDate(dateString) {
  if (!dateString) {
    return "Not Set";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizeStatus(status) {
  const value = normalizeText(status);

  if (value === "resolved" || value === "closed") {
    return "Closed";
  }

  if (value === "for_review" || value === "for review") {
    return "For Review";
  }

  if (value === "investigating") {
    return "Investigating";
  }

  return "Open";
}

function getDocumentStatus(doc) {
  if (!doc) {
    return "No Data";
  }

  const hasFile = Boolean(
    doc.file ||
      doc.filePath ||
      doc.file_path
  );

  const isExpirable = isExpirableDocument(doc.name);

  if (!hasFile) {
    return "No Data";
  }

  if (!isExpirable) {
    return "Valid";
  }

  const expirationDate =
    doc.expirationDate ||
    doc.expiration_date;

  if (!expirationDate) {
    return "No Data";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(expirationDate);
  expiration.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiration.getTime())) {
    return "No Data";
  }

  const differenceInDays = Math.ceil(
    (expiration.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (differenceInDays < 0) {
    return "Expired";
  }

  if (differenceInDays <= 30) {
    return "Expiring Soon";
  }

  return "Valid";
}

function getDaysLabel(expirationDate) {
  if (!expirationDate) {
    return "No expiration date recorded";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(expirationDate);
  expiration.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiration.getTime())) {
    return "Invalid expiration date";
  }

  const differenceInDays = Math.ceil(
    (expiration.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (differenceInDays < 0) {
    const elapsedDays = Math.abs(differenceInDays);

    return `Expired ${elapsedDays} day${
      elapsedDays === 1 ? "" : "s"
    } ago`;
  }

  if (differenceInDays === 0) {
    return "Expires today";
  }

  return `Expires in ${differenceInDays} day${
    differenceInDays === 1 ? "" : "s"
  }`;
}

function getStatusClasses(status) {
  const styles = {
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

  return styles[status] || styles["No Data"];
}

function getOverallCompliance(documents) {
  if (!documents || documents.length === 0) {
    return "No Data";
  }

  const statuses = documents.map(
    (document) => document.status
  );

  if (statuses.includes("Expired")) {
    return "Expired";
  }

  if (statuses.includes("Expiring Soon")) {
    return "Expiring Soon";
  }

  if (statuses.includes("No Data")) {
    return "Incomplete";
  }

  if (
    statuses.every(
      (status) => status === "Valid"
    )
  ) {
    return "Valid";
  }

  return "Incomplete";
}

function getSeverityWeight(severity) {
  if (severity === "Critical") {
    return 5;
  }

  if (severity === "Major") {
    return 3;
  }

  if (severity === "Minor") {
    return 1;
  }

  return 0;
}

function getKPILevel(
  severityScore,
  totalIncidents
) {
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

function getRiskClasses(level) {
  const styles = {
    "High Risk":
      "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",

    Repeat:
      "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

    Monitor:
      "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",

    "Low Risk":
      "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
  };

  return styles[level] || styles["Low Risk"];
}

function getKPIClasses(level) {
  const styles = {
    "Critical Concern":
      "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",

    "Needs Improvement":
      "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

    "Minor Concern":
      "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",

    "Good Standing":
      "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
  };

  return styles[level] || styles["Good Standing"];
}

function getRecommendation({
  totalIncidents,
  criticalIncidents,
  riskLevel,
}) {
  if (criticalIncidents >= 2) {
    return "Termination Review";
  }

  if (
    criticalIncidents >= 1 ||
    riskLevel === "High Risk"
  ) {
    return "Suspension Review";
  }

  if (
    totalIncidents >= 3 ||
    riskLevel === "Repeat"
  ) {
    return "Final Warning";
  }

  if (
    totalIncidents >= 1 ||
    riskLevel === "Monitor"
  ) {
    return "Monitor Employee";
  }

  return "Retain";
}

function getRecommendationReason({
  totalIncidents,
  criticalIncidents,
  riskLevel,
}) {
  if (criticalIncidents >= 2) {
    return `Employee has ${criticalIncidents} critical incident(s), requiring termination review.`;
  }

  if (
    criticalIncidents >= 1 ||
    riskLevel === "High Risk"
  ) {
    return "Employee has critical or high-risk incident records requiring suspension review.";
  }

  if (
    totalIncidents >= 3 ||
    riskLevel === "Repeat"
  ) {
    return "Employee has repeated violations and should receive final warning.";
  }

  if (
    totalIncidents >= 1 ||
    riskLevel === "Monitor"
  ) {
    return "Employee has recorded violation(s) and should be monitored.";
  }

  return "Employee has no recorded violation and may be retained.";
}

function getRecommendationClasses(
  recommendation
) {
  const styles = {
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

  return (
    styles[recommendation] ||
    styles.Retain
  );
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

  const timestamp = new Date(
    dateValue
  ).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function isSameEmployee(employee, incident) {
  const employeeId = String(
    employee?.id ||
      employee?.employeeId ||
      employee?.employee_id ||
      ""
  );

  const employeeName = normalizeText(
    employee?.name ||
      employee?.full_name ||
      employee?.fullName ||
      ""
  );

  const incidentEmployeeId = String(
    incident?.employeeId ||
      incident?.employee_id ||
      incident?.empId ||
      ""
  );

  const incidentEmployeeName =
    normalizeText(
      incident?.employee ||
        incident?.employeeName ||
        incident?.employee_name ||
        ""
    );

  return (
    (Boolean(employeeId) &&
      employeeId === incidentEmployeeId) ||
    (Boolean(employeeName) &&
      employeeName === incidentEmployeeName)
  );
}

function normalizeIncident(incident) {
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

    displayId: formatIncidentId(
      incident.id
    ),

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

    severity:
      incident.severity || "Minor",

    status: normalizeStatus(
      incident.status
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

    description:
      incident.description || "",

    recommendation:
      incident.recommendation || "",

    sanction:
      incident.sanction ||
      incident.actionTaken ||
      incident.action_taken ||
      "For HR Review",
  };
}

function buildDocumentFile(document) {
  if (document.file?.url) {
    return document.file;
  }

  const filePath =
    document.filePath ||
    document.file_path ||
    "";

  if (!filePath) {
    return null;
  }

  const normalizedPath =
    filePath.replace(/\\/g, "/");

  const url = normalizedPath.startsWith(
    "http"
  )
    ? normalizedPath
    : `${API_BASE}/${normalizedPath}`;

  const lowerPath =
    normalizedPath.toLowerCase();

  return {
    url,

    name:
      document.fileName ||
      document.file_name ||
      document.name ||
      "Uploaded file",

    type: lowerPath.endsWith(".pdf")
      ? "application/pdf"
      : "image/*",
  };
}

function getEmployeeStatus(employee) {
  return (
    employee?.status ||
    "Floating / Standby"
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

function getEmployeeId(employee) {
  return String(
    employee?.id ||
      employee?.employeeId ||
      employee?.employee_id ||
      ""
  );
}

export default function EmployeeModal({
  employee,
  onClose,
}) {
  const [previewFile, setPreviewFile] =
    useState(null);

  const [
    employeeIncidents,
    setEmployeeIncidents,
  ] = useState([]);

  const [
    incidentLoading,
    setIncidentLoading,
  ] = useState(false);

  const [
    incidentError,
    setIncidentError,
  ] = useState("");

  const employeeName =
    getEmployeeName(employee);

  const employeeId =
    getEmployeeId(employee);

  const employeeStatus =
    getEmployeeStatus(employee);

  useEffect(() => {
    if (!employee) {
      setEmployeeIncidents([]);
      setIncidentError("");
      setIncidentLoading(false);
      setPreviewFile(null);
      return undefined;
    }

    let isMounted = true;
    const abortController =
      new AbortController();

    async function fetchEmployeeIncidents() {
      try {
        setIncidentLoading(true);
        setIncidentError("");

        const response = await fetch(
          INCIDENT_API_URL,
          {
            signal:
              abortController.signal,
          }
        );

        const data = await response
          .json()
          .catch(() => []);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `Failed to load incidents. Status ${response.status}`
          );
        }

        const normalized = Array.isArray(data)
          ? data.map(normalizeIncident)
          : [];

        const matched = normalized.filter(
          (incident) =>
            isSameEmployee(
              employee,
              incident
            )
        );

        if (isMounted) {
          setEmployeeIncidents(matched);
        }
      } catch (error) {
        if (
          error?.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Employee incidents backend fetch failed:",
          error
        );

        if (isMounted) {
          setIncidentError(
            "Unable to load latest incidents from backend."
          );

          setEmployeeIncidents([]);
        }
      } finally {
        if (isMounted) {
          setIncidentLoading(false);
        }
      }
    }

    fetchEmployeeIncidents();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [employee]);

  const normalizedDocuments = useMemo(
    () =>
      parseDocuments(
        employee?.documents
      ).map((document) => {
        const expirationDate =
          document.expirationDate ||
          document.expiration_date ||
          "";

        const file =
          buildDocumentFile(document);

        return {
          ...document,
          expirationDate,
          file,

          expirable:
            isExpirableDocument(
              document.name
            ),

          status: getDocumentStatus({
            ...document,
            expirationDate,
            file,
          }),
        };
      }),
    [employee]
  );

  const overallCompliance =
    useMemo(
      () =>
        getOverallCompliance(
          normalizedDocuments
        ),
      [normalizedDocuments]
    );

  const expiringDocuments =
    useMemo(
      () =>
        normalizedDocuments.filter(
          (document) =>
            document.status ===
            "Expiring Soon"
        ),
      [normalizedDocuments]
    );

  const expiredDocuments =
    useMemo(
      () =>
        normalizedDocuments.filter(
          (document) =>
            document.status ===
            "Expired"
        ),
      [normalizedDocuments]
    );

  const noDataDocuments =
    useMemo(
      () =>
        normalizedDocuments.filter(
          (document) =>
            document.status ===
            "No Data"
        ),
      [normalizedDocuments]
    );

  const incidentSummary = useMemo(() => {
    const total =
      employeeIncidents.length;

    const open =
      employeeIncidents.filter(
        (incident) =>
          [
            "Open",
            "Investigating",
            "For Review",
          ].includes(incident.status)
      ).length;

    const closed =
      employeeIncidents.filter(
        (incident) =>
          incident.status === "Closed"
      ).length;

    const critical =
      employeeIncidents.filter(
        (incident) =>
          incident.severity ===
          "Critical"
      ).length;

    const severityScore =
      employeeIncidents.reduce(
        (sum, incident) =>
          sum +
          getSeverityWeight(
            incident.severity
          ),
        0
      );

    return {
      total,
      open,
      closed,
      critical,
      severityScore,
    };
  }, [employeeIncidents]);

  const kpiLevel = useMemo(
    () =>
      getKPILevel(
        incidentSummary.severityScore,
        incidentSummary.total
      ),
    [
      incidentSummary.severityScore,
      incidentSummary.total,
    ]
  );

  const riskLevel = useMemo(
    () =>
      getRiskLevel({
        kpiLevel,

        totalIncidents:
          incidentSummary.total,

        criticalIncidents:
          incidentSummary.critical,
      }),
    [
      incidentSummary.critical,
      incidentSummary.total,
      kpiLevel,
    ]
  );

  const recommendation = useMemo(
    () =>
      getRecommendation({
        totalIncidents:
          incidentSummary.total,

        criticalIncidents:
          incidentSummary.critical,

        riskLevel,
      }),
    [
      incidentSummary.critical,
      incidentSummary.total,
      riskLevel,
    ]
  );

  const recommendationReason = useMemo(
    () =>
      getRecommendationReason({
        totalIncidents:
          incidentSummary.total,

        criticalIncidents:
          incidentSummary.critical,

        riskLevel,
      }),
    [
      incidentSummary.critical,
      incidentSummary.total,
      riskLevel,
    ]
  );

  const recentIncidents = useMemo(
    () =>
      [...employeeIncidents]
        .sort(
          (first, second) =>
            getIncidentTimestamp(
              second
            ) -
            getIncidentTimestamp(
              first
            )
        )
        .slice(0, 5),
    [employeeIncidents]
  );

  if (!employee) {
    return null;
  }

  const hasAttentionNeeded =
    expiredDocuments.length > 0 ||
    expiringDocuments.length > 0 ||
    noDataDocuments.length > 0;

  const companyDisplay =
    employeeStatus ===
      "Floating / Standby" ||
    employeeStatus === "Inactive"
      ? "Not Assigned"
      : employee.company ||
        "Not Assigned";

  const employeeInitials =
    employeeName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part[0]?.toUpperCase()
      )
      .join("") || "E";

  const handleClosePreview = () => {
    setPreviewFile(null);
  };

  const handleCloseEmployee = () => {
    if (previewFile) {
      return;
    }

    onClose?.();
  };

  return (
    <>
      <Dialog
        open={Boolean(employee) && !previewFile}
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

                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                        getStatusClasses(
                          employeeStatus === "Inactive"
                            ? "Inactive"
                            : employeeStatus
                        ),
                      ].join(" ")}
                    >
                      {employeeStatus ===
                        "Inactive" && (
                        <FiShield
                          className="text-sm"
                          aria-hidden="true"
                        />
                      )}

                      {employeeStatus}
                    </span>

                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                        getStatusClasses(
                          overallCompliance
                        ),
                      ].join(" ")}
                    >
                      {[
                        "Expired",
                        "Expiring Soon",
                      ].includes(
                        overallCompliance
                      ) && (
                        <FiAlertTriangle
                          className="text-sm"
                          aria-hidden="true"
                        />
                      )}

                      Overall Compliance:{" "}
                      {overallCompliance}
                    </span>

                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                        getRiskClasses(
                          riskLevel
                        ),
                      ].join(" ")}
                    >
                      {riskLevel ===
                        "High Risk" && (
                        <FiAlertTriangle
                          className="text-sm"
                          aria-hidden="true"
                        />
                      )}

                      Risk: {riskLevel}
                    </span>

                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                        getKPIClasses(
                          kpiLevel
                        ),
                      ].join(" ")}
                    >
                      KPI: {kpiLevel}
                    </span>
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
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                {incidentError}
              </div>
            )}

            {hasAttentionNeeded && (
              <div
                className={[
                  "rounded-2xl border p-5",
                  expiredDocuments.length > 0
                    ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                    : "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <FiAlertTriangle
                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300"
                    size={18}
                    aria-hidden="true"
                  />

                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-300">
                      Compliance Attention
                      Needed
                    </p>

                    <div className="mt-1 space-y-1 text-sm text-amber-700/90 dark:text-amber-200">
                      {expiredDocuments.length >
                        0 && (
                        <p>
                          {
                            expiredDocuments.length
                          }{" "}
                          document(s) already
                          expired.
                        </p>
                      )}

                      {expiringDocuments.length >
                        0 && (
                        <p>
                          {
                            expiringDocuments.length
                          }{" "}
                          document(s) expiring
                          soon.
                        </p>
                      )}

                      {noDataDocuments.length >
                        0 && (
                        <p>
                          {
                            noDataDocuments.length
                          }{" "}
                          document(s) missing
                          proof or expiration
                          data.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <section>
              <SectionTitle>
                Basic Information
              </SectionTitle>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoBox
                  icon={
                    <FiUser
                      size={16}
                      aria-hidden="true"
                    />
                  }
                  label="Employee Name"
                  value={employeeName}
                />

                <InfoBox
                  icon={
                    <FiShield
                      size={16}
                      aria-hidden="true"
                    />
                  }
                  label="Employee ID"
                  value={employeeId}
                />

                <InfoBox
                  icon={
                    <FiBriefcase
                      size={16}
                      aria-hidden="true"
                    />
                  }
                  label="Company Assignment"
                  value={companyDisplay}
                />
              </div>
            </section>

            <section>
              <SectionTitle>
                Employment Status
              </SectionTitle>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <BadgeBox
                  label="Current Status"
                  value={employeeStatus}
                  className={getStatusClasses(
                    employeeStatus ===
                      "Inactive"
                      ? "Inactive"
                      : employeeStatus
                  )}
                />

                <BadgeBox
                  label="Compliance Summary"
                  value={overallCompliance}
                  className={getStatusClasses(
                    overallCompliance
                  )}
                />
              </div>
            </section>

            <section>
              <SectionTitle>
                Incident and KPI Summary
              </SectionTitle>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatBox
                  label="Total Incidents"
                  value={
                    incidentLoading
                      ? "..."
                      : incidentSummary.total
                  }
                />

                <StatBox
                  label="Open Cases"
                  value={
                    incidentLoading
                      ? "..."
                      : incidentSummary.open
                  }
                  valueClassName="text-red-500"
                />

                <StatBox
                  label="Closed Cases"
                  value={
                    incidentLoading
                      ? "..."
                      : incidentSummary.closed
                  }
                  valueClassName="text-green-500"
                />

                <StatBox
                  label="Severity Score"
                  value={
                    incidentLoading
                      ? "..."
                      : incidentSummary.severityScore
                  }
                  valueClassName="text-indigo-500"
                />

                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    Risk Level
                  </p>

                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                      getRiskClasses(
                        riskLevel
                      ),
                    ].join(" ")}
                  >
                    {riskLevel ===
                      "High Risk" && (
                      <FiAlertTriangle
                        className="text-sm"
                        aria-hidden="true"
                      />
                    )}

                    {riskLevel}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle>
                System Recommendation
              </SectionTitle>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                        getRecommendationClasses(
                          recommendation
                        ),
                      ].join(" ")}
                    >
                      {recommendation}
                    </span>

                    <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {
                        recommendationReason
                      }
                    </p>
                  </div>

                  <span
                    className={[
                      "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold",
                      getKPIClasses(
                        kpiLevel
                      ),
                    ].join(" ")}
                  >
                    KPI Level: {kpiLevel}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle>
                Recent Incident History
              </SectionTitle>

              {incidentLoading ? (
                <EmptyBox text="Loading incident history from backend..." />
              ) : recentIncidents.length ===
                0 ? (
                <EmptyBox text="No incident history found for this employee." />
              ) : (
                <div className="space-y-3">
                  {recentIncidents.map(
                    (incident, index) => (
                      <div
                        key={`${incident.id}-${index}`}
                        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {incident.violation ||
                                "No violation type"}
                            </p>

                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {
                                incident.displayId
                              }{" "}
                              •{" "}
                              {formatDate(
                                incident.reportedAt ||
                                  incident.date
                              )}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span
                              className={[
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                                getStatusClasses(
                                  incident.status
                                ),
                              ].join(" ")}
                            >
                              {incident.status ||
                                "Open"}
                            </span>

                            <span
                              className={[
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                                getKPIClasses(
                                  incident.severity ===
                                    "Critical"
                                    ? "Critical Concern"
                                    : incident.severity ===
                                        "Major"
                                      ? "Needs Improvement"
                                      : "Minor Concern"
                                ),
                              ].join(" ")}
                            >
                              {incident.severity ||
                                "Minor"}
                            </span>
                          </div>
                        </div>

                        {incident.description && (
                          <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                            {
                              incident.description
                            }
                          </p>
                        )}

                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            Disciplinary Action
                          </p>

                          <p className="mt-2 font-bold text-slate-800 dark:text-slate-100">
                            Sanction:{" "}
                            {incident.sanction ||
                              "For HR Review"}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <section>
              <SectionTitle>
                Compliance Documents
              </SectionTitle>

              <div className="space-y-4">
                {normalizedDocuments.length ===
                0 ? (
                  <EmptyBox text="No compliance documents found for this employee." />
                ) : (
                  normalizedDocuments.map(
                    (document) => {
                      const isExpired =
                        document.status ===
                        "Expired";

                      const isExpiringSoon =
                        document.status ===
                        "Expiring Soon";

                      const isNoData =
                        document.status ===
                        "No Data";

                      const isExpirable =
                        document.expirable;

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
                                <FiFileText
                                  size={18}
                                  aria-hidden="true"
                                />
                              </div>

                              <div>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">
                                  {
                                    document.name
                                  }
                                </p>

                                <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                  {isExpirable ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <FiCalendar
                                          size={
                                            14
                                          }
                                          aria-hidden="true"
                                        />

                                        <span>
                                          Expiration
                                          Date:{" "}
                                          {document.expirationDate
                                            ? formatDate(
                                                document.expirationDate
                                              )
                                            : "Not Set"}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <FiClock
                                          size={
                                            14
                                          }
                                          aria-hidden="true"
                                        />

                                        <span>
                                          {getDaysLabel(
                                            document.expirationDate
                                          )}
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      Permanent
                                      compliance
                                      document
                                    </p>
                                  )}

                                  {!document.file && (
                                    <p className="text-sm font-medium text-orange-600 dark:text-orange-300">
                                      No uploaded
                                      file found
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
                                  onClick={() =>
                                    setPreviewFile(
                                      document.file
                                    )
                                  }
                                >
                                  <FiEye
                                    aria-hidden="true"
                                  />
                                  View File
                                </Button>
                              )}

                              <span
                                className={[
                                  "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                                  getStatusClasses(
                                    document.status
                                  ),
                                ].join(" ")}
                              >
                                {(isExpired ||
                                  isExpiringSoon ||
                                  isNoData) && (
                                  <FiAlertTriangle
                                    className="text-sm"
                                    aria-hidden="true"
                                  />
                                )}

                                {
                                  document.status
                                }
                              </span>

                              {document.status ===
                                "Valid" && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-300">
                                  <FiCheckCircle
                                    size={14}
                                    aria-hidden="true"
                                  />

                                  Document verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </section>
          </div>

          <footer className="flex shrink-0 justify-end border-t border-gray-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900 sm:px-6 lg:px-8">
            <Button
              onClick={handleCloseEmployee}
            >
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
        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-slate-950/50">
          {previewFile?.type?.startsWith(
            "image/"
          ) ||
          previewFile?.type ===
            "image/*" ? (
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
              className="h-full min-h-[60vh] w-full rounded-lg border border-gray-200 dark:border-white/10"
            />
          )}
        </div>
      </Dialog>
    </>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </h3>
  );
}

function InfoBox({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}

        <span className="text-sm">
          {label}
        </span>
      </div>

      <p className="text-base font-semibold">
        {value || "-"}
      </p>
    </div>
  );
}

function BadgeBox({
  label,
  value,
  className,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
        {label}
      </p>

      <span
        className={[
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
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
      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
        {label}
      </p>

      <p
        className={[
          "text-2xl font-bold",
          valueClassName,
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {text}
      </p>
    </div>
  );
}