import { useMemo, useState } from "react";

import {
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiMapPin,
  FiSettings,
  FiShield,
} from "react-icons/fi";

import ClientCompaniesTab from "../components/config/ClientCompaniesTab";
import CompanyPositionsTab from "../components/config/CompanyPositionsTab";
import KPIThresholdsTab from "../components/config/KPIThresholdsTab";
import ViolationRulesTab from "../components/config/ViolationRulesTab";

import PageHeader from "../components/ui/PageHeader";

import { ROLES } from "../constants/roles";
import { useAuth } from "../context/useAuth";

const TAB_KEYS = {
  VIOLATION_RULES: "violationRules",
  PERFORMANCE_EVALUATION: "performanceEvaluation",
  CLIENT_COMPANIES: "clientCompanies",
  COMPANY_POSITIONS: "companyPositions",
};

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  HR_COORDINATOR: "HR Coordinator",
  IT_SUPPORT: "IT Support",
};

const SYSTEM_CONFIGURATION_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.HR_MANAGER,
];

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export default function SystemConfiguration() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(
    TAB_KEYS.VIOLATION_RULES
  );

  const currentUserRole = normalizeRole(user?.role);

  const canAccessSystemConfiguration =
    SYSTEM_CONFIGURATION_ROLES.includes(currentUserRole);

  const canEditConfiguration =
    canAccessSystemConfiguration;

  const currentUserRoleLabel =
    ROLE_LABELS[currentUserRole] ||
    currentUserRole ||
    "Unknown Role";

  const tabs = useMemo(
    () => [
      {
        key: TAB_KEYS.VIOLATION_RULES,
        label: "Violation Rules",
        shortDescription: "Disciplinary policies",
        description:
          "Manage Code of Conduct classifications, penalties, and severity mapping.",
        icon: FiShield,
      },
      {
        key: TAB_KEYS.PERFORMANCE_EVALUATION,
        label: "Performance Evaluation",
        shortDescription: "Ratings and KPI settings",
        description:
          "Manage organization-wide performance rating ranges, KPI factors, and percentage weights.",
        icon: FiBarChart2,
      },
      {
        key: TAB_KEYS.CLIENT_COMPANIES,
        label: "Client Companies",
        shortDescription: "Companies and assignments",
        description:
          "Manage client companies available for employee deployment, positions, and HR Coordinator assignment.",
        icon: FiBriefcase,
      },
      {
        key: TAB_KEYS.COMPANY_POSITIONS,
        label: "Company Positions",
        shortDescription: "Deployment positions",
        description:
          "Manage approved deployment positions available under each client company.",
        icon: FiMapPin,
      },
    ],
    []
  );

  const activeTabDetails =
    tabs.find((tab) => tab.key === activeTab) ||
    tabs[0];

  const ActiveTabIcon = activeTabDetails.icon;

  if (!canAccessSystemConfiguration) {
    return (
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm dark:border-red-500/30 dark:bg-slate-900">
          <div className="flex items-start gap-4 p-5 sm:p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <FiShield
                size={20}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-gray-900 dark:text-white">
                System Configuration is restricted
              </h1>

              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                This workspace is available only to
                Super Admin and HR Manager accounts.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-w-0 space-y-4 p-4 pb-6 sm:p-6 sm:pb-6 lg:p-8 lg:pb-8">
      <PageHeader
        eyebrow="System Settings"
        title="System Configuration"
        description="Manage the core policies and operational settings used across WELLJOB HRIS."
        icon={<FiSettings size={22} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <FiCheckCircle
                size={14}
                aria-hidden="true"
              />

              Editing enabled
            </span>

            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
              {currentUserRoleLabel}
            </span>
          </div>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <FiSettings
                  size={15}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
                  Configuration Workspace
                </h2>

                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Choose what you want to manage.
                </p>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs text-gray-500 dark:text-gray-400 lg:flex">
            <FiShield
              size={14}
              aria-hidden="true"
            />

            <span>
              Changes apply across WELLJOB HRIS
            </span>
          </div>
        </div>

        <div
          className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4"
          role="tablist"
          aria-label="System configuration categories"
        >
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                id={`configuration-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`configuration-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "group relative min-w-0 rounded-xl border px-3.5 py-3 text-left outline-none transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                  "dark:focus-visible:ring-offset-slate-950",
                  isActive
                    ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-500/10"
                    : "border-transparent bg-gray-50 hover:border-gray-200 hover:bg-gray-100 dark:bg-slate-800/60 dark:hover:border-white/10 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                {isActive && (
                  <span
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
                    aria-hidden="true"
                  />
                )}

                <div className="flex items-center gap-3">
                  <div
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 group-hover:text-indigo-600 dark:bg-slate-900 dark:text-gray-400 dark:ring-white/10 dark:group-hover:text-indigo-300",
                    ].join(" ")}
                  >
                    <TabIcon
                      size={17}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0">
                    <p
                      className={[
                        "truncate text-sm font-extrabold",
                        isActive
                          ? "text-indigo-800 dark:text-indigo-200"
                          : "text-gray-800 dark:text-gray-100",
                      ].join(" ")}
                    >
                      {tab.label}
                    </p>

                    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {tab.shortDescription}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        id={`configuration-panel-${activeTabDetails.key}`}
        role="tabpanel"
        aria-labelledby={`configuration-tab-${activeTabDetails.key}`}
        className="min-w-0"
      >
        <div className="mb-3 flex items-start gap-3 px-1">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300">
            <ActiveTabIcon
              size={15}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
              {activeTabDetails.label}
            </h2>

            <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {activeTabDetails.description}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          {activeTabDetails.key ===
          TAB_KEYS.VIOLATION_RULES ? (
            <ViolationRulesTab
              canEdit={canEditConfiguration}
              currentUser={user}
              currentUserRole={currentUserRole}
            />
          ) : activeTabDetails.key ===
            TAB_KEYS.PERFORMANCE_EVALUATION ? (
            <KPIThresholdsTab
              canEdit={canEditConfiguration}
            />
          ) : activeTabDetails.key ===
            TAB_KEYS.CLIENT_COMPANIES ? (
            <ClientCompaniesTab
              canEdit={canEditConfiguration}
            />
          ) : activeTabDetails.key ===
            TAB_KEYS.COMPANY_POSITIONS ? (
            <CompanyPositionsTab
              canEdit={canEditConfiguration}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}