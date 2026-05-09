// Employees.jsx

import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiArchive, FiFilter, FiSearch } from "react-icons/fi";
import axios from "axios";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";
import EmployeeModal from "../components/employees/EmployeeModal";
import EmployeeTable from "../components/employees/EmployeeTable";
import EditEmployeeModal from "../components/employees/EditEmployeeModal";

const EMPLOYEE_API_URL = "http://localhost:5000/api/employees";
const AUDIT_API_URL = "http://localhost:5000/api/audit-logs";
const DATA_EVENT_SOURCE = "employees-page";

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

function emitDataUpdated(action = "EMPLOYEES_UPDATED") {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: DATA_EVENT_SOURCE,
        domain: "employees",
        action,
        at: Date.now(),
      },
    })
  );
}

function SuccessModal({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h3 className="mb-2 text-lg font-bold text-green-600">Success</h3>

        <p className="mb-5 text-sm text-gray-700 dark:text-gray-300">
          {message}
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
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
  const isHRManager = user?.role === "HR_MANAGER";

  const [employees, setEmployees] = useState([]);
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
  const [fetchError, setFetchError] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

  const createOperationalLog = useCallback(
    async (action, description) => {
      const userName =
        user?.full_name || user?.fullName || user?.username || "System Admin";

      try {
        await axios.post(AUDIT_API_URL, {
          userId: user?.userId || user?.id || "-",
          username: user?.username || "-",
          full_name: userName,
          role: user?.role || "-",
          category: "OPERATIONAL",
          action,
          description,
        });
      } catch (error) {
        console.error("Failed to save operational log:", error);
      }
    },
    [user]
  );

  const fetchEmployees = useCallback(async () => {
    try {
      setFetchError("");

      const res = await axios.get(EMPLOYEE_API_URL);

      if (Array.isArray(res.data)) {
        setEmployees(res.data);
      } else {
        setEmployees([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setEmployees([]);

      if (err.response && err.response.status === 503) {
        setFetchError(
          "System is currently under maintenance. Please try again later."
        );
      } else {
        setFetchError(err.message || "Unable to load employees data.");
      }
    } finally {
      setIsLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    const handleDataUpdated = (event) => {
      if (event?.detail?.source === DATA_EVENT_SOURCE) return;
      fetchEmployees();
    };

    const handleWindowFocus = () => {
      fetchEmployees();
    };

    window.addEventListener("dataUpdated", handleDataUpdated);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdated);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [fetchEmployees]);

  const getCompliance = useCallback((docs) => {
    if (!Array.isArray(docs) || docs.length === 0) return "No Data";

    let hasMissing = false;
    let hasExpired = false;
    let hasExpiringSoon = false;

    REQUIRED_DOCUMENTS.forEach((requiredName) => {
      const doc = docs.find((item) => item?.name === requiredName);
      const hasFile = Boolean(doc?.filePath || doc?.file || doc?.url);

      if (!doc || !hasFile) {
        hasMissing = true;
        return;
      }

      const needsExpiration = [
        "Barangay Clearance",
        "NBI/Police Clearance",
      ].includes(requiredName);

      if (!needsExpiration) return;

      const expirationValue =
        doc.expirationDate ||
        doc.expiration_date ||
        doc.expiryDate ||
        doc.expiresAt;

      if (!expirationValue) {
        hasMissing = true;
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expirationDate = new Date(expirationValue);

      if (Number.isNaN(expirationDate.getTime())) {
        hasMissing = true;
        return;
      }

      expirationDate.setHours(0, 0, 0, 0);

      const daysBeforeExpiration = Math.ceil(
        (expirationDate.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysBeforeExpiration < 0) {
        hasExpired = true;
        return;
      }

      if (daysBeforeExpiration <= 30) {
        hasExpiringSoon = true;
      }
    });

    if (hasExpired) return "Expired";
    if (hasExpiringSoon) return "Expiring Soon";
    if (hasMissing) return "Incomplete";

    return "Valid";
  }, []);

  const generateId = () => {
    if (!Array.isArray(employees) || employees.length === 0) return "EMP001";

    const numbers = employees
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

  const handleEdit = (employee) => {
    if (isSuperAdmin) return;

    setEditingEmployee({
      ...employee,
      documents: employee.documents || [],
    });

    setGeneratedId(employee.id);
    setShowModal(true);
  };

  const handleArchive = async (id) => {
    if (!archiveTarget || isArchiving) return;

    try {
      setIsArchiving(true);

      await axios.put(`${EMPLOYEE_API_URL}/archive/${id}`);

      const userName =
        user?.full_name || user?.fullName || user?.username || "System Admin";

      await createOperationalLog(
        "ARCHIVE_EMPLOYEE",
        `${userName} archived employee record for ${
          archiveTarget?.name || id
        }.`
      );

      setSuccessMessage("Employee archived successfully.");
      setArchiveTarget(null);

      await fetchEmployees();
      emitDataUpdated("ARCHIVE_EMPLOYEE");
    } catch (error) {
      console.error("Archive Error:", error);

      setFetchError(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error.message ||
          "Failed to archive employee."
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleAddSuccess = (employeeName) => {
    const userName =
      user?.full_name || user?.fullName || user?.username || "System Admin";

    void (async () => {
      await createOperationalLog(
        "ADD_EMPLOYEE",
        `${userName} added employee record for ${employeeName}.`
      );

      setSuccessMessage("Employee saved successfully.");
      setShowModal(false);

      await fetchEmployees();
      emitDataUpdated("ADD_EMPLOYEE");
    })();
  };

  const handleEditSuccess = (employeeName) => {
    const userName =
      user?.full_name || user?.fullName || user?.username || "System Admin";

    void (async () => {
      await createOperationalLog(
        "EDIT_EMPLOYEE",
        `${userName} edited employee record for ${employeeName}.`
      );

      setSuccessMessage("Employee information updated successfully.");
      setShowModal(false);
      setEditingEmployee(null);

      await fetchEmployees();
      emitDataUpdated("EDIT_EMPLOYEE");
    })();
  };

  const activeEmployees = useMemo(() => {
    if (!Array.isArray(employees)) return [];
    return employees.filter((emp) => !emp.archived);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const cleanSearch = search
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    const searchTerms = cleanSearch ? cleanSearch.split(/\s+/) : [];
    const rawSearch = search.toLowerCase().trim();

    const filtered = activeEmployees.filter((emp) => {
      const cleanName = String(emp.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "");

      const empId = String(emp.id || "").toLowerCase();
      const empCompany = String(emp.company || "").toLowerCase();

      const matchName =
        searchTerms.length === 0 ||
        searchTerms.every((term) => cleanName.includes(term));

      const matchSearch =
        !rawSearch ||
        matchName ||
        empId.includes(rawSearch) ||
        empCompany.includes(rawSearch);

      const matchStatus = filterStatus === "All" || emp.status === filterStatus;

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
            new Date(b.createdAt || b.created_at || 0).getTime() -
            new Date(a.createdAt || a.created_at || 0).getTime()
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
    <div className="space-y-6 p-8">
      {fetchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {fetchError}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Employees Management
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              title="Archive"
            >
              <FiArchive />
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortMenu((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              title="Sort employees"
            >
              <FiFilter />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-slate-900">
                <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  Sort By
                </div>

                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-800 ${
                      sortBy === option.value
                        ? "font-medium text-indigo-600 dark:text-indigo-300"
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
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              >
                + Add Employee
              </button>
            </RoleGuard>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col items-start gap-3 xl:flex-row xl:items-center">
        <div className="relative w-64">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />

          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="All">All Status</option>
          <option value="Deployed">Deployed</option>
          <option value="Floating / Standby">Floating / Standby</option>
        </select>

        <select
          value={filterCompliance}
          onChange={(event) => setFilterCompliance(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="All">All Compliance</option>
          <option value="Valid">Valid</option>
          <option value="Expiring Soon">Expiring Soon</option>
          <option value="Expired">Expired</option>
          <option value="Incomplete">Incomplete</option>
          <option value="No Data">No Data</option>
        </select>
      </div>

      {isLoadingEmployees ? (
        <div className="rounded-3xl border border-gray-200 bg-white px-6 py-14 text-center text-sm font-semibold text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
          Loading employee records...
        </div>
      ) : (
        <EmployeeTable
          employees={filteredEmployees}
          openModal={(emp) => setViewEmployee(emp)}
          onEdit={handleEdit}
          getComplianceStatus={getCompliance}
          onArchive={(emp) => setArchiveTarget(emp)}
          isHRManager={isHRManager}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {showModal && !editingEmployee && (
        <AddEmployeeModal
          generatedId={generatedId}
          onClose={() => setShowModal(false)}
          employees={employees}
          onSaveSuccess={handleAddSuccess}
        />
      )}

      {showModal && editingEmployee && (
        <EditEmployeeModal
          employeeToEdit={editingEmployee}
          employees={employees}
          onClose={() => {
            setShowModal(false);
            setEditingEmployee(null);
          }}
          onSaveSuccess={handleEditSuccess}
        />
      )}

      {viewEmployee && (
        <EmployeeModal
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
        />
      )}

      {archiveTarget && !isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-bold text-slate-700 dark:text-white">
              Archive Employee
            </h2>

            <p className="mb-6 text-sm text-gray-900 dark:text-white">
              Are you sure you want to archive <b>{archiveTarget.name}</b>? This
              employee will be marked as <b>Inactive</b> and removed from the
              employee management table.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleArchive(archiveTarget.id)}
                disabled={isArchiving}
                className="flex-1 rounded bg-slate-700 py-2 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isArchiving ? "Archiving..." : "Yes, Archive"}
              </button>

              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                disabled={isArchiving}
                className="flex-1 rounded bg-gray-500 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
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