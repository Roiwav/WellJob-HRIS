import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PDF_COLORS,
  addReportContinuationHeader,
  addReportFooters,
  addReportHeader,
  formatReportDateTime,
  getReportTableStyles,
  getReportUserName,
  getReportUserRole,
  loadWelljobLogoDataUrl,
} from "../pdf/reportPdf.js";

const REPORT_TITLE = "Deployment Activity History Report";
const MANILA_TIME_ZONE = "Asia/Manila";
const STACKED_PRIMARY_FONT_SIZE = 7.6;
const STACKED_SECONDARY_FONT_SIZE = 6.7;
const STACKED_LINE_HEIGHT_FACTOR = 1.16;

const clean = (value, fallback = "-") =>
  String(value ?? "").trim() || fallback;

function comparable(value) {
  return clean(value, "")
    .toLowerCase()
    .replace(/[→>-]+/g, " ")
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function allEventsMatch(events, expected, getter) {
  const normalizedExpected = comparable(expected);
  return Boolean(
    normalizedExpected &&
      events.length > 0 &&
      events.every((event) => comparable(getter(event)) === normalizedExpected)
  );
}

function getExplicitFilter(filters, keys) {
  for (const key of keys) {
    const value = clean(filters?.[key], "");
    if (value && !/^all(?:\s|$)/i.test(value)) return value;
  }
  return "";
}

export function formatDeploymentActivityDateTime(event = {}) {
  const occurredAt = clean(event?.occurredAt, "");
  const occurredDate = occurredAt ? new Date(occurredAt) : null;

  if (occurredDate && !Number.isNaN(occurredDate.getTime())) {
    return {
      primary: new Intl.DateTimeFormat("en-PH", {
        timeZone: MANILA_TIME_ZONE,
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(occurredDate),
      secondary: new Intl.DateTimeFormat("en-PH", {
        timeZone: MANILA_TIME_ZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(occurredDate),
    };
  }

  const fallback = clean(event?.eventDate || event?.businessDate, "");
  if (!fallback) return { primary: "Not recorded", secondary: "" };

  const dateOnly = new Date(`${fallback.slice(0, 10)}T00:00:00`);
  return {
    primary: Number.isNaN(dateOnly.getTime())
      ? fallback
      : new Intl.DateTimeFormat("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(dateOnly),
    secondary: "",
  };
}

export function getDeploymentActivityEmployeeCell(event = {}) {
  return {
    primary: clean(event?.employeeName, "Unknown Employee"),
    secondary: clean(event?.historicalPosition || event?.position, ""),
  };
}

export function buildDeploymentActivityRemarks(event = {}) {
  const activity = comparable(event?.movement || event?.displayActivity);
  const status = comparable(event?.toStatus || event?.newStatus);
  const fromStatus = comparable(event?.fromStatus || event?.previousStatus);
  const transition = comparable(
    fromStatus && status ? `${fromStatus} to ${status}` : ""
  );
  const genericReasons = new Set([
    activity,
    status,
    transition,
    "scheduled for deployment",
    "arrival confirmed",
    "deployment arrival confirmed",
    "deployment schedule withdrawn",
  ].filter(Boolean));
  const candidates = [
    event?.remarks,
    event?.rawReason,
    event?.displayReason,
    event?.reason,
  ];
  const seen = new Set();
  const meaningful = [];

  for (const candidate of candidates) {
    const value = clean(candidate, "");
    const normalized = comparable(value);
    if (!normalized || seen.has(normalized) || genericReasons.has(normalized)) continue;
    if (normalized === activity || normalized === status || normalized === transition) continue;
    seen.add(normalized);
    meaningful.push(value);
  }

  return meaningful.join("; ") || "-";
}

export function buildDeploymentActivityColumns(events = [], filters = {}) {
  const safeEvents = Array.isArray(events) ? events : [];
  const selectedCompany = getExplicitFilter(filters, ["company"]);
  const selectedActivity = getExplicitFilter(filters, [
    "activityType",
    "activity",
    "movement",
  ]);
  const selectedStatus = getExplicitFilter(filters, ["status"]);
  const fixedCompany = allEventsMatch(
    safeEvents,
    selectedCompany,
    (event) => event?.historicalCompany || event?.company
  )
    ? selectedCompany
    : "";
  const fixedActivity = allEventsMatch(
    safeEvents,
    selectedActivity,
    (event) => event?.movement || event?.displayActivity
  )
    ? selectedActivity
    : "";
  const fixedStatus = allEventsMatch(
    safeEvents,
    selectedStatus,
    (event) => event?.toStatus || event?.newStatus
  )
    ? selectedStatus
    : "";
  const columns = [
    { key: "date", label: "Date", width: 27, value: formatDeploymentActivityDateTime },
    { key: "employee", label: "Employee", width: 39, value: getDeploymentActivityEmployeeCell },
  ];

  if (!fixedCompany) {
    columns.push({
      key: "company",
      label: "Client Company",
      width: 31,
      value: (event) => clean(event?.historicalCompany || event?.company, "Unassigned"),
    });
  }
  if (!fixedActivity) {
    columns.push({
      key: "activity",
      label: "Activity",
      width: 29,
      value: (event) => clean(event?.movement || event?.displayActivity),
    });
  }
  if (!fixedStatus) {
    columns.push({
      key: "status",
      label: "Status",
      width: 25,
      value: (event) => clean(event?.toStatus || event?.newStatus),
    });
  }
  columns.push({
    key: "remarks",
    label: "Remarks",
    width: 39,
    value: buildDeploymentActivityRemarks,
  });

  return {
    columns,
    fixedCompany,
    fixedActivity,
    fixedStatus,
    selectedCompany,
    selectedActivity,
    selectedStatus,
  };
}

function createStackedCell(doc, value, width) {
  const primary = clean(value?.primary, "-");
  const secondary = clean(value?.secondary, "");
  const textWidth = Math.max(8, width - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(STACKED_PRIMARY_FONT_SIZE);
  const primaryLines = doc.splitTextToSize(primary, textWidth);
  doc.setFontSize(STACKED_SECONDARY_FONT_SIZE);
  const secondaryLines = secondary
    ? doc.splitTextToSize(secondary, textWidth)
    : [];
  const primaryHeight =
    primaryLines.length * STACKED_PRIMARY_FONT_SIZE * 0.3528 * STACKED_LINE_HEIGHT_FACTOR;
  const secondaryHeight =
    secondaryLines.length * STACKED_SECONDARY_FONT_SIZE * 0.3528 * STACKED_LINE_HEIGHT_FACTOR;

  return {
    content: "",
    stack: { primaryLines, secondaryLines },
    styles: {
      minCellHeight: Math.max(10, primaryHeight + secondaryHeight + (secondary ? 5 : 4)),
    },
  };
}

export function drawDeploymentActivityStackedCell(doc, cell, stack) {
  const padding = 2;
  const x = cell.x + padding;
  let y = cell.y + padding + STACKED_PRIMARY_FONT_SIZE * 0.3528;
  const primaryStep = STACKED_PRIMARY_FONT_SIZE * 0.3528 * STACKED_LINE_HEIGHT_FACTOR;
  const secondaryStep = STACKED_SECONDARY_FONT_SIZE * 0.3528 * STACKED_LINE_HEIGHT_FACTOR;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(STACKED_PRIMARY_FONT_SIZE);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(stack.primaryLines, x, y);
  y += stack.primaryLines.length * primaryStep;

  if (stack.secondaryLines.length) {
    y += 0.8;
    doc.setFontSize(STACKED_SECONDARY_FONT_SIZE);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(stack.secondaryLines, x, y);
    y += stack.secondaryLines.length * secondaryStep;
  }

  return y;
}

export function buildDeploymentActivityRows(doc, events, columns) {
  return events.map((event) =>
    columns.map((column) => {
      const value = column.value(event);
      return ["date", "employee"].includes(column.key)
        ? createStackedCell(doc, value, column.width)
        : value;
    })
  );
}

export async function exportDeploymentActivityReportPDF({ reportData, user, save = true }) {
  const events = Array.isArray(reportData?.events) ? reportData.events : [];
  const filters = reportData?.filters || {};
  const dynamic = buildDeploymentActivityColumns(events, filters);
  const orientation = "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const logoDataUrl = await loadWelljobLogoDataUrl();
  const totalRecordedActivities = Number(
    reportData?.pagination?.total ??
      reportData?.meta?.filteredEventRows ??
      reportData?.summary?.totalEvents ??
      events.length
  );
  const metadata = [
    ["Reporting Period", clean(filters?.periodLabel, "All available activity")],
    ["Client Company", dynamic.fixedCompany || dynamic.selectedCompany || "All Authorized Companies"],
    ...(dynamic.fixedActivity ? [["Activity", dynamic.fixedActivity]] : []),
    ...(dynamic.fixedStatus ? [["Status", dynamic.fixedStatus]] : []),
    ["Total Recorded Activities", totalRecordedActivities],
    ["Generated On", formatReportDateTime(reportData?.meta?.generatedAt || new Date())],
    ["Prepared By", getReportUserName(user)],
    ["Role", getReportUserRole(user)],
  ];
  const contentStartY = addReportHeader({
    doc,
    title: REPORT_TITLE,
    logoDataUrl,
    orientation,
    metadata,
  });
  const rows = events.length
    ? buildDeploymentActivityRows(doc, events, dynamic.columns)
    : [
        dynamic.columns.map((column, index) =>
          index === 1
            ? createStackedCell(
                doc,
                { primary: "No activity records matched the selected scope.", secondary: "" },
                column.width
              )
            : ["date", "employee"].includes(column.key)
              ? createStackedCell(doc, { primary: "-", secondary: "" }, column.width)
              : "-"
        ),
      ];

  autoTable(doc, {
    startY: contentStartY + 3,
    head: [dynamic.columns.map((column) => column.label)],
    body: rows,
    ...getReportTableStyles({ fontSize: 7.4, cellPadding: 2 }),
    tableWidth: "auto",
    columnStyles: dynamic.columns.reduce((styles, column, index) => {
      styles[index] = { cellWidth: column.width };
      return styles;
    }, {}),
    margin: { left: 10, right: 10, top: 18, bottom: 17 },
    rowPageBreak: "avoid",
    showHead: "everyPage",
    didParseCell: (data) => {
      if (data.section === "body" && data.cell.raw?.stack) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.cell.raw?.stack) {
        drawDeploymentActivityStackedCell(doc, data.cell, data.cell.raw.stack);
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) addReportContinuationHeader(doc, REPORT_TITLE);
    },
  });

  addReportFooters(doc, {
    reportTitle: REPORT_TITLE,
    advisory: "Confidential workforce activity record — authorized use only.",
  });
  if (save) {
    const period = clean(filters?.periodLabel, "All_Activity").replace(
      /[^a-zA-Z0-9_-]+/g,
      "_"
    );
    doc.save(`Deployment_Activity_History_${period}.pdf`);
  }
  return doc;
}