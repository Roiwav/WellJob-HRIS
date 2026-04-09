import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import ViolationTrendChart from "../components/dashboard/ViolationTrendChart";
import ComplianceTrendChart from "../components/dashboard/ComplianceTrendChart";
import UtilizationTrendChart from "../components/dashboard/UtilizationTrendChart";

const summaryCards = [
  {
    title: "Deployment Efficiency",
    value: "92%",
    description: "Overall workforce deployment effectiveness",
  },
  {
    title: "Average Turnaround Time",
    value: "3.4 Days",
    description: "Average resolution turnaround time",
  },
  {
    title: "Active Incident Count",
    value: "7",
    description: "Open incident-related cases",
  },
];

const violationTrend = [
  { month: "Jan", violations: 3 },
  { month: "Feb", violations: 5 },
  { month: "Mar", violations: 8 },
  { month: "Apr", violations: 4 },
  { month: "May", violations: 6 },
];

const complianceTrend = [
  { month: "Jan", compliance: 90 },
  { month: "Feb", compliance: 92 },
  { month: "Mar", compliance: 95 },
  { month: "Apr", compliance: 93 },
  { month: "May", compliance: 96 },
];

const utilizationTrend = [
  { month: "Jan", utilization: 60 },
  { month: "Feb", utilization: 70 },
  { month: "Mar", utilization: 80 },
  { month: "Apr", utilization: 75 },
  { month: "May", utilization: 85 },
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
              : "Detailed KPI analytics and report generation."}
          </p>
        </div>

        <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            Export PDF
          </button>
        </RoleGuard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaryCards.map((card) => (
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

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Critical Alerts
        </h2>

        <div className="space-y-3">
          {criticalAlerts.map((alert, index) => (
            <div
              key={index}
              className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300"
            >
              {alert}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ViolationTrendChart data={violationTrend} />
        <ComplianceTrendChart data={complianceTrend} />
        <UtilizationTrendChart data={utilizationTrend} />
      </div>
    </div>
  );
}