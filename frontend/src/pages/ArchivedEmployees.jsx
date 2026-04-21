import { useMemo, useState } from "react";
import { FiArrowLeft, FiEye, FiInbox, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import ComplianceBadge from "../components/employees/ComplianceBadge";
import EmployeeModal from "../components/employees/EmployeeModal";

export default function ArchivedEmployees() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState(() => {
    const stored = localStorage.getItem("employees");
    return stored ? JSON.parse(stored) : [];
  });

  const [viewEmployee, setViewEmployee] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const saveToStorage = (data) => {
    setEmployees(data);
    localStorage.setItem("employees", JSON.stringify(data));
  };

  const archivedEmployees = useMemo(
    () => employees.filter((emp) => emp.archived),
    [employees]
  );

  const getDocumentStatus = (expirationDate) => {
    if (!expirationDate) return "No Data";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(expirationDate);
    exp.setHours(0, 0, 0, 0);

    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Expired";
    if (diffDays <= 30) return "Expiring Soon";
    return "Valid";
  };

  const getCompliance = (docs) => {
    if (!docs || docs.length === 0) return "No Data";

    const statuses = docs.map((doc) => getDocumentStatus(doc.expirationDate));

    if (statuses.includes("Expired")) return "Expired";
    if (statuses.includes("Expiring Soon")) return "Expiring Soon";
    if (statuses.every((status) => status === "Valid")) return "Valid";

    return "Incomplete";
  };

  const handleRestore = (id) => {
    const updated = employees.map((emp) =>
      emp.id === id
        ? {
            ...emp,
            archived: false,
            archivedAt: null,
            status: emp.previousStatus || "Deployed",
          }
        : emp
    );

    saveToStorage(updated);
    setRestoreTarget(null);
    setSuccessMessage("Employee restored successfully.");
  };

  const handleDelete = (id) => {
    const updated = employees.filter((emp) => emp.id !== id);
    saveToStorage(updated);
    setDeleteTarget(null);
    setSuccessMessage("Employee permanently deleted.");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/employees")}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700"
          title="Back to Employees"
        >
          <FiArrowLeft />
        </button>

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Archived Employees
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View and restore inactive employee records.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/70">
              <tr>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Compliance</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {archivedEmployees.length > 0 ? (
                archivedEmployees.map((emp) => {
                  const compliance = getCompliance(emp.documents);

                  return (
                    <tr key={emp.uid || emp.id} className="border-t">
                      <td className="px-6 py-4">{emp.id}</td>
                      <td className="px-6 py-4">{emp.name}</td>
                      <td className="px-6 py-4">{emp.company || "-"}</td>
                      <td className="px-6 py-4">Inactive</td>
                      <td className="px-6 py-4">
                        <ComplianceBadge status={compliance} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewEmployee(emp)}
                            className="inline-flex items-center justify-center rounded-lg border px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700"
                            title="View employee"
                          >
                            <FiEye />
                          </button>

                          <button
                            onClick={() => setRestoreTarget(emp)}
                            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700"
                            title="Restore employee"
                          >
                            <FiRotateCcw />
                          </button>

                          <button
                            onClick={() => setDeleteTarget(emp)}
                            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"
                            title="Permanently delete employee"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700">
                      <FiInbox className="text-gray-500" size={22} />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      No archived employees
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Archived employees will appear here once HR marks them as inactive.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewEmployee && (
        <EmployeeModal
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
        />
      )}

      {restoreTarget && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-green-700 dark:text-white">
              Restore Employee
            </h2>

            <p className="text-sm mb-6 text-gray-900 dark:text-white">
              Are you sure you want to restore <b>{restoreTarget.name}</b>?
              This employee will return to the main employee table.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(restoreTarget.id)}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                Yes, Restore
              </button>

              <button
                onClick={() => setRestoreTarget(null)}
                className="flex-1 bg-gray-500 text-white py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-red-700 dark:text-white">
              Permanently Delete Employee
            </h2>

            <p className="text-sm mb-6 text-gray-900 dark:text-white">
              Are you sure you want to permanently delete <b>{deleteTarget.name}</b>?
              This action cannot be undone and all employee data will be lost.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
              >
                Yes, Delete
              </button>

              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-500 text-white py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-green-600 mb-2">Success</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-5">
              {successMessage}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setSuccessMessage("")}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}