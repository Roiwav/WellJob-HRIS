const welljobLogoUrl = new URL(
  "../../assets/Logo.png",
  import.meta.url
).href;

export const WELLJOB_COMPANY_NAME =
  "Welljob Solutions and General Services Inc.";

export const PDF_COLORS = Object.freeze({
  ink: [30, 41, 59],
  muted: [71, 85, 105],
  border: [203, 213, 225],
  stripe: [248, 250, 252],
  white: [255, 255, 255],
});

function clean(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function formatReportRole(value) {
  const normalized = clean(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (!normalized) return "Authorized User";

  return normalized
    .split(" ")
    .map((part) =>
      ["hr", "it"].includes(part)
        ? part.toUpperCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`
    )
    .join(" ");
}

export function getReportUserName(user) {
  const firstName = clean(user?.first_name || user?.firstName);
  const lastName = clean(user?.last_name || user?.lastName);
  const composedName = [firstName, lastName].filter(Boolean).join(" ");

  return clean(
    user?.full_name ||
      user?.fullName ||
      user?.fullname ||
      user?.display_name ||
      user?.displayName ||
      composedName ||
      user?.name,
    "Authorized User"
  );
}

export function getReportUserRole(user) {
  return formatReportRole(user?.role);
}

export function formatReportDateTime(
  value = new Date(),
  { timeZone = "Asia/Manila" } = {}
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read Welljob logo."));
    reader.readAsDataURL(blob);
  });
}

let logoDataUrlPromise;

export async function loadWelljobLogoDataUrl() {
  if (logoDataUrlPromise) return logoDataUrlPromise;

  logoDataUrlPromise = (async () => {
    try {
      const response = await fetch(welljobLogoUrl);
      if (!response.ok) return "";
      return await blobToDataUrl(await response.blob());
    } catch {
      return "";
    }
  })();

  return logoDataUrlPromise;
}

export function addReportSectionTitle(doc, title, y, { x = 14 } = {}) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(clean(title, "Report Section"), x, y);
  doc.setFont("helvetica", "normal");
}

export function getReportPageBottom(doc, { bottomMargin = 17 } = {}) {
  return doc.internal.pageSize.getHeight() - bottomMargin;
}

export function ensureReportSpace(
  doc,
  {
    y,
    requiredHeight,
    title,
    nextPageY = 18,
    bottomMargin = 17,
  }
) {
  const currentY = Number(y) || nextPageY;
  const height = Math.max(0, Number(requiredHeight) || 0);

  if (currentY + height <= getReportPageBottom(doc, { bottomMargin })) {
    return currentY;
  }

  doc.addPage();
  addReportContinuationHeader(doc, title);
  return nextPageY;
}

export function estimateReportTableHeight(
  doc,
  rows,
  {
    columnWidths = [182],
    fontSize = 8,
    cellPadding = 2,
    headerHeight = 8,
    lineHeight = 3.4,
  } = {}
) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const previousFontSize = doc.getFontSize();
  doc.setFontSize(fontSize);

  const bodyHeight = safeRows.reduce((total, row) => {
    const cells = Array.isArray(row) ? row : [row];
    const lineCount = Math.max(
      1,
      ...cells.map((cell, index) => {
        const width = Math.max(8, Number(columnWidths[index]) || columnWidths.at(-1) || 40);
        return doc.splitTextToSize(String(cell ?? ""), width - cellPadding * 2).length;
      })
    );
    return total + Math.max(6, lineCount * lineHeight + cellPadding * 2);
  }, 0);

  doc.setFontSize(previousFontSize);
  return headerHeight + bodyHeight;
}

export function formatReportPercentage(count, total) {
  const safeCount = Math.max(0, Number(count) || 0);
  const safeTotal = Math.max(0, Number(total) || 0);
  if (!safeTotal || !safeCount) return "0%";

  const percentage = (safeCount / safeTotal) * 100;
  if (percentage < 1) return `${percentage.toFixed(1)}%`;
  if (percentage < 10 && !Number.isInteger(percentage)) {
    return `${percentage.toFixed(1)}%`;
  }
  return `${Math.round(percentage)}%`;
}

export function getReportTableStyles({ fontSize = 8, cellPadding = 2 } = {}) {
  return {
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize,
      cellPadding,
      overflow: "linebreak",
      valign: "middle",
      lineColor: PDF_COLORS.border,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: PDF_COLORS.ink,
      textColor: PDF_COLORS.white,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: PDF_COLORS.stripe,
    },
  };
}

export function addReportHeader({
  doc,
  title,
  logoDataUrl = "",
  metadata = [],
  orientation = "portrait",
}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = orientation === "landscape" ? 12 : 14;
  const logoSize = 17;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", left, 8, logoSize, logoSize);
    } catch {
      // Text branding remains available if image decoding fails.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(12.5);
  doc.text(WELLJOB_COMPANY_NAME, left + 22, 13.5);
  doc.setFontSize(14);
  doc.text(clean(title, "REPORT").toUpperCase(), pageWidth / 2, 30, {
    align: "center",
  });

  const normalizedMetadata = metadata
    .map((entry) => {
      if (Array.isArray(entry)) {
        return { label: entry[0], value: entry[1] };
      }
      return entry || {};
    })
    .filter((entry) => clean(entry.label) && clean(entry.value));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...PDF_COLORS.muted);

  const columnWidth = (pageWidth - left * 2 - 8) / 2;
  const metadataRows = [];
  for (let index = 0; index < normalizedMetadata.length; index += 2) {
    metadataRows.push(normalizedMetadata.slice(index, index + 2));
  }

  let metadataY = 40;
  (metadataRows.length ? metadataRows : [[]]).forEach((rowEntries) => {
    const wrappedEntries = rowEntries.map((entry) =>
      doc.splitTextToSize(`${entry.label}: ${entry.value}`, columnWidth)
    );
    const lineCount = Math.max(1, ...wrappedEntries.map((lines) => lines.length));

    wrappedEntries.forEach((lines, column) => {
      const x = left + column * (columnWidth + 8);
      doc.text(lines, x, metadataY);
    });

    metadataY += Math.max(5, lineCount * 3.6 + 1.4);
  });

  const contentStartY = metadataY + 3;

  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.25);
  doc.line(left, contentStartY - 3, pageWidth - left, contentStartY - 3);

  return contentStartY;
}

export function addReportContinuationHeader(doc, title) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(WELLJOB_COMPANY_NAME, 14, 9);
  doc.text(clean(title, "Report"), pageWidth - 14, 9, { align: "right" });
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(14, 11.5, pageWidth - 14, 11.5);
}

export function addReportFooters(
  doc,
  { reportTitle, advisory = "Confidential HR record — authorized use only." } = {}
) {
  const pageCount = doc.internal.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(clean(advisory), 14, pageHeight - 6.5, {
      maxWidth: pageWidth - 70,
    });
    doc.text(
      `${clean(reportTitle, "Report")} | Page ${pageNumber} of ${pageCount}`,
      pageWidth - 14,
      pageHeight - 6.5,
      { align: "right" }
    );
  }
}