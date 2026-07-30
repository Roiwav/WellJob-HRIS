import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiRefreshCw,
} from "react-icons/fi";
import axios from "axios";

import { useAuth } from "../context/useAuth";

import DeploymentTable from "../components/deployments/table/DeploymentTable";
import DeploymentModal from "../components/deployments/modals/DeploymentModal";
import DeploymentToast from "../components/deployments/shared/DeploymentToast";

import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import FilterBar from "../components/ui/FilterBar";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";

import {
  buildLegacySeparationPayload,
  getMonthOptions,
  getYearOptions,
  normalizeSeparationReason,
} from "../utils/deployments/deploymentHelpers";

const API_BASE = "http://localhost:5000/api";
const DEPLOYMENT_API_URL = `${API_BASE}/deployments`;
const EMPLOYEES_API_URL = `${API_BASE}/employees`;

const DATA_EVENT_SOURCE = "deployments-page";
const REQUEST_TIMEOUT_MS = 15000;
const DATA_UPDATE_DEBOUNCE_MS = 300;

const SELECT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5",
  "text-sm font-semibold text-gray-900 shadow-sm outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

let activeDeploymentRequest = null;

function emitDataUpdated(action = "DEPLOYMENTS_UPDATED") {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: DATA_EVENT_SOURCE,
        domain: "deployments",
        action,
        at: Date.now(),
      },
    })
  );
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const data = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "The server took too long to respond. Check that the backend server and database are running, then try again."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getDeploymentData() {
  if (!activeDeploymentRequest) {
    activeDeploymentRequest = requestJson(
      DEPLOYMENT_API_URL
    ).finally(() => {
      activeDeploymentRequest = null;
    });
  }

  return activeDeploymentRequest;
}

function normalizeDeploymentStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized === "active") {
    return "Active";
  }

  if (normalized === "completed") {
    return "Completed";
  }

  if (
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "Cancelled";
  }

  if (normalized === "pending") {
    return "Pending";
  }

  return status || "Active";
}

function normalizeDeployment(item = {}) {
  const employeeId =
    item.employeeId ||
    item.employee_id ||
    item.empId ||
    item.employeeID ||
    "";

  const deploymentId =
    item.deploymentId ||
    item.deployment_id ||
    item.id ||
    "";

  const start =
    item.start ||
    item.deploymentDate ||
    item.deployment_date ||
    item.contractStart ||
    item.contract_start ||
    item.startDate ||
    item.start_date ||
    "-";

  const separationDate =
    item.separationDate ||
    item.separation_date ||
    item.contractEnd ||
    item.contract_end ||
    item.endDate ||
    item.end_date ||
    item.deploymentEnd ||
    item.deployment_end ||
    "-";

  const separationRemarks =
    item.separationRemarks ||
    item.separation_remarks ||
    item.endRemarks ||
    item.end_remarks ||
    "";

  return {
    ...item,

    id:
      employeeId ||
      deploymentId,

    deploymentId,
    employeeId,

    employee:
      item.employee ||
      item.employeeName ||
      item.employee_name ||
      item.name ||
      "Unknown Employee",

    company:
      item.company ||
      item.clientCompany ||
      item.client_company ||
      "-",

    location:
      item.location ||
      item.deploymentLocation ||
      item.deployment_location ||
      item.company ||
      "-",

    start,

    status: normalizeDeploymentStatus(
      item.status ||
        item.deploymentStatus ||
        item.deployment_status ||
        "Active"
    ),

    employmentType:
      item.employmentType ||
      item.employment_type ||
      "Permanent",

    contractStart:
      item.contractStart ||
      item.contract_start ||
      item.deploymentDate ||
      item.deployment_date ||
      start,

    contractEnd: separationDate,
    separationDate,

    separationReason:
      normalizeSeparationReason(
        item.separationReason ||
          item.separation_reason ||
          item.endReason ||
          item.end_reason,
        separationRemarks
      ),

    separationRemarks,

    createdAt:
      item.createdAt ||
      item.created_at ||
      null,

    updatedAt:
      item.updatedAt ||
      item.updated_at ||
      null,
  };
}

function getRequestError(error, fallbackMessage) {
  if (error?.response?.status === 503) {
    return "The system is currently under maintenance. Please try again later.";
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

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Deployments() {
  const { user } = useAuth();

  const isSuperAdmin =
    user?.role === "SUPER_ADMIN";

  const [
    selectedDeployment,
    setSelectedDeployment,
  ] = useState(null);

  const [deployments, setDeployments] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [fetchError, setFetchError] =
    useState("");

  const [toastMessage, setToastMessage] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [selectedMonth, setSelectedMonth] =
    useState("");

  const [selectedYear, setSelectedYear] =
    useState("");

  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const dataUpdateTimerRef = useRef(null);

  const monthOptions = useMemo(
    () => getMonthOptions(),
    []
  );

  const yearOptions = useMemo(
    () => getYearOptions(deployments),
    [deployments]
  );

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

  const fetchDeployments = useCallback(
    async ({
      showInitialLoading = false,
      showRefreshing = false,
      showError = true,
    } = {}) => {
      if (isFetchingRef.current) {
        return false;
      }

      isFetchingRef.current = true;

      if (
        showInitialLoading &&
        isMountedRef.current
      ) {
        setIsLoading(true);
      }

      if (
        showRefreshing &&
        isMountedRef.current
      ) {
        setIsRefreshing(true);
      }

      try {
        if (
          showError &&
          isMountedRef.current
        ) {
          setFetchError("");
        }

        const data =
          await getDeploymentData();

        if (!isMountedRef.current) {
          return false;
        }

        const normalized =
          Array.isArray(data)
            ? data.map(
                normalizeDeployment
              )
            : [];

        setDeployments(normalized);

        return true;
      } catch (error) {
        console.error(
          "Fetch deployments error:",
          error
        );

        if (
          showError &&
          isMountedRef.current
        ) {
          setFetchError(
            getRequestError(
              error,
              "Unable to load deployment records."
            )
          );
        }

        return false;
      } finally {
        isFetchingRef.current = false;

        if (isMountedRef.current) {
          if (showInitialLoading) {
            setIsLoading(false);
          }

          if (showRefreshing) {
            setIsRefreshing(false);
          }
        }
      }
    },
    []
  );

  useEffect(() => {
    void fetchDeployments({
      showInitialLoading: true,
    });
  }, [fetchDeployments]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (dataUpdateTimerRef.current) {
        window.clearTimeout(
          dataUpdateTimerRef.current
        );
      }

      dataUpdateTimerRef.current =
        window.setTimeout(() => {
          void fetchDeployments({
            showError: false,
          });
        }, DATA_UPDATE_DEBOUNCE_MS);
    };

    const handleDataUpdated = (event) => {
      if (
        event?.detail?.source ===
        DATA_EVENT_SOURCE
      ) {
        return;
      }

      scheduleRefresh();
    };

    window.addEventListener(
      "dataUpdated",
      handleDataUpdated
    );

    window.addEventListener(
      "focus",
      scheduleRefresh
    );

    return () => {
      if (dataUpdateTimerRef.current) {
        window.clearTimeout(
          dataUpdateTimerRef.current
        );
      }

      window.removeEventListener(
        "dataUpdated",
        handleDataUpdated
      );

      window.removeEventListener(
        "focus",
        scheduleRefresh
      );
    };
  }, [fetchDeployments]);

  const openView = useCallback(
    (deployment) => {
      if (!deployment) {
        return;
      }

      setSelectedDeployment(deployment);
    },
    []
  );

  const closeDeploymentModal =
    useCallback(() => {
      setSelectedDeployment(null);
    }, []);

  const handleCloseToast =
    useCallback(() => {
      setToastMessage("");
    }, []);

  const handleInlineUpdateRow =
    useCallback(
      async (updatedDeployment) => {
        if (isSuperAdmin) {
          setFetchError(
            "Super Admin access is view-only for deployment records."
          );

          return false;
        }

        const employeeId =
          updatedDeployment?.employeeId ||
          updatedDeployment?.employee_id ||
          updatedDeployment?.id;

        if (!employeeId) {
          setFetchError(
            "Unable to record separation because the employee ID is missing."
          );

          return false;
        }

        try {
          setFetchError("");

          const legacyPayload =
            buildLegacySeparationPayload(
              updatedDeployment
            );

          await axios.put(
            `${EMPLOYEES_API_URL}/${encodeURIComponent(
              employeeId
            )}/contract-end`,
            {
              ...legacyPayload,

              userId:
                user?.userId ||
                user?.id ||
                null,

              username:
                user?.username ||
                null,

              fullName:
                user?.full_name ||
                user?.fullName ||
                user?.username ||
                null,

              role:
                user?.role ||
                null,
            },
            {
              timeout:
                REQUEST_TIMEOUT_MS,
            }
          );

          await fetchDeployments({
            showError: false,
          });

          emitDataUpdated(
            "EMPLOYEE_SEPARATED"
          );

          setToastMessage(
            "Employee separation recorded successfully."
          );

          return true;
        } catch (error) {
          console.error(
            "Error recording employee separation:",
            error
          );

          setFetchError(
            getRequestError(
              error,
              "Failed to record employee separation. Please try again."
            )
          );

          return false;
        }
      },
      [
        fetchDeployments,
        isSuperAdmin,
        user,
      ]
    );

  const handleRefresh = useCallback(
    async () => {
      if (
        isFetchingRef.current ||
        isRefreshing
      ) {
        return;
      }

      await fetchDeployments({
        showRefreshing: true,
      });
    },
    [
      fetchDeployments,
      isRefreshing,
    ]
  );

  const handleResetFilters =
    useCallback(() => {
      setSearch("");
      setSelectedMonth("");
      setSelectedYear("");
    }, []);

  const filteredDeployments =
    useMemo(() => {
      const normalizedSearch =
        normalizeSearchText(search);

      const searchTerms =
        normalizedSearch
          ? normalizedSearch.split(/\s+/)
          : [];

      return deployments.filter(
        (deployment) => {
          const searchableText =
            normalizeSearchText(
              [
                deployment.id,
                deployment.deploymentId,
                deployment.employeeId,
                deployment.employee,
                deployment.company,
                deployment.location,
                deployment.status,
                deployment.employmentType,
                deployment.separationReason,
              ].join(" ")
            );

          const matchesSearch =
            searchTerms.length === 0 ||
            searchTerms.every((term) =>
              searchableText.includes(term)
            );

          if (!matchesSearch) {
            return false;
          }

          if (
            !selectedMonth &&
            !selectedYear
          ) {
            return true;
          }

          const startDateValue =
            deployment.start ||
            deployment.contractStart;

          if (
            !startDateValue ||
            startDateValue === "-"
          ) {
            return false;
          }

          const startDate =
            new Date(startDateValue);

          if (
            Number.isNaN(
              startDate.getTime()
            )
          ) {
            return false;
          }

          const matchesMonth =
            selectedMonth === "" ||
            startDate.getMonth() ===
              Number(selectedMonth);

          const matchesYear =
            selectedYear === "" ||
            String(
              startDate.getFullYear()
            ) === selectedYear;

          return (
            matchesMonth &&
            matchesYear
          );
        }
      );
    }, [
      deployments,
      search,
      selectedMonth,
      selectedYear,
    ]);

  const hasActiveFilters =
    Boolean(
      search.trim() ||
      selectedMonth ||
      selectedYear
    );

  const pageDescription =
    isSuperAdmin
      ? "View continuous employee assignments and recorded separations. Super Admin access is view-only."
      : "Monitor continuous employee assignments and record employee separations.";

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Workforce Assignment"
        title="Deployment Tracking"
        description={pageDescription}
        icon={
          <FiBriefcase size={22} />
        }
        actions={
          <Button
            variant="secondary"
            leftIcon={
              <FiRefreshCw
                className={
                  isRefreshing
                    ? "animate-spin"
                    : ""
                }
              />
            }
            loading={isRefreshing}
            disabled={
              isLoading ||
              isRefreshing ||
              isFetchingRef.current
            }
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        }
      />

      {fetchError && (
        <ErrorState
          compact
          title="Deployment data error"
          message={fetchError}
          retryLabel="Reload deployments"
          onRetry={handleRefresh}
        />
      )}

      {!isLoading && (
        <ClientDeploymentSummary
          deployments={deployments}
        />
      )}

      <FilterBar
        resultCount={
          filteredDeployments.length
        }
        resultLabel="deployment"
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={
              !hasActiveFilters ||
              isLoading
            }
            onClick={
              handleResetFilters
            }
          >
            Clear Filters
          </Button>
        }
      >
        <div className="w-full sm:col-span-2 xl:w-96">
          <SearchInput
            label="Search deployments"
            hideLabel
            placeholder="Search ID, employee, company, location, or status..."
            value={search}
            disabled={isLoading}
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
            htmlFor="deployment-month-filter"
            className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Deployment Month
          </label>

          <div className="relative">
            <FiCalendar
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
            />

            <select
              id="deployment-month-filter"
              value={selectedMonth}
              disabled={isLoading}
              onChange={(event) =>
                setSelectedMonth(
                  event.target.value
                )
              }
              className={`${SELECT_CLASS_NAME} pl-10`}
            >
              {monthOptions.map(
                (month) => (
                  <option
                    key={`${month.label}-${month.value}`}
                    value={month.value}
                  >
                    {month.label}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="min-w-0 xl:w-44">
          <label
            htmlFor="deployment-year-filter"
            className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Deployment Year
          </label>

          <select
            id="deployment-year-filter"
            value={selectedYear}
            disabled={isLoading}
            onChange={(event) =>
              setSelectedYear(
                event.target.value
              )
            }
            className={
              SELECT_CLASS_NAME
            }
          >
            {yearOptions.map(
              (year) => (
                <option
                  key={`${year.label}-${year.value}`}
                  value={year.value}
                >
                  {year.label}
                </option>
              )
            )}
          </select>
        </div>
      </FilterBar>

      {isLoading ? (
        <LoadingSkeleton
          rows={6}
          columns={8}
          showHeader
        />
      ) : filteredDeployments.length > 0 ? (
        <DeploymentTable
          deployments={
            filteredDeployments
          }
          openView={openView}
          onUpdateRow={
            handleInlineUpdateRow
          }
          isSuperAdmin={
            isSuperAdmin
          }
        />
      ) : (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
          <EmptyState
            icon={
              hasActiveFilters
                ? "search"
                : "records"
            }
            title={
              hasActiveFilters
                ? "No deployments matched"
                : "No deployment records"
            }
            description={
              hasActiveFilters
                ? "No deployment records matched the current search and date filters."
                : "Deployment records will appear once employees are assigned."
            }
            secondaryActionLabel={
              hasActiveFilters
                ? "Clear filters"
                : ""
            }
            onSecondaryAction={
              hasActiveFilters
                ? handleResetFilters
                : undefined
            }
          />
        </section>
      )}

      {selectedDeployment && (
        <DeploymentModal
          deployment={
            selectedDeployment
          }
          mode="view"
          close={
            closeDeploymentModal
          }
        />
      )}

      <DeploymentToast
        show={Boolean(toastMessage)}
        title="Deployment Updated"
        message={toastMessage}
        onClose={handleCloseToast}
      />
    </main>
  );
}

function ClientDeploymentSummary({
  deployments = [],
}) {
  const [
    showAllCompanies,
    setShowAllCompanies,
  ] = useState(false);

  const safeDeployments = useMemo(() => {
    return Array.isArray(deployments)
      ? deployments
      : [];
  }, [deployments]);

  const summaryData = useMemo(() => {
    const companyMap = new Map();

    safeDeployments.forEach(
      (deployment) => {
        const company =
          deployment.company ||
          "Unassigned Company";

        const status =
          normalizeDeploymentStatus(
            deployment.status
          );

        if (!companyMap.has(company)) {
          companyMap.set(company, {
            company,
            total: 0,
            active: 0,
            completed: 0,
            cancelled: 0,
          });
        }

        const current =
          companyMap.get(company);

        current.total += 1;

        if (status === "Active") {
          current.active += 1;
        }

        if (status === "Completed") {
          current.completed += 1;
        }

        if (status === "Cancelled") {
          current.cancelled += 1;
        }
      }
    );

    const companies =
      Array.from(
        companyMap.values()
      ).sort(
        (first, second) =>
          second.total -
            first.total ||
          first.company.localeCompare(
            second.company
          )
      );

    const totalDeployments =
      safeDeployments.length;

    const totalCompanies =
      companies.length;

    const activeDeployments =
      companies.reduce(
        (sum, company) =>
          sum + company.active,
        0
      );

    const completedDeployments =
      companies.reduce(
        (sum, company) =>
          sum + company.completed,
        0
      );

    const cancelledDeployments =
      companies.reduce(
        (sum, company) =>
          sum + company.cancelled,
        0
      );

    return {
      companies,
      totalDeployments,
      totalCompanies,
      activeDeployments,
      completedDeployments,
      cancelledDeployments,
      topCompany:
        companies[0] || null,
    };
  }, [safeDeployments]);

  const visibleCompanies =
    showAllCompanies
      ? summaryData.companies
      : summaryData.companies.slice(
          0,
          6
        );

  if (
    safeDeployments.length === 0
  ) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 dark:border-white/10 dark:bg-slate-950/40 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Client Deployment Summary
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Overview of assigned employees per client company.
            </p>
          </div>

          {summaryData.topCompany && (
            <div className="w-fit max-w-full rounded-2xl border border-indigo-100 bg-white px-4 py-3 dark:border-indigo-500/20 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Highest Deployment
              </p>

              <p className="mt-1 max-w-xs truncate text-sm font-extrabold text-slate-900 dark:text-white">
                {
                  summaryData.topCompany
                    .company
                }
              </p>

              <p className="mt-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                {
                  summaryData.topCompany
                    .total
                }{" "}
                employee
                {summaryData.topCompany
                  .total === 1
                  ? ""
                  : "s"}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryStatCard
            label="Total"
            value={
              summaryData.totalDeployments
            }
            helper="All records"
          />

          <SummaryStatCard
            label="Companies"
            value={
              summaryData.totalCompanies
            }
            helper="Client companies"
          />

          <SummaryStatCard
            label="Active"
            value={
              summaryData.activeDeployments
            }
            helper="Ongoing"
            tone="green"
          />

          <SummaryStatCard
            label="Completed"
            value={
              summaryData.completedDeployments
            }
            helper="Finished"
            tone="blue"
          />

          <SummaryStatCard
            label="Cancelled"
            value={
              summaryData.cancelledDeployments
            }
            helper="Stopped"
            tone="rose"
          />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Distribution by Client
            </h3>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Showing{" "}
              {visibleCompanies.length} of{" "}
              {
                summaryData.companies
                  .length
              }{" "}
              companies.
            </p>
          </div>

          {summaryData.companies
            .length > 6 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setShowAllCompanies(
                  (currentValue) =>
                    !currentValue
                )
              }
            >
              {showAllCompanies
                ? "Show Less"
                : `Show All ${summaryData.companies.length}`}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visibleCompanies.map(
            (item, index) => (
              <ClientCompanyRow
                key={item.company}
                item={item}
                rank={index + 1}
                totalDeployments={
                  summaryData.totalDeployments
                }
              />
            )
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryStatCard({
  label,
  value,
  helper,
  tone = "slate",
}) {
  const toneStyles = {
    slate:
      "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white",

    green:
      "border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",

    blue:
      "border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",

    rose:
      "border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
  };

  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3",
        toneStyles[tone] ||
          toneStyles.slate,
      ].join(" ")}
    >
      <p className="text-[10px] font-black uppercase tracking-wide opacity-60">
        {label}
      </p>

      <p className="mt-1 text-xl font-black leading-none">
        {value}
      </p>

      <p className="mt-1 text-[11px] font-semibold opacity-60">
        {helper}
      </p>
    </div>
  );
}

function ClientCompanyRow({
  item,
  rank,
  totalDeployments,
}) {
  const percentage =
    totalDeployments > 0
      ? Math.round(
          (Number(item.total || 0) /
            totalDeployments) *
            100
        )
      : 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:border-indigo-300 hover:bg-white hover:shadow-sm dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-indigo-500/50 dark:hover:bg-slate-950">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
          #{rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                {item.company}
              </h4>

              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {percentage}% of total deployments
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-lg font-black leading-none text-slate-900 dark:text-white">
                {item.total}
              </p>

              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                Total
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
              role="progressbar"
              aria-label={`${item.company} deployment percentage`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
            >
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{
                  width: `${Math.min(
                    percentage,
                    100
                  )}%`,
                }}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <SummaryPill
                label="Active"
                value={item.active}
                tone={
                  item.active > 0
                    ? "green"
                    : "muted"
                }
              />

              <SummaryPill
                label="Done"
                value={item.completed}
                tone={
                  item.completed > 0
                    ? "blue"
                    : "muted"
                }
              />

              <SummaryPill
                label="Cancelled"
                value={item.cancelled}
                tone={
                  item.cancelled > 0
                    ? "rose"
                    : "muted"
                }
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function SummaryPill({
  label,
  value,
  tone = "muted",
}) {
  const toneStyles = {
    green:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",

    blue:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",

    rose:
      "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",

    muted:
      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black",
        toneStyles[tone] ||
          toneStyles.muted,
      ].join(" ")}
    >
      {label}: {value}
    </span>
  );
}