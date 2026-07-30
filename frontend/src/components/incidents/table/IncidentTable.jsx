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
import FilterBar from "../../ui/FilterBar";
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

function normalizeValue(value) {
  return String(value ?? "").trim();
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
  const timestamp =
    getIncidentTimestamp(incident);

  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date(timestamp));
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

function getTabStyle(
  isActive,
  tabKey
) {
  if (!isActive) {
    return "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700/50 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-300";
  }

  if (tabKey === "CLOSED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm focus-visible:ring-emerald-500/30 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (tabKey === "FOR_REVIEW") {
    return "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm focus-visible:ring-indigo-500/30 dark:border-indigo-700/50 dark:bg-indigo-950/30 dark:text-indigo-300";
  }

  if (tabKey === "ACTIVE") {
    return "border-amber-300 bg-amber-50 text-amber-700 shadow-sm focus-visible:ring-amber-500/30 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "border-slate-300 bg-slate-100 text-slate-800 shadow-sm focus-visible:ring-slate-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
}

function getEmptyStateContent({
  totalIncidentCount,
  search,
  caseTab,
  severityFilter,
}) {
  const hasSearch =
    Boolean(String(search || "").trim());

  const hasSeverityFilter =
    severityFilter !== "ALL";

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

  if (hasCaseFilter) {
    const tabLabel =
      CASE_TABS.find(
        (tab) => tab.key === caseTab
      )?.label || "selected case category";

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
  isSuperAdmin = false,
  currentUser,
  formatIncidentCode,
  onView,
  onStartReview,
  onResolve,
  onReview,
}) {
  const [
    expandedGroups,
    setExpandedGroups,
  ] = useState({});

  const safeIncidents = useMemo(() => {
    return Array.isArray(incidents)
      ? incidents.filter(Boolean)
      : [];
  }, [incidents]);

  const safeTotalIncidentCount =
    Number.isFinite(
      Number(totalIncidentCount)
    )
      ? Number(totalIncidentCount)
      : safeIncidents.length;

  const hasSearch =
    Boolean(String(search || "").trim());

  const controlsDisabled =
    isLoading || isRefreshing;

  const hasActiveFilters =
    hasSearch ||
    severityFilter !== "ALL" ||
    caseTab !== "ALL";

  const getIncidentDisplayId =
    useCallback(
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

        const numericId = Number(
          incident.id
        );

        if (
          Number.isFinite(numericId)
        ) {
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
      setExpandedGroups(
        (currentGroups) => ({
          ...currentGroups,
          [groupKey]:
            !currentGroups[groupKey],
        })
      );
    },
    []
  );

  const groupedIncidents =
    useMemo(() => {
      const groups = new Map();

      safeIncidents.forEach(
        (incident) => {
          const groupKey =
            buildIncidentGroupKey(
              incident
            );

          const currentGroup =
            groups.get(groupKey) || [];

          currentGroup.push(incident);

          groups.set(
            groupKey,
            currentGroup
          );
        }
      );

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
          (firstGroup, secondGroup) =>
            getIncidentTimestamp(
              secondGroup.latest
            ) -
            getIncidentTimestamp(
              firstGroup.latest
            )
        );
    }, [safeIncidents]);

  const emptyStateContent =
    getEmptyStateContent({
      totalIncidentCount:
        safeTotalIncidentCount,
      search,
      caseTab,
      severityFilter,
    });

  return (
    <section
      className="min-w-0 space-y-4"
      aria-label="Incident records"
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
                className={`rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${getTabStyle(
                  isActive,
                  tab.key
                )}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">
                      {tab.label}
                    </p>

                    <p className="mt-0.5 truncate text-xs font-semibold opacity-70">
                      {tab.description}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-xs font-black dark:bg-slate-950/30">
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <FilterBar
        resultCount={
          safeIncidents.length
        }
        resultLabel="incident"
        actions={
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
        }
      >
        <div className="w-full sm:col-span-2 xl:w-[520px]">
          <SearchInput
            label="Search incident records"
            hideLabel
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

        <div className="min-w-0 xl:w-52">
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
      </FilterBar>

      {isLoading ? (
        <LoadingSkeleton
          rows={6}
          columns={7}
          showHeader
        />
      ) : groupedIncidents.length ===
        0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
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
                ? onClearFilters
                : undefined
            }
          />
        </section>
      ) : (
        <div
          id="incident-records-table"
          role="tabpanel"
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="border-b border-gray-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
              Incident Records
            </h2>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Cases are grouped by employee and violation.
              Expand a record to view its related history.
            </p>
          </div>

          <div className="max-h-[70vh] w-full overflow-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
              <thead className="sticky top-0 z-20 bg-gray-50 text-gray-700 shadow-sm dark:bg-slate-900 dark:text-gray-300">
                <tr>
                  <th
                    scope="col"
                    className="w-[13%] bg-gray-50 px-4 py-4 text-xs font-extrabold uppercase tracking-wide dark:bg-slate-900"
                  >
                    Incident ID
                  </th>

                  <th
                    scope="col"
                    className="w-[22%] bg-gray-50 px-4 py-4 text-xs font-extrabold uppercase tracking-wide dark:bg-slate-900"
                  >
                    Employee
                  </th>

                  <th
                    scope="col"
                    className="w-[27%] bg-gray-50 px-4 py-4 text-xs font-extrabold uppercase tracking-wide dark:bg-slate-900"
                  >
                    Violation
                  </th>

                  <th
                    scope="col"
                    className="w-[12%] bg-gray-50 px-4 py-4 text-xs font-extrabold uppercase tracking-wide dark:bg-slate-900"
                  >
                    Status
                  </th>

                  <th
                    scope="col"
                    className="w-[10%] bg-gray-50 px-4 py-4 text-xs font-extrabold uppercase tracking-wide dark:bg-slate-900"
                  >
                    Case Age
                  </th>

                  <th
                    scope="col"
                    className="w-[8%] bg-gray-50 px-4 py-4 text-xs font-extrabold uppercase tracking-wide dark:bg-slate-900"
                  >
                    Alerts
                  </th>

                  <th
                    scope="col"
                    className="w-[15%] bg-gray-50 px-4 py-4 text-right text-xs font-extrabold uppercase tracking-wide dark:bg-slate-900"
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="text-gray-700 dark:text-gray-200">
                {groupedIncidents.map(
                  (group) => {
                    const isExpanded =
                      Boolean(
                        expandedGroups[
                          group.key
                        ]
                      );

                    const hasHistory =
                      group.history
                        .length > 0;

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

                    return (
                      <Fragment
                        key={group.key}
                      >
                        <tr className="border-t border-gray-200 transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-900/40">
                          <td className="px-4 py-4 align-top">
                            <p className="truncate font-extrabold text-gray-900 dark:text-white">
                              {getIncidentDisplayId(
                                group.latest
                              )}
                            </p>

                            {hasHistory && (
                              <span className="mt-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                                {group.history
                                  .length +
                                  1}{" "}
                                records
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4 align-top">
                            <div className="min-w-0">
                              <p
                                className="truncate font-bold text-gray-900 dark:text-white"
                                title={
                                  employeeName
                                }
                              >
                                {
                                  employeeName
                                }
                              </p>

                              <p
                                className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400"
                                title={company}
                              >
                                {company}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top">
                            <div className="min-w-0 space-y-2">
                              <p
                                className="line-clamp-2 break-words text-sm font-semibold leading-5 text-gray-800 dark:text-gray-100"
                                title={
                                  violation
                                }
                              >
                                {violation}
                              </p>

                              <SeverityBadge
                                level={
                                  group
                                    .latest
                                    .severity
                                }
                              />
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top">
                            <StatusBadge
                              status={
                                group
                                  .latest
                                  .status
                              }
                            />
                          </td>

                          <td className="px-4 py-4 align-top">
                            <CaseAgeBadge
                              incident={
                                group.latest
                              }
                            />
                          </td>

                          <td className="px-4 py-4 align-top">
                            <SmartAlertBadge
                              alerts={
                                Array.isArray(
                                  group
                                    .latest
                                    .smartAlerts
                                )
                                  ? group
                                      .latest
                                      .smartAlerts
                                  : []
                              }
                            />
                          </td>

                          <td className="px-4 py-4 text-right align-top">
                            <div className="flex items-center justify-end gap-2">
                              {hasHistory && (
                                <button
                                  type="button"
                                  aria-label={
                                    isExpanded
                                      ? `Hide incident history for ${employeeName}`
                                      : `Show incident history for ${employeeName}`
                                  }
                                  aria-expanded={
                                    isExpanded
                                  }
                                  onClick={() =>
                                    toggleGroup(
                                      group.key
                                    )
                                  }
                                  title={
                                    isExpanded
                                      ? "Hide history"
                                      : "View history"
                                  }
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 dark:border-indigo-800/30 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                                >
                                  {isExpanded ? (
                                    <FiChevronUp
                                      size={
                                        18
                                      }
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <FiChevronDown
                                      size={
                                        18
                                      }
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              )}

                              <ActionButtons
                                incident={
                                  group.latest
                                }
                                isSuperAdmin={
                                  isSuperAdmin
                                }
                                currentUser={
                                  currentUser
                                }
                                onView={
                                  onView
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
                            ) => (
                              <tr
                                key={getIncidentRecordKey(
                                  historyItem,
                                  historyIndex
                                )}
                                className="bg-gray-50/50 transition hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                              >
                                <td className="px-4 py-3 align-top pl-8">
                                  <div className="flex items-center gap-2">
                                    <FiCornerDownRight
                                      className="shrink-0 text-gray-400"
                                      aria-hidden="true"
                                    />

                                    <p className="truncate font-semibold text-gray-700 dark:text-gray-300">
                                      {getIncidentDisplayId(
                                        historyItem
                                      )}
                                    </p>
                                  </div>
                                </td>

                                <td className="px-4 py-3 align-top">
                                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
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
                                  <div className="flex justify-end">
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
                                        onView
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
                            )
                          )}
                      </Fragment>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}