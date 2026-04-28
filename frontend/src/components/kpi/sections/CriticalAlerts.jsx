import { getAlertClasses } from "../../../utils/kpi/kpiHelpers";

export default function CriticalAlerts({ alerts = [] }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Critical Alerts
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Priority operational issues that require monitoring and intervention.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {alerts.map((alert, index) => (
          <div
            key={`${alert.level}-${index}`}
            className={`rounded-2xl border px-4 py-4 shadow-sm ${getAlertClasses(
              alert.level
            )}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide">
                {alert.level}
              </span>
            </div>

            <p className="text-sm font-medium">{alert.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}