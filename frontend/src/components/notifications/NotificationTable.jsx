import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFilter,
  FiInbox,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";

import {
  formatSmartAlertDate,
  getAlertPriorityClasses,
} from "../../utils/notifications/smartNotifications";

function PriorityBadge({ priority }) {
  const styles = getAlertPriorityClasses(priority);

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles.badge}`}
    >
      {priority || "Low"}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Open:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    Investigating:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    "For Review":
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
    "Active Pattern":
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
    Closed:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
        styles[status] || styles.Open
      }`}
    >
      {status || "Open"}
    </span>
  );
}

function SmallCount({
  label,
  value,
  tone = "slate",
  icon,
  active = false,
  onClick,
}) {
  const tones = {
    slate:
      "border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-900",
    indigo:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/15",
    rose:
      "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15",
    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15",
    purple:
      "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/15",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
        tones[tone] || tones.slate
      } ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : ""
      } ${active ? "ring-2 ring-indigo-400/60 ring-offset-1 ring-offset-slate-900" : ""}`}
      title={`Filter by ${label}`}
    >
      <span className="text-sm opacity-80">{icon}</span>

      <span className="text-sm font-black leading-none">{value}</span>

      <span className="text-[10px] font-black uppercase tracking-wide opacity-75">
        {label}
      </span>
    </Component>
  );
}

function AlertMobileCard({ item, onViewAlert, onMarkRead, onDismissAlert }) {
  const styles = getAlertPriorityClasses(item.priority);

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        !item.isRead
          ? "border-indigo-300 bg-indigo-50/80 dark:border-indigo-800 dark:bg-indigo-950/20"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}
        >
          {item.priority === "High" ? <FiAlertTriangle /> : <FiCheckCircle />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-black text-slate-900 dark:text-white">
                {item.title}
              </p>

              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {item.message}
              </p>
            </div>

            {!item.isRead && (
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-600" />
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {formatSmartAlertDate(item.date)}
            </span>
          </div>

          <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
            {item.reason || item.recommendedAction || "-"}
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {!item.isRead && (
              <button
                type="button"
                onClick={() => onMarkRead?.(item.alertKey)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiCheckCircle />
                Read
              </button>
            )}

            {!item.isDismissed && (
              <button
                type="button"
                onClick={() => onDismissAlert?.(item)}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                <FiTrash2 />
                Dismiss
              </button>
            )}

            <button
              type="button"
              onClick={() => onViewAlert?.(item)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <FiEye />
              View
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function NotificationTable({
  notifications = [],
  counts = {
    active: 0,
    unread: 0,
    high: 0,
    medium: 0,
    low: 0,
    dismissed: 0,
  },
  activeFilter = "ALL",
  onFilterChange,
  search = "",
  onSearchChange,
  onViewAlert,
  onMarkRead,
  onDismissAlert,
}) {
  const safeCounts = {
    active: Number(counts?.active || 0),
    unread: Number(counts?.unread || 0),
    high: Number(counts?.high || 0),
    medium: Number(counts?.medium || 0),
    low: Number(counts?.low || 0),
    dismissed: Number(counts?.dismissed || 0),
  };

  const handleCounterFilter = (filter) => {
    if (filter === "ALL") {
      onFilterChange?.("ALL");
      return;
    }

    if (activeFilter === filter) {
      onFilterChange?.("ALL");
      return;
    }

    onFilterChange?.(filter);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="border-b border-gray-200 px-5 py-5 dark:border-white/10">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white">
              Smart Alert Feed
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              Prioritized alerts generated from incident severity, workflow
              status, role assignment, and repeated incident patterns.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <SmallCount
              label="Active"
              value={safeCounts.active}
              tone="slate"
              icon={<FiBell />}
              active={activeFilter === "ALL"}
              onClick={() => handleCounterFilter("ALL")}
            />

            <SmallCount
              label="Unread"
              value={safeCounts.unread}
              tone="indigo"
              icon={<FiBell />}
              active={activeFilter === "UNREAD"}
              onClick={() => handleCounterFilter("UNREAD")}
            />

            <SmallCount
              label="High"
              value={safeCounts.high}
              tone="rose"
              icon={<FiAlertTriangle />}
              active={activeFilter === "HIGH"}
              onClick={() => handleCounterFilter("HIGH")}
            />

            <SmallCount
              label="Medium"
              value={safeCounts.medium}
              tone="amber"
              icon={<FiClock />}
              active={activeFilter === "MEDIUM"}
              onClick={() => handleCounterFilter("MEDIUM")}
            />

            <SmallCount
              label="Low"
              value={safeCounts.low}
              tone="sky"
              icon={<FiCheckCircle />}
              active={activeFilter === "LOW"}
              onClick={() => handleCounterFilter("LOW")}
            />

            <SmallCount
              label="Dismissed"
              value={safeCounts.dismissed}
              tone="purple"
              icon={<FiFilter />}
              active={activeFilter === "DISMISSED"}
              onClick={() => handleCounterFilter("DISMISSED")}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder="Search alert, employee, violation, status..."
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>

          <select
            value={activeFilter}
            onChange={(event) => onFilterChange?.(event.target.value)}
            className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="ALL">All Active Alerts</option>
            <option value="UNREAD">Unread Alerts</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
            <option value="DISMISSED">Dismissed Alerts</option>
          </select>
        </div>
      </div>

      <div className="block space-y-3 p-4 lg:hidden">
        {notifications.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800">
              <FiInbox className="text-gray-500" size={22} />
            </div>

            <p className="font-semibold text-gray-900 dark:text-white">
              No smart alerts found
            </p>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Priority alerts will appear here when incidents require attention.
            </p>
          </div>
        ) : (
          notifications.map((item) => (
            <AlertMobileCard
              key={item.alertKey}
              item={item}
              onViewAlert={onViewAlert}
              onMarkRead={onMarkRead}
              onDismissAlert={onDismissAlert}
            />
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-950 dark:text-gray-400">
            <tr>
              <th className="px-6 py-4">Alert</th>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Smart Reason</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 text-gray-700 dark:divide-white/10 dark:text-gray-200">
            {notifications.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-14 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800">
                    <FiInbox className="text-gray-500" size={22} />
                  </div>

                  <p className="font-semibold text-gray-900 dark:text-white">
                    No smart alerts found
                  </p>

                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Priority alerts will appear here when incidents require
                    attention.
                  </p>
                </td>
              </tr>
            ) : (
              notifications.map((item) => (
                <tr
                  key={item.alertKey}
                  className={`transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                    !item.isRead
                      ? "bg-indigo-50/40 dark:bg-indigo-950/10"
                      : ""
                  }`}
                >
                  <td className="max-w-xs px-6 py-4">
                    <div className="flex items-start gap-3">
                      {!item.isRead && (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-600" />
                      )}

                      <div className="min-w-0">
                        <p className="line-clamp-2 font-black text-gray-900 dark:text-white">
                          {item.title}
                        </p>

                        <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                          {item.message}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                    {item.employee || "-"}
                  </td>

                  <td className="px-6 py-4">
                    <PriorityBadge priority={item.priority} />
                  </td>

                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="max-w-sm px-6 py-4">
                    <p className="line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      {item.reason || item.recommendedAction || "-"}
                    </p>
                  </td>

                  <td className="px-6 py-4">
                    {formatSmartAlertDate(item.date)}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => onMarkRead?.(item.alertKey)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <FiCheckCircle />
                          Read
                        </button>
                      )}

                      {!item.isDismissed && (
                        <button
                          type="button"
                          onClick={() => onDismissAlert?.(item)}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                        >
                          <FiTrash2 />
                          Dismiss
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onViewAlert?.(item)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                      >
                        <FiEye />
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}