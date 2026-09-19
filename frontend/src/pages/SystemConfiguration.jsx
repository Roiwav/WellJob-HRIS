import {
  useMemo,
  useState,
} from "react";

import {
  FiBarChart2,
  FiBriefcase,
  FiEdit3,
  FiMapPin,
  FiSettings,
  FiShield,
} from "react-icons/fi";

import ClientCompaniesTab from "../components/config/ClientCompaniesTab";
import CompanyPositionsTab from "../components/config/CompanyPositionsTab";
import KPIThresholdsTab from "../components/config/KPIThresholdsTab";
import ViolationRulesTab from "../components/config/ViolationRulesTab";

import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";

import {
  ROLES,
} from "../constants/roles";

import {
  useAuth,
} from "../context/useAuth";

const TAB_KEYS = {
  VIOLATION_RULES:
    "violationRules",

  PERFORMANCE_EVALUATION:
    "performanceEvaluation",

  CLIENT_COMPANIES:
    "clientCompanies",

  COMPANY_POSITIONS:
    "companyPositions",
};

const ROLE_LABELS = {
  SUPER_ADMIN:
    "Super Admin",

  HR_MANAGER:
    "HR Manager",

  HR_STAFF:
    "HR Staff",

  HR_COORDINATOR:
    "HR Coordinator",

  IT_SUPPORT:
    "IT Support",
};

const SYSTEM_CONFIGURATION_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.HR_MANAGER,
];

function normalizeRole(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

export default function SystemConfiguration() {
  const {
    user,
  } =
    useAuth();

  const [
    activeTab,
    setActiveTab,
  ] =
    useState(
      TAB_KEYS.VIOLATION_RULES
    );

  const currentUserRole =
    normalizeRole(
      user?.role
    );

  const canAccessSystemConfiguration =
    SYSTEM_CONFIGURATION_ROLES.includes(
      currentUserRole
    );

  const canEditConfiguration =
    canAccessSystemConfiguration;

  const currentUserRoleLabel =
    ROLE_LABELS[
      currentUserRole
    ] ||
    currentUserRole ||
    "Unknown Role";

  const tabs =
    useMemo(
      () => [
        {
          key:
            TAB_KEYS.VIOLATION_RULES,

          label:
            "Violation Rules",

          description:
            "Manage Code of Conduct classifications, penalties, and severity mapping.",

          icon:
            FiShield,
        },

        {
          key:
            TAB_KEYS.PERFORMANCE_EVALUATION,

          label:
            "Performance Evaluation",

          description:
            "Manage organization-wide performance rating ranges, KPI factors, and percentage weights.",

          icon:
            FiBarChart2,
        },

        {
          key:
            TAB_KEYS.CLIENT_COMPANIES,

          label:
            "Client Companies",

          description:
            "Manage approved client companies used for employee deployment, company-specific positions, and HR Coordinator assignment.",

          icon:
            FiBriefcase,
        },

        {
          key:
            TAB_KEYS.COMPANY_POSITIONS,

          label:
            "Company Positions",

          description:
            "Manage approved deployment positions available under each client company.",

          icon:
            FiMapPin,
        },
      ],
      []
    );

  const activeTabDetails =
    tabs.find(
      (
        tab
      ) =>
        tab.key ===
        activeTab
    ) ||
    tabs[0];

  if (
    !canAccessSystemConfiguration
  ) {
    return (
      <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-500/30 dark:bg-red-950/20 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white">
              <FiShield
                size={22}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-red-900 dark:text-red-200">
                Access Restricted
              </h1>

              <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-300">
                System Configuration
                is available only to
                Super Admin and HR
                Manager accounts.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Policy Administration"
        title="System Configuration"
        description="Manage organization-wide policies, performance evaluation rules, client companies, and company-specific deployment positions."
        icon={
          <FiSettings
            size={22}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status="Editable"
              size="md"
            />

            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
              {
                currentUserRoleLabel
              }
            </span>
          </div>
        }
      />

      <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <FiEdit3
              size={20}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="font-extrabold text-indigo-900 dark:text-indigo-200">
              Configuration Editing
              Enabled
            </h2>

            <p className="mt-1 text-sm leading-6 text-indigo-800 dark:text-indigo-300">
              You are authorized to
              review and update
              organization-wide
              system configuration.
              Changes to policies,
              client companies,
              deployment positions,
              and performance
              evaluation settings
              should be reviewed
              before they are
              applied.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="border-b border-gray-200 px-5 py-5 dark:border-white/10 sm:px-6">
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
            Configuration
            Categories
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            Select the system
            configuration category
            that you need to review
            or update.
          </p>
        </div>

        <div
          className="grid gap-4 p-5 sm:p-6 md:grid-cols-2"
          role="tablist"
          aria-label="System configuration categories"
        >
          {tabs.map(
            (
              tab
            ) => {
              const TabIcon =
                tab.icon;

              const isActive =
                activeTab ===
                tab.key;

              return (
                <button
                  key={
                    tab.key
                  }
                  id={`configuration-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  aria-selected={
                    isActive
                  }
                  aria-controls={`configuration-panel-${tab.key}`}
                  tabIndex={
                    isActive
                      ? 0
                      : -1
                  }
                  onClick={() =>
                    setActiveTab(
                      tab.key
                    )
                  }
                  className={[
                    "group rounded-2xl border p-5 text-left outline-none transition",

                    "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",

                    "dark:focus-visible:ring-offset-slate-950",

                    isActive
                      ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-950/40"
                      : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800",
                  ].join(
                    " "
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={[
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition",

                        isActive
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-600 group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:bg-slate-800 dark:text-gray-300",
                      ].join(
                        " "
                      )}
                    >
                      <TabIcon
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
                        ].join(
                          " "
                        )}
                      >
                        {
                          tab.label
                        }
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        {
                          tab.description
                        }
                      </p>
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      <section
        id={`configuration-panel-${activeTabDetails.key}`}
        role="tabpanel"
        aria-labelledby={`configuration-tab-${activeTabDetails.key}`}
        className="min-w-0"
      >
        <div className="mb-4">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {
              activeTabDetails.label
            }
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {
              activeTabDetails.description
            }
          </p>
        </div>

        {activeTabDetails.key ===
        TAB_KEYS.VIOLATION_RULES ? (
          <ViolationRulesTab
            canEdit={
              canEditConfiguration
            }
            currentUser={
              user
            }
            currentUserRole={
              currentUserRole
            }
          />
        ) : activeTabDetails.key ===
          TAB_KEYS.PERFORMANCE_EVALUATION ? (
          <KPIThresholdsTab
            canEdit={
              canEditConfiguration
            }
          />
        ) : activeTabDetails.key ===
          TAB_KEYS.CLIENT_COMPANIES ? (
          <ClientCompaniesTab
            canEdit={
              canEditConfiguration
            }
          />
        ) : activeTabDetails.key ===
          TAB_KEYS.COMPANY_POSITIONS ? (
          <CompanyPositionsTab
            canEdit={
              canEditConfiguration
            }
          />
        ) : null}
      </section>
    </main>
  );
}