import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addReportContinuationHeader,
  addReportFooters,
  addReportHeader,
  addReportSectionTitle,
  formatReportDateTime,
  formatReportPercentage,
  getReportTableStyles,
  getReportUserName,
  getReportUserRole,
  loadWelljobLogoDataUrl,
} from "../pdf/reportPdf.js";

const REPORT_TITLE = "KPI and Performance Report";
const CASE_STATUS_ORDER = ["Open", "Investigating", "For Review", "Closed"];

const safeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const safeNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const clean = (value, fallback = "Unassigned") => String(value ?? "").trim() || fallback;

function friendlyStatus(value) {
  return clean(value, "Unspecified")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function totalBy(employees, key, fallbackKey = "") {
  return safeArray(employees).reduce(
    (total, employee) => total + safeNumber(employee?.[key] ?? (fallbackKey ? employee?.[fallbackKey] : 0)),
    0
  );
}

function countBy(employees, key, fallback) {
  return safeArray(employees).reduce((summary, employee) => {
    const label = clean(employee?.[key], fallback);
    summary[label] = (summary[label] || 0) + 1;
    return summary;
  }, {});
}

export function buildKpiSummaryRows(summary, total, preferredOrder = []) {
  const entries = Object.entries(summary || {});
  if (!entries.length) return [["No data available", 0, "0%"]];
  const order = new Map(preferredOrder.map((label, index) => [label, index]));
  return entries
    .sort((left, right) => {
      const leftOrder = order.has(left[0]) ? order.get(left[0]) : Number.MAX_SAFE_INTEGER;
      const rightOrder = order.has(right[0]) ? order.get(right[0]) : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || safeNumber(right[1]) - safeNumber(left[1]) || left[0].localeCompare(right[0]);
    })
    .map(([label, count]) => [label, safeNumber(count), formatReportPercentage(count, total)]);
}

export function buildKpiCaseStatusSummary(incidents = []) {
  const counts = new Map();
  for (const incident of safeArray(incidents)) {
    const status = friendlyStatus(incident?.status);
    counts.set(status, (counts.get(status) || 0) + 1);
  }
  const order = new Map(CASE_STATUS_ORDER.map((status, index) => [status, index]));
  const rows = [...counts.entries()]
    .sort((left, right) => {
      const leftOrder = order.has(left[0]) ? order.get(left[0]) : Number.MAX_SAFE_INTEGER;
      const rightOrder = order.has(right[0]) ? order.get(right[0]) : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left[0].localeCompare(right[0]);
    })
    .map(([status, count]) => ({ status, count }));
  return { rows, total: rows.reduce((total, row) => total + row.count, 0) };
}

export function buildKpiCompanySummary(employees = [], incidents = []) {
  const companies = new Map();
  const ensureCompany = (company) => {
    const name = clean(company);
    if (!companies.has(name)) {
      companies.set(name, {
        company: name,
        employeesCovered: 0,
        lowRisk: 0,
        monitor: 0,
        repeat: 0,
        highRisk: 0,
        caseStatuses: {},
        totalCases: 0,
        countedViolations: 0,
        currentIncidents: 0,
        historicalIncidents: 0,
      });
    }
    return companies.get(name);
  };

  safeArray(employees).forEach((employee) => {
    const company = ensureCompany(employee?.company);
    company.employeesCovered += 1;
    company.countedViolations += safeNumber(employee?.activeViolationCount);
    switch (clean(employee?.riskLevel, "Low Risk")) {
      case "Monitor": company.monitor += 1; break;
      case "Repeat": company.repeat += 1; break;
      case "High Risk": company.highRisk += 1; break;
      default: company.lowRisk += 1; break;
    }

    safeArray(employee?.scoredIncidents).forEach((incident) => {
      const incidentCompany = ensureCompany(
        incident?.company ||
          incident?.clientCompany
      );
      incidentCompany.historicalIncidents += 1;
      if (incident?.isActive) {
        incidentCompany.currentIncidents += 1;
      }
    });
  });

  safeArray(incidents).forEach((incident) => {
    const company = ensureCompany(incident?.company || incident?.clientCompany);
    const status = friendlyStatus(incident?.status);
    company.caseStatuses[status] = (company.caseStatuses[status] || 0) + 1;
    company.totalCases += 1;
  });

  return [...companies.values()].sort(
    (left, right) => right.employeesCovered - left.employeesCovered || left.company.localeCompare(right.company)
  );
}

function addSummaryTable(doc, { title, label, rows, startY }) {
  addReportSectionTitle(doc, title, startY);
  autoTable(doc, {
    startY: startY + 4,
    head: [[label, "Employees", "Percentage"]],
    body: rows,
    ...getReportTableStyles({ fontSize: 8.5, cellPadding: 2.2 }),
    margin: { left: 14, right: 14, top: 16, bottom: 17 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    rowPageBreak: "avoid",
  });
}

export async function exportKPIReportPDF({
  user,
  totalEmployees = 0,
  deployedEmployees = 0,
  goodStandingEmployees = 0,
  criticalAlerts = [],
  employees = [],
  incidents = [],
  save = true,
}) {
  const safeEmployees = safeArray(employees);
  const safeIncidents = safeArray(incidents);
  const safeTotalEmployees = safeNumber(totalEmployees) || safeEmployees.length;
  const countedViolations = totalBy(safeEmployees, "activeViolationCount", "violationCount");
  const caseSummary = buildKpiCaseStatusSummary(safeIncidents);
  const logoDataUrl = await loadWelljobLogoDataUrl();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const contentStartY = addReportHeader({
    doc,
    title: REPORT_TITLE,
    logoDataUrl,
    metadata: [
      ["Report scope", "Current authorized workforce"],
      ["Prepared by", getReportUserName(user)],
      ["Role", getReportUserRole(user)],
      ["Generated on", formatReportDateTime(new Date())],
    ],
  });

  addReportSectionTitle(doc, "Employee Performance Overview", contentStartY + 2);
  autoTable(doc, {
    startY: contentStartY + 6,
    head: [["Employee Performance Measure", "Count"]],
    body: [
      ["Total Employees Evaluated", safeTotalEmployees],
      ["Currently Deployed Employees", safeNumber(deployedEmployees)],
      ["Good Standing", safeNumber(goodStandingEmployees)],
      ["Monitor", safeEmployees.filter((employee) => employee?.riskLevel === "Monitor").length],
      ["Repeat", safeEmployees.filter((employee) => employee?.riskLevel === "Repeat").length],
      ["High Risk", safeEmployees.filter((employee) => employee?.riskLevel === "High Risk").length],
      ["KPI-Counted Violation Records", countedViolations],
    ],
    ...getReportTableStyles({ fontSize: 9, cellPadding: 2.4 }),
    tableWidth: 180,
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14, top: 16, bottom: 17 },
  });

  addReportSectionTitle(doc, "Incident Case Summary", doc.lastAutoTable.finalY + 8);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    head: [["Case Status", "Number of Cases"]],
    body: [
      ...(caseSummary.rows.length ? caseSummary.rows.map((row) => [row.status, row.count]) : [["No recorded cases", 0]]),
      ["Total Recorded Cases", caseSummary.total],
    ],
    ...getReportTableStyles({ fontSize: 8.5, cellPadding: 2 }),
    tableWidth: 180,
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14, top: 16, bottom: 17 },
  });

  const alerts = safeArray(criticalAlerts);
  if (alerts.length) {
    addReportSectionTitle(doc, "Current HR Attention Items", doc.lastAutoTable.finalY + 8);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      head: [["Priority", "Attention Item"]],
      body: alerts.map((alert) => [clean(alert?.level, "Unspecified"), clean(alert?.text, "No details available")]),
      ...getReportTableStyles({ fontSize: 8, cellPadding: 2 }),
      margin: { left: 14, right: 14, top: 16, bottom: 17 },
      rowPageBreak: "avoid",
    });
  }

  doc.addPage("a4", "portrait");
  addReportContinuationHeader(doc, REPORT_TITLE);
  addSummaryTable(doc, {
    title: "Employee Risk and Performance Summary",
    label: "Employee Risk Level",
    rows: buildKpiSummaryRows(
      countBy(safeEmployees, "riskLevel", "Unspecified Risk"),
      safeTotalEmployees,
      ["Low Risk", "Monitor", "Repeat", "High Risk"]
    ),
    startY: 18,
  });
  addSummaryTable(doc, {
    title: "Employee Performance Categories",
    label: "Performance Category",
    rows: buildKpiSummaryRows(
      countBy(safeEmployees, "kpiLevel", "Unspecified KPI"),
      safeTotalEmployees,
      ["Good Standing", "Minor Concern", "Needs Improvement", "Critical Concern"]
    ),
    startY: doc.lastAutoTable.finalY + 9,
  });

  const companySummary = buildKpiCompanySummary(safeEmployees, safeIncidents);
  const representedStatuses = [...new Set(companySummary.flatMap((company) => Object.keys(company.caseStatuses || {})))];
  const statusColumns = [
    ...CASE_STATUS_ORDER.filter((status) => representedStatuses.includes(status)),
    ...representedStatuses.filter((status) => !CASE_STATUS_ORDER.includes(status)).sort(),
  ];
  doc.addPage("a4", "portrait");
  addReportContinuationHeader(doc, REPORT_TITLE);
  addReportSectionTitle(doc, "Company Performance Overview", 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Employee classifications and incident case statuses are reported separately.", 14, 23);
  const companyStyles = getReportTableStyles({ fontSize: statusColumns.length > 3 ? 6.1 : 6.7, cellPadding: 1.35 });
  autoTable(doc, {
    startY: 27,
    head: [["Client Company", "Employees", "Low", "Monitor", "Repeat", "High", ...statusColumns, "Total Cases"]],
    body: companySummary.length
      ? companySummary.map((company) => [
          company.company,
          company.employeesCovered,
          company.lowRisk,
          company.monitor,
          company.repeat,
          company.highRisk,
          ...statusColumns.map((status) => safeNumber(company.caseStatuses?.[status])),
          company.totalCases,
        ])
      : [["No company data available", 0, 0, 0, 0, 0, ...statusColumns.map(() => 0), 0]],
    ...companyStyles,
    styles: { ...companyStyles.styles, minCellWidth: 0 },
    columnStyles: { 0: { cellWidth: 48 } },
    margin: { left: 8, right: 8, top: 16, bottom: 17 },
    rowPageBreak: "avoid",
    didDrawPage: (data) => {
      if (data.pageNumber > 1) addReportContinuationHeader(doc, `${REPORT_TITLE} — Company Performance Overview`);
    },
  });

  addReportFooters(doc, {
    reportTitle: REPORT_TITLE,
    advisory: "Confidential workforce performance report — authorized HR use only.",
  });
  if (save) doc.save(`Welljob_KPI_Performance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  return doc;
}