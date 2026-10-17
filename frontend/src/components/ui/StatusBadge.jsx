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

  deployed: {
    label: "Deployed",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  },

  "for deployment": {
    label: "For Deployment",
    icon: FiClock,
    className:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300",
  },

  editable: {
    label: "Editable",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  },

  "view only": {
    label: "View Only",
    icon: FiInfo,
    className:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300",
  },

  inactive: {
    label: "Inactive",
    icon: FiMinusCircle,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },

  archived: {
    label: "Archived",
    icon: FiMinusCircle,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
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

  "on leave": {
    label: "On Leave",
    icon: FiPauseCircle,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  },

  pending: {
    label: "Pending",
    icon: FiClock,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  },

  approved: {
    label: "Approved",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  },

  completed: {
    label: "Completed",
    icon: FiCheckCircle,
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
  },

  resigned: {
    label: "Resigned",
    icon: FiMinusCircle,
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300",
  },

  terminated: {
    label: "Terminated",
    icon: FiXCircle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  },

  awol: {
    label: "AWOL",
    icon: FiAlertTriangle,
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300",
  },

  separated: {
    label: "Separated",
    icon: FiMinusCircle,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },

  ended: {
    label: "Ended",
    icon: FiMinusCircle,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },

  "other separation": {
    label: "Other Separation",
    icon: FiMinusCircle,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },

  rejected: {
    label: "Rejected",
    icon: FiXCircle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  },

  /*
   * Legacy compatibility only.
   *
   * Some existing backend/database workflows can still return
   * "Cancelled". We intentionally do not expose that wording
   * through this shared badge anymore. Domain-specific screens
   * should map to Resigned, Terminated, AWOL, Separated, or
   * another accurate outcome before rendering whenever possible.
   *
   * If an unmigrated legacy value reaches StatusBadge directly,
   * the neutral fallback shown to the user is "Ended".
   */
  cancelled: {
    label: "Ended",
    icon: FiMinusCircle,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
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
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

function normalizeStatusKey(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!value) {
    return "default";
  }

  if (
    value === "floating / standby" ||
    value === "floating" ||
    value === "standby"
  ) {
    return "floating";
  }

  if (
    value === "for deployment" ||
    value === "for_deployment" ||
    value === "scheduled deployment" ||
    value === "scheduled for deployment"
  ) {
    return "for deployment";
  }

  if (
    value === "on leave" ||
    value === "leave"
  ) {
    return "on leave";
  }

  if (
    value === "archive" ||
    value === "archived"
  ) {
    return "archived";
  }

  if (
    value === "resignation" ||
    value === "resigned"
  ) {
    return "resigned";
  }

  if (
    value === "termination" ||
    value === "terminated"
  ) {
    return "terminated";
  }

  if (
    value === "other separation"
  ) {
    return "other separation";
  }

  if (
    value === "canceled" ||
    value === "cancelled"
  ) {
    return "cancelled";
  }

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
    STATUS_CONFIG[normalizedKey] ||
    STATUS_CONFIG.default;

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