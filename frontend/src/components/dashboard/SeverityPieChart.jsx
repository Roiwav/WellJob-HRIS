import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer
} from "recharts";

const COLORS = ["#4f46e5", "#ef4444", "#f59e0b"];

export default function SeverityPieChart({ data }) {

  return (

    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">

      <h3 className="mb-4 font-medium">
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

          <Tooltip />

        </PieChart>

      </ResponsiveContainer>

    </div>

  );
}