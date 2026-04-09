import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

export default function KPIReports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            KPI Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin
              ? "View-only access for Super Admin."
              : "Generate and export workforce analytics reports."}
          </p>
        </div>

        <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            Export PDF
          </button>
        </RoleGuard>
      </div>

      {/* DITO IBALIK ANG DATING KPI CONTENT MO */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6 text-gray-600 dark:text-gray-300">
        <p>DITO DAPAT YUNG ORIGINAL KPI CHARTS / TABLE / CARDS MO</p>
      </div>
    </div>
  );
}