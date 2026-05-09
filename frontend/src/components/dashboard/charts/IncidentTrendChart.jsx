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

function getBarStyle(year, selectedYear) {
  const isSelected = String(year) === String(selectedYear);

  return {
    fill: isSelected ? "#ef4444" : "#94a3b8",
    fillOpacity: isSelected ? 0.95 : 0.45,
    radius: isSelected ? [8, 8, 0, 0] : [6, 6, 0, 0],
  };
}

function ComparisonLegend({ years = [], selectedYear }) {
  if (!years.length) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {years.map((year) => {
        const isSelected = String(year) === String(selectedYear);
        const style = getBarStyle(year, selectedYear);

        return (
          <span
            key={year}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              isSelected
                ? "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: style.fill,
                opacity: style.fillOpacity,
              }}
            />
            {year} {isSelected ? "Selected Year" : "Previous Year"}
          </span>
        );
      })}
    </div>
  );
}

export default function IncidentTrendChart({
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
          Incident Trend
        </h3>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {hasComparison
            ? "Compares monthly incident records between the selected year and the previous year."
            : "Monthly recorded incident monitoring."}
        </p>
      </div>

      {hasComparison && (
        <ComparisonLegend years={years} selectedYear={selectedYear} />
      )}

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barGap={6} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<SharedTooltip />} />

          {hasComparison ? (
            years.map((year) => {
              const style = getBarStyle(year, selectedYear);

              return (
                <Bar
                  key={year}
                  dataKey={String(year)}
                  name={`${year} Incidents`}
                  fill={style.fill}
                  fillOpacity={style.fillOpacity}
                  radius={style.radius}
                />
              );
            })
          ) : (
            <Bar
              dataKey="value"
              name="Incidents"
              fill="#ef4444"
              radius={[8, 8, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}