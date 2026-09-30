import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiInbox,
  FiSearch,
} from "react-icons/fi";

import {
  formatSmartAlertDate,
  getAlertPriorityClasses,
} from "../../utils/notifications/smartNotifications";

function PriorityBadge({
  priority,
}) {
  const styles =
    getAlertPriorityClasses(
      priority
    );

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles.badge}`}
    >
      {priority ||
        "Low"}
    </span>
  );
}

function StatusBadge({
  status,
}) {
  const styles = {
    Open:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
    Investigating:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    "For Review":
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
    "Active Pattern":
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    Closed:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  };

  const current =
    styles[status] ||
    styles.Open;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${current}`}
    >
      {status ||
        "Open"}
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
      "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
    indigo:
      "border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
    red:
      "border-red-200 bg-red-50/50 text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
    amber:
      "border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    sky:
      "border-sky-200 bg-sky-50/50 text-sky-700 hover:bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  };

  const Component =
    onClick
      ? "button"
      : "div";

  return (
    <Component
      type={
        onClick
          ? "button"
          : undefined
      }
      onClick={onClick}
      className={[
        "inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
        tones[tone] ||
          tones.slate,
        onClick
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          : "",
        active
          ? "ring-2 ring-indigo-500/20"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={`Filter by ${label}`}
    >
      <span
        className="text-sm opacity-80"
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="text-sm font-extrabold leading-none">
        {value}
      </span>

      <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">
        {label}
      </span>
    </Component>
  );
}

function AlertMobileCard({
  item,
  onViewAlert,
  onMarkRead,
}) {
  const styles =
    getAlertPriorityClasses(
      item.priority
    );

  return (
    <article
      className={[
        "rounded-xl border p-4",
        !item.isRead
          ? "border-indigo-200 bg-indigo-50/40 dark:border-indigo-500/30 dark:bg-indigo-500/5"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
          aria-hidden="true"
        >
          {item.priority ===
          "High" ? (
            <FiAlertTriangle />
          ) : (
            <FiCheckCircle />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">
                {item.title}
              </p>

              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {item.message}
              </p>
            </div>

            {!item.isRead && (
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                aria-label="Unread"
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <PriorityBadge
              priority={
                item.priority
              }
            />

            <StatusBadge
              status={
                item.status
              }
            />

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {formatSmartAlertDate(
                item.date
              )}
            </span>
          </div>

          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
            {item.reason ||
              item.recommendedAction ||
              "-"}
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {!item.isRead && (
              <button
                type="button"
                onClick={() =>
                  onMarkRead?.(
                    item.alertKey
                  )
                }
                className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiCheckCircle
                  aria-hidden="true"
                />
                Mark Read
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onViewAlert?.(
                  item
                )
              }
              className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
            >
              <FiEye
                aria-hidden="true"
              />
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
  },
  activeFilter = "ALL",
  onFilterChange,
  caseStatusFilter = "ALL",
  onCaseStatusFilterChange,
  search = "",
  onSearchChange,
  onViewAlert,
  onMarkRead,
}) {
  const safeCounts = {
    active:
      Number(
        counts?.active ||
          0
      ),
    unread:
      Number(
        counts?.unread ||
          0
      ),
    high:
      Number(
        counts?.high ||
          0
      ),
    medium:
      Number(
        counts?.medium ||
          0
      ),
    low:
      Number(
        counts?.low ||
          0
      ),
  };

  const handleCounterFilter = (
    filter
  ) => {
    if (
      filter === "ALL"
    ) {
      onFilterChange?.(
        "ALL"
      );
      return;
    }

    if (
      activeFilter ===
      filter
    ) {
      onFilterChange?.(
        "ALL"
      );
      return;
    }

    onFilterChange?.(
      filter
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Smart Alert Feed
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Prioritized incident alerts based on severity, workflow status, role assignment, and repeated patterns.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <SmallCount
              label="Active"
              value={
                safeCounts.active
              }
              tone="slate"
              icon={
                <FiBell
                  aria-hidden="true"
                />
              }
              active={
                activeFilter ===
                "ALL"
              }
              onClick={() =>
                handleCounterFilter(
                  "ALL"
                )
              }
            />

            <SmallCount
              label="Unread"
              value={
                safeCounts.unread
              }
              tone="indigo"
              icon={
                <FiBell
                  aria-hidden="true"
                />
              }
              active={
                activeFilter ===
                "UNREAD"
              }
              onClick={() =>
                handleCounterFilter(
                  "UNREAD"
                )
              }
            />

            <SmallCount
              label="High"
              value={
                safeCounts.high
              }
              tone="red"
              icon={
                <FiAlertTriangle
                  aria-hidden="true"
                />
              }
              active={
                activeFilter ===
                "HIGH"
              }
              onClick={() =>
                handleCounterFilter(
                  "HIGH"
                )
              }
            />

            <SmallCount
              label="Medium"
              value={
                safeCounts.medium
              }
              tone="amber"
              icon={
                <FiClock
                  aria-hidden="true"
                />
              }
              active={
                activeFilter ===
                "MEDIUM"
              }
              onClick={() =>
                handleCounterFilter(
                  "MEDIUM"
                )
              }
            />

            <SmallCount
              label="Low"
              value={
                safeCounts.low
              }
              tone="sky"
              icon={
                <FiCheckCircle
                  aria-hidden="true"
                />
              }
              active={
                activeFilter ===
                "LOW"
              }
              onClick={() =>
                handleCounterFilter(
                  "LOW"
                )
              }
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <label className="relative block">
            <span className="sr-only">
              Search smart alerts
            </span>

            <FiSearch
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />

            <input
              type="text"
              value={search}
              onChange={(
                event
              ) =>
                onSearchChange?.(
                  event.target
                    .value
                )
              }
              placeholder="Search alert, employee, violation, or status..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>

          <select
            value={
              caseStatusFilter
            }
            onChange={(
              event
            ) =>
              onCaseStatusFilterChange?.(
                event.target
                  .value
              )
            }
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            aria-label="Filter smart alerts by case status"
          >
            <option value="ALL">
              All Case Statuses
            </option>
            <option value="Open">
              Open
            </option>
            <option value="Investigating">
              Investigating
            </option>
            <option value="For Review">
              For Review
            </option>
            <option value="Closed">
              Closed
            </option>
          </select>
        </div>
      </div>

      <div className="block space-y-3 p-4 lg:hidden">
        {notifications.length ===
        0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <FiInbox
                className="text-slate-500"
                size={20}
                aria-hidden="true"
              />
            </div>

            <p className="font-semibold text-slate-900 dark:text-white">
              No smart alerts found
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Alerts will appear here when monitored incidents require attention.
            </p>
          </div>
        ) : (
          notifications.map(
            (item) => (
              <AlertMobileCard
                key={
                  item.alertKey
                }
                item={item}
                onViewAlert={
                  onViewAlert
                }
                onMarkRead={
                  onMarkRead
                }
              />
            )
          )
        )}
      </div>

      <div className="hidden max-h-[520px] overflow-auto lg:block">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100/95 text-[11px] uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-950/95 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3.5">
                Alert
              </th>
              <th className="px-5 py-3.5">
                Employee
              </th>
              <th className="px-5 py-3.5">
                Priority
              </th>
              <th className="px-5 py-3.5">
                Status
              </th>
              <th className="px-5 py-3.5">
                Alert Basis
              </th>
              <th className="px-5 py-3.5">
                Date
              </th>
              <th className="px-5 py-3.5 text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
            {notifications.length ===
            0 ? (
              <tr>
                <td
                  colSpan="7"
                  className="px-6 py-14 text-center"
                >
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    <FiInbox
                      className="text-slate-500"
                      size={20}
                      aria-hidden="true"
                    />
                  </div>

                  <p className="font-semibold text-slate-900 dark:text-white">
                    No smart alerts found
                  </p>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Alerts will appear here when monitored incidents require attention.
                  </p>
                </td>
              </tr>
            ) : (
              notifications.map(
                (item) => (
                  <tr
                    key={
                      item.alertKey
                    }
                    className={[
                      "transition hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                      !item.isRead
                        ? "bg-indigo-50/30 dark:bg-indigo-500/[0.04]"
                        : "",
                    ].join(
                      " "
                    )}
                  >
                    <td className="max-w-xs px-5 py-4">
                      <div className="flex items-start gap-3">
                        {!item.isRead && (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                            aria-label="Unread"
                          />
                        )}

                        <div className="min-w-0">
                          <p className="line-clamp-2 font-bold text-slate-900 dark:text-white">
                            {
                              item.title
                            }
                          </p>

                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {
                              item.message
                            }
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                      {item.employee ||
                        "-"}
                    </td>

                    <td className="px-5 py-4">
                      <PriorityBadge
                        priority={
                          item.priority
                        }
                      />
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge
                        status={
                          item.status
                        }
                      />
                    </td>

                    <td className="max-w-sm px-5 py-4">
                      <p className="line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.reason ||
                          item.recommendedAction ||
                          "-"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {formatSmartAlertDate(
                        item.date
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={() =>
                              onMarkRead?.(
                                item.alertKey
                              )
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <FiCheckCircle
                              aria-hidden="true"
                            />
                            Read
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            onViewAlert?.(
                              item
                            )
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white transition hover:bg-indigo-700"
                        >
                          <FiEye
                            aria-hidden="true"
                          />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}