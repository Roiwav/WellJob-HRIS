import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import {
  FiArchive,
  FiPlus,
  FiRotateCcw,
  FiUsers,
} from "react-icons/fi";
import axios from "axios";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import AddEmployeeModal from "../components/employees/AddEmployeeModal";
import EditEmployeeModal from "../components/employees/EditEmployeeModal";
import EmployeeModal from "../components/employees/EmployeeModal";
import EmployeeTable from "../components/employees/EmployeeTable";

import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ErrorState from "../components/ui/ErrorState";
import FilterBar from "../components/ui/FilterBar";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import SuccessToast from "../components/ui/SuccessToast";

import {
  EMPLOYEE_API_URL,
  getEmployeeApiError,
  parseEmployeeDocuments,
} from "../utils/employees/employeeFormHelpers";

import {
  COMPLIANCE_OPTIONS,
  EMPLOYEE_SORT_OPTIONS,
  EMPLOYEE_STATUS_OPTIONS,
  getComplianceStatus,
  hasActiveEmployeeFilters,
} from "../utils/employees/employeeHelpers";

const DATA_EVENT_SOURCE = "employees-page";
const REQUEST_TIMEOUT_MS = 45 * 1000;
const DATA_UPDATE_DEBOUNCE_MS = 300;
const SEARCH_DEBOUNCE_MS = 350;
const EMPLOYEE_PAGE_SIZE = 50;

const EMPLOYEE_REFRESH_DOMAINS = new Set([
  "employees",
  "employee",
  "deployments",
  "deployment",
]);

const ACTIVE_STATUS_OPTIONS = EMPLOYEE_STATUS_OPTIONS.filter(
  ({ value }) => value !== "Inactive"
);

const SELECT_CLASS_NAME =
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 " +
  "text-sm text-gray-900 shadow-sm outline-none transition " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white " +
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 " +
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500";

function getAuthenticatedHeaders(additionalHeaders = {}) {
  const token = String(localStorage.getItem("token") || "").trim();

  return {
    Accept: "application/json",
    ...additionalHeaders,
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

function emitDataUpdated(action = "EMPLOYEES_UPDATED") {
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

function shouldRefreshEmployees(event) {
  const detail = event?.detail || {};

  if (detail.source === DATA_EVENT_SOURCE) {
    return false;
  }

  const domain = String(detail.domain || "")
    .trim()
    .toLowerCase();

  if (!domain) {
    return true;
  }

  return EMPLOYEE_REFRESH_DOMAINS.has(domain);
}

function getEmployeeId(employee) {
  return String(
    employee?.id ||
      employee?.employeeId ||
      employee?.employee_id ||
      ""
  );
}

function getEmployeeName(employee) {
  return String(
    employee?.name ||
      employee?.full_name ||
      employee?.fullName ||
      getEmployeeId(employee) ||
      "the employee"
  ).trim();
}

function normalizeEmployee(employee = {}) {
  return {
    ...employee,
    documents: parseEmployeeDocuments(employee.documents),
  };
}

function isCanceledRequest(error) {
  return (
    error?.code === "ERR_CANCELED" ||
    error?.name === "CanceledError" ||
    error?.name === "AbortError"
  );
}

function normalizePagination(pagination = {}, fallbackPage = 1) {
  const page =
    Number.parseInt(String(pagination?.page ?? fallbackPage), 10) ||
    fallbackPage;

  const pageSize =
    Number.parseInt(
      String(pagination?.pageSize ?? EMPLOYEE_PAGE_SIZE),
      10
    ) || EMPLOYEE_PAGE_SIZE;

  const total = Math.max(Number(pagination?.total || 0), 0);
  const activeTotal = Math.max(
    Number(pagination?.activeTotal || 0),
    0
  );

  const totalPages =
    Number.parseInt(String(pagination?.totalPages ?? ""), 10) ||
    (total > 0 ? Math.ceil(total / pageSize) : 0);

  return {
    page: Math.max(page, 1),
    pageSize: Math.max(pageSize, 1),
    total,
    totalPages: Math.max(totalPages, 0),
    activeTotal,
  };
}

function SelectFilter({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
  className = "xl:w-52",
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASS_NAME}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isHRManager = user?.role === "HR_MANAGER";

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState(() =>
    normalizePagination(
      {
        page: 1,
        pageSize: EMPLOYEE_PAGE_SIZE,
      },
      1
    )
  );
  const [page, setPage] = useState(1);

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [generatedId, setGeneratedId] = useState("");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCompliance, setFilterCompliance] = useState("All");
  const [sortBy, setSortBy] = useState("latest");

  const [successMessage, setSuccessMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isRefreshingEmployees, setIsRefreshingEmployees] =
    useState(false);
  const [isOpeningAddEmployee, setIsOpeningAddEmployee] =
    useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const isMountedRef = useRef(true);
  const dataUpdateTimerRef = useRef(null);
  const searchDebounceTimerRef = useRef(null);
  const employeeListAbortRef = useRef(null);
  const employeeDetailAbortRef = useRef(null);
  const employeeFormMetaAbortRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (dataUpdateTimerRef.current) {
        window.clearTimeout(dataUpdateTimerRef.current);
      }

      if (searchDebounceTimerRef.current) {
        window.clearTimeout(searchDebounceTimerRef.current);
      }

      employeeListAbortRef.current?.abort();
      employeeDetailAbortRef.current?.abort();
      employeeFormMetaAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (searchDebounceTimerRef.current) {
      window.clearTimeout(searchDebounceTimerRef.current);
    }

    searchDebounceTimerRef.current = window.setTimeout(() => {
      setDebouncedSearch(String(search || "").trim());
      searchDebounceTimerRef.current = null;
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceTimerRef.current) {
        window.clearTimeout(searchDebounceTimerRef.current);
        searchDebounceTimerRef.current = null;
      }
    };
  }, [search]);

  const fetchEmployees = useCallback(
    async ({
      showLoading = false,
      showRefreshing = false,
      showError = true,
    } = {}) => {
      employeeListAbortRef.current?.abort();

      const controller = new AbortController();
      employeeListAbortRef.current = controller;

      if (isMountedRef.current) {
        if (showLoading) {
          setIsLoadingEmployees(true);
        }

        if (showRefreshing) {
          setIsRefreshingEmployees(true);
        }

        if (showError) {
          setPageError("");
        }
      }

      try {
        const { data } = await axios.get(EMPLOYEE_API_URL, {
          timeout: REQUEST_TIMEOUT_MS,
          signal: controller.signal,
          headers: getAuthenticatedHeaders(),
          params: {
            view: "summary",
            page,
            pageSize: EMPLOYEE_PAGE_SIZE,
            scope: "active",
            search: debouncedSearch,
            status: filterStatus,
            compliance: filterCompliance,
            sort: sortBy,
          },
        });

        if (controller.signal.aborted || !isMountedRef.current) {
          return false;
        }

        const records = Array.isArray(data?.employees)
          ? data.employees
          : [];

        const nextPagination = normalizePagination(
          data?.pagination,
          page
        );

        setEmployees(records.map(normalizeEmployee));
        setPagination(nextPagination);

        if (
          nextPagination.totalPages > 0 &&
          page > nextPagination.totalPages
        ) {
          setPage(nextPagination.totalPages);
        }

        return true;
      } catch (error) {
        if (isCanceledRequest(error)) {
          return false;
        }

        console.error("Fetch employees error:", error);

        if (showError && isMountedRef.current) {
          setPageError(
            getEmployeeApiError(
              error,
              "Unable to load employee records."
            )
          );
        }

        return false;
      } finally {
        if (employeeListAbortRef.current === controller) {
          employeeListAbortRef.current = null;

          if (isMountedRef.current) {
            if (showLoading) {
              setIsLoadingEmployees(false);
            }

            if (showRefreshing) {
              setIsRefreshingEmployees(false);
            }
          }
        }
      }
    },
    [
      debouncedSearch,
      filterCompliance,
      filterStatus,
      page,
      sortBy,
    ]
  );

  useEffect(() => {
    void fetchEmployees({
      showLoading: true,
    });
  }, [fetchEmployees]);

  useEffect(() => {
    const scheduleEmployeeRefresh = () => {
      if (dataUpdateTimerRef.current) {
        window.clearTimeout(dataUpdateTimerRef.current);
      }

      dataUpdateTimerRef.current = window.setTimeout(() => {
        void fetchEmployees({
          showError: false,
        });

        dataUpdateTimerRef.current = null;
      }, DATA_UPDATE_DEBOUNCE_MS);
    };

    const handleDataUpdated = (event) => {
      if (shouldRefreshEmployees(event)) {
        scheduleEmployeeRefresh();
      }
    };

    window.addEventListener("dataUpdated", handleDataUpdated);

    return () => {
      if (dataUpdateTimerRef.current) {
        window.clearTimeout(dataUpdateTimerRef.current);
        dataUpdateTimerRef.current = null;
      }

      window.removeEventListener("dataUpdated", handleDataUpdated);
    };
  }, [fetchEmployees]);

  const hasActiveFilters = useMemo(
    () =>
      hasActiveEmployeeFilters({
        search,
        status: filterStatus,
        compliance: filterCompliance,
        sortBy,
      }),
    [filterCompliance, filterStatus, search, sortBy]
  );

  const activeEmployeeCount = pagination.activeTotal;
  const matchingEmployeeCount = pagination.total;
  const totalPages = pagination.totalPages;

  const pageStart =
    matchingEmployeeCount > 0
      ? (page - 1) * pagination.pageSize + 1
      : 0;

  const pageEnd =
    matchingEmployeeCount > 0
      ? Math.min(
          page * pagination.pageSize,
          matchingEmployeeCount
        )
      : 0;

  const handleSearchChange = useCallback((event) => {
    setSearch(event.target.value);
    setPage(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    if (searchDebounceTimerRef.current) {
      window.clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }

    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value) => {
    setFilterStatus(value);
    setPage(1);
  }, []);

  const handleComplianceChange = useCallback((value) => {
    setFilterCompliance(value);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((value) => {
    setSortBy(value);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    if (searchDebounceTimerRef.current) {
      window.clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }

    setSearch("");
    setDebouncedSearch("");
    setFilterStatus("All");
    setFilterCompliance("All");
    setSortBy("latest");
    setPage(1);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshingEmployees) {
      return;
    }

    await fetchEmployees({
      showRefreshing: true,
    });
  }, [fetchEmployees, isRefreshingEmployees]);

  const fetchEmployeeById = useCallback(async (employee) => {
    const employeeId = getEmployeeId(employee);

    if (!employeeId) {
      return null;
    }

    employeeDetailAbortRef.current?.abort();

    const controller = new AbortController();
    employeeDetailAbortRef.current = controller;

    try {
      setPageError("");

      const { data } = await axios.get(
        `${EMPLOYEE_API_URL}/${encodeURIComponent(employeeId)}`,
        {
          timeout: REQUEST_TIMEOUT_MS,
          signal: controller.signal,
          headers: getAuthenticatedHeaders(),
        }
      );

      if (controller.signal.aborted || !isMountedRef.current) {
        return null;
      }

      return normalizeEmployee(data);
    } catch (error) {
      if (isCanceledRequest(error)) {
        return null;
      }

      console.error("Fetch employee detail error:", error);

      if (isMountedRef.current) {
        setPageError(
          getEmployeeApiError(
            error,
            "Unable to load the employee record."
          )
        );
      }

      return null;
    } finally {
      if (employeeDetailAbortRef.current === controller) {
        employeeDetailAbortRef.current = null;
      }
    }
  }, []);

  const handleOpenAddEmployee = useCallback(async () => {
    if (isSuperAdmin || isOpeningAddEmployee) {
      return;
    }

    employeeFormMetaAbortRef.current?.abort();

    const controller = new AbortController();
    employeeFormMetaAbortRef.current = controller;

    try {
      setIsOpeningAddEmployee(true);
      setPageError("");

      const { data } = await axios.get(
        `${EMPLOYEE_API_URL}/form-meta`,
        {
          timeout: REQUEST_TIMEOUT_MS,
          signal: controller.signal,
          headers: getAuthenticatedHeaders(),
        }
      );

      if (controller.signal.aborted || !isMountedRef.current) {
        return;
      }

      const previewId = String(
        data?.employeeIdPreview || ""
      ).trim();

      if (!previewId) {
        throw new Error("Employee ID preview is unavailable.");
      }

      setGeneratedId(previewId);
      setEditingEmployee(null);
      setShowEmployeeForm(true);
    } catch (error) {
      if (isCanceledRequest(error)) {
        return;
      }

      console.error("Prepare employee form error:", error);

      if (isMountedRef.current) {
        setPageError(
          getEmployeeApiError(
            error,
            "Unable to prepare the employee form."
          )
        );
      }
    } finally {
      if (employeeFormMetaAbortRef.current === controller) {
        employeeFormMetaAbortRef.current = null;

        if (isMountedRef.current) {
          setIsOpeningAddEmployee(false);
        }
      }
    }
  }, [isOpeningAddEmployee, isSuperAdmin]);

  const handleCloseEmployeeForm = useCallback(() => {
    setShowEmployeeForm(false);
    setEditingEmployee(null);
    setGeneratedId("");
  }, []);

  const handleViewEmployee = useCallback(
    async (employee) => {
      if (!employee) {
        return;
      }

      const fullEmployee = await fetchEmployeeById(employee);

      if (fullEmployee && isMountedRef.current) {
        setViewEmployee(fullEmployee);
      }
    },
    [fetchEmployeeById]
  );

  const handleEditEmployee = useCallback(
    async (employee) => {
      if (isSuperAdmin || !employee) {
        return;
      }

      const fullEmployee = await fetchEmployeeById(employee);

      if (!fullEmployee || !isMountedRef.current) {
        return;
      }

      setEditingEmployee(fullEmployee);
      setGeneratedId(getEmployeeId(fullEmployee));
      setShowEmployeeForm(true);
    },
    [fetchEmployeeById, isSuperAdmin]
  );

  const handleOpenArchiveDialog = useCallback(
    (employee) => {
      if (
        isSuperAdmin ||
        !isHRManager ||
        !employee ||
        isArchiving
      ) {
        return;
      }

      setArchiveTarget(employee);
      setPageError("");
    },
    [isArchiving, isHRManager, isSuperAdmin]
  );

  const handleCloseArchiveDialog = useCallback(() => {
    if (!isArchiving) {
      setArchiveTarget(null);
    }
  }, [isArchiving]);

  const handleConfirmArchive = useCallback(async () => {
    const employeeId = getEmployeeId(archiveTarget);

    if (
      !employeeId ||
      isArchiving ||
      isSuperAdmin ||
      !isHRManager
    ) {
      return;
    }

    const employeeName = getEmployeeName(archiveTarget);

    try {
      setIsArchiving(true);
      setPageError("");

      await axios.put(
        `${EMPLOYEE_API_URL}/archive/${encodeURIComponent(
          employeeId
        )}`,
        {},
        {
          timeout: REQUEST_TIMEOUT_MS,
          headers: getAuthenticatedHeaders({
            "Content-Type": "application/json",
          }),
        }
      );

      setEmployees((currentEmployees) =>
        currentEmployees.filter(
          (employee) => getEmployeeId(employee) !== employeeId
        )
      );

      setArchiveTarget(null);
      setSuccessMessage(
        `${employeeName} was archived successfully.`
      );

      emitDataUpdated("ARCHIVE_EMPLOYEE");

      await fetchEmployees({
        showError: false,
      });
    } catch (error) {
      console.error("Archive employee error:", error);

      setPageError(
        getEmployeeApiError(
          error,
          "Failed to archive the employee record."
        )
      );
    } finally {
      if (isMountedRef.current) {
        setIsArchiving(false);
      }
    }
  }, [
    archiveTarget,
    fetchEmployees,
    isArchiving,
    isHRManager,
    isSuperAdmin,
  ]);

  const handleSaveSuccess = useCallback(
    async (employeeName, mode) => {
      const safeEmployeeName = employeeName || "the employee";
      const isEditMode = mode === "edit";

      handleCloseEmployeeForm();

      setSuccessMessage(
        isEditMode
          ? `${safeEmployeeName}'s information was updated successfully.`
          : `${safeEmployeeName} was saved successfully.`
      );

      emitDataUpdated(
        isEditMode ? "EDIT_EMPLOYEE" : "ADD_EMPLOYEE"
      );

      if (!isEditMode && page !== 1) {
        setPage(1);
        return;
      }

      await fetchEmployees({
        showError: false,
      });
    },
    [fetchEmployees, handleCloseEmployeeForm, page]
  );

  const employeeDescription = isSuperAdmin
    ? "View employee records, deployment status, and compliance information. Super Admin access is view-only."
    : "Manage employee records, workforce status, deployment information, and compliance documents.";

  const archiveEmployeeId = getEmployeeId(archiveTarget);

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Workforce Management"
        title="Employees Management"
        description={employeeDescription}
        icon={<FiUsers size={22} aria-hidden="true" />}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<FiRotateCcw aria-hidden="true" />}
              loading={isRefreshingEmployees}
              disabled={
                isLoadingEmployees || isRefreshingEmployees
              }
              onClick={handleRefresh}
            >
              Refresh
            </Button>

            {isHRManager && (
              <Button
                variant="secondary"
                leftIcon={<FiArchive aria-hidden="true" />}
                disabled={isArchiving}
                onClick={() => navigate("/employees/archive")}
              >
                Archived Employees
              </Button>
            )}

            {!isSuperAdmin && (
              <RoleGuard
                permission={PERMISSIONS.CAN_ADD_EMPLOYEE}
              >
                <Button
                  leftIcon={<FiPlus aria-hidden="true" />}
                  loading={isOpeningAddEmployee}
                  disabled={
                    isLoadingEmployees ||
                    isArchiving ||
                    isOpeningAddEmployee
                  }
                  onClick={handleOpenAddEmployee}
                >
                  Add Employee
                </Button>
              </RoleGuard>
            )}
          </>
        }
      />

      <FilterBar
        resultCount={matchingEmployeeCount}
        resultLabel="employee"
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={
              !hasActiveFilters || isLoadingEmployees
            }
            onClick={handleResetFilters}
          >
            Clear Filters
          </Button>
        }
      >
        <div className="w-full sm:col-span-2 xl:w-80">
          <SearchInput
            label="Search employees"
            hideLabel
            placeholder="Search by name, ID, or company..."
            value={search}
            disabled={isLoadingEmployees}
            onChange={handleSearchChange}
            onClear={handleClearSearch}
          />
        </div>

        <SelectFilter
          id="employee-status-filter"
          label="Employment Status"
          value={filterStatus}
          options={ACTIVE_STATUS_OPTIONS}
          disabled={isLoadingEmployees}
          onChange={handleStatusChange}
        />

        <SelectFilter
          id="employee-compliance-filter"
          label="Compliance Status"
          value={filterCompliance}
          options={COMPLIANCE_OPTIONS}
          disabled={isLoadingEmployees}
          onChange={handleComplianceChange}
        />

        <SelectFilter
          id="employee-sort-filter"
          label="Sort Employees"
          value={sortBy}
          options={EMPLOYEE_SORT_OPTIONS}
          disabled={isLoadingEmployees}
          onChange={handleSortChange}
          className="xl:w-56"
        />
      </FilterBar>

      {pageError && (
        <ErrorState
          compact
          title="Employee data error"
          message={pageError}
          retryLabel="Reload employees"
          onRetry={handleRefresh}
        />
      )}

      {isLoadingEmployees ? (
        <LoadingSkeleton rows={6} columns={7} showHeader />
      ) : (
        <>
          <EmployeeTable
            employees={employees}
            totalRecords={matchingEmployeeCount}
            searchQuery={search}
            hasFilters={
              filterStatus !== "All" ||
              filterCompliance !== "All"
            }
            onClearSearch={handleClearSearch}
            onClearFilters={handleResetFilters}
            openModal={handleViewEmployee}
            onEdit={handleEditEmployee}
            getComplianceStatus={getComplianceStatus}
            onArchive={handleOpenArchiveDialog}
            isHRManager={isHRManager}
            isSuperAdmin={isSuperAdmin}
          />

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Showing{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {pageStart}
                </span>
                {" - "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {pageEnd}
                </span>
                {" of "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {matchingEmployeeCount}
                </span>{" "}
                employees
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((currentPage) =>
                      Math.max(currentPage - 1, 1)
                    )
                  }
                >
                  Previous
                </Button>

                <span className="min-w-24 text-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((currentPage) =>
                      Math.min(currentPage + 1, totalPages)
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {matchingEmployeeCount > 0 && totalPages <= 1 && (
            <p className="px-1 text-sm text-gray-500 dark:text-gray-400">
              Showing {matchingEmployeeCount} of{" "}
              {activeEmployeeCount} active employees.
            </p>
          )}
        </>
      )}

      {showEmployeeForm && !editingEmployee && (
        <AddEmployeeModal
          generatedId={generatedId}
          employees={employees}
          onClose={handleCloseEmployeeForm}
          onSaveSuccess={(employeeName) =>
            handleSaveSuccess(employeeName, "add")
          }
        />
      )}

      {showEmployeeForm && editingEmployee && (
        <EditEmployeeModal
          employeeToEdit={editingEmployee}
          employees={employees}
          onClose={handleCloseEmployeeForm}
          onSaveSuccess={(employeeName) =>
            handleSaveSuccess(employeeName, "edit")
          }
        />
      )}

      {viewEmployee && (
        <EmployeeModal
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
        />
      )}

      <ConfirmDialog
        open={
          Boolean(archiveTarget) &&
          isHRManager &&
          !isSuperAdmin
        }
        title="Archive Employee"
        tone="warning"
        confirmLabel="Archive Employee"
        cancelLabel="Cancel"
        loading={isArchiving}
        disabled={!archiveEmployeeId}
        closeOnBackdrop={!isArchiving}
        onClose={handleCloseArchiveDialog}
        onConfirm={handleConfirmArchive}
      >
        <p>
          Are you sure you want to archive{" "}
          <strong className="font-bold text-gray-900 dark:text-white">
            {getEmployeeName(archiveTarget)}
          </strong>
          ?
        </p>

        <p className="mt-2">
          The employee will be marked as{" "}
          <strong className="font-bold">
            Inactive
          </strong>{" "}
          and removed from the active employee management table.
          The historical record will remain available in Archived
          Employees.
        </p>
      </ConfirmDialog>

      {successMessage && (
        <SuccessToast
          title="Employee record updated"
          message={successMessage}
          duration={3500}
          onClose={() => setSuccessMessage("")}
        />
      )}
    </main>
  );
}