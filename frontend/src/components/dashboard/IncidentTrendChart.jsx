import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

export default function IncidentTrendChart({ data }) {

  return (

    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">

      <h3 className="mb-4 font-medium">
        Incident Trend
      </h3>

      <ResponsiveContainer width="100%" height={300}>

        <BarChart data={data}>

          <CartesianGrid strokeDasharray="3 3" opacity={0.05} />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />

          <Bar dataKey="value" fill="#ef4444" />

        </BarChart>

      </ResponsiveContainer>

    </div>

  );
}