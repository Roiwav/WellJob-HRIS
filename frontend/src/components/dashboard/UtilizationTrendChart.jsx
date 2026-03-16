import {
  LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

export default function UtilizationTrendChart({ data }) {

  return (

    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">

      <h3 className="mb-4 font-medium">
        Deployment Utilization Trend
      </h3>

      <ResponsiveContainer width="100%" height={300}>

        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" opacity={0.05} />

          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />

          <Line
            type="monotone"
            dataKey="utilization"
            stroke="#6366f1"
            strokeWidth={3}
          />

        </LineChart>

      </ResponsiveContainer>

    </div>

  );

}