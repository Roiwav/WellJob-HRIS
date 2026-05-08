import React, { useMemo, useState } from "react";
import { FiFileText, FiSearch, FiChevronDown, FiChevronUp, FiCornerDownRight } from "react-icons/fi";

import FilterSelect from "./IncidentFilters";
import ActionButtons from "./IncidentActionButtons";

import {
  SeverityBadge,
  StatusBadge,
  CaseAgeBadge,
  SmartAlertBadge,
} from "../badges/IncidentBadges";

export default function IncidentTable({
  isLoading = false,
  incidents = [],
  search = "",
  onSearchChange,
  statusFilter = "ALL",
  onStatusFilterChange,
  severityFilter = "ALL",
  onSeverityFilterChange,
  isSuperAdmin = false,
  formatIncidentCode,
  onView,
  onStartReview,
  onResolve,
  onReview,
}) {
  const [expandedGroups, setExpandedGroups] = useState({});

  const getIncidentDisplayId = (incident) => {
    if (incident.displayId) return incident.displayId;

    if (typeof formatIncidentCode === "function") {
      return formatIncidentCode(incident.id);
    }

    return incident.id ? `INC-${String(incident.id).padStart(4, "0")}` : "-";
  };

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // GROUPING LOGIC: Pinagsasama ang parehong violation ng isang employee
  const groupedIncidents = useMemo(() => {
    const groups = {};

    incidents.forEach((incident) => {
      const groupKey = `${incident.employeeId || incident.employee}-${incident.violation}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(incident);
    });

    return Object.values(groups).map((group) => {
      group.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
      return {
        key: `${group[0].employeeId || group[0].employee}-${group[0].violation}`,
        latest: group[0],
        history: group.slice(1),
      };
    });
  }, [incidents]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col items-start gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px] xl:max-w-4xl">
          <div className="relative min-w-0">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search incident ID, employee, company, violation..."
              value={search}
              onChange={(event) => onSearchChange?.(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm font-semibold text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <FilterSelect
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={["ALL", "Open", "Investigating", "For Review", "Closed"]}
            labels={{ ALL: "All Status" }}
          />

          <FilterSelect
            value={severityFilter}
            onChange={onSeverityFilterChange}
            options={["ALL", "Minor", "Major", "Critical"]}
            labels={{ ALL: "All Severity" }}
          />
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {incidents.length} record{incidents.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-gray-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
            Incident Records
          </h2>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Severity can be filtered above and is shown as a compact badge under
            the violation to keep the table readable. Recurring violations are grouped together.
          </p>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 dark:bg-slate-900/70 dark:text-gray-300">
              <tr>
                <th className="w-[13%] px-4 py-4 text-xs font-extrabold uppercase tracking-wide">
                  Incident ID
                </th>

                <th className="w-[22%] px-4 py-4 text-xs font-extrabold uppercase tracking-wide">
                  Employee
                </th>

                <th className="w-[27%] px-4 py-4 text-xs font-extrabold uppercase tracking-wide">
                  Violation
                </th>

                <th className="w-[12%] px-4 py-4 text-xs font-extrabold uppercase tracking-wide">
                  Status
                </th>

                <th className="w-[10%] px-4 py-4 text-xs font-extrabold uppercase tracking-wide">
                  Case Age
                </th>

                <th className="w-[8%] px-4 py-4 text-xs font-extrabold uppercase tracking-wide">
                  Alerts
                </th>

                <th className="w-[15%] px-4 py-4 text-right text-xs font-extrabold uppercase tracking-wide">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-14 text-center text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                        <FiFileText size={22} />
                      </div>

                      <p className="font-bold">Loading incident records...</p>
                    </div>
                  </td>
                </tr>
              ) : groupedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                        <FiSearch size={22} />
                      </div>

                      <p className="font-bold text-gray-800 dark:text-white">
                        No incident records found.
                      </p>

                      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                        Incident reports will appear here once added or when
                        filters match existing records.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                groupedIncidents.map((group) => {
                  const isExpanded = expandedGroups[group.key];
                  const hasHistory = group.history.length > 0;

                  return (
                    <React.Fragment key={group.key}>
                      {/* MAIN ROW (LATEST INCIDENT) */}
                      <tr className="border-t border-gray-200 transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-900/40">
                        <td className="px-4 py-4 align-top">
                          <p className="truncate font-extrabold text-gray-900 dark:text-white">
                            {getIncidentDisplayId(group.latest)}
                          </p>
                          {hasHistory && (
                            <span className="mt-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                              {group.history.length + 1} Records
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="min-w-0">
                            <p
                              className="truncate font-bold text-gray-900 dark:text-white"
                              title={group.latest.employee || "Unknown Employee"}
                            >
                              {group.latest.employee || "Unknown Employee"}
                            </p>

                            <p
                              className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400"
                              title={group.latest.company || "Unassigned"}
                            >
                              {group.latest.company || "Unassigned"}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="min-w-0 space-y-2">
                            <p
                              className="line-clamp-2 break-words text-sm font-semibold leading-5 text-gray-800 dark:text-gray-100"
                              title={group.latest.violation || "No violation type"}
                            >
                              {group.latest.violation || "No violation type"}
                            </p>

                            <SeverityBadge level={group.latest.severity} />
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <StatusBadge status={group.latest.status} />
                        </td>

                        <td className="px-4 py-4 align-top">
                          <CaseAgeBadge incident={group.latest} />
                        </td>

                        <td className="px-4 py-4 align-top">
                          <SmartAlertBadge alerts={group.latest.smartAlerts || []} />
                        </td>

                        {/* ACTION COLUMN */}
                        <td className="px-4 py-4 text-right align-top">
                          <div className="flex items-center justify-end gap-2">
                            {/* EXPAND ICON BUTTON */}
                            {hasHistory && (
                              <button
                                onClick={() => toggleGroup(group.key)}
                                title={isExpanded ? "Hide History" : "View History"}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-800/30 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                              >
                                {isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                              </button>
                            )}

                            <ActionButtons
                              incident={group.latest}
                              isSuperAdmin={isSuperAdmin}
                              onView={onView}
                              onStartReview={onStartReview}
                              onResolve={onResolve}
                              onReview={onReview}
                            />
                          </div>
                        </td>
                      </tr>

                      {/* HISTORY DROPDOWN ROWS */}
                      {isExpanded &&
                        group.history.map((historyItem) => (
                          <tr
                            key={historyItem.id}
                            className="bg-gray-50/50 transition hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                          >
                            <td className="px-4 py-3 align-top pl-8">
                              <div className="flex items-center gap-2">
                                <FiCornerDownRight className="text-gray-400" />
                                <p className="truncate font-semibold text-gray-700 dark:text-gray-300">
                                  {getIncidentDisplayId(historyItem)}
                                </p>
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top">
                              <p className="truncate text-gray-500 dark:text-gray-400 text-xs">
                                {new Date(historyItem.date || historyItem.createdAt).toLocaleDateString()}
                              </p>
                            </td>

                            <td className="px-4 py-3 align-top">
                              <div className="min-w-0 space-y-1">
                                <SeverityBadge level={historyItem.severity} />
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top">
                              <StatusBadge status={historyItem.status} />
                            </td>

                            <td className="px-4 py-3 align-top">
                              <CaseAgeBadge incident={historyItem} />
                            </td>

                            <td className="px-4 py-3 align-top">
                              <SmartAlertBadge alerts={historyItem.smartAlerts || []} />
                            </td>

                            <td className="px-4 py-3 text-right align-top">
                              <div className="flex justify-end">
                                <ActionButtons
                                  incident={historyItem}
                                  isSuperAdmin={isSuperAdmin}
                                  onView={onView}
                                  onStartReview={onStartReview}
                                  onResolve={onResolve}
                                  onReview={onReview}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}