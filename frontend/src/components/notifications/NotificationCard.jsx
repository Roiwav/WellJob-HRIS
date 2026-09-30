export default function NotificationCard({
  type,
  message,
  date,
  icon,
  active = false,
  onClick,
}) {
  const styles = {
    All: {
      card:
        "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/80",
      icon:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      number:
        "text-slate-900 dark:text-white",
      label:
        "text-slate-500 dark:text-slate-400",
      active:
        "border-indigo-400 ring-2 ring-indigo-500/20 dark:border-indigo-500",
    },
    High: {
      card:
        "border-red-200 bg-white hover:bg-red-50/50 dark:border-red-500/30 dark:bg-slate-900 dark:hover:bg-red-500/5",
      icon:
        "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
      number:
        "text-red-700 dark:text-red-300",
      label:
        "text-slate-500 dark:text-slate-400",
      active:
        "border-red-400 ring-2 ring-red-500/20 dark:border-red-500",
    },
    Medium: {
      card:
        "border-amber-200 bg-white hover:bg-amber-50/50 dark:border-amber-500/30 dark:bg-slate-900 dark:hover:bg-amber-500/5",
      icon:
        "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
      number:
        "text-amber-700 dark:text-amber-300",
      label:
        "text-slate-500 dark:text-slate-400",
      active:
        "border-amber-400 ring-2 ring-amber-500/20 dark:border-amber-500",
    },
    Low: {
      card:
        "border-sky-200 bg-white hover:bg-sky-50/50 dark:border-sky-500/30 dark:bg-slate-900 dark:hover:bg-sky-500/5",
      icon:
        "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
      number:
        "text-sky-700 dark:text-sky-300",
      label:
        "text-slate-500 dark:text-slate-400",
      active:
        "border-sky-400 ring-2 ring-sky-500/20 dark:border-sky-500",
    },
    Unread: {
      card:
        "border-indigo-200 bg-white hover:bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-slate-900 dark:hover:bg-indigo-500/5",
      icon:
        "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
      number:
        "text-indigo-700 dark:text-indigo-300",
      label:
        "text-slate-500 dark:text-slate-400",
      active:
        "border-indigo-400 ring-2 ring-indigo-500/20 dark:border-indigo-500",
    },
    Dismissed: {
      card:
        "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/80",
      icon:
        "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
      number:
        "text-slate-700 dark:text-slate-300",
      label:
        "text-slate-500 dark:text-slate-400",
      active:
        "border-slate-400 ring-2 ring-slate-500/20 dark:border-slate-500",
    },
  };

  const current =
    styles[type] ||
    styles.Low;

  const Component =
    onClick
      ? "button"
      : "div";

  const text =
    String(
      message ||
        "0 Alerts"
    );

  const match =
    text.match(
      /^(\d+)\s*(.*)$/
    );

  const count =
    match?.[1] || "0";

  const label =
    match?.[2] ||
    type ||
    "Alerts";

  return (
    <Component
      type={
        onClick
          ? "button"
          : undefined
      }
      onClick={onClick}
      className={[
        "w-full rounded-xl border px-3.5 py-3 text-left transition",
        current.card,
        onClick
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          : "",
        active
          ? current.active
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${current.icon}`}
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                className={`text-lg font-extrabold leading-none ${current.number}`}
              >
                {count}
              </p>

              <p
                className={`mt-1 truncate text-[11px] font-bold uppercase tracking-wide ${current.label}`}
              >
                {label}
              </p>
            </div>

            <span
              className={`shrink-0 text-[10px] font-bold uppercase tracking-wide ${current.label}`}
            >
              {type}
            </span>
          </div>

          {date && (
            <p className="mt-2 truncate text-[11px] text-slate-400 dark:text-slate-500">
              {date}
            </p>
          )}
        </div>
      </div>
    </Component>
  );
}