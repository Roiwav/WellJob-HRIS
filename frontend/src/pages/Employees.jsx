import { useState } from "react";
import {
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiX,
} from "react-icons/fi";

/* =========================
   MAIN COMPONENT
========================= */

export default function Employees() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const employees = [
    {
      id: "EMP001",
      name: "Juan Dela Cruz",
      status: "Deployed",
      documents: [
        { name: "NBI Clearance", expiry: "2026-05-01" },
        { name: "Medical Certificate", expiry: "2025-12-10" },
      ],
    },
    {
      id: "EMP002",
      name: "Maria Santos",
      status: "Floating / Standby",
      documents: [{ name: "Contract", expiry: "2025-08-15" }],
    },
    { id: "EMP003", name: "Pedro Reyes", status: "Resigned", documents: [] },
    { id: "EMP004", name: "Ana Lopez", status: "End of Contract", documents: [] },
    { id: "EMP005", name: "Mark Santos", status: "Terminated", documents: [] },
    { id: "EMP006", name: "Liza Cruz", status: "Inactive", documents: [] },
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
            Manage employee records and compliance
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
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => {
                const compliance = getComplianceStatus(emp.documents);

                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5 transition
                    ${compliance === "Expired" ? "bg-red-50 dark:bg-red-900/20" : ""}`}
                  >
                    <td className="py-3">{emp.id}</td>
                    <td>{emp.name}</td>
                    <td><StatusBadge status={emp.status} /></td>
                    <td><ComplianceBadge status={compliance} /></td>
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

      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}

/* =========================
   MODAL
========================= */

function EmployeeModal({ employee, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden">

        {/* CLEAN HEADER */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              Employee Profile
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {employee.name} • {employee.id}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 text-lg"
          >
            <FiX />
          </button>
        </div>

        {/* BODY */}
        <div className="p-8 grid grid-cols-2 gap-8 text-sm">

          {/* PERSONAL */}
          <Section title="Personal Information">
            <InfoItem label="Full Name" value={employee.name} />
            <InfoItem label="Email" value="juan.delacruz@gmail.com" />
            <InfoItem label="Phone" value="+63 912 345 6789" />
          </Section>

          {/* EMPLOYMENT */}
          <Section title="Employment Details">
            <InfoItem label="Position" value="Janitor" />
            <InfoItem label="Department" value="Production" />
            <InfoItem label="Date Hired" value="2023-01-15" />
            <InfoItem
              label="Status"
              value={<StatusBadge status={employee.status} />}
            />
          </Section>

          {/* DEPLOYMENT */}
          <Section title="Deployment Information">
            <InfoItem label="Client Company" value="Company 1" />
            <InfoItem label="Deployment Start" value="2023-02-01" />
          </Section>

          {/* DOCUMENTS */}
          <Section title="Documents & Compliance">
            {employee.documents?.length > 0 ? (
              employee.documents.map((doc, index) => (
                <DocumentItem key={index} {...doc} />
              ))
            ) : (
              <p className="text-gray-500 text-sm">
                No documents available.
              </p>
            )}
          </Section>

        </div>
      </div>
    </div>
  );
}
/* =========================
   SMALL COMPONENTS
========================= */

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function DocumentItem({ name, expiry }) {
  const status = getExpiryStatus(expiry);

  return (
    <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/10 pb-3 text-sm">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-gray-500">Expiry Date: {expiry}</p>
      </div>
      <ComplianceBadge status={status} />
    </div>
  );
}

/* =========================
   LOGIC
========================= */

function getExpiryStatus(expiry) {
  if (!expiry) return "No Data";

  const today = new Date();
  const expDate = new Date(expiry);
  const diffDays = (expDate - today) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Expiring Soon";
  return "Valid";
}

function getComplianceStatus(documents = []) {
  if (!documents.length) return "No Data";

  const statuses = documents.map((doc) =>
    getExpiryStatus(doc.expiry)
  );

  if (statuses.includes("Expired")) return "Expired";
  if (statuses.includes("Expiring Soon")) return "Expiring Soon";
  return "Valid";
}

/* =========================
   BADGES
========================= */

function StatusBadge({ status }) {
  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 dark:bg-gray-700">
      {status}
    </span>
  );
}

function ComplianceBadge({ status }) {
  const styles = {
    Valid: "text-green-600",
    "Expiring Soon": "text-amber-500",
    Expired: "text-red-600",
    "No Data": "text-gray-500",
  };

  return (
    <span className={`text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}