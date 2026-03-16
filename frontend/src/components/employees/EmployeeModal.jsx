import { FiX } from "react-icons/fi";

export default function EmployeeModal({ employee, onClose }) {

  if (!employee) return null;

  return (

    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-6">

      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden">

        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-200 dark:border-white/10">

          <h2 className="text-lg font-semibold">
            Employee Profile
          </h2>

          <button onClick={onClose}>
            <FiX />
          </button>

        </div>

        <div className="p-8 space-y-4 text-sm">

          <p><strong>Name:</strong> {employee.name}</p>
          <p><strong>ID:</strong> {employee.id}</p>
          <p><strong>Status:</strong> {employee.status}</p>

        </div>

      </div>

    </div>

  );

}