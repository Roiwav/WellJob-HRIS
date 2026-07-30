import { FiInfo } from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";

export default function DashboardDrilldownModal({
  detail,
  onClose,
  onRowClick,
}) {
  const isOpen = Boolean(detail);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={detail?.title || "Dashboard Details"}
      description={
        detail?.description ||
        "Review the selected dashboard records."
      }
      size="xl"
      tone="default"
      footer={
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          Close
        </Button>
      }
    >
      {detail && (
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            <FiInfo aria-hidden="true" />
            Drilldown Details
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {detail.columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {detail.rows.length > 0 ? (
                    detail.rows.map((row, index) => {
                      const isClickable =
                        typeof onRowClick === "function" &&
                        Boolean(row.employeeId);

                      const rowKey =
                        row.id ||
                        row.employeeId ||
                        `${detail.title}-${index}`;

                      const handleRowOpen = () => {
                        if (isClickable) {
                          onRowClick(row);
                        }
                      };

                      const handleKeyDown = (event) => {
                        if (
                          !isClickable ||
                          (event.key !== "Enter" &&
                            event.key !== " ")
                        ) {
                          return;
                        }

                        event.preventDefault();
                        onRowClick(row);
                      };

                      return (
                        <tr
                          key={rowKey}
                          onClick={handleRowOpen}
                          onKeyDown={handleKeyDown}
                          tabIndex={isClickable ? 0 : undefined}
                          role={isClickable ? "button" : undefined}
                          aria-label={
                            isClickable
                              ? `Open details for ${
                                  row.name ||
                                  row.employee ||
                                  row.employeeName ||
                                  "employee record"
                                }`
                              : undefined
                          }
                          className={[
                            "transition-colors dark:bg-slate-900",
                            isClickable
                              ? "cursor-pointer outline-none hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-indigo-500/10 dark:focus-visible:bg-indigo-500/10"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                          ].join(" ")}
                        >
                          {detail.columns.map((column) => (
                            <td
                              key={column.key}
                              className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300"
                            >
                              {row[column.key] ?? "-"}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={Math.max(
                          detail.columns.length,
                          1
                        )}
                        className="px-4 py-10 text-center"
                      >
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          No records found
                        </p>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          There are no records available for this dashboard
                          detail.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {typeof onRowClick === "function" && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an employee row to open the corresponding employee
              details.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}