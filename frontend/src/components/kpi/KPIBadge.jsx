import {
  FiCheckCircle,
  FiMinusCircle,
  FiTrendingDown,
  FiTrendingUp,
} from "react-icons/fi";

const KPI_STYLES = {
  High: {
    label: "High",
    icon: FiTrendingDown,
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300",
  },
  Medium: {
    label: "Medium",
    icon: FiMinusCircle,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300",
  },
  Low: {
    label: "Low",
    icon: FiTrendingUp,
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300",
  },
  Clean: {
    label: "Clean",
    icon: FiCheckCircle,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
};

export default function KPIBadge({ level }) {
  const current = KPI_STYLES[level] || KPI_STYLES.Clean;
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap ${current.className}`}
      title={`KPI Level: ${current.label}`}
    >
      <Icon size={12} />
      {current.label}
    </span>
  );
}