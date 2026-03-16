import { useState } from "react";
import EmployeeTable from "../components/employees/EmployeeTable";
import EmployeeModal from "../components/employees/EmployeeModal";
import { FiSearch, FiPlus } from "react-icons/fi";

export default function Employees() {

  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const employees = [

    {
      id: "EMP001",
      name: "Juan Dela Cruz",
      status: "Deployed",
      documents: []
    },

    {
      id: "EMP002",
      name: "Maria Santos",
      status: "Floating / Standby",
      documents: []
    }

  ];

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(search.toLowerCase())
  );

  const getComplianceStatus = (documents = []) => {

    if (!documents.length) return "No Data";

    return "Valid";

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

        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg">

          <FiPlus />
          Add Employee

        </button>

      </div>

      <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/10 px-4 py-2 rounded-lg">

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
        getComplianceStatus={getComplianceStatus}
      />

      <EmployeeModal
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
      />

    </div>

  );

}