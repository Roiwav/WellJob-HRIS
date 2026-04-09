import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

const incidents = [
  {
    id: "INC-1001",
    employee: "Juan Dela Cruz",
    type: "Late Attendance",
    severity: "Minor",
    status: "Open",
  },
  {
    id: "INC-1002",
    employee: "Maria Santos",
    type: "Absence Without Leave",
    severity: "Major",
    status: "Under Review",
  },
  {
    id: "INC-1003",
    employee: "Carlo Reyes",
    type: "Policy Violation",
    severity: "Critical",
    status: "Resolved",
  },
];

export default function Incidents() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Incident Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin
              ? "View-only access for Super Admin."
              : "Monitor incidents and manage disciplinary actions."}
          </p>
        </div>

        <RoleGuard permission={PERMISSIONS.CAN_ADD_INCIDENT}>
          <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
            + Add Incident Report
          </button>
        </RoleGuard>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/70 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-4">Incident ID</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Violation Type</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {incidents.map((incident) => (
                <tr
                  key={incident.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4">{incident.id}</td>
                  <td className="px-6 py-4">{incident.employee}</td>
                  <td className="px-6 py-4">{incident.type}</td>
                  <td className="px-6 py-4">{incident.severity}</td>
                  <td className="px-6 py-4">{incident.status}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600">
                        View
                      </button>

                      <RoleGuard permission={PERMISSIONS.CAN_EDIT_INCIDENT}>
                        <button className="px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600">
                          Update
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