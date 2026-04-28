import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiRefreshCw,
} from "react-icons/fi";

function getRiskExplanation(level) {
  switch (level) {
    case "High Risk":
      return "Why High Risk? Employee has critical incidents or high KPI severity and requires priority HR review.";
    case "Repeat":
      return "Why Repeat? Employee has repeated violations or medium KPI severity indicating recurring behavior.";
    case "Monitor":
      return "Why Monitor? Employee has minor violation records and should be observed.";
    case "Clean":
      return "Why Clean? Employee has no recorded violations or risk indicators.";
    default:
      return "Risk level is based on incident frequency, severity, and KPI evaluation.";
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${current.className}`}
      title={`Risk Level: ${current.label}\n${getRiskExplanation(level)}`}
    >
      <Icon size={12} />
      {current.label}
    </span>
  );
}