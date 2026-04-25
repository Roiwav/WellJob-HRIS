export default function NotificationCard({ type, message, date, icon }) {
  const styles = {
    High: {
      card: "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
      icon: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      text: "text-red-700 dark:text-red-300",
    },
    Medium: {
      card: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      text: "text-amber-700 dark:text-amber-300",
    },
    Low: {
      card: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      text: "text-emerald-700 dark:text-emerald-300",
    },
  };

  const current = styles[type] || styles.Low;

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${current.card}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${current.icon}`}
          >
            {icon}
          </div>

          <div>
            <p className="text-sm font-extrabold text-gray-900 dark:text-white">
              {message}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {date}
            </p>
          </div>
        </div>

        <span className={`text-xs font-extrabold uppercase ${current.text}`}>
          {type}
        </span>
      </div>
    </div>
  );
}