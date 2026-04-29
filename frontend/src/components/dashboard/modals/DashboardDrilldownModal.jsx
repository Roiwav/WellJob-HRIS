import { FiX } from "react-icons/fi";

export default function DashboardDrilldownModal({ detail, onClose }) {
  if (!detail) return null;

  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const columns = Array.isArray(detail.columns) ? detail.columns : [];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {detail.title}
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {detail.description}
            </p>

            <p className="mt-2 text-xs font-bold text-slate-400">
              Showing {rows.length} record{rows.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <FiX size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-white/10 dark:bg-slate-950/40">
              <p className="font-bold text-slate-700 dark:text-slate-200">
                No records found.
              </p>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                There are no available records for this drill-down view.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-white/10">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className="whitespace-nowrap px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-900">
                  {rows.map((row, index) => (
                    <tr
                      key={`${detail.title}-${index}`}
                      className="transition hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className="max-w-xs px-4 py-3 text-slate-700 dark:text-slate-200"
                        >
                          <span className="line-clamp-2">
                            {row[column.key] ?? "-"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}