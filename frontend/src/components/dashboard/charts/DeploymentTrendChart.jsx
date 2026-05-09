import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import SharedTooltip from "../shared/SharedTooltip";

function getLineStyle(year, selectedYear) {
  const isSelected = String(year) === String(selectedYear);

  return {
    stroke: isSelected ? "#4f46e5" : "#94a3b8",
    strokeWidth: isSelected ? 3.5 : 2,
    strokeOpacity: isSelected ? 1 : 0.65,
    strokeDasharray: isSelected ? "" : "6 6",
    dot: isSelected ? { r: 3.5 } : false,
    activeDot: isSelected ? { r: 6 } : { r: 4 },
  };
}

function ComparisonLegend({ years = [], selectedYear }) {
  if (!years.length) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {years.map((year) => {
        const isSelected = String(year) === String(selectedYear);
        const style = getLineStyle(year, selectedYear);

        return (
          <span
            key={year}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              isSelected
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            <span
              className="h-0.5 w-6 rounded-full"
              style={{
                backgroundColor: style.stroke,
                opacity: style.strokeOpacity,
              }}
            />
            {year} {isSelected ? "Selected Year" : "Previous Year"}
          </span>
        );
      })}
    </div>
  );
}

export default function DeploymentTrendChart({
  data = [],
  comparisonData = [],
  years = [],
  selectedYear,
}) {
  const hasComparison =
    Array.isArray(comparisonData) &&
    comparisonData.length > 0 &&
    Array.isArray(years) &&
    years.length > 0;

  const chartData = hasComparison ? comparisonData : data;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Deployment Trend
        </h3>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {hasComparison
            ? "Compares monthly deployment records between the selected year and the previous year."
            : "Monthly deployed workforce trend overview."}
        </p>
      </div>

      {hasComparison && (
        <ComparisonLegend years={years} selectedYear={selectedYear} />
      )}

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<SharedTooltip />} />

          {hasComparison ? (
            years.map((year) => {
              const style = getLineStyle(year, selectedYear);

              return (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={String(year)}
                  name={`${year} Deployment`}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  strokeOpacity={style.strokeOpacity}
                  strokeDasharray={style.strokeDasharray}
                  dot={style.dot}
                  activeDot={style.activeDot}
                  connectNulls
                />
              );
            })
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              name="Deployment"
              stroke="#4f46e5"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}