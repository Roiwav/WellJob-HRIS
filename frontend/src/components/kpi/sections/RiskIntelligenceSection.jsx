import RiskTable from "../table/RiskTable";

export default function RiskIntelligenceSection({ employees = [] }) {
  return (
    <section className="min-w-0 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Risk Intelligence
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Provides employee-level KPI evaluation with system-generated
          recommended actions and reasons for HR decision support.
        </p>
      </div>

      <RiskTable
        employees={employees}
        getSeverity={(violationCount) => {
          if (violationCount >= 5) return "Critical";
          if (violationCount >= 3) return "Major";
          if (violationCount >= 1) return "Minor";
          return "Clean";
        }}
        getRiskLevel={(violationCount) => {
          if (violationCount >= 5) return "High Risk";
          if (violationCount >= 3) return "Repeat";
          if (violationCount >= 1) return "Monitor";
          return "Clean";
        }}
      />
    </section>
  );
}