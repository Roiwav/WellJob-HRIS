import { FiEdit2, FiEye } from "react-icons/fi";
import { useAuth } from "../../context/useAuth";

function formatDisplayDate(dateValue) {
  if (!dateValue || dateValue === "-") return "-";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }) {
  const styles = {
    Active:
      "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
    Completed:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    Pending:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    Cancelled:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${
        styles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

export default function DeploymentTable({
  deployments,
  openView,
  openEdit,
}) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow border dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-slate-900/70">
            <tr>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Company</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Start Date</th>
              <th className="px-6 py-4">Contract End</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {deployments.length > 0 ? (
              deployments.map((deployment) => (
                <tr
                  key={deployment.id}
                  className="border-t border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {deployment.employee}
                  </td>

                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {deployment.company}
                  </td>

                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {deployment.location}
                  </td>

                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {formatDisplayDate(deployment.start)}
                  </td>

                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                    <span>
                      {formatDisplayDate(deployment.end)}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <StatusBadge status={deployment.status} />
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openView(deployment)}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700"
                        title="View deployment"
                      >
                        <FiEye />
                      </button>

                      {!isSuperAdmin && (
                        <button
                          onClick={() => openEdit(deployment)}
                          className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-white hover:bg-amber-600"
                          title="Edit deployment"
                        >
                          <FiEdit2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="text-center py-10 text-gray-500 dark:text-gray-400"
                >
                  No deployments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}