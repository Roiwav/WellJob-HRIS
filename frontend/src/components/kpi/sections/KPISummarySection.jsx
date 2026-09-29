import {
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";

const METRICS = [
  {
    key: "employees",
    label: "Employees",
    icon: FiUsers,
    valueClass: "text-indigo-600 dark:text-indigo-300",
    iconClass:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  },
  {
    key: "noIncidents",
    label: "No Recorded Incidents",
    icon: FiCheckCircle,
    valueClass: "text-emerald-600 dark:text-emerald-300",
    iconClass:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  {
    key: "repeat",
    label: "Repeat Cases",
    icon: FiRefreshCw,
    valueClass: "text-amber-600 dark:text-amber-300",
    iconClass:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  },
  {
    key: "highRisk",
    label: "High Risk",
    icon: FiAlertTriangle,
    valueClass: "text-rose-600 dark:text-rose-300",
    iconClass:
      "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  },
];

export default function KPISummarySection({
  totalEmployees = 0,
  complianceRate = 0,
  repeatOffenders = 0,
  highRiskEmployees = 0,
}) {
  const values = {
    employees: totalEmployees,
    noIncidents: `${complianceRate}%`,
    repeat: repeatOffenders,
    highRisk: highRiskEmployees,
  };

  return (
    <section aria-labelledby="kpi-summary-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="kpi-summary-title"
            className="text-sm font-black text-slate-900 dark:text-white"
          >
            Workforce Snapshot
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Current KPI status across the active workforce.
          </p>
        </div>

        <span className="mt-1 inline-flex w-fit items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 sm:mt-0">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          Live view
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800 lg:grid-cols-4 lg:divide-y-0">
        {METRICS.map((metric, index) => {
          const Icon = metric.icon;

          return (
            <div
              key={metric.key}
              className={`flex min-w-0 items-center gap-3 px-3 py-3.5 sm:px-4 ${
                index === 2 ? "lg:border-l-0" : ""
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.iconClass}`}
                aria-hidden="true"
              >
                <Icon size={15} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                  {metric.label}
                </p>
                <p
                  className={`mt-1 text-2xl font-black leading-none ${metric.valueClass}`}
                >
                  {values[metric.key]}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}