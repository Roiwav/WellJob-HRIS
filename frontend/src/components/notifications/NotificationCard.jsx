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
      card: "border-slate-700 bg-slate-900/70 hover:bg-slate-900",
      icon: "bg-slate-800 text-slate-300",
      number: "text-white",
      label: "text-slate-300",
      ring: "ring-slate-400/40",
    },
    High: {
      card: "border-red-500/30 bg-red-500/10 hover:bg-red-500/15",
      icon: "bg-red-500/20 text-red-300",
      number: "text-red-200",
      label: "text-red-300",
      ring: "ring-red-400/50",
    },
    Medium: {
      card: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15",
      icon: "bg-amber-500/20 text-amber-300",
      number: "text-amber-200",
      label: "text-amber-300",
      ring: "ring-amber-400/50",
    },
    Low: {
      card: "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15",
      icon: "bg-sky-500/20 text-sky-300",
      number: "text-sky-200",
      label: "text-sky-300",
      ring: "ring-sky-400/50",
    },
    Unread: {
      card: "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/15",
      icon: "bg-indigo-500/20 text-indigo-300",
      number: "text-indigo-200",
      label: "text-indigo-300",
      ring: "ring-indigo-400/50",
    },
    Dismissed: {
      card: "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/15",
      icon: "bg-purple-500/20 text-purple-300",
      number: "text-purple-200",
      label: "text-purple-300",
      ring: "ring-purple-400/50",
    },
  };

  const current = styles[type] || styles.Low;
  const Component = onClick ? "button" : "div";

  const text = String(message || "0 Alerts");
  const match = text.match(/^(\d+)\s*(.*)$/);
  const count = match?.[1] || "0";
  const label = match?.[2] || type || "Alerts";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
        current.card
      } ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg" : ""
      } ${active ? `ring-2 ${current.ring}` : ""}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ${current.icon}`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-2xl font-black leading-none ${current.number}`}>
                {count}
              </p>

              <p className={`mt-1 text-sm font-black ${current.label}`}>
                {label}
              </p>
            </div>

            <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${current.label}`}>
              {type}
            </span>
          </div>

          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">
            {date}
          </p>
        </div>
      </div>
    </Component>
  );
}