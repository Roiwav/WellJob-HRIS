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

const SELECTED_LINE_COLOR = "#ef4444";
const COMPARISON_LINE_COLOR = "#94a3b8";
const CHART_HEIGHT = 230;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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
        .map((year) =>
          String(year)
        )
    )
  );
}

function normalizeChartData(data) {
  return Array.isArray(data)
    ? data.filter(Boolean)
    : [];
}

function getNumericValue(value) {
  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : 0;
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
      ? 3
      : 2,
    strokeOpacity: isSelected
      ? 1
      : 0.65,
    strokeDasharray: isSelected
      ? undefined
      : "6 5",
    dot: isSelected
      ? {
          r: 3.5,
          strokeWidth: 2,
        }
      : {
          r: 2.5,
          strokeWidth: 1.5,
        },
    activeDot: {
      r: isSelected
        ? 5
        : 4,
      strokeWidth: 2,
    },
  };
}

function ComparisonLegend({
  years = [],
  selectedYear,
}) {
  if (
    years.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Incident trend comparison years"
    >
      {years.map(
        (year) => {
          const isSelected =
            String(year) ===
            String(selectedYear);

          const style =
            getLineStyle(
              year,
              selectedYear
            );

          return (
            <span
              key={year}
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isSelected
                  ? "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              <span
                aria-hidden="true"
                className="w-5 border-t-2"
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
                  ? "Selected"
                  : "Previous"}
              </span>
            </span>
          );
        }
      )}
    </div>
  );
}

function SummaryChip({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-[230px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center dark:border-slate-700 dark:bg-slate-950/40">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No incident activity data
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          No incident reports are available for the selected historical period.
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
  isCurrentYear = false,
  currentMonth = 0,
}) {
  const safeData =
    normalizeChartData(
      data
    );

  const safeComparisonData =
    normalizeChartData(
      comparisonData
    );

  const safeYears =
    normalizeYears(
      years
    );

  const hasComparison =
    safeComparisonData.length >
      0 &&
    safeYears.length > 0;

  const rawChartData =
    hasComparison
      ? safeComparisonData
      : safeData;

  const currentMonthLabel =
    Number(currentMonth) >= 1 &&
    Number(currentMonth) <= 12
      ? MONTHS[
          Number(currentMonth) -
            1
        ]
      : "";

  const chartData =
    rawChartData.map(
      (row) => ({
        ...row,
        displayLabel:
          isCurrentYear &&
          row?.label ===
            currentMonthLabel
            ? `${row.label}*`
            : row?.label,
      })
    );

  const hasChartData =
    chartData.length > 0;

  const selectedKey =
    hasComparison
      ? String(
          selectedYear
        )
      : "value";

  const selectedValues =
    chartData.map(
      (row) =>
        getNumericValue(
          row?.[
            selectedKey
          ]
        )
    );

  const totalReports =
    selectedValues.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    );

  const highestRow =
    chartData.reduce(
      (
        highest,
        row
      ) => {
        if (!highest) {
          return row;
        }

        return getNumericValue(
          row?.[
            selectedKey
          ]
        ) >
          getNumericValue(
            highest?.[
              selectedKey
            ]
          )
          ? row
          : highest;
      },
      null
    );

  const highestValue =
    getNumericValue(
      highestRow?.[
        selectedKey
      ]
    );

  return (
    <section
      aria-labelledby="incident-trend-title"
      className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3
            id="incident-trend-title"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
            Incident Reports Trend
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Monthly incident-report movement compared with the previous available year.
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2">
          <SummaryChip
            label="Reports in Scope"
            value={totalReports}
          />

          <SummaryChip
            label="Highest Month"
            value={
              highestRow
                ? `${highestRow.label} · ${highestValue}`
                : "N/A"
            }
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {hasComparison ? (
          <ComparisonLegend
            years={safeYears}
            selectedYear={
              selectedYear
            }
          />
        ) : (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Selected historical period
          </span>
        )}

        {isCurrentYear &&
          currentMonthLabel && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              * Current month is still in progress.
            </span>
          )}
      </div>

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
              : "Monthly incident reports trend chart"
          }
          className="mt-2 h-[230px] w-full text-slate-400 dark:text-slate-500"
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{
              width: 1,
              height:
                CHART_HEIGHT,
            }}
          >
            <LineChart
              data={
                chartData
              }
              margin={{
                top: 8,
                right: 8,
                bottom: 0,
                left: -10,
              }}
            >
              <CartesianGrid
                stroke="currentColor"
                strokeDasharray="3 3"
                opacity={0.1}
                vertical={false}
              />

              <XAxis
                dataKey="displayLabel"
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: "currentColor",
                  fontSize: 11,
                }}
                minTickGap={10}
              />

              <YAxis
                allowDecimals={
                  false
                }
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: "currentColor",
                  fontSize: 11,
                }}
                width={40}
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
                        dataKey={
                          year
                        }
                        name={`${year} Incidents`}
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
                        dot={
                          style.dot
                        }
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
                  name="Incidents"
                  stroke={
                    SELECTED_LINE_COLOR
                  }
                  strokeWidth={3}
                  strokeLinecap="round"
                  dot={{
                    r: 3.5,
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 5,
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