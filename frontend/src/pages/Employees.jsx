//Employees.jsx

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
import EditEmployeeModal from '../components/employees/EditEmployeeModal';

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
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-5">{message}</p>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">OK</button>
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

  const createOperationalLog = useCallback(
    async (action, description) => {
      const userName = user?.full_name || user?.fullName || user?.username || "System Admin";

      try {
        await axios.post("http://localhost:5000/api/audit-logs", {
          userId: user?.userId || user?.id || "-",
          username: user?.username || "-",
          full_name: userName,
          role: user?.role || "-",
          category: "OPERATIONAL",
          action,
          description,
        });
        window.dispatchEvent(new Event("dataUpdated"));
      } catch (error) {
        console.error("Failed to save operational log:", error);
      }
    },
    [user]
  );

  const fetchEmployees = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/employees");
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const getCompliance = useCallback((docs) => {
    if (!docs || docs.length === 0) return "No Data";

    const completedCount = REQUIRED_DOCUMENTS.filter((requiredName) => {
      const doc = docs.find((d) => d.name === requiredName);
      if (!doc) return false;
      if (!doc.filePath && !doc.file) return false;
      if (["Barangay Clearance", "NBI/Police Clearance"].includes(requiredName) && !doc.expirationDate) {
        return false;
      }
      return true;
    }).length;

    if (completedCount === REQUIRED_DOCUMENTS.length) return "Complete";
    return "Incomplete";
  }, []);

  const generateId = () => {
    if (!employees || employees.length === 0) return "EMP001";
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
    const confirmArchive = window.confirm("Are you sure you want to archive this employee?");
    if (!confirmArchive) return;

    try {
      await axios.put(`http://localhost:5000/api/employees/archive/${id}`);
      const userName = user?.full_name || user?.fullName || user?.username || "System Admin";
      createOperationalLog("ARCHIVE_EMPLOYEE", `${userName} archived employee record for ${archiveTarget?.name || id}.`);
      
      alert("Employee successfully archived!");
      window.location.reload();
    } catch (error) {
      console.error("Archive Error:", error);
      alert("Failed to archive employee.");
    }
  };

  // 🔥 FIX: Mga bagong functions para saluhin ang signal mula sa Modals at gumawa ng Audit Logs
  const handleAddSuccess = (employeeName) => {
    const userName = user?.full_name || user?.fullName || user?.username || "System Admin";
    createOperationalLog("ADD_EMPLOYEE", `${userName} added employee record for ${employeeName}.`);
    
    setSuccessMessage("Employee saved successfully.");
    setShowModal(false);
    fetchEmployees(); // I-refresh ang data galing sa database
  };

  const handleEditSuccess = (employeeName) => {
    const userName = user?.full_name || user?.fullName || user?.username || "System Admin";
    createOperationalLog("EDIT_EMPLOYEE", `${userName} edited employee record for ${employeeName}.`);
    
    setSuccessMessage("Employee information updated successfully.");
    setShowModal(false);
    setEditingEmployee(null);
    fetchEmployees(); // I-refresh ang data galing sa database
  };

  const activeEmployees = useMemo(() => employees.filter((emp) => !emp.archived), [employees]);

  const filteredEmployees = useMemo(() => {
    const filtered = activeEmployees.filter((emp) => {
      const keyword = search.toLowerCase().trim();
      const matchSearch = String(emp.name || "").toLowerCase().includes(keyword) || String(emp.id || "").toLowerCase().includes(keyword) || String(emp.company || "").toLowerCase().includes(keyword);
      const matchStatus = filterStatus === "All" || emp.status === filterStatus;
      const compliance = getCompliance(emp.documents);
      const matchCompliance = filterCompliance === "All" || compliance === filterCompliance;
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
        case "name-asc": return String(a.name || "").localeCompare(String(b.name || ""));
        case "name-desc": return String(b.name || "").localeCompare(String(a.name || ""));
        case "expired-first":
        case "expiring-first": return getSortPriority(a) - getSortPriority(b);
        case "latest":
        default: return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });
  }, [activeEmployees, search, filterStatus, filterCompliance, sortBy, getCompliance]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin ? "View-only access for Super Admin." : "Manage employee records and workforce information."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isHRManager && (
            <button type="button" onClick={() => navigate("/employees/archive")} className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700" title="Archive">
              <FiArchive />
            </button>
          )}

          <div className="relative">
            <button type="button" onClick={() => setShowSortMenu((prev) => !prev)} className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700" title="Sort employees">
              <FiFilter />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-lg z-30 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">Sort By</div>
                {SORT_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => { setSortBy(option.value); setShowSortMenu(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 ${sortBy === option.value ? "text-indigo-600 dark:text-indigo-300 font-medium" : "text-gray-700 dark:text-gray-200"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isSuperAdmin && (
            <RoleGuard permission={PERMISSIONS.CAN_ADD_EMPLOYEE}>
              <button type="button" onClick={handleOpenModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                + Add Employee
              </button>
            </RoleGuard>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3 mb-4 items-start xl:items-center">
        <div className="relative w-64">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input type="text" placeholder="Search employee..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition" />
        </div>

        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition">
          <option value="All">All Status</option>
          <option value="Deployed">Deployed</option>
          <option value="Floating / Standby">Floating / Standby</option>
        </select>

        <select value={filterCompliance} onChange={(event) => setFilterCompliance(event.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition">
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
      
      {showModal && !editingEmployee && (
        <AddEmployeeModal
          generatedId={generatedId}
          onClose={() => setShowModal(false)}
          employees={employees}
          onSaveSuccess={handleAddSuccess} // 🔥 FIX: Ikinabit na natin ang success signal!
        />
      )}

      {showModal && editingEmployee && (
        <EditEmployeeModal 
          employeeToEdit={editingEmployee}  
          onClose={() => setShowModal(false)}
          onSaveSuccess={handleEditSuccess} // 🔥 FIX: Ikinabit na rin ang edit signal!
        />
      )}

      {viewEmployee && (
        <EmployeeModal employee={viewEmployee} onClose={() => setViewEmployee(null)} />
      )}

      {archiveTarget && !isSuperAdmin && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-slate-700 dark:text-white">Archive Employee</h2>
            <p className="text-sm mb-6 text-gray-900 dark:text-white">
              Are you sure you want to archive <b>{archiveTarget.name}</b>? This employee will be marked as <b>Inactive</b> and removed from the employee management table.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleArchive(archiveTarget.id)} className="flex-1 bg-slate-700 text-white py-2 rounded hover:bg-red-600 transition">Yes, Archive</button>
              <button type="button" onClick={() => setArchiveTarget(null)} className="flex-1 bg-gray-500 text-white py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <SuccessModal message={successMessage} onClose={() => setSuccessMessage("")} />
    </div>
  );
}