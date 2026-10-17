import {
  FiArchive,
  FiBriefcase,
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
  return (
    COMPLIANCE_STATUS_ALIASES[value] ||
    value ||
    "No Data"
  );
}
function getEmployeeId(employee) {
  return (
    employee?.id ||
    employee?.employeeId ||
    employee?.employee_id ||
    "-"
  );
}

function formatEmployeeId(value) {
  return String(value ?? "-")
    .trim()
    .replace(/^EMP[-\s]*/i, "")
    .replace(/^KPI-/i, "") || "-";
}
function getEmployeePosition(employee) {
  return String(
    employee?.position ||
      employee?.jobPosition ||
      employee?.job_position ||
      employee?.positionName ||
      employee?.position_name ||
      ""
  ).trim();
}

function getEmployeeWorkforceStatus(
  employee
) {
  const status =
    String(
      employee?.workforceStatus ||
      employee?.workforce_status ||
      employee?.status ||
      ""
    ).trim();

  return [
    "Floating / Standby",
    "For Deployment",
    "Deployed",
  ].includes(
    status
  )
    ? status
    : "Floating / Standby";
}

function getPlacementContextLabel(
  workforceStatus,
  field
) {
  if (
    workforceStatus ===
    "Deployed"
  ) {
    return field ===
      "Position"
      ? "Position"
      : "";
  }

  if (
    workforceStatus ===
    "For Deployment"
  ) {
    return `Scheduled ${field}`;
  }

  return `Designated ${field}`;
}

function getWorkforceStatusNote(
  workforceStatus
) {
  if (
    workforceStatus ===
    "Deployed"
  ) {
    return "Active deployment";
  }

  if (
    workforceStatus ===
    "For Deployment"
  ) {
    return "Awaiting arrival";
  }

  return "Pooling";
}

function getPlacementDisplayValue(
  value,
  fallback
) {
  const normalized =
    String(
      value || ""
    ).trim();

  if (
    !normalized ||
    normalized ===
      "Not Assigned"
  ) {
    return fallback;
  }

  return normalized;
}
function getEmployeeKey(
  employee,
  index
) {
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

  const canClearSearch =
    typeof onClearSearch === "function";

  const canClearFilters =
    typeof onClearFilters === "function";

  if (search) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="search"
          title="No employee matched your search"
          description={`No employee matched “${search}”. Try another name, employee number, client company, or position.`}
        />

        <div className="flex flex-wrap justify-center gap-2">
          {canClearSearch && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={
                <FiSearch aria-hidden="true" />
              }
              onClick={onClearSearch}
            >
              Clear Search
            </Button>
          )}

          {hasFilters && canClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={
                <FiSliders aria-hidden="true" />
              }
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
          title="No employees match these filters"
          description="Employee records are available, but none match the selected workforce, compliance, or position filters."
        />

        {canClearFilters && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={
                <FiSliders aria-hidden="true" />
              }
              onClick={onClearFilters}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (totalRecords === 0) {
    return (
      <EmptyState
        icon="employees"
        title="No active employee records"
        description="No active employee records are currently available in this workforce view."
      />
    );
  }

  return (
    <EmptyState
      icon="employees"
      title="No employees available"
      description="No employee records are available on this page."
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
  onDeploymentAction,
  getComplianceStatus,
  onArchive,
  isSuperAdmin = false,
  isHRManager = false,
  isHRCoordinator = false,
}) {
  const safeEmployees =
    Array.isArray(
      employees
    )
      ? employees
      : [];
  const numericTotalRecords =
    Number(
      totalRecords
    );
  const safeTotalRecords =
    Number.isFinite(
      numericTotalRecords
    )
      ? numericTotalRecords
      : safeEmployees.length;
  const complianceResolver =
    typeof getComplianceStatus ===
    "function"
      ? getComplianceStatus
      : getDefaultComplianceStatus;
  /*
   * ==================================================
   * EMPLOYEE TABLE ACCESS
   * ==================================================
   *
   * HR STAFF:
   * - may receive Edit action from Employees.jsx
   * - may receive contextual Deployment action:
   *   Floating / Standby -> Schedule for Deployment
   *   For Deployment -> View Deployment Schedule
   *
   * HR MANAGER:
   * - no routine employee editing
   * - may receive Archive action
   *
   * SUPER ADMIN / HR COORDINATOR:
   * - view only
   *
   * Employees.jsx remains the primary role gate. These
   * checks are defense in depth for table actions.
   */
  const isReadOnlyEmployeeMaintenance =
    isSuperAdmin ||
    isHRManager ||
    isHRCoordinator;

  const canEdit =
    !isReadOnlyEmployeeMaintenance &&
    typeof onEdit ===
      "function";

  const canArchive =
    isHRManager &&
    typeof onArchive ===
      "function";

  const canUseDeploymentAction =
    !isReadOnlyEmployeeMaintenance &&
    typeof onDeploymentAction ===
      "function";

  const recordCountLabel =
    safeTotalRecords >
    safeEmployees.length
      ? `${safeEmployees.length} of ${safeTotalRecords} records`
      : `${safeEmployees.length} ${
          safeEmployees.length ===
          1
            ? "record"
            : "records"
        }`;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            <FiUsers
              aria-hidden="true"
              className="shrink-0 text-slate-500 dark:text-slate-400"
            />
            Employee Records
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {isHRCoordinator
              ? "View assigned-company Deployed and For Deployment employees, positions, workforce status, and compliance status."
              : "View registered employees, workforce status, client company assignment, and compliance status."}
          </p>
        </div>
        <span
          aria-label={
            recordCountLabel
          }
          className="w-fit rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {recordCountLabel}
        </span>
      </div>
      {safeEmployees.length ===
      0 ? (
        <div className="p-5 sm:p-6">
          <EmployeeEmptyState
            totalRecords={
              safeTotalRecords
            }
            searchQuery={
              searchQuery
            }
            hasFilters={
              hasFilters
            }
            onClearSearch={
              onClearSearch
            }
            onClearFilters={
              onClearFilters
            }
          />
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(51,65,85,1)]">
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th
                  scope="col"
                  className="px-5 py-3.5"
                >
                  Employee ID
                </th>
                <th
                  scope="col"
                  className="px-5 py-3.5"
                >
                  Full Name
                </th>
                <th
                  scope="col"
                  className="px-5 py-3.5"
                >
                  {isHRCoordinator ? "Position" : "Company"}
                </th>
                <th
                  scope="col"
                  className="px-5 py-3.5"
                >
                  Workforce Status
                </th>
                <th
                  scope="col"
                  className="px-5 py-3.5"
                >
                  Compliance
                </th>
                <th
                  scope="col"
                  className="px-5 py-3.5 text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {safeEmployees.map(
                (
                  employee,
                  index
                ) => {
                  const employeeId =
                    getEmployeeId(
                      employee
                    );
                  const employeeName =
                    getEmployeeDisplayName(
                      employee
                    );
                  const workforceStatus =
                    getEmployeeWorkforceStatus(
                      employee
                    );

                  const employeeCompany =
                    getPlacementDisplayValue(
                      getEmployeeCompany(
                        employee
                      ),
                      "No company recorded"
                    );

                  const employeePosition =
                    getPlacementDisplayValue(
                      getEmployeePosition(
                        employee
                      ),
                      "No position recorded"
                    );

                  const companyContextLabel =
                    getPlacementContextLabel(
                      workforceStatus,
                      "Company"
                    );

                  const positionContextLabel =
                    getPlacementContextLabel(
                      workforceStatus,
                      "Position"
                    );

                  const workforceStatusNote =
                    getWorkforceStatusNote(
                      workforceStatus
                    );

                  const canShowDeploymentAction =
                    canUseDeploymentAction &&
                    [
                      "Floating / Standby",
                      "For Deployment",
                    ].includes(
                      workforceStatus
                    );

                  const deploymentActionTitle =
                    workforceStatus ===
                    "For Deployment"
                      ? "View deployment schedule"
                      : "Schedule for deployment";

                  const deploymentActionLabel =
                    workforceStatus ===
                    "For Deployment"
                      ? `View deployment schedule for ${employeeName}`
                      : `Schedule ${employeeName} for deployment`;

                  const complianceStatus =
                    normalizeComplianceStatus(
                      employee
                        ?.complianceStatus ||
                        complianceResolver(
                          employee
                            ?.documents
                        )
                    );
                  return (
                    <tr
                      key={getEmployeeKey(
                        employee,
                        index
                      )}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/45"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 align-middle">
                        <span
                          className="inline-flex min-w-11 items-center justify-center rounded-xl bg-indigo-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                          title={`Employee number ${formatEmployeeId(employeeId)}`}
                        >
                          {formatEmployeeId(employeeId)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 align-middle">
                        <div className="min-w-0">
                          <p
                            title={
                              employeeName
                            }
                            className="max-w-[260px] truncate font-semibold text-slate-900 dark:text-slate-100"
                          >
                            {
                              employeeName
                            }
                          </p>
                          {!isHRCoordinator && (
                            <p
                              title={`${positionContextLabel}: ${employeePosition}`}
                              className="mt-1 max-w-[260px] truncate text-xs text-slate-500 dark:text-slate-400"
                            >
                              <span className="font-semibold">
                                {positionContextLabel}:
                              </span>{" "}
                              {employeePosition}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <div className="min-w-0">
                          <p
                            title={
                              isHRCoordinator
                                ? employeePosition
                                : employeeCompany
                            }
                            className="max-w-[240px] truncate text-sm font-medium text-slate-700 dark:text-slate-300"
                          >
                            {isHRCoordinator
                              ? employeePosition
                              : employeeCompany}
                          </p>

                          {(isHRCoordinator
                            ? positionContextLabel
                            : companyContextLabel) && (
                            <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                              {isHRCoordinator
                                ? positionContextLabel
                                : companyContextLabel}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <div className="min-w-0">
                          <StatusBadge
                            status={
                              workforceStatus
                            }
                          />

                          <p className="mt-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {
                              workforceStatusNote
                            }
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <ComplianceBadge
                          status={
                            complianceStatus
                          }
                        />
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <IconButton
                            label={`View ${employeeName}`}
                            title="View employee details"
                            variant="secondary"
                            size="md"
                            onClick={() =>
                              openModal?.(
                                employee
                              )
                            }
                          >
                            <FiEye
                              aria-hidden="true"
                            />
                          </IconButton>
                          {canEdit && (
                            <IconButton
                              label={`Edit ${employeeName}`}
                              title="Edit employee record"
                              variant="secondary"
                              size="md"
                              onClick={() =>
                                onEdit(
                                  employee
                                )
                              }
                            >
                              <FiEdit2
                                aria-hidden="true"
                              />
                            </IconButton>
                          )}
                          {canShowDeploymentAction && (
                            <IconButton
                              label={
                                deploymentActionLabel
                              }
                              title={
                                deploymentActionTitle
                              }
                              variant="secondary"
                              size="md"
                              onClick={() =>
                                onDeploymentAction(
                                  employee
                                )
                              }
                            >
                              <FiBriefcase
                                aria-hidden="true"
                              />
                            </IconButton>
                          )}
                          {canArchive && (
                            <IconButton
                              label={`Archive ${employeeName}`}
                              title="Archive employee record"
                              variant="warning"
                              size="md"
                              onClick={() =>
                                onArchive(
                                  employee
                                )
                              }
                            >
                              <FiArchive
                                aria-hidden="true"
                              />
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}