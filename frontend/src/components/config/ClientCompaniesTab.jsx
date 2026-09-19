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
  FiMapPin,
  FiPlus,
  FiRotateCcw,
  FiSearch,
  FiSlash,
  FiUsers,
} from "react-icons/fi";

import {
  API_BASE,
} from "../../config/api";

import authenticatedFetch from "../../utils/authenticatedFetch";

import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Dialog from "../ui/Dialog";
import SuccessToast from "../ui/SuccessToast";

const CLIENT_COMPANIES_API_URL =
  `${API_BASE}/settings/client-companies`;

const REQUEST_TIMEOUT_MS =
  15000;

const MAX_COMPANY_NAME_LENGTH =
  255;

const INPUT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5",
  "text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

function toInteger(
  value,
  fallback = 0
) {
  const parsed =
    Number.parseInt(
      String(
        value ??
          ""
      ),
      10
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}

function normalizeBoolean(
  value,
  fallback = false
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    value === 1 ||
    value === "1"
  ) {
    return true;
  }

  if (
    value === 0 ||
    value === "0"
  ) {
    return false;
  }

  const normalized =
    String(
      value ??
        ""
    )
      .trim()
      .toLowerCase();

  if (
    [
      "true",
      "active",
      "enabled",
      "yes",
    ].includes(
      normalized
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "inactive",
      "disabled",
      "no",
    ].includes(
      normalized
    )
  ) {
    return false;
  }

  return fallback;
}

function normalizeCompany(
  company
) {
  if (
    !company ||
    typeof company !==
      "object"
  ) {
    return null;
  }

  const id =
    toInteger(
      company.id ??
        company.companyId ??
        company.company_id,
      0
    );

  const companyName =
    String(
      company.companyName ??
        company.company_name ??
        company.company ??
        company.name ??
        ""
    ).trim();

  if (
    !id ||
    !companyName
  ) {
    return null;
  }

  return {
    id,

    companyName,

    isActive:
      normalizeBoolean(
        company.isActive ??
          company.is_active ??
          company.active,
        true
      ),

    positionCount:
      Math.max(
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

    activePositionCount:
      Math.max(
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

    assignedCoordinatorCount:
      Math.max(
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

function normalizeCompaniesResponse(
  data
) {
  const rawCompanies =
    Array.isArray(
      data
    )
      ? data
      : Array.isArray(
            data?.companies
          )
        ? data.companies
        : [];

  return rawCompanies
    .map(
      normalizeCompany
    )
    .filter(
      Boolean
    )
    .sort(
      (
        left,
        right
      ) => {
        if (
          left.isActive !==
          right.isActive
        ) {
          return left.isActive
            ? -1
            : 1;
        }

        return left.companyName.localeCompare(
          right.companyName,
          "en",
          {
            sensitivity:
              "base",
          }
        );
      }
    );
}

async function requestJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await authenticatedFetch(
        url,
        {
          ...options,

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            ...(
              options.headers ||
              {}
            ),
          },
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => null
        );

    if (
      !response.ok
    ) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } finally {
    window.clearTimeout(
      timeoutId
    );
  }
}

function getConfigurationErrorMessage(
  error,
  fallbackMessage
) {
  if (
    error?.name ===
    "AbortError"
  ) {
    return "The server took too long to respond. Check that the backend and database are running, then try again.";
  }

  return (
    error?.message ||
    fallbackMessage
  );
}

function emitCompaniesUpdated(
  action
) {
  window.dispatchEvent(
    new CustomEvent(
      "dataUpdated",
      {
        detail: {
          source:
            "client-companies-configuration",

          domain:
            "system-configuration",

          action,

          at:
            Date.now(),
        },
      }
    )
  );
}

function CompanyStatusBadge({
  isActive,
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold",

        isActive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300",
      ].join(
        " "
      )}
    >
      {isActive ? (
        <FiCheckCircle
          aria-hidden="true"
        />
      ) : (
        <FiSlash
          aria-hidden="true"
        />
      )}

      {isActive
        ? "Active"
        : "Inactive"}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon,
}) {
  const MetricIcon =
    icon;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {MetricIcon ? (
            <MetricIcon
              aria-hidden="true"
            />
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
          </p>

          <p className="mt-1 text-xl font-extrabold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClientCompaniesTab({
  canEdit = false,
}) {
  const isMountedRef =
    useRef(
      true
    );

  const [
    companies,
    setCompanies,
  ] =
    useState(
      []
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true
    );

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false
    );

  const [
    configurationError,
    setConfigurationError,
  ] =
    useState(
      ""
    );

  const [
    query,
    setQuery,
  ] =
    useState(
      ""
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState(
      "All"
    );

  const [
    showAddDialog,
    setShowAddDialog,
  ] =
    useState(
      false
    );

  const [
    newCompanyName,
    setNewCompanyName,
  ] =
    useState(
      ""
    );

  const [
    companyFormError,
    setCompanyFormError,
  ] =
    useState(
      ""
    );

  const [
    pendingStatusCompany,
    setPendingStatusCompany,
  ] =
    useState(
      null
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState(
      ""
    );

  const loadCompanies =
    useCallback(
      async ({
        showLoading =
          true,

        showError =
          true,
      } = {}) => {
        if (
          showLoading
        ) {
          setIsLoading(
            true
          );
        }

        if (
          showError
        ) {
          setConfigurationError(
            ""
          );
        }

        try {
          const data =
            await requestJson(
              CLIENT_COMPANIES_API_URL
            );

          if (
            !isMountedRef.current
          ) {
            return false;
          }

          setCompanies(
            normalizeCompaniesResponse(
              data
            )
          );

          return true;
        } catch (
          error
        ) {
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
            setIsLoading(
              false
            );
          }
        }
      },
      []
    );

  useEffect(
    () => {
      isMountedRef.current =
        true;

      void loadCompanies();

      return () => {
        isMountedRef.current =
          false;
      };
    },
    [
      loadCompanies,
    ]
  );

  const activeCompanyCount =
    useMemo(
      () =>
        companies.filter(
          (
            company
          ) =>
            company.isActive
        ).length,
      [
        companies,
      ]
    );

  const inactiveCompanyCount =
    companies.length -
    activeCompanyCount;

  const totalActivePositions =
    useMemo(
      () =>
        companies.reduce(
          (
            total,
            company
          ) =>
            total +
            company.activePositionCount,
          0
        ),
      [
        companies,
      ]
    );

  const totalAssignedCoordinators =
    useMemo(
      () =>
        companies.reduce(
          (
            total,
            company
          ) =>
            total +
            company.assignedCoordinatorCount,
          0
        ),
      [
        companies,
      ]
    );

  const filteredCompanies =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        return companies.filter(
          (
            company
          ) => {
            const matchesQuery =
              !normalizedQuery ||
              company.companyName
                .toLowerCase()
                .includes(
                  normalizedQuery
                );

            const matchesStatus =
              statusFilter ===
                "All" ||
              (
                statusFilter ===
                  "Active" &&
                company.isActive
              ) ||
              (
                statusFilter ===
                  "Inactive" &&
                !company.isActive
              );

            return (
              matchesQuery &&
              matchesStatus
            );
          }
        );
      },
      [
        companies,
        query,
        statusFilter,
      ]
    );

  const normalizedNewCompanyName =
    newCompanyName
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  const handleOpenAddDialog =
    useCallback(
      () => {
        if (
          !canEdit ||
          isSaving
        ) {
          return;
        }

        setNewCompanyName(
          ""
        );

        setCompanyFormError(
          ""
        );

        setShowAddDialog(
          true
        );
      },
      [
        canEdit,
        isSaving,
      ]
    );

  const handleCloseAddDialog =
    useCallback(
      () => {
        if (
          isSaving
        ) {
          return;
        }

        setShowAddDialog(
          false
        );

        setNewCompanyName(
          ""
        );

        setCompanyFormError(
          ""
        );
      },
      [
        isSaving,
      ]
    );

  const handleAddCompany =
    useCallback(
      async () => {
        if (
          !canEdit ||
          isSaving
        ) {
          return;
        }

        if (
          !normalizedNewCompanyName
        ) {
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
          setIsSaving(
            true
          );

          setCompanyFormError(
            ""
          );

          setConfigurationError(
            ""
          );

          const data =
            await requestJson(
              CLIENT_COMPANIES_API_URL,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    companyName:
                      normalizedNewCompanyName,
                  }),
              }
            );

          if (
            !isMountedRef.current
          ) {
            return;
          }

          setShowAddDialog(
            false
          );

          setNewCompanyName(
            ""
          );

          setSuccessMessage(
            data?.message ||
              `${normalizedNewCompanyName} was added successfully.`
          );

          emitCompaniesUpdated(
            "ADD_CLIENT_COMPANY"
          );

          const refreshed =
            await loadCompanies({
              showLoading:
                false,

              showError:
                false,
            });

          if (
            !refreshed &&
            isMountedRef.current
          ) {
            setConfigurationError(
              "The company was added successfully, but the refreshed company list could not be loaded. Refresh the page to verify the latest configuration."
            );
          }
        } catch (
          error
        ) {
          console.error(
            "Unable to add client company:",
            error
          );

          if (
            isMountedRef.current
          ) {
            setCompanyFormError(
              getConfigurationErrorMessage(
                error,
                "Unable to add the client company."
              )
            );
          }
        } finally {
          if (
            isMountedRef.current
          ) {
            setIsSaving(
              false
            );
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
      (
        company
      ) => {
        if (
          !canEdit ||
          isSaving ||
          !company?.id
        ) {
          return;
        }

        setConfigurationError(
          ""
        );

        setPendingStatusCompany(
          company
        );
      },
      [
        canEdit,
        isSaving,
      ]
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
          setIsSaving(
            true
          );

          setConfigurationError(
            ""
          );

          const data =
            await requestJson(
              `${CLIENT_COMPANIES_API_URL}/${encodeURIComponent(
                pendingStatusCompany.id
              )}/status`,
              {
                method:
                  "PATCH",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    isActive:
                      nextIsActive,
                  }),
              }
            );

          if (
            !isMountedRef.current
          ) {
            return;
          }

          setPendingStatusCompany(
            null
          );

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
              showLoading:
                false,

              showError:
                false,
            });

          if (
            !refreshed &&
            isMountedRef.current
          ) {
            setConfigurationError(
              "The company status was updated successfully, but the refreshed company list could not be loaded. Refresh the page to verify the latest configuration."
            );
          }
        } catch (
          error
        ) {
          console.error(
            "Unable to update client company status:",
            error
          );

          if (
            isMountedRef.current
          ) {
            setPendingStatusCompany(
              null
            );

            setConfigurationError(
              getConfigurationErrorMessage(
                error,
                "Unable to update the client company status."
              )
            );
          }
        } finally {
          if (
            isMountedRef.current
          ) {
            setIsSaving(
              false
            );
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
        .assignedCoordinatorCount >
        0
    );

  return (
    <div className="space-y-6">
      {configurationError && (
        <section
          role="alert"
          className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <div className="flex items-start gap-3">
            <FiAlertTriangle
              className="mt-0.5 shrink-0"
              size={20}
              aria-hidden="true"
            />

            <div className="min-w-0">
              <h3 className="font-extrabold">
                Client company
                configuration error
              </h3>

              <p className="mt-1 text-sm leading-6">
                {
                  configurationError
                }
              </p>

              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    isLoading ||
                    isSaving
                  }
                  onClick={() =>
                    loadCompanies()
                  }
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
                <FiBriefcase
                  size={22}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Client Company
                  Master
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">
                  Manage approved
                  client companies used
                  for employee
                  deployment,
                  company-specific
                  positions, and HR
                  Coordinator
                  assignment.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {
                      companies.length
                    }{" "}
                    total{" "}
                    {companies.length ===
                    1
                      ? "company"
                      : "companies"}
                  </span>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {
                      activeCompanyCount
                    }{" "}
                    active
                  </span>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    Add +
                    deactivate/reactivate
                    only
                  </span>
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={
                    <FiRotateCcw />
                  }
                  disabled={
                    isLoading ||
                    isSaving
                  }
                  onClick={() =>
                    loadCompanies()
                  }
                >
                  Refresh
                </Button>

                <Button
                  type="button"
                  leftIcon={
                    <FiPlus />
                  }
                  disabled={
                    isLoading ||
                    isSaving ||
                    Boolean(
                      configurationError
                    )
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
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
          <MetricCard
            label="Active Companies"
            value={
              activeCompanyCount
            }
            icon={
              FiCheckCircle
            }
          />

          <MetricCard
            label="Inactive Companies"
            value={
              inactiveCompanyCount
            }
            icon={
              FiSlash
            }
          />

          <MetricCard
            label="Active Positions"
            value={
              totalActivePositions
            }
            icon={
              FiMapPin
            }
          />

          <MetricCard
            label="Assigned Coordinators"
            value={
              totalAssignedCoordinators
            }
            icon={
              FiUsers
            }
          />
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
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
              Search client
              companies
            </label>

            <input
              id="client-company-search"
              type="search"
              value={
                query
              }
              onChange={(
                event
              ) =>
                setQuery(
                  event.target.value
                )
              }
              placeholder="Search company name..."
              className={`${INPUT_CLASS_NAME} pl-11`}
            />
          </div>

          <div>
            <label
              htmlFor="client-company-status-filter"
              className="sr-only"
            >
              Filter by company
              status
            </label>

            <select
              id="client-company-status-filter"
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className={
                INPUT_CLASS_NAME
              }
            >
              <option value="All">
                All Statuses
              </option>

              <option value="Active">
                Active
              </option>

              <option value="Inactive">
                Inactive
              </option>
            </select>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section
          role="status"
          className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 text-sm font-semibold text-indigo-800 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
        >
          Loading client company
          configuration...
        </section>
      ) : filteredCompanies.length ? (
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-slate-800/70">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Client Company
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Positions
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    HR Coordinators
                  </th>

                  {canEdit && (
                    <th className="px-5 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Action
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredCompanies.map(
                  (
                    company
                  ) => {
                    const deactivationBlocked =
                      company.isActive &&
                      company
                        .assignedCoordinatorCount >
                        0;

                    return (
                      <tr
                        key={
                          company.id
                        }
                        className="align-top transition hover:bg-gray-50/80 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                              <FiBriefcase
                                aria-hidden="true"
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="break-words font-extrabold text-gray-900 dark:text-white">
                                {
                                  company.companyName
                                }
                              </p>

                              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                Company ID:{" "}
                                {
                                  company.id
                                }
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <CompanyStatusBadge
                            isActive={
                              company.isActive
                            }
                          />
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-extrabold text-gray-900 dark:text-white">
                            {
                              company.activePositionCount
                            }{" "}
                            active
                          </p>

                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {
                              company.positionCount
                            }{" "}
                            total
                            configured
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-extrabold text-gray-900 dark:text-white">
                            {
                              company.assignedCoordinatorCount
                            }
                          </p>

                          {deactivationBlocked && (
                            <p className="mt-1 max-w-xs text-xs leading-5 text-amber-700 dark:text-amber-300">
                              Reassign the HR
                              Coordinator before
                              deactivating this
                              company.
                            </p>
                          )}
                        </td>

                        {canEdit && (
                          <td className="px-5 py-4 text-right">
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
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/60">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-300">
            <FiBriefcase
              size={22}
              aria-hidden="true"
            />
          </div>

          <h3 className="mt-4 font-extrabold text-gray-900 dark:text-white">
            No client companies
            found
          </h3>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            {companies.length
              ? "No company matches the current search and status filters."
              : "No client company has been configured yet."}
          </p>
        </section>
      )}

      <Dialog
        open={
          showAddDialog
        }
        onClose={
          handleCloseAddDialog
        }
        title="Add Client Company"
        description="Add an approved client company for future employee deployment, position configuration, and HR Coordinator assignment."
        size="md"
        preventClose={
          isSaving
        }
        closeOnOverlay={
          !isSaving
        }
        closeOnEscape={
          !isSaving
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={
                isSaving
              }
              onClick={
                handleCloseAddDialog
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              leftIcon={
                <FiPlus />
              }
              loading={
                isSaving
              }
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
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              <div className="flex items-start gap-3">
                <FiAlertTriangle
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <p className="leading-6">
                  {
                    companyFormError
                  }
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
              value={
                newCompanyName
              }
              maxLength={
                MAX_COMPANY_NAME_LENGTH
              }
              placeholder="Example: Toyota"
              disabled={
                isSaving
              }
              autoComplete="off"
              onChange={(
                event
              ) => {
                setNewCompanyName(
                  event.target.value
                );

                setCompanyFormError(
                  ""
                );
              }}
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                    "Enter" &&
                  !isSaving
                ) {
                  event.preventDefault();

                  void handleAddCompany();
                }
              }}
              className={
                INPUT_CLASS_NAME
              }
            />

            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Company names must be
                unique. Renaming is
                intentionally not
                available in this
                version.
              </span>

              <span className="shrink-0 font-semibold">
                {
                  newCompanyName.length
                }
                /
                {
                  MAX_COMPANY_NAME_LENGTH
                }
              </span>
            </div>
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={
          Boolean(
            pendingStatusCompany
          )
        }
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
        loading={
          isSaving
        }
        disabled={
          pendingDeactivationBlocked
        }
        closeOnBackdrop={
          !isSaving
        }
        onClose={() => {
          if (
            !isSaving
          ) {
            setPendingStatusCompany(
              null
            );
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
            The company will become
            available again for new
            deployment choices,
            position management, and
            HR Coordinator assignment.
          </p>
        ) : (
          <>
            <p className="mt-2">
              Deactivation removes
              this company from future
              active selection lists.
              Existing employee and
              deployment history will
              remain unchanged.
            </p>

            {pendingDeactivationBlocked && (
              <p className="mt-3 font-semibold text-amber-700 dark:text-amber-300">
                This company cannot be
                deactivated while an
                HR Coordinator is
                assigned to it.
                Reassign the
                coordinator first.
              </p>
            )}
          </>
        )}
      </ConfirmDialog>

      <SuccessToast
        title="Client company updated"
        message={
          successMessage
        }
        duration={
          4000
        }
        onClose={() =>
          setSuccessMessage(
            ""
          )
        }
      />
    </div>
  );
}