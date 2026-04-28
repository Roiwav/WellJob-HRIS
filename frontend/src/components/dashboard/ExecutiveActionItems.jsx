import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClipboard,
  FiMapPin,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";

function getToneClasses(priority) {
  const styles = {
    High: {
      card: "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
      icon: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    },
    Medium: {
      card: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      badge:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    },
    Low: {
      card: "border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10",
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    },
    Good: {
      card: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      badge:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    },
  };

  return styles[priority] || styles.Low;
}

function getIcon(type) {
  const icons = {
    Incident: <FiAlertTriangle />,
    Compliance: <FiShield />,
    Deployment: <FiMapPin />,
    Trend: <FiTrendingUp />,
    Policy: <FiClipboard />,
    Good: <FiCheckCircle />,
  };

  return icons[type] || <FiClipboard />;
}

export default function ExecutiveActionItems({ actions = [] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Executive Recommended Actions
          </h2>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            System-generated prescriptive analytics for HR and management-level
            decision-making.
          </p>
        </div>

        <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          Prescriptive Analytics
        </span>
      </div>

      {actions.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <FiCheckCircle />
            </div>

            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">
                No urgent management action required.
              </p>
              <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-300/80">
                Workforce indicators are currently within normal monitoring
                range.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {actions.map((action) => {
            const tone = getToneClasses(action.priority);

            return (
              <div
                key={action.id}
                className={`rounded-2xl border p-5 ${tone.card}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${tone.icon}`}
                  >
                    {getIcon(action.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${tone.badge}`}
                      >
                        {action.priority}
                      </span>

                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {action.type}
                      </span>
                    </div>

                    <h3 className="mt-3 text-sm font-extrabold text-slate-900 dark:text-white">
                      {action.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {action.recommendation}
                    </p>

                    {action.basis && (
                      <p className="mt-3 rounded-xl bg-white/60 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
                        Basis: {action.basis}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}