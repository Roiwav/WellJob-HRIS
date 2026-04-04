import StatusBadge from "./StatusBadge";
import ComplianceBadge from "./ComplianceBadge";
import { FiEye, FiEdit2, FiTrash2 } from "react-icons/fi";

export default function EmployeeTable({
  employees,
  openModal,
  onEdit,
  getComplianceStatus,
  onDelete
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-300 dark:border-white/10">
            <th className="py-3">Employee ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Compliance</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>

        <tbody>
          {employees.length > 0 ? (
            employees.map((emp) => {
              const compliance = getComplianceStatus(emp.documents);

              return (
                <tr
                  key={emp.uid}
                  className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                >
                  <td className="py-3">{emp.id}</td>

                  <td>{emp.name}</td>

                  <td>
                    <StatusBadge status={emp.status} />
                  </td>

                  <td>
                    <ComplianceBadge status={compliance} />
                  </td>

                  <td className="text-right space-x-4">
                    <button
                      onClick={() => openModal(emp)}
                      className="text-indigo-500 hover:text-indigo-700"
                      title="View Employee"
                    >
                      <FiEye />
                    </button>

                    <button
                      onClick={() => onEdit(emp)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Edit Employee"
                    >
                      <FiEdit2 />
                    </button>

                    <button
                      onClick={() => {
                        const confirmDelete = window.confirm("Delete this employee?");
                        if (confirmDelete) onDelete(emp.uid);
                      }}
                      className="text-red-500 hover:text-red-700"
                      title="Delete Employee"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="5" className="text-center py-6 text-gray-500">
                No employees found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}