import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

function getInitials(name) {
  return String(name || "Employee")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function HighRiskEmployees({ employees = [] }) {
  const highRiskEmployees = employees
    .filter(
      (emp) =>
        emp.riskLevel === "High Risk" ||
        emp.criticalIncidentCount >= 1 ||
        emp.violationCount >= 5
    )
    .sort((a, b) => {
      const severityDiff = (b.severityScore || 0) - (a.severityScore || 0);
      if (severityDiff !== 0) return severityDiff;

      return (b.violationCount || 0) - (a.violationCount || 0);
    });

  return (
    <div className="flex max-h-[430px] min-h-[245px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
            <FiAlertTriangle className="text-rose-500 dark:text-rose-400" />
            High Risk Employees
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Priority employees based on severity score and critical incidents.
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-800/70">
          {highRiskEmployees.length}
        </span>
      </div>

      {highRiskEmployees.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <FiCheckCircle />
            </div>

            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                No high-risk employees detected.
              </p>

              <p className="mt-1 text-xs leading-5 text-emerald-700/80 dark:text-emerald-300/80">
                Current employee records do not show critical or high-risk KPI
                cases.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          <div className="space-y-3">
            {highRiskEmployees.map((emp) => (
              <div
                key={emp.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-extrabold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                      {getInitials(emp.name)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {emp.name}
                      </p>

                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {emp.company || "Unassigned"}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    {emp.violationCount || 0} violation
                    {(emp.violationCount || 0) === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                    <p className="text-slate-400">Severity Score</p>

                    <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">
                      {emp.severityScore || 0}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                    <p className="text-slate-400">Critical Cases</p>

                    <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">
                      {emp.criticalIncidentCount || 0}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}