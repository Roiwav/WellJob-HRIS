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
  "7–30 Days Suspension / Dismissal / RTA":
    "bg-amber-100 text-amber-700 border-amber-200",
  "15-30 Days Suspension": "bg-amber-100 text-amber-700 border-amber-200",
  "15-30 Days Suspension / Dismissal":
    "bg-amber-100 text-amber-700 border-amber-200",
  "15 to 30 Days Suspension":
    "bg-red-100 text-red-700 border-red-200",
  "30 Days Suspension":
    "bg-orange-100 text-orange-700 border-orange-200",
  "30 Days Suspension / Dismissal":
    "bg-amber-100 text-amber-700 border-amber-200",
  "30 Days Suspension / Dismissal / RTA":
    "bg-red-100 text-red-700 border-red-200",
  "Dismissal / RTA": "bg-red-100 text-red-700 border-red-200",
  "Re-assignment or Dismissal / RTA":
    "bg-amber-100 text-amber-700 border-amber-200",
  "15 to 30 Days Suspension / Dismissal / RTA":
    "bg-amber-100 text-amber-700 border-amber-200",
  "15-30 Days Suspension / Dismissal / RTA":
    "bg-red-100 text-red-700 border-red-200",
};

// SAFE FORMATTER (KEY FIX)
function formatPenalty(penalty, index) {
  if (!penalty) return "No penalty";

  // if string
  if (typeof penalty === "string") return penalty;

  // if object
  if (typeof penalty === "object") {
    return `${penalty.label || `Offense ${penalty.offenseNo || index + 1}`}: ${
      penalty.action || "No action"
    }`;
  }

  return "Invalid penalty";
}

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
                <tr>
                  <th className="border px-3 py-3">Section</th>
                  <th className="border px-3 py-3">Violation</th>
                  <th className="border px-3 py-3">Penalty Level</th>
                  <th className="border px-3 py-3">Penalties</th>
                  <th className="border px-3 py-3">Severity</th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((item, index) => (
                  <tr key={`${group.category}-${index}`}>
                    <td className="border px-3 py-4">{item.section}</td>

                    <td className="border px-3 py-4">
                      <p className="font-semibold">{item.violation}</p>
                      <p
                        className="text-xs text-gray-500"
                        dangerouslySetInnerHTML={{
                          __html: item.description || "",
                        }}
                      />
                    </td>

                    <td className="border px-3 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                          penaltyLevelStyle[item.penaltyLevel] ||
                          "border-gray-200 bg-gray-100 text-gray-700"
                        }`}
                      >
                        {item.penaltyLevel || "Not Set"}
                      </span>
                    </td>

                    {/* ✅ FIXED HERE */}
                    <td className="border px-3 py-4 text-xs">
                      <ul className="space-y-1">
                        {(item.penalties || []).map(
                          (penalty, penaltyIndex) => (
                            <li key={penaltyIndex}>
                              • {formatPenalty(penalty, penaltyIndex)}
                            </li>
                          )
                        )}
                      </ul>
                    </td>

                    <td className="border px-3 py-4">
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