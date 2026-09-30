import SharedStatusBadge from "../ui/StatusBadge";

const EMPLOYEE_STATUS_INLINE_CLASSES =
  "!rounded-none !border-0 !bg-transparent !p-0 !font-medium " +
  "!text-slate-600 dark:!text-slate-300";

export default function StatusBadge({
  status,
  label,
  tone,
  icon = true,
  size = "md",
  className = "",
}) {
  return (
    <SharedStatusBadge
      status={status}
      label={label}
      tone={tone}
      icon={icon}
      size={size}
      className={`${EMPLOYEE_STATUS_INLINE_CLASSES} ${className}`.trim()}
    />
  );
}