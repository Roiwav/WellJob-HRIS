import { useState } from "react";
import {
  getKPIThresholds,
  saveKPIThresholds,
} from "../../utils/configStorage";

export default function KPIThresholdsTab() {
  const [formData, setFormData] = useState(getKPIThresholds());
  const [message, setMessage] = useState("");

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  };

  const handleWeightChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        [name]: Number(value),
      },
    }));
  };

  const handleLevelChange = (levelKey, field, value) => {
    setFormData((prev) => ({
      ...prev,
      levels: {
        ...prev.levels,
        [levelKey]: {
          ...prev.levels[levelKey],
          [field]: Number(value),
        },
      },
    }));
  };

  const validateThresholds = () => {
    const { low, medium, high } = formData.levels;

    if (
      low.min > low.max ||
      medium.min > medium.max ||
      high.min > high.max
    ) {
      showMessage("Minimum value must not be greater than maximum value.");
      return false;
    }

    if (!(low.max < medium.min && medium.max < high.min)) {
      showMessage("Threshold ranges must not overlap.");
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateThresholds()) return;

    saveKPIThresholds(formData);
    showMessage("KPI thresholds saved successfully.");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Severity Weights
        </h2>

        {message && (
          <div className="mb-4 rounded-lg bg-green-100 text-green-700 px-4 py-2 text-sm dark:bg-green-500/10 dark:text-green-400">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Minor Weight
            </label>
            <input
              type="number"
              min="0"
              name="minor"
              value={formData.weights.minor}
              onChange={handleWeightChange}
              className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Major Weight
            </label>
            <input
              type="number"
              min="0"
              name="major"
              value={formData.weights.major}
              onChange={handleWeightChange}
              className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Critical Weight
            </label>
            <input
              type="number"
              min="0"
              name="critical"
              value={formData.weights.critical}
              onChange={handleWeightChange}
              className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          KPI Level Thresholds
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {["low", "medium", "high"].map((levelKey) => (
            <div
              key={levelKey}
              className="rounded-2xl border border-gray-200 dark:border-white/10 p-4"
            >
              <h3 className="text-base font-semibold capitalize text-gray-900 dark:text-white mb-4">
                {levelKey} Level
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Min Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.levels[levelKey].min}
                    onChange={(e) =>
                      handleLevelChange(levelKey, "min", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Max Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.levels[levelKey].max}
                    onChange={(e) =>
                      handleLevelChange(levelKey, "max", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <button
            onClick={handleSave}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm font-medium transition"
          >
            Save KPI Thresholds
          </button>
        </div>
      </div>
    </div>
  );
}