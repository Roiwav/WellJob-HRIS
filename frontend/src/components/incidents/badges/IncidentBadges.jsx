import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
} from "react-icons/fi";

const SEVERITY_CONFIG = {
  Minor: {
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    Icon: FiInfo,
  },
  Major: {
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    Icon: FiAlertTriangle,
  },
  Critical: {
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    Icon: FiAlertCircle,
  },
};

const STATUS_CONFIG = {
  Open: {
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
    dotClassName: "bg-sky-500",
  },
  Investigating: {
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    dotClassName: "bg-amber-500",
  },
  "For Review": {
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300",
    dotClassName: "bg-violet-500",
  },
  Closed: {
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
  },
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeSeverity(value) {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "major") {
    return "Major";
  }

  if (normalized === "critical") {
    return "Critical";
  }

  return "Minor";
}

function normalizeStatus(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "investigating") {
    return "Investigating";
  }

  if (normalized === "for review") {
    return "For Review";
  }

  if (normalized === "closed") {
    return "Closed";
  }

  return "Open";
}

function normalizeAlertLevel(value) {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "critical") {
    return "critical";
  }

  if (normalized === "warning") {
    return "warning";
  }

  return "info";
}

function getSafeAlerts(alerts) {
  return Array.isArray(alerts)
    ? alerts.filter(Boolean)
    : [];
}

export function SeverityBadge({ level }) {
  const normalizedLevel = normalizeSeverity(level);
  const config = SEVERITY_CONFIG[normalizedLevel];
  const Icon = config.Icon;

  return (
    <span
      title={`Severity: ${normalizedLevel}`}
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
    >
      <Icon
        size={12}
        aria-hidden="true"
      />

      <span>{normalizedLevel}</span>
    </span>
  );
}

export function StatusBadge({ status }) {
  const normalizedStatus = normalizeStatus(status);
  const config = STATUS_CONFIG[normalizedStatus];

  return (
    <span
      title={`Status: ${normalizedStatus}`}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dotClassName}`}
      />

      <span className="truncate">
        {normalizedStatus}
      </span>
    </span>
  );
}

export function CaseAgeBadge({ incident }) {
  const rawDays = Number(
    incident?.caseAgeDays ??
      incident?.case_age_days ??
      0
  );

  const days =
    Number.isFinite(rawDays) && rawDays >= 0
      ? Math.floor(rawDays)
      : 0;

  const isOverdue = Boolean(
    incident?.isOverdue ??
      incident?.is_overdue
  );

  const className = isOverdue
    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200";

  return (
    <span
      title={`${days} day${days === 1 ? "" : "s"}${isOverdue ? " • Overdue" : ""}`}
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${className}`}
    >
      {days}d
    </span>
  );
}

export function SmartAlertBadge({ alerts = [] }) {
  const safeAlerts = getSafeAlerts(alerts);

  if (safeAlerts.length === 0) {
    return (
      <span
        title="No smart alerts"
        aria-label="No smart alerts"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <FiCheckCircle
          size={14}
          aria-hidden="true"
        />
      </span>
    );
  }

  const alertLevels = safeAlerts.map((alert) =>
    normalizeAlertLevel(alert?.level)
  );

  const hasCritical =
    alertLevels.includes("critical");

  const hasWarning =
    alertLevels.includes("warning");

  const badgeClass = hasCritical
    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : hasWarning
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";

  const title = safeAlerts
    .map((alert) => {
      const alertTitle =
        normalizeText(alert?.title) ||
        "Smart Alert";

      const alertMessage =
        normalizeText(alert?.message) ||
        "No additional details.";

      return `${alertTitle}: ${alertMessage}`;
    })
    .join("\n");

  return (
    <span
      title={title}
      aria-label={`${safeAlerts.length} smart alert${
        safeAlerts.length === 1 ? "" : "s"
      }`}
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-extrabold ${badgeClass}`}
    >
      <FiAlertCircle
        size={14}
        aria-hidden="true"
      />

      {safeAlerts.length}
    </span>
  );
}

export function SmartAlertCard({ alert }) {
  if (!alert) {
    return null;
  }

  const level = normalizeAlertLevel(alert.level);

  const style =
    level === "critical"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      : level === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
        : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";

  const title =
    normalizeText(alert.title) ||
    "Smart Alert";

  const message =
    normalizeText(alert.message) ||
    "No additional details were provided.";

  return (
    <div
      role={level === "critical" ? "alert" : "status"}
      className={`rounded-xl border p-3 text-sm ${style}`}
    >
      <p className="font-bold">
        {title}
      </p>

      <p className="mt-1 break-words leading-6">
        {message}
      </p>
    </div>
  );
}