import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiTrendingUp,
} from "react-icons/fi";

function normalizeLevel(level) {
  const normalized = String(level || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    normalized === "critical concern" ||
    normalized === "critical" ||
    normalized === "high"
  ) {
    return "Critical Concern";
  }

  if (
    normalized === "needs improvement" ||
    normalized === "medium" ||
    normalized === "improvement"
  ) {
    return "Needs Improvement";
  }

  if (
    normalized === "minor concern" ||
    normalized === "minor" ||
    normalized === "low"
  ) {
    return "Minor Concern";
  }

  if (
    normalized === "good standing" ||
    normalized === "clean" ||
    normalized === "good"
  ) {
    return "Good Standing";
  }

  return "Good Standing";
}

function getKPIExplanation(level) {
  const normalized =
    normalizeLevel(level);

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
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-300",
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
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-300",
  },

  "Good Standing": {
    label: "Good Standing",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
};

export default function KPIBadge({
  level,
}) {
  const normalized =
    normalizeLevel(level);

  const current =
    KPI_STYLES[normalized] ||
    KPI_STYLES[
      "Good Standing"
    ];

  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${current.className}`}
      title={`Why ${
        current.label
      }?\n${getKPIExplanation(
        normalized
      )}`}
    >
      <Icon
        size={12}
        aria-hidden="true"
      />

      {current.label}
    </span>
  );
}