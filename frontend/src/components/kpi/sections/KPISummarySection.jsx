import KPICards from "../cards/KPICards";

export default function KPISummarySection({
  totalEmployees,
  complianceRate,
  repeatOffenders,
  highRiskEmployees,
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          KPI Summary
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Key workforce and compliance indicators connected to employee,
          incident, and deployment records.
        </p>
      </div>

      <KPICards
        totalEmployees={totalEmployees}
        complianceRate={complianceRate}
        repeatOffenders={repeatOffenders}
        highRiskEmployees={highRiskEmployees}
      />
    </section>
  );
}