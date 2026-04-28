import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiTrendingUp,
} from "react-icons/fi";

function getKPIExplanation(level) {
  switch (level) {
    case "High":
      return "High KPI severity means the employee has accumulated serious incident severity points.";
    case "Medium":
      return "Medium KPI severity means the employee has notable violations that need HR attention.";
    case "Low":
      return "Low KPI severity means the employee has minor recorded violations for monitoring.";
    case "Clean":
      return "Clean means the employee has no recorded incident severity score.";
    default:
      return "KPI level is based on the total weighted severity score of the employee's incidents.";
  }
}

const KPI_STYLES = {
  High: {
    label: "High",
    icon: FiAlertTriangle,
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300",
  },
  Medium: {
    label: "Medium",
    icon: FiTrendingUp,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300",
  },
  Low: {
    label: "Low",
    icon: FiEye,
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300",
  },
  Clean: {
    label: "Clean",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
};

export default function KPIBadge({ level }) {
  const current = KPI_STYLES[level] || KPI_STYLES.Clean;
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${current.className}`}
      title={`Why ${current.label} KPI?\n${getKPIExplanation(level)}`}
    >
      <Icon size={12} />
      {current.label}
    </span>
  );
}