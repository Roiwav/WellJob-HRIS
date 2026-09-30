function normalizeDistribution(data) {
  return Array.isArray(data)
    ? data.filter(
        (item) =>
          item &&
          String(
            item.name || ""
          ).trim()
      )
    : [];
}

function getBarClasses(name) {
  const normalizedName =
    String(
      name || ""
    ).toLowerCase();

  if (
    normalizedName.includes("critical") ||
    normalizedName.includes("high risk")
  ) {
    return "bg-rose-500 dark:bg-rose-400";
  }

  if (
    normalizedName.includes("needs improvement") ||
    normalizedName.includes("repeat")
  ) {
    return "bg-amber-500 dark:bg-amber-400";
  }

  if (
    normalizedName.includes("minor concern") ||
    normalizedName.includes("monitor")
  ) {
    return "bg-indigo-500 dark:bg-indigo-400";
  }

  if (
    normalizedName.includes("good standing") ||
    normalizedName.includes("low risk")
  ) {
    return "bg-emerald-500 dark:bg-emerald-400";
  }

  return "bg-slate-500 dark:bg-slate-400";
}

function DistributionCard({
  title,
  description,
  data = [],
}) {
  const safeData =
    normalizeDistribution(
      data
    );

  const total =
    safeData.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Math.max(
          0,
          Number(
            item.value || 0
          )
        ),
      0
    );

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h3>

          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {total}
          </p>

          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {total === 1
              ? "employee"
              : "employees"}
          </p>
        </div>
      </div>

      {safeData.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            No current data is available for this distribution.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {safeData.map(
            (
              item
            ) => {
              const value =
                Math.max(
                  0,
                  Number(
                    item.value || 0
                  )
                );

              const percentage =
                Math.min(
                  100,
                  Math.max(
                    0,
                    Number(
                      item.percentage || 0
                    )
                  )
                );

              return (
                <div
                  key={
                    item.name
                  }
                  className="space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="min-w-0 text-xs font-medium leading-5 text-slate-700 dark:text-slate-200">
                      {item.name}
                    </span>

                    <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {value}
                      <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">
                        ({percentage}%)
                      </span>
                    </span>
                  </div>

                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    role="progressbar"
                    aria-label={`${item.name}: ${percentage}%`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={
                      percentage
                    }
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${getBarClasses(
                        item.name
                      )}`}
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </article>
  );
}

export default function AnalyticsTrendsSection({
  kpiLevelDistribution = [],
  riskLevelDistribution = [],
}) {
  return (
    <section
      className="space-y-4"
      aria-labelledby="analytics-trends-title"
    >
      <div>
        <h2
          id="analytics-trends-title"
          className="text-base font-bold text-slate-900 dark:text-slate-100"
        >
          KPI & Risk Distribution
        </h2>

        <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500 dark:text-slate-400">
          Compare how employees in the current analytical scope are grouped by
          KPI standing and risk level. These figures describe the current
          filtered report and are not presented as historical trends.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <DistributionCard
          title="KPI Standing"
          description="Shows the current distribution of employees across KPI standing levels."
          data={
            kpiLevelDistribution
          }
        />

        <DistributionCard
          title="Risk Levels"
          description="Shows the current distribution of employees across risk levels used for HR review."
          data={
            riskLevelDistribution
          }
        />
      </div>
    </section>
  );
}