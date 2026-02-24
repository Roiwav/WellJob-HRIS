import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [data, setData] = useState({
    kpis: {},
    workforce: [],
    incidents: [],
  });

  const lastUpdated = new Date().toLocaleString();

  // 🔹 Simulated API call (ready for backend)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Replace later with real API endpoint
        // const response = await axios.get("/api/dashboard");

        const mockData = {
          kpis: {
            total: 1624,
            deployed: 1000,
            available: 624,
            attrition: "10.3%",
          },
          workforce: [
            { month: "Jan", employees: 150 },
            { month: "Feb", employees: 165 },
            { month: "Mar", employees: 180 },
            { month: "Apr", employees: 200 },
          ],
          incidents: [
            { month: "Jan", incidents: 5 },
            { month: "Feb", incidents: 8 },
            { month: "Mar", incidents: 4 },
            { month: "Apr", incidents: 6 },
          ],
        };

        setTimeout(() => {
          setData(mockData);
          setLoading(false);
        }, 800);
      } catch (error) {
        console.error("Error loading dashboard data", error);
      }
    };

    fetchData();
  }, []);

  const filteredWorkforce =
    selectedMonth === "All"
      ? data.workforce
      : data.workforce.filter((d) => d.month === selectedMonth);

  const filteredIncidents =
    selectedMonth === "All"
      ? data.incidents
      : data.incidents.filter((d) => d.month === selectedMonth);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-gray-500">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workforce Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-white/10 border"
          >
            <option value="All">All Months</option>
            <option value="Jan">January</option>
            <option value="Feb">February</option>
            <option value="Mar">March</option>
            <option value="Apr">April</option>
          </select>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Export Summary
          </button>
        </div>
      </div>

      {/* KPI SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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
        />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Workforce Growth">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={filteredWorkforce}>
              <XAxis dataKey="month" stroke="currentColor" />
              <YAxis stroke="currentColor" />
              <Tooltip />
              <Line type="monotone" dataKey="employees" stroke="#6366f1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Incident Trend">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredIncidents}>
              <XAxis dataKey="month" stroke="currentColor" />
              <YAxis stroke="currentColor" />
              <Tooltip />
              <Bar dataKey="incidents" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function KpiCard({ title, value, onClick }) {
  return (
    <div
      onClick={onClick}
      className="
        cursor-pointer
        bg-white dark:bg-slate-900
        border border-gray-200 dark:border-white/10
        rounded-2xl
        p-6
        shadow-sm
        hover:shadow-lg
        transition
      "
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <h2 className="text-2xl font-bold mt-2">
        {value}
      </h2>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="
      bg-white dark:bg-slate-900
      border border-gray-200 dark:border-white/10
      rounded-2xl
      p-6
    ">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}
