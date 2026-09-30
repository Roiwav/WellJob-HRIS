import {
  Fragment,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiCornerDownRight,
} from "react-icons/fi";
import FilterSelect from "./IncidentFilters";
import ActionButtons from "./IncidentActionButtons";
import Button from "../../ui/Button";
import EmptyState from "../../ui/EmptyState";
import LoadingSkeleton from "../../ui/LoadingSkeleton";
import SearchInput from "../../ui/SearchInput";
import {
  CaseAgeBadge,
  SeverityBadge,
  SmartAlertBadge,
  StatusBadge,
} from "../badges/IncidentBadges";
const CASE_TABS = [
  {
    key: "ACTIVE",
    label: "Active Cases",
    description: "Open and Investigating",
  },
  {
    key: "FOR_REVIEW",
    label: "For Review",
    description: "Submitted resolution proof",
  },
  {
    key: "CLOSED",
    label: "Closed Cases",
    description: "Approved and completed",
  },
  {
    key: "ALL",
    label: "All Records",
    description: "Complete incident history",
  },
];
const DEFAULT_CASE_COUNTS = {
  ALL: 0,
  ACTIVE: 0,
  FOR_REVIEW: 0,
  CLOSED: 0,
};

const CASE_STATUS_OPTIONS = [
  "ALL",
  "Open",
  "Investigating",
  "For Review",
  "Closed",
];
function normalizeValue(value) {
  return String(value ?? "").trim();
}
function normalizeRole(value) {
  const role = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (
    role === "HRCOORDINATOR" ||
    role === "HR_COORDINATOR"
  ) {
    return "HR_COORDINATOR";
  }
  return role;
}
function getIncidentEmployeeName(incident) {
  return (
    incident?.employee ||
    incident?.employeeName ||
    incident?.employee_name ||
    "Unknown Employee"
  );
}
function getIncidentEmployeeId(incident) {
  return (
    incident?.employeeId ||
    incident?.employee_id ||
    ""
  );
}
function getIncidentViolation(incident) {
  return (
    incident?.violation ||
    incident?.violationType ||
    incident?.violation_type ||
    "No violation type"
  );
}
function getIncidentCompany(incident) {
  return (
    incident?.company ||
    incident?.clientCompany ||
    incident?.client_company ||
    "Unassigned"
  );
}
function getIncidentTimestamp(incident) {
  const value =
    incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.createdAt ||
    incident?.created_at ||
    null;
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}
function formatIncidentDate(incident) {
  const timestamp = getIncidentTimestamp(incident);
  if (!timestamp) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}
function buildIncidentGroupKey(incident) {
  const employeeIdentifier =
    normalizeValue(
      getIncidentEmployeeId(incident)
    ).toLowerCase() ||
    normalizeValue(
      getIncidentEmployeeName(incident)
    ).toLowerCase() ||
    "unknown-employee";
  const violationIdentifier =
    normalizeValue(
      getIncidentViolation(incident)
    ).toLowerCase() ||
    "unknown-violation";
  return `${employeeIdentifier}::${violationIdentifier}`;
}
function getIncidentRecordKey(
  incident,
  fallbackIndex = 0
) {
  return (
    incident?.id ||
    incident?.displayId ||
    `${buildIncidentGroupKey(
      incident
    )}-${getIncidentTimestamp(
      incident
    )}-${fallbackIndex}`
  );
}
function getTabStyle(isActive, tabKey) {
  if (!isActive) {
    return "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:ring-slate-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";
  }
  if (tabKey === "ACTIVE") {
    return "border-amber-300 bg-amber-50 text-amber-800 shadow-sm focus-visible:ring-amber-500/25 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  }
  if (tabKey === "FOR_REVIEW") {
    return "border-violet-300 bg-violet-50 text-violet-800 shadow-sm focus-visible:ring-violet-500/25 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  }
  if (tabKey === "CLOSED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm focus-visible:ring-emerald-500/25 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  return "border-slate-300 bg-slate-100 text-slate-800 shadow-sm focus-visible:ring-slate-500/25 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
}
function getEmptyStateContent({
  totalIncidentCount,
  search,
  caseTab,
  severityFilter,
  caseStatusFilter,
}) {
  const hasSearch = Boolean(
    String(search || "").trim()
  );
  const hasSeverityFilter =
    severityFilter !== "ALL";
  const hasCaseStatusFilter =
    caseTab === "ALL" &&
    caseStatusFilter !== "ALL";
  const hasCaseFilter =
    caseTab !== "ALL";
  if (totalIncidentCount === 0) {
    return {
      icon: "records",
      title: "No incident records",
      description:
        "Incident records will appear here after an authorized HR user reports a case.",
    };
  }
  if (hasSearch) {
    return {
      icon: "search",
      title: "No search results",
      description:
        "No incident matched the current search. Try another incident ID, employee, company, or violation.",
    };
  }
  if (hasSeverityFilter) {
    return {
      icon: "filter",
      title: "No severity-filter results",
      description:
        "Incident records exist, but none match the selected severity level.",
    };
  }
  if (hasCaseStatusFilter) {
    return {
      icon: "filter",
      title: "No case-status results",
      description:
        "Incident records exist, but none match the selected case status.",
    };
  }

  if (hasCaseFilter) {
    const tabLabel =
      CASE_TABS.find(
        (tab) => tab.key === caseTab
      )?.label ||
      "selected case category";
    return {
      icon: "records",
      title: `No ${tabLabel.toLowerCase()}`,
      description:
        "No incident records currently belong to this case category.",
    };
  }
  return {
    icon: "records",
    title: "No incident records found",
    description:
      "No incident records are currently available.",
  };
}
export default function IncidentTable({
  isLoading = false,
  isRefreshing = false,
  incidents = [],
  totalIncidentCount = 0,
  search = "",
  onSearchChange,
  onClearSearch,
  onClearFilters,
  caseTab = "ACTIVE",
  onCaseTabChange,
  caseCounts = DEFAULT_CASE_COUNTS,
  severityFilter = "ALL",
  onSeverityFilterChange,
  caseStatusFilter = "ALL",
  onCaseStatusFilterChange,
  isSuperAdmin = false,
  isHRCoordinator = false,
  currentUser,
  formatIncidentCode,
  onView,
  onStartReview,
  onResolve,
  onReview,
}) {
  const [expandedGroups, setExpandedGroups] =
    useState({});
  /*
   * ==================================================
   * OPTION A — HISTORICAL LIST ONLY
   * ==================================================
   *
   * Historical incidents may remain visible to an
   * HR Coordinator from the incident's original
   * company, but must not offer full-detail access
   * after the employee transfers to another company.
   *
   * This table checks BOTH:
   *
   * - isHistorical === true
   * - canViewDetails === false
   *
   * The backend remains the source of truth for
   * incident-detail and evidence authorization.
   */
  const isHrCoordinator =
    isHRCoordinator ||
    normalizeRole(currentUser?.role) ===
      "HR_COORDINATOR";
  const isRestrictedHistoricalIncident =
    useCallback(
      (incident) => {
        return (
          isHrCoordinator &&
          (
            incident?.isHistorical === true ||
            incident?.canViewDetails === false
          )
        );
      },
      [isHrCoordinator]
    );
  /*
   * A row can open details only when the record is
   * not a restricted historical incident.
   *
   * The same check is used for mouse, keyboard,
   * expanded history rows, and ActionButtons.
   */
  const canOpenIncidentDetails =
    useCallback(
      (incident) => {
        return (
          Boolean(incident?.id) &&
          typeof onView === "function" &&
          !isRestrictedHistoricalIncident(
            incident
          )
        );
      },
      [
        isRestrictedHistoricalIncident,
        onView,
      ]
    );
  const safeIncidents = useMemo(
    () =>
      Array.isArray(incidents)
        ? incidents.filter(Boolean)
        : [],
    [incidents]
  );
  const safeTotalIncidentCount =
    Number.isFinite(
      Number(totalIncidentCount)
    )
      ? Number(totalIncidentCount)
      : safeIncidents.length;
  const hasSearch = Boolean(
    String(search || "").trim()
  );
  const controlsDisabled =
    isLoading || isRefreshing;
  const hasActiveFilters =
    hasSearch ||
    severityFilter !== "ALL" ||
    (
      caseTab === "ALL" &&
      caseStatusFilter !== "ALL"
    ) ||
    caseTab !== "ALL";
  const getIncidentDisplayId = useCallback(
    (incident) => {
      if (incident?.displayId) {
        return incident.displayId;
      }
      if (
        typeof formatIncidentCode ===
        "function"
      ) {
        return formatIncidentCode(
          incident?.id
        );
      }
      if (!incident?.id) {
        return "-";
      }
      const numericId = Number(incident.id);
      if (Number.isFinite(numericId)) {
        return `INC-${String(
          numericId
        ).padStart(4, "0")}`;
      }
      return String(incident.id);
    },
    [formatIncidentCode]
  );
  const toggleGroup = useCallback(
    (groupKey) => {
      setExpandedGroups((currentGroups) => ({
        ...currentGroups,
        [groupKey]:
          !currentGroups[groupKey],
      }));
    },
    []
  );
  /*
   * Defense in depth for frontend interaction.
   *
   * Even if another child component calls this
   * handler, historical coordinator records must
   * not trigger a detail request.
   */
  const openIncidentDetails = useCallback(
    (incident) => {
      if (
        !canOpenIncidentDetails(incident)
      ) {
        return;
      }
      onView(incident);
    },
    [
      canOpenIncidentDetails,
      onView,
    ]
  );
  const handleIncidentRowKeyDown =
    useCallback(
      (event, incident) => {
        if (
          event.key !== "Enter" &&
          event.key !== " "
        ) {
          return;
        }
        if (
          !canOpenIncidentDetails(
            incident
          )
        ) {
          return;
        }
        /*
         * If focus is on a nested control,
         * let that control handle its own key.
         */
        if (
          event.target !==
          event.currentTarget
        ) {
          return;
        }
        event.preventDefault();
        openIncidentDetails(incident);
      },
      [
        canOpenIncidentDetails,
        openIncidentDetails,
      ]
    );
  const stopRowInteraction =
    useCallback(
      (event) => {
        event.stopPropagation();
      },
      []
    );
  const groupedIncidents = useMemo(
    () => {
      const groups = new Map();
      safeIncidents.forEach((incident) => {
        const groupKey =
          buildIncidentGroupKey(
            incident
          );
        const currentGroup =
          groups.get(groupKey) || [];
        currentGroup.push(
          incident
        );
        groups.set(
          groupKey,
          currentGroup
        );
      });
      return Array.from(
        groups.entries()
      )
        .map(
          ([
            groupKey,
            groupRecords,
          ]) => {
            const sortedRecords = [
              ...groupRecords,
            ].sort(
              (
                firstRecord,
                secondRecord
              ) =>
                getIncidentTimestamp(
                  secondRecord
                ) -
                getIncidentTimestamp(
                  firstRecord
                )
            );
            return {
              key: groupKey,
              latest:
                sortedRecords[0],
              history:
                sortedRecords.slice(1),
            };
          }
        )
        .sort(
          (
            firstGroup,
            secondGroup
          ) =>
            getIncidentTimestamp(
              secondGroup.latest
            ) -
            getIncidentTimestamp(
              firstGroup.latest
            )
        );
    },
    [safeIncidents]
  );
  const emptyStateContent =
    getEmptyStateContent({
      totalIncidentCount:
        safeTotalIncidentCount,
      search,
      caseTab,
      severityFilter,
      caseStatusFilter,
    });
  return (
    <section
      className="min-w-0 space-y-4"
      aria-label="Incident records"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          role="tablist"
          aria-label="Incident case filters"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
        >
          {CASE_TABS.map((tab) => {
            const isActive =
              caseTab === tab.key;
            const count = Number(
              caseCounts?.[tab.key] || 0
            );
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="incident-records-table"
                disabled={controlsDisabled}
                onClick={() =>
                  onCaseTabChange?.(
                    tab.key
                  )
                }
                className={`rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${getTabStyle(
                  isActive,
                  tab.key
                )}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {tab.label}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-medium opacity-70">
                      {tab.description}
                    </p>
                  </div>
                  <span className="inline-flex min-w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 px-2 py-1 text-xs font-bold tabular-nums dark:bg-white/10">
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:max-w-[460px] md:flex-[1_1_460px]">
            <SearchInput
              label="Search Incident Records"
              placeholder="Search incident ID, employee, company, or violation..."
              value={search}
              disabled={controlsDisabled}
              onChange={(event) =>
                onSearchChange?.(
                  event.target.value
                )
              }
              onClear={
                typeof onClearSearch ===
                "function"
                  ? onClearSearch
                  : () =>
                      onSearchChange?.("")
              }
            />
          </div>

          <div className="w-full md:w-[220px] md:flex-none">
            <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Severity
            </p>

            <FilterSelect
              value={severityFilter}
              onChange={
                onSeverityFilterChange
              }
              options={[
                "ALL",
                "Minor",
                "Major",
                "Critical",
              ]}
              labels={{
                ALL: "All Severity",
              }}
              disabled={controlsDisabled}
            />
          </div>

          {caseTab === "ALL" && (
            <div className="w-full md:w-[220px] md:flex-none">
              <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Case Status
              </p>

              <FilterSelect
                value={caseStatusFilter}
                onChange={
                  onCaseStatusFilterChange
                }
                options={
                  CASE_STATUS_OPTIONS
                }
                labels={{
                  ALL: "All Statuses",
                }}
                disabled={controlsDisabled}
              />
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {safeIncidents.length}
            </span>{" "}
            incident {safeIncidents.length === 1 ? "record" : "records"} in this view
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={
              !hasActiveFilters ||
              controlsDisabled
            }
            onClick={onClearFilters}
          >
            Clear Filters
          </Button>
        </div>
      </section>
            {isLoading ? (
        <LoadingSkeleton
          rows={6}
          columns={7}
          showHeader
        />
      ) : groupedIncidents.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <EmptyState
            icon={emptyStateContent.icon}
            title={emptyStateContent.title}
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
                ? onClearFilters
                : undefined
            }
          />
        </section>
      ) : (
        <div
          id="incident-records-table"
          role="tabpanel"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Incident Records
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Related incidents are grouped when the same employee has multiple records for the same violation. Expand a grouped row to review earlier cases.
            </p>
          </div>
          <div className="max-h-[520px] w-full overflow-auto">
            <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50/95 text-slate-600 shadow-[0_1px_0_0_rgba(226,232,240,1)] backdrop-blur dark:bg-slate-800/95 dark:text-slate-300 dark:shadow-[0_1px_0_0_rgba(51,65,85,1)]">
                <tr>
                  <th
                    scope="col"
                    className="w-[13%] bg-slate-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95"
                  >
                    Incident ID
                  </th>
                  <th
                    scope="col"
                    className="w-[22%] bg-slate-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95"
                  >
                    Employee
                  </th>
                  <th
                    scope="col"
                    className="w-[27%] bg-slate-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95"
                  >
                    Violation
                  </th>
                  <th
                    scope="col"
                    className="w-[12%] bg-slate-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95"
                  >
                    Case Status
                  </th>
                  <th
                    scope="col"
                    className="w-[10%] bg-slate-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95"
                  >
                    Case Age
                  </th>
                  <th
                    scope="col"
                    className="w-[8%] bg-slate-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95"
                  >
                    Alerts
                  </th>
                  <th
                    scope="col"
                    className="w-[15%] bg-slate-50/95 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                {groupedIncidents.map((group) => {
                  const isExpanded = Boolean(
                    expandedGroups[group.key]
                  );
                  const hasHistory =
                    group.history.length > 0;
                  const employeeName =
                    getIncidentEmployeeName(
                      group.latest
                    );
                  const company =
                    getIncidentCompany(
                      group.latest
                    );
                  const violation =
                    getIncidentViolation(
                      group.latest
                    );
                  const latestDisplayId =
                    getIncidentDisplayId(
                      group.latest
                    );
                  /*
                   * Each incident gets its OWN permission
                   * check. A group's latest incident and
                   * its history records may have different
                   * access permissions.
                   */
                  const canViewLatest =
                    canOpenIncidentDetails(
                      group.latest
                    );
                  const latestIsHistorical =
                    isRestrictedHistoricalIncident(
                      group.latest
                    );
                  return (
                    <Fragment key={group.key}>
                      <tr
                        tabIndex={
                          canViewLatest
                            ? 0
                            : undefined
                        }
                        aria-label={
                          canViewLatest
                            ? `View details for incident ${latestDisplayId}`
                            : undefined
                        }
                        title={
                          canViewLatest
                            ? `View ${latestDisplayId} case details`
                            : latestIsHistorical
                              ? "Historical record — full details are unavailable after employee transfer."
                              : undefined
                        }
                        onClick={
                          canViewLatest
                            ? () =>
                                openIncidentDetails(
                                  group.latest
                                )
                            : undefined
                        }
                        onKeyDown={
                          canViewLatest
                            ? (event) =>
                                handleIncidentRowKeyDown(
                                  event,
                                  group.latest
                                )
                            : undefined
                        }
                        className={`transition ${
                          canViewLatest
                            ? "cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/30 dark:hover:bg-slate-800/45 dark:focus-visible:bg-slate-800/60"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/45"
                        }`}
                      >
                        <td className="px-4 py-3 align-middle">
                          <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {latestDisplayId}
                          </span>
                          {hasHistory && (
                            <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {group.history.length + 1} related records
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                              title={employeeName}
                            >
                              {employeeName}
                            </p>
                            <p
                              className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400"
                              title={company}
                            >
                              {company}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-0 space-y-2">
                            <p
                              className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100"
                              title={violation}
                            >
                              {violation}
                            </p>
                            <SeverityBadge
                              level={
                                group.latest.severity
                              }
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <StatusBadge
                            status={
                              group.latest.status
                            }
                          />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <CaseAgeBadge
                            incident={group.latest}
                          />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <SmartAlertBadge
                            alerts={
                              Array.isArray(
                                group.latest.smartAlerts
                              )
                                ? group.latest.smartAlerts
                                : []
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <div
                            className="flex items-center justify-end gap-2"
                            onClick={
                              stopRowInteraction
                            }
                            onKeyDown={
                              stopRowInteraction
                            }
                          >
                            {hasHistory && (
                              <button
                                type="button"
                                aria-label={
                                  isExpanded
                                    ? `Hide related incidents for ${employeeName}`
                                    : `Show related incidents for ${employeeName}`
                                }
                                aria-expanded={
                                  isExpanded
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleGroup(
                                    group.key
                                  );
                                }}
                                title={
                                  isExpanded
                                    ? "Hide related incidents"
                                    : "View related incidents"
                                }
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                {isExpanded ? (
                                  <FiChevronUp
                                    size={18}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <FiChevronDown
                                    size={18}
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            )}
                            <ActionButtons
                              incident={group.latest}
                              isSuperAdmin={
                                isSuperAdmin
                              }
                              currentUser={
                                currentUser
                              }
                              onView={
                                openIncidentDetails
                              }
                              onStartReview={
                                onStartReview
                              }
                              onResolve={
                                onResolve
                              }
                              onReview={
                                onReview
                              }
                            />
                          </div>
                        </td>
                      </tr>
                      {isExpanded &&
                        group.history.map(
                          (
                            historyItem,
                            historyIndex
                          ) => {
                            const historyDisplayId =
                              getIncidentDisplayId(
                                historyItem
                              );
                            const canViewHistory =
                              canOpenIncidentDetails(
                                historyItem
                              );
                            const historyIsRestricted =
                              isRestrictedHistoricalIncident(
                                historyItem
                              );
                            return (
                              <tr
                                key={getIncidentRecordKey(
                                  historyItem,
                                  historyIndex
                                )}
                                tabIndex={
                                  canViewHistory
                                    ? 0
                                    : undefined
                                }
                                aria-label={
                                  canViewHistory
                                    ? `View details for incident ${historyDisplayId}`
                                    : undefined
                                }
                                title={
                                  canViewHistory
                                    ? `View ${historyDisplayId} case details`
                                    : historyIsRestricted
                                      ? "Historical record — full details are unavailable after employee transfer."
                                      : undefined
                                }
                                onClick={
                                  canViewHistory
                                    ? () =>
                                        openIncidentDetails(
                                          historyItem
                                        )
                                    : undefined
                                }
                                onKeyDown={
                                  canViewHistory
                                    ? (event) =>
                                        handleIncidentRowKeyDown(
                                          event,
                                          historyItem
                                        )
                                    : undefined
                                }
                                className={`bg-slate-50/50 transition dark:bg-slate-950/30 ${
                                  canViewHistory
                                    ? "cursor-pointer hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/30 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                <td className="px-4 py-3 align-top pl-8">
                                  <div className="flex items-center gap-2">
                                    <FiCornerDownRight
                                      className="shrink-0 text-slate-400"
                                      aria-hidden="true"
                                    />
                                    <p className="truncate font-semibold text-slate-700 dark:text-slate-300">
                                      {historyDisplayId}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                    {formatIncidentDate(
                                      historyItem
                                    )}
                                  </p>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <SeverityBadge
                                    level={
                                      historyItem.severity
                                    }
                                  />
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <StatusBadge
                                    status={
                                      historyItem.status
                                    }
                                  />
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <CaseAgeBadge
                                    incident={
                                      historyItem
                                    }
                                  />
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <SmartAlertBadge
                                    alerts={
                                      Array.isArray(
                                        historyItem.smartAlerts
                                      )
                                        ? historyItem.smartAlerts
                                        : []
                                    }
                                  />
                                </td>
                                <td className="px-4 py-3 text-right align-top">
                                  <div
                                    className="flex justify-end"
                                    onClick={
                                      stopRowInteraction
                                    }
                                    onKeyDown={
                                      stopRowInteraction
                                    }
                                  >
                                    <ActionButtons
                                      incident={
                                        historyItem
                                      }
                                      isSuperAdmin={
                                        isSuperAdmin
                                      }
                                      currentUser={
                                        currentUser
                                      }
                                      onView={
                                        openIncidentDetails
                                      }
                                      onStartReview={
                                        onStartReview
                                      }
                                      onResolve={
                                        onResolve
                                      }
                                      onReview={
                                        onReview
                                      }
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                        )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}