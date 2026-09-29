import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiAlertTriangle,
  FiBriefcase,
  FiCheckCircle,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSlash,
  FiUsers,
} from "react-icons/fi";

import { API_BASE } from "../../config/api";
import authenticatedFetch from "../../utils/authenticatedFetch";

import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Dialog from "../ui/Dialog";
import SuccessToast from "../ui/SuccessToast";

const CLIENT_COMPANIES_API_URL =
  `${API_BASE}/settings/client-companies`;

const REQUEST_TIMEOUT_MS = 15000;
const MAX_COMPANY_NAME_LENGTH = 255;

const INPUT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5",
  "text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

const STICKY_HEADER_CLASS_NAME =
  "sticky top-0 z-20 bg-gray-50 px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:text-gray-400 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.10)]";

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1") {
    return true;
  }

  if (value === 0 || value === "0") {
    return false;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    ["true", "active", "enabled", "yes"].includes(normalized)
  ) {
    return true;
  }

  if (
    ["false", "inactive", "disabled", "no"].includes(normalized)
  ) {
    return false;
  }

  return fallback;
}

function normalizeCompany(company) {
  if (!company || typeof company !== "object") {
    return null;
  }

  const id = toInteger(
    company.id ??
      company.companyId ??
      company.company_id,
    0
  );

  const companyName = String(
    company.companyName ??
      company.company_name ??
      company.company ??
      company.name ??
      ""
  ).trim();

  if (!id || !companyName) {
    return null;
  }

  return {
    id,
    companyName,

    isActive: normalizeBoolean(
      company.isActive ??
        company.is_active ??
        company.active,
      true
    ),

    positionCount: Math.max(
      toInteger(
        company.positionCount ??
          company.position_count ??
          company.positionsCount ??
          company.positions_count ??
          company.totalPositions ??
          company.total_positions,
        0
      ),
      0
    ),

    activePositionCount: Math.max(
      toInteger(
        company.activePositionCount ??
          company.active_position_count ??
          company.activePositionsCount ??
          company.active_positions_count ??
          company.activePositions ??
          company.active_positions,
        0
      ),
      0
    ),

    assignedCoordinatorCount: Math.max(
      toInteger(
        company.assignedCoordinatorCount ??
          company.assigned_coordinator_count ??
          company.assignedHrCoordinatorCount ??
          company.assigned_hr_coordinator_count ??
          company.assignedHcCount ??
          company.assigned_hc_count ??
          company.hrCoordinatorCount ??
          company.hr_coordinator_count,
        0
      ),
      0
    ),
  };
}

function normalizeCompaniesResponse(data) {
  const rawCompanies = Array.isArray(data)
    ? data
    : Array.isArray(data?.companies)
      ? data.companies
      : [];

  return rawCompanies
    .map(normalizeCompany)
    .filter(Boolean)
    .sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.companyName.localeCompare(
        right.companyName,
        "en",
        {
          sensitivity: "base",
        }
      );
    });
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await authenticatedFetch(url, {
      ...options,

      signal: controller.signal,

      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getConfigurationErrorMessage(
  error,
  fallbackMessage
) {
  if (error?.name === "AbortError") {
    return "The server took too long to respond. Check that the backend and database are running, then try again.";
  }

  return error?.message || fallbackMessage;
}

function emitCompaniesUpdated(action) {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: "client-companies-configuration",
        domain: "system-configuration",
        action,
        at: Date.now(),
      },
    })
  );
}

function CompanyStatusBadge({ isActive }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        isActive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300",
      ].join(" ")}
    >
      {isActive ? (
        <FiCheckCircle aria-hidden="true" />
      ) : (
        <FiSlash aria-hidden="true" />
      )}

      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "indigo",
}) {
  const toneClasses = {
    indigo:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    slate:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {label}
          </p>

          <p className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            {value}
          </p>
        </div>

        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            toneClasses[tone] || toneClasses.indigo,
          ].join(" ")}
        >
          {Icon ? (
            <Icon size={18} aria-hidden="true" />
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
        {helper}
      </p>
    </div>
  );
}

export default function ClientCompaniesTab({
  canEdit = false,
}) {
  const isMountedRef = useRef(true);

  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [
    configurationError,
    setConfigurationError,
  ] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [showAddDialog, setShowAddDialog] =
    useState(false);

  const [newCompanyName, setNewCompanyName] =
    useState("");

  const [
    companyFormError,
    setCompanyFormError,
  ] = useState("");

  const [
    pendingStatusCompany,
    setPendingStatusCompany,
  ] = useState(null);

  const [successMessage, setSuccessMessage] =
    useState("");

  const loadCompanies = useCallback(
    async ({
      showLoading = true,
      showError = true,
    } = {}) => {
      if (showLoading) {
        setIsLoading(true);
      }

      if (showError) {
        setConfigurationError("");
      }

      try {
        const data = await requestJson(
          CLIENT_COMPANIES_API_URL
        );

        if (!isMountedRef.current) {
          return false;
        }

        setCompanies(
          normalizeCompaniesResponse(data)
        );

        return true;
      } catch (error) {
        console.error(
          "Unable to load client companies:",
          error
        );

        if (
          showError &&
          isMountedRef.current
        ) {
          setConfigurationError(
            getConfigurationErrorMessage(
              error,
              "Unable to load the client company configuration."
            )
          );
        }

        return false;
      } finally {
        if (
          showLoading &&
          isMountedRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    isMountedRef.current = true;

    void loadCompanies();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadCompanies]);

  const activeCompanyCount = useMemo(
    () =>
      companies.filter(
        (company) => company.isActive
      ).length,
    [companies]
  );

  const inactiveCompanyCount =
    companies.length - activeCompanyCount;

  const totalActivePositions = useMemo(
    () =>
      companies.reduce(
        (total, company) =>
          total +
          company.activePositionCount,
        0
      ),
    [companies]
  );

  const totalAssignedCoordinators = useMemo(
    () =>
      companies.reduce(
        (total, company) =>
          total +
          company.assignedCoordinatorCount,
        0
      ),
    [companies]
  );

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLowerCase();

    return companies.filter((company) => {
      const matchesQuery =
        !normalizedQuery ||
        company.companyName
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" &&
          company.isActive) ||
        (statusFilter === "Inactive" &&
          !company.isActive);

      return matchesQuery && matchesStatus;
    });
  }, [companies, query, statusFilter]);

  const normalizedNewCompanyName =
    newCompanyName
      .trim()
      .replace(/\s+/g, " ");

  const handleOpenAddDialog = useCallback(() => {
    if (!canEdit || isSaving) {
      return;
    }

    setNewCompanyName("");
    setCompanyFormError("");
    setShowAddDialog(true);
  }, [canEdit, isSaving]);

  const handleCloseAddDialog = useCallback(() => {
    if (isSaving) {
      return;
    }

    setShowAddDialog(false);
    setNewCompanyName("");
    setCompanyFormError("");
  }, [isSaving]);

  const handleAddCompany = useCallback(
    async () => {
      if (!canEdit || isSaving) {
        return;
      }

      if (!normalizedNewCompanyName) {
        setCompanyFormError(
          "Company name is required."
        );

        return;
      }

      if (
        normalizedNewCompanyName.length >
        MAX_COMPANY_NAME_LENGTH
      ) {
        setCompanyFormError(
          `Company name must not exceed ${MAX_COMPANY_NAME_LENGTH} characters.`
        );

        return;
      }

      try {
        setIsSaving(true);
        setCompanyFormError("");
        setConfigurationError("");

        const data = await requestJson(
          CLIENT_COMPANIES_API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              companyName:
                normalizedNewCompanyName,
            }),
          }
        );

        if (!isMountedRef.current) {
          return;
        }

        setShowAddDialog(false);
        setNewCompanyName("");

        setSuccessMessage(
          data?.message ||
            `${normalizedNewCompanyName} was added successfully.`
        );

        emitCompaniesUpdated(
          "ADD_CLIENT_COMPANY"
        );

        const refreshed =
          await loadCompanies({
            showLoading: false,
            showError: false,
          });

        if (
          !refreshed &&
          isMountedRef.current
        ) {
          setConfigurationError(
            "The company was added successfully, but the refreshed company list could not be loaded. Refresh the page to verify the latest configuration."
          );
        }
      } catch (error) {
        console.error(
          "Unable to add client company:",
          error
        );

        if (isMountedRef.current) {
          setCompanyFormError(
            getConfigurationErrorMessage(
              error,
              "Unable to add the client company."
            )
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [
      canEdit,
      isSaving,
      loadCompanies,
      normalizedNewCompanyName,
    ]
  );

  const handleRequestStatusChange =
    useCallback(
      (company) => {
        if (
          !canEdit ||
          isSaving ||
          !company?.id
        ) {
          return;
        }

        setConfigurationError("");
        setPendingStatusCompany(company);
      },
      [canEdit, isSaving]
    );

  const handleConfirmStatusChange =
    useCallback(
      async () => {
        if (
          !canEdit ||
          isSaving ||
          !pendingStatusCompany?.id
        ) {
          return;
        }

        const nextIsActive =
          !pendingStatusCompany.isActive;

        const companyName =
          pendingStatusCompany.companyName;

        try {
          setIsSaving(true);
          setConfigurationError("");

          const data = await requestJson(
            `${CLIENT_COMPANIES_API_URL}/${encodeURIComponent(
              pendingStatusCompany.id
            )}/status`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                isActive: nextIsActive,
              }),
            }
          );

          if (!isMountedRef.current) {
            return;
          }

          setPendingStatusCompany(null);

          setSuccessMessage(
            data?.message ||
              `${companyName} was ${
                nextIsActive
                  ? "reactivated"
                  : "deactivated"
              } successfully.`
          );

          emitCompaniesUpdated(
            nextIsActive
              ? "REACTIVATE_CLIENT_COMPANY"
              : "DEACTIVATE_CLIENT_COMPANY"
          );

          const refreshed =
            await loadCompanies({
              showLoading: false,
              showError: false,
            });

          if (
            !refreshed &&
            isMountedRef.current
          ) {
            setConfigurationError(
              "The company status was updated successfully, but the refreshed company list could not be loaded. Refresh the page to verify the latest configuration."
            );
          }
        } catch (error) {
          console.error(
            "Unable to update client company status:",
            error
          );

          if (isMountedRef.current) {
            setPendingStatusCompany(null);

            setConfigurationError(
              getConfigurationErrorMessage(
                error,
                "Unable to update the client company status."
              )
            );
          }
        } finally {
          if (isMountedRef.current) {
            setIsSaving(false);
          }
        }
      },
      [
        canEdit,
        isSaving,
        loadCompanies,
        pendingStatusCompany,
      ]
    );

  const pendingNextIsActive =
    pendingStatusCompany
      ? !pendingStatusCompany.isActive
      : false;

  const pendingDeactivationBlocked =
    Boolean(
      pendingStatusCompany?.isActive &&
        pendingStatusCompany
          .assignedCoordinatorCount > 0
    );

  return (
    <div className="space-y-4">
      {configurationError && (
        <section
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <div className="flex items-start gap-3">
            <FiAlertTriangle
              className="mt-0.5 shrink-0"
              size={20}
              aria-hidden="true"
            />

            <div className="min-w-0">
              <h3 className="font-bold">
                We couldn't load the company list
              </h3>

              <p className="mt-1 text-sm leading-6">
                {configurationError}
              </p>

              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    isLoading || isSaving
                  }
                  onClick={() =>
                    loadCompanies()
                  }
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white">
              Company Overview
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              A quick view of your active client
              companies, available positions, and
              assigned coordinators.
            </p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiRefreshCw />}
                disabled={
                  isLoading || isSaving
                }
                onClick={() =>
                  loadCompanies()
                }
              >
                Refresh
              </Button>

              <Button
                type="button"
                leftIcon={<FiPlus />}
                disabled={
                  isLoading ||
                  isSaving ||
                  Boolean(configurationError)
                }
                onClick={
                  handleOpenAddDialog
                }
              >
                Add Company
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Active Companies"
            value={activeCompanyCount}
            helper="Currently available for deployment and assignment."
            icon={FiCheckCircle}
            tone="emerald"
          />

          <SummaryCard
            label="Inactive Companies"
            value={inactiveCompanyCount}
            helper="Companies currently unavailable for new assignments."
            icon={FiSlash}
            tone="slate"
          />

          <SummaryCard
            label="Available Positions"
            value={totalActivePositions}
            helper="Active job positions across all client companies."
            icon={FiBriefcase}
            tone="indigo"
          />

          <SummaryCard
            label="HR Coordinators"
            value={totalAssignedCoordinators}
            helper="Coordinator assignments across client companies."
            icon={FiUsers}
            tone="amber"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="border-b border-gray-200 p-4 sm:p-5 dark:border-white/10">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-white">
                  Client Companies
                </h2>

                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  Find a company and review its
                  current positions, coordinator
                  assignment, and availability.
                </p>
              </div>

              {!isLoading && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Showing{" "}
                  <span className="font-black text-gray-900 dark:text-white">
                    {filteredCompanies.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-black text-gray-900 dark:text-white">
                    {companies.length}
                  </span>
                </p>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <FiSearch
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />

                <label
                  htmlFor="client-company-search"
                  className="sr-only"
                >
                  Search client companies
                </label>

                <input
                  id="client-company-search"
                  type="search"
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value
                    )
                  }
                  placeholder="Search by company name..."
                  className={`${INPUT_CLASS_NAME} pl-11`}
                />
              </div>

              <div>
                <label
                  htmlFor="client-company-status-filter"
                  className="sr-only"
                >
                  Filter by company status
                </label>

                <select
                  id="client-company-status-filter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className={INPUT_CLASS_NAME}
                >
                  <option value="All">
                    All companies
                  </option>

                  <option value="Active">
                    Active companies
                  </option>

                  <option value="Inactive">
                    Inactive companies
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div
            role="status"
            className="p-8 text-center"
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <FiRefreshCw
                className="animate-spin"
                size={19}
                aria-hidden="true"
              />
            </div>

            <p className="mt-3 text-sm font-bold text-gray-700 dark:text-gray-200">
              Loading companies...
            </p>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Getting the latest company information.
            </p>
          </div>
        ) : filteredCompanies.length ? (
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-[900px] w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className={STICKY_HEADER_CLASS_NAME}
                  >
                    Company
                  </th>

                  <th
                    scope="col"
                    className={STICKY_HEADER_CLASS_NAME}
                  >
                    Status
                  </th>

                  <th
                    scope="col"
                    className={STICKY_HEADER_CLASS_NAME}
                  >
                    Positions
                  </th>

                  <th
                    scope="col"
                    className={STICKY_HEADER_CLASS_NAME}
                  >
                    HR Coordinator
                  </th>

                  {canEdit && (
                    <th
                      scope="col"
                      className={`${STICKY_HEADER_CLASS_NAME} text-right`}
                    >
                      Action
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredCompanies.map(
                  (company) => {
                    const deactivationBlocked =
                      company.isActive &&
                      company.assignedCoordinatorCount >
                        0;

                    return (
                      <tr
                        key={company.id}
                        className="group transition-colors hover:bg-indigo-50/40 dark:hover:bg-white/[0.025]"
                      >
                        <td className="border-b border-gray-200 px-5 py-4 dark:border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:group-hover:bg-indigo-500/15">
                              <FiBriefcase
                                size={17}
                                aria-hidden="true"
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="break-words text-sm font-extrabold text-gray-900 dark:text-white">
                                {company.companyName}
                              </p>

                              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                Client company
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="border-b border-gray-200 px-5 py-4 dark:border-white/10">
                          <CompanyStatusBadge
                            isActive={
                              company.isActive
                            }
                          />
                        </td>

                        <td className="border-b border-gray-200 px-5 py-4 dark:border-white/10">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-black text-gray-900 dark:text-white">
                              {
                                company.activePositionCount
                              }
                            </span>

                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                              active
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {company.positionCount}{" "}
                            total{" "}
                            {company.positionCount ===
                            1
                              ? "position"
                              : "positions"}
                          </p>
                        </td>

                        <td className="border-b border-gray-200 px-5 py-4 dark:border-white/10">
                          <div className="flex items-center gap-2">
                            <div
                              className={[
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                company.assignedCoordinatorCount >
                                0
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
                                  : "bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-500",
                              ].join(" ")}
                            >
                              <FiUsers
                                size={14}
                                aria-hidden="true"
                              />
                            </div>

                            <div>
                              <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                                {
                                  company.assignedCoordinatorCount
                                }{" "}
                                assigned
                              </p>

                              {!deactivationBlocked && (
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                  {company.assignedCoordinatorCount >
                                  0
                                    ? "Coordinator assigned"
                                    : "No coordinator assigned"}
                                </p>
                              )}
                            </div>
                          </div>

                          {deactivationBlocked && (
                            <div className="mt-2 flex max-w-sm items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                              <FiAlertTriangle
                                className="mt-0.5 shrink-0"
                                aria-hidden="true"
                              />

                              <span>
                                Reassign the coordinator
                                before deactivating this
                                company.
                              </span>
                            </div>
                          )}
                        </td>

                        {canEdit && (
                          <td className="border-b border-gray-200 px-5 py-4 text-right dark:border-white/10">
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                company.isActive
                                  ? "secondary"
                                  : "success"
                              }
                              disabled={
                                isSaving ||
                                !company.id ||
                                deactivationBlocked
                              }
                              onClick={() =>
                                handleRequestStatusChange(
                                  company
                                )
                              }
                            >
                              {company.isActive
                                ? "Deactivate"
                                : "Reactivate"}
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-300">
              <FiSearch
                size={21}
                aria-hidden="true"
              />
            </div>

            <h3 className="mt-4 font-extrabold text-gray-900 dark:text-white">
              {companies.length
                ? "No matching companies"
                : "No client companies yet"}
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">
              {companies.length
                ? "Try another company name or change the status filter."
                : "Add your first client company to start configuring positions and assignments."}
            </p>

            {!companies.length &&
              canEdit &&
              !configurationError && (
                <div className="mt-4">
                  <Button
                    type="button"
                    leftIcon={<FiPlus />}
                    onClick={
                      handleOpenAddDialog
                    }
                  >
                    Add First Company
                  </Button>
                </div>
              )}
          </div>
        )}
      </section>

      <Dialog
        open={showAddDialog}
        onClose={handleCloseAddDialog}
        title="Add Client Company"
        description="Add a client company so it can be used for employee deployment, positions, and HR Coordinator assignment."
        size="md"
        preventClose={isSaving}
        closeOnOverlay={!isSaving}
        closeOnEscape={!isSaving}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={
                handleCloseAddDialog
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              leftIcon={<FiPlus />}
              loading={isSaving}
              disabled={
                isSaving ||
                !normalizedNewCompanyName
              }
              onClick={
                handleAddCompany
              }
            >
              Add Company
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {companyFormError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              <div className="flex items-start gap-2">
                <FiAlertTriangle
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <p className="leading-6">
                  {companyFormError}
                </p>
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
              Company Name
            </span>

            <input
              type="text"
              value={newCompanyName}
              maxLength={
                MAX_COMPANY_NAME_LENGTH
              }
              placeholder="Enter company name"
              disabled={isSaving}
              autoComplete="off"
              onChange={(event) => {
                setNewCompanyName(
                  event.target.value
                );

                setCompanyFormError("");
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !isSaving
                ) {
                  event.preventDefault();

                  void handleAddCompany();
                }
              }}
              className={INPUT_CLASS_NAME}
            />

            <div className="mt-2 flex items-start justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="leading-5">
                Use the official company name.
                Company names must be unique and
                cannot be renamed later.
              </span>

              <span className="shrink-0 font-semibold">
                {newCompanyName.length}/
                {MAX_COMPANY_NAME_LENGTH}
              </span>
            </div>
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(
          pendingStatusCompany
        )}
        title={
          pendingNextIsActive
            ? "Reactivate Client Company?"
            : "Deactivate Client Company?"
        }
        tone="warning"
        confirmLabel={
          pendingNextIsActive
            ? "Reactivate Company"
            : "Deactivate Company"
        }
        cancelLabel="Cancel"
        loading={isSaving}
        disabled={
          pendingDeactivationBlocked
        }
        closeOnBackdrop={!isSaving}
        onClose={() => {
          if (!isSaving) {
            setPendingStatusCompany(null);
          }
        }}
        onConfirm={
          handleConfirmStatusChange
        }
      >
        <p>
          {pendingNextIsActive
            ? "Reactivate"
            : "Deactivate"}{" "}
          <strong>
            {
              pendingStatusCompany
                ?.companyName
            }
          </strong>
          ?
        </p>

        {pendingNextIsActive ? (
          <p className="mt-2">
            This company will be available again
            for new deployments, position
            management, and HR Coordinator
            assignment.
          </p>
        ) : (
          <>
            <p className="mt-2">
              This company will no longer appear
              in active selection lists. Existing
              employee and deployment history
              will remain unchanged.
            </p>

            {pendingDeactivationBlocked && (
              <p className="mt-3 font-semibold text-amber-700 dark:text-amber-300">
                Reassign the HR Coordinator
                before deactivating this company.
              </p>
            )}
          </>
        )}
      </ConfirmDialog>

      <SuccessToast
        title="Client company updated"
        message={successMessage}
        duration={4000}
        onClose={() =>
          setSuccessMessage("")
        }
      />
    </div>
  );
}