import { FiAlertCircle, FiEye, FiPlay, FiUpload } from "react-icons/fi";

export default function ActionButtons({
  incident,
  isSuperAdmin,
  onView,
  onStartReview,
  onResolve,
  onReview,
}) {
  if (isSuperAdmin && incident.status === "For Review") {
    return (
      <ActionButton
        icon={<FiAlertCircle size={15} />}
        title="Review submitted case"
        color="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
        onClick={() => onReview?.(incident)}
      />
    );
  }

  if (!isSuperAdmin && incident.status === "Open") {
    return (
      <ActionButton
        icon={<FiPlay size={15} />}
        title="Start investigation"
        color="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
        onClick={() => onStartReview?.(incident)}
      />
    );
  }

  if (!isSuperAdmin && incident.status === "Investigating") {
    return (
      <ActionButton
        icon={<FiUpload size={15} />}
        title="Submit resolution"
        color="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
        onClick={() => onResolve?.(incident)}
      />
    );
  }

  return (
    <ActionButton
      icon={<FiEye size={15} />}
      title="View incident details"
      color="border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      onClick={() => onView?.(incident)}
    />
  );
}

function ActionButton({ icon, title, color, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm shadow-sm transition ${color}`}
    >
      {icon}
    </button>
  );
}