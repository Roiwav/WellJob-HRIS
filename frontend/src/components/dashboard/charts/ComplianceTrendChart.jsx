import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SharedTooltip from "../shared/SharedTooltip";

function normalizeChartData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item, index) => ({
    ...item,
    month:
      item?.month ||
      item?.label ||
      `Period ${index + 1}`,
    compliance: Number(item?.compliance || 0),
  }));
}

export default function ComplianceTrendChart({
  data = [],
}) {
  const chartData = normalizeChartData(data);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Employee Compliance Trend
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Tracks workforce compliance performance across reporting periods.
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
          No compliance trend data available.
        </div>
      ) : (
        <div
          className="h-[300px] w-full"
          role="img"
          aria-label="Line chart showing employee compliance trends"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 8,
                right: 8,
                left: -16,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                opacity={0.08}
              />

              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                domain={[0, 100]}
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<SharedTooltip />} />

              <Line
                type="monotone"
                dataKey="compliance"
                name="Compliance"
                stroke="#22c55e"
                strokeWidth={3}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}