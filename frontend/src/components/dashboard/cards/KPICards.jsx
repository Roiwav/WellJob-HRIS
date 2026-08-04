import CountUp from "react-countup";
import {
  BriefcaseBusiness,
  FileWarning,
  Gauge,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react";

const KPI_CARD_CONFIGS = [
  {
    id: "total",
    valueKey: "total",
    title: "Total Employees",
    suffix: "",
    icon: Users,
    iconBg:
      "bg-slate-100 dark:bg-slate-800",
    iconColor:
      "text-slate-700 dark:text-slate-200",
    border:
      "border-slate-200 dark:border-slate-800",
    bar: "bg-slate-500",
    description:
      "Active workforce records",
    clickable: false,
  },
  {
    id: "deployed",
    valueKey: "deployed",
    title: "Deployed Employees",
    suffix: "",
    icon: BriefcaseBusiness,
    iconBg:
      "bg-indigo-100 dark:bg-indigo-950/50",
    iconColor:
      "text-indigo-600 dark:text-indigo-400",
    border:
      "border-indigo-200 dark:border-indigo-900/60",
    bar: "bg-indigo-500",
    description:
      "Currently assigned workers",
    clickable: false,
  },
  {
    id: "available",
    valueKey: "available",
    title: "Available Workers",
    suffix: "",
    icon: UserCheck,
    iconBg:
      "bg-emerald-100 dark:bg-emerald-950/50",
    iconColor:
      "text-emerald-600 dark:text-emerald-400",
    border:
      "border-emerald-200 dark:border-emerald-900/60",
    bar: "bg-emerald-500",
    description:
      "Floating or unassigned",
    clickable: false,
  },
  {
    id: "utilizationRate",
    title: "Utilization Rate",
    suffix: "%",
    icon: Gauge,
    iconBg:
      "bg-cyan-100 dark:bg-cyan-950/50",
    iconColor:
      "text-cyan-600 dark:text-cyan-400",
    border:
      "border-cyan-200 dark:border-cyan-900/60",
    bar: "bg-cyan-500",
    description:
      "Deployment efficiency",
    clickable: true,
  },
  {
    id: "activeIncidents",
    valueKey: "activeIncidents",
    title: "Active Incidents",
    suffix: "",
    icon: TriangleAlert,
    iconBg:
      "bg-red-100 dark:bg-red-950/50",
    iconColor:
      "text-red-600 dark:text-red-400",
    border:
      "border-red-200 dark:border-red-900/60",
    bar: "bg-red-500",
    description:
      "Open or investigating cases",
    clickable: true,
  },
  {
    id: "expiringDocs",
    valueKey: "expiringDocs",
    drilldownKey:
      "expiringDocuments",
    title: "Expiring Documents",
    suffix: "",
    icon: FileWarning,
    iconBg:
      "bg-amber-100 dark:bg-amber-950/50",
    iconColor:
      "text-amber-600 dark:text-amber-400",
    border:
      "border-amber-300 dark:border-amber-800",
    bar: "bg-amber-500",
    description:
      "Due within 30 days",
    highlight: true,
    clickable: true,
  },
];

const TREND_TONE_CLASSES = {
  good:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  bad:
    "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  neutral:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function getNumericValue(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : 0;
}

function getCardValue(
  card,
  kpis,
  utilizationRate
) {
  if (
    card.id === "utilizationRate"
  ) {
    return getNumericValue(
      utilizationRate
    );
  }

  return getNumericValue(
    kpis?.[card.valueKey]
  );
}

function getProgressValue(
  card,
  numericValue
) {
  if (
    card.id !== "utilizationRate"
  ) {
    return 100;
  }

  return Math.max(
    0,
    Math.min(numericValue, 100)
  );
}

function TrendBadge({ trend }) {
  const hasTrend =
    trend &&
    typeof trend.label === "string" &&
    trend.label.trim();

  return (
    <div className="mt-2 min-h-5">
      {hasTrend && (
        <span
          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
            TREND_TONE_CLASSES[
              trend.tone
            ] ||
            TREND_TONE_CLASSES.neutral
          }`}
        >
          {trend.label}
        </span>
      )}
    </div>
  );
}

function MetricProgress({
  card,
  progressValue,
}) {
  const isUtilization =
    card.id === "utilizationRate";

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      {...(isUtilization
        ? {
            role: "progressbar",
            "aria-label":
              "Deployment utilization rate",
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-valuenow":
              progressValue,
          }
        : {
            "aria-hidden": "true",
          })}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${card.bar}`}
        style={{
          width: `${progressValue}%`,
        }}
      />
    </div>
  );
}

export default function KPICards({
  kpis = {},
  utilizationRate = 0,
  trendData = {},
  onCardClick,
}) {
  const canOpenCard =
    typeof onCardClick === "function";

  return (
    <section
      aria-label="Workforce KPI summary"
      className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-6"
    >
      {KPI_CARD_CONFIGS.map(
        (card) => {
          const Icon = card.icon;

          const numericValue =
            getCardValue(
              card,
              kpis,
              utilizationRate
            );

          const progressValue =
            getProgressValue(
              card,
              numericValue
            );

          const trend =
            trendData?.[card.id];

          const targetKey =
            card.drilldownKey ||
            card.id;

          const isInteractive =
            card.clickable &&
            canOpenCard;

          const CardElement =
            isInteractive
              ? "button"
              : "div";

          return (
            <CardElement
              key={card.id}
              type={
                isInteractive
                  ? "button"
                  : undefined
              }
              onClick={
                isInteractive
                  ? () =>
                      onCardClick(
                        targetKey
                      )
                  : undefined
              }
              aria-label={
                isInteractive
                  ? `${card.title}: ${numericValue}${card.suffix}. Open details.`
                  : undefined
              }
              className={[
                "group flex h-full min-w-0 flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 dark:bg-slate-900",
                card.border,
                isInteractive
                  ? "cursor-pointer hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                  : "cursor-default",
              ].join(" ")}
            >
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
                    <span className="sr-only">
                      {numericValue}
                      {card.suffix}
                    </span>

                    <span aria-hidden="true">
                      <CountUp
                        end={numericValue}
                        duration={1.2}
                        decimals={
                          card.suffix ===
                          "%"
                            ? 1
                            : 0
                        }
                        suffix={
                          card.suffix
                        }
                      />
                    </span>
                  </h2>

                  <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                    {card.description}
                  </p>

                  <TrendBadge
                    trend={trend}
                  />
                </div>

                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
                  aria-hidden="true"
                >
                  <Icon
                    className={`h-4 w-4 ${card.iconColor}`}
                    strokeWidth={2.2}
                  />
                </div>
              </div>

              <div className="mt-auto w-full pt-3">
                <MetricProgress
                  card={card}
                  progressValue={
                    progressValue
                  }
                />

                <div className="mt-2 min-h-4">
                  {isInteractive && (
                    <p className="text-[10px] font-semibold text-indigo-500/80 transition group-hover:text-indigo-600 group-focus-visible:text-indigo-600 dark:text-indigo-400/80 dark:group-hover:text-indigo-300">
                      View details
                    </p>
                  )}
                </div>
              </div>
            </CardElement>
          );
        }
      )}
    </section>
  );
}