import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { 
  FiDownload, FiCheckCircle, FiLayout, FiUsers, FiClock, FiShield, FiAlertTriangle 
} from 'react-icons/fi';

// 1. New Mock Data for Severity Heatmap (Use Case: Assign Severity Level)
const heatmapData = [
  { category: 'Attendance', Low: 20, Medium: 10, High: 2 },
  { category: 'Conduct', Low: 5, Medium: 15, High: 8 },
  { category: 'Performance', Low: 12, Medium: 8, High: 1 },
];

const trendData = [
  { month: 'Jan', incidents: 4, deployments: 12 },
  { month: 'Feb', incidents: 7, deployments: 15 },
  { month: 'Mar', incidents: 5, deployments: 18 },
  { month: 'Apr', incidents: 2, deployments: 22 },
];

const violationData = [
  { name: 'Attendance', value: 400 },
  { name: 'Conduct', value: 300 },
  { name: 'Performance', value: 200 },
];

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444'];

export default function KPIAnalytics() {
  const [category, setCategory] = useState('All');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStep, setStep] = useState('select');
  const [fileName, setFileName] = useState('');

  const handleExportSubmit = (e) => {
    e.preventDefault();
    setStep('success');
    setTimeout(() => {
      setIsExportModalOpen(false);
      setStep('select');
      setFileName('');
    }, 2500);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 p-6 hidden md:block">
        <div className="flex items-center gap-2 mb-8 text-blue-600 dark:text-blue-400 font-bold text-xl">
          <FiLayout size={24} />
          <span>WellJob HRIS</span>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Filters</label>
            <div className="mt-3 space-y-2">
              {['All', 'Probationary', 'Regular', 'Contractual'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    category === cat ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">KPI & Reports Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Monitoring {category} Employee Performance</p>
          </div>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-indigo-700 transition shadow-sm"
          >
            <FiDownload size={18} /> Export Report
          </button>
        </header>

        {/* 2. New Priority Pulse Widget (Use Case: Flag for Immediate Action) */}
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full animate-pulse">
              <FiAlertTriangle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-red-800 dark:text-red-400">Immediate Action Required</h4>
              <p className="text-sm text-red-600 dark:text-red-500/80">3 Critical incidents are pending "Issue NTE" status.</p>
            </div>
          </div>
          <button className="text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 transition">View Flags</button>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Deployment Efficiency" value="94.2%" icon={<FiUsers className="text-blue-500" size={24} />} trend="+2.5%" />
          <StatCard title="Avg. Case Turnaround" value="3.8 Days" icon={<FiClock className="text-amber-500" size={24} />} trend="-12%" />
          <StatCard title="Active Incidents" value="08" icon={<FiShield className="text-red-500" size={24} />} trend="High" color="text-red-600" />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Trend Analysis Chart */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <h3 className="font-semibold mb-6 text-slate-700 dark:text-slate-200">Deployment vs. Incidents Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.3} />
                  <XAxis dataKey="month" stroke="currentColor" fontSize={12} />
                  <YAxis stroke="currentColor" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                  <Line type="monotone" dataKey="deployments" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="incidents" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. New Severity Heatmap (Use Case: Assign Severity Level) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <h3 className="font-semibold mb-6 text-slate-700 dark:text-slate-200">Violation Severity Heatmap</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmapData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" stroke="currentColor" fontSize={12} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                  <Bar dataKey="Low" stackId="a" fill="#10b981" />
                  <Bar dataKey="Medium" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="High" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2 text-[10px] uppercase font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Low</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> High</span>
            </div>
          </div>
        </div>

        {/* 4. New Summary Table (Flowchart: Generate Summary Report) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-white/10 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Recent Deployment Efficiency Snapshot</h3>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full font-bold">LIVE DATA</span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-4 tracking-wider">Employee</th>
                <th className="px-6 py-4 tracking-wider">Status</th>
                <th className="px-6 py-4 tracking-wider">Incidents</th>
                <th className="px-6 py-4 tracking-wider text-right">Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/5">
              <TableRow name="John Mark" status="Deployed" incidents={0} score="98%" />
              <TableRow name="Sarah Jenkins" status="On Bench" incidents={2} score="45%" color="text-red-500" />
              <TableRow name="Michael Chen" status="Deployed" incidents={1} score="82%" />
            </tbody>
          </table>
        </div>
      </main>

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 w-full max-w-md shadow-2xl border dark:border-white/10">
            {exportStep === 'select' ? (
              <>
                <h2 className="text-xl font-bold mb-2 dark:text-white">Export Summary Report</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Select your preferred format and file name.</p>
                <form onSubmit={handleExportSubmit} className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {['PDF', 'Excel', 'CSV'].map(fmt => (
                      <button key={fmt} type="button" className="py-2 border dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:border-blue-500 transition text-sm font-medium dark:text-slate-300">
                        {fmt}
                      </button>
                    ))}
                  </div>
                  <input 
                    type="text" required placeholder="Enter file name..."
                    className="w-full p-3 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-transparent dark:bg-slate-800 dark:text-white"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                  />
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setIsExportModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                    <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium">Save File</button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCheckCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">File Successfully Saved</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Your report "{fileName || 'KPI_Report'}" is ready.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, trend, color = "text-slate-900" }) {
  const valueColor = color === "text-slate-900" ? "text-slate-900 dark:text-white" : color;
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1 tracking-tight">{title}</p>
        <h2 className={`text-2xl font-bold ${valueColor}`}>{value}</h2>
        <span className="text-xs text-green-500 font-medium">{trend}</span>
      </div>
      <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg">{icon}</div>
    </div>
  );
}

function TableRow({ name, status, incidents, score, color = "text-emerald-500" }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition">
      <td className="px-6 py-4 font-medium">{name}</td>
      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{status}</td>
      <td className="px-6 py-4">{incidents}</td>
      <td className={`px-6 py-4 text-right font-bold ${color}`}>{score}</td>
    </tr>
  );
}