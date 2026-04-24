import { useState } from "react";
import { FiBarChart2, FiSettings, FiShield } from "react-icons/fi";
import ViolationRulesTab from "../components/config/ViolationRulesTab";
import KPIThresholdsTab from "../components/config/KPIThresholdsTab";

export default function SystemConfiguration() {
  const [activeTab, setActiveTab] = useState("violationRules");

  const tabs = [
    {
      key: "violationRules",
      label: "Violation Rules",
      description: "Read-only Code of Conduct reference",
      icon: FiShield,
    },
    {
      key: "kpiThresholds",
      label: "KPI Thresholds",
      description: "Performance alert configuration",
      icon: FiBarChart2,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-7">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
                <FiSettings size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-extrabold text-white">
                  System Configuration
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">
                  Configure policy references, penalty levels, severity mapping,
                  and KPI threshold settings used by HR Manager and HR Staff.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`group rounded-2xl border p-5 text-left transition ${
                    isActive
                      ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-950/40"
                      : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`rounded-2xl p-3 transition ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-600 group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:bg-slate-800 dark:text-gray-300"
                      }`}
                    >
                      <Icon size={20} />
                    </div>

                    <div>
                      <p
                        className={`font-bold ${
                          isActive
                            ? "text-indigo-800 dark:text-indigo-200"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {tab.label}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {tab.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "violationRules" ? (
          <ViolationRulesTab />
        ) : (
          <KPIThresholdsTab />
        )}
      </div>
    </div>
  );
}