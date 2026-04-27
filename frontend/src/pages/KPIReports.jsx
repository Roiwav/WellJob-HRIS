import { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import ViolationTrendChart from "../components/dashboard/ViolationTrendChart";
import ComplianceTrendChart from "../components/dashboard/ComplianceTrendChart";
import UtilizationTrendChart from "../components/dashboard/UtilizationTrendChart";

import KPICards from "../components/kpi/KPICards";
import HighRiskEmployees from "../components/kpi/HighRiskEmployees";
import RiskTable from "../components/kpi/RiskTable";
import { getKPILevel, getSeverityWeight } from "../utils/configStorage";

const EMPLOYEES_KEY = "employees";
const INCIDENTS_KEY = "incidents";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function safeParse(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to parse ${key}:`, error);
    return [];
  }
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(status) {
  const value = normalizeText(status);

  if (value === "resolved") return "For Review";
  if (value === "for_review") return "For Review";
  if (value === "closed") return "Closed";
  if (value === "investigating") return "Investigating";

  return "Open";
}

function getEmployeeId(emp, index = 0) {
  return emp.id || emp.employeeId || emp.employee_id || `EMP-${index + 1}`;
}

function getEmployeeName(emp) {
  return emp.name || emp.full_name || emp.fullName || "Unknown Employee";
}

function isSameEmployee(emp, incident, index = 0) {
  const employeeId = String(getEmployeeId(emp, index));
  const employeeName = normalizeText(getEmployeeName(emp));

  const incidentEmployeeId = String(
    incident.employeeId || incident.employee_id || incident.empId || ""
  );

  const incidentEmployeeName = normalizeText(
    incident.employee || incident.employeeName || incident.name
  );

  return employeeId === incidentEmployeeId || employeeName === incidentEmployeeName;
}

function getRiskLevelByKPI(kpiLevel, violationCount, criticalCount) {
  if (criticalCount >= 1) return "High Risk";

  switch (kpiLevel) {
    case "High":
      return "High Risk";
    case "Medium":
      return "Repeat";
    case "Low":
      return "Monitor";
    default:
      return violationCount > 0 ? "Monitor" : "Clean";
  }
}

function getSeverityLabelByScore(severityScore, violationCount) {
  if (severityScore >= 8) return "Critical";
  if (severityScore >= 4) return "Major";
  if (violationCount >= 1) return "Minor";
  return "Clean";
}

function getDSSRecommendation(emp) {
  if (emp.criticalIncidentCount >= 2) return "Termination Review";

  if (emp.criticalIncidentCount >= 1 || emp.riskLevel === "High Risk") {
    return "Suspension Review";
  }

  if (emp.violationCount >= 3 || emp.riskLevel === "Repeat") {
    return "Final Warning";
  }

  if (emp.violationCount >= 1 || emp.riskLevel === "Monitor") {
    return "Monitor Employee";
  }

  return "Retain";
}

function getDSSReason(emp) {
  if (emp.criticalIncidentCount >= 2) {
    return `Employee has ${emp.criticalIncidentCount} critical incident(s), requiring termination review.`;
  }

  if (emp.criticalIncidentCount >= 1 || emp.riskLevel === "High Risk") {
    return `Employee has critical or high-risk incident records requiring suspension review.`;
  }

  if (emp.violationCount >= 3 || emp.riskLevel === "Repeat") {
    return `Employee has repeated violations and should receive final warning.`;
  }

  if (emp.violationCount >= 1 || emp.riskLevel === "Monitor") {
    return `Employee has recorded violation(s) and should be monitored.`;
  }

  return "Employee has no recorded violation and may be retained.";
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
    return employeesRaw.map((emp, index) => {
      const employeeId = getEmployeeId(emp, index);
      const employeeName = getEmployeeName(emp);

      const relatedIncidents = incidentsRaw.filter((incident) =>
        isSameEmployee({ ...emp, id: employeeId, name: employeeName }, incident, index)
      );

      const totalSeverityScore = relatedIncidents.reduce((sum, incident) => {
        return sum + getSeverityWeight(incident.severity);
      }, 0);

      const criticalCount = relatedIncidents.filter(
        (incident) => incident.severity === "Critical"
      ).length;

      const openCount = relatedIncidents.filter((incident) =>
        ["Open", "Investigating", "For Review"].includes(incident.status)
      ).length;

      const kpiLevel =
        relatedIncidents.length > 0 ? getKPILevel(totalSeverityScore) : "Clean";

      const riskLevel = getRiskLevelByKPI(
        kpiLevel,
        relatedIncidents.length,
        criticalCount
      );

      return {
        id: employeeId,
        name: employeeName,
        company: emp.company || emp.clientCompany || "Unassigned",
        status: emp.status || "Unknown",
        isDeployed: normalizeText(emp.status) === "deployed",
        violationCount: relatedIncidents.length,
        openIncidentCount: openCount,
        criticalIncidentCount: criticalCount,
        severityScore: totalSeverityScore,
        severityLabel: getSeverityLabelByScore(
          totalSeverityScore,
          relatedIncidents.length
        ),
        kpiLevel,
        riskLevel,
        lastIncidentDate:
          relatedIncidents[0]?.reportedAt || relatedIncidents[0]?.date || null,
        recommendation: getDSSRecommendation({
          violationCount: relatedIncidents.length,
          criticalIncidentCount: criticalCount,
          riskLevel,
        }),
        recommendationReason: getDSSReason({
          violationCount: relatedIncidents.length,
          criticalIncidentCount: criticalCount,
          riskLevel,
        }),
      };
    });
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
    const monthMap = MONTHS.reduce((acc, month) => {
      acc[month] = 0;
      return acc;
    }, {});

    incidentsRaw.forEach((incident) => {
      const month = getMonthLabel(
        incident.reportedAt || incident.date || incident.createdAt
      );

      if (monthMap[month] !== undefined) {
        monthMap[month] += 1;
      }
    });

    return MONTHS.map((month) => ({
      month,
      violations: monthMap[month],
    }));
  }, [incidentsRaw]);

  const complianceTrend = useMemo(() => {
    return MONTHS.map((month) => {
      const monthIncidentEmployeeIds = new Set();

      incidentsRaw.forEach((incident) => {
        const incidentMonth = getMonthLabel(
          incident.reportedAt || incident.date || incident.createdAt
        );

        if (incidentMonth === month) {
          const matchedEmployee = employees.find((emp) =>
            isSameEmployee(emp, incident)
          );

          if (matchedEmployee) {
            monthIncidentEmployeeIds.add(matchedEmployee.id);
          }
        }
      });

      const cleanEmployees = Math.max(
        totalEmployees - monthIncidentEmployeeIds.size,
        0
      );

      return {
        month,
        compliance:
          totalEmployees > 0
            ? Math.round((cleanEmployees / totalEmployees) * 100)
            : 0,
      };
    });
  }, [employees, incidentsRaw, totalEmployees]);

  const utilizationTrend = useMemo(() => {
    const currentMonth = new Date().toLocaleString("en-US", { month: "short" });

    return MONTHS.map((month) => ({
      month,
      utilization:
        month === currentMonth && totalEmployees > 0
          ? Math.round((deployedEmployees / totalEmployees) * 100)
          : 0,
    }));
  }, [deployedEmployees, totalEmployees]);

  const handleExportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Welljob Solutions KPI Report", 14, 15);

    doc.setFontSize(10);
    doc.text(`Generated by: ${user?.name || user?.username || "System User"}`, 14, 22);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    doc.setFontSize(12);
    doc.text("KPI Summary", 14, 38);

    autoTable(doc, {
      startY: 42,
      head: [["Metric", "Value"]],
      body: [
        ["Total Active Employees", totalEmployees],
        ["Currently Deployed Employees", deployedEmployees],
        ["Compliance Rate", `${complianceRate}%`],
        ["Repeat Offenders", repeatOffenders],
        ["High Risk Employees", highRiskEmployees],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [22, 163, 74] },
    });

    doc.text("Critical Alerts", 14, doc.lastAutoTable.finalY + 10);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [["Level", "Alert"]],
      body: criticalAlerts.map((alert) => [alert.level, alert.text]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [239, 68, 68] },
    });

    doc.text("Employee Risk Table", 14, doc.lastAutoTable.finalY + 10);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [
        [
          "Employee",
          "Company",
          "Status",
          "Violations",
          "Severity Score",
          "KPI Level",
          "Risk Level",
          "Recommendation",
          "Reason",
        ],
      ],
      body: employees.map((emp) => [
        emp.name,
        emp.company,
        emp.status,
        emp.violationCount,
        emp.severityScore,
        emp.kpiLevel,
        emp.riskLevel,
        emp.recommendation,
        emp.recommendationReason,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save("Welljob_KPI_Report.pdf");
  };

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
          <button
            type="button"
            onClick={handleExportPDF}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-sm"
          >
            Export PDF
          </button>
        </RoleGuard>
      </div>

<div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px] xl:items-start">
  <div className="space-y-8">
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          KPI Summary
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Key workforce and compliance indicators connected to employee,
          incident, and deployment records.
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
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Priority operational issues that require monitoring and intervention.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {criticalAlerts.map((alert, index) => (
          <div
            key={index}
            className={`rounded-2xl border px-4 py-4 shadow-sm ${getAlertClasses(
              alert.level
            )}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide">
                {alert.level}
              </span>
            </div>

            <p className="text-sm font-medium">{alert.text}</p>
          </div>
        ))}
      </div>
    </section>
  </div>

<aside className="space-y-4">
  <div>
    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
      High Risk Monitoring
    </h2>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
      Employees requiring priority monitoring based on incident frequency and severity.
    </p>
  </div>

  <HighRiskEmployees employees={employees} />
</aside>
</div>

  <section className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Risk Intelligence
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Identifies repeat offenders and high-risk employees based on incident
        frequency, severity, KPI level, and rule-based DSS recommendation.
      </p>
    </div>

    <RiskTable
      employees={employees}
      getSeverity={(violationCount) => {
        if (violationCount >= 5) return "Critical";
        if (violationCount >= 3) return "Major";
        if (violationCount >= 1) return "Minor";
        return "Clean";
      }}
      getRiskLevel={(violationCount) => {
        if (violationCount >= 5) return "High Risk";
        if (violationCount >= 3) return "Repeat";
        if (violationCount >= 1) return "Monitor";
        return "Clean";
      }}
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
            Identifies repeat offenders and high-risk employees based on
            incident frequency and severity.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <HighRiskEmployees employees={employees} />
          </div>

          <div className="xl:col-span-2">
            <RiskTable
              employees={employees}
              getSeverity={(violationCount) => {
                if (violationCount >= 5) return "Critical";
                if (violationCount >= 3) return "Major";
                if (violationCount >= 1) return "Minor";
                return "Clean";
              }}
              getRiskLevel={(violationCount) => {
                if (violationCount >= 5) return "High Risk";
                if (violationCount >= 3) return "Repeat";
                if (violationCount >= 1) return "Monitor";
                return "Clean";
              }}
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
            Tracks workforce violations, compliance, and current deployment utilization.
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