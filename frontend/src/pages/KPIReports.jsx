import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

export default function KPIReports() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">KPI Reports</h1>
        
        <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            Export PDF
          </button>
        </RoleGuard>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6 text-gray-600 dark:text-gray-300">
        <p>Data visualization goes here. SUPER_ADMIN can view this but not export it.</p>
      </div>
    </div>
  );
}