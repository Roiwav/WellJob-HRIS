import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiTarget,
  FiUsers,
  FiZap,
} from "react-icons/fi";

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}


function getPriorityEmployees(employees = []) {
  const safeEmployees = Array.isArray(employees) ? employees : [];

  return [...safeEmployees]
    .filter((employee) => {
      return (
        employee?.riskLevel === "High Risk" ||
        employee?.riskLevel === "Repeat" ||
        Number(employee?.criticalIncidentCount || 0) > 0 ||
        Number(employee?.violationCount || 0) >= 3
      );
    })
    .sort((firstEmployee, secondEmployee) => {
      const severityDifference =
        Number(secondEmployee?.severityScore || 0) -
        Number(firstEmployee?.severityScore || 0);

      if (severityDifference !== 0) {
        return severityDifference;
      }

      return (
        Number(secondEmployee?.violationCount || 0) -
        Number(firstEmployee?.violationCount || 0)
      );
    })
    .slice(0, 3);
}

function getPriorityEmployeeStyle(employee) {
  const isHighRisk =
    employee?.riskLevel === "High Risk" ||
    Number(employee?.criticalIncidentCount || 0) > 0;

  return isHighRisk
    ? {
        avatar:
          "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
        badge:
          "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
      }
    : {
        avatar:
          "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
        badge:
          "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
      };
}

function PriorityEmployeeRow({ employee }) {
  const style = getPriorityEmployeeStyle(employee);

  return (
    <div className="grid gap-3 border-b border-slate-200 py-3 last:border-b-0 dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-11 min-w-[48px] shrink-0 items-center justify-center rounded-2xl bg-indigo-50 px-3 text-xs font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
          title={`Employee number ${formatEmployeeId(employee?.id)}`}
        >
          {formatEmployeeId(employee?.id)}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-slate-900 dark:text-white">
              {employee?.name || "Unknown Employee"}
            </p>

            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black ${style.badge}`}
            >
              {employee?.riskLevel || "For Review"}
            </span>
          </div>

          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {employee?.company || "Unassigned"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-[10px] font-bold text-slate-600 dark:text-slate-300 md:justify-end md:pl-0">
        <span>{Number(employee?.violationCount) || 0} violation(s)</span>
        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
          •
        </span>
        <span>Severity {Number(employee?.severityScore) || 0}</span>
        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
          •
        </span>
        <span
          className="max-w-[220px] truncate text-indigo-600 dark:text-indigo-300"
          title={employee?.suggestedHRAction || "Review"}
        >
          {employee?.suggestedHRAction || "Review"}
        </span>
      </div>
    </div>
  );
}

export default function WorkforceStandingSnapshot({
  employees = [],
  totalEmployees = 0,
  goodStandingEmployees = 0,
  highRiskEmployees = 0,
  pendingRecommendationCount = 0,
  onOpenIntelligence,
  onOpenReview,
}) {
  const priorityEmployees = getPriorityEmployees(employees);

  const safeTotalEmployees = Math.max(0, Number(totalEmployees || 0));
  const safeGoodStandingEmployees = Math.max(
    0,
    Number(goodStandingEmployees || 0)
  );
  const safeHighRiskEmployees = Math.max(
    0,
    Number(highRiskEmployees || 0)
  );
  const safePendingRecommendationCount = Math.max(
    0,
    Number(pendingRecommendationCount || 0)
  );

  const stablePercentage =
    safeTotalEmployees > 0
      ? Math.round(
          (safeGoodStandingEmployees / safeTotalEmployees) * 100
        )
      : 0;

  return (
    <section aria-labelledby="workforce-focus-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="workforce-focus-title"
            className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"
          >
            <FiUsers
              className="text-indigo-600 dark:text-indigo-300"
              aria-hidden="true"
            />
            HR Focus
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Employees and recommendations that need attention.
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold sm:mt-0">
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
            <FiCheckCircle aria-hidden="true" />
            {stablePercentage}% good standing
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
            <FiAlertTriangle aria-hidden="true" />
            {safeHighRiskEmployees} high risk
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <FiZap
                  className="text-rose-600 dark:text-rose-300"
                  aria-hidden="true"
                />
                Priority Attention
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                Top employees based on current risk and incident severity.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenIntelligence}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-indigo-600 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              View all
              <FiArrowRight aria-hidden="true" />
            </button>
          </div>

          {priorityEmployees.length === 0 ? (
            <div className="flex items-center gap-3 py-5 text-sm text-emerald-700 dark:text-emerald-300">
              <FiCheckCircle aria-hidden="true" />
              <span className="font-bold">No priority cases detected.</span>
            </div>
          ) : (
            <div>
              {priorityEmployees.map((employee) => (
                <PriorityEmployeeRow
                  key={
                    employee?.id ||
                    employee?.employeeId ||
                    employee?.name
                  }
                  employee={employee}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="flex flex-col rounded-xl bg-slate-50 p-4 dark:bg-slate-950/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">
                Review Queue
              </p>
              <p className="mt-1 text-3xl font-black leading-none text-amber-600 dark:text-amber-300">
                {safePendingRecommendationCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                recommendation(s) waiting for HR validation
              </p>
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <FiTarget aria-hidden="true" />
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Good standing
              </span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                {safeGoodStandingEmployees}
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, stablePercentage)}%` }}
              />
            </div>

            <p className="mt-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
              {safeGoodStandingEmployees} of {safeTotalEmployees} active KPI
              records currently meet the good-standing criteria.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenReview}
            className="mt-4 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25"
          >
            Open Review Queue
            <FiArrowRight aria-hidden="true" />
          </button>
        </aside>
      </div>
    </section>
  );
}