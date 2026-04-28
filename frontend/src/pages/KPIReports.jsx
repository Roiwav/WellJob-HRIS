import { useMemo } from "react";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import KPISummarySection from "../components/kpi/sections/KPISummarySection";
import CriticalAlerts from "../components/kpi/sections/CriticalAlerts";
import HighRiskEmployees from "../components/kpi/sections/HighRiskEmployees";
import RiskIntelligenceSection from "../components/kpi/sections/RiskIntelligenceSection";
import AnalyticsTrendsSection from "../components/kpi/sections/AnalyticsTrendsSection";

import {
  EMPLOYEES_KEY,
  INCIDENTS_KEY,
  safeParse,
  normalizeStatus,
  isSameEmployee,
  buildKPIEmployees,
  buildViolationTrend,
  buildComplianceTrend,
  buildUtilizationTrend,
} from "../utils/kpi/kpiHelpers";

import { exportKPIReportPDF } from "../utils/kpi/kpiPdfExport";

export default function KPIReports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const employeesRaw = useMemo(() => {
    return safeParse(EMPLOYEES_KEY).filter((emp) => !emp.archived);
  }, []);

  const incidentsRaw = useMemo(() => {
    const allIncidents = safeParse(INCIDENTS_KEY);

    return allIncidents
      .map((incident) => ({
        ...incident,
        status: normalizeStatus(incident.status),
      }))
      .filter((incident) =>
        employeesRaw.some((emp, index) => isSameEmployee(emp, incident, index))
      );
  }, [employeesRaw]);

  const employees = useMemo(() => {
    return buildKPIEmployees(employeesRaw, incidentsRaw);
  }, [employeesRaw, incidentsRaw]);

  const totalEmployees = employees.length;

  const deployedEmployees = employees.filter((emp) => emp.isDeployed).length;

  const repeatOffenders = employees.filter(
    (emp) => emp.riskLevel === "Repeat" || emp.violationCount >= 3
  ).length;

  const highRiskEmployees = employees.filter(
    (emp) => emp.riskLevel === "High Risk"
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

    const forReviewIncidents = incidentsRaw.filter(
      (incident) => incident.status === "For Review"
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
        text: `${openIncidents} open case(s), ${forReviewIncidents} for Super Admin review`,
      },
    ];
  }, [incidentsRaw]);

  const violationTrend = useMemo(() => {
    return buildViolationTrend(incidentsRaw);
  }, [incidentsRaw]);

  const complianceTrend = useMemo(() => {
    return buildComplianceTrend({
      employees,
      incidentsRaw,
      totalEmployees,
    });
  }, [employees, incidentsRaw, totalEmployees]);

  const utilizationTrend = useMemo(() => {
    return buildUtilizationTrend({
      totalEmployees,
      deployedEmployees,
    });
  }, [totalEmployees, deployedEmployees]);

  const handleExportPDF = () => {
    exportKPIReportPDF({
      user,
      totalEmployees,
      deployedEmployees,
      complianceRate,
      repeatOffenders,
      highRiskEmployees,
      criticalAlerts,
      employees,
    });
  };

  return (
    <div className="min-w-0 max-w-full space-y-8 overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            KPI Reports
          </h1>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {isSuperAdmin
              ? "View-only KPI analytics access for Super Admin."
              : "Detailed KPI analytics, risk monitoring, and report generation for workforce decision-making."}
          </p>
        </div>

        <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
          <button
            type="button"
            onClick={handleExportPDF}
            className="rounded-lg bg-green-600 px-4 py-2 text-white shadow-sm transition hover:bg-green-700"
          >
            Export PDF
          </button>
        </RoleGuard>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="min-w-0 space-y-8">
          <KPISummarySection
            totalEmployees={totalEmployees}
            complianceRate={complianceRate}
            repeatOffenders={repeatOffenders}
            highRiskEmployees={highRiskEmployees}
          />

          <CriticalAlerts alerts={criticalAlerts} />
        </div>

        <aside className="min-w-0 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              High Risk Monitoring
            </h2>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Employees requiring priority monitoring based on incident
              frequency and severity.
            </p>
          </div>

          <HighRiskEmployees employees={employees} />
        </aside>
      </div>

      <RiskIntelligenceSection employees={employees} />

      <AnalyticsTrendsSection
        violationTrend={violationTrend}
        complianceTrend={complianceTrend}
        utilizationTrend={utilizationTrend}
      />
    </div>
  );
}