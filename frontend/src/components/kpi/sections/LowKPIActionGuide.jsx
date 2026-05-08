import {
  FiBookOpen,
  FiMessageSquare,
  FiRefreshCw,
  FiTarget,
  FiUsers,
} from "react-icons/fi";

const ACTIONS = [
  {
    title: "Verbal Counseling",
    description:
      "Initial coaching or reminder for employees with early signs of low KPI or minor performance concerns.",
    bestFor: "First-time or minor KPI concern",
    icon: FiMessageSquare,
    style:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
  },
  {
    title: "Performance Improvement Plan",
    description:
      "Structured monitoring plan with goals, timeline, and expected improvement for employees with repeated low KPI.",
    bestFor: "Repeated low KPI / monitoring needed",
    icon: FiTarget,
    style:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  },
  {
    title: "Reassignment of Position",
    description:
      "Review possible role mismatch and consider reassignment when performance issues may be related to job fit.",
    bestFor: "Possible role mismatch",
    icon: FiRefreshCw,
    style:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300",
  },
  {
    title: "Seminar & Webinar",
    description:
      "Recommend policy refreshers or learning sessions to improve awareness, compliance, and workplace behavior.",
    bestFor: "Policy or behavior refresher",
    icon: FiBookOpen,
    style:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  {
    title: "Employee Training",
    description:
      "Provide skills-based training when low KPI is connected to task quality, productivity, or competency gaps.",
    bestFor: "Skills or quality improvement",
    icon: FiUsers,
    style:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
  },
];

function isLowKPIEmployee(employee) {
  const violationCount = Number(employee?.violationCount || 0);
  const criticalIncidentCount = Number(employee?.criticalIncidentCount || 0);

  const riskLevel = String(employee?.riskLevel || "").toLowerCase();
  const kpiLevel = String(
    employee?.kpiLevel || employee?.performanceLevel || ""
  ).toLowerCase();

  return (
    violationCount > 0 ||
    criticalIncidentCount > 0 ||
    riskLevel.includes("repeat") ||
    riskLevel.includes("high") ||
    kpiLevel.includes("low") ||
    kpiLevel.includes("poor")
  );
}

export default function LowKPIActionGuide({ employees = [] }) {
  const lowKPIEmployees = employees.filter(isLowKPIEmployee);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Low KPI Corrective Action Guide
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            HR action options for employees with low KPI indicators. These are
            recommendation guides only; final action remains under HR and
            management review.
          </p>
        </div>

        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          {lowKPIEmployees.length} for review
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;

          return (
            <div
              key={action.title}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div
                className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${action.style}`}
              >
                <Icon size={18} />
              </div>

              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {action.title}
              </h3>

              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Best for
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {action.bestFor}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {action.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}