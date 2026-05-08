import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
} from "react-icons/fi";

export function SeverityBadge({ level }) {
  const normalized = level || "Minor";

  const config = {
    Minor: {
      class:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
      icon: <FiInfo size={12} />,
    },
    Major: {
      class:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
      icon: <FiAlertTriangle size={12} />,
    },
    Critical: {
      class:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
      icon: <FiAlertCircle size={12} />,
    },
  };

  const current =
    config[normalized] ||
    config[String(normalized).charAt(0).toUpperCase() + String(normalized).slice(1)] ||
    config.Minor;

  return (
    <span
      title={`Severity: ${normalized}`}
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${current.class}`}
    >
      {current.icon}
      {normalized}
    </span>
  );
}

export function StatusBadge({ status }) {
  const config = {
    Open: {
      class:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
      dot: "bg-red-500",
    },
    Investigating: {
      class:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
      dot: "bg-amber-500",
    },
    "For Review": {
      class:
        "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300",
      dot: "bg-indigo-500",
    },
    Closed: {
      class:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
  };

  const current = config[status] || config.Open;

  return (
    <span
      title={status || "Open"}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${current.class}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${current.dot}`} />

      <span className="truncate">{status || "Open"}</span>
    </span>
  );
}

export function CaseAgeBadge({ incident }) {
  const isOverdue = Boolean(incident?.isOverdue);
  const days = Number(incident?.caseAgeDays || 0);

  return (
    <span
      title={`${days} day(s)`}
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
        isOverdue
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200"
      }`}
    >
      {days}d
    </span>
  );
}

export function SmartAlertBadge({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <span
        title="No smart alerts"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <FiCheckCircle size={14} />
      </span>
    );
  }

  const hasCritical = alerts.some((alert) => alert.level === "critical");
  const hasWarning = alerts.some((alert) => alert.level === "warning");

  const badgeClass = hasCritical
    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : hasWarning
    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";

  return (
    <span
      title={alerts
        .map((alert) => `${alert.title}: ${alert.message}`)
        .join("\n")}
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-extrabold ${badgeClass}`}
    >
      <FiAlertCircle size={14} />
      {alerts.length}
    </span>
  );
}

export function SmartAlertCard({ alert }) {
  const style =
    alert.level === "critical"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      : alert.level === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
      : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";

  return (
    <div className={`rounded-xl border p-3 text-sm ${style}`}>
      <p className="font-bold">{alert.title}</p>
      <p className="mt-1 leading-6">{alert.message}</p>
    </div>
  );
}