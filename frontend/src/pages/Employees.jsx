import { useState, useEffect } from "react";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";

export default function Employees() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [employees, setEmployees] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [generatedId, setGeneratedId] = useState("");

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  // 🔥 NEW STATES
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  useEffect(() => {
    const stored = localStorage.getItem("employees");
    if (stored) setEmployees(JSON.parse(stored));
  }, []);

  const saveToStorage = (data) => {
    setEmployees(data);
    localStorage.setItem("employees", JSON.stringify(data));
  };

  const generateId = () => {
    const stored = JSON.parse(localStorage.getItem("employees")) || [];
    if (stored.length === 0) return "EMP001";

    const numbers = stored.map(emp =>
      parseInt(emp.id.replace("EMP", ""), 10)
    );

    const max = Math.max(...numbers);
    const next = max + 1;

    return "EMP" + next.toString().padStart(3, "0");
  };

  const handleOpenModal = () => {
    if (isSuperAdmin) return;
    setGeneratedId(generateId());
    setEditingEmployee(null);
    setShowModal(true);
  };

  const handleSave = (data) => {
    if (isSuperAdmin) return;

    if (editingEmployee) {
      const updated = employees.map((emp) =>
        emp.id === editingEmployee.id ? { ...emp, ...data } : emp
      );
      saveToStorage(updated);
    } else {
      const newEmployee = {
        id: generatedId,
        ...data,
      };
      saveToStorage([...employees, newEmployee]);
    }
  };

  const handleEdit = (emp) => {
    if (isSuperAdmin) return;
    setEditingEmployee(emp);
    setGeneratedId(emp.id);
    setShowModal(true);
  };

  const handleView = (emp) => setViewEmployee(emp);

  const handleDelete = (id) => {
    if (isSuperAdmin) return;
    const updated = employees.filter((emp) => emp.id !== id);
    saveToStorage(updated);
    setDeleteTarget(null);
  };

  const getCompliance = (docs) => {
    const REQUIRED = ["NBI", "Police Clearance", "Health Card"];
    return REQUIRED.every(doc => docs?.includes(doc))
      ? "Complete"
      : "Incomplete";
  };

  // 🔥 FILTER LOGIC
  const filteredEmployees = employees.filter((emp) => {
    const matchSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.id.toLowerCase().includes(search.toLowerCase()) ||
      (emp.company || "").toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      filterStatus === "All" || emp.status === filterStatus;

    return matchSearch && matchStatus;
  });

  return (
    <div className="p-8 space-y-6">

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Employees Directory
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin
              ? "View-only access for Super Admin."
              : "Manage employee records and workforce information."}
          </p>
        </div>

        {!isSuperAdmin && (
          <RoleGuard permission={PERMISSIONS.CAN_ADD_EMPLOYEE}>
            <button
              onClick={handleOpenModal}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              + Add Employee
            </button>
          </RoleGuard>
        )}
      </div>

      {/* 🔥 SEARCH + FILTER */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">

        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-white"
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-white"
        >
          <option value="All">All Status</option>
          <option value="Deployed">Deployed</option>
          <option value="Floating / Standby">Floating / Standby</option>
        </select>

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
              {filteredEmployees.map((emp) => {
                const compliance = getCompliance(emp.documents);

                return (
                  <tr key={emp.id} className="border-t">
                    <td className="px-6 py-4">{emp.id}</td>
                    <td className="px-6 py-4">{emp.name}</td>
                    <td className="px-6 py-4">{emp.company || "-"}</td>
                    <td className="px-6 py-4">{emp.status}</td>

                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded ${
                        compliance === "Complete"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {compliance}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">

                        <button
                          onClick={() => handleView(emp)}
                          className="px-3 py-1 border rounded"
                        >
                          View
                        </button>

                        {!isSuperAdmin && (
                          <RoleGuard permission={PERMISSIONS.CAN_EDIT_EMPLOYEE}>
                            <button
                              onClick={() => handleEdit(emp)}
                              className="px-3 py-1 bg-amber-500 text-white rounded"
                            >
                              Edit
                            </button>
                          </RoleGuard>
                        )}

                        {!isSuperAdmin && (
                          <button
                            onClick={() => setDeleteTarget(emp)}
                            className="px-3 py-1 bg-red-600 text-white rounded"
                          >
                            Delete
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS (unchanged) */}
      {showModal && !isSuperAdmin && (
        <AddEmployeeModal
          generatedId={generatedId}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          editingEmployee={editingEmployee}
        />
      )}

      {/* VIEW MODAL */}
      {viewEmployee && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-96">
            <h2 className="text-lg font-bold mb-4">Employee Details</h2>

            <p><b>ID:</b> {viewEmployee.id}</p>
            <p><b>Name:</b> {viewEmployee.name}</p>
            <p><b>Company:</b> {viewEmployee.company || "-"}</p>
            <p><b>Status:</b> {viewEmployee.status}</p>

            <button
              onClick={() => setViewEmployee(null)}
              className="mt-4 w-full bg-gray-600 text-white py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* DELETE MODAL (unchanged) */}
      {deleteTarget && !isSuperAdmin && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-96">
            <h2 className="text-lg font-bold mb-4 text-red-600">
              Confirm Delete
            </h2>

            <p className="text-sm mb-6">
              Are you sure you want to delete <b>{deleteTarget.name}</b>?
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                className="flex-1 bg-red-600 text-white py-2 rounded"
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

    </div>
  );
}