import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiClock,
  FiRefreshCw,
  FiSearch,
  FiShield,
} from "react-icons/fi";

const API_BASE = "http://localhost:5000/api/audit-logs";
const LOCAL_KEY = "operational_audit_logs";

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  IT_SUPPORT: "IT Support",
};

const ACTION_STYLE = {
  LOGIN: "bg-green-100 text-green-700",
  LOGIN_SUCCESS: "bg-green-100 text-green-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  CREATE_USER: "bg-blue-100 text-blue-700",
  RESET_PASSWORD: "bg-amber-100 text-amber-700",
  CHANGE_PASSWORD: "bg-purple-100 text-purple-700",
  TOGGLE_USER_STATUS: "bg-red-100 text-red-700",
  ADD_EMPLOYEE: "bg-blue-100 text-blue-700",
  EDIT_EMPLOYEE: "bg-indigo-100 text-indigo-700",
  ARCHIVE_EMPLOYEE: "bg-red-100 text-red-700",
  CREATE_INCIDENT: "bg-orange-100 text-orange-700",
  UPDATE_INCIDENT: "bg-yellow-100 text-yellow-700",
};

export default function AuditLogsPage({ category, title, description }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");
  const [loading, setLoading] = useState(true);

  // =========================
  // FETCH LOGS (SMART)
  // =========================
  const fetchLogs = useCallback(async () => {
    setLoading(true);

    try {
      // 🔥 IF OPERATIONAL → LOCAL STORAGE
      if (category === "OPERATIONAL") {
        const localLogs =
          JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];

        setLogs(localLogs);
      } else {
        // 🔥 IF TECHNICAL → BACKEND
        const res = await fetch(`${API_BASE}/${category}`);
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchLogs();

    // 🔥 auto refresh if local updated
    const refresh = () => fetchLogs();
    window.addEventListener("dataUpdated", refresh);

    return () => window.removeEventListener("dataUpdated", refresh);
  }, [fetchLogs]);

  // =========================
  // FILTER
  // =========================
  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase();

    return logs.filter((log) => {
      const matchSearch =
        !keyword ||
        (log.username || "").toLowerCase().includes(keyword) ||
        (log.description || "").toLowerCase().includes(keyword);

      const matchRole = role === "All" || log.role === role;

      return matchSearch && matchRole;
    });
  }, [logs, search, role]);

  const uniqueUsers = useMemo(() => {
    return new Set(logs.map((l) => l.username)).size;
  }, [logs]);

  // =========================
  // UI
  // =========================
  return (
    <div className="p-8 space-y-6">

      {/* HEADER */}
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm text-gray-400">{description}</p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 bg-indigo-600 px-4 py-2 rounded-lg text-white"
        >
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-3 gap-4">
        <Card icon={<FiActivity />} label="Total Logs" value={logs.length} />
        <Card icon={<FiShield />} label="Users" value={uniqueUsers} />
        <Card icon={<FiClock />} label="Filtered" value={filteredLogs.length} />
      </div>

      {/* FILTER */}
      <div className="flex gap-3">
        <div className="relative w-80">
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            className="pl-10 py-2 w-full rounded-lg bg-slate-800 border border-slate-600 text-white"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
        >
          <option value="All">All Roles</option>
          <option value="HR_STAFF">HR Staff</option>
          <option value="HR_MANAGER">HR Manager</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            Loading audit logs...
          </div>
        ) : (
          <table className="w-full text-sm text-left text-white">
            <thead className="bg-slate-900 text-gray-300">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Action</th>
                <th className="p-4">Description</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-700">
                    <td className="p-4">{formatDate(log.created_at)}</td>
                    <td className="p-4">{log.username}</td>
                    <td className="p-4">{ROLE_LABELS[log.role]}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          ACTION_STYLE[log.action] || "bg-gray-200 text-black"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4">{log.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ icon, label, value }) {
  return (
    <div className="bg-slate-800 p-5 rounded-xl flex gap-3 items-center">
      <div className="text-indigo-400 text-xl">{icon}</div>
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <h2 className="text-white text-xl font-bold">{value}</h2>
      </div>
    </div>
  );
}

function formatDate(date) {
  return new Date(date).toLocaleString();
}