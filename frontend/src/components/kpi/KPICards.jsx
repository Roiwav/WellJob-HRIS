import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";

export default function KPICards({
  totalEmployees,
  complianceRate,
  repeatOffenders,
  highRiskEmployees
}) {

  const cards = [

    {
      title: "Total Employees",
      value: totalEmployees,
      trend: "+1",
      direction: "up"
    },

    {
      title: "Compliance Rate",
      value: `${complianceRate}%`,
      color: "text-emerald-500",
      trend: "+3%",
      direction: "up"
    },

    {
      title: "Repeat Offenders (2+)",
      value: repeatOffenders,
      color: "text-amber-500",
      trend: "-1",
      direction: "down"
    },

    {
      title: "High Risk (3+)",
      value: highRiskEmployees,
      color: "text-red-500",
      trend: "-2",
      direction: "down"
    }

  ];

  return (

    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

      {cards.map((card, index) => {

        const isUp = card.direction === "up";

        return (

          <div
            key={index}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
          >

            <p className="text-xs uppercase text-slate-400 mb-2 tracking-wider">
              {card.title}
            </p>

            <div className="flex items-center justify-between">

              <h2 className={`text-2xl font-semibold ${card.color || ""}`}>
                {card.value}
              </h2>

              <span
                className={`flex items-center gap-1 text-xs font-semibold ${
                  isUp ? "text-emerald-500" : "text-red-500"
                }`}
              >

                {isUp ? <FiTrendingUp /> : <FiTrendingDown />}

                {card.trend}

              </span>

            </div>

          </div>

        );

      })}

    </div>

  );

}