import ComplianceTrendChart from "../../dashboard/charts/ComplianceTrendChart";
import UtilizationTrendChart from "../../dashboard/charts/UtilizationTrendChart";
import ViolationTrendChart from "../../dashboard/charts/ViolationTrendChart";

function normalizeTrendData(data) {
  return Array.isArray(data)
    ? data
    : [];
}

export default function AnalyticsTrendsSection({
  violationTrend = [],
  complianceTrend = [],
  utilizationTrend = [],
}) {
  const safeViolationTrend =
    normalizeTrendData(
      violationTrend
    );

  const safeComplianceTrend =
    normalizeTrendData(
      complianceTrend
    );

  const safeUtilizationTrend =
    normalizeTrendData(
      utilizationTrend
    );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Analytics Trends
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tracks workforce violations, compliance, and current deployment
          utilization.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <ViolationTrendChart
          data={safeViolationTrend}
        />

        <ComplianceTrendChart
          data={safeComplianceTrend}
        />

        <UtilizationTrendChart
          data={safeUtilizationTrend}
        />
      </div>
    </section>
  );
}