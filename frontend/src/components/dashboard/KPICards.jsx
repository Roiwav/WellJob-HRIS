import CountUp from "react-countup";
import {
  Users,
  BriefcaseBusiness,
  UserCheck,
  Gauge,
  TriangleAlert,
  FileWarning,
} from "lucide-react";

export default function KPICards({ kpis, utilizationRate }) {
  const cards = [
    {
      title: "Total Employees",
      value: kpis.total,
      suffix: "",
      icon: Users,
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconColor: "text-slate-700 dark:text-slate-200",
      border: "border-slate-200 dark:border-slate-800",
      bar: "bg-slate-500",
      description: "Active workforce records",
    },
    {
      title: "Deployed Employees",
      value: kpis.deployed,
      suffix: "",
      icon: BriefcaseBusiness,
      iconBg: "bg-indigo-100 dark:bg-indigo-950/50",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-200 dark:border-indigo-900/60",
      bar: "bg-indigo-500",
      description: "Currently assigned workers",
    },
    {
      title: "Available Workers",
      value: kpis.available,
      suffix: "",
      icon: UserCheck,
      iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-900/60",
      bar: "bg-emerald-500",
      description: "Floating or unassigned",
    },
    {
      title: "Utilization Rate",
      value: utilizationRate,
      suffix: "%",
      icon: Gauge,
      iconBg: "bg-cyan-100 dark:bg-cyan-950/50",
      iconColor: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-200 dark:border-cyan-900/60",
      bar: "bg-cyan-500",
      description: "Deployment efficiency",
    },
    {
      title: "Active Incidents",
      value: kpis.activeIncidents,
      suffix: "",
      icon: TriangleAlert,
      iconBg: "bg-red-100 dark:bg-red-950/50",
      iconColor: "text-red-600 dark:text-red-400",
      border: "border-red-200 dark:border-red-900/60",
      bar: "bg-red-500",
      description: "Open or investigating cases",
    },
    {
      title: "Expiring Documents",
      value: kpis.expiringDocs,
      suffix: "",
      icon: FileWarning,
      iconBg: "bg-amber-100 dark:bg-amber-950/50",
      iconColor: "text-amber-600 dark:text-amber-400",
      border: "border-amber-300 dark:border-amber-800",
      bar: "bg-amber-500",
      description: "Due within 30 days",
      highlight: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const numericValue = Number(card.value) || 0;
        const progressWidth =
          card.title === "Utilization Rate"
            ? `${Math.min(numericValue, 100)}%`
            : "100%";

        return (
          <div
            key={card.title}
            className={`group rounded-2xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md dark:bg-slate-900 ${card.border}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {card.title}
                </p>

                <h2
                  className={`mt-3 text-3xl font-bold leading-none ${
                    card.highlight
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  <CountUp
                    end={numericValue}
                    duration={1.2}
                    decimals={card.suffix === "%" ? 1 : 0}
                    suffix={card.suffix}
                  />
                </h2>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {card.description}
                </p>
              </div>

              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.iconBg}`}
              >
                <Icon className={`h-5 w-5 ${card.iconColor}`} strokeWidth={2.2} />
              </div>
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${card.bar}`}
                style={{ width: progressWidth }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}