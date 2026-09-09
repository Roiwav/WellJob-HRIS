import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiActivity,
  FiClock,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";

import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import SearchInput from "../ui/SearchInput";
import FilterBar from "../ui/FilterBar";
import LoadingSkeleton from "../ui/LoadingSkeleton";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";

import authenticatedFetch from "../../utils/authenticatedFetch";
import { API_BASE } from "../../config/api";

const AUDIT_LOGS_API_URL =
  `${API_BASE}/audit-logs`;

const REQUEST_TIMEOUT_MS = 15000;
const AUDIT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;
const DATA_UPDATE_DEBOUNCE_MS = 300;

const activeAuditRequests =
  new Map();

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  IT_SUPPORT: "IT Support",
};

const ACTION_STYLE = {
  LOGIN:
    "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",

  LOGIN_SUCCESS:
    "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",

  LOGIN_FAILED:
    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",

  CREATE_USER:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",

  RESET_PASSWORD:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",

  CHANGE_PASSWORD:
    "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",

  TOGGLE_USER_STATUS:
    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",

  ADD_EMPLOYEE:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",

  CREATE_EMPLOYEE:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",

  EDIT_EMPLOYEE:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",

  UPDATE_EMPLOYEE:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",

  ARCHIVE_EMPLOYEE:
    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",

  RESTORE_EMPLOYEE:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",

  DELETE_EMPLOYEE:
    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",

  ADD_INCIDENT:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",

  CREATE_INCIDENT:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",

  UPDATE_INCIDENT:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",

  REVIEW_INCIDENT:
    "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",

  RESOLVE_INCIDENT:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",

  ADD_DEPLOYMENT:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",

  CREATE_DEPLOYMENT:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",

  UPDATE_DEPLOYMENT:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",

  CANCEL_DEPLOYMENT:
    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",

  COMPLETE_DEPLOYMENT:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const SELECT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5",
  "text-sm font-semibold text-gray-900 shadow-sm outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

function escapeRegExp(value) {
  return String(value || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function getActorName(log) {
  return (
    log?.full_name ||
    log?.fullName ||
    log?.name ||
    log?.username ||
    "Unknown User"
  );
}

function getReadableAuditDescription(log) {
  const description = String(
    log?.description || ""
  ).trim();

  const actorName =
    getActorName(log);

  if (!description) {
    return "-";
  }

  const possiblePrefixes = [
    log?.username,
    log?.user_id,
  ]
    .filter(Boolean)
    .map(escapeRegExp);

  if (possiblePrefixes.length > 0) {
    const prefixRegex =
      new RegExp(
        `^(${possiblePrefixes.join(
          "|"
        )})\\s+`,
        "i"
      );

    return description.replace(
      prefixRegex,
      `${actorName} `
    );
  }

  return description;
}

function getActionStyle(action) {
  if (!action) {
    return "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300";
  }

  const normalizedAction =
    String(action)
      .toUpperCase()
      .replace(/\s+/g, "_");

  return (
    ACTION_STYLE[normalizedAction] ||
    "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300"
  );
}

function formatAction(action) {
  if (!action) {
    return "-";
  }

  return String(action)
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
    )
    .join(" ");
}

function formatDate(date) {
  if (!date) {
    return "-";
  }

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "-";
  }

  return parsedDate.toLocaleString(
    "en-PH",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getLogKey(log, index) {
  return (
    log?.id ||
    log?.audit_id ||
    log?.auditId ||
    `${log?.created_at || "log"}-${index}`
  );
}

async function requestJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

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
            ...(options.headers ||
              {}),
          },
        }
      );

    const result =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.error ||
          result?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return result;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "The server took too long to respond. Check that the backend and database are running, then try again."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(
      timeoutId
    );
  }
}

function getSharedAuditRequest(
  url
) {
  if (
    !activeAuditRequests.has(
      url
    )
  ) {
    const requestPromise =
      requestJson(url).finally(
        () => {
          activeAuditRequests.delete(
            url
          );
        }
      );

    activeAuditRequests.set(
      url,
      requestPromise
    );
  }

  return activeAuditRequests.get(
    url
  );
}


function SummaryCard({
  icon,
  label,
  value,
  helper,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xl text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
          </p>

          <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white">
            {value}
          </p>

          {helper && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {helper}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsPage({
  category,
  title,
  description,
}) {
  const [logs, setLogs] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState("");

  const [role, setRole] =
    useState("ALL");

  const [page, setPage] =
    useState(1);

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    pageSize:
      AUDIT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [summary, setSummary] =
    useState({
      total: 0,
      superAdmin: 0,
      hrManager: 0,
      hrStaff: 0,
      itSupport: 0,
    });

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [pageError, setPageError] =
    useState("");

  const isMountedRef =
    useRef(true);

  const requestIdRef =
    useRef(0);

  const searchTimerRef =
    useRef(null);

  const dataUpdateTimerRef =
    useRef(null);

  const initialLoadDoneRef =
    useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (
        searchTimerRef.current
      ) {
        window.clearTimeout(
          searchTimerRef.current
        );
      }

      if (
        dataUpdateTimerRef.current
      ) {
        window.clearTimeout(
          dataUpdateTimerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    if (
      searchTimerRef.current
    ) {
      window.clearTimeout(
        searchTimerRef.current
      );
    }

    searchTimerRef.current =
      window.setTimeout(() => {
        setDebouncedSearch(
          String(search || "")
            .trim()
        );

        searchTimerRef.current =
          null;
      }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (
        searchTimerRef.current
      ) {
        window.clearTimeout(
          searchTimerRef.current
        );

        searchTimerRef.current =
          null;
      }
    };
  }, [search]);

  const fetchLogs = useCallback(
    async ({
      showInitialLoading = false,
      showRefreshing = false,
      showError = true,
    } = {}) => {
      const requestId =
        requestIdRef.current + 1;

      requestIdRef.current =
        requestId;

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
          setPageError("");
        }

        const selectedCategory =
          String(category || "")
            .trim()
            .toUpperCase();

        const query =
          new URLSearchParams({
            view: "summary",
            page:
              String(page),
            pageSize:
              String(
                AUDIT_PAGE_SIZE
              ),
            search:
              debouncedSearch,
            role,
          });

        const endpoint =
          `${AUDIT_LOGS_API_URL}/${encodeURIComponent(
            selectedCategory
          )}?${query.toString()}`;

        const result =
          await getSharedAuditRequest(
            endpoint
          );

        if (
          !isMountedRef.current ||
          requestId !==
            requestIdRef.current
        ) {
          return false;
        }

        const nextLogs =
          Array.isArray(
            result?.records
          )
            ? result.records
            : [];

        const nextPagination =
          result?.pagination ||
          {};

        const nextSummary =
          result?.summary ||
          {};

        setLogs(nextLogs);

        setPagination({
          page:
            Number(
              nextPagination.page
            ) || page,

          pageSize:
            Number(
              nextPagination.pageSize
            ) ||
            AUDIT_PAGE_SIZE,

          total:
            Math.max(
              Number(
                nextPagination.total
              ) || 0,
              0
            ),

          totalPages:
            Math.max(
              Number(
                nextPagination.totalPages
              ) || 1,
              1
            ),
        });

        setSummary({
          total:
            Math.max(
              Number(
                nextSummary.total
              ) || 0,
              0
            ),

          superAdmin:
            Math.max(
              Number(
                nextSummary.superAdmin
              ) || 0,
              0
            ),

          hrManager:
            Math.max(
              Number(
                nextSummary.hrManager
              ) || 0,
              0
            ),

          hrStaff:
            Math.max(
              Number(
                nextSummary.hrStaff
              ) || 0,
              0
            ),

          itSupport:
            Math.max(
              Number(
                nextSummary.itSupport
              ) || 0,
              0
            ),
        });

        initialLoadDoneRef.current =
          true;

        return true;
      } catch (error) {
        console.error(
          "Fetch audit logs error:",
          error
        );

        if (
          showError &&
          isMountedRef.current &&
          requestId ===
            requestIdRef.current
        ) {
          setPageError(
            error?.message ||
              "Unable to load audit logs."
          );
        }

        return false;
      } finally {
        if (
          isMountedRef.current &&
          requestId ===
            requestIdRef.current
        ) {
          if (showInitialLoading) {
            setIsLoading(false);
          }

          if (showRefreshing) {
            setIsRefreshing(false);
          }
        }
      }
    },
    [
      category,
      debouncedSearch,
      page,
      role,
    ]
  );

  useEffect(() => {
    void fetchLogs({
      showInitialLoading:
        !initialLoadDoneRef.current,
    });
  }, [fetchLogs]);

  useEffect(() => {
    const handleDataUpdated = () => {
      if (
        dataUpdateTimerRef.current
      ) {
        window.clearTimeout(
          dataUpdateTimerRef.current
        );
      }

      dataUpdateTimerRef.current =
        window.setTimeout(() => {
          void fetchLogs({
            showError: false,
          });

          dataUpdateTimerRef.current =
            null;
        }, DATA_UPDATE_DEBOUNCE_MS);
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

        dataUpdateTimerRef.current =
          null;
      }

      window.removeEventListener(
        "dataUpdated",
        handleDataUpdated
      );
    };
  }, [fetchLogs]);

  const uniqueUsers =
    useMemo(() => {
      const users = logs
        .map((log) =>
          getActorName(log)
        )
        .filter(Boolean)
        .map((name) =>
          String(name)
            .trim()
            .toLowerCase()
        );

      return new Set(
        users
      ).size;
    }, [logs]);

  const availableRoles =
    useMemo(() => {
      const roleCounts = {
        SUPER_ADMIN:
          summary.superAdmin,
        HR_MANAGER:
          summary.hrManager,
        HR_STAFF:
          summary.hrStaff,
        IT_SUPPORT:
          summary.itSupport,
      };

      return Object.keys(
        ROLE_LABELS
      ).filter(
        (roleName) =>
          Number(
            roleCounts[roleName]
          ) > 0
      );
    }, [summary]);

  const hasSearch =
    Boolean(search.trim());

  const hasRoleFilter =
    role !== "ALL";

  const hasActiveFilters =
    hasSearch ||
    hasRoleFilter;

  const handleRefresh =
    useCallback(async () => {
      if (
        isLoading ||
        isRefreshing
      ) {
        return;
      }

      await fetchLogs({
        showRefreshing: true,
      });
    }, [
      fetchLogs,
      isLoading,
      isRefreshing,
    ]);

  const handleClearFilters =
    useCallback(() => {
      if (
        searchTimerRef.current
      ) {
        window.clearTimeout(
          searchTimerRef.current
        );

        searchTimerRef.current =
          null;
      }

      setSearch("");
      setDebouncedSearch("");
      setRole("ALL");
      setPage(1);
    }, []);

  const emptyStateContent =
    useMemo(() => {
      if (
        summary.total === 0
      ) {
        return {
          icon: "records",
          title:
            "No audit logs available",
          description:
            "Audit activity will appear here after authorized system actions are recorded.",
        };
      }

      if (hasSearch) {
        return {
          icon: "search",
          title:
            "No search results",
          description:
            "No audit logs matched the current search.",
        };
      }

      if (hasRoleFilter) {
        return {
          icon: "filter",
          title:
            "No role-filter results",
          description:
            "Audit logs exist, but none match the selected role.",
        };
      }

      return {
        icon: "records",
        title:
          "No audit logs found",
        description:
          "No audit records are currently available.",
      };
    }, [
      hasRoleFilter,
      hasSearch,
      summary.total,
    ]);

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="System Monitoring"
        title={title}
        description={
          description
        }
        icon={
          <FiShield
            size={22}
          />
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
                aria-hidden="true"
              />
            }
            loading={
              isRefreshing
            }
            disabled={
              isLoading ||
              isRefreshing
            }
            onClick={
              handleRefresh
            }
          >
            Refresh Logs
          </Button>
        }
      />

      {pageError && (
        <ErrorState
          compact
          title="Audit log error"
          message={
            pageError
          }
          retryLabel="Reload audit logs"
          onRetry={
            handleRefresh
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          icon={
            <FiActivity
              aria-hidden="true"
            />
          }
          label="Total Logs"
          value={summary.total}
          helper="All audit records"
        />

        <SummaryCard
          icon={
            <FiShield
              aria-hidden="true"
            />
          }
          label="Users"
          value={
            uniqueUsers
          }
          helper="Unique actors on this page"
        />

        <SummaryCard
          icon={
            <FiClock
              aria-hidden="true"
            />
          }
          label="Shown Records"
          value={
            logs.length
          }
          helper="Records on this page"
        />
      </div>

      <FilterBar
        resultCount={
          pagination.total
        }
        resultLabel="audit log"
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={
              !hasActiveFilters ||
              isLoading ||
              isRefreshing
            }
            onClick={
              handleClearFilters
            }
          >
            Clear Filters
          </Button>
        }
      >
        <div className="w-full sm:col-span-2 xl:w-96">
          <SearchInput
            label="Search audit logs"
            hideLabel
            placeholder="Search user, action, role, or description..."
            value={search}
            disabled={
              isLoading ||
              isRefreshing
            }
            onChange={(
              event
            ) => {
              setSearch(
                event.target.value
              );
              setPage(1);
            }}
            onClear={() => {
              if (
                searchTimerRef.current
              ) {
                window.clearTimeout(
                  searchTimerRef.current
                );

                searchTimerRef.current =
                  null;
              }

              setSearch("");
              setDebouncedSearch("");
              setPage(1);
            }}
          />
        </div>

        <div className="min-w-0 xl:w-56">
          <label
            htmlFor={`audit-role-filter-${category}`}
            className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300"
          >
            User Role
          </label>

          <select
            id={`audit-role-filter-${category}`}
            value={role}
            disabled={
              isLoading ||
              isRefreshing
            }
            onChange={(
              event
            ) => {
              setRole(
                event.target.value
              );
              setPage(1);
            }}
            className={
              SELECT_CLASS_NAME
            }
          >
            <option value="ALL">
              All Roles
            </option>

            {availableRoles.map(
              (roleName) => (
                <option
                  key={
                    roleName
                  }
                  value={
                    roleName
                  }
                >
                  {ROLE_LABELS[
                    roleName
                  ] ||
                    formatAction(
                      roleName
                    )}
                </option>
              )
            )}
          </select>
        </div>
      </FilterBar>

      {isLoading ? (
        <LoadingSkeleton
          rows={7}
          columns={5}
          showHeader
        />
      ) : logs.length ===
        0 ? (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
          <EmptyState
            icon={
              emptyStateContent.icon
            }
            title={
              emptyStateContent.title
            }
            description={
              emptyStateContent.description
            }
            secondaryActionLabel={
              hasActiveFilters
                ? "Clear filters"
                : ""
            }
            onSecondaryAction={
              hasActiveFilters
                ? handleClearFilters
                : undefined
            }
          />
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <header className="border-b border-gray-200 px-5 py-5 sm:px-6 dark:border-white/10">
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
              Audit Records
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Review recorded
              system and
              operational
              activity.
            </p>
          </header>

          <div className="max-h-[680px] overflow-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    Date & Time
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    User
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    Role
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    Action
                  </th>

                  <th
                    scope="col"
                    className="px-6 py-4"
                  >
                    Description
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-white/5 dark:text-gray-200">
                {logs.map(
                  (
                    log,
                    index
                  ) => {
                    const actorName =
                      getActorName(
                        log
                      );

                    const readableDescription =
                      getReadableAuditDescription(
                        log
                      );

                    return (
                      <tr
                        key={getLogKey(
                          log,
                          index
                        )}
                        className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-white/5"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                          {formatDate(
                            log?.created_at ||
                              log?.createdAt
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate font-semibold text-gray-900 dark:text-white">
                              {
                                actorName
                              }
                            </p>

                            {log?.username &&
                              actorName !==
                                log.username && (
                                <p className="mt-0.5 max-w-[220px] truncate text-xs text-gray-500 dark:text-gray-400">
                                  @
                                  {
                                    log.username
                                  }
                                </p>
                              )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {ROLE_LABELS[
                              log
                                ?.role
                            ] ||
                              formatAction(
                                log
                                  ?.role
                              )}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={[
                              "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                              getActionStyle(
                                log?.action
                              ),
                            ].join(
                              " "
                            )}
                          >
                            {formatAction(
                              log?.action
                            )}
                          </span>
                        </td>

                        <td className="min-w-[320px] px-6 py-4 leading-6 text-gray-600 dark:text-gray-300">
                          {
                            readableDescription
                          }
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pagination.total > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Page{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {pagination.page}
            </span>
            {" of "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {pagination.totalPages}
            </span>
            {" • "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {pagination.total}
            </span>{" "}
            matching audit log(s)
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={
                page <= 1 ||
                isRefreshing
              }
              onClick={() =>
                setPage(
                  (currentPage) =>
                    Math.max(
                      1,
                      currentPage - 1
                    )
                )
              }
            >
              Previous
            </Button>

            <Button
              variant="secondary"
              size="sm"
              disabled={
                page >=
                  pagination.totalPages ||
                isRefreshing
              }
              onClick={() =>
                setPage(
                  (currentPage) =>
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
    </main>
  );
}