import {
  FiAlertCircle,
  FiAlertTriangle,
  FiClock,
  FiInfo,
} from "react-icons/fi";

const ALERT_CONFIG = {
  HIGH: {
    label: "Priority",
    icon: FiAlertTriangle,
    dot: "bg-rose-500",
    iconClass:
      "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  },
  MEDIUM: {
    label: "Review",
    icon: FiClock,
    dot: "bg-amber-500",
    iconClass:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  },
  LOW: {
    label: "Monitor",
    icon: FiInfo,
    dot: "bg-indigo-500",
    iconClass:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  },
  UNKNOWN: {
    label: "Alert",
    icon: FiAlertCircle,
    dot: "bg-slate-400",
    iconClass:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

function normalizeAlertLevel(level) {
  const normalized = String(level || "").trim().toUpperCase();

  return Object.prototype.hasOwnProperty.call(ALERT_CONFIG, normalized)
    ? normalized
    : "UNKNOWN";
}

export default function CriticalAlerts({ alerts = [] }) {
  const safeAlerts = Array.isArray(alerts) ? alerts.filter(Boolean) : [];

  return (
    <section aria-labelledby="critical-alerts-title">
      <div>
        <h2
          id="critical-alerts-title"
          className="text-sm font-black text-slate-900 dark:text-white"
        >
          Incident Attention
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          Compact view of open incident priorities.
        </p>
      </div>

      <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
        {safeAlerts.map((alert, index) => {
          const normalizedLevel = normalizeAlertLevel(alert.level);
          const config = ALERT_CONFIG[normalizedLevel];
          const Icon = config.icon;

          return (
            <div
              key={`${normalizedLevel}-${index}`}
              className="flex min-w-0 items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.iconClass}`}
                aria-hidden="true"
              >
                <Icon size={14} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`}
                    aria-hidden="true"
                  />
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    {config.label}
                  </span>
                </div>

                <p
                  className="mt-0.5 truncate text-xs font-semibold text-slate-700 dark:text-slate-200"
                  title={alert.text || "No alert details available."}
                >
                  {alert.text || "No alert details available."}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}