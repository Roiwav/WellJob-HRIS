import {
  LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";
import SharedTooltip from "../shared/SharedTooltip";

export default function ComplianceTrendChart({ data }) {

  return (

    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border">

      <h3 className="mb-4 font-medium text-gray-900 dark:text-white">
        Employee Compliance Trend
      </h3>

      <ResponsiveContainer width="100%" height={300}>

        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" opacity={0.05} />

          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip content={<SharedTooltip />} />

          <Line
            type="monotone"
            dataKey="compliance"
            stroke="#22c55e"
            strokeWidth={3}
          />

        </LineChart>

      </ResponsiveContainer>

    </div>

  );

}