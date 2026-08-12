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
  generateEmployeeId,
  getComplianceStatus,
  getFilteredAndSortedEmployees,
  hasActiveEmployeeFilters,
  normalizeEmployeeStatus,
} from "../utils/employees/employeeHelpers";

const DATA_EVENT_SOURCE =
  "employees-page";

const REQUEST_TIMEOUT_MS =
  45 * 1000;

const DATA_UPDATE_DEBOUNCE_MS =
  300;

const EMPLOYEE_REFRESH_DOMAINS =
  new Set([
    "employees",
    "employee",
    "deployments",
    "deployment",
  ]);

const ACTIVE_STATUS_OPTIONS =
  EMPLOYEE_STATUS_OPTIONS.filter(
    ({ value }) =>
      value !== "Inactive"
  );

const SELECT_CLASS_NAME =
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 " +
  "text-sm text-gray-900 shadow-sm outline-none transition " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white " +
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 " +
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500";

let activeEmployeeRequest =
  null;

function getAuthenticatedHeaders(
  additionalHeaders = {}
) {
  const token = String(
    localStorage.getItem(
      "token"
    ) || ""
  ).trim();

  return {
    Accept:
      "application/json",

    ...additionalHeaders,

    ...(token
      ? {
          Authorization:
            `Bearer ${token}`,
        }
      : {}),
  };
}

function emitDataUpdated(
  action =
    "EMPLOYEES_UPDATED"
) {
  window.dispatchEvent(
    new CustomEvent(
      "dataUpdated",
      {
        detail: {
          source:
            DATA_EVENT_SOURCE,

          domain:
            "employees",

          action,

          at:
            Date.now(),
        },
      }
    )
  );
}

function shouldRefreshEmployees(
  event
) {
  const detail =
    event?.detail || {};

  if (
    detail.source ===
    DATA_EVENT_SOURCE
  ) {
    return false;
  }

  const domain =
    String(
      detail.domain || ""
    )
      .trim()
      .toLowerCase();

  /*
   * Preserve compatibility with
   * older dataUpdated events that
   * do not contain a domain.
   */
  if (!domain) {
    return true;
  }

  return (
    EMPLOYEE_REFRESH_DOMAINS.has(
      domain
    )
  );
}

function getEmployeeId(
  employee
) {
  return String(
    employee?.id ||
      employee?.employeeId ||
      employee?.employee_id ||
      ""
  );
}

function getEmployeeName(
  employee
) {
  return String(
    employee?.name ||
      employee?.full_name ||
      employee?.fullName ||
      getEmployeeId(
        employee
      ) ||
      "the employee"
  ).trim();
}

function normalizeEmployee(
  employee = {}
) {
  return {
    ...employee,

    documents:
      parseEmployeeDocuments(
        employee.documents
      ),
  };
}

function requestEmployees() {
  /*
   * Share one active request so
   * simultaneous consumers do not
   * create duplicate GET requests.
   */
  if (
    !activeEmployeeRequest
  ) {
    activeEmployeeRequest =
      axios
        .get(
          EMPLOYEE_API_URL,
          {
            timeout:
              REQUEST_TIMEOUT_MS,

            headers:
              getAuthenticatedHeaders(),
          }
        )
        .then(
          ({ data }) => {
            const records =
              Array.isArray(
                data
              )
                ? data
                : [];

            return records.map(
              normalizeEmployee
            );
          }
        )
        .finally(
          () => {
            activeEmployeeRequest =
              null;
          }
        );
  }

  return activeEmployeeRequest;
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
    <div
      className={`min-w-0 ${className}`}
    >
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        disabled={
          disabled
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
        className={
          SELECT_CLASS_NAME
        }
      >
        {options.map(
          (
            option
          ) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          )
        )}
      </select>
    </div>
  );
}

export default function Employees() {
  const navigate =
    useNavigate();

  const { user } =
    useAuth();

  const isSuperAdmin =
    user?.role ===
    "SUPER_ADMIN";

  const isHRManager =
    user?.role ===
    "HR_MANAGER";

  const [
    employees,
    setEmployees,
  ] =
    useState([]);

  const [
    showEmployeeForm,
    setShowEmployeeForm,
  ] =
    useState(false);

  const [
    generatedId,
    setGeneratedId,
  ] =
    useState("");

  const [
    editingEmployee,
    setEditingEmployee,
  ] =
    useState(null);

  const [
    viewEmployee,
    setViewEmployee,
  ] =
    useState(null);

  const [
    archiveTarget,
    setArchiveTarget,
  ] =
    useState(null);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    filterStatus,
    setFilterStatus,
  ] =
    useState("All");

  const [
    filterCompliance,
    setFilterCompliance,
  ] =
    useState("All");

  const [
    sortBy,
    setSortBy,
  ] =
    useState(
      "latest"
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    pageError,
    setPageError,
  ] =
    useState("");

  const [
    isLoadingEmployees,
    setIsLoadingEmployees,
  ] =
    useState(true);

  const [
    isRefreshingEmployees,
    setIsRefreshingEmployees,
  ] =
    useState(false);

  const [
    isArchiving,
    setIsArchiving,
  ] =
    useState(false);

  const isFetchingRef =
    useRef(false);

  const isMountedRef =
    useRef(true);

  const dataUpdateTimerRef =
    useRef(null);

  useEffect(
    () => {
      isMountedRef.current =
        true;

      return () => {
        isMountedRef.current =
          false;

        if (
          dataUpdateTimerRef.current
        ) {
          window.clearTimeout(
            dataUpdateTimerRef.current
          );
        }
      };
    },
    []
  );

  const fetchEmployees =
    useCallback(
      async ({
        showLoading = false,
        showRefreshing = false,
        showError = true,
      } = {}) => {
        if (
          isFetchingRef.current
        ) {
          return false;
        }

        isFetchingRef.current =
          true;

        if (
          isMountedRef.current
        ) {
          if (
            showLoading
          ) {
            setIsLoadingEmployees(
              true
            );
          }

          if (
            showRefreshing
          ) {
            setIsRefreshingEmployees(
              true
            );
          }

          if (
            showError
          ) {
            setPageError(
              ""
            );
          }
        }

        try {
          const records =
            await requestEmployees();

          if (
            !isMountedRef.current
          ) {
            return false;
          }

          setEmployees(
            records
          );

          return true;
        } catch (error) {
          console.error(
            "Fetch employees error:",
            error
          );

          if (
            showError &&
            isMountedRef.current
          ) {
            setPageError(
              getEmployeeApiError(
                error,
                "Unable to load employee records."
              )
            );
          }

          return false;
        } finally {
          isFetchingRef.current =
            false;

          if (
            isMountedRef.current
          ) {
            if (
              showLoading
            ) {
              setIsLoadingEmployees(
                false
              );
            }

            if (
              showRefreshing
            ) {
              setIsRefreshingEmployees(
                false
              );
            }
          }
        }
      },
      []
    );

  useEffect(
    () => {
      void fetchEmployees({
        showLoading:
          true,
      });
    },
    [
      fetchEmployees,
    ]
  );

  useEffect(
    () => {
      const scheduleEmployeeRefresh =
        () => {
          if (
            dataUpdateTimerRef.current
          ) {
            window.clearTimeout(
              dataUpdateTimerRef.current
            );
          }

          dataUpdateTimerRef.current =
            window.setTimeout(
              () => {
                void fetchEmployees({
                  showError:
                    false,
                });
              },
              DATA_UPDATE_DEBOUNCE_MS
            );
        };

      const handleDataUpdated =
        (
          event
        ) => {
          if (
            shouldRefreshEmployees(
              event
            )
          ) {
            scheduleEmployeeRefresh();
          }
        };

      window.addEventListener(
        "dataUpdated",
        handleDataUpdated
      );

      return () => {
        if (
          dataUpdateTimerRef.current
        ) {
          window.clearTimeout(
            dataUpdateTimerRef.current
          );
        }

        window.removeEventListener(
          "dataUpdated",
          handleDataUpdated
        );
      };
    },
    [
      fetchEmployees,
    ]
  );

  const filteredEmployees =
    useMemo(
      () =>
        getFilteredAndSortedEmployees(
          employees,
          {
            search,

            status:
              filterStatus,

            compliance:
              filterCompliance,

            sortBy,

            includeArchived:
              false,
          }
        ),
      [
        employees,
        filterCompliance,
        filterStatus,
        search,
        sortBy,
      ]
    );

  const activeEmployeeCount =
    useMemo(
      () =>
        employees.filter(
          (
            employee
          ) =>
            !employee?.archived &&
            normalizeEmployeeStatus(
              employee?.status
            ) !==
              "Inactive"
        ).length,
      [
        employees,
      ]
    );

  const hasActiveFilters =
    useMemo(
      () =>
        hasActiveEmployeeFilters(
          {
            search,

            status:
              filterStatus,

            compliance:
              filterCompliance,

            sortBy,
          }
        ),
      [
        filterCompliance,
        filterStatus,
        search,
        sortBy,
      ]
    );

  const handleResetFilters =
    useCallback(
      () => {
        setSearch(
          ""
        );

        setFilterStatus(
          "All"
        );

        setFilterCompliance(
          "All"
        );

        setSortBy(
          "latest"
        );
      },
      []
    );

  const handleRefresh =
    useCallback(
      async () => {
        if (
          isFetchingRef.current ||
          isRefreshingEmployees
        ) {
          return;
        }

        await fetchEmployees({
          showRefreshing:
            true,
        });
      },
      [
        fetchEmployees,
        isRefreshingEmployees,
      ]
    );

  const handleOpenAddEmployee =
    useCallback(
      () => {
        if (
          isSuperAdmin
        ) {
          return;
        }

        setGeneratedId(
          generateEmployeeId(
            employees
          )
        );

        setEditingEmployee(
          null
        );

        setShowEmployeeForm(
          true
        );
      },
      [
        employees,
        isSuperAdmin,
      ]
    );

  const handleCloseEmployeeForm =
    useCallback(
      () => {
        setShowEmployeeForm(
          false
        );

        setEditingEmployee(
          null
        );

        setGeneratedId(
          ""
        );
      },
      []
    );

  const handleEditEmployee =
    useCallback(
      (
        employee
      ) => {
        if (
          isSuperAdmin ||
          !employee
        ) {
          return;
        }

        setEditingEmployee(
          normalizeEmployee(
            employee
          )
        );

        setGeneratedId(
          getEmployeeId(
            employee
          )
        );

        setShowEmployeeForm(
          true
        );
      },
      [
        isSuperAdmin,
      ]
    );

  const handleOpenArchiveDialog =
    useCallback(
      (
        employee
      ) => {
        if (
          isSuperAdmin ||
          !isHRManager ||
          !employee ||
          isArchiving
        ) {
          return;
        }

        setArchiveTarget(
          employee
        );

        setPageError(
          ""
        );
      },
      [
        isArchiving,
        isHRManager,
        isSuperAdmin,
      ]
    );

  const handleCloseArchiveDialog =
    useCallback(
      () => {
        if (
          !isArchiving
        ) {
          setArchiveTarget(
            null
          );
        }
      },
      [
        isArchiving,
      ]
    );

  const handleConfirmArchive =
    useCallback(
      async () => {
        const employeeId =
          getEmployeeId(
            archiveTarget
          );

        if (
          !employeeId ||
          isArchiving ||
          isSuperAdmin ||
          !isHRManager
        ) {
          return;
        }

        const employeeName =
          getEmployeeName(
            archiveTarget
          );

        try {
          setIsArchiving(
            true
          );

          setPageError(
            ""
          );

          await axios.put(
            `${EMPLOYEE_API_URL}/archive/${encodeURIComponent(
              employeeId
            )}`,
            {},
            {
              timeout:
                REQUEST_TIMEOUT_MS,

              headers:
                getAuthenticatedHeaders({
                  "Content-Type":
                    "application/json",
                }),
            }
          );

          setEmployees(
            (
              currentEmployees
            ) =>
              currentEmployees.filter(
                (
                  employee
                ) =>
                  getEmployeeId(
                    employee
                  ) !==
                  employeeId
              )
          );

          setArchiveTarget(
            null
          );

          setSuccessMessage(
            `${employeeName} was archived successfully.`
          );

          emitDataUpdated(
            "ARCHIVE_EMPLOYEE"
          );

          void fetchEmployees({
            showError:
              false,
          });
        } catch (error) {
          console.error(
            "Archive employee error:",
            error
          );

          setPageError(
            getEmployeeApiError(
              error,
              "Failed to archive the employee record."
            )
          );
        } finally {
          if (
            isMountedRef.current
          ) {
            setIsArchiving(
              false
            );
          }
        }
      },
      [
        archiveTarget,
        fetchEmployees,
        isArchiving,
        isHRManager,
        isSuperAdmin,
      ]
    );

  const handleSaveSuccess =
    useCallback(
      async (
        employeeName,
        mode
      ) => {
        const safeEmployeeName =
          employeeName ||
          "the employee";

        const isEditMode =
          mode ===
          "edit";

        handleCloseEmployeeForm();

        setSuccessMessage(
          isEditMode
            ? `${safeEmployeeName}'s information was updated successfully.`
            : `${safeEmployeeName} was saved successfully.`
        );

        emitDataUpdated(
          isEditMode
            ? "EDIT_EMPLOYEE"
            : "ADD_EMPLOYEE"
        );

        await fetchEmployees({
          showError:
            false,
        });
      },
      [
        fetchEmployees,
        handleCloseEmployeeForm,
      ]
    );

  const employeeDescription =
    isSuperAdmin
      ? "View employee records, deployment status, and compliance information. Super Admin access is view-only."
      : "Manage employee records, workforce status, deployment information, and compliance documents.";

  const archiveEmployeeId =
    getEmployeeId(
      archiveTarget
    );

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Workforce Management"
        title="Employees Management"
        description={
          employeeDescription
        }
        icon={
          <FiUsers
            size={22}
            aria-hidden="true"
          />
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={
                <FiRotateCcw
                  aria-hidden="true"
                />
              }
              loading={
                isRefreshingEmployees
              }
              disabled={
                isLoadingEmployees ||
                isRefreshingEmployees
              }
              onClick={
                handleRefresh
              }
            >
              Refresh
            </Button>

            {isHRManager && (
              <Button
                variant="secondary"
                leftIcon={
                  <FiArchive
                    aria-hidden="true"
                  />
                }
                disabled={
                  isArchiving
                }
                onClick={() =>
                  navigate(
                    "/employees/archive"
                  )
                }
              >
                Archived Employees
              </Button>
            )}

            {!isSuperAdmin && (
              <RoleGuard
                permission={
                  PERMISSIONS.CAN_ADD_EMPLOYEE
                }
              >
                <Button
                  leftIcon={
                    <FiPlus
                      aria-hidden="true"
                    />
                  }
                  disabled={
                    isLoadingEmployees ||
                    isArchiving
                  }
                  onClick={
                    handleOpenAddEmployee
                  }
                >
                  Add Employee
                </Button>
              </RoleGuard>
            )}
          </>
        }
      />

      <FilterBar
        resultCount={
          filteredEmployees.length
        }
        resultLabel="employee"
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={
              !hasActiveFilters ||
              isLoadingEmployees
            }
            onClick={
              handleResetFilters
            }
          >
            Clear Filters
          </Button>
        }
      >
        <div className="w-full sm:col-span-2 xl:w-80">
          <SearchInput
            label="Search employees"
            hideLabel
            placeholder="Search by name, ID, company, or position..."
            value={
              search
            }
            disabled={
              isLoadingEmployees
            }
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            onClear={() =>
              setSearch(
                ""
              )
            }
          />
        </div>

        <SelectFilter
          id="employee-status-filter"
          label="Employment Status"
          value={
            filterStatus
          }
          options={
            ACTIVE_STATUS_OPTIONS
          }
          disabled={
            isLoadingEmployees
          }
          onChange={
            setFilterStatus
          }
        />

        <SelectFilter
          id="employee-compliance-filter"
          label="Compliance Status"
          value={
            filterCompliance
          }
          options={
            COMPLIANCE_OPTIONS
          }
          disabled={
            isLoadingEmployees
          }
          onChange={
            setFilterCompliance
          }
        />

        <SelectFilter
          id="employee-sort-filter"
          label="Sort Employees"
          value={
            sortBy
          }
          options={
            EMPLOYEE_SORT_OPTIONS
          }
          disabled={
            isLoadingEmployees
          }
          onChange={
            setSortBy
          }
          className="xl:w-56"
        />
      </FilterBar>

      {pageError && (
        <ErrorState
          compact
          title="Employee data error"
          message={
            pageError
          }
          retryLabel="Reload employees"
          onRetry={
            handleRefresh
          }
        />
      )}

      {isLoadingEmployees ? (
        <LoadingSkeleton
          rows={6}
          columns={7}
          showHeader
        />
      ) : (
        <EmployeeTable
          employees={
            filteredEmployees
          }
          totalRecords={
            activeEmployeeCount
          }
          searchQuery={
            search
          }
          hasFilters={
            filterStatus !==
              "All" ||
            filterCompliance !==
              "All"
          }
          onClearSearch={() =>
            setSearch(
              ""
            )
          }
          onClearFilters={
            handleResetFilters
          }
          openModal={
            setViewEmployee
          }
          onEdit={
            handleEditEmployee
          }
          getComplianceStatus={
            getComplianceStatus
          }
          onArchive={
            handleOpenArchiveDialog
          }
          isHRManager={
            isHRManager
          }
          isSuperAdmin={
            isSuperAdmin
          }
        />
      )}

      {showEmployeeForm &&
        !editingEmployee && (
          <AddEmployeeModal
            generatedId={
              generatedId
            }
            employees={
              employees
            }
            onClose={
              handleCloseEmployeeForm
            }
            onSaveSuccess={(
              employeeName
            ) =>
              handleSaveSuccess(
                employeeName,
                "add"
              )
            }
          />
        )}

      {showEmployeeForm &&
        editingEmployee && (
          <EditEmployeeModal
            employeeToEdit={
              editingEmployee
            }
            employees={
              employees
            }
            onClose={
              handleCloseEmployeeForm
            }
            onSaveSuccess={(
              employeeName
            ) =>
              handleSaveSuccess(
                employeeName,
                "edit"
              )
            }
          />
        )}

      {viewEmployee && (
        <EmployeeModal
          employee={
            viewEmployee
          }
          onClose={() =>
            setViewEmployee(
              null
            )
          }
        />
      )}

      <ConfirmDialog
        open={
          Boolean(
            archiveTarget
          ) &&
          isHRManager &&
          !isSuperAdmin
        }
        title="Archive Employee"
        tone="warning"
        confirmLabel="Archive Employee"
        cancelLabel="Cancel"
        loading={
          isArchiving
        }
        disabled={
          !archiveEmployeeId
        }
        closeOnBackdrop={
          !isArchiving
        }
        onClose={
          handleCloseArchiveDialog
        }
        onConfirm={
          handleConfirmArchive
        }
      >
        <p>
          Are you sure you want
          to archive{" "}
          <strong className="font-bold text-gray-900 dark:text-white">
            {getEmployeeName(
              archiveTarget
            )}
          </strong>
          ?
        </p>

        <p className="mt-2">
          The employee will be
          marked as{" "}
          <strong className="font-bold">
            Inactive
          </strong>{" "}
          and removed from the
          active employee
          management table. The
          historical record will
          remain available in
          Archived Employees.
        </p>
      </ConfirmDialog>

      {successMessage && (
        <SuccessToast
          title="Employee record updated"
          message={
            successMessage
          }
          duration={3500}
          onClose={() =>
            setSuccessMessage(
              ""
            )
          }
        />
      )}
    </main>
  );
}