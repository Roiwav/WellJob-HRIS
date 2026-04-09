import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import SharedTooltip from "./SharedTooltip";

const COLORS = ["#4f46e5", "#f59e0b", "#ef4444", "#10b981"];

export default function SeverityPieChart({ data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Incident Severity
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Distribution of incident cases by severity level.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={4}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip content={<SharedTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}