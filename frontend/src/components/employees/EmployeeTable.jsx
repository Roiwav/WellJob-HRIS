import {
  FiArchive,
  FiEdit2,
  FiEye,
  FiSearch,
  FiSliders,
  FiUsers,
} from "react-icons/fi";

import {
  getComplianceStatus as getDefaultComplianceStatus,
  getEmployeeCompany,
  getEmployeeDisplayName,
} from "../../utils/employees/employeeHelpers";

import Button from "../ui/Button";
import EmptyState from "../ui/EmptyState";
import IconButton from "../ui/IconButton";

import ComplianceBadge from "./ComplianceBadge";
import StatusBadge from "./StatusBadge";

const COMPLIANCE_STATUS_ALIASES = {
  Complete: "Valid",
  "No Compliance": "No Data",
};

function normalizeComplianceStatus(status) {
  const value = String(status || "").trim();
  return COMPLIANCE_STATUS_ALIASES[value] || value || "No Data";
}

function getEmployeeId(employee) {
  return (
    employee?.id ||
    employee?.employeeId ||
    employee?.employee_id ||
    "-"
  );
}

function getEmployeeKey(employee, index) {
  return (
    employee?.uid ||
    employee?.employeeId ||
    employee?.employee_id ||
    employee?.id ||
    `employee-${index}`
  );
}

function EmployeeEmptyState({
  totalRecords,
  searchQuery,
  hasFilters,
  onClearSearch,
  onClearFilters,
}) {
  const search = String(searchQuery || "").trim();
  const canClearSearch = typeof onClearSearch === "function";
  const canClearFilters = typeof onClearFilters === "function";

  if (totalRecords === 0) {
    return (
      <EmptyState
        icon="employees"
        title="No employee records yet"
        description="No active employee records are currently registered in the system."
      />
    );
  }

  if (search) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="search"
          title="No search results"
          description={`No employee matched “${search}”. Check the spelling or try a different name, employee ID, company, or position.`}
        />

        <div className="flex flex-wrap justify-center gap-2">
          {canClearSearch && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FiSearch aria-hidden="true" />}
              onClick={onClearSearch}
            >
              Clear Search
            </Button>
          )}

          {hasFilters && canClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<FiSliders aria-hidden="true" />}
              onClick={onClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="filter"
          title="No filtered results"
          description="Employee records exist, but none match the selected employment or compliance filters."
        />

        {canClearFilters && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FiSliders aria-hidden="true" />}
              onClick={onClearFilters}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <EmptyState
      icon="employees"
      title="No employees found"
      description="No employee records are currently available."
    />
  );
}

export default function EmployeeTable({
  employees = [],
  totalRecords = 0,
  searchQuery = "",
  hasFilters = false,
  onClearSearch,
  onClearFilters,
  openModal,
  onEdit,
  getComplianceStatus,
  onArchive,
  isSuperAdmin = false,
  isHRManager = false,
}) {
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const numericTotalRecords = Number(totalRecords);

  const safeTotalRecords = Number.isFinite(numericTotalRecords)
    ? numericTotalRecords
    : safeEmployees.length;

  const complianceResolver =
    typeof getComplianceStatus === "function"
      ? getComplianceStatus
      : getDefaultComplianceStatus;

  const canEdit = !isSuperAdmin && typeof onEdit === "function";
  const canArchive =
    isHRManager &&
    !isSuperAdmin &&
    typeof onArchive === "function";

  const recordCountLabel =
    safeTotalRecords > safeEmployees.length
      ? `${safeEmployees.length} of ${safeTotalRecords} records`
      : `${safeEmployees.length} ${
          safeEmployees.length === 1 ? "record" : "records"
        }`;

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
            <FiUsers
              aria-hidden="true"
              className="shrink-0 text-indigo-600 dark:text-indigo-400"
            />
            Employee Records
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            View registered employees, employment status, company assignment,
            and compliance condition.
          </p>
        </div>

        <span
          aria-label={recordCountLabel}
          className="w-fit rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
        >
          {recordCountLabel}
        </span>
      </div>

      {safeEmployees.length === 0 ? (
        <div className="p-5 sm:p-6">
          <EmployeeEmptyState
            totalRecords={safeTotalRecords}
            searchQuery={searchQuery}
            hasFilters={hasFilters}
            onClearSearch={onClearSearch}
            onClearFilters={onClearFilters}
          />
        </div>
      ) : (
        <div className="max-h-[650px] overflow-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
              <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-6 py-4">
                  Employee ID
                </th>
                <th scope="col" className="px-6 py-4">
                  Full Name
                </th>
                <th scope="col" className="px-6 py-4">
                  Company
                </th>
                <th scope="col" className="px-6 py-4">
                  Status
                </th>
                <th scope="col" className="px-6 py-4">
                  Compliance
                </th>
                <th scope="col" className="px-6 py-4 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {safeEmployees.map((employee, index) => {
                const employeeId = getEmployeeId(employee);
                const employeeName = getEmployeeDisplayName(employee);
                const employeeCompany = getEmployeeCompany(employee);

                const complianceStatus = normalizeComplianceStatus(
                  complianceResolver(employee?.documents)
                );

                return (
                  <tr
                    key={getEmployeeKey(employee, index)}
                    className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-white/5"
                  >
                    <td className="whitespace-nowrap px-6 py-4 align-middle">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                        {employeeId}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 align-middle">
                      <div className="min-w-0">
                        <p
                          title={employeeName}
                          className="max-w-[260px] truncate font-semibold text-gray-900 dark:text-white"
                        >
                          {employeeName}
                        </p>

                        {employee?.position && (
                          <p
                            title={employee.position}
                            className="mt-1 max-w-[260px] truncate text-xs text-gray-500 dark:text-gray-400"
                          >
                            {employee.position}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 align-middle">
                      <p
                        title={employeeCompany}
                        className="max-w-[240px] truncate text-sm font-semibold text-gray-700 dark:text-gray-300"
                      >
                        {employeeCompany}
                      </p>
                    </td>

                    <td className="px-6 py-4 align-middle">
                      <StatusBadge
                        status={employee?.status || "Floating / Standby"}
                      />
                    </td>

                    <td className="px-6 py-4 align-middle">
                      <ComplianceBadge status={complianceStatus} />
                    </td>

                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          label={`View ${employeeName}`}
                          title="View Employee"
                          variant="primary"
                          size="md"
                          onClick={() => openModal?.(employee)}
                        >
                          <FiEye aria-hidden="true" />
                        </IconButton>

                        {canEdit && (
                          <IconButton
                            label={`Edit ${employeeName}`}
                            title="Edit Employee"
                            variant="secondary"
                            size="md"
                            onClick={() => onEdit(employee)}
                          >
                            <FiEdit2 aria-hidden="true" />
                          </IconButton>
                        )}

                        {canArchive && (
                          <IconButton
                            label={`Archive ${employeeName}`}
                            title="Archive Employee"
                            variant="warning"
                            size="md"
                            onClick={() => onArchive(employee)}
                          >
                            <FiArchive aria-hidden="true" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}