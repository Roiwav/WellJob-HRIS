import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import ViolationTrendChart from "../components/dashboard/ViolationTrendChart";
import ComplianceTrendChart from "../components/dashboard/ComplianceTrendChart";
import UtilizationTrendChart from "../components/dashboard/UtilizationTrendChart";

import KPICards from "../components/kpi/KPICards";
import HighRiskEmployees from "../components/kpi/HighRiskEmployees";
import RiskTable from "../components/kpi/RiskTable";

const employees = [
  { id: 1, name: "Juan Dela Cruz", company: "ABC Corp", violationCount: 3 },
  { id: 2, name: "Maria Santos", company: "XYZ Ltd", violationCount: 1 },
  { id: 3, name: "Pedro Reyes", company: "DEF Inc", violationCount: 4 },
  { id: 4, name: "Angela Cruz", company: "Northline Services", violationCount: 2 },
  { id: 5, name: "Carlo Mendoza", company: "Prime Solutions", violationCount: 0 },
  { id: 6, name: "Jessa Villanueva", company: "ABC Corp", violationCount: 3 },
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
  { level: "HIGH", text: "3 overdue incident resolutions" },
  { level: "MEDIUM", text: "5 expiring employee compliance documents" },
  { level: "LOW", text: "2 deployment records need manager review" },
];

function getSeverity(count) {
  if (count >= 4) return "Critical";
  if (count >= 2) return "Moderate";
  if (count >= 1) return "Low";
  return "None";
}

function getRiskLevel(count) {
  if (count >= 3) return "High Risk";
  if (count === 2) return "Repeat";
  if (count === 1) return "Monitor";
  return "Clean";
}

function getAlertClasses(level) {
  switch (level) {
    case "HIGH":
      return "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300";
    case "MEDIUM":
      return "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300";
    case "LOW":
      return "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300";
    default:
      return "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300";
  }
}

export default function KPIReports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const totalEmployees = employees.length;
  const repeatOffenders = employees.filter(
    (emp) => emp.violationCount >= 2 && emp.violationCount < 3
  ).length;
  const highRiskEmployees = employees.filter(
    (emp) => emp.violationCount >= 3
  ).length;
  const compliantEmployees = employees.filter(
    (emp) => emp.violationCount === 0
  ).length;
  const complianceRate = Math.round((compliantEmployees / totalEmployees) * 100);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            KPI Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {isSuperAdmin
              ? "View-only KPI analytics access for Super Admin."
              : "Detailed KPI analytics, risk monitoring, and report generation for workforce decision-making."}
          </p>
        </div>

        <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-sm">
            Export PDF
          </button>
        </RoleGuard>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            KPI Summary
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Key workforce and compliance indicators for quick executive review.
          </p>
        </div>

        <KPICards
          totalEmployees={totalEmployees}
          complianceRate={complianceRate}
          repeatOffenders={repeatOffenders}
          highRiskEmployees={highRiskEmployees}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Critical Alerts
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Priority operational issues that require monitoring and intervention.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {criticalAlerts.map((alert, index) => (
            <div
              key={index}
              className={`rounded-2xl border px-4 py-4 shadow-sm ${getAlertClasses(alert.level)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold tracking-wide uppercase">
                  {alert.level}
                </span>
              </div>

              <p className="text-sm font-medium">{alert.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Risk Intelligence
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Identifies repeat offenders and high-risk employees based on recorded violations.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <HighRiskEmployees employees={employees} />
          </div>

          <div className="xl:col-span-2">
            <RiskTable
              employees={employees}
              getSeverity={getSeverity}
              getRiskLevel={getRiskLevel}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Analytics Trends
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tracks workforce violations, employee compliance, and deployment utilization over time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ViolationTrendChart data={violationTrend} />
          <ComplianceTrendChart data={complianceTrend} />
          <UtilizationTrendChart data={utilizationTrend} />
        </div>
      </section>
    </div>
  );
}