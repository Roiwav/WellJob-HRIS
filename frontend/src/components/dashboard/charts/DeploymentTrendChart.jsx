import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SharedTooltip from "../shared/SharedTooltip";

const SELECTED_AREA_COLOR = "#4f46e5";
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
      aria-label="Deployment activity comparison years"
    >
      {years.map(
        (year) => {
          const isSelected =
            String(year) ===
            String(selectedYear);

          return (
            <span
              key={year}
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isSelected
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {isSelected ? (
                <span
                  aria-hidden="true"
                  className="h-2.5 w-5 rounded-full bg-indigo-500/30 ring-1 ring-inset ring-indigo-500"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="w-5 border-t-2 border-dashed border-slate-400"
                />
              )}

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

function EmptyChartState() {
  return (
    <div className="flex h-[230px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center dark:border-slate-700 dark:bg-slate-950/40">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No deployment activity data
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          No deployment records are available for the selected historical period.
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

  const previousYear =
    hasComparison
      ? safeYears.find(
          (year) =>
            String(year) !==
            String(selectedYear)
        )
      : null;

  const completedRows =
    chartData.filter(
      (row) =>
        !(
          isCurrentYear &&
          row?.label ===
            currentMonthLabel
        )
    );

  const summaryRows =
    completedRows.length > 0
      ? completedRows
      : chartData;

  const peakRow =
    summaryRows.reduce(
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

  const latestCompleteRow =
    [...summaryRows]
      .reverse()
      .find(
        (row) =>
          row?.label
      ) || null;

  const peakValue =
    getNumericValue(
      peakRow?.[
        selectedKey
      ]
    );

  const latestValue =
    getNumericValue(
      latestCompleteRow?.[
        selectedKey
      ]
    );

  return (
    <section
      aria-labelledby="deployment-trend-title"
      className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3
            id="deployment-trend-title"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
            Deployment Activity Trend
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Monthly deployment activity shown as a volume trend against the previous available year.
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2">
          <SummaryChip
            label={
              isCurrentYear
                ? "Peak Complete Month"
                : "Peak Month"
            }
            value={
              peakRow
                ? `${peakRow.label} · ${peakValue}`
                : "N/A"
            }
          />

          <SummaryChip
            label="Latest Complete"
            value={
              latestCompleteRow
                ? `${latestCompleteRow.label} · ${latestValue}`
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
              ? `Monthly deployment activity comparison for ${safeYears.join(
                  " and "
                )}`
              : "Monthly deployment activity area trend chart"
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
            <ComposedChart
              data={
                chartData
              }
              margin={{
                top: 8,
                right: 10,
                bottom: 0,
                left: -10,
              }}
            >
              <defs>
                <linearGradient
                  id="deploymentSelectedArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      SELECTED_AREA_COLOR
                    }
                    stopOpacity={0.3}
                  />

                  <stop
                    offset="100%"
                    stopColor={
                      SELECTED_AREA_COLOR
                    }
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>

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

              <Area
                type="monotone"
                dataKey={
                  selectedKey
                }
                name={`${selectedYear || "Selected"} Deployment`}
                stroke={
                  SELECTED_AREA_COLOR
                }
                strokeWidth={3}
                fill="url(#deploymentSelectedArea)"
                fillOpacity={1}
                strokeLinecap="round"
                dot={{
                  r: 3,
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                }}
                connectNulls
              />

              {previousYear && (
                <Line
                  type="monotone"
                  dataKey={
                    previousYear
                  }
                  name={`${previousYear} Deployment`}
                  stroke={
                    COMPARISON_LINE_COLOR
                  }
                  strokeWidth={2}
                  strokeOpacity={0.65}
                  strokeDasharray="6 5"
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                  }}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}