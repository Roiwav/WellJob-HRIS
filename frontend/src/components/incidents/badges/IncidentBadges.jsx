import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";

export function SeverityBadge({ level }) {
  const colors = {
    Minor: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    Major:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    Critical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        colors[level] ||
        "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200"
      }`}
    >
      {level || "Minor"}
    </span>
  );
}

export function StatusBadge({ status }) {
  const config = {
    Open: {
      class:
        "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300",
      icon: "●",
    },
    Investigating: {
      class:
        "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
      icon: "⏳",
    },
    "For Review": {
      class:
        "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
      icon: "👁",
    },
    Closed: {
      class:
        "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
      icon: "✔",
    },
  };

  const current = config[status] || config.Open;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${current.class}`}
    >
      <span className="text-[10px]">{current.icon}</span>
      {status || "Open"}
    </span>
  );
}

export function CaseAgeBadge({ incident }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${
        incident.isOverdue
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200"
      }`}
    >
      {incident.caseAgeDays || 0}d
    </span>
  );
}

export function SmartAlertBadge({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <FiCheckCircle size={12} />
        Clear
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
      title={alerts.map((alert) => `${alert.title}: ${alert.message}`).join("\n")}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass}`}
    >
      <FiAlertCircle size={12} />
      {alerts.length} alert{alerts.length > 1 ? "s" : ""}
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