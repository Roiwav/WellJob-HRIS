import ViolationTrendChart from "../../dashboard/charts/ViolationTrendChart";
import ComplianceTrendChart from "../../dashboard/charts/ComplianceTrendChart";
import UtilizationTrendChart from "../../dashboard/charts/UtilizationTrendChart";

export default function AnalyticsTrendsSection({
  violationTrend,
  complianceTrend,
  utilizationTrend,
}) {
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
        <ViolationTrendChart data={violationTrend} />
        <ComplianceTrendChart data={complianceTrend} />
        <UtilizationTrendChart data={utilizationTrend} />
      </div>
    </section>
  );
}