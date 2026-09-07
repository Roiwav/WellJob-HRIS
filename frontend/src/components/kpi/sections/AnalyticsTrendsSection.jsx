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
    normalizedName.includes("high risk") ||
    normalizedName.includes("termination") ||
    normalizedName.includes("suspension") ||
    normalizedName.includes("escalation")
  ) {
    return "bg-rose-500 dark:bg-rose-400";
  }

  if (
    normalizedName.includes("needs improvement") ||
    normalizedName.includes("repeat") ||
    normalizedName.includes("moderate") ||
    normalizedName.includes("investigation") ||
    normalizedName.includes("validation") ||
    normalizedName.includes("performance improvement")
  ) {
    return "bg-amber-500 dark:bg-amber-400";
  }

  if (
    normalizedName.includes("minor concern") ||
    normalizedName.includes("monitor") ||
    normalizedName.includes("human review")
  ) {
    return "bg-indigo-500 dark:bg-indigo-400";
  }

  if (
    normalizedName.includes("good standing") ||
    normalizedName.includes("low risk") ||
    normalizedName.includes("retain") ||
    normalizedName.includes("continue monitoring")
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
    <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            {title}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {total}{" "}
          {total === 1
            ? "employee"
            : "employees"}
        </span>
      </div>

      {safeData.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            No analytics data available.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
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
                  className="space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {
                        item.name
                      }
                    </span>

                    <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {value}
                      <span className="ml-1 font-semibold text-slate-400 dark:text-slate-500">
                        (
                        {percentage}
                        %)
                      </span>
                    </span>
                  </div>

                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
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
  decisionConfidenceDistribution = [],
  suggestedHRActionDistribution = [],
  systemRecommendationDistribution = [],
}) {
  return (
    <section
      className="space-y-5"
      aria-labelledby="analytics-trends-title"
    >
      <div>
        <h2
          id="analytics-trends-title"
          className="text-lg font-semibold text-gray-900 dark:text-white"
        >
          KPI & DSS Analytics
        </h2>

        <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          Current workforce distribution based on recorded employee incidents,
          KPI standing, risk evaluation, decision confidence, and rule-based
          decision support. These analytics represent the current workforce
          snapshot and are not presented as historical monthly trends.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <DistributionCard
          title="KPI Level Distribution"
          description="Shows how the active workforce is currently distributed across KPI standing levels."
          data={
            kpiLevelDistribution
          }
        />

        <DistributionCard
          title="Risk Level Distribution"
          description="Shows the current workforce distribution across DSS risk classifications."
          data={
            riskLevelDistribution
          }
        />

        <DistributionCard
          title="Decision Confidence"
          description="Summarizes the current confidence level of the rule-based decision-support evaluation."
          data={
            decisionConfidenceDistribution
          }
        />

        <DistributionCard
          title="Suggested HR Action"
          description="Summarizes the HR workflow actions currently suggested for employee review."
          data={
            suggestedHRActionDistribution
          }
        />
      </div>

      <DistributionCard
        title="System Recommendation Summary"
        description="Shows the current distribution of system-generated employee recommendations for HR review and validation."
        data={
          systemRecommendationDistribution
        }
      />
    </section>
  );
}