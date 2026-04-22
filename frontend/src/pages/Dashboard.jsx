import { useState, useEffect, useMemo, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
    const value = localStorage.getItem(key);
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to parse localStorage key: ${key}`, error);
    return [];
  }
}

function aggregateByMonth(dataset = [], key, year, isCurrentYear) {
  const currentMonthIndex = new Date().getMonth();

  return monthList
    .map((month, index) => {
      const monthNumber = String(index + 1).padStart(2, "0");

      const monthItems = dataset.filter((item) => {
        if (!item?.date) return false;

        return (
          item.date.startsWith(year) &&
          item.date.slice(5, 7) === monthNumber
        );
      });

      const total = monthItems.reduce((sum, item) => {
        const value = Number(item?.[key]) || 0;
        return sum + value;
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
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
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

export default function Dashboard() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = currentDate.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const loadData = () => {
      const employeesRaw = safeParse(EMPLOYEES_KEY);
      const incidentsRaw = safeParse(INCIDENTS_KEY);
      const deploymentsRaw = safeParse(DEPLOYMENTS_KEY);

      const totalEmployees = employeesRaw.filter((emp) => !emp.archived).length;

      const deployedCount = deploymentsRaw.length;
      const availableCount = Math.max(totalEmployees - deployedCount, 0);

      const activeIncidentsCount = incidentsRaw.filter(
        (incident) =>
          incident.status === "Open" || incident.status === "Investigating"
      ).length;

      const expiringDocs = employeesRaw.reduce((count, emp) => {
        const docs = Array.isArray(emp.documents) ? emp.documents : [];

        const expiringOrExpired = docs.filter((doc) => {
          if (!doc?.expirationDate) return false;

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const exp = new Date(doc.expirationDate);
          if (Number.isNaN(exp.getTime())) return false;
          exp.setHours(0, 0, 0, 0);

          const diffDays = Math.ceil(
            (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          return diffDays <= 30;
        });

        return count + expiringOrExpired.length;
      }, 0);

      const workforce = deploymentsRaw
        .map((deployment) => ({
          date:
            deployment.start ||
            deployment.startDate ||
            deployment.deploymentDate ||
            deployment.date ||
            "",
          employees: 1,
        }))
        .filter((item) => item.date);

      const incidents = incidentsRaw
        .map((incident) => ({
          date: incident.date || "",
          incidents: 1,
        }))
        .filter((item) => item.date);

      const severityMap = {
        Minor: 0,
        Major: 0,
        Critical: 0,
      };

      incidentsRaw.forEach((incident) => {
        const severity = incident.severity;
        if (severityMap[severity] !== undefined) {
          severityMap[severity] += 1;
        }
      });

      const severity = Object.entries(severityMap)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({
          name,
          value,
        }));

      const agingBuckets = {
        "0-7 Days": 0,
        "8-30 Days": 0,
        "30+ Days": 0,
      };

      incidentsRaw.forEach((incident) => {
        if (incident.status === "Resolved" || incident.status === "Closed") {
          return;
        }

        const age = getCaseAgeInDays(incident.date);
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
          total: totalEmployees,
          deployed: deployedCount,
          available: availableCount,
          activeIncidents: activeIncidentsCount,
          expiringDocs,
        },
        workforce,
        incidents,
        severity,
        aging,
      });

      setLastUpdated(formatLastUpdated());
      setLoading(false);
    };

    loadData();

    window.addEventListener("dataUpdated", loadData);

    return () => {
      window.removeEventListener("dataUpdated", loadData);
    };
  }, []);

  const isCurrentYear = selectedYear === currentYear;

  const availableYears = useMemo(() => {
    const years = new Set();

    data.workforce.forEach((item) => {
      if (item?.date) years.add(item.date.slice(0, 4));
    });

    data.incidents.forEach((item) => {
      if (item?.date) years.add(item.date.slice(0, 4));
    });

    if (!years.size) years.add(currentYear);

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

    const monthsWithData = new Set();

    data.workforce.forEach((item) => {
      if (item?.date && item.date.startsWith(selectedYear)) {
        const monthNum = parseInt(item.date.slice(5, 7), 10);
        monthsWithData.add(monthNum);
      }
    });

    data.incidents.forEach((item) => {
      if (item?.date && item.date.startsWith(selectedYear)) {
        const monthNum = parseInt(item.date.slice(5, 7), 10);
        monthsWithData.add(monthNum);
      }
    });

    return monthList.map((month, index) => ({
      name: month,
      value: index + 1,
      available: monthsWithData.has(index + 1) || index + 1 <= currentMonth,
    }));
  }, [data.workforce, data.incidents, selectedYear, currentYear, currentMonth]);

  const workforceTrend = useMemo(() => {
    return aggregateByMonth(
      data.workforce,
      "employees",
      selectedYear,
      isCurrentYear
    );
  }, [data.workforce, selectedYear, isCurrentYear]);

  const incidentTrend = useMemo(() => {
    return aggregateByMonth(
      data.incidents,
      "incidents",
      selectedYear,
      isCurrentYear
    );
  }, [data.incidents, selectedYear, isCurrentYear]);

  const filteredKPIS = useMemo(() => {
    if (selectedMonth === 0) return data.kpis;

    const monthStr = String(selectedMonth).padStart(2, "0");

    const monthDeployments = data.workforce.filter(
      (item) =>
        item.date &&
        item.date.slice(5, 7) === monthStr &&
        item.date.startsWith(selectedYear)
    );

    const monthIncidents = data.incidents.filter(
      (item) =>
        item.date &&
        item.date.slice(5, 7) === monthStr &&
        item.date.startsWith(selectedYear)
    );

    const deployed = monthDeployments.reduce(
      (sum, item) => sum + (item.employees || 0),
      0
    );

    const activeIncidents = monthIncidents.reduce(
      (sum, item) => sum + (item.incidents || 0),
      0
    );

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

  const totalIncidentsForYear = useMemo(() => {
    return incidentTrend.reduce((sum, item) => sum + item.value, 0);
  }, [incidentTrend]);

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
    return highest?.name || "N/A";
  }, [data.severity]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Welljob Solutions & General Services Inc.", 14, 18);

    doc.setFontSize(12);
    doc.text("Executive Workforce Intelligence Report", 14, 26);
    doc.text(`Year: ${selectedYear}`, 14, 34);
    doc.text(`Generated: ${lastUpdated}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [["Metric", "Value"]],
      body: [
        ["Total Employees", filteredKPIS.total],
        ["Deployed", filteredKPIS.deployed],
        ["Available", filteredKPIS.available],
        ["Utilization Rate", `${utilizationRate}%`],
        ["Active Incidents", filteredKPIS.activeIncidents],
        ["Expiring Documents", filteredKPIS.expiringDocs],
        ["Total Year Incidents", totalIncidentsForYear],
        ["Peak Deployment Month", peakDeploymentMonth],
        ["Highest Incident Month", highestIncidentMonth],
        ["Top Severity", topSeverity],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [79, 70, 229],
      },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Month", "Deployment", "Incidents"]],
      body: monthList
        .map((month) => {
          const deployment = workforceTrend.find((item) => item.label === month);
          const incident = incidentTrend.find((item) => item.label === month);

          if (!deployment && !incident) return null;

          return [month, deployment?.value ?? 0, incident?.value ?? 0];
        })
        .filter(Boolean),
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
      },
    });

    doc.save(`Welljob_Executive_Report_${selectedYear}.pdf`);
  }, [
    selectedYear,
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Workforce Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Last Updated: {lastUpdated}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-900"
            >
              <option value={0}>All Months</option>
              {availableMonths.map((month) => (
                <option
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
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-900"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
              <button
                onClick={handleExportPDF}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Export PDF
              </button>
            </RoleGuard>
          </div>
        </div>
      </section>

      <KPICards kpis={filteredKPIS} utilizationRate={utilizationRate} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Peak Deployment Month
          </p>
          <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {peakDeploymentMonth}
          </h3>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Highest Incident Month
          </p>
          <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {highestIncidentMonth}
          </h3>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Top Severity
          </p>
          <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {topSeverity}
          </h3>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Total Incidents ({selectedYear})
          </p>
          <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {totalIncidentsForYear}
          </h3>
        </div>
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