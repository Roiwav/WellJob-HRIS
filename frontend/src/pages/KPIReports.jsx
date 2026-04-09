import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

const kpiCards = [
  {
    title: "Deployment Efficiency",
    value: "92%",
    description: "Overall workforce deployment effectiveness",
  },
  {
    title: "Average Turnaround Time",
    value: "3.4 Days",
    description: "Average case resolution turnaround",
  },
  {
    title: "Active Incident Count",
    value: "7",
    description: "Currently open incident-related cases",
  },
  {
    title: "Critical Alerts",
    value: "3",
    description: "Items requiring immediate action",
  },
];

const trendData = [
  { month: "Jan", deployments: 120, incidents: 3 },
  { month: "Feb", deployments: 135, incidents: 4 },
  { month: "Mar", deployments: 128, incidents: 6 },
  { month: "Apr", deployments: 150, incidents: 5 },
  { month: "May", deployments: 162, incidents: 7 },
];

const severityHeatmap = [
  { severity: "Minor", count: 12 },
  { severity: "Major", count: 6 },
  { severity: "Critical", count: 3 },
];

const criticalAlerts = [
  "3 overdue incident resolutions",
  "5 expiring employee compliance documents",
  "2 deployment records need manager review",
];

export default function KPIReports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            KPI Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin
              ? "View-only KPI analytics access for Super Admin."
              : "Review KPI analytics, performance indicators, and export management reports."}
          </p>
        </div>

        <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            Export PDF
          </button>
        </RoleGuard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {kpiCards.map((card) => (
          <div
            key={card.title}
            className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {card.title}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
              {card.value}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {card.description}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Deployment vs. Incidents Trend
          </h2>

          <div className="space-y-4">
            {trendData.map((item) => (
              <div key={item.month} className="space-y-2">
                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>{item.month}</span>
                  <span>
                    Deployments: {item.deployments} | Incidents: {item.incidents}
                  </span>
                </div>

                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-3 rounded-full"
                    style={{ width: `${Math.min(item.deployments / 2, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Violation Severity Heatmap
          </h2>

          <div className="space-y-4">
            {severityHeatmap.map((item) => (
              <div
                key={item.severity}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
              >
                <span className="text-gray-800 dark:text-gray-200 font-medium">
                  {item.severity}
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  {item.count} cases
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Critical Alerts
        </h2>

        <ul className="space-y-3">
          {criticalAlerts.map((alert, index) => (
            <li
              key={index}
              className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
            >
              {alert}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}