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

import { NORMALIZED_VIOLATION_RULES } from "../../data/violationRules";

const API_BASE = "http://localhost:5000";
const INCIDENT_API_URL = `${API_BASE}/api/incidents`;

const EXPIRABLE_DOCUMENTS = ["Barangay Clearance", "NBI/Police Clearance"];

function isExpirableDocument(docName) {
  return EXPIRABLE_DOCUMENTS.includes(docName);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeViolationKey(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripSectionPrefix(value) {
  return String(value || "")
    .replace(/^\s*sec\.?\s*\d+(\s*[-—–]\s*)?/i, "")
    .replace(/^\s*section\s*\d+(\s*[-—–]\s*)?/i, "")
    .replace(/^[IVXLCDM]+\.\s*/i, "")
    .trim();
}

function getViolationMatchKeys(value) {
  const original = String(value || "").trim();
  const withoutSection = stripSectionPrefix(original);

  return Array.from(
    new Set([
      normalizeViolationKey(original),
      normalizeViolationKey(withoutSection),
    ])
  ).filter(Boolean);
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

  const time = new Date(dateValue).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function getOrdinalLabel(number) {
  if (number === 1) return "1st offense";
  if (number === 2) return "2nd offense";
  if (number === 3) return "3rd offense";
  return `${number}th offense`;
}

const FLATTENED_VIOLATION_RULES = (NORMALIZED_VIOLATION_RULES || []).flatMap(
  (category) =>
    (category.rows || []).map((row) => ({
      ...row,
      category: category.category,
      normalizedViolation: normalizeViolationKey(row.violation),
      normalizedSectionViolation: normalizeViolationKey(
        `${row.section} - ${row.violation}`
      ),
    }))
);

function findViolationRule(violationName) {
  const keys = getViolationMatchKeys(violationName);

  if (keys.length === 0) return null;

  const exactMatch = FLATTENED_VIOLATION_RULES.find((rule) =>
    keys.some(
      (key) =>
        key === rule.normalizedViolation ||
        key === rule.normalizedSectionViolation
    )
  );

  if (exactMatch) return exactMatch;

  const partialMatch = FLATTENED_VIOLATION_RULES.find((rule) =>
    keys.some((key) => {
      if (!key || !rule.normalizedViolation) return false;

      return (
        key.includes(rule.normalizedViolation) ||
        rule.normalizedViolation.includes(key)
      );
    })
  );

  if (partialMatch) return partialMatch;

  const tokenMatch = FLATTENED_VIOLATION_RULES.find((rule) =>
    keys.some((key) => {
      const keyWords = key.split(" ").filter((word) => word.length >= 4);

      if (keyWords.length === 0) return false;

      const matchedWords = keyWords.filter((word) =>
        rule.normalizedViolation.includes(word)
      );

      return matchedWords.length >= Math.min(3, keyWords.length);
    })
  );

  return tokenMatch || null;
}

function getPenaltyForOffense(rule, offenseNo, incident) {
  const fallbackSanction =
    incident?.sanction ||
    incident?.actionTaken ||
    incident?.action_taken ||
    incident?.recommendation ||
    "For HR Review";

  if (!rule || !Array.isArray(rule.penalties) || rule.penalties.length === 0) {
    return {
      offenseNo,
      label: getOrdinalLabel(offenseNo),
      action: fallbackSanction,
      isPolicyMatched: false,
    };
  }

  const exactPenalty = rule.penalties.find(
    (penalty) => Number(penalty.offenseNo) === Number(offenseNo)
  );

  if (exactPenalty) {
    return {
      ...exactPenalty,
      isPolicyMatched: true,
    };
  }

  const lastPenalty = rule.penalties[rule.penalties.length - 1];

  return {
    ...lastPenalty,
    offenseNo,
    label: getOrdinalLabel(offenseNo),
    action: lastPenalty?.action || fallbackSanction,
    isPolicyMatched: true,
  };
}

function buildProgressiveIncidentSanctions(incidents = []) {
  const sortedIncidents = [...incidents].sort((a, b) => {
    const dateA = getIncidentTimestamp(a);
    const dateB = getIncidentTimestamp(b);

    if (dateA !== dateB) return dateA - dateB;

    return Number(a.id || 0) - Number(b.id || 0);
  });

  const violationCounter = new Map();

  return sortedIncidents.map((incident) => {
    const violationName =
      incident.violation ||
      incident.violationType ||
      incident.violation_type ||
      "No violation type";

    const rule = findViolationRule(violationName);

    const counterKey = rule
      ? normalizeViolationKey(rule.violation)
      : normalizeViolationKey(stripSectionPrefix(violationName));

    const previousCount = violationCounter.get(counterKey) || 0;
    const offenseNo = previousCount + 1;

    violationCounter.set(counterKey, offenseNo);

    const penalty = getPenaltyForOffense(rule, offenseNo, incident);

    return {
      ...incident,
      progressiveOffenseNo: offenseNo,
      progressiveOffenseLabel: penalty.label || getOrdinalLabel(offenseNo),
      progressiveSanction:
        penalty.action ||
        incident.sanction ||
        incident.actionTaken ||
        incident.action_taken ||
        "For HR Review",
      progressivePenaltyLevel: rule?.penaltyLevel || "",
      progressivePolicySection: rule?.section || "",
      progressivePolicyCategory: rule?.category || "",
      progressivePolicyMatched: Boolean(penalty.isPolicyMatched),
    };
  });
}

function normalizeStatus(status) {
  const value = normalizeText(status);

  if (value === "resolved") return "Closed";
  if (value === "closed") return "Closed";
  if (value === "for_review") return "For Review";
  if (value === "for review") return "For Review";
  if (value === "investigating") return "Investigating";

  return "Open";
}

function formatIncidentId(id) {
  if (!id) return "-";

  const value = String(id);
  if (value.startsWith("INC-")) return value;

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;

  return `INC-${String(numeric).padStart(4, "0")}`;
}

function formatDate(dateString) {
  if (!dateString) return "Not Set";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDocumentStatus(doc) {
  if (!doc) return "No Data";

  const hasFile = !!doc.file || !!doc.filePath || !!doc.file_path;
  const isExpirable = isExpirableDocument(doc.name);

  if (!hasFile) return "No Data";
  if (!isExpirable) return "Valid";

  const expirationDate = doc.expirationDate || doc.expiration_date;
  if (!expirationDate) return "No Data";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);

  if (Number.isNaN(exp.getTime())) return "No Data";

  const diffDays = Math.ceil(
    (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Expiring Soon";
  return "Valid";
}

function getDaysLabel(expirationDate) {
  if (!expirationDate) return "No expiration date recorded";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);

  if (Number.isNaN(exp.getTime())) return "Invalid expiration date";

  const diffDays = Math.ceil(
    (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return `Expired ${Math.abs(diffDays)} day${
      Math.abs(diffDays) > 1 ? "s" : ""
    } ago`;
  }

  if (diffDays === 0) return "Expires today";

  return `Expires in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
}

function getStatusClasses(status) {
  const styles = {
    Valid:
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    "Expiring Soon":
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    Expired:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    "No Data":
      "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30",
    Missing:
      "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
    Incomplete:
      "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
    Inactive:
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30",
    Deployed:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
    "Floating / Standby":
      "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
    Open:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    Investigating:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    "For Review":
      "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
    Closed:
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
  };

  return styles[status] || styles["No Data"];
}

function getOverallCompliance(documents) {
  if (!documents || documents.length === 0) return "No Data";

  const statuses = documents.map((doc) => doc.status);

  if (statuses.includes("Expired")) return "Expired";
  if (statuses.includes("Expiring Soon")) return "Expiring Soon";
  if (statuses.includes("Missing")) return "Incomplete";
  if (statuses.includes("No Data")) return "No Data";
  if (statuses.every((status) => status === "Valid")) return "Valid";

  return "Incomplete";
}

function getSeverityWeight(severity) {
  if (severity === "Critical") return 5;
  if (severity === "Major") return 3;
  if (severity === "Minor") return 1;
  return 0;
}

function getKPILevel(severityScore, totalIncidents) {
  if (severityScore >= 8) return "Critical Concern";
  if (severityScore >= 4) return "Needs Improvement";
  if (totalIncidents >= 1) return "Minor Concern";
  return "Good Standing";
}

function getRiskLevel({ kpiLevel, totalIncidents, criticalIncidents }) {
  if (criticalIncidents >= 1) return "High Risk";
  if (kpiLevel === "Critical Concern") return "High Risk";
  if (kpiLevel === "Needs Improvement") return "Repeat";
  if (kpiLevel === "Minor Concern" || totalIncidents >= 1) return "Monitor";
  return "Low Risk";
}

function getRiskClasses(level) {
  const styles = {
    "High Risk":
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    Repeat:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    Monitor:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
    "Low Risk":
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
  };

  return styles[level] || styles["Low Risk"];
}

function getKPIClasses(level) {
  const styles = {
    "Critical Concern":
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    "Needs Improvement":
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    "Minor Concern":
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
    "Good Standing":
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
  };

  return styles[level] || styles["Good Standing"];
}

function getRecommendation({ totalIncidents, criticalIncidents, riskLevel }) {
  if (criticalIncidents >= 2) return "Termination Review";
  if (criticalIncidents >= 1 || riskLevel === "High Risk") {
    return "Suspension Review";
  }
  if (totalIncidents >= 3 || riskLevel === "Repeat") return "Final Warning";
  if (totalIncidents >= 1 || riskLevel === "Monitor") return "Monitor Employee";
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

  if (criticalIncidents >= 1 || riskLevel === "High Risk") {
    return "Employee has critical or high-risk incident records requiring suspension review.";
  }

  if (totalIncidents >= 3 || riskLevel === "Repeat") {
    return "Employee has repeated violations and should receive final warning.";
  }

  if (totalIncidents >= 1 || riskLevel === "Monitor") {
    return "Employee has recorded violation(s) and should be monitored.";
  }

  return "Employee has no recorded violation and may be retained.";
}

function getRecommendationClasses(recommendation) {
  const styles = {
    Retain:
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    "Monitor Employee":
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
    "Final Warning":
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    "Suspension Review":
      "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
    "Termination Review":
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
  };

  return styles[recommendation] || styles.Retain;
}

function isSameEmployee(employee, incident) {
  const employeeId = String(
    employee?.id || employee?.employeeId || employee?.employee_id || ""
  );

  const employeeName = normalizeText(
    employee?.name || employee?.full_name || employee?.fullName || ""
  );

  const incidentEmployeeId = String(
    incident?.employeeId || incident?.employee_id || incident?.empId || ""
  );

  const incidentEmployeeName = normalizeText(
    incident?.employee || incident?.employeeName || incident?.employee_name || ""
  );

  return (
    (!!employeeId && employeeId === incidentEmployeeId) ||
    (!!employeeName && employeeName === incidentEmployeeName)
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
    status: normalizeStatus(incident.status),
    date,
    reportedAt: incident.reportedAt || incident.reported_at || date,
    createdAt: incident.createdAt || incident.created_at || date,
    description: incident.description || "",
    recommendation: incident.recommendation || "",
    sanction:
      incident.sanction || incident.actionTaken || incident.action_taken || "",
  };
}

function getLocalIncidentsFallback(employee) {
  try {
    const stored = JSON.parse(localStorage.getItem("incidents") || "[]");

    return stored
      .map(normalizeIncident)
      .filter((incident) => isSameEmployee(employee, incident));
  } catch (error) {
    console.error("Failed to load local incidents fallback:", error);
    return [];
  }
}

function buildDocumentFile(doc) {
  if (doc.file?.url) return doc.file;

  const filePath = doc.filePath || doc.file_path || "";
  if (!filePath) return null;

  const normalizedPath = filePath.replace(/\\/g, "/");
  const url = normalizedPath.startsWith("http")
    ? normalizedPath
    : `${API_BASE}/${normalizedPath}`;

  const lowerPath = normalizedPath.toLowerCase();

  return {
    url,
    name: doc.name || "Uploaded file",
    type: lowerPath.endsWith(".pdf") ? "application/pdf" : "image/*",
  };
}

export default function EmployeeModal({ employee, onClose }) {
  const [previewFile, setPreviewFile] = useState(null);
  const [employeeIncidents, setEmployeeIncidents] = useState([]);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentError, setIncidentError] = useState("");

  useEffect(() => {
    if (!employee) return;

    let isMounted = true;

    async function fetchEmployeeIncidents() {
      try {
        setIncidentLoading(true);
        setIncidentError("");

        const response = await fetch(INCIDENT_API_URL);
        const data = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `Failed to load incidents. Status ${response.status}`
          );
        }

        const normalized = Array.isArray(data) ? data.map(normalizeIncident) : [];

        const matched = normalized.filter((incident) =>
          isSameEmployee(employee, incident)
        );

        if (isMounted) {
          setEmployeeIncidents(matched);
          localStorage.setItem("incidents", JSON.stringify(normalized));
        }
      } catch (error) {
        console.error("Employee incidents backend fetch failed:", error);

        if (isMounted) {
          setIncidentError("Unable to load latest incidents from backend.");
          setEmployeeIncidents(getLocalIncidentsFallback(employee));
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
    };
  }, [employee]);

  const normalizedDocuments = useMemo(() => {
    return (employee?.documents || []).map((doc) => {
      const expirationDate = doc.expirationDate || doc.expiration_date || "";
      const file = buildDocumentFile(doc);

      return {
        ...doc,
        expirationDate,
        file,
        expirable: isExpirableDocument(doc.name),
        status: getDocumentStatus({
          ...doc,
          expirationDate,
          file,
        }),
      };
    });
  }, [employee]);

  const progressiveIncidents = useMemo(() => {
    return buildProgressiveIncidentSanctions(employeeIncidents);
  }, [employeeIncidents]);

  if (!employee) return null;

  const overallCompliance = getOverallCompliance(normalizedDocuments);

  const expiringDocs = normalizedDocuments.filter(
    (doc) => doc.status === "Expiring Soon"
  );

  const expiredDocs = normalizedDocuments.filter(
    (doc) => doc.status === "Expired"
  );

  const missingDocs = normalizedDocuments.filter(
    (doc) => doc.status === "Missing"
  );

  const hasAttentionNeeded =
    expiredDocs.length > 0 || expiringDocs.length > 0 || missingDocs.length > 0;

  const companyDisplay =
    employee.status === "Floating / Standby" || employee.status === "Inactive"
      ? "Not Assigned"
      : employee.company || "Not Assigned";

  const employeeInitials = String(employee.name || "E")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const totalIncidents = employeeIncidents.length;

  const openIncidents = employeeIncidents.filter((incident) =>
    ["Open", "Investigating", "For Review"].includes(incident.status)
  ).length;

  const resolvedIncidents = employeeIncidents.filter(
    (incident) => incident.status === "Closed"
  ).length;

  const criticalIncidents = employeeIncidents.filter(
    (incident) => incident.severity === "Critical"
  ).length;

  const severityScore = employeeIncidents.reduce((sum, incident) => {
    return sum + getSeverityWeight(incident.severity);
  }, 0);

  const kpiLevel = getKPILevel(severityScore, totalIncidents);

  const riskLevel = getRiskLevel({
    kpiLevel,
    totalIncidents,
    criticalIncidents,
  });

  const recommendation = getRecommendation({
    totalIncidents,
    criticalIncidents,
    riskLevel,
  });

  const recommendationReason = getRecommendationReason({
    totalIncidents,
    criticalIncidents,
    riskLevel,
  });

  const recentIncidents = [...progressiveIncidents]
    .sort((a, b) => getIncidentTimestamp(b) - getIncidentTimestamp(a))
    .slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:h-[88vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4 dark:border-white/10 dark:from-slate-900 dark:to-slate-900 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {employeeInitials || "E"}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {employee.name}
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200">
                    {employee.id}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                      employee.status === "Inactive"
                        ? "Inactive"
                        : employee.status
                    )}`}
                  >
                    {employee.status === "Inactive" && (
                      <FiShield className="text-sm" />
                    )}
                    {employee.status}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                      overallCompliance
                    )}`}
                  >
                    {(overallCompliance === "Expired" ||
                      overallCompliance === "Expiring Soon") && (
                      <FiAlertTriangle className="text-sm" />
                    )}
                    Overall Compliance: {overallCompliance}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getRiskClasses(
                      riskLevel
                    )}`}
                  >
                    {riskLevel === "High Risk" && (
                      <FiAlertTriangle className="text-sm" />
                    )}
                    Risk: {riskLevel}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getKPIClasses(
                      kpiLevel
                    )}`}
                  >
                    KPI: {kpiLevel}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <FiX size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 text-gray-900 dark:text-white sm:px-6 sm:py-6 lg:px-8">
          {incidentError && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              {incidentError}
            </div>
          )}

          {hasAttentionNeeded && (
            <div
              className={`rounded-2xl border p-5 ${
                expiredDocs.length > 0
                  ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                  : "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
              }`}
            >
              <div className="flex items-start gap-3">
                <FiAlertTriangle
                  className={`mt-0.5 ${
                    expiredDocs.length > 0
                      ? "text-red-600 dark:text-red-300"
                      : "text-amber-600 dark:text-amber-300"
                  }`}
                  size={18}
                />

                <div>
                  <p
                    className={`font-semibold ${
                      expiredDocs.length > 0
                        ? "text-red-700 dark:text-red-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    Compliance Attention Needed
                  </p>

                  <div
                    className={`mt-1 space-y-1 text-sm ${
                      expiredDocs.length > 0
                        ? "text-red-700/90 dark:text-red-200"
                        : "text-amber-700/90 dark:text-amber-200"
                    }`}
                  >
                    {expiredDocs.length > 0 && (
                      <p>
                        {expiredDocs.length} document
                        {expiredDocs.length > 1 ? "s are" : " is"} already
                        expired.
                      </p>
                    )}

                    {expiringDocs.length > 0 && (
                      <p>
                        {expiringDocs.length} document
                        {expiringDocs.length > 1 ? "s are" : " is"} expiring
                        soon.
                      </p>
                    )}

                    {missingDocs.length > 0 && (
                      <p>
                        {missingDocs.length} required document
                        {missingDocs.length > 1 ? "s are" : " is"} missing.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InfoBox
                icon={<FiUser size={16} />}
                label="Employee Name"
                value={employee.name}
              />

              <InfoBox
                icon={<FiShield size={16} />}
                label="Employee ID"
                value={employee.id}
              />

              <InfoBox
                icon={<FiBriefcase size={16} />}
                label="Company Assignment"
                value={companyDisplay}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Employment Status
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <BadgeBox
                label="Current Status"
                value={employee.status}
                className={getStatusClasses(
                  employee.status === "Inactive" ? "Inactive" : employee.status
                )}
              />

              <BadgeBox
                label="Compliance Summary"
                value={overallCompliance}
                className={getStatusClasses(overallCompliance)}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Incident and KPI Summary
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <StatBox label="Total Incidents" value={totalIncidents} />

              <StatBox
                label="Open Cases"
                value={incidentLoading ? "..." : openIncidents}
                valueClass="text-red-500"
              />

              <StatBox
                label="Closed Cases"
                value={incidentLoading ? "..." : resolvedIncidents}
                valueClass="text-green-500"
              />

              <StatBox
                label="Severity Score"
                value={severityScore}
                valueClass="text-indigo-500"
              />

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  Risk Level
                </p>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getRiskClasses(
                    riskLevel
                  )}`}
                >
                  {riskLevel === "High Risk" && (
                    <FiAlertTriangle className="text-sm" />
                  )}
                  {riskLevel}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              System Recommendation
            </h3>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getRecommendationClasses(
                      recommendation
                    )}`}
                  >
                    {recommendation}
                  </span>

                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {recommendationReason}
                  </p>
                </div>

                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${getKPIClasses(
                    kpiLevel
                  )}`}
                >
                  KPI Level: {kpiLevel}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Recent Incident History
            </h3>

            {incidentLoading ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Loading incident history from backend...
                </p>
              </div>
            ) : recentIncidents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No incident history found for this employee.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentIncidents.map((incident) => (
                  <div
                    key={`${incident.id}-${incident.progressiveOffenseNo}`}
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
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            incident.severity === "Critical"
                              ? "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300"
                              : incident.severity === "Major"
                              ? "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300"
                              : "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300"
                          }`}
                        >
                          {incident.severity || "Minor"}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            incident.status
                          )}`}
                        >
                          {incident.status || "Open"}
                        </span>
                      </div>
                    </div>

                    {incident.description && (
                      <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                        {incident.description}
                      </p>
                    )}

                    <div
  className={`mt-3 rounded-xl border px-4 py-3 text-xs ${
    incident.progressivePolicyMatched
      ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
      : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
  }`}
>
  <p
    className={`text-[11px] font-bold uppercase tracking-wide ${
      incident.progressivePolicyMatched
        ? "text-red-700 dark:text-red-300"
        : "text-amber-700 dark:text-amber-300"
    }`}
  >
    Disciplinary Action
  </p>

  <p className="mt-2 font-bold text-slate-800 dark:text-slate-100">
    Sanction: {incident.progressiveSanction}
  </p>

  <p className="mt-1 text-slate-600 dark:text-slate-300">
    Basis: {incident.progressiveOffenseLabel}
  </p>

  {incident.progressivePolicyCategory && (
    <p className="mt-1 text-slate-500 dark:text-slate-400">
      Policy Reference: {incident.progressivePolicyCategory}
    </p>
  )}

  {!incident.progressivePolicyMatched && (
    <p className="mt-1 text-amber-700 dark:text-amber-300">
      Based on the saved sanction from the incident report.
    </p>
  )}
</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Compliance Documents
            </h3>

            <div className="space-y-4">
              {normalizedDocuments.map((doc) => {
                const isExpired = doc.status === "Expired";
                const isExpiringSoon = doc.status === "Expiring Soon";
                const isMissing = doc.status === "Missing";
                const isNoData = doc.status === "No Data";
                const isExpirable = doc.expirable;

                return (
                  <div
                    key={doc.name}
                    className={`rounded-2xl border p-5 ${
                      isExpired
                        ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                        : isExpiringSoon
                        ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                        : isMissing || isNoData
                        ? "border-orange-300 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10"
                        : "border-gray-200 bg-white dark:border-white/10 dark:bg-slate-900/40"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1 ${
                            isExpired
                              ? "text-red-500"
                              : isExpiringSoon
                              ? "text-amber-500"
                              : isMissing || isNoData
                              ? "text-orange-500"
                              : "text-indigo-500"
                          }`}
                        >
                          <FiFileText size={18} />
                        </div>

                        <div>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">
                            {doc.name}
                          </p>

                          <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                            {isExpirable && (
                              <>
                                <div className="flex items-center gap-2">
                                  <FiCalendar size={14} />
                                  <span>
                                    Expiration Date:{" "}
                                    {doc.expirationDate
                                      ? formatDate(doc.expirationDate)
                                      : "Not Set"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <FiClock size={14} />
                                  <span>
                                    {getDaysLabel(doc.expirationDate)}
                                  </span>
                                </div>
                              </>
                            )}

                            {!isExpirable && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Permanent compliance document
                              </p>
                            )}

                            {!doc.file && (
                              <p className="text-sm font-medium text-orange-600 dark:text-orange-300">
                                No uploaded file found
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        {doc.file && (
                          <button
                            type="button"
                            onClick={() => setPreviewFile(doc.file)}
                            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
                          >
                            <FiEye /> View
                          </button>
                        )}

                        <span
                          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            doc.status
                          )}`}
                        >
                          {(isExpired ||
                            isExpiringSoon ||
                            isMissing ||
                            isNoData) && (
                            <FiAlertTriangle className="text-sm" />
                          )}
                          {doc.status}
                        </span>

                        {doc.status === "Valid" && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-300">
                            <FiCheckCircle size={14} />
                            Document verified
                          </span>
                        )}

                        {(isMissing || isNoData) && (
                          <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                            Upload proof file recommended
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {previewFile && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
                onClick={() => setPreviewFile(null)}
              >
                <div
                  className="relative w-full max-w-5xl rounded-xl bg-white p-4 dark:bg-slate-900"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        File Preview
                      </p>

                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {previewFile.name || "Uploaded file"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewFile(null)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-white/10"
                    >
                      <FiX size={20} />
                    </button>
                  </div>

                  {previewFile.type?.startsWith("image/") ||
                  previewFile.data?.startsWith("data:image") ? (
                    <img
                      src={previewFile.url}
                      alt={previewFile.name || "preview"}
                      className="mx-auto max-h-[80vh] w-full rounded-lg object-contain"
                    />
                  ) : (
                    <iframe
                      src={previewFile.url}
                      title={previewFile.name || "file preview"}
                      className="h-[80vh] w-full rounded-lg border border-gray-200 dark:border-white/10"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900 sm:px-6 lg:px-8">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white transition hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
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

      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
      >
        {value}
      </span>
    </div>
  );
}

function StatBox({ label, value, valueClass = "text-gray-900 dark:text-white" }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">{label}</p>

      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}