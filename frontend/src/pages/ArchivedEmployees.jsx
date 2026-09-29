import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
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
} from "../utils/employees/employeeHelpers";
import {
  EMPLOYEE_API_URL,
  getEmployeeApiError,
} from "../utils/employees/employeeFormHelpers";
const DATA_EVENT_SOURCE = "archived-employees-page";
const REQUEST_TIMEOUT_MS = 15000;
const ARCHIVED_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;
const ARCHIVED_REFRESH_DOMAINS = new Set([
  "employee",
  "employees",
]);
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
function getArchivedComplianceStatus(employee) {
  return (
    employee?.complianceStatus ||
    employee?.compliance_status ||
    getComplianceStatus(employee?.documents)
  );
}
function shouldRefreshArchivedEmployees(event) {
  if (event?.detail?.source === DATA_EVENT_SOURCE) {
    return false;
  }
  const domain = String(event?.detail?.domain || "")
    .trim()
    .toLowerCase();
  return ARCHIVED_REFRESH_DOMAINS.has(domain);
}
function getEmployeeKey(employee, index) {
  return employee?.uid || getEmployeeId(employee) || `archived-employee-${index}`;
}
export default function ArchivedEmployees() {
  const navigate = useNavigate();
  const [archivedEmployees, setArchivedEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: ARCHIVED_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    activeTotal: 0,
  });
  const [viewEmployee, setViewEmployee] = useState(null);
  const [viewLoadingId, setViewLoadingId] = useState("");
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingAction, setProcessingAction] = useState("");
  const fetchRequestIdRef = useRef(0);
  const isProcessing = Boolean(processingAction);
  const fetchArchivedEmployees = useCallback(
    async ({ showInitialLoading = false, showRefreshing = false } = {}) => {
      const requestId = fetchRequestIdRef.current + 1;
      fetchRequestIdRef.current = requestId;
      if (showInitialLoading) setIsLoading(true);
      if (showRefreshing) setIsRefreshing(true);
      try {
        setErrorMessage("");
        const response = await axios.get(EMPLOYEE_API_URL, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { Accept: "application/json" },
          params: {
            view: "summary",
            scope: "archived",
            page,
            pageSize: ARCHIVED_PAGE_SIZE,
            search: debouncedSearch,
            sort: "latest",
          },
        });
        if (requestId !== fetchRequestIdRef.current) {
          return false;
        }
        const employees = Array.isArray(response.data?.employees)
          ? response.data.employees
          : [];
        const responsePagination = response.data?.pagination || {};
        setArchivedEmployees(employees);
        setPagination({
          page: Number(responsePagination.page) || page,
          pageSize:
            Number(responsePagination.pageSize) || ARCHIVED_PAGE_SIZE,
          total: Number(responsePagination.total) || 0,
          totalPages: Number(responsePagination.totalPages) || 0,
          activeTotal: Number(responsePagination.activeTotal) || 0,
        });
        return true;
      } catch (error) {
        if (requestId !== fetchRequestIdRef.current) {
          return false;
        }
        console.error("Error fetching archived employees:", error);
        setErrorMessage(
          getEmployeeApiError(error, "Unable to fetch archived employees.")
        );
        return false;
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          if (showInitialLoading) setIsLoading(false);
          if (showRefreshing) setIsRefreshing(false);
        }
      }
    },
    [debouncedSearch, page]
  );
  useEffect(() => {
    void fetchArchivedEmployees({ showInitialLoading: true });
  }, [fetchArchivedEmployees]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const handleDataUpdated = (event) => {
      if (shouldRefreshArchivedEmployees(event)) {
        void fetchArchivedEmployees();
      }
    };
    window.addEventListener("dataUpdated", handleDataUpdated);
    return () => window.removeEventListener("dataUpdated", handleDataUpdated);
  }, [fetchArchivedEmployees]);
  const removeArchivedEmployee = useCallback((employeeId) => {
    setArchivedEmployees((currentEmployees) =>
      currentEmployees.filter(
        (employee) => getEmployeeId(employee) !== String(employeeId)
      )
    );
    setPagination((currentPagination) => {
      const total = Math.max(0, currentPagination.total - 1);
      return {
        ...currentPagination,
        total,
        totalPages:
          total > 0
            ? Math.ceil(total / currentPagination.pageSize)
            : 0,
      };
    });
  }, []);
  const handleViewEmployee = useCallback(
    async (employee) => {
      const employeeId = getEmployeeId(employee);
      if (!employeeId || viewLoadingId) {
        return;
      }
      try {
        setViewLoadingId(employeeId);
        setErrorMessage("");
        const response = await axios.get(
          `${EMPLOYEE_API_URL}/${encodeURIComponent(employeeId)}`,
          {
            timeout: REQUEST_TIMEOUT_MS,
            headers: { Accept: "application/json" },
          }
        );
        setViewEmployee(response.data || null);
      } catch (error) {
        console.error("Error loading archived employee details:", error);
        setErrorMessage(
          getEmployeeApiError(
            error,
            "Unable to load the archived employee details."
          )
        );
      } finally {
        setViewLoadingId("");
      }
    },
    [viewLoadingId]
  );
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
        resultCount={pagination.total}
        resultLabel="archived employee"
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={!search.trim() || isLoading || isRefreshing || isProcessing}
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
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
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearch("");
              setPage(1);
            }}
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
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Archived Records
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Records removed from the active employee management list.
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {pagination.total}{" "}
              {pagination.total === 1 ? "record" : "records"}
            </span>
          </div>
          {archivedEmployees.length === 0 ? (
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
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgba(226,232,240,1)] backdrop-blur dark:bg-slate-800/95 dark:shadow-[0_1px_0_0_rgba(51,65,85,1)]">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400">
                    <th scope="col" className="w-[120px] px-4 py-3">Employee ID</th>
                    <th scope="col" className="min-w-[220px] px-4 py-3">Full Name</th>
                    <th scope="col" className="w-[220px] px-4 py-3">Company</th>
                    <th scope="col" className="w-[150px] px-4 py-3">Status</th>
                    <th scope="col" className="w-[160px] px-4 py-3">Compliance</th>
                    <th scope="col" className="w-[150px] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {archivedEmployees.map((employee, index) => {
                    const employeeId = getEmployeeId(employee);
                    const employeeName = getEmployeeDisplayName(employee);
                    const employeeCompany = getEmployeeCompany(employee);
                    const complianceStatus =
                      getArchivedComplianceStatus(employee);
                    return (
                      <tr
                        key={getEmployeeKey(employee, index)}
                        className="align-middle transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/45"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex min-w-[44px] items-center justify-center rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {employeeId || "-"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="min-w-0">
                            <p
                              title={employeeName}
                              className="max-w-[240px] truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                            >
                              {employeeName}
                            </p>
                            {employee?.position && (
                              <p
                                title={employee.position}
                                className="mt-0.5 max-w-[240px] truncate text-xs text-slate-500 dark:text-slate-400"
                              >
                                {employee.position}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p
                            title={employeeCompany}
                            className="max-w-[210px] truncate text-sm font-medium text-slate-700 dark:text-slate-300"
                          >
                            {employeeCompany}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <EmployeeStatusBadge status="Inactive" size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <ComplianceBadge status={complianceStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <IconButton
                              label={`View ${employeeName}`}
                              title="View Employee"
                              variant="secondary"
                              size="sm"
                              disabled={
                                isProcessing || Boolean(viewLoadingId)
                              }
                              onClick={() => void handleViewEmployee(employee)}
                            >
                              {viewLoadingId === employeeId ? (
                                <FiRefreshCw
                                  aria-hidden="true"
                                  className="animate-spin"
                                />
                              ) : (
                                <FiEye aria-hidden="true" />
                              )}
                            </IconButton>
                            <IconButton
                              label={`Restore ${employeeName}`}
                              title="Restore Employee"
                              variant="secondary"
                              size="sm"
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
                              size="sm"
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
          {pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {pagination.page} of {pagination.totalPages} ·{" "}
                {pagination.total} archived{" "}
                {pagination.total === 1 ? "employee" : "employees"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    isLoading ||
                    isRefreshing ||
                    isProcessing ||
                    page <= 1
                  }
                  onClick={() =>
                    setPage((currentPage) =>
                      Math.max(1, currentPage - 1)
                    )
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    isLoading ||
                    isRefreshing ||
                    isProcessing ||
                    page >= pagination.totalPages
                  }
                  onClick={() =>
                    setPage((currentPage) =>
                      Math.min(
                        pagination.totalPages,
                        currentPage + 1
                      )
                    )
                  }
                >
                  Next
                </Button>
              </div>
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
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Restore this employee record to the active employee list?
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Employee
            </p>
            <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
              {getEmployeeDisplayName(restoreTarget)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Employee ID: {getEmployeeId(restoreTarget) || "-"}
            </p>
          </div>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            The record will return to Employee Management and can be updated or managed normally again.
          </p>
        </div>
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
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
            <div className="flex items-start gap-3">
              <FiAlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-300"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
                  This action cannot be undone.
                </p>
                <p className="mt-1 text-xs leading-5 text-rose-700 dark:text-rose-300">
                  Permanently deleting this record may remove access to its employee information and related history.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Employee to delete
            </p>
            <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
              {getEmployeeDisplayName(deleteTarget)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Employee ID: {getEmployeeId(deleteTarget) || "-"}
            </p>
          </div>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Continue only if this employee record should no longer be retained in the archived records.
          </p>
        </div>
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