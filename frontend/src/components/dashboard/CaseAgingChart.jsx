import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

export default function CaseAgingChart({ data }) {

  return (

    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">

      <h3 className="mb-4 font-medium">
        Case Aging Distribution
      </h3>

      <ResponsiveContainer width="100%" height={300}>

        <BarChart data={data}>

          <CartesianGrid strokeDasharray="3 3" opacity={0.05} />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />

          <Bar dataKey="value" fill="#4f46e5" />

        </BarChart>

      </ResponsiveContainer>

    </div>

  );
}