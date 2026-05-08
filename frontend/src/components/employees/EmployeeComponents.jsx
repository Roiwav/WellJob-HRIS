import { FiAlertTriangle } from "react-icons/fi";

export function ErrorText({ children }) {
  if (!children) return null;

  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
      <FiAlertTriangle />
      {children}
    </p>
  );
}

export function StatusPill({ children, tone = "slate" }) {
  const tones = {
    slate:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    green:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    amber:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    indigo:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  );
}

export function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-slate-800">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
        {value || "-"}
      </span>
    </div>
  );
}

export function ReviewBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 font-extrabold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}
