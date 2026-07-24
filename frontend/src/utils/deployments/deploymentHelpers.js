export const COMPANY_LOCATIONS = {
  "SM Supermalls": "Calamba City, Laguna",
  "Robinsons Retail Holdings": "Calamba City, Laguna",
  "Ayala Land Inc.": "Makati City",
  "Jollibee Foods Corporation": "Pasig City",
  "San Miguel Corporation": "Mandaluyong City",
  "PLDT Inc.": "Makati City",
  "Globe Telecom": "Taguig City",
  "BDO Unibank": "Makati City",
  Metrobank: "Makati City",
  "Puregold Price Club": "Quezon City",
  "Wilcon Depot": "Quezon City",
  "DMCI Holdings": "Makati City",
  "Megaworld Corporation": "Taguig City",
  "Unilab Inc.": "Mandaluyong City",
  "Nestlé Philippines": "Makati City",
  "Coca-Cola Philippines": "Taguig City",
  "Pepsi-Cola Products Philippines": "Muntinlupa City",
  "Toyota Philippines": "Santa Rosa, Laguna",
  "Honda Philippines": "Batangas",
  "Accenture Philippines": "Taguig City",
  "IBM Philippines": "Quezon City",
  "Teleperformance Philippines": "Pasig City",
  "Concentrix Philippines": "Quezon City",
  "Sitel Philippines": "Makati City",
};

export function safeParse() {
  return [];
}

export function getDeploymentsFromStorage() {
  return [];
}

export function getMonthOptions() {
  return [
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
}

export function getYearOptions(deployments = []) {
  const years = deployments
    .map((deployment) => {
      const rawDate =
        deployment?.start ||
        deployment?.contractStart ||
        deployment?.contract_start ||
        deployment?.createdAt ||
        deployment?.created_at;

      if (!rawDate || rawDate === "-") return null;

      const date = new Date(rawDate);

      if (Number.isNaN(date.getTime())) return null;

      return String(date.getFullYear());
    })
    .filter(Boolean);

  const uniqueYears = [...new Set(years)].sort((a, b) => Number(b) - Number(a));

  return [
    { value: "", label: "All Years" },
    ...uniqueYears.map((year) => ({ value: year, label: year })),
  ];
}

export function formatDisplayDate(dateValue) {
  if (!dateValue || dateValue === "-") return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatLongDisplayDate(dateValue) {
  if (!dateValue || dateValue === "-") return "Not Set";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getStatusBadgeClass(status) {
  const styles = {
    Active:
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    Completed:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
    Pending:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    Cancelled:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    Separated:
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30",
  };

  return styles[status] || "bg-gray-100 text-gray-700 border border-gray-200";
}

export function getDeploymentTimelineInfo(deploymentStart, separationDate) {
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
  const cleanRemarks = String(remarks || "").trim();

  if (reason === "Resigned" || reason === "Resignation") return "Resignation";
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
  const isOther = separationReason === "Other Separation";

  return {
    contractEnd: separationDate,
    endReason:
      separationReason === "Resignation" ? "Resigned" : "Terminated",
    endRemarks: isOther
      ? `[Other Separation] ${String(separationRemarks || "").trim()}`
      : String(separationRemarks || "").trim(),
  };
}