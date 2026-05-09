import { useState } from "react";
import { FiBriefcase, FiEye, FiEdit2, FiCheck, FiX } from "react-icons/fi";

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

function formatDateForInput(dateValue) {
  if (!dateValue || dateValue === "-") return "";
  try {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function StatusBadge({ status }) {
  const styles = {
    Active: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
    Completed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    Cancelled: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status || "-"}
    </span>
  );
}

export default function DeploymentTable({ deployments = [], openView, onUpdateRow, isSuperAdmin }) {
  const [editingId, setEditingId] = useState(null);
  const [tempDate, setTempDate] = useState("");

  const handleStartEdit = (deployment) => {
    setEditingId(deployment.id);
    setTempDate(formatDateForInput(deployment.contractEnd));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTempDate("");
  };

  const handleSaveEdit = (deployment) => {
    if (onUpdateRow) {
      onUpdateRow({ ...deployment, contractEnd: tempDate });
    }
    setEditingId(null);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 dark:border-white/10">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
            <FiBriefcase className="text-indigo-600 dark:text-indigo-400" />
            Deployment Records
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and monitor employee deployment assignments.
          </p>
        </div>

        <span className="rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {deployments.length} record{deployments.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* MODIFIED: Idinagdag ang max-height at overflow-y-auto para gumana ang sticky header */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full min-w-[1000px] text-left border-separate border-spacing-0">
          {/* MODIFIED: Ginawang sticky ang thead */}
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
            <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th className="px-6 py-4 border-b border-gray-200 dark:border-white/10">Employee ID</th>
              <th className="px-6 py-4 border-b border-gray-200 dark:border-white/10">Employee</th>
              <th className="px-6 py-4 border-b border-gray-200 dark:border-white/10">Company</th>
              <th className="px-6 py-4 border-b border-gray-200 dark:border-white/10">Location</th>
              <th className="px-6 py-4 border-b border-gray-200 dark:border-white/10">Start Date</th>
              <th className="px-6 py-4 border-b border-gray-200 dark:border-white/10">Contract End</th>
              <th className="px-6 py-4 border-b border-gray-200 dark:border-white/10">Status</th>
              <th className="px-6 py-4 border-b border-gray-200 dark:border-white/10 text-center">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {deployments.length > 0 ? (
              deployments.map((deployment) => (
                <tr
                  key={deployment.id}
                  className="transition hover:bg-indigo-50/50 dark:hover:bg-white/5"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {deployment.id || "-"}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {deployment.employee || "-"}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {deployment.company || "-"}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                    {deployment.location || "-"}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                    {formatDisplayDate(deployment.start)}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                    {editingId === deployment.id ? (
                      <input
                        type="date"
                        value={tempDate}
                        onChange={(e) => setTempDate(e.target.value)}
                        className="w-full rounded-xl border border-indigo-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-indigo-500/50 dark:bg-slate-800 dark:text-white"
                        autoFocus
                      />
                    ) : (
                      formatDisplayDate(deployment.contractEnd)
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <StatusBadge status={deployment.status} />
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {editingId === deployment.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(deployment)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-green-200 bg-green-50 text-green-600 transition hover:bg-green-600 hover:text-white dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500"
                            title="Save Date"
                          >
                            <FiCheck />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500"
                            title="Cancel"
                          >
                            <FiX />
                          </button>
                        </>
                      ) : (
                        <>
                          {!isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(deployment)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 transition hover:bg-blue-600 hover:text-white dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500"
                              title="Edit Contract End"
                            >
                              <FiEdit2 />
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => openView(deployment)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500"
                            title="View Deployment"
                          >
                            <FiEye />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="px-6 py-14 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-white/10">
                      <FiBriefcase size={24} />
                    </div>
                    <p className="font-extrabold text-gray-900 dark:text-white">
                      No deployments found
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Deployment records will appear here once an employee is deployed.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}