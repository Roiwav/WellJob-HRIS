import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SharedTooltip from "../shared/SharedTooltip";

const CHART_HEIGHT = 210;

const AGING_COLORS = {
  "0-7 Days": "#3b82f6",
  "8-30 Days": "#f59e0b",
  "30+ Days": "#ef4444",
};

function normalizeCaseAgingData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(Boolean)
    .map(
      (
        item,
        index
      ) => {
        const numericValue =
          Number(
            item?.value
          );

        const name =
          String(
            item?.name ||
              `Bracket ${index + 1}`
          ).trim() ||
          `Bracket ${index + 1}`;

        return {
          ...item,
          name,
          value:
            Number.isFinite(
              numericValue
            )
              ? Math.max(
                  0,
                  numericValue
                )
              : 0,
          color:
            AGING_COLORS[
              name
            ] ||
            "#4f46e5",
        };
      }
    );
}

function EmptyChartState() {
  return (
    <div className="flex h-[210px] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center dark:border-slate-700 dark:bg-slate-950/40">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No active case-aging data
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          No open, investigating, or for-review cases were found for the selected historical period.
        </p>
      </div>
    </div>
  );
}

export default function CaseAgingChart({
  data = [],
}) {
  const chartData =
    normalizeCaseAgingData(
      data
    );

  const totalCases =
    chartData.reduce(
      (
        total,
        item
      ) =>
        total +
        item.value,
      0
    );

  const overdueCases =
    chartData.find(
      (item) =>
        item.name ===
        "30+ Days"
    )?.value || 0;

  const overdueShare =
    totalCases > 0
      ? Math.round(
          (
            overdueCases /
            totalCases
          ) *
            100
        )
      : 0;

  const hasChartData =
    chartData.length > 0 &&
    totalCases > 0;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Active Case Aging
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Current unresolved cases grouped by how long they have remained active.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-right dark:bg-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Active Cases
            </p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">
              {totalCases}
            </p>
          </div>

          <div className="rounded-xl bg-red-50 px-3 py-2 text-right dark:bg-red-500/10">
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 dark:text-red-300">
              30+ Days
            </p>
            <p className="text-sm font-extrabold text-red-700 dark:text-red-300">
              {overdueCases} · {overdueShare}%
            </p>
          </div>
        </div>
      </div>

      {!hasChartData ? (
        <div className="mt-3">
          <EmptyChartState />
        </div>
      ) : (
        <div
          role="img"
          aria-label={`Case-aging distribution chart containing ${totalCases} active case${
            totalCases === 1
              ? ""
              : "s"
          }.`}
          className="mt-3 h-[210px] min-w-0 w-full text-slate-400 dark:text-slate-500"
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
            <BarChart
              data={
                chartData
              }
              layout="vertical"
              barCategoryGap="30%"
              margin={{
                top: 8,
                right: 36,
                bottom: 4,
                left: 8,
              }}
            >
              <CartesianGrid
                stroke="currentColor"
                strokeDasharray="3 3"
                opacity={0.1}
                horizontal={
                  false
                }
              />

              <XAxis
                type="number"
                allowDecimals={
                  false
                }
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: "currentColor",
                  fontSize: 11,
                }}
              />

              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: "currentColor",
                  fontSize: 11,
                }}
                width={82}
              />

              <Tooltip
                content={
                  <SharedTooltip />
                }
              />

              <Bar
                dataKey="value"
                name="Cases"
                radius={[
                  0,
                  7,
                  7,
                  0,
                ]}
                maxBarSize={26}
              >
                {chartData.map(
                  (
                    entry,
                    index
                  ) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={
                        entry.color
                      }
                    />
                  )
                )}

                <LabelList
                  dataKey="value"
                  position="right"
                  fill="currentColor"
                  fontSize={11}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}