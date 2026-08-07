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

const SELECTED_LINE_COLOR = "#4f46e5";
const COMPARISON_LINE_COLOR = "#94a3b8";

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

function getLineStyle(
  year,
  selectedYear
) {
  const isSelected =
    String(year) ===
    String(selectedYear);

  return {
    stroke: isSelected
      ? SELECTED_LINE_COLOR
      : COMPARISON_LINE_COLOR,

    strokeWidth: isSelected
      ? 3.5
      : 2,

    strokeOpacity: isSelected
      ? 1
      : 0.65,

    strokeDasharray: isSelected
      ? undefined
      : "6 6",

    dot: isSelected
      ? {
          r: 3.5,
          strokeWidth: 2,
        }
      : false,

    activeDot: {
      r: isSelected ? 6 : 4,
      strokeWidth: 2,
    },
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
      aria-label="Deployment trend comparison years"
    >
      {years.map((year) => {
        const isSelected =
          String(year) ===
          String(selectedYear);

        const style = getLineStyle(
          year,
          selectedYear
        );

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
              aria-hidden="true"
              className="w-6 border-t-2"
              style={{
                borderColor:
                  style.stroke,
                borderTopStyle:
                  isSelected
                    ? "solid"
                    : "dashed",
                opacity:
                  style.strokeOpacity,
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
    <div className="flex h-[350px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-950/40">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No deployment trend data
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Deployment records are not
          available for the selected
          reporting period.
        </p>
      </div>
    </div>
  );
}

export default function DeploymentTrendChart({
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
      ? "Compares monthly deployment records between the selected year and the previous year."
      : "Monthly deployed workforce trend overview.";

  return (
    <section
      aria-labelledby="deployment-trend-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-5">
        <h3
          id="deployment-trend-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Deployment Trend
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
              ? `Monthly deployment comparison for ${safeYears.join(
                  " and "
                )}`
              : "Monthly deployment trend chart"
          }
          className="h-[350px] w-full text-slate-400 dark:text-slate-500"
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{
              width: 1,
              height: 350,
            }}
          >
            <LineChart
              data={chartData}
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
                      getLineStyle(
                        year,
                        selectedYear
                      );

                    return (
                      <Line
                        key={year}
                        type="monotone"
                        dataKey={year}
                        name={`${year} Deployment`}
                        stroke={
                          style.stroke
                        }
                        strokeWidth={
                          style.strokeWidth
                        }
                        strokeOpacity={
                          style.strokeOpacity
                        }
                        strokeDasharray={
                          style.strokeDasharray
                        }
                        strokeLinecap="round"
                        dot={style.dot}
                        activeDot={
                          style.activeDot
                        }
                        connectNulls
                      />
                    );
                  }
                )
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Deployment"
                  stroke={
                    SELECTED_LINE_COLOR
                  }
                  strokeWidth={3}
                  strokeLinecap="round"
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    strokeWidth: 2,
                  }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}