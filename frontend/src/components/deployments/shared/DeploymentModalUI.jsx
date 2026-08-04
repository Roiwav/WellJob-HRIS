export function DeploymentInfoCard({
  icon,
  label,
  value,
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    String(value).trim() === ""
      ? "-"
      : value;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}

        <span className="text-sm">{label}</span>
      </div>

      <p className="break-words text-base font-semibold text-gray-900 dark:text-white">
        {displayValue}
      </p>
    </div>
  );
}