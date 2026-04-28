import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiRefreshCw,
} from "react-icons/fi";

function getRiskExplanation(level) {
  switch (level) {
    case "High Risk":
      return "Employee has critical incidents or high KPI severity.";
    case "Repeat":
      return "Employee has repeated violations indicating pattern behavior.";
    case "Monitor":
      return "Employee has minor violations that require observation.";
    default:
      return "No violations recorded. Employee is in good standing.";
  }
}

const RISK_STYLES = {
  "High Risk": {
    label: "High Risk",
    icon: FiAlertTriangle,
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300",
  },
  Repeat: {
    label: "Repeat",
    icon: FiRefreshCw,
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/70 dark:bg-orange-950/30 dark:text-orange-300",
  },
  Monitor: {
    label: "Monitor",
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

export default function RiskBadge({ level }) {
  const current = RISK_STYLES[level] || RISK_STYLES.Clean;
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${current.className}`}
      title={`Risk Level: ${current.label}\n${getRiskExplanation(level)}`}
    >
      <Icon size={12} />
      {current.label}
    </span>
  );
}