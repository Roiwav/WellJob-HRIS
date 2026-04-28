import { useCallback, useEffect, useMemo, useState } from "react";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import KPISummarySection from "../components/kpi/sections/KPISummarySection";
import CriticalAlerts from "../components/kpi/sections/CriticalAlerts";
import HighRiskEmployees from "../components/kpi/sections/HighRiskEmployees";
import RiskIntelligenceSection from "../components/kpi/sections/RiskIntelligenceSection";
import AnalyticsTrendsSection from "../components/kpi/sections/AnalyticsTrendsSection";

import {
  normalizeStatus,
  isSameEmployee,
  buildKPIEmployees,
  buildViolationTrend,
  buildComplianceTrend,
  buildUtilizationTrend,
} from "../utils/kpi/kpiHelpers";

import { exportKPIReportPDF } from "../utils/kpi/kpiPdfExport";

const API_BASE = "http://localhost:5000/api";
const EMPLOYEE_API_URL = `${API_BASE}/employees`;
const INCIDENT_API_URL = `${API_BASE}/incidents`;

// Cache only for temporary compatibility with older pages.
// Backend/MySQL is still the main source of truth.
const EMPLOYEES_CACHE_KEY = "employees";
const INCIDENTS_CACHE_KEY = "incidents";

async function requestJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function isArchivedEmployee(employee) {
  return employee?.archived === true || Number(employee?.archived) === 1;
}

function normalizeBackendEmployee(employee) {
  return {
    ...employee,
    id: employee.id || employee.employeeId || employee.employee_id,
    employeeId: employee.id || employee.employeeId || employee.employee_id,
    name:
      employee.name ||
      employee.full_name ||
      employee.fullName ||
      "Unknown Employee",
    company: employee.company || employee.clientCompany || "Unassigned",
    status: employee.status || "Unknown",
    employmentType: employee.employmentType || employee.employment_type || "",
    contractStart: employee.contractStart || employee.contract_start || null,
    contractEnd: employee.contractEnd || employee.contract_end || null,
    archived: isArchivedEmployee(employee),
    documents: Array.isArray(employee.documents) ? employee.documents : [],
  };
}

function normalizeBackendIncident(incident) {
  const employeeId =
    incident.employeeId ||
    incident.employee_id ||
    incident.empId ||
    incident.employeeID ||
    "";

  const violation =
    incident.violation ||
    incident.violationType ||
    incident.violation_type ||
    "No violation type";

  const date =
    incident.reportedAt ||
    incident.reported_at ||
    incident.date ||
    incident.incidentDate ||
    incident.incident_date ||
    incident.createdAt ||
    incident.created_at ||
    new Date().toISOString();

  return {
    ...incident,
    id: incident.id,
    employeeId,
    employee_id: employeeId,
    employee:
      incident.employee ||
      incident.employeeName ||
      incident.employee_name ||
      "Unknown Employee",
    employeeName:
      incident.employeeName ||
      incident.employee ||
      incident.employee_name ||
      "Unknown Employee",
    company: incident.company || "",
    violation,
    violationType: violation,
    severity: incident.severity || "Minor",
    status: normalizeStatus(incident.status || "Open"),
    date,
    incidentDate: incident.incidentDate || incident.incident_date || date,
    reportedAt: incident.reportedAt || incident.reported_at || date,
    createdAt: incident.createdAt || incident.created_at || date,
    recommendation: incident.recommendation || "",
    sanction: incident.sanction || incident.actionTaken || incident.action_taken || "",
    description: incident.description || "",
  };
}

function cacheBackendData({ employees, incidents }) {
  localStorage.setItem(EMPLOYEES_CACHE_KEY, JSON.stringify(employees));
  localStorage.setItem(INCIDENTS_CACHE_KEY, JSON.stringify(incidents));
  window.dispatchEvent(new Event("dataUpdated"));
}

export default function KPIReports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [employeesRaw, setEmployeesRaw] = useState([]);
  const [incidentsRaw, setIncidentsRaw] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const fetchKPIData = useCallback(async () => {
    try {
      setIsLoading(true);
      setFetchError("");

      const [employeeData, incidentData] = await Promise.all([
        requestJson(EMPLOYEE_API_URL),
        requestJson(INCIDENT_API_URL),
      ]);

      const normalizedEmployees = Array.isArray(employeeData)
        ? employeeData.map(normalizeBackendEmployee).filter((emp) => !emp.archived)
        : [];

      const normalizedIncidents = Array.isArray(incidentData)
        ? incidentData.map(normalizeBackendIncident)
        : [];

      const visibleIncidents = normalizedIncidents.filter((incident) =>
        normalizedEmployees.some((emp, index) =>
          isSameEmployee(emp, incident, index)
        )
      );

      setEmployeesRaw(normalizedEmployees);
      setIncidentsRaw(visibleIncidents);

      cacheBackendData({
        employees: normalizedEmployees,
        incidents: visibleIncidents,
      });
    } catch (error) {
      console.error("KPI backend fetch error:", error);
      setFetchError(error.message || "Unable to load KPI backend data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIData();
  }, [fetchKPIData]);

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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fetchKPIData}
            disabled={isLoading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
          >
            {isLoading ? "Refreshing..." : "Refresh Data"}
          </button>

          <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isLoading || employees.length === 0}
              className="rounded-lg bg-green-600 px-4 py-2 text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export PDF
            </button>
          </RoleGuard>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {fetchError}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Loading KPI data from backend...
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}