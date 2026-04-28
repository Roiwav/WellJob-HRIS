import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import SharedTooltip from "../shared/SharedTooltip";

export default function IncidentTrendChart({ data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Incident Trend
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Monthly recorded incident monitoring.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<SharedTooltip />} />
          <Bar
            dataKey="value"
            name="Incidents"
            fill="#ef4444"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}