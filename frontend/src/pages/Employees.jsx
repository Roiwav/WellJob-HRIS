import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import EmployeeTable from "../components/employees/EmployeeTable";
import EmployeeModal from "../components/employees/EmployeeModal";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";
import { FiSearch, FiPlus } from "react-icons/fi";

/* 🔥 PORTAL TOAST */
function ToastPortal({ show, message }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed bottom-6 right-6 z-[99999] pointer-events-none transform transition-all duration-500 ${
        show
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-10"
      }`}
    >
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
        {message}
      </div>
    </div>,
    document.body
  );
}


export default function Employees() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeFormModal, setShowEmployeeFormModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 🔥 FIX: LOAD FROM LOCAL STORAGE
  const [employees, setEmployees] = useState(() => {
    const stored = localStorage.getItem("employees");
    return stored
      ? JSON.parse(stored)
      : [
          {
            uid: 1,
            id: "EMP001",
            name: "Juan Dela Cruz",
            status: "Deployed",
            documents: []
          },
          {
            uid: 2,
            id: "EMP002",
            name: "Maria Santos",
            status: "Floating / Standby",
            documents: []
          }
        ];
  });

  // 🔥 AUTO SAVE
  useEffect(() => {
    localStorage.setItem("employees", JSON.stringify(employees));
  }, [employees]);

  const filteredEmployees = employees.filter((emp) => {
    const searchValue = search.toLowerCase().trim();

    const matchesSearch =
      emp.name.toLowerCase().includes(searchValue) ||
      emp.id.toLowerCase().includes(searchValue);

    const matchesStatus =
      statusFilter === "All" || emp.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getComplianceStatus = (documents = []) => {
    if (!documents.length) return "No Data";
    if (documents.length === 3) return "Complete";
    return "Incomplete";
  };

  const generateEmployeeId = () => {
    const validNumbers = employees.map((emp) => {
      const match = emp.id?.match(/^EMP(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });

    const next = (validNumbers.length ? Math.max(...validNumbers) : 0) + 1;
    return `EMP${String(next).padStart(3, "0")}`;
  };

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setShowEmployeeFormModal(true);
  };

  const handleOpenEditModal = (employee) => {
    setEditingEmployee(employee);
    setShowEmployeeFormModal(true);
  };

  const handleCloseFormModal = () => {
    setShowEmployeeFormModal(false);
    setEditingEmployee(null);
  };

  // 🔥 FINAL SYSTEM LOGIC
  const handleSaveEmployee = (employeeData) => {
    let savedEmployee;

    if (editingEmployee) {
      savedEmployee = {
        ...editingEmployee,
        ...employeeData
      };

      setEmployees((prev) =>
        prev.map((e) =>
          e.uid === editingEmployee.uid ? savedEmployee : e
        )
      );
    } else {
      savedEmployee = {
        uid: Date.now(),
        id: generateEmployeeId(),
        ...employeeData
      };

      setEmployees((prev) => [...prev, savedEmployee]);
    }

    // 🔥 DEPLOYMENT SYNC
    let deployments =
      JSON.parse(localStorage.getItem("deployments")) || [];

    if (savedEmployee.status === "Deployed") {
      const exists = deployments.find(
        (d) => d.employee === savedEmployee.name
      );

      if (!exists) {
        deployments.push({
          id: Date.now(),
          employee: savedEmployee.name,
          company: savedEmployee.company || "N/A",
          location: "Not Set",
          start: new Date().toLocaleDateString(),
          end: "—",
          status: "Active"
        });
      }
    } else {
      deployments = deployments.filter(
        (d) => d.employee !== savedEmployee.name
      );
    }

    localStorage.setItem("deployments", JSON.stringify(deployments));

    handleCloseFormModal();

    setShowToast(false);

    setTimeout(() => {
      setToastMessage(
        editingEmployee
          ? "Employee updated successfully!"
          : "Employee added successfully!"
      );

      setShowToast(true);

      setTimeout(() => setShowToast(false), 2000);
    }, 50);
  };

  const handleDeleteEmployee = (uid) => {
    const emp = employees.find((e) => e.uid === uid);

    setEmployees((prev) => prev.filter((e) => e.uid !== uid));

    let deployments =
      JSON.parse(localStorage.getItem("deployments")) || [];

    deployments = deployments.filter(
      (d) => d.employee !== emp?.name
    );

    localStorage.setItem("deployments", JSON.stringify(deployments));

    if (selectedEmployee?.uid === uid) setSelectedEmployee(null);
  };

  return (
    <>
      <div className="space-y-8">

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">
              Employee Master List
            </h1>
            <p className="text-sm text-gray-500">
              Manage employee records and compliance
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            <FiPlus />
            Add Employee
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg w-[250px]">
            <FiSearch />
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
            className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm outline-none"
          >
            <option value="All">All Status</option>
            <option value="Deployed">Deployed</option>
            <option value="Floating / Standby">Floating / Standby</option>
          </select>
        </div>

        <EmployeeTable
          employees={filteredEmployees}
          openModal={setSelectedEmployee}
          onEdit={handleOpenEditModal}
          getComplianceStatus={getComplianceStatus}
          onDelete={handleDeleteEmployee}
        />

        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />

        {showEmployeeFormModal && (
          <AddEmployeeModal
            onClose={handleCloseFormModal}
            onSave={handleSaveEmployee}
            generatedId={
              editingEmployee ? editingEmployee.id : generateEmployeeId()
            }
            editingEmployee={editingEmployee}
          />
        )}
      </div>

      <ToastPortal show={showToast} message={toastMessage} />
    </>
  );
}