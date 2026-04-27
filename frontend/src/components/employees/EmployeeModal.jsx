import { useState } from "react";
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

const INCIDENTS_KEY = "incidents";

const EXPIRABLE_DOCUMENTS = ["Barangay Clearance", "NBI/Police Clearance"];

function isExpirableDocument(docName) {
  return EXPIRABLE_DOCUMENTS.includes(docName);
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

  const hasFile = !!doc.file;
  const isExpirable = isExpirableDocument(doc.name);

  if (!hasFile) return "No Data";

  if (!isExpirable) return "Valid";

  if (!doc.expirationDate) return "No Data";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(doc.expirationDate);
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
    Inactive:
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30",
    Deployed:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
    "Floating / Standby":
      "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
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

function getEmployeeIncidents(employee) {
  try {
    const stored = JSON.parse(localStorage.getItem(INCIDENTS_KEY) || "[]");

    return stored.filter((incident) => {
      const matchesById =
        String(incident.employeeId || "") === String(employee.id || "");

      const matchesByName =
        String(incident.employee || "").trim().toLowerCase() ===
        String(employee.name || "").trim().toLowerCase();

      return matchesById || matchesByName;
    });
  } catch (error) {
    console.error("Failed to load employee incidents:", error);
    return [];
  }
}

function getRiskLevel(totalIncidents) {
  if (totalIncidents >= 3) return "High Risk";
  if (totalIncidents === 2) return "Repeat";
  if (totalIncidents === 1) return "Monitor";
  return "Clean";
}

function getRiskClasses(level) {
  const styles = {
    "High Risk":
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    Repeat:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    Monitor:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
    Clean:
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
  };

  return styles[level] || styles.Clean;
}

export default function EmployeeModal({ employee, onClose }) {
  const [previewFile, setPreviewFile] = useState(null);

  if (!employee) return null;

  const employeeIncidents = getEmployeeIncidents(employee);

  const normalizedDocuments = (employee.documents || []).map((doc) => ({
    ...doc,
    expirable: isExpirableDocument(doc.name),
    status: getDocumentStatus(doc),
  }));

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

  const openIncidents = employeeIncidents.filter(
    (incident) => incident.status !== "Resolved"
  ).length;

  const resolvedIncidents = employeeIncidents.filter(
    (incident) => incident.status === "Resolved"
  ).length;

  const riskLevel = getRiskLevel(totalIncidents);

  const recentIncidents = [...employeeIncidents]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 5);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[92vh] sm:h-[88vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-gray-200 dark:border-white/10 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xl font-bold">
                {employeeInitials || "E"}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {employee.name}
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-white text-gray-700 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-700">
                    {employee.id}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getRiskClasses(
                      riskLevel
                    )}`}
                  >
                    {riskLevel === "High Risk" && (
                      <FiAlertTriangle className="text-sm" />
                    )}
                    Risk: {riskLevel}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
            >
              <FiX size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 text-gray-900 dark:text-white">
          {hasAttentionNeeded && (
            <div
              className={`rounded-2xl p-5 border ${
                expiredDocs.length > 0
                  ? "border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30"
                  : "border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30"
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
                    className={`text-sm mt-1 space-y-1 ${
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                  <FiUser size={16} />
                  <span className="text-sm">Employee Name</span>
                </div>
                <p className="font-semibold text-base">{employee.name}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                  <FiShield size={16} />
                  <span className="text-sm">Employee ID</span>
                </div>
                <p className="font-semibold text-base">{employee.id}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                  <FiBriefcase size={16} />
                  <span className="text-sm">Company Assignment</span>
                </div>
                <p className="font-semibold text-base">{companyDisplay}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Employment Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Current Status
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
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
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Compliance Summary
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
                    overallCompliance
                  )}`}
                >
                  {(overallCompliance === "Expired" ||
                    overallCompliance === "Expiring Soon") && (
                    <FiAlertTriangle className="text-sm" />
                  )}
                  {overallCompliance}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Incident Summary
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Total Incidents
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalIncidents}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Open Cases
                </p>
                <p className="text-2xl font-bold text-red-500">
                  {openIncidents}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Resolved Cases
                </p>
                <p className="text-2xl font-bold text-green-500">
                  {resolvedIncidents}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Risk Level
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getRiskClasses(
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Recent Incident History
            </h3>

            {recentIncidents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No incident history found for this employee.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        {typeof incident.violation === "object"
                          ? incident.violation?.label ||
                            incident.violation?.violation ||
                            "No violation type"
                          : incident.violation || "No violation type"}

                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {incident.id} • {formatDate(incident.date)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            incident.severity === "Critical"
                              ? "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30"
                              : incident.severity === "Major"
                              ? "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30"
                              : "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30"
                          }`}
                        >
                          {incident.severity || "Minor"}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            incident.status === "Resolved"
                              ? "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30"
                              : incident.status === "Investigating"
                              ? "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30"
                              : "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30"
                          }`}
                        >
                          {incident.status || "Open"}
                        </span>
                      </div>
                    </div>

                    {incident.description && (
                      <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                        {incident.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
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
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
                          <p className="font-semibold text-base text-gray-900 dark:text-white">
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
                                  <span>{getDaysLabel(doc.expirationDate)}</span>
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

                      <div className="flex flex-col items-start lg:items-end gap-2">
                        {doc.file && (
                          <button
                            type="button"
                            onClick={() => setPreviewFile(doc.file)}
                            className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 text-xs"
                          >
                            <FiEye /> View
                          </button>
                        )}

                        <span
                          className={`inline-flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
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
                            Permanent document verified
                          </span>
                        )}

                        {(isMissing || isNoData) && (
                          <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">
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
                className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4"
                onClick={() => setPreviewFile(null)}
              >
                <div
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl max-w-5xl w-full relative"
                  onClick={(e) => e.stopPropagation()}
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
                      className="mx-auto max-h-[80vh] w-full object-contain rounded-lg"
                    />
                  ) : (
                    <iframe
                      src={previewFile.url}
                      title={previewFile.name || "file preview"}
                      className="w-full h-[80vh] rounded-lg border border-gray-200 dark:border-white/10"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-t border-gray-200 dark:border-white/10 flex justify-end bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}