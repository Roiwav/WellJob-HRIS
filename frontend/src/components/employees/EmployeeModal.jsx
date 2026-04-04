import { FiX } from "react-icons/fi";

export default function EmployeeModal({ employee, onClose }) {
  if (!employee) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Employee Profile
          </h2>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6 text-sm text-gray-900 dark:text-white">
          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-1">Name</p>
            <p className="font-medium">{employee.name}</p>
          </div>

          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-1">Employee ID</p>
            <p className="font-medium">{employee.id}</p>
          </div>

          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-1">Status</p>
            <p className="font-medium">{employee.status}</p>
          </div>

          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Compliance Documents
            </p>

            {employee.documents && employee.documents.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {employee.documents.map((doc, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 text-xs font-medium"
                  >
                    {doc}
                  </span>
                ))}
              </div>
            ) : (
              <p className="font-medium text-gray-500 dark:text-gray-400">
                No Data
              </p>
            )}
          </div>
        </div>

        <div className="px-8 py-5 border-t border-gray-200 dark:border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}