import { useState, useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

import KPICards from "../components/dashboard/KPICards";
import DeploymentTrendChart from "../components/dashboard/DeploymentTrendChart";
import IncidentTrendChart from "../components/dashboard/IncidentTrendChart";
import SeverityPieChart from "../components/dashboard/SeverityPieChart";
import CaseAgingChart from "../components/dashboard/CaseAgingChart";

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

export default function Dashboard() {
  const currentYear = new Date().getFullYear().toString();

  const [selectedYear, setSelectedYear] = useState(currentYear);
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
    const mockData = {
      kpis: {
        total: 1624,
        deployed: 1000,
        available: 624,
        activeIncidents: 7,
        expiringDocs: 12,
      },

      workforce: [
        { date: "2024-01-10", employees: 40 },
        { date: "2024-02-10", employees: 70 },
        { date: "2024-03-10", employees: 90 },

        { date: "2025-01-10", employees: 60 },
        { date: "2025-02-10", employees: 110 },
        { date: "2025-03-10", employees: 160 },

        { date: "2026-01-10", employees: 50 },
        { date: "2026-02-10", employees: 120 },
        { date: "2026-03-10", employees: 200 },
        { date: "2026-04-10", employees: 260 },
      ],

      incidents: [
        { date: "2024-01-12", incidents: 1 },
        { date: "2024-02-18", incidents: 2 },
        { date: "2024-03-10", incidents: 3 },

        { date: "2025-01-12", incidents: 2 },
        { date: "2025-02-18", incidents: 4 },
        { date: "2025-03-10", incidents: 6 },

        { date: "2026-01-12", incidents: 3 },
        { date: "2026-02-18", incidents: 5 },
        { date: "2026-03-10", incidents: 8 },
        { date: "2026-04-05", incidents: 4 },
      ],

      severity: [
        { name: "Minor", value: 10 },
        { name: "Major", value: 5 },
        { name: "Critical", value: 2 },
      ],

      aging: [
        { name: "0-7 Days", value: 4 },
        { name: "8-30 Days", value: 2 },
        { name: "30+ Days", value: 1 },
      ],
    };

    const timer = setTimeout(() => {
      setData(mockData);
      setLastUpdated(formatLastUpdated());
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
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

  const utilizationRate = useMemo(() => {
    const total = Number(data.kpis.total) || 0;
    const deployed = Number(data.kpis.deployed) || 0;
    if (!total) return 0;
    return Number(((deployed / total) * 100).toFixed(1));
  }, [data.kpis]);

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

  const handleExportPDF = () => {
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
        ["Total Employees", data.kpis.total],
        ["Deployed", data.kpis.deployed],
        ["Available", data.kpis.available],
        ["Utilization Rate", `${utilizationRate}%`],
        ["Active Incidents", data.kpis.activeIncidents],
        ["Expiring Documents", data.kpis.expiringDocs],
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

          return [
            month,
            deployment?.value ?? 0,
            incident?.value ?? 0,
          ];
        })
        .filter(Boolean),
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
      },
    });

    doc.save(`Welljob_Executive_Report_${selectedYear}.pdf`);
  };

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
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Real-time overview of workforce deployment, incidents, and case
              monitoring.
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Last Updated: {lastUpdated}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

      <KPICards kpis={data.kpis} utilizationRate={utilizationRate} />

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