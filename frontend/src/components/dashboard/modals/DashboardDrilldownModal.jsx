import { FiX, FiInfo } from "react-icons/fi";

export default function DashboardDrilldownModal({ detail, onClose, onRowClick }) {
  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-slate-900">
        
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 dark:border-white/10 dark:bg-slate-800/50">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              <FiInfo />
              Drilldown Details
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {detail.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {detail.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white p-2.5 text-slate-400 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-800 dark:ring-white/10 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {detail.columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-4 py-3 font-bold text-slate-600 dark:text-slate-300"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {detail.rows.length > 0 ? (
                  detail.rows.map((row, index) => {
                    // Kung may onRowClick at may employeeId ang row, clickable ito
                    const isClickable = onRowClick && row.employeeId;

                    return (
                      <tr 
                        key={row.id || index}
                        onClick={() => isClickable && onRowClick(row)}
                        className={`transition-colors dark:bg-slate-900 ${
                          isClickable 
                            ? "cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/10" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        {detail.columns.map((col) => (
                          <td
                            key={col.key}
                            className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300"
                          >
                            {row[col.key]}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={detail.columns.length}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      No records found for this detail.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}