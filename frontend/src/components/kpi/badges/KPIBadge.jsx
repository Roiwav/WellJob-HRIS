import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiTrendingUp,
} from "react-icons/fi";

function normalizeLevel(level) {
  switch (level) {
    case "Clean":
      return "Good Standing";
    case "Low":
      return "Minor Concern";
    case "Medium":
      return "Needs Improvement";
    case "High":
      return "Critical Concern";
    default:
      return level || "Good Standing";
  }
}

function getKPIExplanation(level) {
  const normalized = normalizeLevel(level);

  switch (normalized) {
    case "Critical Concern":
      return "Critical Concern means the employee has serious incident severity points or critical cases that require priority HR review.";
    case "Needs Improvement":
      return "Needs Improvement means the employee has repeated or notable KPI standing concerns that require structured HR monitoring.";
    case "Minor Concern":
      return "Minor Concern means the employee has a recorded minor concern that should be monitored or coached early.";
    case "Good Standing":
      return "Good Standing means the employee has no recorded incident severity score and no active KPI standing concern.";
    default:
      return "KPI standing is based on the total weighted severity score and incident frequency.";
  }
}

const KPI_STYLES = {
  "Critical Concern": {
    label: "Critical Concern",
    icon: FiAlertTriangle,
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300",
  },
  "Needs Improvement": {
    label: "Needs Improvement",
    icon: FiTrendingUp,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300",
  },
  "Minor Concern": {
    label: "Minor Concern",
    icon: FiEye,
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300",
  },
  "Good Standing": {
    label: "Good Standing",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
};

export default function KPIBadge({ level }) {
  const normalized = normalizeLevel(level);
  const current = KPI_STYLES[normalized] || KPI_STYLES["Good Standing"];
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${current.className}`}
      title={`Why ${current.label}?\n${getKPIExplanation(normalized)}`}
    >
      <Icon size={12} />
      {current.label}
    </span>
  );
}