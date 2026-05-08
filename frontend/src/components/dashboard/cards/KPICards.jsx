import CountUp from "react-countup";
import {
  Users,
  BriefcaseBusiness,
  UserCheck,
  Gauge,
  TriangleAlert,
  FileWarning,
} from "lucide-react";

function TrendBadge({ trend }) {
  // Naglagay tayo ng invisible placeholder para kung walang trend data, pantay pa rin ang spacing
  if (!trend) return <div className="mt-2 h-[20px]" />;

  const toneClasses = {
    good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    bad: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    neutral:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <span
      className={`mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
        toneClasses[trend.tone] || toneClasses.neutral
      }`}
    >
      {trend.label}
    </span>
  );
}

export default function KPICards({
  kpis,
  utilizationRate,
  trendData = {},
  onCardClick,
}) {
  const cards = [
    {
      id: "total",
      title: "Total Employees",
      value: kpis.total,
      suffix: "",
      icon: Users,
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconColor: "text-slate-700 dark:text-slate-200",
      border: "border-slate-200 dark:border-slate-800",
      bar: "bg-slate-500",
      description: "Active workforce records",
      clickable: false,
    },
    {
      id: "deployed",
      title: "Deployed Employees",
      value: kpis.deployed,
      suffix: "",
      icon: BriefcaseBusiness,
      iconBg: "bg-indigo-100 dark:bg-indigo-950/50",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-200 dark:border-indigo-900/60",
      bar: "bg-indigo-500",
      description: "Currently assigned workers",
      clickable: false,
    },
    {
      id: "available",
      title: "Available Workers",
      value: kpis.available,
      suffix: "",
      icon: UserCheck,
      iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-900/60",
      bar: "bg-emerald-500",
      description: "Floating or unassigned",
      clickable: false,
    },
    {
      id: "utilizationRate",
      title: "Utilization Rate",
      value: utilizationRate,
      suffix: "%",
      icon: Gauge,
      iconBg: "bg-cyan-100 dark:bg-cyan-950/50",
      iconColor: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-200 dark:border-cyan-900/60",
      bar: "bg-cyan-500",
      description: "Deployment efficiency",
      clickable: true,
    },
    {
      id: "activeIncidents",
      title: "Active Incidents",
      value: kpis.activeIncidents,
      suffix: "",
      icon: TriangleAlert,
      iconBg: "bg-red-100 dark:bg-red-950/50",
      iconColor: "text-red-600 dark:text-red-400",
      border: "border-red-200 dark:border-red-900/60",
      bar: "bg-red-500",
      description: "Open or investigating cases",
      clickable: true,
    },
    {
      id: "expiringDocs",
      drilldownKey: "expiringDocuments",
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
      clickable: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6 items-stretch">
      {cards.map((card) => {
        const Icon = card.icon;
        const numericValue = Number(card.value) || 0;
        const progressWidth =
          card.title === "Utilization Rate"
            ? `${Math.min(numericValue, 100)}%`
            : "100%";

        const trend = trendData[card.id];
        const targetKey = card.drilldownKey || card.id;
        const isClickable = card.clickable;

        const CardWrapper = isClickable ? "button" : "div";

        return (
          <CardWrapper
            type={isClickable ? "button" : undefined}
            key={card.title}
            onClick={isClickable ? () => onCardClick?.(targetKey) : undefined}
            className={`group flex flex-col justify-between h-full rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 dark:bg-slate-900 ${card.border} ${
              isClickable
                ? "hover:-translate-y-1 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                : "cursor-default"
            }`}
          >
            {/* Top Section */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {card.title}
                </p>

                <h2
                  className={`mt-1.5 text-2xl font-bold leading-none ${
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

                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  {card.description}
                </p>

                <TrendBadge trend={trend} />
              </div>

              {/* Icon Container - ginawang medyo maliit */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                <Icon
                  className={`h-4 w-4 ${card.iconColor}`}
                  strokeWidth={2.2}
                />
              </div>
            </div>

            {/* Bottom Section (Progress Bar & Details text) */}
            {/* Ang `mt-auto` ang nagpapantay sa mga bar paibaba */}
            <div className="mt-auto pt-3 w-full">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${card.bar}`}
                  style={{ width: progressWidth }}
                />
              </div>

              {/* Render "Click to view details" text ONLY if clickable */}
              {isClickable ? (
                <p className="mt-2 text-[10px] font-semibold text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-slate-500">
                  Click to view details
                </p>
              ) : (
                <p className="mt-2 text-[10px] font-semibold text-transparent select-none">
                  &nbsp; {/* Invisible placeholder para saktong pantay ang height */}
                </p>
              )}
            </div>
          </CardWrapper>
        );
      })}
    </div>
  );
}