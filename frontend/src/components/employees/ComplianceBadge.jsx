import {
  FiAlertTriangle,
  FiCheckCircle,
  FiMinusCircle,
  FiXCircle,
} from "react-icons/fi";

const COMPLIANCE_CONFIG = {
  Complete: {
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  },

  Incomplete: {
    icon: FiAlertTriangle,
    className:
      "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/15 dark:text-yellow-300",
  },

  "Expiring Soon": {
    icon: FiAlertTriangle,
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300",
  },

  Expired: {
    icon: FiXCircle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  },

  "No Data": {
    icon: FiMinusCircle,
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

function normalizeComplianceStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();

  if (!value) {
    return "No Data";
  }

  if (value === "valid" || value === "complete") {
    return "Complete";
  }

  if (value === "incomplete") {
    return "Incomplete";
  }

  if (value === "expiring soon") {
    return "Expiring Soon";
  }

  if (value === "expired") {
    return "Expired";
  }

  if (
    value === "no compliance" ||
    value === "no data" ||
    value === "missing"
  ) {
    return "No Data";
  }

  return "No Data";
}

export default function ComplianceBadge({
  status,
  size = "md",
  icon = true,
  className = "",
}) {
  const normalizedStatus = normalizeComplianceStatus(status);
  const config =
    COMPLIANCE_CONFIG[normalizedStatus] ||
    COMPLIANCE_CONFIG["No Data"];

  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2.5 py-1 text-[11px]",
    md: "px-3 py-1.5 text-xs",
    lg: "px-3.5 py-2 text-sm",
  };

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

      <span>{normalizedStatus}</span>
    </span>
  );
}