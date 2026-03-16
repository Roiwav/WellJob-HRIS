import RiskBadge from "./RiskBadge";

export default function RiskTable({ employees, getSeverity, getRiskLevel }) {

  return (

    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

      <table className="w-full text-sm">

        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-xs tracking-wider">

          <tr>
            <th className="px-6 py-4 text-left">Employee</th>
            <th className="px-6 py-4 text-left">Company</th>
            <th className="px-6 py-4 text-left">Violations</th>
            <th className="px-6 py-4 text-left">Severity</th>
            <th className="px-6 py-4 text-left">Risk Level</th>
          </tr>

        </thead>

        <tbody>

          {employees.map((emp) => (

            <tr
              key={emp.id}
              className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
            >

              <td className="px-6 py-4 font-medium">{emp.name}</td>

              <td className="px-6 py-4">{emp.company}</td>

              <td className="px-6 py-4">{emp.violationCount}</td>

              <td className="px-6 py-4">
                {getSeverity(emp.violationCount)}
              </td>

              <td className="px-6 py-4">
                <RiskBadge level={getRiskLevel(emp.violationCount)} />
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}