import { useMemo } from "react";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import ViolationTrendChart from "../components/dashboard/ViolationTrendChart";
import ComplianceTrendChart from "../components/dashboard/ComplianceTrendChart";
import UtilizationTrendChart from "../components/dashboard/UtilizationTrendChart";

import KPICards from "../components/kpi/KPICards";
import HighRiskEmployees from "../components/kpi/HighRiskEmployees";
import RiskTable from "../components/kpi/RiskTable";

const EMPLOYEES_KEY = "employees";
const INCIDENTS_KEY = "incidents";
const DEPLOYMENTS_KEY = "deployments";

function safeParse(key) {
  try {
    const value = localStorage.getItem(key);
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to parse localStorage key: ${key}`, error);
    return [];
  }
}

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

function getMonthLabel(dateString) {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-US", { month: "short" });
}

export default function KPIReports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const employeesRaw = useMemo(() => safeParse(EMPLOYEES_KEY), []);
  const incidentsRaw = useMemo(() => safeParse(INCIDENTS_KEY), []);
  const deploymentsRaw = useMemo(() => safeParse(DEPLOYMENTS_KEY), []);

  const employees = useMemo(() => {
    return employeesRaw.map((emp, index) => {
      const employeeId =
        emp.id || emp.employeeId || emp.employee_id || `EMP-${index + 1}`;
      const employeeName = emp.name || emp.full_name || "Unknown Employee";

      const relatedIncidents = incidentsRaw.filter(
        (incident) =>
          incident.employeeId === employeeId ||
          incident.employee_id === employeeId ||
          incident.employee === employeeName
      );

      const activeDeployment = deploymentsRaw.find(
        (deployment) =>
          deployment.employeeId === employeeId ||
          deployment.employee_id === employeeId ||
          deployment.employee === employeeName
      );

      return {
        id: employeeId,
        name: employeeName,
        company:
          activeDeployment?.company ||
          activeDeployment?.clientCompany ||
          emp.company ||
          "Unassigned",
        violationCount: relatedIncidents.length,
      };
    });
  }, [employeesRaw, incidentsRaw, deploymentsRaw]);

  const totalEmployees = employees.length;

  const repeatOffenders = employees.filter(
    (emp) => emp.violationCount === 2
  ).length;

  const highRiskEmployees = employees.filter(
    (emp) => emp.violationCount >= 3
  ).length;

  const compliantEmployees = employees.filter(
    (emp) => emp.violationCount === 0
  ).length;

  const complianceRate =
    totalEmployees > 0
      ? Math.round((compliantEmployees / totalEmployees) * 100)
      : 0;

  const criticalAlerts = useMemo(() => {
    const openIncidents = incidentsRaw.filter(
      (incident) => incident.status === "Open"
    ).length;

    const investigatingIncidents = incidentsRaw.filter(
      (incident) => incident.status === "Investigating"
    ).length;

    const criticalIncidents = incidentsRaw.filter(
      (incident) => incident.severity === "Critical"
    ).length;

    return [
      {
        level: "HIGH",
        text: `${criticalIncidents} critical incident case(s) detected`,
      },
      {
        level: "MEDIUM",
        text: `${investigatingIncidents} incident(s) under investigation`,
      },
      {
        level: "LOW",
        text: `${openIncidents} open incident case(s) awaiting action`,
      },
    ];
  }, [incidentsRaw]);

  const violationTrend = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthMap = months.reduce((acc, month) => {
      acc[month] = 0;
      return acc;
    }, {});

    incidentsRaw.forEach((incident) => {
      const month = getMonthLabel(incident.date);
      if (monthMap[month] !== undefined) {
        monthMap[month] += 1;
      }
    });

    return months.map((month) => ({
      month,
      violations: monthMap[month],
    }));
  }, [incidentsRaw]);

  const complianceTrend = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const running = [];
    let cumulativeIncidents = 0;

    months.forEach((month) => {
      const monthViolations = violationTrend.find(
        (item) => item.month === month
      )?.violations || 0;

      cumulativeIncidents += monthViolations;

      const cleanEmployees =
        totalEmployees > 0
          ? Math.max(totalEmployees - cumulativeIncidents, 0)
          : 0;

      const compliance =
        totalEmployees > 0
          ? Math.round((cleanEmployees / totalEmployees) * 100)
          : 0;

      running.push({
        month,
        compliance,
      });
    });

    return running;
  }, [violationTrend, totalEmployees]);

  const utilizationTrend = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthlyDeployments = months.map((month) => {
      const count = deploymentsRaw.filter((deployment) => {
        const rawDate =
          deployment.startDate ||
          deployment.deploymentDate ||
          deployment.date ||
          "";

        return getMonthLabel(rawDate) === month;
      }).length;

      const utilization =
        totalEmployees > 0
          ? Math.round((count / totalEmployees) * 100)
          : 0;

      return {
        month,
        utilization,
      };
    });

    return monthlyDeployments;
  }, [deploymentsRaw, totalEmployees]);

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