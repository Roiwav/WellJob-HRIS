import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiEye,
  FiRefreshCw,
  FiRotateCcw,
  FiTrash2,
} from "react-icons/fi";
import axios from "axios";

import EmployeeModal from "../components/employees/EmployeeModal";
import ComplianceBadge from "../components/employees/ComplianceBadge";
import EmployeeStatusBadge from "../components/employees/StatusBadge";

import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import FilterBar from "../components/ui/FilterBar";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import SuccessToast from "../components/ui/SuccessToast";
import ConfirmDialog from "../components/ui/ConfirmDialog";

import {
  getComplianceStatus,
  getEmployeeCompany,
  getEmployeeDisplayName,
  matchesEmployeeSearch,
  normalizeEmployeeStatus,
} from "../utils/employees/employeeHelpers";
import {
  EMPLOYEE_API_URL,
  getEmployeeApiError,
  parseEmployeeDocuments,
} from "../utils/employees/employeeFormHelpers";

const DATA_EVENT_SOURCE = "archived-employees-page";
const REQUEST_TIMEOUT_MS = 15000;

function emitDataUpdated(action) {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: DATA_EVENT_SOURCE,
        domain: "employees",
        action,
        at: Date.now(),
      },
    })
  );
}

function getEmployeeId(employee) {
  return String(
    employee?.id || employee?.employeeId || employee?.employee_id || ""
  );
}

function isArchivedEmployee(employee) {
  return (
    employee?.archived === true ||
    Number(employee?.archived) === 1 ||
    normalizeEmployeeStatus(employee?.status) === "Inactive"
  );
}

function normalizeArchivedEmployee(employee) {
  return {
    ...employee,
    documents: parseEmployeeDocuments(employee?.documents),
  };
}

function getEmployeeKey(employee, index) {
  return employee?.uid || getEmployeeId(employee) || `archived-employee-${index}`;
}

export default function ArchivedEmployees() {
  const navigate = useNavigate();

  const [archivedEmployees, setArchivedEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [viewEmployee, setViewEmployee] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingAction, setProcessingAction] = useState("");

  const isProcessing = Boolean(processingAction);

  const fetchArchivedEmployees = useCallback(
    async ({ showInitialLoading = false, showRefreshing = false } = {}) => {
      if (showInitialLoading) setIsLoading(true);
      if (showRefreshing) setIsRefreshing(true);

      try {
        setErrorMessage("");

        const response = await axios.get(EMPLOYEE_API_URL, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { Accept: "application/json" },
        });

        const employees = Array.isArray(response.data) ? response.data : [];
        setArchivedEmployees(
          employees.filter(isArchivedEmployee).map(normalizeArchivedEmployee)
        );

        return true;
      } catch (error) {
        console.error("Error fetching archived employees:", error);
        setErrorMessage(
          getEmployeeApiError(error, "Unable to fetch archived employees.")
        );
        return false;
      } finally {
        if (showInitialLoading) setIsLoading(false);
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchArchivedEmployees({ showInitialLoading: true });
  }, [fetchArchivedEmployees]);

  useEffect(() => {
    const handleDataUpdated = (event) => {
      if (event?.detail?.source !== DATA_EVENT_SOURCE) {
        void fetchArchivedEmployees();
      }
    };

    window.addEventListener("dataUpdated", handleDataUpdated);
    return () => window.removeEventListener("dataUpdated", handleDataUpdated);
  }, [fetchArchivedEmployees]);

  const filteredArchivedEmployees = useMemo(
    () =>
      archivedEmployees.filter((employee) =>
        matchesEmployeeSearch(employee, search)
      ),
    [archivedEmployees, search]
  );

  const removeArchivedEmployee = useCallback((employeeId) => {
    setArchivedEmployees((currentEmployees) =>
      currentEmployees.filter(
        (employee) => getEmployeeId(employee) !== String(employeeId)
      )
    );
  }, []);

  const handleRefresh = useCallback(() => {
    return fetchArchivedEmployees({ showRefreshing: true });
  }, [fetchArchivedEmployees]);

  const handleRestore = useCallback(async () => {
    const employeeId = getEmployeeId(restoreTarget);
    if (!employeeId || isProcessing) return;

    const employeeName = getEmployeeDisplayName(restoreTarget);

    try {
      setProcessingAction("restore");
      setErrorMessage("");

      await axios.put(
        `${EMPLOYEE_API_URL}/restore/${encodeURIComponent(employeeId)}`,
        {},
        { timeout: REQUEST_TIMEOUT_MS }
      );

      removeArchivedEmployee(employeeId);
      setRestoreTarget(null);
      setSuccessMessage(`${employeeName} was restored successfully.`);
      emitDataUpdated("RESTORE_EMPLOYEE");
    } catch (error) {
      console.error("Error restoring employee:", error);
      setErrorMessage(
        getEmployeeApiError(error, "Failed to restore the employee.")
      );
    } finally {
      setProcessingAction("");
    }
  }, [isProcessing, removeArchivedEmployee, restoreTarget]);

  const handleDelete = useCallback(async () => {
    const employeeId = getEmployeeId(deleteTarget);
    if (!employeeId || isProcessing) return;

    const employeeName = getEmployeeDisplayName(deleteTarget);

    try {
      setProcessingAction("delete");
      setErrorMessage("");

      await axios.delete(
        `${EMPLOYEE_API_URL}/${encodeURIComponent(employeeId)}`,
        { timeout: REQUEST_TIMEOUT_MS }
      );

      removeArchivedEmployee(employeeId);
      setDeleteTarget(null);
      setSuccessMessage(`${employeeName} was permanently deleted.`);
      emitDataUpdated("DELETE_EMPLOYEE");
    } catch (error) {
      console.error("Error deleting employee:", error);
      setErrorMessage(
        getEmployeeApiError(
          error,
          "Failed to permanently delete the employee."
        )
      );
    } finally {
      setProcessingAction("");
    }
  }, [deleteTarget, isProcessing, removeArchivedEmployee]);

  const closeRestoreDialog = () => {
    if (!isProcessing) setRestoreTarget(null);
  };

  const closeDeleteDialog = () => {
    if (!isProcessing) setDeleteTarget(null);
  };

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Employee Records"
        title="Archived Employees"
        description="View, restore, or permanently delete inactive employee records."
        icon={<FiTrash2 size={22} />}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<FiArrowLeft />}
              onClick={() => navigate("/employees")}
            >
              Back to Employees
            </Button>

            <Button
              variant="secondary"
              leftIcon={<FiRefreshCw />}
              loading={isRefreshing}
              disabled={isLoading || isRefreshing || isProcessing}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </>
        }
      />

      <FilterBar
        resultCount={filteredArchivedEmployees.length}
        resultLabel="archived employee"
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={!search.trim() || isLoading || isRefreshing || isProcessing}
            onClick={() => setSearch("")}
          >
            Clear Search
          </Button>
        }
      >
        <div className="w-full sm:col-span-2 xl:w-96">
          <SearchInput
            label="Search archived employees"
            hideLabel
            placeholder="Search by name, ID, company, or position..."
            value={search}
            disabled={isLoading || isRefreshing || isProcessing}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
      </FilterBar>

      {errorMessage && (
        <ErrorState
          compact
          title="Archived employee data error"
          message={errorMessage}
          retryLabel="Reload archived employees"
          onRetry={handleRefresh}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={5} columns={6} showHeader />
      ) : (
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Archived Records
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Records removed from the active employee management list.
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {filteredArchivedEmployees.length}{" "}
              {filteredArchivedEmployees.length === 1 ? "record" : "records"}
            </span>
          </div>

          {filteredArchivedEmployees.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={search.trim() ? "search" : "records"}
                title={
                  search.trim()
                    ? "No archived employees found"
                    : "No archived employees"
                }
                description={
                  search.trim()
                    ? "No archived employee records matched your search."
                    : "Employees archived by HR will appear here."
                }
                secondaryActionLabel={search.trim() ? "Clear search" : ""}
                onSecondaryAction={search.trim() ? () => setSearch("") : undefined}
              />
            </div>
          ) : (
            <div className="max-h-[650px] overflow-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                  <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th scope="col" className="px-6 py-4">Employee ID</th>
                    <th scope="col" className="px-6 py-4">Full Name</th>
                    <th scope="col" className="px-6 py-4">Company</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4">Compliance</th>
                    <th scope="col" className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredArchivedEmployees.map((employee, index) => {
                    const employeeId = getEmployeeId(employee);
                    const employeeName = getEmployeeDisplayName(employee);
                    const employeeCompany = getEmployeeCompany(employee);
                    const complianceStatus = getComplianceStatus(employee.documents);

                    return (
                      <tr
                        key={getEmployeeKey(employee, index)}
                        className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-white/5"
                      >
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            {employeeId || "-"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
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

                        <td className="px-6 py-4">
                          <p
                            title={employeeCompany}
                            className="max-w-[240px] truncate text-sm font-semibold text-gray-700 dark:text-gray-300"
                          >
                            {employeeCompany}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <EmployeeStatusBadge status="Inactive" size="md" />
                        </td>

                        <td className="px-6 py-4">
                          <ComplianceBadge status={complianceStatus} />
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <IconButton
                              label={`View ${employeeName}`}
                              title="View Employee"
                              variant="primary"
                              size="md"
                              disabled={isProcessing}
                              onClick={() => setViewEmployee(employee)}
                            >
                              <FiEye aria-hidden="true" />
                            </IconButton>

                            <IconButton
                              label={`Restore ${employeeName}`}
                              title="Restore Employee"
                              variant="success"
                              size="md"
                              disabled={isProcessing}
                              onClick={() => {
                                setErrorMessage("");
                                setRestoreTarget(employee);
                              }}
                            >
                              <FiRotateCcw aria-hidden="true" />
                            </IconButton>

                            <IconButton
                              label={`Permanently delete ${employeeName}`}
                              title="Permanently Delete Employee"
                              variant="danger"
                              size="md"
                              disabled={isProcessing}
                              onClick={() => {
                                setErrorMessage("");
                                setDeleteTarget(employee);
                              }}
                            >
                              <FiTrash2 aria-hidden="true" />
                            </IconButton>
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
      )}

      {viewEmployee && (
        <EmployeeModal
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title="Restore Employee"
        tone="success"
        confirmLabel="Restore Employee"
        cancelLabel="Cancel"
        loading={processingAction === "restore"}
        disabled={!getEmployeeId(restoreTarget)}
        closeOnBackdrop={!isProcessing}
        onClose={closeRestoreDialog}
        onConfirm={handleRestore}
      >
        <p>
          Are you sure you want to restore{" "}
          <strong className="font-bold text-gray-900 dark:text-white">
            {getEmployeeDisplayName(restoreTarget)}
          </strong>
          ?
        </p>
        <p className="mt-2">
          The employee will return to the active employee management table.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Permanently Delete Employee"
        tone="danger"
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        loading={processingAction === "delete"}
        disabled={!getEmployeeId(deleteTarget)}
        closeOnBackdrop={!isProcessing}
        onClose={closeDeleteDialog}
        onConfirm={handleDelete}
      >
        <p>
          Are you sure you want to permanently delete{" "}
          <strong className="font-bold text-gray-900 dark:text-white">
            {getEmployeeDisplayName(deleteTarget)}
          </strong>
          ?
        </p>
        <p className="mt-2 font-semibold text-red-600 dark:text-red-300">
          This action cannot be undone, and the employee record may no longer
          be recoverable.
        </p>
      </ConfirmDialog>

      {successMessage && (
        <SuccessToast
          title="Archived employee updated"
          message={successMessage}
          duration={3500}
          onClose={() => setSuccessMessage("")}
        />
      )}
    </main>
  );
}