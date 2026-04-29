import { FiSearch } from "react-icons/fi";

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
  return (
    <section className="space-y-4">
      <div className="flex flex-col items-start gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full flex-col items-start gap-3 xl:flex-row xl:items-center">
          <div className="relative w-full max-w-xs">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search incident ID, employee, violation..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
            View, review, and manage disciplinary incident cases.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 dark:bg-slate-900/70 dark:text-gray-300">
              <tr>
                {[
                  "Incident ID",
                  "Employee",
                  "Violation",
                  "Severity",
                  "Status",
                  "Case Age",
                  "Alerts",
                  "Action",
                ].map((head) => (
                  <th
                    key={head}
                    className={`px-6 py-4 text-xs font-extrabold uppercase tracking-wide ${
                      head === "Action" ? "text-right" : ""
                    }`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    Loading incident records...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                        <FiSearch size={22} />
                      </div>

                      <p className="font-bold text-gray-800 dark:text-white">
                        No incident records found.
                      </p>

                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Incident reports will appear here once added.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                incidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="border-t border-gray-200 transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-900/40"
                  >
                    <td className="whitespace-nowrap px-6 py-4 font-extrabold text-gray-900 dark:text-white">
                      {incident.displayId || formatIncidentCode(incident.id)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <p className="max-w-[190px] truncate font-bold text-gray-900 dark:text-white">
                          {incident.employee || "Unknown Employee"}
                        </p>

                        <p className="mt-0.5 max-w-[190px] truncate text-xs text-gray-500 dark:text-gray-400">
                          {incident.company || "Unassigned"}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <p className="max-w-[230px] truncate font-medium">
                        {incident.violation || "No violation type"}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <SeverityBadge level={incident.severity} />
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={incident.status} />
                    </td>

                    <td className="px-6 py-4">
                      <CaseAgeBadge incident={incident} />
                    </td>

                    <td className="px-6 py-4">
                      <SmartAlertBadge alerts={incident.smartAlerts || []} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <ActionButtons
                        incident={incident}
                        isSuperAdmin={isSuperAdmin}
                        onView={onView}
                        onStartReview={onStartReview}
                        onResolve={onResolve}
                        onReview={onReview}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}