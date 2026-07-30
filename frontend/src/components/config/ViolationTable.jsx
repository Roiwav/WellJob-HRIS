import {
  FiEdit3,
  FiTrash2,
} from "react-icons/fi";

const severityStyle = {
  Minor:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300",

  Major:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  Critical:
    "border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
};

const penaltyLevelStyle = {
  Warning:
    "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-300",

  "Warning / 1–7 Days Suspension":
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300",

  "1–7 Days Suspension":
    "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300",

  "1 to 7 Days Suspension":
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  "7–30 Days Suspension":
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  "7–30 Days Suspension / Dismissal / RTA":
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  "15-30 Days Suspension":
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  "15-30 Days Suspension / Dismissal":
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  "15 to 30 Days Suspension":
    "border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",

  "30 Days Suspension":
    "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300",

  "30 Days Suspension / Dismissal":
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  "30 Days Suspension / Dismissal / RTA":
    "border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",

  "Dismissal / RTA":
    "border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",

  "Re-assignment or Dismissal / RTA":
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  "15 to 30 Days Suspension / Dismissal / RTA":
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  "15-30 Days Suspension / Dismissal / RTA":
    "border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
};

function formatPenalty(penalty, index) {
  if (!penalty) {
    return "No penalty";
  }

  if (typeof penalty === "string") {
    return penalty;
  }

  if (typeof penalty === "object") {
    const label =
      penalty.label ||
      `Offense ${penalty.offenseNo || index + 1}`;

    const action =
      penalty.action || "No action";

    return `${label}: ${action}`;
  }

  return "Invalid penalty";
}

function normalizeSeverity(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

export default function ViolationTable({
  rules = [],
  canEdit = false,
  onEdit,
  onDelete,
}) {
  if (!rules.length) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
        <p className="font-bold text-gray-700 dark:text-gray-200">
          No violation rules found
        </p>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Adjust the search term or severity filter to display matching policy
          rules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rules.map((group) => (
        <section
          key={group.category}
          className="overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
        >
          <div className="flex flex-col gap-2 border-b border-gray-300 bg-gray-100 px-5 py-4 dark:border-white/10 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-gray-900 dark:text-white">
              {group.category}
            </h3>

            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {group.rows.length} rule(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
              <thead className="bg-white dark:bg-slate-900">
                <tr>
                  <th
                    scope="col"
                    className="border-b border-r border-gray-200 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:border-white/10 dark:text-gray-300"
                  >
                    Section
                  </th>

                  <th
                    scope="col"
                    className="border-b border-r border-gray-200 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:border-white/10 dark:text-gray-300"
                  >
                    Violation
                  </th>

                  <th
                    scope="col"
                    className="border-b border-r border-gray-200 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:border-white/10 dark:text-gray-300"
                  >
                    Penalty Level
                  </th>

                  <th
                    scope="col"
                    className="border-b border-r border-gray-200 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:border-white/10 dark:text-gray-300"
                  >
                    Penalties
                  </th>

                  <th
                    scope="col"
                    className="border-b border-gray-200 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:border-white/10 dark:text-gray-300"
                  >
                    Severity
                  </th>

                  {canEdit && (
                    <th
                      scope="col"
                      className="border-b border-l border-gray-200 px-4 py-3 text-center text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:border-white/10 dark:text-gray-300"
                    >
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {group.rows.map((item, index) => (
                  <tr
                    key={
                      item.id ||
                      `${group.category}-${index}`
                    }
                    className="align-top transition hover:bg-gray-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="border-b border-r border-gray-200 px-4 py-4 font-semibold text-gray-700 dark:border-white/10 dark:text-gray-200">
                      {item.section || "Not Set"}
                    </td>

                    <td className="border-b border-r border-gray-200 px-4 py-4 dark:border-white/10">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {item.violation || "Unnamed violation"}
                      </p>

                      <div
                        className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400"
                        dangerouslySetInnerHTML={{
                          __html: item.description || "",
                        }}
                      />
                    </td>

                    <td className="border-b border-r border-gray-200 px-4 py-4 dark:border-white/10">
                      <span
                        className={[
                          "inline-flex rounded-full border px-3 py-1 text-xs font-bold",
                          penaltyLevelStyle[item.penaltyLevel] ||
                            "border-gray-200 bg-gray-100 text-gray-700 dark:border-white/10 dark:bg-slate-800 dark:text-gray-300",
                        ].join(" ")}
                      >
                        {item.penaltyLevel || "Not Set"}
                      </span>
                    </td>

                    <td className="border-b border-r border-gray-200 px-4 py-4 text-xs text-gray-700 dark:border-white/10 dark:text-gray-300">
                      {(item.penalties || []).length > 0 ? (
                        <ul className="space-y-2">
                          {item.penalties.map(
                            (penalty, penaltyIndex) => (
                              <li
                                key={`${item.id || index}-penalty-${penaltyIndex}`}
                                className="flex gap-2"
                              >
                                <span
                                  aria-hidden="true"
                                  className="text-indigo-500"
                                >
                                  •
                                </span>

                                <span>
                                  {formatPenalty(
                                    penalty,
                                    penaltyIndex
                                  )}
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <span className="text-gray-400">
                          No penalties configured
                        </span>
                      )}
                    </td>

                    <td className="border-b border-gray-200 px-4 py-4 dark:border-white/10">
                      <div className="flex flex-wrap gap-2">
                        {normalizeSeverity(item.severity).length > 0 ? (
                          normalizeSeverity(item.severity).map(
                            (severity) => (
                              <span
                                key={severity}
                                className={[
                                  "inline-flex rounded-full border px-3 py-1 text-xs font-bold",
                                  severityStyle[severity] ||
                                    "border-gray-200 bg-gray-100 text-gray-700 dark:border-white/10 dark:bg-slate-800 dark:text-gray-300",
                                ].join(" ")}
                              >
                                {severity}
                              </span>
                            )
                          )
                        ) : (
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:border-white/10 dark:bg-slate-800 dark:text-gray-300">
                            Not Set
                          </span>
                        )}
                      </div>
                    </td>

                    {canEdit && (
                      <td className="border-b border-l border-gray-200 px-4 py-4 dark:border-white/10">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            title="Edit violation rule"
                            aria-label={`Edit ${item.violation}`}
                            onClick={() => onEdit?.(item.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                          >
                            <FiEdit3 aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            title="Remove violation rule"
                            aria-label={`Remove ${item.violation}`}
                            onClick={() => onDelete?.(item.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                          >
                            <FiTrash2 aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}