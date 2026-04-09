import CountUp from "react-countup";

export default function KPICards({ kpis, utilizationRate }) {

  const cards = [
    { title: "Total", value: kpis.total },
    { title: "Deployed", value: kpis.deployed },
    { title: "Available", value: kpis.available },
    { title: "Utilization %", value: utilizationRate },
    { title: "Incidents", value: kpis.activeIncidents },
    { title: "Expiring", value: kpis.expiringDocs, alert: true }
  ];

  return (

    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

      {cards.map((card, index) => (

        <div
          key={index}
          className={`bg-white dark:bg-slate-900 p-4 rounded-xl border ${card.alert ? "border-red-400" : ""}`}
        >

          <p className="text-xs text-gray-500 uppercase">
            {card.title}
          </p>

          <h2 className="text-2xl font-semibold mt-2">
            <CountUp end={Number(card.value) || 0} duration={1} />
          </h2>

        </div>

      ))}

    </div>

  );
}