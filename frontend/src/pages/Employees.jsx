// Employees.jsx

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
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import FilterBar from "../components/ui/FilterBar";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import ErrorState from "../components/ui/ErrorState";
import SuccessToast from "../components/ui/SuccessToast";
import ConfirmDialog from "../components/ui/ConfirmDialog";

import {
  COMPLIANCE_OPTIONS,
  EMPLOYEE_SORT_OPTIONS,
  EMPLOYEE_STATUS_OPTIONS,
  generateEmployeeId,
  getComplianceStatus,
  getFilteredAndSortedEmployees,
  hasActiveEmployeeFilters,
} from "../utils/employees/employeeHelpers";

const EMPLOYEE_API_URL =
  "http://localhost:5000/api/employees";

const AUDIT_API_URL =
  "http://localhost:5000/api/audit-logs";

const DATA_EVENT_SOURCE = "employees-page";

const REQUEST_TIMEOUT_MS = 15000;
const AUDIT_TIMEOUT_MS = 8000;
const DATA_UPDATE_DEBOUNCE_MS = 300;

let activeEmployeeRequest = null;

const SELECT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5",
  "text-sm text-gray-900 shadow-sm outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

function emitDataUpdated(
  action = "EMPLOYEES_UPDATED"
) {
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

function getErrorMessage(
  error,
  fallbackMessage
) {
  if (error?.response?.status === 503) {
    return "System is currently under maintenance. Please try again later.";
  }

  if (
    error?.code === "ECONNABORTED" ||
    error?.name === "AbortError"
  ) {
    return "The server took too long to respond. Check that the backend and database are running, then try again.";
  }

  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

function parseDocuments(documents) {
  if (Array.isArray(documents)) {
    return documents;
  }

  if (typeof documents !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(documents);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function normalizeEmployee(employee = {}) {
  return {
    ...employee,
    documents: parseDocuments(
      employee.documents
    ),
  };
}

async function requestEmployees() {
  if (!activeEmployeeRequest) {
    activeEmployeeRequest = axios
      .get(EMPLOYEE_API_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Accept: "application/json",
        },
      })
      .then((response) => {
        const records = Array.isArray(
          response.data
        )
          ? response.data
          : [];

        return records.map(
          normalizeEmployee
        );
      })
      .finally(() => {
        activeEmployeeRequest = null;
      });
  }

  return activeEmployeeRequest;
}

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSuperAdmin =
    user?.role === "SUPER_ADMIN";

  const isHRManager =
    user?.role === "HR_MANAGER";

  const [employees, setEmployees] =
    useState([]);

  const [
    showEmployeeForm,
    setShowEmployeeForm,
  ] = useState(false);

  const [generatedId, setGeneratedId] =
    useState("");

  const [
    editingEmployee,
    setEditingEmployee,
  ] = useState(null);

  const [
    viewEmployee,
    setViewEmployee,
  ] = useState(null);

  const [
    archiveTarget,
    setArchiveTarget,
  ] = useState(null);

  const [search, setSearch] =
    useState("");

  const [
    filterStatus,
    setFilterStatus,
  ] = useState("All");

  const [
    filterCompliance,
    setFilterCompliance,
  ] = useState("All");

  const [sortBy, setSortBy] =
    useState("latest");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [pageError, setPageError] =
    useState("");

  const [
    isLoadingEmployees,
    setIsLoadingEmployees,
  ] = useState(true);

  const [
    isRefreshingEmployees,
    setIsRefreshingEmployees,
  ] = useState(false);

  const [
    isArchiving,
    setIsArchiving,
  ] = useState(false);

  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);
  const dataUpdateTimerRef =
    useRef(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (dataUpdateTimerRef.current) {
        window.clearTimeout(
          dataUpdateTimerRef.current
        );
      }
    };
  }, []);

  const getCurrentUserName =
    useCallback(() => {
      return (
        user?.full_name ||
        user?.fullName ||
        user?.username ||
        "System Admin"
      );
    }, [user]);

  const createOperationalLog =
    useCallback(
      async (action, description) => {
        try {
          await axios.post(
            AUDIT_API_URL,
            {
              userId:
                user?.userId ||
                user?.id ||
                "-",

              username:
                user?.username ||
                "-",

              full_name:
                getCurrentUserName(),

              role:
                user?.role ||
                "-",

              category:
                "OPERATIONAL",

              action,
              description,
            },
            {
              timeout:
                AUDIT_TIMEOUT_MS,
            }
          );

          return true;
        } catch (error) {
          console.error(
            "Failed to save operational log:",
            error
          );

          return false;
        }
      },
      [
        getCurrentUserName,
        user,
      ]
    );

  const fetchEmployees = useCallback(
    async ({
      showLoading = false,
      showRefreshing = false,
      showError = true,
    } = {}) => {
      if (isFetchingRef.current) {
        return false;
      }

      isFetchingRef.current = true;

      if (
        showLoading &&
        isMountedRef.current
      ) {
        setIsLoadingEmployees(true);
      }

      if (
        showRefreshing &&
        isMountedRef.current
      ) {
        setIsRefreshingEmployees(true);
      }

      try {
        if (
          showError &&
          isMountedRef.current
        ) {
          setPageError("");
        }

        const records =
          await requestEmployees();

        if (!isMountedRef.current) {
          return false;
        }

        setEmployees(records);

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
            getErrorMessage(
              error,
              "Unable to load employee records."
            )
          );
        }

        return false;
} finally {
  isFetchingRef.current = false;

  if (isMountedRef.current) {
    if (showLoading) {
      setIsLoadingEmployees(false);
    }

    if (showRefreshing) {
      setIsRefreshingEmployees(false);
    }
  }
}
    },
    []
  );

  useEffect(() => {
    void fetchEmployees({
      showLoading: true,
    });
  }, [fetchEmployees]);

  useEffect(() => {
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
          window.setTimeout(() => {
            void fetchEmployees({
              showError: false,
            });
          }, DATA_UPDATE_DEBOUNCE_MS);
      };

    const handleDataUpdated = (
      event
    ) => {
      if (
        event?.detail?.source ===
        DATA_EVENT_SOURCE
      ) {
        return;
      }

      scheduleEmployeeRefresh();
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
  }, [fetchEmployees]);

  const filteredEmployees =
    useMemo(() => {
      return getFilteredAndSortedEmployees(
        employees,
        {
          search,
          status: filterStatus,
          compliance:
            filterCompliance,
          sortBy,
          includeArchived: false,
        }
      );
    }, [
      employees,
      search,
      filterStatus,
      filterCompliance,
      sortBy,
    ]);

  const hasActiveFilters =
    useMemo(() => {
      return hasActiveEmployeeFilters({
        search,
        status: filterStatus,
        compliance:
          filterCompliance,
        sortBy,
      });
    }, [
      search,
      filterStatus,
      filterCompliance,
      sortBy,
    ]);

  const handleResetFilters =
    useCallback(() => {
      setSearch("");
      setFilterStatus("All");
      setFilterCompliance("All");
      setSortBy("latest");
    }, []);

  const handleRefresh =
    useCallback(async () => {
      if (
        isFetchingRef.current ||
        isRefreshingEmployees
      ) {
        return;
      }

      await fetchEmployees({
        showRefreshing: true,
      });
    }, [
      fetchEmployees,
      isRefreshingEmployees,
    ]);

  const handleOpenAddEmployee =
    useCallback(() => {
      if (isSuperAdmin) {
        return;
      }

      setGeneratedId(
        generateEmployeeId(
          employees
        )
      );

      setEditingEmployee(null);
      setShowEmployeeForm(true);
    }, [
      employees,
      isSuperAdmin,
    ]);

  const handleCloseEmployeeForm =
    useCallback(() => {
      setShowEmployeeForm(false);
      setEditingEmployee(null);
      setGeneratedId("");
    }, []);

  const handleEditEmployee =
    useCallback(
      (employee) => {
        if (
          isSuperAdmin ||
          !employee
        ) {
          return;
        }

        setEditingEmployee({
          ...employee,
          documents:
            parseDocuments(
              employee.documents
            ),
        });

        setGeneratedId(
          String(
            employee.id || ""
          )
        );

        setShowEmployeeForm(true);
      },
      [isSuperAdmin]
    );

  const handleCloseViewEmployee =
    useCallback(() => {
      setViewEmployee(null);
    }, []);

  const handleOpenArchiveDialog =
    useCallback(
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
      [
        isArchiving,
        isHRManager,
        isSuperAdmin,
      ]
    );

  const handleCloseArchiveDialog =
    useCallback(() => {
      if (isArchiving) {
        return;
      }

      setArchiveTarget(null);
    }, [isArchiving]);

  const handleConfirmArchive =
    useCallback(async () => {
      if (
        !archiveTarget?.id ||
        isArchiving ||
        isSuperAdmin ||
        !isHRManager
      ) {
        return;
      }

      const employeeId =
        archiveTarget.id;

      const employeeName =
        archiveTarget.name ||
        archiveTarget.full_name ||
        archiveTarget.fullName ||
        String(employeeId);

      try {
        setIsArchiving(true);
        setPageError("");

        await axios.put(
          `${EMPLOYEE_API_URL}/archive/${employeeId}`,
          {},
          {
            timeout:
              REQUEST_TIMEOUT_MS,
          }
        );

        setEmployees(
          (currentEmployees) =>
            currentEmployees.filter(
              (employee) =>
                String(employee?.id) !==
                String(employeeId)
            )
        );

        setArchiveTarget(null);

        setSuccessMessage(
          `${employeeName} was archived successfully.`
        );

        void createOperationalLog(
          "ARCHIVE_EMPLOYEE",
          `${getCurrentUserName()} archived employee record for ${employeeName}.`
        );

        emitDataUpdated(
          "ARCHIVE_EMPLOYEE"
        );

        void fetchEmployees({
          showError: false,
        });
      } catch (error) {
        console.error(
          "Archive employee error:",
          error
        );

        setPageError(
          getErrorMessage(
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
      createOperationalLog,
      fetchEmployees,
      getCurrentUserName,
      isArchiving,
      isHRManager,
      isSuperAdmin,
    ]);

  const handleAddSuccess =
    useCallback(
      async (employeeName) => {
        const safeEmployeeName =
          employeeName ||
          "the employee";

        handleCloseEmployeeForm();

        setSuccessMessage(
          `${safeEmployeeName} was saved successfully.`
        );

        void createOperationalLog(
          "ADD_EMPLOYEE",
          `${getCurrentUserName()} added employee record for ${safeEmployeeName}.`
        );

        emitDataUpdated(
          "ADD_EMPLOYEE"
        );

        await fetchEmployees({
          showError: false,
        });
      },
      [
        createOperationalLog,
        fetchEmployees,
        getCurrentUserName,
        handleCloseEmployeeForm,
      ]
    );

  const handleEditSuccess =
    useCallback(
      async (employeeName) => {
        const safeEmployeeName =
          employeeName ||
          "the employee";

        handleCloseEmployeeForm();

        setSuccessMessage(
          `${safeEmployeeName}'s information was updated successfully.`
        );

        void createOperationalLog(
          "EDIT_EMPLOYEE",
          `${getCurrentUserName()} edited employee record for ${safeEmployeeName}.`
        );

        emitDataUpdated(
          "EDIT_EMPLOYEE"
        );

        await fetchEmployees({
          showError: false,
        });
      },
      [
        createOperationalLog,
        fetchEmployees,
        getCurrentUserName,
        handleCloseEmployeeForm,
      ]
    );

  const handleCloseSuccessToast =
    useCallback(() => {
      setSuccessMessage("");
    }, []);

  const employeeDescription =
    isSuperAdmin
      ? "View employee records, deployment status, and compliance information. Super Admin access is view-only."
      : "Manage employee records, workforce status, deployment information, and compliance documents.";

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Workforce Management"
        title="Employees Management"
        description={
          employeeDescription
        }
        icon={
          <FiUsers size={22} />
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={
                <FiRotateCcw />
              }
              loading={
                isRefreshingEmployees
              }
              disabled={
                isLoadingEmployees ||
                isRefreshingEmployees ||
                isFetchingRef.current
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
                  <FiArchive />
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
                    <FiPlus />
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
            value={search}
            disabled={
              isLoadingEmployees
            }
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            onClear={() =>
              setSearch("")
            }
          />
        </div>

        <div className="min-w-0 xl:w-52">
          <label
            htmlFor="employee-status-filter"
            className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Employment Status
          </label>

          <select
            id="employee-status-filter"
            value={filterStatus}
            disabled={
              isLoadingEmployees
            }
            onChange={(event) =>
              setFilterStatus(
                event.target.value
              )
            }
            className={
              SELECT_CLASS_NAME
            }
          >
            {EMPLOYEE_STATUS_OPTIONS.filter(
              (option) =>
                option.value !==
                "Inactive"
            ).map((option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 xl:w-52">
          <label
            htmlFor="employee-compliance-filter"
            className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Compliance Status
          </label>

          <select
            id="employee-compliance-filter"
            value={
              filterCompliance
            }
            disabled={
              isLoadingEmployees
            }
            onChange={(event) =>
              setFilterCompliance(
                event.target.value
              )
            }
            className={
              SELECT_CLASS_NAME
            }
          >
            {COMPLIANCE_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0 xl:w-56">
          <label
            htmlFor="employee-sort-filter"
            className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Sort Employees
          </label>

          <select
            id="employee-sort-filter"
            value={sortBy}
            disabled={
              isLoadingEmployees
            }
            onChange={(event) =>
              setSortBy(
                event.target.value
              )
            }
            className={
              SELECT_CLASS_NAME
            }
          >
            {EMPLOYEE_SORT_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </div>
      </FilterBar>

      {pageError && (
        <ErrorState
          compact
          title="Employee data error"
          message={pageError}
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
            onSaveSuccess={
              handleAddSuccess
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
            onSaveSuccess={
              handleEditSuccess
            }
          />
        )}

      {viewEmployee && (
        <EmployeeModal
          employee={
            viewEmployee
          }
          onClose={
            handleCloseViewEmployee
          }
        />
      )}

      <ConfirmDialog
        open={
          Boolean(
            archiveTarget
          ) &&
          !isSuperAdmin
        }
        title="Archive Employee"
        tone="danger"
        confirmLabel="Archive Employee"
        cancelLabel="Cancel"
        loading={
          isArchiving
        }
        disabled={
          !archiveTarget?.id
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
          Are you sure you want to
          archive{" "}
          <strong className="font-bold text-gray-900 dark:text-white">
            {archiveTarget?.name ||
              archiveTarget?.full_name ||
              archiveTarget?.fullName ||
              "this employee"}
          </strong>
          ?
        </p>

        <p className="mt-2">
          The employee will be marked
          as{" "}
          <strong className="font-bold">
            Inactive
          </strong>{" "}
          and removed from the active
          employee management table.
          The historical record will
          remain available in Archived
          Employees.
        </p>
      </ConfirmDialog>

      <SuccessToast
        title="Employee record updated"
        message={
          successMessage
        }
        duration={3500}
        onClose={
          handleCloseSuccessToast
        }
      />
    </main>
  );
}