import {
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiMinusCircle,
} from "react-icons/fi";

function normalizeComplianceStatus(status) {
  const value = String(status || "").trim();

  if (value === "Valid") return "Complete";
  if (value === "Complete") return "Complete";
  if (value === "Incomplete") return "Incomplete";
  if (value === "Expiring Soon") return "Expiring Soon";
  if (value === "Expired") return "Expired";
  if (value === "No Compliance") return "No Data";
  if (value === "No Data") return "No Data";

  return "No Data";
}

export default function ComplianceBadge({ status }) {
  const label = normalizeComplianceStatus(status);

  const styles = {
    Complete:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",

    Incomplete:
      "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",

    "Expiring Soon":
      "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",

    Expired:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",

    "No Data":
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30",
  };

  const icons = {
    Complete: <FiCheckCircle className="text-sm" />,
    Incomplete: <FiAlertTriangle className="text-sm" />,
    "Expiring Soon": <FiAlertTriangle className="text-sm" />,
    Expired: <FiXCircle className="text-sm" />,
    "No Data": <FiMinusCircle className="text-sm" />,
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        styles[label] || styles["No Data"]
      }`}
    >
      {icons[label]}
      {label}
    </span>
  );
}