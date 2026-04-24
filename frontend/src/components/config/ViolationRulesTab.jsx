import { useMemo, useState } from "react";
import { FiBookOpen, FiInfo, FiSearch } from "react-icons/fi";
import { NORMALIZED_VIOLATION_RULES as VIOLATION_RULES } from "../../data/violationRules";
import ViolationTable from "./ViolationTable";

export default function ViolationRulesTab() {
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");

  const filteredRules = useMemo(() => {
    const search = query.trim().toLowerCase();

    return VIOLATION_RULES.map((group) => {
      const rows = group.rows.filter((item) => {
        const searchableText = [
          group.category,
          item.section,
          item.violation,
          item.description,
          item.penaltyLevel,
          item.severity,
          item.penalties?.join(" "),
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = searchableText.includes(search);
        const matchesSeverity =
          severityFilter === "All" || item.severity === severityFilter;

        return matchesSearch && matchesSeverity;
      });

      return { ...group, rows };
    }).filter((group) => group.rows.length > 0);
  }, [query, severityFilter]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Code of Conduct Violation Rules
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Fixed read-only company violation table used for incident
              classification, penalty level, and severity mapping.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
            <FiBookOpen />
            Read Only Policy
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
          <div className="flex items-start gap-2 text-sm text-indigo-800">
            <FiInfo className="mt-0.5 shrink-0" />
            <p>
              Violation rules are fixed based on the company Code of Conduct to
              keep HR classification standardized.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <FiSearch className="absolute left-4 top-3.5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search section, violation, penalty, or category..."
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-white"
          >
            <option value="All">All Severity</option>
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      <ViolationTable rules={filteredRules} />
    </div>
  );
}