import { FiAlertTriangle, FiBell, FiEye, FiX } from "react-icons/fi";
import { getAlertPriorityClasses } from "../../utils/notifications/smartNotifications";

export default function SmartAlertToast({ alert, onView, onDismiss }) {
  if (!alert) return null;

  const styles = getAlertPriorityClasses(alert.priority);

  return (
    <div className="fixed bottom-5 right-5 z-[1200] w-[calc(100vw-2rem)] max-w-md">
      <div
        className={`overflow-hidden rounded-3xl border shadow-2xl backdrop-blur ${styles.card}`}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${styles.icon}`}
          >
            {alert.priority === "High" ? <FiAlertTriangle /> : <FiBell />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide opacity-80">
                  Smart Alert
                </p>

                <h3 className="mt-1 text-sm font-black">{alert.title}</h3>
              </div>

              <button
                type="button"
                onClick={() => onDismiss?.(alert)}
                className="rounded-xl p-1.5 opacity-70 transition hover:bg-white/50 hover:opacity-100 dark:hover:bg-slate-900/40"
                aria-label="Dismiss smart alert"
              >
                <FiX />
              </button>
            </div>

            <p className="mt-2 text-sm leading-6 opacity-90">
              {alert.message}
            </p>

            <div className="mt-3 rounded-2xl bg-white/60 p-3 text-xs font-semibold leading-5 dark:bg-slate-950/30">
              {alert.recommendedAction}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onDismiss?.(alert)}
                className="rounded-xl border border-current/20 px-4 py-2 text-xs font-black transition hover:bg-white/40 dark:hover:bg-slate-900/40"
              >
                Dismiss
              </button>

              <button
                type="button"
                onClick={() => onView?.(alert)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-950 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <FiEye />
                View Alert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}