import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

export default function Employees() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees Directory</h1>
        
        {/* Only HR_STAFF and HR_MANAGER will see this button. SUPER_ADMIN will not. */}
        <RoleGuard permission={PERMISSIONS.CAN_ADD_EMPLOYEE}>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            + Add Employee
          </button>
        </RoleGuard>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6 text-gray-600 dark:text-gray-300">
        <p>Employee list table goes here. SUPER_ADMIN can view this list, but cannot edit rows.</p>
        {/* For edit buttons inside the table, wrap them in <RoleGuard permission={PERMISSIONS.CAN_EDIT_EMPLOYEE}> as well */}
      </div>
    </div>
  );
}