import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

export default function RiskBadge({ level }) {

  if (level === "High Risk")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full">
        <FiAlertTriangle size={12} /> High Risk
      </span>
    );

  if (level === "Repeat")
    return (
      <span className="inline-flex text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
        Repeat
      </span>
    );

  if (level === "Monitor")
    return (
      <span className="inline-flex text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
        Monitor
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
      <FiCheckCircle size={12} /> Clean
    </span>
  );
}