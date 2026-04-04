import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer
} from "recharts";

const COLORS = ["#4f46e5", "#ef4444", "#f59e0b"];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg">
        <p className="text-gray-900 dark:text-white font-medium">{`${payload[0].name}`}</p>
        <p className="text-gray-600 dark:text-gray-300">
          {`Value: ${payload[0].value}`}
        </p>
      </div>
    );
  }
  return null;
};

export default function SeverityPieChart({ data }) {

  return (

    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">

      <h3 className="mb-4 font-medium text-gray-900 dark:text-white">
        Incident Severity
      </h3>

      <ResponsiveContainer width="100%" height={300}>

        <PieChart>

          <Pie data={data} dataKey="value" outerRadius={100}>

            {data.map((entry, index) => (

              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
              />

            ))}

          </Pie>

          <Tooltip content={<CustomTooltip />} />

        </PieChart>

      </ResponsiveContainer>

    </div>

  );
}