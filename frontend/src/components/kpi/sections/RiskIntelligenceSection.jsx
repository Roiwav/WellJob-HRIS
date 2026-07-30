import RiskTable from "../table/RiskTable";

function getSeverity(violationCount) {
  const count = Number(
    violationCount || 0
  );

  if (count >= 5) {
    return "Critical";
  }

  if (count >= 3) {
    return "Major";
  }

  if (count >= 1) {
    return "Minor";
  }

  return "None";
}

function getRiskLevel(violationCount) {
  const count = Number(
    violationCount || 0
  );

  if (count >= 5) {
    return "High Risk";
  }

  if (count >= 3) {
    return "Repeat";
  }

  if (count >= 1) {
    return "Monitor";
  }

  return "Low Risk";
}

export default function RiskIntelligenceSection({
  employees = [],
}) {
  const safeEmployees =
    Array.isArray(employees)
      ? employees
      : [];

  return (
    <section className="min-w-0 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          KPI Standing and HR Action Intelligence
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Provides employee-level KPI standing, risk evaluation, recommended HR
          actions, and decision reasons for workforce monitoring.
        </p>
      </div>

      <RiskTable
        employees={safeEmployees}
        getSeverity={getSeverity}
        getRiskLevel={getRiskLevel}
      />
    </section>
  );
}