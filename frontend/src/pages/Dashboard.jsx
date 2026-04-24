import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FiBarChart2, FiDownload, FiRefreshCw } from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

import KPICards from "../components/dashboard/KPICards";
import DeploymentTrendChart from "../components/dashboard/DeploymentTrendChart";
import IncidentTrendChart from "../components/dashboard/IncidentTrendChart";
import SeverityPieChart from "../components/dashboard/SeverityPieChart";
import CaseAgingChart from "../components/dashboard/CaseAgingChart";

const EMPLOYEES_KEY = "employees";
const INCIDENTS_KEY = "incidents";
const DEPLOYMENTS_KEY = "deployments";

const monthList = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function safeParse(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getRecordDate(record) {
  return (
    record?.reportedAt ||
    record?.createdAt ||
    record?.start ||
    record?.startDate ||
    record?.deploymentDate ||
    record?.date ||
    ""
  );
}

function normalizeDateValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function aggregateByMonth(dataset = [], key, year, isCurrentYear) {
  const currentMonthIndex = new Date().getMonth();

  return monthList
    .map((month, index) => {
      const monthNumber = String(index + 1).padStart(2, "0");

      const total = dataset.reduce((sum, item) => {
        const itemDate = normalizeDateValue(item?.date);

        if (
          !itemDate ||
          !itemDate.startsWith(year) ||
          itemDate.slice(5, 7) !== monthNumber
        ) {
          return sum;
        }

        return sum + (Number(item?.[key]) || 0);
      }, 0);

      return {
        label: month,
        value: total,
        index,
      };
    })
    .filter((item) => !isCurrentYear || item.index <= currentMonthIndex);
}

function formatLastUpdated(date = new Date()) {
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCaseAgeInDays(dateString) {
  if (!dateString) return null;

  const incidentDate = new Date(dateString);
  if (Number.isNaN(incidentDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  incidentDate.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - incidentDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isActiveIncident(status) {
  return ["Open", "Investigating", "For Review"].includes(status || "Open");
}

function isEmployeeDeployed(employee, deployments) {
  return deployments.some((deployment) => {
    const deploymentEmployeeId =
      deployment.employeeId ||
      deployment.employee_id ||
      deployment.id ||
      deployment.employee;

    return (
      String(deploymentEmployeeId) === String(employee.id) ||
      String(deploymentEmployeeId) === String(employee.employeeId) ||
      String(deployment.employee || "") === String(employee.name || "")
    );
  });
}

function getExpiringDocumentsCount(employees) {
  return employees.reduce((count, emp) => {
    const docs = Array.isArray(emp.documents) ? emp.documents : [];

    const expiringDocs = docs.filter((doc) => {
      const expirationDate =
        doc?.expirationDate || doc?.expiryDate || doc?.expiresAt || doc?.date;

      if (!expirationDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const exp = new Date(expirationDate);
      if (Number.isNaN(exp.getTime())) return false;
      exp.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil(
        (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return diffDays <= 30;
    });

    return count + expiringDocs.length;
  }, 0);
}

export default function Dashboard() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = currentDate.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const [data, setData] = useState({
    kpis: {
      total: 0,
      deployed: 0,
      available: 0,
      activeIncidents: 0,
      expiringDocs: 0,
    },
    workforce: [],
    incidents: [],
    severity: [],
    aging: [],
  });

  const loadData = useCallback(() => {
    const employeesRaw = safeParse(EMPLOYEES_KEY);
    const incidentsRaw = safeParse(INCIDENTS_KEY);
    const deploymentsRaw = safeParse(DEPLOYMENTS_KEY);

    const activeEmployees = employeesRaw.filter((emp) => !emp.archived);
    const deployedCount = activeEmployees.filter((emp) =>
      isEmployeeDeployed(emp, deploymentsRaw)
    ).length;

    const availableCount = Math.max(activeEmployees.length - deployedCount, 0);

    const activeIncidentsCount = incidentsRaw.filter((incident) =>
      isActiveIncident(incident.status)
    ).length;

    const workforce = deploymentsRaw
      .map((deployment) => ({
        date: normalizeDateValue(getRecordDate(deployment)),
        employees: 1,
      }))
      .filter((item) => item.date);

    const incidents = incidentsRaw
      .map((incident) => ({
        date: normalizeDateValue(getRecordDate(incident)),
        incidents: 1,
      }))
      .filter((item) => item.date);

    const severityMap = {
      Minor: 0,
      Major: 0,
      Critical: 0,
    };

    incidentsRaw.forEach((incident) => {
      const severity = incident.severity || "Minor";
      if (severityMap[severity] !== undefined) {
        severityMap[severity] += 1;
      }
    });

    const severity = Object.entries(severityMap).map(([name, value]) => ({
      name,
      value,
    }));

    const agingBuckets = {
      "0-7 Days": 0,
      "8-30 Days": 0,
      "30+ Days": 0,
    };

    incidentsRaw.forEach((incident) => {
      if (!isActiveIncident(incident.status)) return;

      const age = getCaseAgeInDays(getRecordDate(incident));
      if (age === null) return;

      if (age <= 7) agingBuckets["0-7 Days"] += 1;
      else if (age <= 30) agingBuckets["8-30 Days"] += 1;
      else agingBuckets["30+ Days"] += 1;
    });

    const aging = Object.entries(agingBuckets).map(([name, value]) => ({
      name,
      value,
    }));

    setData({
      kpis: {
        total: activeEmployees.length,
        deployed: deployedCount,
        available: availableCount,
        activeIncidents: activeIncidentsCount,
        expiringDocs: getExpiringDocumentsCount(activeEmployees),
      },
      workforce,
      incidents,
      severity,
      aging,
    });

    setLastUpdated(formatLastUpdated());
    setLoading(false);
  }, []);

  useEffect(() => {
    const reload = () => {
      setTimeout(loadData, 0);
    };
    
    // Initial load
    reload();
    
    window.addEventListener("dataUpdated", reload);
    window.addEventListener("storage", reload);

    return () => {
      window.removeEventListener("dataUpdated", reload);
      window.removeEventListener("storage", reload);
    };
  }, [loadData]);

  const handleRefresh = useCallback(() => {
  setRefreshing(true);

  setTimeout(() => {
    loadData();
    setRefreshing(false);
  }, 700); // para makita mo loading effect
}, [loadData]);

  const isCurrentYear = selectedYear === currentYear;

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);

    data.workforce.forEach((item) => {
      if (item?.date) years.add(item.date.slice(0, 4));
    });

    data.incidents.forEach((item) => {
      if (item?.date) years.add(item.date.slice(0, 4));
    });

    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [data.workforce, data.incidents, currentYear]);

  const availableMonths = useMemo(() => {
    if (selectedYear !== currentYear) {
      return monthList.map((month, index) => ({
        name: month,
        value: index + 1,
        available: true,
      }));
    }

    return monthList.map((month, index) => ({
      name: month,
      value: index + 1,
      available: index + 1 <= currentMonth,
    }));
  }, [selectedYear, currentYear, currentMonth]);

  const workforceTrend = useMemo(
    () => aggregateByMonth(data.workforce, "employees", selectedYear, isCurrentYear),
    [data.workforce, selectedYear, isCurrentYear]
  );

  const incidentTrend = useMemo(
    () => aggregateByMonth(data.incidents, "incidents", selectedYear, isCurrentYear),
    [data.incidents, selectedYear, isCurrentYear]
  );

  const filteredKPIS = useMemo(() => {
    if (selectedMonth === 0) return data.kpis;

    const monthStr = String(selectedMonth).padStart(2, "0");

    const deployed = data.workforce.reduce((sum, item) => {
      const date = normalizeDateValue(item.date);
      if (date.startsWith(selectedYear) && date.slice(5, 7) === monthStr) {
        return sum + (Number(item.employees) || 0);
      }
      return sum;
    }, 0);

    const activeIncidents = data.incidents.reduce((sum, item) => {
      const date = normalizeDateValue(item.date);
      if (date.startsWith(selectedYear) && date.slice(5, 7) === monthStr) {
        return sum + (Number(item.incidents) || 0);
      }
      return sum;
    }, 0);

    return {
      total: data.kpis.total,
      deployed,
      available: Math.max(data.kpis.total - deployed, 0),
      activeIncidents,
      expiringDocs: data.kpis.expiringDocs,
    };
  }, [data.kpis, data.workforce, data.incidents, selectedMonth, selectedYear]);

  const utilizationRate = useMemo(() => {
    const total = Number(filteredKPIS.total) || 0;
    const deployed = Number(filteredKPIS.deployed) || 0;
    if (!total) return 0;
    return Number(((deployed / total) * 100).toFixed(1));
  }, [filteredKPIS]);

  const totalIncidentsForYear = useMemo(
    () => incidentTrend.reduce((sum, item) => sum + item.value, 0),
    [incidentTrend]
  );

  const peakDeploymentMonth = useMemo(() => {
    if (!workforceTrend.length) return "N/A";
    const highest = [...workforceTrend].sort((a, b) => b.value - a.value)[0];
    return highest?.value ? `${highest.label} (${highest.value})` : "N/A";
  }, [workforceTrend]);

  const highestIncidentMonth = useMemo(() => {
    if (!incidentTrend.length) return "N/A";
    const highest = [...incidentTrend].sort((a, b) => b.value - a.value)[0];
    return highest?.value ? `${highest.label} (${highest.value})` : "N/A";
  }, [incidentTrend]);

  const topSeverity = useMemo(() => {
    if (!data.severity.length) return "N/A";
    const highest = [...data.severity].sort((a, b) => b.value - a.value)[0];
    return highest?.value ? highest.name : "N/A";
  }, [data.severity]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Welljob Solutions & General Services Inc.", 14, 18);

    doc.setFontSize(12);
    doc.text("Executive Workforce Dashboard Report", 14, 26);
    doc.text(`Year: ${selectedYear}`, 14, 34);
    doc.text(
      `Month: ${
        selectedMonth === 0 ? "All Months" : monthList[selectedMonth - 1]
      }`,
      14,
      42
    );
    doc.text(`Generated: ${lastUpdated}`, 14, 50);

    autoTable(doc, {
      startY: 60,
      head: [["Metric", "Value"]],
      body: [
        ["Total Employees", filteredKPIS.total],
        ["Deployed Employees", filteredKPIS.deployed],
        ["Available Workers", filteredKPIS.available],
        ["Utilization Rate", `${utilizationRate}%`],
        ["Active Incidents", filteredKPIS.activeIncidents],
        ["Expiring Documents", filteredKPIS.expiringDocs],
        ["Total Year Incidents", totalIncidentsForYear],
        ["Peak Deployment Month", peakDeploymentMonth],
        ["Highest Incident Month", highestIncidentMonth],
        ["Top Severity", topSeverity],
      ],
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Month", "Deployment", "Incidents"]],
      body: monthList.map((month) => {
        const deployment = workforceTrend.find((item) => item.label === month);
        const incident = incidentTrend.find((item) => item.label === month);
        return [month, deployment?.value ?? 0, incident?.value ?? 0];
      }),
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Welljob_Dashboard_Report_${selectedYear}.pdf`);
  }, [
    selectedYear,
    selectedMonth,
    lastUpdated,
    filteredKPIS,
    utilizationRate,
    totalIncidentsForYear,
    peakDeploymentMonth,
    highestIncidentMonth,
    topSeverity,
    workforceTrend,
    incidentTrend,
  ]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/90">
                <FiBarChart2 />
                Executive Overview
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight">
                Workforce Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                Real-time summary of employee deployment, workforce availability,
                incident monitoring, document compliance, and case aging.
              </p>

              <p className="mt-3 text-xs text-white/70">
                Last Updated: {lastUpdated}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white outline-none backdrop-blur focus:border-white/50"
              >
                <option className="text-slate-900" value={0}>
                  All Months
                </option>
                {availableMonths.map((month) => (
                  <option
                    className="text-slate-900"
                    key={month.name}
                    value={month.value}
                    disabled={!month.available && selectedYear === currentYear}
                  >
                    {month.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white outline-none backdrop-blur focus:border-white/50"
              >
                {availableYears.map((year) => (
                  <option className="text-slate-900" key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

<button
  type="button"
  onClick={handleRefresh}
  disabled={refreshing}
  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/25 disabled:opacity-60"
>
  <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
  {refreshing ? "Refreshing..." : "Refresh"}
</button>

              <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50"
                >
                  <FiDownload />
                  Export PDF
                </button>
              </RoleGuard>
            </div>
          </div>
        </div>
      </section>

      <KPICards kpis={filteredKPIS} utilizationRate={utilizationRate} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard title="Peak Deployment Month" value={peakDeploymentMonth} tone="indigo" />
        <InsightCard title="Highest Incident Month" value={highestIncidentMonth} tone="red" />
        <InsightCard title="Top Severity" value={topSeverity} tone="amber" />
        <InsightCard
          title={`Total Incidents (${selectedYear})`}
          value={totalIncidentsForYear}
          tone="emerald"
        />
      </section>

      <DeploymentTrendChart data={workforceTrend} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <IncidentTrendChart data={incidentTrend} />
        <SeverityPieChart data={data.severity} />
        <CaseAgingChart data={data.aging} />
      </div>
    </div>
  );
}

function InsightCard({ title, value, tone = "indigo" }) {
  const tones = {
    indigo:
      "from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900",
    red: "from-red-50 to-white dark:from-red-950/30 dark:to-slate-900",
    amber:
      "from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900",
    emerald:
      "from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900",
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 ${
        tones[tone] || tones.indigo
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <h3 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
        {value}
      </h3>
    </div>
  );
}