import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiRefreshCw,
} from "react-icons/fi";

const RISK_STYLES = {
  "High Risk": {
    label: "High Risk",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-300",
  },

  Repeat: {
    label: "Repeat",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300",
  },

  Monitor: {
    label: "Monitor",
    className:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-300",
  },

  "Low Risk": {
    label: "Low Risk",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
};

function normalizeLevel(level) {
  const normalized = String(level || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    normalized === "high risk" ||
    normalized === "critical"
  ) {
    return "High Risk";
  }

  if (
    normalized === "repeat" ||
    normalized === "repeat offender"
  ) {
    return "Repeat";
  }

  if (
    normalized === "monitor" ||
    normalized === "monitoring"
  ) {
    return "Monitor";
  }

  if (
    normalized === "clean" ||
    normalized === "low risk" ||
    normalized === "low"
  ) {
    return "Low Risk";
  }

  return "Low Risk";
}

function getRiskExplanation(level) {
  switch (level) {
    case "High Risk":
      return "Why High Risk? Employee has critical incidents or high KPI severity and requires priority HR review.";

    case "Repeat":
      return "Why Repeat? Employee has repeated violations or medium KPI severity indicating recurring behavior.";

    case "Monitor":
      return "Why Monitor? Employee has minor violation records and should be observed.";

    case "Low Risk":
      return "Why Low Risk? Employee has no recorded violations or active KPI risk indicators.";

    default:
      return "Risk level is based on incident frequency, severity, and KPI evaluation.";
  }
}

function RiskLevelIcon({
  level,
  size = 12,
}) {
  switch (level) {
    case "High Risk":
      return (
        <FiAlertTriangle
          size={size}
          aria-hidden="true"
        />
      );

    case "Repeat":
      return (
        <FiRefreshCw
          size={size}
          aria-hidden="true"
        />
      );

    case "Monitor":
      return (
        <FiEye
          size={size}
          aria-hidden="true"
        />
      );

    case "Low Risk":
    default:
      return (
        <FiCheckCircle
          size={size}
          aria-hidden="true"
        />
      );
  }
}

export default function RiskBadge({
  level,
}) {
  const normalized =
    normalizeLevel(level);

  const current =
    RISK_STYLES[normalized] ||
    RISK_STYLES["Low Risk"];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${current.className}`}
      title={`Risk Level: ${
        current.label
      }\n${getRiskExplanation(
        normalized
      )}`}
    >
      <RiskLevelIcon
        level={normalized}
      />

      {current.label}
    </span>
  );
}