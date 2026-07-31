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
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  },
  "Expiring Soon": {
    icon: FiAlertTriangle,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
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

const STATUS_ALIASES = {
  valid: "Complete",
  complete: "Complete",
  compliant: "Complete",

  incomplete: "Incomplete",
  "partially complete": "Incomplete",
  partial: "Incomplete",

  "expiring soon": "Expiring Soon",
  "near expiry": "Expiring Soon",
  "near expiration": "Expiring Soon",

  expired: "Expired",
  invalid: "Expired",

  "no compliance": "No Data",
  "no data": "No Data",
  missing: "No Data",
  "not available": "No Data",
  "n a": "No Data",
  "n/a": "No Data",
};

const SIZE_CLASSES = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1.5 text-xs",
  lg: "px-3.5 py-2 text-sm",
};

function normalizeComplianceStatus(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  return STATUS_ALIASES[normalizedStatus] || "No Data";
}

export default function ComplianceBadge({
  status,
  size = "md",
  icon = true,
  className = "",
}) {
  const normalizedStatus = normalizeComplianceStatus(status);
  const config = COMPLIANCE_CONFIG[normalizedStatus];
  const Icon = config.icon;

  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-1.5 rounded-full border font-bold",
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        config.className,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && (
        <Icon
          aria-hidden="true"
          className="shrink-0"
        />
      )}

      <span>{normalizedStatus}</span>
    </span>
  );
}