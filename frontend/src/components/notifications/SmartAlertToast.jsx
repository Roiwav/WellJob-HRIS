import {
  FiAlertTriangle,
  FiClock,
  FiEye,
  FiInfo,
  FiUser,
  FiX,
  FiZap,
} from "react-icons/fi";

import { getAlertPriorityClasses } from "../../utils/notifications/smartNotifications";

function getAlertIcon(priority) {
  if (priority === "High") {
    return <FiAlertTriangle aria-hidden="true" />;
  }

  if (priority === "Medium") {
    return <FiClock aria-hidden="true" />;
  }

  return <FiInfo aria-hidden="true" />;
}

function getPriorityLabel(priority) {
  if (priority === "High") {
    return "Critical Alert";
  }

  if (priority === "Medium") {
    return "Major Alert";
  }

  if (priority === "Low") {
    return "Minor Alert";
  }

  return "Smart Alert";
}


export default function SmartAlertToast({
  alert,
  onView,
  onDismiss,
}) {
  if (!alert) {
    return null;
  }

  const styles =
    getAlertPriorityClasses(
      alert.priority
    );

  const reporter =
    alert.reportedByName ||
    alert.reporterName ||
    alert.reportedBy ||
    "Unknown Reporter";

  const recommendedAction =
    alert.recommendedAction ||
    "Review the affected record and validate the recommended action.";

  return (
    <div
      className="pointer-events-none fixed right-4 top-20 z-[70] w-[calc(100vw-2rem)] max-w-md sm:right-5 sm:top-24"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        role="alert"
        className={`pointer-events-auto max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border shadow-2xl backdrop-blur ${styles.card}`}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${styles.icon}`}
          >
            {getAlertIcon(
              alert.priority
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide opacity-80">
                  {getPriorityLabel(
                    alert.priority
                  )}
                </p>

                <h3 className="mt-1 break-words text-sm font-black">
                  {alert.title ||
                    "Smart Alert"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  onDismiss?.(alert)
                }
                className="shrink-0 rounded-xl p-1.5 opacity-70 transition hover:bg-white/50 hover:opacity-100 focus:outline-none focus:ring-4 focus:ring-current/15 dark:hover:bg-slate-900/40"
                aria-label="Dismiss smart alert"
              >
                <FiX
                  aria-hidden="true"
                />
              </button>
            </div>

            <p className="mt-2 break-words text-sm leading-6 opacity-90">
              {alert.message ||
                "A monitored record requires attention."}
            </p>

            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/60 p-3 text-xs font-black leading-5 dark:bg-slate-950/30">
              <FiUser
                className="shrink-0"
                aria-hidden="true"
              />

              <span className="opacity-70">
                Reported by:
              </span>

              <span className="truncate">
                {reporter}
              </span>
            </div>

            <div className="mt-3 rounded-2xl bg-white/60 p-3 text-xs font-semibold leading-5 dark:bg-slate-950/30">
              <p className="mb-1 flex items-center gap-2 font-black">
                <FiZap
                  aria-hidden="true"
                />
                Recommended Action
              </p>

              <p className="opacity-90">
                {recommendedAction}
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  onDismiss?.(alert)
                }
                className="rounded-xl border border-current/20 px-4 py-2 text-xs font-black transition hover:bg-white/40 focus:outline-none focus:ring-4 focus:ring-current/15 dark:hover:bg-slate-900/40"
              >
                Dismiss
              </button>

              <button
                type="button"
                onClick={() =>
                  onView?.(alert)
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-slate-900/20 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <FiEye
                  aria-hidden="true"
                />
                View Alert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}