import {
  FiAlertCircle,
  FiAlertTriangle,
  FiClock,
  FiInfo,
} from "react-icons/fi";

const ALERT_CONFIG = {
  HIGH: {
    label: "Priority",
    classes:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  },

  MEDIUM: {
    label: "Review",
    classes:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  },

  LOW: {
    label: "Monitor",
    classes:
      "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
  },

  UNKNOWN: {
    label: "Alert",
    classes:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

function normalizeAlertLevel(level) {
  const normalized = String(
    level || ""
  )
    .trim()
    .toUpperCase();

  return Object.prototype.hasOwnProperty.call(
    ALERT_CONFIG,
    normalized
  )
    ? normalized
    : "UNKNOWN";
}

function AlertLevelIcon({ level }) {
  switch (level) {
    case "HIGH":
      return (
        <FiAlertTriangle
          aria-hidden="true"
        />
      );

    case "MEDIUM":
      return (
        <FiClock
          aria-hidden="true"
        />
      );

    case "LOW":
      return (
        <FiInfo
          aria-hidden="true"
        />
      );

    default:
      return (
        <FiAlertCircle
          aria-hidden="true"
        />
      );
  }
}

export default function CriticalAlerts({
  alerts = [],
}) {
  const safeAlerts = Array.isArray(alerts)
    ? alerts.filter(Boolean)
    : [];

  return (
    <section
      className="space-y-3"
      aria-labelledby="critical-alerts-title"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="critical-alerts-title"
            className="text-lg font-extrabold text-gray-900 dark:text-white"
          >
            Critical Alerts
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            Active operational alerts grouped by HR monitoring priority.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {safeAlerts.map(
          (alert, index) => {
            const normalizedLevel =
              normalizeAlertLevel(
                alert.level
              );

            const config =
              ALERT_CONFIG[
                normalizedLevel
              ];

            return (
              <article
                key={`${normalizedLevel}-${index}`}
                className={`rounded-2xl border px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${config.classes}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-base shadow-sm dark:bg-slate-950/30"
                    aria-hidden="true"
                  >
                    <AlertLevelIcon
                      level={
                        normalizedLevel
                      }
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wide">
                        {normalizedLevel}
                      </span>

                      <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide opacity-80 dark:bg-slate-950/30">
                        {config.label}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-sm font-bold leading-5">
                      {alert.text ||
                        "No alert details available."}
                    </p>
                  </div>
                </div>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}