import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import SharedTooltip from "../shared/SharedTooltip";

const CHART_HEIGHT = 210;

const SEVERITY_CONFIG = {
  Critical: {
    color: "#ef4444",
    order: 1,
  },
  Major: {
    color: "#f59e0b",
    order: 2,
  },
  Minor: {
    color: "#4f46e5",
    order: 3,
  },
};

function normalizeSeverityData(data) {
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
        const name =
          String(
            item?.name ||
              `Severity ${index + 1}`
          ).trim() ||
          `Severity ${index + 1}`;

        const numericValue =
          Number(
            item?.value
          );

        const config =
          SEVERITY_CONFIG[
            name
          ] || {
            color:
              "#94a3b8",
            order: 99,
          };

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
            config.color,
          order:
            config.order,
        };
      }
    )
    .sort(
      (first, second) =>
        first.order -
        second.order
    );
}

function EmptyChartState() {
  return (
    <div className="flex h-[210px] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center dark:border-slate-700 dark:bg-slate-950/40">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No severity data available
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          No incident reports were found in the selected historical period.
        </p>
      </div>
    </div>
  );
}

export default function SeverityPieChart({
  data = [],
}) {
  const safeData =
    normalizeSeverityData(
      data
    );

  const totalIncidents =
    safeData.reduce(
      (
        total,
        item
      ) =>
        total +
        item.value,
      0
    );

  const hasChartData =
    safeData.length > 0 &&
    totalIncidents > 0;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Incident Severity Distribution
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Breakdown of incident reports by recorded severity level.
          </p>
        </div>

        <div className="rounded-xl bg-slate-100 px-3 py-2 text-right dark:bg-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Reports in Scope
          </p>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
            {totalIncidents}
          </p>
        </div>
      </div>

      {!hasChartData ? (
        <div className="mt-3">
          <EmptyChartState />
        </div>
      ) : (
        <div className="mt-3 grid items-center gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <div
            role="img"
            aria-label={`Incident severity distribution chart containing ${totalIncidents} total incident report${
              totalIncidents === 1
                ? ""
                : "s"
            }.`}
            className="h-[210px] min-w-0 w-full"
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
              <PieChart>
                <Pie
                  data={
                    safeData
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={72}
                  paddingAngle={3}
                  minAngle={2}
                  stroke="none"
                  isAnimationActive
                >
                  {safeData.map(
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
                </Pie>

                <Tooltip
                  content={
                    <SharedTooltip />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {safeData.map(
              (
                item,
                index
              ) => {
                const percentage =
                  totalIncidents > 0
                    ? Math.round(
                        (
                          item.value /
                          totalIncidents
                        ) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={`${item.name}-summary-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            item.color,
                        }}
                        aria-hidden="true"
                      />

                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {item.name}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {item.value}
                      </p>
                      <p className="text-[10px] font-medium text-slate-400">
                        {percentage}%
                      </p>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}
    </section>
  );
}