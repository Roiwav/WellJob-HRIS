import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

const employees = [
  {
    id: "EMP-001",
    name: "Juan Dela Cruz",
    company: "ABC Manufacturing",
    status: "Active",
  },
  {
    id: "EMP-002",
    name: "Maria Santos",
    company: "XYZ Logistics",
    status: "Deployed",
  },
  {
    id: "EMP-003",
    name: "Carlo Reyes",
    company: "Northline Services",
    status: "Inactive",
  },
];

export default function Employees() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

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

        <RoleGuard permission={PERMISSIONS.CAN_ADD_EMPLOYEE}>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            + Add Employee
          </button>
        </RoleGuard>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/70 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {employees.map((employee) => (
                <tr
                  key={employee.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4">{employee.id}</td>
                  <td className="px-6 py-4">{employee.name}</td>
                  <td className="px-6 py-4">{employee.company}</td>
                  <td className="px-6 py-4">{employee.status}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600">
                        View
                      </button>

                      <RoleGuard permission={PERMISSIONS.CAN_EDIT_EMPLOYEE}>
                        <button className="px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600">
                          Edit
                        </button>
                      </RoleGuard>

                      <RoleGuard permission={PERMISSIONS.CAN_DELETE_EMPLOYEE}>
                        <button className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700">
                          Delete
                        </button>
                      </RoleGuard>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}