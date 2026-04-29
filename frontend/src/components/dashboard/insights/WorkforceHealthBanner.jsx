import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
} from "react-icons/fi";

function getTone(tone) {
  const styles = {
    emerald: {
      wrapper:
        "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      text: "text-emerald-800 dark:text-emerald-200",
      muted: "text-emerald-700/80 dark:text-emerald-200/80",
      bar: "bg-emerald-500",
      badge:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      iconNode: <FiCheckCircle />,
    },
    blue: {
      wrapper:
        "border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10",
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      text: "text-blue-800 dark:text-blue-200",
      muted: "text-blue-700/80 dark:text-blue-200/80",
      bar: "bg-blue-500",
      badge:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      iconNode: <FiActivity />,
    },
    amber: {
      wrapper:
        "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      text: "text-amber-800 dark:text-amber-200",
      muted: "text-amber-700/80 dark:text-amber-200/80",
      bar: "bg-amber-500",
      badge:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      iconNode: <FiInfo />,
    },
    red: {
      wrapper:
        "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
      icon: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      text: "text-red-800 dark:text-red-200",
      muted: "text-red-700/80 dark:text-red-200/80",
      bar: "bg-red-500",
      badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      iconNode: <FiAlertTriangle />,
    },
  };

  return styles[tone] || styles.blue;
}

export default function WorkforceHealthBanner({ health }) {
  if (!health) return null;

  const tone = getTone(health.tone);

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${tone.wrapper}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ${tone.icon}`}
          >
            {tone.iconNode}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`text-base font-extrabold ${tone.text}`}>
                {health.title}
              </h2>

              <span
                className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${tone.badge}`}
              >
                {health.level}
              </span>
            </div>

            <p className={`mt-1 text-sm leading-6 ${tone.muted}`}>
              {health.summary}
            </p>

            {health.reasons?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {health.reasons.slice(0, 3).map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-950/30 dark:text-slate-200"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full shrink-0 xl:w-64">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>Workforce Health Score</span>
            <span>{health.score}/100</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/70 dark:bg-slate-950/40">
            <div
              className={`h-full rounded-full ${tone.bar}`}
              style={{ width: `${Math.max(0, Math.min(health.score, 100))}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}