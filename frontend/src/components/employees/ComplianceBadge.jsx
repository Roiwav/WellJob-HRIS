import { FiAlertTriangle } from "react-icons/fi";

export default function ComplianceBadge({ status }) {
  const styles = {
    Valid:
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    "Expiring Soon":
      "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
    Expired:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    Incomplete:
      "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
    "No Data":
      "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30",
    Missing:
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || styles["No Data"]
      }`}
    >
      {(status === "Expired" || status === "Expiring Soon") && (
        <FiAlertTriangle className="text-sm" />
      )}
      {status}
    </span>
  );
}