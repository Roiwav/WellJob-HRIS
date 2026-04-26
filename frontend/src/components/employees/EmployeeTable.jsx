import StatusBadge from "./StatusBadge";
import ComplianceBadge from "./ComplianceBadge";
import {
  FiArchive,
  FiEdit2,
  FiEye,
  FiUsers,
} from "react-icons/fi";

export default function EmployeeTable({
  employees = [],
  openModal,
  onEdit,
  getComplianceStatus,
  onArchive,
  isSuperAdmin = false,
  isHRManager = false,
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 dark:border-white/10">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
            <FiUsers className="text-indigo-600 dark:text-indigo-400" />
            Employee Records
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View, update, and manage registered employees.
          </p>
        </div>

        <span className="rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {employees.length} record{employees.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr className="border-b border-gray-200 text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-6 py-4">Employee ID</th>
              <th className="px-6 py-4">Full Name</th>
              <th className="px-6 py-4">Company</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Compliance</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {employees.length > 0 ? (
              employees.map((emp) => {
                const compliance = getComplianceStatus(emp.documents);

                return (
                  <tr
                    key={emp.uid || emp.id}
                    className="transition hover:bg-indigo-50/50 dark:hover:bg-white/5"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {emp.id || "-"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {emp.name || "-"}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {emp.company || "-"}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={emp.status} />
                    </td>

                    <td className="px-6 py-4">
                      <ComplianceBadge status={compliance} />
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openModal(emp)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500"
                          title="View Employee"
                        >
                          <FiEye />
                        </button>

                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => onEdit(emp)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 transition hover:bg-blue-600 hover:text-white dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500"
                            title="Edit Employee"
                          >
                            <FiEdit2 />
                          </button>
                        )}
{isHRManager && onArchive && (
  <button
    type="button"
    onClick={() => onArchive(emp)}
    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700 transition hover:bg-amber-500 hover:text-white dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500 dark:hover:text-white"
    title="Archive Employee"
  >
    <FiArchive />
  </button>
)}

    
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-14 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-white/10">
                      <FiUsers size={24} />
                    </div>

                    <p className="font-extrabold text-gray-900 dark:text-white">
                      No employees found
                    </p>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Employee records will appear here once added.
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