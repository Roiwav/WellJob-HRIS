import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getDateOnly } from "./addIncidentHelpers.js";
import {
  addReportContinuationHeader,
  addReportFooters,
  addReportHeader,
  addReportSectionTitle,
  ensureReportSpace,
  formatReportDateTime,
  formatReportPercentage,
  getReportTableStyles,
  getReportUserName,
  getReportUserRole,
  loadWelljobLogoDataUrl,
} from "../pdf/reportPdf.js";

const REPORT_TITLE = "Incident Records Report";

function clean(value, fallback = "-") {
  return String(value ?? "").trim() || fallback;
}

function normalize(value) {
  return clean(value, "").replace(/\s+/g, " ").toLowerCase();
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getIncidentEmployeeName(incident) {
  return clean(incident?.employee || incident?.employeeName || incident?.employee_name, "Unknown Employee");
}

function getIncidentEmployeeId(incident) {
  return clean(incident?.employeeId || incident?.employee_id || incident?.empId || incident?.employeeID);
}

function getIncidentCompany(incident) {
  return clean(incident?.company || incident?.clientCompany || incident?.client_company, "Unassigned");
}

function getIncidentType(incident) {
  return clean(incident?.violation || incident?.violationType || incident?.violation_type, "Unspecified Concern");
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

function getIncidentDate(incident) {
  const value =
    incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.createdAt ||
    incident?.created_at;
  if (!value) return "-";
  const dateOnly = getDateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return clean(value);
  const parsed = new Date(`${dateOnly}T00:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return clean(value);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
}

function formatCaseNumber(id) {
  const value = clean(id, "");
  if (!value) return "-";
  if (/^INC-/i.test(value)) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `INC-${String(numeric).padStart(4, "0")}` : value;
}

function summarize(records, getLabel) {
  return safeArray(records).reduce((summary, record) => {
    const label = clean(getLabel(record), "Unspecified");
    summary[label] = (summary[label] || 0) + 1;
    return summary;
  }, {});
}

function summaryRows(summary, total) {
  const entries = Object.entries(summary || {});
  return entries.length
    ? entries
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([label, count]) => [label, count, formatReportPercentage(count, total)])
    : [["No records", 0, "0%"]];
}

export function buildIncidentCompanyOverview(incidents = [], authorizedCompanies = []) {
  const groups = new Map();
  safeArray(incidents).forEach((incident) => {
    const company = getIncidentCompany(incident);
    if (!groups.has(company)) groups.set(company, []);
    groups.get(company).push(incident);
  });

  const withIncidents = [...groups.entries()]
    .map(([company, records]) => ({
      company,
      employeesInvolved: new Set(records.map((record) => getIncidentEmployeeId(record) || getIncidentEmployeeName(record))).size,
      incidentRecords: records.length,
      records,
    }))
    .sort((left, right) => right.incidentRecords - left.incidentRecords || left.company.localeCompare(right.company));

  const incidentCompanies = new Set(withIncidents.map((group) => normalize(group.company)));
  const roster = [...new Set(safeArray(authorizedCompanies).map((company) => clean(company, "")).filter(Boolean))];
  const withoutIncidents = roster
    .filter((company) => !incidentCompanies.has(normalize(company)))
    .sort((left, right) => left.localeCompare(right));

  return { withIncidents, withoutIncidents, rosterAvailable: roster.length > 0 };
}

function getPeriodLabel(filters = {}) {
  const month = clean(filters?.month, "");
  const year = clean(filters?.year, "");
  if ((!month || normalize(month) === "all") && (!year || normalize(year) === "all")) return "All available records";
  if (!month || normalize(month) === "all") return `Full Year ${year}`;
  const monthIndex = Number(month) - 1;
  const monthLabel = Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex < 12
    ? new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, monthIndex, 1)))
    : month;
  return `${monthLabel}${year && normalize(year) !== "all" ? ` ${year}` : ""}`;
}

function drawCompactSummary(doc, { title, head, body, startY }) {
  addReportSectionTitle(doc, title, startY);
  autoTable(doc, {
    startY: startY + 4,
    head: [head],
    body,
    ...getReportTableStyles({ fontSize: 7.6, cellPadding: 1.7 }),
    margin: { left: 14, right: 14, top: 16, bottom: 17 },
    rowPageBreak: "avoid",
  });
  return doc.lastAutoTable.finalY;
}

export async function exportIncidentReportPDF({
  incidents = [],
  authorizedCompanies = [],
  user,
  scopeCompany = "",
  filters = {},
  save = true,
}) {
  const records = safeArray(incidents);
  const companyOverview = buildIncidentCompanyOverview(records, authorizedCompanies);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logoDataUrl = await loadWelljobLogoDataUrl();
  const contentStartY = addReportHeader({
    doc,
    logoDataUrl,
    title: REPORT_TITLE,
    orientation: "landscape",
    metadata: [
      ["Report period", getPeriodLabel(filters)],
      ["Company scope", scopeCompany || "All authorized client companies"],
      ["Prepared by", getReportUserName(user)],
      ["Role", getReportUserRole(user)],
      ["Generated on", formatReportDateTime()],
    ],
  });

  const employeesWithIncidents = new Set(records.map((record) => getIncidentEmployeeId(record) || getIncidentEmployeeName(record))).size;
  addReportSectionTitle(doc, "Incident Overview", contentStartY + 2);
  autoTable(doc, {
    startY: contentStartY + 6,
    head: [["Overview Measure", "Total"]],
    body: [
      ["Total Recorded Incidents", records.length],
      ["Employees with Recorded Incidents", employeesWithIncidents],
      ["Companies with Recorded Incidents", companyOverview.withIncidents.length],
      ...(companyOverview.rosterAvailable
        ? [["Companies with No Recorded Incidents", companyOverview.withoutIncidents.length]]
        : []),
    ],
    ...getReportTableStyles({ fontSize: 8, cellPadding: 1.8 }),
    tableWidth: 128,
    margin: { left: 14 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });

  let y = doc.lastAutoTable.finalY + 7;
  y = drawCompactSummary(doc, {
    title: "Types of Reported Incidents",
    head: ["Type of Concern", "Number of Cases", "Percentage"],
    body: summaryRows(summarize(records, getIncidentType), records.length),
    startY: y,
  }) + 7;
  y = drawCompactSummary(doc, {
    title: "Case Status Summary",
    head: ["Case Status", "Number of Cases", "Percentage"],
    body: summaryRows(summarize(records, (incident) => incident?.status), records.length),
    startY: y,
  }) + 7;
  y = drawCompactSummary(doc, {
    title: "Severity Summary",
    head: ["Severity", "Number of Cases", "Percentage"],
    body: summaryRows(summarize(records, (incident) => incident?.severity), records.length),
    startY: y,
  }) + 8;

  y = ensureReportSpace(doc, { y, requiredHeight: 24, title: REPORT_TITLE, nextPageY: 18 });
  addReportSectionTitle(doc, "Companies with Recorded Incidents", y);
  autoTable(doc, {
    startY: y + 4,
    head: [["Client Company", "Employees Involved", "Incident Records"]],
    body: companyOverview.withIncidents.length
      ? companyOverview.withIncidents.map((group) => [group.company, group.employeesInvolved, group.incidentRecords])
      : [["No company has recorded incidents in this scope", 0, 0]],
    ...getReportTableStyles({ fontSize: 8, cellPadding: 1.8 }),
    margin: { left: 14, right: 14, top: 16, bottom: 17 },
    rowPageBreak: "avoid",
    didDrawPage: (data) => {
      if (data.pageNumber > 1) addReportContinuationHeader(doc, REPORT_TITLE);
    },
  });

  if (companyOverview.rosterAvailable) {
    y = ensureReportSpace(doc, {
      y: doc.lastAutoTable.finalY + 8,
      requiredHeight: Math.min(50, 12 + companyOverview.withoutIncidents.length * 6),
      title: REPORT_TITLE,
      nextPageY: 18,
    });
    addReportSectionTitle(doc, "Companies with No Recorded Incidents", y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Client Company", "Incident Records"]],
      body: companyOverview.withoutIncidents.length
        ? companyOverview.withoutIncidents.map((company) => [company, 0])
        : [["None", 0]],
      ...getReportTableStyles({ fontSize: 8, cellPadding: 1.8 }),
      margin: { left: 14, right: 14, top: 16, bottom: 17 },
      rowPageBreak: "avoid",
    });
  }

  for (const group of companyOverview.withIncidents) {
    doc.addPage();
    addReportContinuationHeader(doc, REPORT_TITLE);
    addReportSectionTitle(doc, group.company, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Employees with Incidents: ${group.employeesInvolved}   |   Total Recorded Incidents: ${group.incidentRecords}`, 14, 23);
    autoTable(doc, {
      startY: 27,
      head: [[
        "Employee Name",
        "Employee ID",
        "Case No.",
        "Date Reported",
        "Type of Concern",
        "Severity",
        "Case Status",
        "Reported By",
      ]],
      body: group.records.map((incident, index) => {
        const previous = group.records[index - 1];
        const sameEmployee = previous &&
          (getIncidentEmployeeId(previous) || getIncidentEmployeeName(previous)) ===
            (getIncidentEmployeeId(incident) || getIncidentEmployeeName(incident));
        return [
          sameEmployee ? "" : getIncidentEmployeeName(incident),
          sameEmployee ? "" : getIncidentEmployeeId(incident),
          formatCaseNumber(incident?.id),
          getIncidentDate(incident),
          getIncidentType(incident),
          clean(incident?.severity),
          clean(incident?.status),
          getIncidentReportedBy(incident),
        ];
      }),
      ...getReportTableStyles({ fontSize: 6.7, cellPadding: 1.6 }),
      margin: { left: 10, right: 10, top: 22, bottom: 17 },
      rowPageBreak: "avoid",
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          addReportContinuationHeader(doc, `${REPORT_TITLE} — ${group.company} (continued)`);
        }
      },
    });
  }

  addReportFooters(doc, {
    reportTitle: REPORT_TITLE,
    advisory: "Confidential incident information — authorized HR use only.",
  });
  if (save) {
    doc.save(`Welljob_Incident_Records_${getDateOnly(new Date().toISOString())}.pdf`);
  }
  return doc;
}