import { useMemo, useState } from "react";
import {
  FiBarChart2,
  FiEdit3,
  FiEye,
  FiSettings,
  FiShield,
} from "react-icons/fi";

import ViolationRulesTab from "../components/config/ViolationRulesTab";
import KPIThresholdsTab from "../components/config/KPIThresholdsTab";

import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";

import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

const TAB_KEYS = {
  VIOLATION_RULES: "violationRules",
  KPI_THRESHOLDS: "kpiThresholds",
};

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  IT_SUPPORT: "IT Support",
};

export default function SystemConfiguration() {
  const { user, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState(
    TAB_KEYS.VIOLATION_RULES
  );

  const canEditConfiguration = hasPermission(
    PERMISSIONS.CAN_CONFIGURE_KPI_RULES
  );

  const currentUserRole =
    user?.role || "";

  const currentUserRoleLabel =
    ROLE_LABELS[currentUserRole] ||
    currentUserRole ||
    "Unknown Role";

  const tabs = useMemo(
    () => [
      {
        key: TAB_KEYS.VIOLATION_RULES,
        label: "Violation Rules",
        description:
          "Manage Code of Conduct classifications, penalties, and severity mapping.",
        icon: FiShield,
      },
      {
        key: TAB_KEYS.KPI_THRESHOLDS,
        label: "KPI Thresholds",
        description:
          "Manage performance rating ranges, KPI factors, and percentage weights.",
        icon: FiBarChart2,
      },
    ],
    []
  );

  const activeTabDetails =
    tabs.find(
      (tab) => tab.key === activeTab
    ) || tabs[0];

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Policy Administration"
        title="System Configuration"
        description="Manage the organizational policies and threshold rules used for incident classification, employee evaluation, and decision support."
        icon={
          <FiSettings size={22} />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                canEditConfiguration
                  ? "Editable"
                  : "View Only"
              }
              size="md"
            />

            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
              {currentUserRoleLabel}
            </span>
          </div>
        }
      />

      <section
        className={[
          "rounded-3xl border p-5 shadow-sm sm:p-6",
          canEditConfiguration
            ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10"
            : "border-gray-200 bg-white dark:border-white/10 dark:bg-slate-900",
        ].join(" ")}
      >
        <div className="flex items-start gap-4">
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              canEditConfiguration
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300",
            ].join(" ")}
          >
            {canEditConfiguration ? (
              <FiEdit3
                size={20}
                aria-hidden="true"
              />
            ) : (
              <FiEye
                size={20}
                aria-hidden="true"
              />
            )}
          </div>

          <div>
            <h2
              className={[
                "font-extrabold",
                canEditConfiguration
                  ? "text-indigo-900 dark:text-indigo-200"
                  : "text-gray-900 dark:text-white",
              ].join(" ")}
            >
              {canEditConfiguration
                ? "Configuration Editing Enabled"
                : "Read-Only Configuration Access"}
            </h2>

            <p
              className={[
                "mt-1 text-sm leading-6",
                canEditConfiguration
                  ? "text-indigo-800 dark:text-indigo-300"
                  : "text-gray-600 dark:text-gray-400",
              ].join(" ")}
            >
              {canEditConfiguration
                ? "You are authorized to review and update KPI thresholds and violation policies. All changes must be reviewed and confirmed before they are applied."
                : "You may review the current KPI thresholds and violation policies, but your assigned role cannot modify system configuration."}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="border-b border-gray-200 px-5 py-5 sm:px-6 dark:border-white/10">
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
            Configuration Categories
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            Select the policy category that you need to review
            {canEditConfiguration
              ? " or update"
              : ""}
            .
          </p>
        </div>

        <div
          className="grid gap-4 p-5 md:grid-cols-2 sm:p-6"
          role="tablist"
          aria-label="System configuration categories"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              activeTab === tab.key;

            return (
              <button
                key={tab.key}
                id={`configuration-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`configuration-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() =>
                  setActiveTab(tab.key)
                }
                className={[
                  "group rounded-2xl border p-5 text-left outline-none transition",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                  "dark:focus-visible:ring-offset-slate-950",
                  isActive
                    ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-950/40"
                    : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={[
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition",
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-600 group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:bg-slate-800 dark:text-gray-300",
                    ].join(" ")}
                  >
                    <Icon
                      size={20}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0">
                    <p
                      className={[
                        "font-extrabold",
                        isActive
                          ? "text-indigo-800 dark:text-indigo-200"
                          : "text-gray-900 dark:text-white",
                      ].join(" ")}
                    >
                      {tab.label}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      {tab.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        id={`configuration-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`configuration-tab-${activeTab}`}
        className="min-w-0"
      >
        <div className="mb-4">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {activeTabDetails.label}
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {activeTabDetails.description}
          </p>
        </div>

        {activeTab ===
        TAB_KEYS.VIOLATION_RULES ? (
          <ViolationRulesTab
            canEdit={
              canEditConfiguration
            }
            currentUser={user}
            currentUserRole={
              currentUserRole
            }
          />
        ) : (
          <KPIThresholdsTab
            canEdit={
              canEditConfiguration
            }
            currentUser={user}
            currentUserRole={
              currentUserRole
            }
          />
        )}
      </section>
    </main>
  );
}