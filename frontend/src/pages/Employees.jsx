import { useState } from "react";
import EmployeeTable from "../components/employees/EmployeeTable";
import EmployeeModal from "../components/employees/EmployeeModal";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";
import { FiSearch, FiPlus } from "react-icons/fi";

export default function Employees() {
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeFormModal, setShowEmployeeFormModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [employees, setEmployees] = useState([
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
  ]);

  const filteredEmployees = employees.filter((emp) => {
  const searchValue = search.toLowerCase().trim();

  return (
    emp.name.toLowerCase().includes(searchValue) ||
    emp.id.toLowerCase().includes(searchValue)
  );
});

  const getComplianceStatus = (documents = []) => {
    if (!documents.length) return "No Data";
    if (documents.length === 3) return "Complete";
    return "Incomplete";
  };

  const generateEmployeeId = () => {
    const validNumbers = employees.map((emp) => {
      if (!emp.id || typeof emp.id !== "string") return 0;

      const match = emp.id.match(/^EMP(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });

    const maxNumber = validNumbers.length ? Math.max(...validNumbers) : 0;
    const nextNumber = maxNumber + 1;

    return `EMP${String(nextNumber).padStart(3, "0")}`;
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

  const handleSaveEmployee = (employeeData) => {
    if (editingEmployee) {
      setEmployees((prevEmployees) =>
        prevEmployees.map((employee) =>
          employee.uid === editingEmployee.uid
            ? {
                ...employee,
                name: employeeData.name,
                status: employeeData.status,
                documents: employeeData.documents || []
              }
            : employee
        )
      );

      if (selectedEmployee?.uid === editingEmployee.uid) {
        setSelectedEmployee((prev) => ({
          ...prev,
          name: employeeData.name,
          status: employeeData.status,
          documents: employeeData.documents || []
        }));
      }
    } else {
      const employeeWithId = {
        uid: Date.now(),
        id: generateEmployeeId(),
        name: employeeData.name,
        status: employeeData.status,
        documents: employeeData.documents || []
      };

      setEmployees((prevEmployees) => [...prevEmployees, employeeWithId]);
    }

    handleCloseFormModal();
  };

  const handleDeleteEmployee = (uid) => {
    setEmployees((prevEmployees) =>
      prevEmployees.filter((employee) => employee.uid !== uid)
    );

    if (selectedEmployee?.uid === uid) {
      setSelectedEmployee(null);
    }

    if (editingEmployee?.uid === uid) {
      handleCloseFormModal();
    }
  };

  return (
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

      <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/10 px-4 py-2 rounded-lg w-[250px]">
        <FiSearch />

        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent outline-none text-sm w-full"
        />
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
          generatedId={editingEmployee ? editingEmployee.id : generateEmployeeId()}
          editingEmployee={editingEmployee}
        />
      )}
    </div>
  );
}