//AuditLogs.jsx

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
  // FETCH LOGS
  // =========================
  const fetchLogs = useCallback(async () => {
    setLoading(true);

    try {
      if (category === "OPERATIONAL") {
        const localLogs = JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
        setLogs(localLogs);
      } else {
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
        (log.full_name || "").toLowerCase().includes(keyword) ||
        (log.description || "").toLowerCase().includes(keyword);

      const matchRole = role === "All" || log.role === role;

      return matchSearch && matchRole;
    });
  }, [logs, search, role]);

  const uniqueUsers = useMemo(() => {
    return new Set(logs.map((l) => l.username)).size;
  }, [logs]);

  // 🔥 FIX 1: Helper function para laging mahanap ang tamang kulay kahit may space
  const getActionStyle = (action) => {
    if (!action) return "bg-gray-100 text-gray-700";
    
    // Kino-convert niya ang "Login Success" to "LOGIN_SUCCESS" para mag-match sa ACTION_STYLE
    const normalizedAction = String(action).toUpperCase().replace(/\s+/g, "_");
    
    return ACTION_STYLE[normalizedAction] || "bg-gray-100 text-gray-700";
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="p-8 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          <FiRefreshCw />
          Refresh Logs
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard icon={<FiActivity />} label="Total Logs" value={logs.length} />
        <SummaryCard icon={<FiShield />} label="Users" value={uniqueUsers} />
        <SummaryCard icon={<FiClock />} label="Shown Records" value={filteredLogs.length} />
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center">
        {/* SEARCH */}
        <div className="relative w-full max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        {/* ROLE FILTER */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <option value="All">All Roles</option>
          <option value="HR_STAFF">HR Staff</option>
          <option value="HR_MANAGER">HR Manager</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading audit logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No audit logs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/70 text-gray-700 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Description</th>
                </tr>
              </thead>

              <tbody className="text-gray-700 dark:text-gray-200">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-900/40"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>

                    <td className="px-6 py-4">{log.username || "-"}</td>

                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-slate-700">
                        {ROLE_LABELS[log.role] || log.role || "-"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getActionStyle(log.action)}`}
                      >
                        {formatAction(log.action)}
                      </span>
                    </td>

                    {/* 🔥 FIX 2: Pinalinis natin ang description output */}
                    <td className="px-6 py-4 min-w-[280px]">
                      {log.description || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================
// COMPONENTS
// =========================

function SummaryCard({ icon, label, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xl">
          {icon}
        </div>

        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </h2>
        </div>
      </div>
    </div>
  );
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 🔥 FIX 3: Inayos ang formatAction para i-handle nang tama ang underscore AND spaces
function formatAction(action) {
  if (!action) return "-";

  return String(action)
    .replace(/_/g, " ") // Gawing space ang mga underscore
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}