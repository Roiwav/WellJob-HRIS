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

const SELECTED_BAR_COLOR = "#ef4444";
const COMPARISON_BAR_COLOR = "#94a3b8";

function normalizeYears(years) {
  if (!Array.isArray(years)) {
    return [];
  }

  return Array.from(
    new Set(
      years
        .filter(
          (year) =>
            year !== null &&
            year !== undefined &&
            String(year).trim() !== ""
        )
        .map((year) => String(year))
    )
  );
}

function normalizeChartData(data) {
  return Array.isArray(data)
    ? data.filter(Boolean)
    : [];
}

function getBarStyle(
  year,
  selectedYear
) {
  const isSelected =
    String(year) ===
    String(selectedYear);

  return {
    fill: isSelected
      ? SELECTED_BAR_COLOR
      : COMPARISON_BAR_COLOR,

    fillOpacity: isSelected
      ? 0.95
      : 0.45,

    radius: isSelected
      ? [8, 8, 0, 0]
      : [6, 6, 0, 0],
  };
}

function ComparisonLegend({
  years = [],
  selectedYear,
}) {
  if (years.length === 0) {
    return null;
  }

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2"
      aria-label="Incident trend comparison years"
    >
      {years.map((year) => {
        const isSelected =
          String(year) ===
          String(selectedYear);

        const style = getBarStyle(
          year,
          selectedYear
        );

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
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  style.fill,
                opacity:
                  style.fillOpacity,
              }}
            />

            <span>
              {year}{" "}
              {isSelected
                ? "Selected Year"
                : "Previous Year"}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-950/40">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No incident trend data
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Incident records are not
          available for the selected
          reporting period.
        </p>
      </div>
    </div>
  );
}

export default function IncidentTrendChart({
  data = [],
  comparisonData = [],
  years = [],
  selectedYear,
}) {
  const safeData =
    normalizeChartData(data);

  const safeComparisonData =
    normalizeChartData(
      comparisonData
    );

  const safeYears =
    normalizeYears(years);

  const hasComparison =
    safeComparisonData.length > 0 &&
    safeYears.length > 0;

  const chartData = hasComparison
    ? safeComparisonData
    : safeData;

  const hasChartData =
    chartData.length > 0;

  const chartDescription =
    hasComparison
      ? "Compares monthly incident records between the selected year and the previous year."
      : "Monthly recorded incident monitoring.";

  return (
    <section
      aria-labelledby="incident-trend-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-5">
        <h3
          id="incident-trend-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Incident Trend
        </h3>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {chartDescription}
        </p>
      </div>

      {hasComparison && (
        <ComparisonLegend
          years={safeYears}
          selectedYear={
            selectedYear
          }
        />
      )}

      {!hasChartData ? (
        <EmptyChartState />
      ) : (
        <div
          role="img"
          aria-label={
            hasComparison
              ? `Monthly incident comparison for ${safeYears.join(
                  " and "
                )}`
              : "Monthly incident trend chart"
          }
          className="h-[300px] w-full text-slate-400 dark:text-slate-500"
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{
              width: 1,
              height: 300,
            }}
          >
            <BarChart
              data={chartData}
              barGap={6}
              barCategoryGap="30%"
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
                dataKey="label"
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

              <Tooltip
                content={
                  <SharedTooltip />
                }
              />

              {hasComparison ? (
                safeYears.map(
                  (year) => {
                    const style =
                      getBarStyle(
                        year,
                        selectedYear
                      );

                    return (
                      <Bar
                        key={year}
                        dataKey={year}
                        name={`${year} Incidents`}
                        fill={
                          style.fill
                        }
                        fillOpacity={
                          style.fillOpacity
                        }
                        radius={
                          style.radius
                        }
                        maxBarSize={42}
                      />
                    );
                  }
                )
              ) : (
                <Bar
                  dataKey="value"
                  name="Incidents"
                  fill={
                    SELECTED_BAR_COLOR
                  }
                  radius={[
                    8,
                    8,
                    0,
                    0,
                  ]}
                  maxBarSize={48}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}