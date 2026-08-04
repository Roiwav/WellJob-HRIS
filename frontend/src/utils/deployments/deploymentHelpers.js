const MONTH_OPTIONS = [
  { value: "", label: "All Months" },
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const STATUS_BADGE_CLASSES = {
  Active:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
  Completed:
    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",
  Pending:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",
  Cancelled:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
  Separated:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300",
};

const DEFAULT_STATUS_BADGE_CLASS =
  "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-300";

function parseDate(dateValue) {
  if (!dateValue || dateValue === "-") {
    return null;
  }

  const date = new Date(dateValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRemarks(value) {
  return String(value || "").trim();
}

export function getMonthOptions() {
  return MONTH_OPTIONS;
}

export function getYearOptions(deployments = []) {
  const years = new Set();

  deployments.forEach((deployment) => {
    const rawDate =
      deployment?.start ||
      deployment?.contractStart ||
      deployment?.contract_start ||
      deployment?.createdAt ||
      deployment?.created_at;

    const date = parseDate(rawDate);

    if (date) {
      years.add(String(date.getFullYear()));
    }
  });

  return [
    { value: "", label: "All Years" },
    ...Array.from(years)
      .sort((first, second) => Number(second) - Number(first))
      .map((year) => ({
        value: year,
        label: year,
      })),
  ];
}

export function normalizeDeploymentStatus(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  if (normalizedStatus === "active") {
    return "Active";
  }

  if (normalizedStatus === "completed") {
    return "Completed";
  }

  if (
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  ) {
    return "Cancelled";
  }

  if (normalizedStatus === "pending") {
    return "Pending";
  }

  if (normalizedStatus === "separated") {
    return "Separated";
  }

  return String(status || "").trim() || "Pending";
}

export function formatDisplayDate(dateValue) {
  const date = parseDate(dateValue);

  if (!date) {
    return dateValue && dateValue !== "-" ? String(dateValue) : "-";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatLongDisplayDate(dateValue) {
  const date = parseDate(dateValue);

  if (!date) {
    return dateValue && dateValue !== "-"
      ? String(dateValue)
      : "Not Set";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateForInput(dateValue) {
  if (!dateValue || dateValue === "-") {
    return "";
  }

  const rawValue = String(dateValue).trim();
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }

  const date = parseDate(rawValue);

  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getStatusBadgeClass(status) {
  const normalizedStatus = normalizeDeploymentStatus(status);

  return (
    STATUS_BADGE_CLASSES[normalizedStatus] ||
    DEFAULT_STATUS_BADGE_CLASS
  );
}

export function getDeploymentTimelineInfo(
  deploymentStart,
  separationDate
) {
  if (!deploymentStart || deploymentStart === "-") {
    return "Deployment start date is not available.";
  }

  if (!separationDate || separationDate === "-") {
    return "Deployment is continuous and remains active until an authorized separation is recorded.";
  }

  return `Separated on ${formatLongDisplayDate(separationDate)}.`;
}

export function normalizeSeparationReason(value, remarks = "") {
  const reason = String(value || "").trim();
  const cleanRemarks = normalizeRemarks(remarks);

  if (reason === "Resigned" || reason === "Resignation") {
    return "Resignation";
  }

  if (reason === "Terminated" || reason === "Termination") {
    return cleanRemarks.startsWith("[Other Separation]")
      ? "Other Separation"
      : "Termination";
  }

  return reason || "-";
}

export function buildLegacySeparationPayload({
  separationDate,
  separationReason,
  separationRemarks,
}) {
  const cleanRemarks = normalizeRemarks(separationRemarks);
  const isResignation = separationReason === "Resignation";
  const isOtherSeparation =
    separationReason === "Other Separation";

  return {
    contractEnd: separationDate,
    endReason: isResignation ? "Resigned" : "Terminated",
    endRemarks: isOtherSeparation
      ? `[Other Separation] ${cleanRemarks}`.trim()
      : cleanRemarks,
  };
}