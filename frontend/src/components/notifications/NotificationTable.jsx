export default function NotificationTable({ notifications }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">

          <thead className="bg-gray-50 dark:bg-slate-900/70">
            <tr>
              <th className="px-6 py-4">Reported By</th>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Violation</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Reported Date</th> {/* 🔥 NEW */}
            </tr>
          </thead>

          <tbody>
            {notifications.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center">
                  No notifications found.
                </td>
              </tr>
            ) : (
              notifications.map((item) => (
                <tr key={item.id} className="border-t">

                  <td className="px-6 py-4">
                    {item.reportedBy || "Unknown"}
                  </td>

                  <td className="px-6 py-4">
                    {item.employee}
                  </td>

                  <td className="px-6 py-4">
                    {item.violation}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        item.severity === "Critical"
                          ? "bg-red-100 text-red-600"
                          : item.severity === "Major"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {item.severity}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        item.status === "Resolved"
                          ? "bg-green-100 text-green-600"
                          : item.status === "Investigating"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  {/* 🔥 REPORTED DATE */}
                  <td className="px-6 py-4">
                    {item.reportedDate || item.date || "-"}
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