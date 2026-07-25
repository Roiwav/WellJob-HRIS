import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiInfo,
  FiMinusCircle,
  FiPauseCircle,
  FiXCircle,
} from "react-icons/fi";

const STATUS_CONFIG = {
  active: {
    label: "Active",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  },

  inactive: {
    label: "Inactive",
    icon: FiXCircle,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },

  deployed: {
    label: "Deployed",
    icon: FiCheckCircle,
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
  },

  floating: {
    label: "Floating / Standby",
    icon: FiPauseCircle,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  },

  standby: {
    label: "Floating / Standby",
    icon: FiPauseCircle,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  },

  pending: {
    label: "Pending",
    icon: FiClock,
    className:
      "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/15 dark:text-yellow-300",
  },

  approved: {
    label: "Approved",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  },

  rejected: {
    label: "Rejected",
    icon: FiXCircle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  },

  completed: {
    label: "Completed",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  },

  cancelled: {
    label: "Cancelled",
    icon: FiXCircle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  },

  warning: {
    label: "Warning",
    icon: FiAlertTriangle,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  },

  danger: {
    label: "Critical",
    icon: FiXCircle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  },

  info: {
    label: "Information",
    icon: FiInfo,
    className:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300",
  },

  default: {
    label: "Unknown",
    icon: FiMinusCircle,
    className:
      "border-gray-200 bg-gray-100 text-gray-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

function normalizeStatusKey(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();

  if (!value) return "default";

  if (value === "floating / standby") return "floating";
  if (value === "floating") return "floating";
  if (value === "standby") return "standby";

  return value;
}

export default function StatusBadge({
  status,
  label,
  tone,
  icon = true,
  size = "md",
  className = "",
}) {
  const normalizedKey = tone
    ? normalizeStatusKey(tone)
    : normalizeStatusKey(status);

  const config =
    STATUS_CONFIG[normalizedKey] || STATUS_CONFIG.default;

  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2.5 py-1 text-[11px]",
    md: "px-3 py-1.5 text-xs",
    lg: "px-3.5 py-2 text-sm",
  };

  const renderedLabel =
    label ||
    config.label ||
    String(status || "Unknown");

  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-1.5 rounded-full border font-bold",
        sizeClasses[size] || sizeClasses.md,
        config.className,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && Icon && (
        <Icon
          aria-hidden="true"
          className="shrink-0"
        />
      )}

      <span>{renderedLabel}</span>
    </span>
  );
}