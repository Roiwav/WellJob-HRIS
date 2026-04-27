import { FiAlertTriangle } from "react-icons/fi";

export default function HighRiskEmployees({ employees }) {

  const highRiskEmployees = employees
.filter((emp) => emp.riskLevel === "High Risk" || emp.violationCount >= 5)
    .sort((a, b) => b.violationCount - a.violationCount);

  if (highRiskEmployees.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
<h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-red-500 dark:text-red-400">
  <FiAlertTriangle />
  High Risk Employees
</h3>

        <p className="text-sm text-slate-500 dark:text-slate-400">
          No high risk employees detected.
        </p>
      </div>
    );
  }

  return (

    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">

      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-red-500 dark:text-red-400">

        <FiAlertTriangle />

        High Risk Employees

      </h3>

      <div className="space-y-4">

        {highRiskEmployees.map((emp) => (

          <div
            key={emp.id}
            className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3"
          >

            <div>

              <p className="font-medium">
                {emp.name}
              </p>

              <p className="text-xs text-slate-500">
                {emp.company}
              </p>

            </div>

            <span className="text-xs font-semibold text-red-500 bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full">

              {emp.violationCount} Violations

            </span>

          </div>

        ))}

      </div>

    </div>

  );
}