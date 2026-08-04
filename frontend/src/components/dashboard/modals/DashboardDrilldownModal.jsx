import { FiInfo } from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";

function hasDisplayValue(value) {
  return !(
    value === null ||
    value === undefined ||
    value === ""
  );
}

function formatCellValue(value) {
  if (!hasDisplayValue(value)) {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.length > 0
      ? value.join(", ")
      : "-";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "-";
    }
  }

  return String(value);
}

function hasEmployeeId(row) {
  const employeeId =
    row?.employeeId ??
    row?.employee_id;

  return (
    employeeId !== null &&
    employeeId !== undefined &&
    String(employeeId).trim() !== ""
  );
}

function getRowAccessibleName(row) {
  return (
    row?.name ||
    row?.employee ||
    row?.employeeName ||
    row?.employee_name ||
    row?.employeeId ||
    row?.employee_id ||
    "employee record"
  );
}

export default function DashboardDrilldownModal({
  detail,
  onClose,
  onRowClick,
}) {
  const isOpen = Boolean(detail);

  const columns = Array.isArray(
    detail?.columns
  )
    ? detail.columns.filter(
        (column) =>
          column &&
          column.key &&
          column.label
      )
    : [];

  const rows = Array.isArray(detail?.rows)
    ? detail.rows.filter(Boolean)
    : [];

  const canOpenEmployee =
    typeof onRowClick === "function";

  const hasClickableRows =
    canOpenEmployee &&
    rows.some(hasEmployeeId);

  const handleClose = () => {
    onClose?.();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title={
        detail?.title ||
        "Dashboard Details"
      }
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
          onClick={handleClose}
        >
          Close
        </Button>
      }
    >
      {detail && (
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            <FiInfo
              aria-hidden="true"
            />

            Drilldown Details
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">
                  {detail.title ||
                    "Dashboard drilldown records"}
                </caption>

                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {columns.length > 0 ? (
                      columns.map(
                        (column) => (
                          <th
                            key={
                              column.key
                            }
                            scope="col"
                            className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
                          >
                            {
                              column.label
                            }
                          </th>
                        )
                      )
                    ) : (
                      <th
                        scope="col"
                        className="border-b border-slate-200 px-4 py-3 font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
                      >
                        Details
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {rows.length > 0 &&
                  columns.length > 0 ? (
                    rows.map(
                      (row, index) => {
                        const isClickable =
                          canOpenEmployee &&
                          hasEmployeeId(
                            row
                          );

                        const rowIdentifier =
                          row.id ||
                          row.employeeId ||
                          row.employee_id ||
                          detail.title ||
                          "dashboard-row";

                        const rowKey = `${rowIdentifier}-${index}`;

                        const openRow =
                          () => {
                            if (
                              isClickable
                            ) {
                              onRowClick(
                                row
                              );
                            }
                          };

                        const handleKeyDown =
                          (event) => {
                            if (
                              !isClickable ||
                              (event.key !==
                                "Enter" &&
                                event.key !==
                                  " ")
                            ) {
                              return;
                            }

                            event.preventDefault();
                            onRowClick(
                              row
                            );
                          };

                        return (
                          <tr
                            key={
                              rowKey
                            }
                            onClick={
                              openRow
                            }
                            onKeyDown={
                              handleKeyDown
                            }
                            tabIndex={
                              isClickable
                                ? 0
                                : undefined
                            }
                            role={
                              isClickable
                                ? "button"
                                : undefined
                            }
                            aria-label={
                              isClickable
                                ? `Open details for ${getRowAccessibleName(
                                    row
                                  )}`
                                : undefined
                            }
                            className={[
                              "transition-colors dark:bg-slate-900",
                              isClickable
                                ? "cursor-pointer outline-none hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-indigo-500/10 dark:focus-visible:bg-indigo-500/10"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                            ].join(
                              " "
                            )}
                          >
                            {columns.map(
                              (
                                column
                              ) => (
                                <td
                                  key={
                                    column.key
                                  }
                                  className="max-w-sm px-4 py-3 font-medium text-slate-700 dark:text-slate-300"
                                >
                                  <span className="block break-words">
                                    {formatCellValue(
                                      row[
                                        column
                                          .key
                                      ]
                                    )}
                                  </span>
                                </td>
                              )
                            )}
                          </tr>
                        );
                      }
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan={Math.max(
                          columns.length,
                          1
                        )}
                        className="px-4 py-10 text-center"
                      >
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          No records
                          found
                        </p>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          There are no
                          records
                          available for
                          this dashboard
                          detail.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {hasClickableRows && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an employee row
              to open the
              corresponding employee
              details.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}