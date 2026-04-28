import { FiAlertCircle, FiEye, FiPlay, FiUpload } from "react-icons/fi";

export default function ActionButtons({
  incident,
  isSuperAdmin,
  onView,
  onStartReview,
  onResolve,
  onReview,
}) {
  const baseClass =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150";

  if (isSuperAdmin && incident.status === "For Review") {
    return (
      <ActionButton
        icon={<FiAlertCircle size={14} />}
        label="Review"
        color="bg-indigo-600 hover:bg-indigo-700"
        onClick={() => onReview(incident)}
        baseClass={baseClass}
      />
    );
  }

  if (!isSuperAdmin && incident.status === "Open") {
    return (
      <ActionButton
        icon={<FiPlay size={14} />}
        label="Start"
        color="bg-amber-500 hover:bg-amber-600"
        onClick={() => onStartReview(incident)}
        baseClass={baseClass}
      />
    );
  }

  if (!isSuperAdmin && incident.status === "Investigating") {
    return (
      <ActionButton
        icon={<FiUpload size={14} />}
        label="Submit"
        color="bg-green-600 hover:bg-green-700"
        onClick={() => onResolve(incident)}
        baseClass={baseClass}
      />
    );
  }

  return (
    <ActionButton
      icon={<FiEye size={14} />}
      label="View"
      color="bg-slate-600 hover:bg-slate-700"
      onClick={() => onView(incident)}
      baseClass={baseClass}
    />
  );
}

function ActionButton({ icon, label, color, onClick, baseClass }) {
  return (
    <button type="button" onClick={onClick} className={`${baseClass} ${color}`}>
      {icon}
      {label}
    </button>
  );
}