import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

export default function Incidents() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Incident Reports</h1>
        
        <RoleGuard permission={PERMISSIONS.CAN_ADD_INCIDENT}>
          <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
            + Add Incident Report
          </button>
        </RoleGuard>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6 text-gray-600 dark:text-gray-300">
        <p>Incident history goes here.</p>
      </div>
    </div>
  );
}