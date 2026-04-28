import {
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";

function getComplianceTone(rate) {
  if (rate >= 85) return "emerald";
  if (rate >= 60) return "amber";
  return "rose";
}

function getCardStyles(tone) {
  const styles = {
    slate: {
      icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      value: "text-slate-900 dark:text-white",
      ring: "border-slate-200 dark:border-slate-800",
    },
    emerald: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      value: "text-emerald-600 dark:text-emerald-300",
      ring: "border-emerald-200 dark:border-emerald-900/50",
    },
    amber: {
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      value: "text-amber-600 dark:text-amber-300",
      ring: "border-amber-200 dark:border-amber-900/50",
    },
    rose: {
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      value: "text-rose-600 dark:text-rose-300",
      ring: "border-rose-200 dark:border-rose-900/50",
    },
  };

  return styles[tone] || styles.slate;
}

export default function KPICards({
  totalEmployees = 0,
  complianceRate = 0,
  repeatOffenders = 0,
  highRiskEmployees = 0,
}) {
  const complianceTone = getComplianceTone(complianceRate);

  const cards = [
    {
      title: "Total Employees",
      value: totalEmployees,
      description: "Active employees included in KPI monitoring.",
      icon: FiUsers,
      tone: "slate",
    },
    {
      title: "Compliance Rate",
      value: `${complianceRate}%`,
      description: "Employees without recorded incident violations.",
      icon: FiCheckCircle,
      tone: complianceTone,
    },
    {
      title: "Repeat Offenders",
      value: repeatOffenders,
      description: "Employees with repeated violation patterns.",
      icon: FiRefreshCw,
      tone: repeatOffenders > 0 ? "amber" : "emerald",
    },
    {
      title: "High Risk Employees",
      value: highRiskEmployees,
      description: "Employees requiring priority HR monitoring.",
      icon: FiAlertTriangle,
      tone: highRiskEmployees > 0 ? "rose" : "emerald",
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const styles = getCardStyles(card.tone);

        return (
          <div
            key={card.title}
            className={`rounded-2xl border ${styles.ring} bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {card.title}
                </p>

                <h2 className={`mt-3 text-3xl font-extrabold ${styles.value}`}>
                  {card.value}
                </h2>
              </div>

              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}
              >
                <Icon size={20} />
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}