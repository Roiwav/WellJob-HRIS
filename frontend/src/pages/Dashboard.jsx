import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import CountUp from "react-countup";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ================= CONSTANTS ================= */

const monthList = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

const COLORS = ["#4f46e5", "#ef4444", "#f59e0b"];

/* ================= UTILITIES ================= */

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

  const [data, setData] = useState({
    kpis: {},
    workforce: [],
    incidents: [],
    severity: [],
    aging: []
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
      setLoading(false);
    }, 300);
  }, []);

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
    return Number(((data.kpis.deployed / data.kpis.total) * 100).toFixed(1));
  }, [data.kpis]);

  /* ================= PDF EXPORT ================= */

  const handleExportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Welljob Solutions & General Services Inc.", 14, 20);

    doc.setFontSize(12);
    doc.text("Executive Workforce Intelligence Report", 14, 30);
    doc.text(`Year: ${selectedYear}`, 14, 38);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 46);

    autoTable(doc, {
      startY: 55,
      head: [["Metric", "Value"]],
      body: [
        ["Total Employees", data.kpis.total],
        ["Deployed", data.kpis.deployed],
        ["Utilization Rate (%)", utilizationRate + "%"],
        ["Active Incidents", data.kpis.activeIncidents],
        ["Expiring Documents", data.kpis.expiringDocs],
      ],
    });

    doc.save(`Welljob_Executive_Report_${selectedYear}.pdf`);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-10">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">
          Enterprise Workforce Intelligence Dashboard
        </h1>

        <div className="flex gap-3 items-center">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2 rounded-lg border bg-white dark:bg-slate-900"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* ================= ROW 1 – KPI ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <KpiCard title="Total Employees" value={data.kpis.total} />
        <KpiCard title="Deployed" value={data.kpis.deployed} />
        <KpiCard
          title="Total Employees"
          value={data.kpis.total}
          onClick={() => navigate("/employees")}
        />
        <KpiCard
          title="Deployed"
          value={data.kpis.deployed}
          onClick={() => navigate("/deployment")}
        />
        <KpiCard
          title="Available"
          value={data.kpis.available}
          onClick={() => navigate("/deployment")}
        />
        <KpiCard
          title="Attrition Rate"
          value={data.kpis.attrition}
          onClick={() => navigate("/kpi")}
          title="Utilization Rate (%)"
          value={utilizationRate}
          description="Percentage of employees deployed"
        />
        <KpiCard title="Active Incidents" value={data.kpis.activeIncidents} />
        <KpiCard title="Expiring Docs" value={data.kpis.expiringDocs} alert />
      </div>

      {/* ================= ROW 2 – FULL WIDTH TREND ================= */}
      <ChartCard title="Deployment Trend">
        <LineChart data={workforceTrend}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.05} />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      {/* ================= ROW 3 – RISK & COMPLIANCE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Incident Trend">
          <BarChart data={incidentTrend}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.05} />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#ef4444" />
          </BarChart>
        </ChartCard>

        <PieCard title="Incident Severity" data={data.severity} />

        <BarSimple title="Case Aging Distribution" data={data.aging} />
      </div>

    </div>
  );
}

/* ================= COMPONENTS ================= */

function KpiCard({ title, value, alert, description }) {

  const isPercent = title.includes("%");

  // Dynamic color for utilization
  let valueColor = "text-gray-900 dark:text-white";
  if (isPercent) {
    if (value >= 85) valueColor = "text-green-600";
    else if (value >= 60) valueColor = "text-indigo-600";
    else valueColor = "text-red-500";
  }

  return (
    <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border ${alert ? "border-red-400" : ""}`}>
      <p className="text-xs text-gray-500 uppercase">{title}</p>

      <h2 className={`text-2xl font-semibold mt-2 ${valueColor}`}>
        {isPercent ? `${value}%` : <CountUp end={Number(value)} duration={1} />}
      </h2>

      {description && (
        <p className="text-xs text-gray-500 mt-2">
          {description}
        </p>
      )}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">
      <h3 className="mb-4 font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={350}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function PieCard({ title, data }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">
      <h3 className="mb-4 font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey="value" outerRadius={100}>
            {data.map((entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarSimple({ title, data }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">
      <h3 className="mb-4 font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.05} />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#4f46e5" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}