import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import welljobLogoUrl from "../../assets/Logo.png";
import {
  formatDateTime,
  getDateOnly,
} from "./addIncidentHelpers";

const REPORT_TITLE = "Welljob Incident Records Report";

function clean(value, fallback = "-") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getIncidentDate(incident) {
  const value =
    incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.createdAtTimestamp ||
    incident?.created_at_timestamp ||
    incident?.createdAt ||
    incident?.created_at;

  if (!value) return "-";

  const dateOnly = getDateOnly(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return clean(value);
  }

  const parsed = new Date(
    `${dateOnly}T00:00:00+08:00`
  );

  if (Number.isNaN(parsed.getTime())) {
    return clean(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
}

function formatIncidentCode(id) {
  const value = clean(id, "");
  if (!value) return "-";
  if (value.startsWith("INC-")) return value;

  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? `INC-${String(numeric).padStart(4, "0")}`
    : value;
}

function getIncidentEmployeeName(incident) {
  return clean(
    incident?.employee ||
      incident?.employeeName ||
      incident?.employee_name,
    "Unknown Employee"
  );
}

function getIncidentEmployeeId(incident) {
  return clean(
    incident?.employeeId ||
      incident?.employee_id ||
      incident?.empId ||
      incident?.employeeID,
    "-"
  );
}

function getIncidentCompany(incident) {
  return clean(
    incident?.company ||
      incident?.clientCompany ||
      incident?.client_company,
    "-"
  );
}

function getIncidentViolation(incident) {
  return clean(
    incident?.violation ||
      incident?.violationType ||
      incident?.violation_type,
    "Unspecified Violation"
  );
}

function getIncidentReportedBy(incident) {
  return clean(
    incident?.reportedByFullName ||
      incident?.reported_by_full_name ||
      incident?.reportedByName ||
      incident?.reported_by_name ||
      incident?.reportedBy ||
      incident?.reported_by,
    "Not recorded"
  );
}

function getUserFullName(user) {
  const firstName = clean(user?.first_name || user?.firstName, "");
  const lastName = clean(user?.last_name || user?.lastName, "");
  const composedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return clean(
    user?.full_name ||
      user?.fullName ||
      composedName ||
      user?.name,
    "Authorized User"
  );
}

function getSelectedViolationFilter(filters = {}) {
  const value = clean(
    filters?.violationType ||
      filters?.violation_type ||
      filters?.violation,
    ""
  );

  if (!value || normalizeComparable(value) === "all") return "";
  return value;
}

function applyReportFilters(incidents, filters) {
  const selectedViolation = getSelectedViolationFilter(filters);
  if (!selectedViolation) return incidents;

  const expectedViolation = normalizeComparable(selectedViolation);

  return incidents.filter(
    (incident) =>
      normalizeComparable(getIncidentViolation(incident)) === expectedViolation
  );
}

function countBy(incidents, getValue, fallback) {
  return incidents.reduce((summary, incident) => {
    const label = clean(getValue(incident), fallback);
    summary[label] = (summary[label] || 0) + 1;
    return summary;
  }, {});
}

function toSummaryRows(summary, total) {
  const entries = Object.entries(summary).sort(
    (first, second) => second[1] - first[1]
  );

  if (entries.length === 0) return [["No records", 0, "0%"]];

  return entries.map(([label, count]) => [
    label,
    count,
    total > 0 ? `${Math.round((count / total) * 100)}%` : "0%",
  ]);
}

function getMostFrequentViolation(incidents) {
  const summary = countBy(
    incidents,
    getIncidentViolation,
    "Unspecified Violation"
  );

  const topEntry = Object.entries(summary).sort(
    (first, second) => second[1] - first[1]
  )[0];

  if (!topEntry) return "No records";

  const [violation, count] = topEntry;
  return `${violation} (${count})`;
}

function groupIncidentsByEmployee(incidents) {
  const groups = new Map();

  incidents.forEach((incident) => {
    const employeeName = getIncidentEmployeeName(incident);
    const employeeId = getIncidentEmployeeId(incident);

    const key =
      employeeId !== "-"
        ? `id:${normalizeComparable(employeeId)}`
        : `name:${normalizeComparable(employeeName)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        employeeName,
        employeeId,
        company: getIncidentCompany(incident),
        incidents: [],
      });
    }

    groups.get(key).incidents.push(incident);
  });

  return Array.from(groups.values()).sort((first, second) => {
    const frequencyDifference =
      second.incidents.length - first.incidents.length;

    if (frequencyDifference !== 0) return frequencyDifference;
    return first.employeeName.localeCompare(second.employeeName);
  });
}

function getIncidentTimestamp(incident) {
  const value =
    incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.createdAtTimestamp ||
    incident?.created_at_timestamp ||
    incident?.createdAt ||
    incident?.created_at ||
    "";

  if (!value) return 0;

  const dateOnly = getDateOnly(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return 0;
  }

  const timestamp = new Date(
    `${dateOnly}T00:00:00+08:00`
  ).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function buildGroupedIncidentRows(
  groups,
  {
    showCompanyColumn = true,
  } = {}
) {
  if (groups.length === 0) {
    const emptyRow = [
      "No incident records matched the selected filters.",
      "-",
      ...(showCompanyColumn ? ["-"] : []),
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
    ];

    return [emptyRow];
  }

  const rows = [];

  groups.forEach((group) => {
    const sortedIncidents = [...group.incidents].sort(
      (first, second) =>
        getIncidentTimestamp(second) - getIncidentTimestamp(first)
    );

    sortedIncidents.forEach((incident, index) => {
      const isFirstRow = index === 0;

      rows.push([
        isFirstRow ? group.employeeName : "",
        isFirstRow ? group.employeeId : "",
        ...(showCompanyColumn
          ? [isFirstRow ? group.company : ""]
          : []),
        isFirstRow ? group.incidents.length : "",
        formatIncidentCode(incident?.id),
        getIncidentDate(incident),
        getIncidentViolation(incident),
        clean(incident?.severity),
        clean(incident?.status),
        getIncidentReportedBy(incident),
      ]);
    });
  });

  return rows;
}

function addSectionTitle(doc, title, y) {
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y);
  doc.setFont(undefined, "normal");
}

function getNextY(doc, spacing = 8) {
  return (doc.lastAutoTable?.finalY || 36) + spacing;
}

function fileToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read Welljob logo."));
    reader.readAsDataURL(blob);
  });
}

async function loadLogoDataUrl() {
  try {
    const response = await fetch(welljobLogoUrl);
    if (!response.ok) return "";

    const blob = await response.blob();
    return await fileToDataUrl(blob);
  } catch {
    // Logo failure must not block an authorized report.
    return "";
  }
}

function getReportCompany({ scopeCompany, filters }) {
  return clean(
    scopeCompany ||
      filters?.company ||
      filters?.companyName ||
      filters?.company_name,
    "All authorized companies"
  );
}

function isCompanySpecificReport(reportCompany) {
  const normalized = normalizeComparable(reportCompany);

  return Boolean(
    normalized &&
      normalized !== "all authorized companies"
  );
}

function getActiveFilters(filters) {
  const selectedViolation = getSelectedViolationFilter(filters);

  return [
    filters?.caseTab && filters.caseTab !== "ALL"
      ? `Case group: ${filters.caseTab}`
      : "",
    filters?.status && filters.status !== "ALL"
      ? `Status: ${filters.status}`
      : "",
    filters?.severity && filters.severity !== "ALL"
      ? `Severity: ${filters.severity}`
      : "",
    selectedViolation ? `Violation: ${selectedViolation}` : "",
    filters?.search ? `Search: ${filters.search}` : "",
  ].filter(Boolean);
}

function addReportHeader({
  doc,
  logoDataUrl,
  generatedBy,
  reportCompany,
  activeFilters,
}) {
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 14, 9, 18, 18);
    } catch {
      // Keep the report usable even when image decoding fails.
    }
  }

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("WELLJOB SOLUTIONS & GENERAL SERVICES INC.", 38, 14);

  doc.setFontSize(13);
  doc.text(REPORT_TITLE, 38, 20);

  doc.setFontSize(8.5);
  doc.setFont(undefined, "normal");
  doc.setTextColor(71, 85, 105);

  doc.text(`Company: ${reportCompany}`, 14, 32);
  doc.text(`Generated by: ${generatedBy}`, 14, 37);
  doc.text(
    `Generated on: ${formatDateTime(
      new Date().toISOString()
    )}`,
    14,
    42
  );

  const filterText =
    activeFilters.length > 0
      ? activeFilters.join(" | ")
      : "Filters: All incident records";

  doc.text(filterText, 145, 32, { maxWidth: 138 });
}

function addPageFooters(doc) {
  const pageCount = doc.internal.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(7);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100);
    doc.text(
      `${REPORT_TITLE} | Page ${pageNumber} of ${pageCount}`,
      pageWidth - 14,
      pageHeight - 7,
      { align: "right" }
    );
  }
}

export async function exportIncidentReportPDF({
  incidents = [],
  user,
  scopeCompany = "",
  filters = {},
}) {
  const sourceIncidents = Array.isArray(incidents) ? incidents : [];

  /*
   * The page should already pass the filtered dataset.
   * Violation Type is also enforced here so a selected
   * violation can never accidentally export unrelated
   * incidents.
   */
  const safeIncidents = applyReportFilters(sourceIncidents, filters);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const total = safeIncidents.length;
  const employeeGroups = groupIncidentsByEmployee(safeIncidents);
  const generatedBy = getUserFullName(user);
  const reportCompany = getReportCompany({ scopeCompany, filters });
  const showCompanyColumn =
    !isCompanySpecificReport(reportCompany);
  const activeFilters = getActiveFilters(filters);
  const logoDataUrl = await loadLogoDataUrl();

  addReportHeader({
    doc,
    logoDataUrl,
    generatedBy,
    reportCompany,
    activeFilters,
  });

  addSectionTitle(doc, "Report Summary", 53);

  autoTable(doc, {
    startY: 57,
    head: [[
      "Employees",
      "Incident Reports",
      "Active",
      "For Review",
      "Closed",
      "Critical",
      "Most Frequent Violation",
    ]],
    body: [[
      employeeGroups.length,
      total,
      safeIncidents.filter((incident) =>
        ["Open", "Investigating"].includes(clean(incident?.status))
      ).length,
      safeIncidents.filter(
        (incident) => clean(incident?.status) === "For Review"
      ).length,
      safeIncidents.filter(
        (incident) => clean(incident?.status) === "Closed"
      ).length,
      safeIncidents.filter(
        (incident) => clean(incident?.severity) === "Critical"
      ).length,
      getMostFrequentViolation(safeIncidents),
    ]],
    theme: "grid",
    styles: {
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
      cellPadding: 2.3,
    },
    headStyles: {
      fillColor: [30, 41, 59],
    },
    columnStyles: {
      6: { cellWidth: 58 },
    },
  });

  const violationSummary = countBy(
    safeIncidents,
    getIncidentViolation,
    "Unspecified Violation"
  );
  const statusSummary = countBy(
    safeIncidents,
    (incident) => incident?.status,
    "Unspecified Status"
  );
  const severitySummary = countBy(
    safeIncidents,
    (incident) => incident?.severity,
    "Unspecified Severity"
  );

  const firstSummaryY = getNextY(doc, 9);
  addSectionTitle(doc, "Violation Summary", firstSummaryY);

  autoTable(doc, {
    startY: firstSummaryY + 4,
    head: [["Violation Type", "Frequency", "Share"]],
    body: toSummaryRows(violationSummary, total),
    theme: "striped",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
    tableWidth: 82,
    margin: { left: 14 },
  });

  const parallelSummaryY = doc.lastAutoTable?.startY || firstSummaryY + 4;

  autoTable(doc, {
    startY: parallelSummaryY,
    head: [["Status", "Records", "Share"]],
    body: toSummaryRows(statusSummary, total),
    theme: "striped",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [14, 165, 233] },
    tableWidth: 82,
    margin: { left: 107 },
  });

  autoTable(doc, {
    startY: parallelSummaryY,
    head: [["Severity", "Records", "Share"]],
    body: toSummaryRows(severitySummary, total),
    theme: "striped",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [245, 158, 11] },
    tableWidth: 82,
    margin: { left: 200 },
  });

  doc.addPage();
  addSectionTitle(doc, "Incident Records by Employee", 14);

  const incidentTableHead = [[
    "Full Name",
    "Employee ID",
    ...(showCompanyColumn ? ["Company"] : []),
    "Freq.",
    "Incident ID",
    "Date",
    "Violation",
    "Severity",
    "Status",
    "Reported By",
  ]];

  const incidentTableColumnStyles =
    showCompanyColumn
      ? {
          0: { cellWidth: 32, fontStyle: "bold" },
          1: { cellWidth: 18 },
          2: { cellWidth: 32 },
          3: {
            cellWidth: 16,
            halign: "center",
            fontStyle: "bold",
          },
          4: { cellWidth: 19 },
          5: { cellWidth: 21 },
          6: { cellWidth: 42 },
          7: { cellWidth: 18 },
          8: { cellWidth: 21 },
          9: { cellWidth: 32 },
        }
      : {
          0: { cellWidth: 40, fontStyle: "bold" },
          1: { cellWidth: 20 },
          2: {
            cellWidth: 16,
            halign: "center",
            fontStyle: "bold",
          },
          3: { cellWidth: 20 },
          4: { cellWidth: 22 },
          5: { cellWidth: 52 },
          6: { cellWidth: 20 },
          7: { cellWidth: 20 },
          8: { cellWidth: 40 },
        };

  autoTable(doc, {
    startY: 18,
    margin: {
      top: 18,
      left: 14,
      right: 14,
      bottom: 14,
    },
    head: incidentTableHead,
    body: buildGroupedIncidentRows(
      employeeGroups,
      {
        showCompanyColumn,
      }
    ),
    theme: "grid",
    styles: {
      fontSize: 6.8,
      cellPadding: 1.8,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 41, 59],
      fontSize: 7.2,
      overflow: "visible",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles:
      incidentTableColumnStyles,
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Incident Records by Employee", 14, 10);
      }
    },
  });

  addPageFooters(doc);

  const dateStamp =
    getDateOnly(
      new Date().toISOString()
    );

  doc.save(
    `Welljob_Incident_Records_${dateStamp}.pdf`
  );
}