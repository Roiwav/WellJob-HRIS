import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addReportContinuationHeader,
  addReportFooters,
  addReportHeader,
  addReportSectionTitle,
  ensureReportSpace,
  formatReportDateTime,
  getReportTableStyles,
  getReportUserName,
  getReportUserRole,
  loadWelljobLogoDataUrl,
} from "../pdf/reportPdf.js";
import { getDeploymentEndReasonDisplay } from "./deploymentHelpers.js";

const REPORT_TITLE = "Deployment and Separation Report";
const SEPARATION_STATUSES = new Set(["Resigned", "Terminated", "AWOL", "Other Separation"]);
const clean = (value, fallback = "-") => String(value ?? "").trim() || fallback;
const safeNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return clean(value);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function getDeploymentReportDisplayStatus(deployment) {
  const display = clean(deployment?.displayStatus || deployment?.display_status, "");
  if (display) return display === "Ended" ? "Other Separation" : display;
  const status = clean(deployment?.deploymentStatus || deployment?.deployment_status || deployment?.status, "Other Separation");
  return status === "Active" ? "Deployed" : status;
}

export function isEmploymentSeparationRecord(deployment) {
  return SEPARATION_STATUSES.has(getDeploymentReportDisplayStatus(deployment));
}

export function buildDeploymentCompanyGroups(deployments = [], workforceByCompany = []) {
  const groups = new Map();
  const ensure = (company) => {
    const name = clean(company, "Unassigned");
    if (!groups.has(name)) {
      groups.set(name, {
        company: name,
        records: [],
        separations: [],
        totalRecords: 0,
        currentlyDeployed: 0,
        floatingStandby: 0,
        endedDeployments: 0,
      });
    }
    return groups.get(name);
  };

  for (const record of Array.isArray(deployments) ? deployments : []) {
    const group = ensure(record?.company);
    const status = getDeploymentReportDisplayStatus(record);
    group.records.push(record);
    group.totalRecords += 1;
    if (status === "Deployed") group.currentlyDeployed += 1;
    else group.endedDeployments += 1;
    if (isEmploymentSeparationRecord(record)) group.separations.push(record);
  }

  for (const row of Array.isArray(workforceByCompany) ? workforceByCompany : []) {
    ensure(row?.company).floatingStandby = safeNumber(row?.floatingStandby);
  }

  return [...groups.values()].sort(
    (left, right) => right.totalRecords - left.totalRecords || left.company.localeCompare(right.company)
  );
}

export async function exportProfessionalDeploymentReportPDF({
  reportData,
  user,
  selectedStatus,
  selectedMonth,
  selectedYear,
  selectedEndReason,
  save = true,
}) {
  const deployments = Array.isArray(reportData?.deployments) ? reportData.deployments : [];
  const summary = reportData?.summary || {};
  const scopeCompany = clean(reportData?.scope?.company, "All authorized client companies");
  const rawMonth = String(selectedMonth ?? "").trim();
  const monthIndex = rawMonth === "" ? null : Number(rawMonth);
  const monthLabel = Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex < 12
    ? new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, monthIndex, 1)))
    : "All Months";
  const period = selectedYear
    ? `${monthLabel === "All Months" ? "Full Year" : monthLabel} ${selectedYear}`
    : monthLabel === "All Months" ? "All available records" : monthLabel;
  const statusLabel = clean(selectedStatus, "All Statuses") === "Ended" ? "Other Separation" : clean(selectedStatus, "All Statuses");
  const logoDataUrl = await loadWelljobLogoDataUrl();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const contentStartY = addReportHeader({
    doc,
    title: REPORT_TITLE,
    logoDataUrl,
    metadata: [
      ["Reporting period", period],
      ["Company scope", scopeCompany],
      ["Record status", statusLabel],
      ["Deployment end reason", clean(selectedEndReason, "All Reasons")],
      ["Prepared by", getReportUserName(user)],
      ["Role", getReportUserRole(user)],
      ["Generated on", formatReportDateTime(reportData?.generatedAt || new Date())],
    ],
  });

  addReportSectionTitle(doc, "Overall Deployment Summary", contentStartY + 2);
  autoTable(doc, {
    startY: contentStartY + 6,
    head: [["Assignment Record Category", "Count"]],
    body: [
      ["Total Deployment Records", safeNumber(summary.totalRecords) || deployments.length],
      ["Currently Deployed", safeNumber(summary.deployed)],
      ["Completed Deployments", safeNumber(summary.completed)],
      ["Resigned", safeNumber(summary.resigned)],
      ["Terminated", safeNumber(summary.terminated)],
      ["AWOL", safeNumber(summary.awol)],
      ["Other Separation", safeNumber(summary.ended)],
    ],
    ...getReportTableStyles({ fontSize: 9, cellPadding: 2.5 }),
    tableWidth: 180,
    margin: { left: 14, right: 14, top: 16, bottom: 17 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });

  const groups = buildDeploymentCompanyGroups(deployments, reportData?.workforceByCompany);
  let nextY = 18;
  if (groups.length) {
    doc.addPage("a4", "portrait");
    addReportContinuationHeader(doc, REPORT_TITLE);
  }

  for (const group of groups) {
    nextY = ensureReportSpace(doc, {
      y: nextY,
      requiredHeight: group.separations.length ? 38 : 24,
      title: REPORT_TITLE,
      nextPageY: 18,
    });
    addReportSectionTitle(doc, group.company, nextY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Total Deployment Records: ${group.totalRecords}   |   Currently Deployed: ${group.currentlyDeployed}   |   Floating / Standby: ${group.floatingStandby}   |   Ended Deployments: ${group.endedDeployments}`,
      14,
      nextY + 5,
      { maxWidth: 182 }
    );
    nextY += 11;

    if (!group.separations.length) {
      doc.setFontSize(8);
      doc.text("No employment separation records in this report scope.", 14, nextY + 2);
      nextY += 10;
      continue;
    }

    addReportSectionTitle(doc, "Employment Separation Records", nextY);
    autoTable(doc, {
      startY: nextY + 4,
      head: [["Employee Name", "Position", "Deployment Start", "Deployment End", "Deployment End Reason"]],
      body: group.separations.map((deployment) => [
        clean(deployment?.employee || deployment?.employeeName || deployment?.employee_name, "Unknown Employee"),
        clean(deployment?.position),
        formatDate(deployment?.contractStart || deployment?.startDate || deployment?.start_date),
        formatDate(deployment?.contractEnd || deployment?.endDate || deployment?.end_date),
        getDeploymentEndReasonDisplay(
          deployment?.endReason || deployment?.end_reason || deployment?.separationReason || deployment?.separation_reason,
          getDeploymentReportDisplayStatus(deployment)
        ),
      ]),
      ...getReportTableStyles({ fontSize: 7.3, cellPadding: 1.8 }),
      columnStyles: {
        0: { cellWidth: 43 },
        1: { cellWidth: 34 },
        2: { cellWidth: 29 },
        3: { cellWidth: 29 },
        4: { cellWidth: 47 },
      },
      margin: { left: 14, right: 14, top: 18, bottom: 17 },
      rowPageBreak: "avoid",
      didDrawPage: (data) => {
        if (data.pageNumber > 1) addReportContinuationHeader(doc, `${REPORT_TITLE} — ${group.company}`);
      },
    });
    nextY = doc.lastAutoTable.finalY + 10;
  }

  if (!groups.length) {
    doc.addPage("a4", "portrait");
    addReportContinuationHeader(doc, REPORT_TITLE);
    addReportSectionTitle(doc, "Company Deployment Summary", 18);
    doc.setFontSize(9);
    doc.text("No deployment records matched the selected filters.", 14, 25);
  }

  addReportFooters(doc, {
    reportTitle: REPORT_TITLE,
    advisory: "Confidential workforce deployment record — authorized use only.",
  });
  if (save) doc.save(`Deployment_Separation_${period.replace(/[^a-zA-Z0-9_-]+/g, "_")}.pdf`);
  return doc;
}