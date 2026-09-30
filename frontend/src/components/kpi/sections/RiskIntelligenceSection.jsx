import {
  FiActivity,
  FiRefreshCw,
  FiShield,
  FiUsers,
} from "react-icons/fi";

import RiskTable from "../table/RiskTable";

function getSeverity(violationCount) {
  const count = Number(violationCount || 0);

  if (count >= 5) {
    return "Critical";
  }

  if (count >= 3) {
    return "Major";
  }

  if (count >= 1) {
    return "Minor";
  }

  return "None";
}

function getRiskLevel(violationCount) {
  const count = Number(violationCount || 0);

  if (count >= 5) {
    return "High Risk";
  }

  if (count >= 3) {
    return "Repeat";
  }

  if (count >= 1) {
    return "Monitor";
  }

  return "Low Risk";
}

export default function RiskIntelligenceSection({
  employees = [],
}) {
  const safeEmployees = Array.isArray(employees) ? employees : [];

  const highRiskCount = safeEmployees.filter(
    (employee) => employee?.riskLevel === "High Risk"
  ).length;

  const repeatCount = safeEmployees.filter(
    (employee) => employee?.riskLevel === "Repeat"
  ).length;

  return (
    <section
      className="min-w-0 space-y-4"
      aria-labelledby="risk-intelligence-title"
    >
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <FiShield aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <h2
                  id="risk-intelligence-title"
                  className="text-base font-black text-slate-900 dark:text-white"
                >
                  Employee Intelligence
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Review employee KPI standing, risk, and recommended HR actions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[400px]">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-950/40">
              <div className="flex items-center gap-2">
                <FiUsers
                  className="shrink-0 text-indigo-600 dark:text-indigo-300"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-lg font-black leading-none text-slate-900 dark:text-white">
                    {safeEmployees.length}
                  </p>
                  <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Employees
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-rose-50 px-3 py-2.5 dark:bg-rose-500/10">
              <div className="flex items-center gap-2">
                <FiActivity
                  className="shrink-0 text-rose-600 dark:text-rose-300"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-lg font-black leading-none text-rose-700 dark:text-rose-300">
                    {highRiskCount}
                  </p>
                  <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.1em] text-rose-700/70 dark:text-rose-300/70">
                    High Risk
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-500/10">
              <div className="flex items-center gap-2">
                <FiRefreshCw
                  className="shrink-0 text-amber-600 dark:text-amber-300"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-lg font-black leading-none text-amber-700 dark:text-amber-300">
                    {repeatCount}
                  </p>
                  <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.1em] text-amber-700/70 dark:text-amber-300/70">
                    Repeat
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RiskTable
        employees={safeEmployees}
        getSeverity={getSeverity}
        getRiskLevel={getRiskLevel}
      />
    </section>
  );
}