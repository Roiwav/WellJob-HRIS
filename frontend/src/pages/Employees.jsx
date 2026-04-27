import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArchive,
  FiFilter,
  FiSearch,
} from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";
import EmployeeModal from "../components/employees/EmployeeModal";
import EmployeeTable from "../components/employees/EmployeeTable";

const EMPLOYEES_KEY = "employees";
const OPERATIONAL_AUDIT_KEY = "operational_audit_logs";

const REQUIRED_DOCUMENTS = [
  "Resume",
  "NSO/PSA",
  "SSS (ID or E1 form)",
  "Pag-IBIG (ID or MDRF Form)",
  "PhilHealth (ID or MDF Form)",
  "Diploma",
  "Cedula",
  "Barangay Clearance",
  "NBI/Police Clearance",
];

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
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-5">
          {message}
        </p>

        <div className="flex justify-end">
          <button
            type="button"
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

function safeParse(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isHRManager = user?.role === "HR_MANAGER";

  const [employees, setEmployees] = useState(() => safeParse(EMPLOYEES_KEY));
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

  const createOperationalLog = useCallback(
    (action, description) => {
      const existingLogs = safeParse(OPERATIONAL_AUDIT_KEY);

      const newLog = {
        id: Date.now(),
        user_id: user?.userId || "-",
        username: user?.username || "-",
        full_name: user?.fullName || "-",
        role: user?.role || "-",
        category: "OPERATIONAL",
        action,
        description,
        created_at: new Date().toISOString(),
      };

      localStorage.setItem(
        OPERATIONAL_AUDIT_KEY,
        JSON.stringify([newLog, ...existingLogs])
      );

      window.dispatchEvent(new Event("dataUpdated"));
    },
    [user]
  );

  const saveToStorage = useCallback((data) => {
    setEmployees(data);
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("dataUpdated"));
  }, []);

const getCompliance = useCallback((docs) => {
  if (!docs || docs.length === 0) return "No Data";

  const completedCount = REQUIRED_DOCUMENTS.filter((requiredName) => {
    const doc = docs.find((d) => d.name === requiredName);

    if (!doc) return false;

    if (!doc.file) return false;

    if (
      ["Barangay Clearance", "NBI/Police Clearance"].includes(requiredName) &&
      !doc.expirationDate
    ) {
      return false;
    }

    return true;
  }).length;

  if (completedCount === REQUIRED_DOCUMENTS.length) return "Complete";

  return "Incomplete";
}, []);

  const generateId = () => {
    const stored = safeParse(EMPLOYEES_KEY);
    if (stored.length === 0) return "EMP001";

    const numbers = stored
      .map((emp) => parseInt(String(emp.id || "").replace("EMP", ""), 10))
      .filter((num) => !Number.isNaN(num));

    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `EMP${String(next).padStart(3, "0")}`;
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
        emp.id === editingEmployee.id
          ? {
              ...emp,
              ...data,
              deployment: emp.deployment || {
                location: "",
                start: "",
                end: "",
                status: "Active",
              },
            }
          : emp
      );

      saveToStorage(updated);

      createOperationalLog(
        "EDIT_EMPLOYEE",
        `edited employee record for ${
          data.name || editingEmployee.name
        }.`
      );

      setSuccessMessage("Employee information updated successfully.");
    } else {
      const newEmployee = {
        id: generatedId,
        uid: Date.now(),
        createdAt: new Date().toISOString(),
        archived: false,
        deployment: {
          location: "",
          start: "",
          end: "",
          status: "Active",
        },
        ...data,
      };

      saveToStorage([...employees, newEmployee]);

      createOperationalLog(
        "ADD_EMPLOYEE",
        `${user?.fullName || "User"} added employee record for ${data.name}.`
      );

      setSuccessMessage("Employee saved successfully.");
    }

    setShowModal(false);
    setEditingEmployee(null);
  };

  const handleEdit = (employee) => {
    if (isSuperAdmin) return;

    setEditingEmployee(employee);
    setGeneratedId(employee.id);
    setShowModal(true);
  };

  const handleArchive = (id) => {
    if (isSuperAdmin) return;

    const target = employees.find((emp) => emp.id === id);

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

    createOperationalLog(
      "ARCHIVE_EMPLOYEE",
      `${user?.fullName || "User"} archived employee record for ${
        target?.name || id
      }.`
    );

    setArchiveTarget(null);
    setSuccessMessage("Employee archived successfully.");
  };

  const activeEmployees = useMemo(
    () => employees.filter((emp) => !emp.archived),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const filtered = activeEmployees.filter((emp) => {
      const keyword = search.toLowerCase().trim();

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

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return String(a.name || "").localeCompare(String(b.name || ""));
        case "name-desc":
          return String(b.name || "").localeCompare(String(a.name || ""));
        case "expired-first":
        case "expiring-first":
          return getSortPriority(a) - getSortPriority(b);
        case "latest":
        default:
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
      }
    });
  }, [
    activeEmployees,
    search,
    filterStatus,
    filterCompliance,
    sortBy,
    getCompliance,
  ]);

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
          {isHRManager && (
            <button
              type="button"
              onClick={() => navigate("/employees/archive")}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700"
              title="Archive"
            >
              <FiArchive />
            </button>
          )}

          <div className="relative">
            <button
              type="button"
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
                    type="button"
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
                type="button"
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
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
        >
          <option value="All">All Status</option>
          <option value="Deployed">Deployed</option>
          <option value="Floating / Standby">Floating / Standby</option>
        </select>

        <select
          value={filterCompliance}
          onChange={(event) => setFilterCompliance(event.target.value)}
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

<EmployeeTable
  employees={filteredEmployees}
  openModal={(emp) => setViewEmployee(emp)}
  onEdit={handleEdit}
  getComplianceStatus={getCompliance}
  onArchive={(emp) => setArchiveTarget(emp)}
  isHRManager={isHRManager}
  isSuperAdmin={isSuperAdmin}
/>
      {showModal && !isSuperAdmin && (
        <AddEmployeeModal
          generatedId={generatedId}
          onClose={() => {
            setShowModal(false);
            setEditingEmployee(null);
          }}
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
              Are you sure you want to archive <b>{archiveTarget.name}</b>? This
              employee will be marked as <b>Inactive</b> and removed from the
              employee management table.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleArchive(archiveTarget.id)}
                className="flex-1 bg-slate-700 text-white py-2 rounded hover:bg-red-600 transition"
              >
                Yes, Archive
              </button>

              <button
                type="button"
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