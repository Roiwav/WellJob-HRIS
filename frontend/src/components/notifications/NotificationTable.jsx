import { FiEye, FiInbox } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SeverityBadge({ severity }) {
  const styles = {
    Critical:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    Major:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    Minor:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
        styles[severity] || styles.Minor
      }`}
    >
      {severity || "Minor"}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Open:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    Investigating:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    "For Review":
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
    Closed:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
        styles[status] || styles.Open
      }`}
    >
      {status || "Open"}
    </span>
  );
}

export default function NotificationTable({ notifications }) {
  const navigate = useNavigate();

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="border-b border-gray-200 px-6 py-5 dark:border-white/10">
        <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
          Notification Feed
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Latest incident alerts and case updates.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-950 dark:text-gray-400">
            <tr>
              <th className="px-6 py-4">Reported By</th>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Violation</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Reported Date</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 text-gray-700 dark:divide-white/10 dark:text-gray-200">
            {notifications.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-14 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800">
                    <FiInbox className="text-gray-500" size={22} />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    No notifications found
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    New incident reports will appear here.
                  </p>
                </td>
              </tr>
            ) : (
              notifications.map((item) => (
                <tr
                  key={item.id}
                  className="transition hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <td className="px-6 py-4">{item.reportedBy || "Unknown"}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                    {item.employee || "-"}
                  </td>
                  <td className="max-w-sm px-6 py-4">
                    <p className="line-clamp-2">{item.violation || "-"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4">{formatDateTime(item.date)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/incidents", {
                          state: { incidentId: item.id },
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                    >
                      <FiEye />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}