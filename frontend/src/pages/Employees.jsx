import { FiSearch } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import {
  FiArchive,
  FiFilter,
  FiEdit2,
  FiEye,
  FiInbox,
} from "react-icons/fi";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";
import EmployeeModal from "../components/employees/EmployeeModal";
import ComplianceBadge from "../components/employees/ComplianceBadge";

const REQUIRED_DOCUMENTS = ["NBI", "Police Clearance", "Health Card"];

const SORT_OPTIONS = [
  { value: "latest", label: "Latest Added" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "expired-first", label: "Expired First" },
  { value: "expiring-first", label: "Urgent Compliance First" },
];

function SuccessModal({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl">
        <h3 className="text-lg font-bold text-green-600 mb-2">Success</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-5">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [employees, setEmployees] = useState(() => {
    const stored = localStorage.getItem("employees");
    return stored ? JSON.parse(stored) : [];
  });

  const [showModal, setShowModal] = useState(false);
  const [generatedId, setGeneratedId] = useState("");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCompliance, setFilterCompliance] = useState("All");
  const [sortBy, setSortBy] = useState("latest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const saveToStorage = (data) => {
    setEmployees(data);
    localStorage.setItem("employees", JSON.stringify(data));
  };

  const generateId = () => {
    const stored = JSON.parse(localStorage.getItem("employees")) || [];
    if (stored.length === 0) return "EMP001";

    const numbers = stored.map((emp) =>
      parseInt(String(emp.id).replace("EMP", ""), 10)
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
      setSuccessMessage("Employee information updated successfully.");
    } else {
      const newEmployee = {
        id: generatedId,
        uid: Date.now(),
        createdAt: new Date().toISOString(),
        archived: false,
        ...data,
      };
      saveToStorage([...employees, newEmployee]);
      setSuccessMessage("Employee saved successfully.");
    }
  };

  const handleEdit = (emp) => {
    if (isSuperAdmin) return;
    setEditingEmployee(emp);
    setGeneratedId(emp.id);
    setShowModal(true);
  };

  const handleView = (emp) => setViewEmployee(emp);

  const handleArchive = (id) => {
    if (isSuperAdmin) return;

    const updated = employees.map((emp) =>
      emp.id === id
        ? {
            ...emp,
            archived: true,
            archivedAt: new Date().toISOString(),
            previousStatus: emp.status,
            status: "Inactive",
          }
        : emp
    );

    saveToStorage(updated);
    setArchiveTarget(null);
    setSuccessMessage("Employee archived successfully.");
  };

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

  const getCompliance = useCallback((docs) => {
    if (!docs || docs.length === 0) return "No Data";

    const statuses = docs.map((doc) => getDocumentStatus(doc.expirationDate));

    if (statuses.includes("Expired")) return "Expired";
    if (statuses.includes("Expiring Soon")) return "Expiring Soon";

    const existingNames = docs.map((doc) => doc.name);
    const hasMissingRequired = REQUIRED_DOCUMENTS.some(
      (requiredDoc) => !existingNames.includes(requiredDoc)
    );

    if (hasMissingRequired) return "Incomplete";
    if (statuses.every((status) => status === "Valid")) return "Valid";

    return "Incomplete";
  }, []);

  const activeEmployees = useMemo(
    () => employees.filter((emp) => !emp.archived),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const filtered = activeEmployees.filter((emp) => {
      const keyword = search.toLowerCase();

      const matchSearch =
        String(emp.name || "").toLowerCase().includes(keyword) ||
        String(emp.id || "").toLowerCase().includes(keyword) ||
        String(emp.company || "").toLowerCase().includes(keyword);

      const matchStatus =
        filterStatus === "All" || emp.status === filterStatus;

      const compliance = getCompliance(emp.documents);
      const matchCompliance =
        filterCompliance === "All" || compliance === filterCompliance;

      return matchSearch && matchStatus && matchCompliance;
    });

    const getSortPriority = (emp) => {
      const compliance = getCompliance(emp.documents);
      if (compliance === "Expired") return 1;
      if (compliance === "Expiring Soon") return 2;
      if (compliance === "Incomplete") return 3;
      if (compliance === "Valid") return 4;
      return 5;
    };

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return String(a.name || "").localeCompare(String(b.name || ""));
        case "name-desc":
          return String(b.name || "").localeCompare(String(a.name || ""));
        case "expired-first":
          return getSortPriority(a) - getSortPriority(b);
        case "expiring-first": {
          const aStatus = getCompliance(a.documents);
          const bStatus = getCompliance(b.documents);

          const aScore =
            aStatus === "Expiring Soon"
              ? 1
              : aStatus === "Expired"
              ? 2
              : aStatus === "Incomplete"
              ? 3
              : aStatus === "Valid"
              ? 4
              : 5;

          const bScore =
            bStatus === "Expiring Soon"
              ? 1
              : bStatus === "Expired"
              ? 2
              : bStatus === "Incomplete"
              ? 3
              : bStatus === "Valid"
              ? 4
              : 5;

          return aScore - bScore;
        }
        case "latest":
        default: {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        }
      }
    });

    return sorted;
  }, [activeEmployees, search, filterStatus, filterCompliance, sortBy, getCompliance]);

  const emptyStateTitle = search
    ? "No employees match your search"
    : filterStatus !== "All" || filterCompliance !== "All"
    ? "No employees match the selected filters"
    : "No employees yet";

  const emptyStateDescription = search
    ? "Try another employee ID, name, or company keyword."
    : filterStatus !== "All" || filterCompliance !== "All"
    ? "Try changing the status or compliance filter."
    : "Start by adding a new employee record.";

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Employees Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin
              ? "View-only access for Super Admin."
              : "Manage employee records and workforce information."}
          </p>
        </div>

        <div className="flex items-center gap-2">
            {user?.role === "HR_MANAGER" && (
              <button
                onClick={() => navigate("/employees/archive")}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700"
                title="Archive"
              >
                <FiArchive />
              </button>
            )}

          <div className="relative">
            <button
              onClick={() => setShowSortMenu((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700"
              title="Sort employees"
            >
              <FiFilter />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-lg z-30 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  Sort By
                </div>

                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSortMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 ${
                      sortBy === option.value
                        ? "text-indigo-600 dark:text-indigo-300 font-medium"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
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
      </div>

    <div className="flex flex-col xl:flex-row gap-3 mb-4 items-start xl:items-center">
      <div className="relative w-64">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />

        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
        />
      </div>

      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
      >
        <option value="All">All Status</option>
        <option value="Deployed">Deployed</option>
        <option value="Floating / Standby">Floating / Standby</option>
      </select>

      <select
        value={filterCompliance}
        onChange={(e) => setFilterCompliance(e.target.value)}
        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
      >
        <option value="All">All Compliance</option>
        <option value="Valid">Valid</option>
        <option value="Expiring Soon">Expiring Soon</option>
        <option value="Expired">Expired</option>
        <option value="Incomplete">Incomplete</option>
        <option value="No Data">No Data</option>
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
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const compliance = getCompliance(emp.documents);

                  return (
                    <tr key={emp.uid || emp.id} className="border-t">
                      <td className="px-6 py-4">{emp.id}</td>
                      <td className="px-6 py-4">{emp.name}</td>
                      <td className="px-6 py-4">{emp.company || "-"}</td>
                      <td className="px-6 py-4">{emp.status}</td>
                      <td className="px-6 py-4">
                        <ComplianceBadge status={compliance} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleView(emp)}
                            className="inline-flex items-center justify-center rounded-lg border px-3 py-2 hover:bg-gray-50 dark:hover:bg-blue-900/30"
                            title="View employee"
                          >
                            <FiEye />
                          </button>

                          {!isSuperAdmin && (
                            <RoleGuard permission={PERMISSIONS.CAN_EDIT_EMPLOYEE}>
                              <button
                                onClick={() => handleEdit(emp)}
                                className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-white hover:bg-amber-600"
                                title="Edit employee"
                              >
                                <FiEdit2 />
                              </button>
                            </RoleGuard>
                          )}

                            {user?.role === "HR_MANAGER" && (
                              <button
                                onClick={() => setArchiveTarget(emp)}
                                className="inline-flex items-center justify-center rounded-lg bg-slate-700 px-3 py-2 text-white hover:bg-red-600 transition"
                                title="Archive employee"
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
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700">
                      <FiInbox className="text-gray-500" size={22} />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {emptyStateTitle}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {emptyStateDescription}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && !isSuperAdmin && (
        <AddEmployeeModal
          generatedId={generatedId}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          editingEmployee={editingEmployee}
          employees={employees}
        />
      )}

      {viewEmployee && (
        <EmployeeModal
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
        />
      )}

      {archiveTarget && !isSuperAdmin && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-slate-700 dark:text-white">
              Archive Employee
            </h2>

            <p className="text-sm mb-6 text-gray-900 dark:text-white">
              Are you sure you want to archive <b>{archiveTarget.name}</b>?
              This employee will be marked as <b>Inactive</b> and removed from the employee management table.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => handleArchive(archiveTarget.id)}
                className="flex-1 bg-slate-700 text-white py-2 rounded hover:bg-red-600 transition"
              >
                Yes, Archive
              </button>

              <button
                onClick={() => setArchiveTarget(null)}
                className="flex-1 bg-gray-500 text-white py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        message={successMessage}
        onClose={() => setSuccessMessage("")}
      />
    </div>
  );
}