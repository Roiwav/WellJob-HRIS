import CountUp from "react-countup";

export default function KPICards({ kpis, utilizationRate }) {
  const cards = [
    {
      title: "Total Employees",
      value: kpis.total,
      suffix: "",
      accent: "border-slate-200 dark:border-slate-800",
    },
    {
      title: "Deployed",
      value: kpis.deployed,
      suffix: "",
      accent: "border-indigo-200 dark:border-indigo-900/60",
    },
    {
      title: "Available",
      value: kpis.available,
      suffix: "",
      accent: "border-emerald-200 dark:border-emerald-900/60",
    },
    {
      title: "Utilization Rate",
      value: utilizationRate,
      suffix: "%",
      accent: "border-cyan-200 dark:border-cyan-900/60",
    },
    {
      title: "Active Incidents",
      value: kpis.activeIncidents,
      suffix: "",
      accent: "border-red-200 dark:border-red-900/60",
    },
    {
      title: "Expiring Documents",
      value: kpis.expiringDocs,
      suffix: "",
      accent: "border-amber-300 dark:border-amber-800",
      highlight: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-900 ${card.accent}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {card.title}
          </p>

          <h2
            className={`mt-3 text-3xl font-bold ${
              card.highlight
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            <CountUp
              end={Number(card.value) || 0}
              duration={1.2}
              decimals={card.suffix === "%" ? 1 : 0}
              suffix={card.suffix}
            />
          </h2>
        </div>
      ))}
    </div>
  );
}