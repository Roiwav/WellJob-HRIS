import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiClock,
  FiRefreshCw,
  FiSearch,
  FiShield,
} from "react-icons/fi";

const API_BASE = "http://localhost:5000/api/audit-logs";

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
  CREATE_EMPLOYEE: "bg-blue-100 text-blue-700",
  EDIT_EMPLOYEE: "bg-indigo-100 text-indigo-700",
  UPDATE_EMPLOYEE: "bg-indigo-100 text-indigo-700",
  ARCHIVE_EMPLOYEE: "bg-red-100 text-red-700",
  RESTORE_EMPLOYEE: "bg-emerald-100 text-emerald-700",
  DELETE_EMPLOYEE: "bg-red-100 text-red-700",

  ADD_INCIDENT: "bg-orange-100 text-orange-700",
  CREATE_INCIDENT: "bg-orange-100 text-orange-700",
  UPDATE_INCIDENT: "bg-yellow-100 text-yellow-700",
  REVIEW_INCIDENT: "bg-purple-100 text-purple-700",
  RESOLVE_INCIDENT: "bg-emerald-100 text-emerald-700",

  ADD_DEPLOYMENT: "bg-cyan-100 text-cyan-700",
  UPDATE_DEPLOYMENT: "bg-indigo-100 text-indigo-700",
  CANCEL_DEPLOYMENT: "bg-red-100 text-red-700",
  COMPLETE_DEPLOYMENT: "bg-emerald-100 text-emerald-700",
};

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getActorName(log) {
  return (
    log?.full_name ||
    log?.fullName ||
    log?.name ||
    log?.username ||
    "Unknown User"
  );
}

function getReadableAuditDescription(log) {
  const description = String(log?.description || "").trim();
  const actorName = getActorName(log);

  if (!description) return "-";

  const possiblePrefixes = [log?.username, log?.user_id]
    .filter(Boolean)
    .map(escapeRegExp);

  if (possiblePrefixes.length > 0) {
    const prefixRegex = new RegExp(`^(${possiblePrefixes.join("|")})\\s+`, "i");
    return description.replace(prefixRegex, `${actorName} `);
  }

  return description;
}

function getActionStyle(action) {
  if (!action) return "bg-gray-100 text-gray-700";

  const normalizedAction = String(action).toUpperCase().replace(/\s+/g, "_");

  return ACTION_STYLE[normalizedAction] || "bg-gray-100 text-gray-700";
}

function formatAction(action) {
  if (!action) return "-";

  return String(action)
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogsPage({ category, title, description }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    try {
      const endpoint = category === "ALL" || !category 
        ? API_BASE 
        : `${API_BASE}/${category}`;
        
      const res = await fetch(endpoint);
      const data = await res.json();
      setLogs(data);
      const response = await fetch(`${API_BASE}/${category}`);
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch audit logs.");
      }

      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("FETCH AUDIT LOGS ERROR:", err);
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

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return logs.filter((log) => {
      const actorName = getActorName(log);
      const readableDescription = getReadableAuditDescription(log);

      const matchSearch =
        !keyword ||
        String(log.username || "").toLowerCase().includes(keyword) ||
        String(log.user_id || "").toLowerCase().includes(keyword) ||
        String(actorName || "").toLowerCase().includes(keyword) ||
        String(log.action || "").toLowerCase().includes(keyword) ||
        String(readableDescription || "").toLowerCase().includes(keyword);

      const matchRole = role === "All" || log.role === role;

      return matchSearch && matchRole;
    });
  }, [logs, search, role]);

  const uniqueUsers = useMemo(() => {
    const users = logs
      .map((log) => getActorName(log))
      .filter(Boolean)
      .map((name) => String(name).trim().toLowerCase());

    return new Set(users).size;
  }, [logs]);

  const availableRoles = useMemo(() => {
    const roles = logs.map((log) => log.role).filter(Boolean);
    return [...new Set(roles)];
  }, [logs]);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh Logs"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard icon={<FiActivity />} label="Total Logs" value={logs.length} />
        <SummaryCard icon={<FiShield />} label="Users" value={uniqueUsers} />
        <SummaryCard
          icon={<FiClock />}
          label="Shown Records"
          value={filteredLogs.length}
        />
      </div>

      <div className="flex flex-col items-start gap-3 xl:flex-row xl:items-center">
        <div className="relative w-full max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="All">All Roles</option>

          {availableRoles.map((roleName) => (
            <option key={roleName} value={roleName}>
              {ROLE_LABELS[roleName] || formatAction(roleName)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-slate-800">
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
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700 dark:bg-slate-900/70 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Description</th>
                </tr>
              </thead>

              <tbody className="text-gray-700 dark:text-gray-200">
                {filteredLogs.map((log) => {
                  const actorName = getActorName(log);
                  const readableDescription = getReadableAuditDescription(log);

                  return (
                    <tr
                      key={log.id}
                      className="border-t border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-slate-900/40"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        {formatDate(log.created_at)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {actorName}
                          </p>

                          {log.username && actorName !== log.username && (
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              @{log.username}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-slate-700">
                          {ROLE_LABELS[log.role] || formatAction(log.role)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${getActionStyle(
                            log.action
                          )}`}
                        >
                          {formatAction(log.action)}
                        </span>
                      </td>

                      <td className="min-w-[320px] px-6 py-4">
                        {readableDescription}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow dark:border-gray-700 dark:bg-slate-800">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100 text-xl text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
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