import { useState } from "react";
import {
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiX,
} from "react-icons/fi";

export default function Employees() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const employees = [
    { id: "EMP001", name: "Juan Dela Cruz", status: "Deployed" },
    { id: "EMP002", name: "Maria Santos", status: "Floating / Standby" },
    { id: "EMP003", name: "Pedro Reyes", status: "Resigned" },
    { id: "EMP004", name: "Ana Lopez", status: "End of Contract" },
    { id: "EMP005", name: "Mark Santos", status: "Terminated" },
    { id: "EMP006", name: "Liza Cruz", status: "Inactive" },
  ];

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || emp.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employee Master List</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage employee records and workforce status
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
          <FiPlus />
          Add Employee
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-4">

        <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/10 px-4 py-2 rounded-lg">
          <FiSearch className="text-gray-500" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="
            px-4 py-2 rounded-lg border text-sm
            bg-white text-gray-900
            dark:bg-slate-800 dark:text-white
            dark:border-white/10
            focus:outline-none focus:ring-2 focus:ring-indigo-500
          "
        >
          <option value="All">All Status</option>
          <option value="Deployed">Deployed</option>
          <option value="Floating / Standby">Floating / Standby</option>
          <option value="Resigned">Resigned</option>
          <option value="End of Contract">End of Contract</option>
          <option value="Terminated">Terminated</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="
        bg-white dark:bg-slate-900
        border border-gray-200 dark:border-white/10
        rounded-2xl
        p-6
        overflow-x-auto
      ">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-300 dark:border-white/10">
              <th className="py-3">Employee ID</th>
              <th>Name</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                >
                  <td className="py-3">{emp.id}</td>
                  <td>{emp.name}</td>
                  <td>
                    <StatusBadge status={emp.status} />
                  </td>
                  <td className="text-right space-x-4">
                    <button
                      onClick={() => setSelectedEmployee(emp)}
                      className="text-indigo-500 hover:text-indigo-700"
                    >
                      <FiEye />
                    </button>
                    <button className="text-blue-500 hover:text-blue-700">
                      <FiEdit2 />
                    </button>
                    <button className="text-red-500 hover:text-red-700">
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center py-6 text-gray-500">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}

/* ============================= */

function StatusBadge({ status }) {
  const styles = {
    "Deployed":
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-600 dark:text-white dark:border-green-500",
    "Floating / Standby":
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500 dark:text-white dark:border-amber-400",
    "Resigned":
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-600 dark:text-white dark:border-blue-500",
    "End of Contract":
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-600 dark:text-white dark:border-purple-500",
    "Terminated":
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-600 dark:text-white dark:border-red-500",
    "Inactive":
      "bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600",
  };

  return (
    <span
      className={`
        px-3 py-1 rounded-full text-xs font-semibold border
        inline-flex items-center gap-1
        ${styles[status]}
      `}
    >
      <span className="w-2 h-2 rounded-full bg-current"></span>
      {status}
    </span>
  );
}

/* ============================= */

function EmployeeModal({ employee, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl relative overflow-hidden">

        {/* HEADER */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-gray-200 dark:border-white/10">
          <div>
            <h2 className="text-xl font-bold">
              Employee Profile
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Detailed information for {employee.name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 text-xl"
          >
            <FiX />
          </button>
        </div>

        {/* BODY */}
        <div className="px-8 py-8 space-y-10">

          {/* PERSONAL INFO */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Personal Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-10 text-sm">

              <InfoItem label="Employee ID" value={employee.id} />
              <InfoItem label="Full Name" value={employee.name} />
              <InfoItem label="Email" value="sample@email.com" />
              <InfoItem label="Phone" value="+63 912 345 6789" />

            </div>
          </div>

          {/* EMPLOYMENT DETAILS */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Employment Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-10 text-sm">

              <InfoItem label="Position" value="Staff" />
              <InfoItem label="Department" value="Operations" />
              <InfoItem label="Status" value={employee.status} />
              <InfoItem label="Date Hired" value="2023-01-15" />

            </div>
          </div>

          {/* DEPLOYMENT INFO */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Deployment Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-10 text-sm">

              <InfoItem label="Client Company" value="Company 1" />
              <InfoItem label="Deployment Start" value="2023-02-01" />

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* Reusable Info Row */
function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">
        {label}
      </p>
      <p className="font-medium text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

