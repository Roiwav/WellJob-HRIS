import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SharedTooltip from "../shared/SharedTooltip";

const CHART_HEIGHT = 300;
const BAR_COLOR = "#4f46e5";

function normalizeCaseAgingData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(Boolean)
    .map((item, index) => {
      const numericValue = Number(item?.value);

      return {
        ...item,
        name:
          String(item?.name || `Bracket ${index + 1}`).trim() ||
          `Bracket ${index + 1}`,
        value: Number.isFinite(numericValue)
          ? Math.max(0, numericValue)
          : 0,
      };
    });
}

function EmptyChartState() {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-950/40">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No active case-aging data
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          No open, investigating, or for-review cases were found for the
          selected reporting period.
        </p>
      </div>
    </div>
  );
}

export default function CaseAgingChart({ data = [] }) {
  const chartData = normalizeCaseAgingData(data);

  const totalCases = chartData.reduce(
    (total, item) => total + item.value,
    0
  );

  const hasChartData = chartData.length > 0 && totalCases > 0;

  return (
    <section
      aria-labelledby="case-aging-chart-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-5">
        <h3
          id="case-aging-chart-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Case Aging Distribution
        </h3>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Current distribution of active cases by aging bracket.
        </p>
      </div>

      {!hasChartData ? (
        <EmptyChartState />
      ) : (
        <div
          role="img"
          aria-label={`Case-aging distribution chart containing ${totalCases} active case${
            totalCases === 1 ? "" : "s"
          }.`}
          className="h-[300px] w-full text-slate-400 dark:text-slate-500"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap="28%"
              margin={{
                top: 8,
                right: 12,
                bottom: 4,
                left: -8,
              }}
            >
              <CartesianGrid
                stroke="currentColor"
                strokeDasharray="3 3"
                opacity={0.15}
                vertical={false}
              />

              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: "currentColor",
                  fontSize: 12,
                }}
                minTickGap={12}
              />

              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: "currentColor",
                  fontSize: 12,
                }}
                width={42}
              />

              <Tooltip content={<SharedTooltip />} />

              <Bar
                dataKey="value"
                name="Cases"
                fill={BAR_COLOR}
                radius={[8, 8, 0, 0]}
                maxBarSize={64}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}