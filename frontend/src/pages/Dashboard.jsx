import { useState, useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* DASHBOARD COMPONENTS */

import DashboardHeader from "../components/dashboard/DashboardHeader";
import KPICards from "../components/dashboard/KPICards";
import DeploymentTrendChart from "../components/dashboard/DeploymentTrendChart";
import IncidentTrendChart from "../components/dashboard/IncidentTrendChart";
import SeverityPieChart from "../components/dashboard/SeverityPieChart";
import CaseAgingChart from "../components/dashboard/CaseAgingChart";

import ViolationTrendChart from "../components/dashboard/ViolationTrendChart";
import ComplianceTrendChart from "../components/dashboard/ComplianceTrendChart";
import UtilizationTrendChart from "../components/dashboard/UtilizationTrendChart";

/* ================= CONSTANTS ================= */

const monthList = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

/* ================= UTIL ================= */

function aggregateByMonth(dataset, key, year, isCurrentYear) {

  const currentMonthIndex = new Date().getMonth();

  return monthList
    .map((month, index) => {

      const monthNumber = String(index + 1).padStart(2, "0");

      const monthItems = dataset.filter(
        (d) =>
          d.date.startsWith(year) &&
          d.date.slice(5, 7) === monthNumber
      );

      const total = monthItems.reduce(
        (sum, item) => sum + item[key],
        0
      );

      return { label: month, value: total, index };

    })
    .filter(item => !isCurrentYear || item.index <= currentMonthIndex);
}

/* ================= DASHBOARD ================= */

export default function Dashboard() {

  const currentYear = new Date().getFullYear().toString();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const [data, setData] = useState({
    kpis: {},
    workforce: [],
    incidents: [],
    severity: [],
    aging: []
  });

  /* ================= FETCH DATA ================= */

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
        { date: "2026-01-10", employees: 50 },
        { date: "2026-02-10", employees: 120 },
        { date: "2026-03-10", employees: 200 },
      ],

      incidents: [
        { date: "2026-01-12", incidents: 3 },
        { date: "2026-02-18", incidents: 5 },
        { date: "2026-03-10", incidents: 8 },
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
      ]

    };

    setTimeout(() => {

      setData(mockData);

      const now = new Date();

      setLastUpdated(
        now.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        })
      );

      setLoading(false);

    }, 300);

  }, []);

  /* ================= CALCULATIONS ================= */

  const isCurrentYear = selectedYear === currentYear;

  const workforceTrend = useMemo(() =>
    aggregateByMonth(data.workforce, "employees", selectedYear, isCurrentYear),
    [data.workforce, selectedYear, isCurrentYear]
  );

  const incidentTrend = useMemo(() =>
    aggregateByMonth(data.incidents, "incidents", selectedYear, isCurrentYear),
    [data.incidents, selectedYear, isCurrentYear]
  );

  const utilizationRate = useMemo(() => {

    if (!data.kpis.total) return 0;

    return Number(
      ((data.kpis.deployed / data.kpis.total) * 100).toFixed(1)
    );

  }, [data.kpis]);

  /* ================= ANALYTICS MOCK DATA ================= */

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

  /* ================= PDF EXPORT ================= */

  const handleExportPDF = () => {

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Welljob Solutions & General Services Inc.", 14, 20);

    doc.setFontSize(12);
    doc.text("Executive Workforce Intelligence Report", 14, 30);
    doc.text(`Year: ${selectedYear}`, 14, 38);
    doc.text(`Generated: ${lastUpdated}`, 14, 46);

    autoTable(doc, {
      startY: 55,
      head: [["Metric", "Value"]],
      body: [
        ["Total Employees", data.kpis.total],
        ["Deployed", data.kpis.deployed],
        ["Available", data.kpis.available],
        ["Utilization Rate (%)", utilizationRate + "%"],
        ["Active Incidents", data.kpis.activeIncidents],
        ["Expiring Documents", data.kpis.expiringDocs],
      ],
    });

    doc.save(`Welljob_Executive_Report_${selectedYear}.pdf`);

  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">
        Loading dashboard...
      </div>
    );
  }

  /* ================= UI ================= */

  return (

    <div className="space-y-10">

      <DashboardHeader
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        handleExportPDF={handleExportPDF}
        lastUpdated={lastUpdated}
      />

      <KPICards
        kpis={data.kpis}
        utilizationRate={utilizationRate}
      />

      <DeploymentTrendChart
        data={workforceTrend}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <IncidentTrendChart
          data={incidentTrend}
        />

        <SeverityPieChart
          data={data.severity}
        />

        <CaseAgingChart
          data={data.aging}
        />

      </div>

      {/* ================= ADVANCED ANALYTICS ================= */}

      <div className="space-y-6">

        <h2 className="text-xl font-semibold">
          Workforce Analytics
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <ViolationTrendChart data={violationTrend} />

          <ComplianceTrendChart data={complianceTrend} />

          <UtilizationTrendChart data={utilizationTrend} />

        </div>

      </div>

    </div>

  );
}