import { useState } from "react";
import { FiActivity, FiAlertTriangle, FiRefreshCw, FiSave } from "react-icons/fi";

const STORAGE_KEY = "welljob_kpi_thresholds";

const DEFAULT_THRESHOLDS = {
  incidentFrequency: {
    label: "Incident Frequency Rate",
    good: 0,
    warning: 3,
    critical: 6,
    unit: "incidents/month",
  },
  severityIndex: {
    label: "Severity Index",
    good: 0,
    warning: 40,
    critical: 70,
    unit: "points",
  },
  resolutionTurnaround: {
    label: "Case Resolution Turnaround",
    good: 3,
    warning: 7,
    critical: 15,
    unit: "days",
  },
  deploymentEfficiency: {
    label: "Deployment Efficiency",
    good: 90,
    warning: 75,
    critical: 60,
    unit: "%",
  },
  complianceRate: {
    label: "Document Compliance Rate",
    good: 95,
    warning: 85,
    critical: 75,
    unit: "%",
  },
};

function loadThresholds() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export default function KPIThresholdsTab() {
  const [thresholds, setThresholds] = useState(loadThresholds);

  const handleChange = (key, field, value) => {
    setThresholds((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: Number(value),
      },
    }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
    window.dispatchEvent(new Event("kpiThresholdsUpdated"));
    alert("KPI thresholds saved successfully.");
  };

  const handleReset = () => {
    const confirmed = window.confirm("Restore default KPI thresholds?");
    if (!confirmed) return;

    setThresholds(DEFAULT_THRESHOLDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_THRESHOLDS));
    window.dispatchEvent(new Event("kpiThresholdsUpdated"));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              KPI Threshold Settings
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              These values will control KPI status labels, dashboard alerts, and
              HR monitoring indicators.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
            >
              <FiRefreshCw />
              Restore Defaults
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <FiSave />
              Save Thresholds
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(thresholds).map(([key, item]) => (
          <div
            key={key}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700">
                <FiActivity />
              </div>

              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {item.label}
                </h3>
                <p className="text-sm text-gray-500">Unit: {item.unit}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-bold text-emerald-700">
                  Good
                </span>
                <input
                  type="number"
                  value={item.good}
                  onChange={(e) => handleChange(key, "good", e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-amber-700">
                  Warning
                </span>
                <input
                  type="number"
                  value={item.warning}
                  onChange={(e) =>
                    handleChange(key, "warning", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-red-700">
                  Critical
                </span>
                <input
                  type="number"
                  value={item.critical}
                  onChange={(e) =>
                    handleChange(key, "critical", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
        <div className="flex gap-3">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <p className="text-sm leading-6">
            Recommended rule: incidents and severity index are bad when higher;
            deployment efficiency and compliance rate are bad when lower. Apply
            this logic when displaying status badges in HR dashboards.
          </p>
        </div>
      </div>
    </div>
  );
}