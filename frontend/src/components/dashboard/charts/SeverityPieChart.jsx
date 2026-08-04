import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import SharedTooltip from "../shared/SharedTooltip";

const CHART_COLORS = [
  "#4f46e5",
  "#f59e0b",
  "#ef4444",
  "#10b981",
];

const CHART_HEIGHT = 300;

function normalizeSeverityData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(Boolean)
    .map((item, index) => {
      const numericValue = Number(
        item?.value
      );

      return {
        ...item,
        name:
          String(
            item?.name ||
              `Severity ${index + 1}`
          ).trim() ||
          `Severity ${index + 1}`,
        value: Number.isFinite(
          numericValue
        )
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
          No severity data available
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Incident severity distribution
          cannot be displayed because no
          incident cases were found in the
          selected reporting period.
        </p>
      </div>
    </div>
  );
}

export default function SeverityPieChart({
  data = [],
}) {
  const safeData =
    normalizeSeverityData(data);

  const totalIncidents = safeData.reduce(
    (total, item) =>
      total + item.value,
    0
  );

  const hasChartData =
    safeData.length > 0 &&
    totalIncidents > 0;

  return (
    <section
      aria-labelledby="incident-severity-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-5">
        <h3
          id="incident-severity-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Incident Severity
        </h3>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Distribution of incident cases
          by severity level.
        </p>
      </div>

      {!hasChartData ? (
        <EmptyChartState />
      ) : (
        <div
          role="img"
          aria-label={`Incident severity distribution chart containing ${totalIncidents} total incident case${
            totalIncidents === 1
              ? ""
              : "s"
          }.`}
          className="h-[300px] w-full"
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <PieChart>
              <Pie
                data={safeData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={4}
                minAngle={2}
                stroke="none"
                isAnimationActive
              >
                {safeData.map(
                  (entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={
                        CHART_COLORS[
                          index %
                            CHART_COLORS.length
                        ]
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

              <Legend
                iconType="circle"
                iconSize={9}
                wrapperStyle={{
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}