import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClipboard,
  FiDatabase,
  FiMapPin,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";

const PRIORITY_STYLES = {
  High: {
    icon:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    badge:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    row: "border-red-200/70 dark:border-red-500/30",
  },
  Medium: {
    icon:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    row: "border-amber-200/70 dark:border-amber-500/30",
  },
  Low: {
    icon:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    badge:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    row: "border-blue-200/70 dark:border-blue-500/30",
  },
  Good: {
    icon:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    row: "border-emerald-200/70 dark:border-emerald-500/30",
  },
};

function getPriorityTone(priority) {
  return PRIORITY_STYLES[priority] || PRIORITY_STYLES.Low;
}

function getModeLabel(mode) {
  return mode === "preventive" ? "Preventive" : "Corrective";
}

function ActionTypeIcon({ type, size = 17 }) {
  switch (type) {
    case "Incident":
      return <FiAlertTriangle size={size} />;

    case "Compliance":
      return <FiShield size={size} />;

    case "Deployment":
      return <FiMapPin size={size} />;

    case "Trend":
      return <FiTrendingUp size={size} />;

    case "Reinforcement":
    case "Good":
      return <FiCheckCircle size={size} />;

    case "Policy":
    default:
      return <FiClipboard size={size} />;
  }
}

function EmptyDataState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/40">
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          aria-hidden="true"
        >
          <FiDatabase size={19} />
        </div>

        <div className="min-w-0">
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
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          aria-hidden="true"
        >
          <FiCheckCircle size={17} />
        </div>

        <div className="min-w-0">
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

function ActionRow({ action }) {
  const priority = action?.priority || "Low";
  const tone = getPriorityTone(priority);

  return (
    <article
      className={`rounded-2xl border bg-white p-3.5 dark:bg-slate-950/30 ${tone.row}`}
    >
      <div className="flex gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${tone.icon}`}
          aria-hidden="true"
        >
          <ActionTypeIcon type={action?.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone.badge}`}
            >
              {priority}
            </span>

            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {getModeLabel(action?.mode)}
            </span>
          </div>

          <h3 className="mt-2 line-clamp-2 text-sm font-extrabold text-slate-900 dark:text-white">
            {action?.title || "Management Action"}
          </h3>

          <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {action?.recommendation ||
              "Review the available workforce information and determine the appropriate management response."}
          </p>

          {action?.basis && (
            <p className="mt-2 line-clamp-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <span className="font-extrabold">Basis:</span>{" "}
              {action.basis}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ExecutiveActionItems({ actions = [] }) {
  const safeActions = Array.isArray(actions)
    ? actions.filter(Boolean)
    : [];

  const correctiveActions = safeActions.filter(
    (action) => action.mode !== "positive"
  );

  const priorityActions = correctiveActions.slice(0, 4);

  const highCount = correctiveActions.filter(
    (action) => action.priority === "High"
  ).length;

  const hasNoInsightData = safeActions.length === 0;

  return (
    <section
      aria-labelledby="management-insights-title"
      className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="management-insights-title"
              className="text-base font-extrabold text-slate-900 dark:text-white"
            >
              Management Prescriptive Insights
            </h2>

            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              Decision Support
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Recommended corrective and preventive actions based on current
            workforce records and configured rules.
          </p>
        </div>

        <div
          className="flex flex-wrap gap-2 text-xs"
          aria-label="Prescriptive insight summary"
        >
          <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">
            {highCount} high priority
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {priorityActions.length}{" "}
            {priorityActions.length === 1 ? "action item" : "action items"}
          </span>
        </div>
      </div>

      {hasNoInsightData ? (
        <div className="p-5">
          <EmptyDataState />
        </div>
      ) : (
        <div className="p-5">
          <div className="mb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Priority Action Queue
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Top actions requiring HR or management attention.
            </p>
          </div>

          {priorityActions.length === 0 ? (
            <EmptyPriorityState />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {priorityActions.map((action, index) => (
                <ActionRow
                  key={action.id || `executive-action-${index}`}
                  action={action}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}