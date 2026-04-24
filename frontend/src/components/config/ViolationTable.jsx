const severityStyle = {
  Minor: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Major: "bg-amber-100 text-amber-700 border-amber-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

const penaltyLevelStyle = {
  Warning: "bg-sky-100 text-sky-700 border-sky-200",
  "Warning / 1–7 Days Suspension":
    "bg-emerald-100 text-emerald-700 border-emerald-200",
  "1–7 Days Suspension": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "1 to 7 Days Suspension": "bg-amber-100 text-amber-700 border-amber-200",
  "7–30 Days Suspension": "bg-amber-100 text-amber-700 border-amber-200",
  "7–30 Days Suspension / Dismissal / RTA": "bg-amber-100 text-amber-700 border-amber-200",
  "15-30 Days Suspension": "bg-amber-100 text-amber-700 border-amber-200",
  "15-30 Days Suspension / Dismissal": "bg-amber-100 text-amber-700 border-amber-200",
  "15 to 30 Days Suspension": "bg-red-100 text-red-700 border-red-200",
  "30 Days Suspension": "bg-orange-100 text-orange-700 border-orange-200",
   "30 Days Suspension / Dismissal": "bg-amber-100 text-amber-700 border-amber-200",
  "30 Days Suspension / Dismissal / RTA": "bg-red-100 text-red-700 border-red-200",
  "Dismissal / RTA": "bg-red-100 text-red-700 border-red-200",
  "Re-assignment or Dismissal / RTA": "bg-amber-100 text-amber-700 border-amber-200",
  "15 to 30 Days Suspension / Dismissal / RTA":
    "bg-amber-100 text-amber-700 border-amber-200",
    "15-30 Days Suspension / Dismissal / RTA":
    "bg-red-100 text-red-700 border-red-200",

  "30 Days Suspension / Dismissal / RTA":
    "bg-red-100 text-red-700 border-red-200",
};

export default function ViolationTable({ rules }) {
  if (!rules.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900">
        No violation rules found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rules.map((group) => (
        <div
          key={group.category}
          className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
        >
          <div className="border-b border-gray-300 bg-gray-100 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-gray-900 dark:border-white/10 dark:bg-slate-800 dark:text-white">
            {group.category}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-white dark:bg-slate-900">
                  <th className="w-24 border border-gray-300 px-3 py-3 text-left font-bold dark:border-white/10">
                    Section
                  </th>
                  <th className="w-[32%] border border-gray-300 px-3 py-3 text-left font-bold dark:border-white/10">
                    Violation
                  </th>
                  <th className="w-56 border border-gray-300 px-3 py-3 text-left font-bold dark:border-white/10">
                    Penalty Level
                  </th>
                  <th className="border border-gray-300 px-3 py-3 text-left font-bold dark:border-white/10">
                    Penalties
                  </th>
                  <th className="w-28 border border-gray-300 px-3 py-3 text-left font-bold dark:border-white/10">
                    Severity
                  </th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((item, index) => (
                  <tr key={`${group.category}-${item.section}-${index}`}>
                    <td className="border border-gray-300 px-3 py-4 align-top font-medium text-gray-800 dark:border-white/10 dark:text-gray-200">
                      {item.section}
                    </td>

                    <td className="border border-gray-300 px-3 py-4 align-top dark:border-white/10">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {item.violation}
                      </p>

                      <p
                        className="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-400"
                        dangerouslySetInnerHTML={{
                          __html: item.description || "",
                        }}
                      />
                    </td>

                    <td className="border border-gray-300 px-3 py-4 align-top dark:border-white/10">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                          penaltyLevelStyle[item.penaltyLevel] ||
                          "border-gray-200 bg-gray-100 text-gray-700"
                        }`}
                      >
                        {item.penaltyLevel || "Not Set"}
                      </span>
                    </td>

                    <td className="border border-gray-300 px-3 py-4 align-top text-xs leading-5 text-gray-700 dark:border-white/10 dark:text-gray-300">
                      <ul className="space-y-1">
                        {(item.penalties || []).map((penalty, penaltyIndex) => (
                          <li key={penaltyIndex}>• {penalty}</li>
                        ))}
                      </ul>
                    </td>

                    <td className="border border-gray-300 px-3 py-4 align-top dark:border-white/10">
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(item.severity)
                          ? item.severity
                          : [item.severity]
                        ).map((sev, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                              severityStyle[sev] ||
                              "border-gray-200 bg-gray-100 text-gray-700"
                            }`}
                          >
                            {sev || "Not Set"}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}