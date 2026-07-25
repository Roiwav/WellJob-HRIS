import SharedStatusBadge from "../ui/StatusBadge";

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
      className={className}
    />
  );
}