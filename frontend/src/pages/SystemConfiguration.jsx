import { useState } from "react";
import ViolationRulesTab from "../components/config/ViolationRulesTab";
import KPIThresholdsTab from "../components/config/KPIThresholdsTab";

export default function SystemConfiguration() {
  const [activeTab, setActiveTab] = useState("violationRules");

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            System Configuration
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage violation rules, severity mapping, and KPI threshold settings.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab("violationRules")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "violationRules"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
            }`}
          >
            Violation Rules
          </button>

          <button
            onClick={() => setActiveTab("kpiThresholds")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "kpiThresholds"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
            }`}
          >
            KPI Thresholds
          </button>
        </div>
      </div>

      {activeTab === "violationRules" ? (
        <ViolationRulesTab />
      ) : (
        <KPIThresholdsTab />
      )}
    </div>
  );
}