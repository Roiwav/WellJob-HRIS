import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
} from "react-icons/fi";

const TONE_STYLES = {
  emerald: {
    wrapper:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    icon:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    text:
      "text-emerald-800 dark:text-emerald-200",
    muted:
      "text-emerald-700/80 dark:text-emerald-200/80",
    bar: "bg-emerald-500",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    iconComponent: FiCheckCircle,
  },
  blue: {
    wrapper:
      "border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10",
    icon:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    text:
      "text-blue-800 dark:text-blue-200",
    muted:
      "text-blue-700/80 dark:text-blue-200/80",
    bar: "bg-blue-500",
    badge:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    iconComponent: FiActivity,
  },
  amber: {
    wrapper:
      "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
    icon:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    text:
      "text-amber-800 dark:text-amber-200",
    muted:
      "text-amber-700/80 dark:text-amber-200/80",
    bar: "bg-amber-500",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    iconComponent: FiInfo,
  },
  red: {
    wrapper:
      "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
    icon:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    text:
      "text-red-800 dark:text-red-200",
    muted:
      "text-red-700/80 dark:text-red-200/80",
    bar: "bg-red-500",
    badge:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    iconComponent: FiAlertTriangle,
  },
};

function getTone(tone) {
  return (
    TONE_STYLES[tone] ||
    TONE_STYLES.blue
  );
}

function getSafeScore(value) {
  const numericScore =
    Number(value);

  if (
    !Number.isFinite(
      numericScore
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      numericScore,
      100
    )
  );
}

export default function WorkforceHealthBanner({
  health,
}) {
  if (!health) {
    return null;
  }

  const tone =
    getTone(health.tone);

  const HealthIcon =
    tone.iconComponent;

  const healthScore =
    getSafeScore(
      health.score
    );

  const reasons =
    Array.isArray(
      health.reasons
    )
      ? health.reasons
          .filter(
            (reason) =>
              typeof reason ===
                "string" &&
              reason.trim()
          )
          .slice(0, 3)
      : [];

  return (
    <section
      aria-labelledby="workforce-health-title"
      className={`rounded-2xl border px-5 py-4 shadow-sm ${tone.wrapper}`}
    >
      <div className="grid gap-4 xl:grid-cols-12 xl:items-center">
        <div className="flex min-w-0 items-start gap-3 xl:col-span-5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}
            aria-hidden="true"
          >
            <HealthIcon size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="workforce-health-title"
                className={`text-sm font-extrabold ${tone.text}`}
              >
                {health.title ||
                  "Workforce Health"}
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tone.badge}`}
              >
                {health.level ||
                  "Stable"}
              </span>
            </div>

            <p
              className={`mt-1 max-w-xl text-xs leading-5 ${tone.muted}`}
            >
              {health.summary ||
                "Current workforce indicators are available for HR monitoring and management review."}
            </p>
          </div>
        </div>

        <div className="xl:col-span-4">
          {reasons.length > 0 ? (
            <div
              className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"
              aria-label="Workforce health factors"
            >
              {reasons.map(
                (
                  reason,
                  index
                ) => (
                  <div
                    key={`${reason}-${index}`}
                    className="rounded-xl bg-white/60 px-3 py-2 text-xs font-semibold leading-5 text-slate-700 dark:bg-slate-950/25 dark:text-slate-200"
                  >
                    {reason}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-white/60 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950/25 dark:text-slate-300">
              No active workforce concern is currently contributing to the health score.
            </div>
          )}
        </div>

        <div className="xl:col-span-3">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>
              Workforce Health Score
            </span>

            <span>
              {healthScore}/100
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Workforce health score"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              healthScore
            }
            className="h-2 w-full overflow-hidden rounded-full bg-white/70 dark:bg-slate-950/40"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${tone.bar}`}
              style={{
                width: `${healthScore}%`,
              }}
            />
          </div>

          <p className="mt-2 text-[11px] leading-5 text-slate-600/80 dark:text-slate-300/80">
            Based on incident severity, active-case aging, compliance indicators, and deployment utilization.
          </p>
        </div>
      </div>
    </section>
  );
}