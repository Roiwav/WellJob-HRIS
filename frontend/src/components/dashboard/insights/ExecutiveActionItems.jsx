import {
  FiAlertTriangle,
  FiAward,
  FiCheckCircle,
  FiClipboard,
  FiDatabase,
  FiMapPin,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";

function getTone(priority) {
  const styles = {
    High: {
      icon: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      row: "border-red-200/70 dark:border-red-500/30",
    },
    Medium: {
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      badge:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      row: "border-amber-200/70 dark:border-amber-500/30",
    },
    Low: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      row: "border-blue-200/70 dark:border-blue-500/30",
    },
    Good: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      badge:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      row: "border-emerald-200/70 dark:border-emerald-500/30",
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
    Reinforcement: <FiAward />,
    Good: <FiCheckCircle />,
  };

  return icons[type] || <FiClipboard />;
}

function getModeLabel(mode) {
  if (mode === "positive") return "Reinforcement";
  if (mode === "preventive") return "Preventive";
  return "Corrective";
}

function EmptyDataState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/40">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <FiDatabase />
        </div>

        <div>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
            No workforce data available yet
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Add employee records, deployment assignments, compliance documents,
            and incident reports to generate management-level prescriptive
            insights.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyPriorityState() {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          <FiCheckCircle />
        </div>

        <div>
          <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
            No priority action required
          </p>

          <p className="mt-1 text-xs leading-5 text-emerald-700/80 dark:text-emerald-300/80">
            No corrective or preventive management action is required based on
            the current workforce data.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyPositiveState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <FiAward />
        </div>

        <div>
          <p className="text-sm font-extrabold text-slate-800 dark:text-white">
            No reinforcement pattern detected yet
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Positive recommendations will appear when the system detects strong
            utilization, low incident risk, stable client sites, or good
            compliance standing.
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ action }) {
  const tone = getTone(action.priority);

  return (
    <article
      className={`rounded-2xl border bg-white p-3.5 transition hover:-translate-y-0.5 hover:shadow-sm dark:bg-slate-950/30 ${tone.row}`}
    >
      <div className="flex gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${tone.icon}`}
        >
          {getIcon(action.type)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone.badge}`}
            >
              {action.priority}
            </span>

            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {getModeLabel(action.mode)}
            </span>
          </div>

          <h3 className="mt-2 line-clamp-1 text-sm font-extrabold text-slate-900 dark:text-white">
            {action.title}
          </h3>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {action.recommendation}
          </p>

          {action.basis && (
            <p className="mt-2 line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <span className="font-extrabold">Basis:</span> {action.basis}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ExecutiveActionItems({ actions = [] }) {
  const correctiveActions = actions.filter((item) => item.mode !== "positive");
  const positiveActions = actions.filter((item) => item.mode === "positive");

  const priorityActions = correctiveActions.slice(0, 4);
  const reinforcementActions = positiveActions.slice(0, 2);

  const highCount = correctiveActions.filter(
    (item) => item.priority === "High"
  ).length;

  const hasNoInsightData = actions.length === 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Management Prescriptive Insights
            </h2>

            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              Decision Support
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Recommended corrective, preventive, and positive reinforcement
            actions based on workforce data.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">
            {highCount} high priority
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {correctiveActions.length} corrective
          </span>

          <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            {positiveActions.length} positive
          </span>
        </div>
      </div>

      {hasNoInsightData ? (
        <div className="p-5">
          <EmptyDataState />
        </div>
      ) : (
        <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Priority Action Queue
                </h3>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Top actions requiring HR or management attention.
                </p>
              </div>
            </div>

            {priorityActions.length === 0 ? (
              <EmptyPriorityState />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {priorityActions.map((action) => (
                  <ActionRow key={action.id} action={action} />
                ))}
              </div>
            )}
          </div>

          <aside>
            <div className="mb-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Positive Reinforcement
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Practices worth maintaining or replicating.
              </p>
            </div>

            {reinforcementActions.length === 0 ? (
              <EmptyPositiveState />
            ) : (
              <div className="grid gap-3">
                {reinforcementActions.map((action) => (
                  <ActionRow key={action.id} action={action} />
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}