import { useMemo, useState } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiDownload,
  FiRefreshCw,
  FiShield,
  FiTarget,
} from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import SuccessToast from "../components/ui/SuccessToast";
import KPISummarySection from "../components/kpi/sections/KPISummarySection";
import RiskIntelligenceSection from "../components/kpi/sections/RiskIntelligenceSection";
import WorkforceStandingSnapshot from "../components/kpi/sections/WorkforceStandingSnapshot";
import RecommendationReviewSection from "../components/kpi/sections/RecommendationReviewSection";
import DecisionHistorySection from "../components/kpi/sections/DecisionHistorySection";
import DescriptiveAnalyticsSection from "../components/kpi/sections/DescriptiveAnalyticsSection";

import {
  buildKPIEmployees,
  hasCurrentKPIDecisionReview,
} from "../utils/kpi/kpiHelpers";

import {
  INITIAL_KPI_FILTERS,
  filterKpiRecords,
} from "../utils/kpi/descriptiveAnalytics";

import { exportKPIReportPDF } from "../utils/kpi/kpiPdfExport";
import { useKPIDataQuery } from "../hooks/useKPIQueries";
import { useKPIDecisionLatestQuery } from "../hooks/useKPIDecisionQueries";

const AUTO_REFRESH_INTERVAL_MS = false;

const TABS = [
  {
    id: "overview",
    label: "Overview",
    note: "Workforce snapshot",
  },
  {
    id: "intelligence",
    label: "Employee Intelligence",
    note: "Risk & HR actions",
  },
  {
    id: "review",
    label: "Recommendation Review",
    note: "Validate recommendations",
  },
  {
    id: "analytics",
    label: "Analytics",
    note: "Filters & patterns",
  },
];

function KPIReportTabIcon({
  tabId,
  size = 17,
}) {
  switch (tabId) {
    case "overview":
      return (
        <FiActivity
          size={size}
          aria-hidden="true"
        />
      );

    case "intelligence":
      return (
        <FiShield
          size={size}
          aria-hidden="true"
        />
      );

    case "review":
      return (
        <FiTarget
          size={size}
          aria-hidden="true"
        />
      );

    case "analytics":
      return (
        <FiBarChart2
          size={size}
          aria-hidden="true"
        />
      );

    default:
      return null;
  }
}

function isPendingForReview(
  employee,
  decisionHistory
) {
  if (
    hasCurrentKPIDecisionReview(
      employee,
      decisionHistory
    )
  ) {
    return false;
  }

  const recommendation =
    String(
      employee.recommendation || ""
    ).toLowerCase();

  const suggestedAction =
    String(
      employee.suggestedHRAction || ""
    ).toLowerCase();

  const hasConcern =
    Number(
      employee.violationCount || 0
    ) > 0 ||
    Number(
      employee.criticalIncidentCount || 0
    ) > 0 ||
    employee.riskLevel === "High Risk" ||
    employee.riskLevel === "Repeat";

  const isRetain =
    recommendation.includes("retain") ||
    recommendation.includes(
      "maintain good standing"
    );

  const isMonitoringOnly =
    suggestedAction.includes(
      "continue monitoring"
    );

  return (
    hasConcern &&
    (!isRetain || !isMonitoringOnly)
  );
}

function getErrorMessage(
  error,
  fallbackMessage
) {
  return (
    error?.message ||
    fallbackMessage
  );
}

export default function KPIReports() {
  const { user } = useAuth();

  const isSuperAdmin =
    user?.role === "SUPER_ADMIN";

  const isHRManager =
    user?.role === "HR_MANAGER";

  const [
    activeTab,
    setActiveTab,
  ] = useState("overview");

  const [
    reviewView,
    setReviewView,
  ] = useState("pending");

  const [
    analyticsFilters,
    setAnalyticsFilters,
  ] = useState({
    ...INITIAL_KPI_FILTERS,
  });

  const [
    refreshError,
    setRefreshError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    isManualRefreshing,
    setIsManualRefreshing,
  ] = useState(false);

  const {
    data: kpiData,
    isLoading: isKpiLoading,
    error: kpiError,
    refetch: refetchKPIData,
  } = useKPIDataQuery({
    refetchInterval:
      AUTO_REFRESH_INTERVAL_MS,
  });

  const {
    data: decisionSnapshotData,
    isLoading:
      isDecisionSnapshotLoading,
    error: decisionSnapshotError,
    refetch:
      refetchDecisionSnapshot,
  } =
    useKPIDecisionLatestQuery({
      refetchInterval:
        AUTO_REFRESH_INTERVAL_MS,
    });

  const employeesRawSource =
    kpiData?.employeesRaw;

  const incidentsRawSource =
    kpiData?.incidentsRaw;

  const employeesRaw = useMemo(
    () =>
      Array.isArray(
        employeesRawSource
      )
        ? employeesRawSource
        : [],
    [employeesRawSource]
  );

  const incidentsRaw = useMemo(
    () =>
      Array.isArray(
        incidentsRawSource
      )
        ? incidentsRawSource
        : [],
    [incidentsRawSource]
  );

  const decisionHistory = useMemo(
    () =>
      Array.isArray(
        decisionSnapshotData?.decisions
      )
        ? decisionSnapshotData.decisions
        : [],
    [decisionSnapshotData]
  );

  const employees = useMemo(
    () =>
      buildKPIEmployees(
        employeesRaw,
        incidentsRaw
      ),
    [employeesRaw, incidentsRaw]
  );

  const totalEmployees =
    employees.length;

  const deployedEmployees =
    useMemo(
      () =>
        employees.filter(
          (employee) =>
            employee.isDeployed
        ).length,
      [employees]
    );

  const repeatOffenders =
    useMemo(
      () =>
        employees.filter(
          (employee) =>
            employee.riskLevel ===
              "Repeat" ||
            Number(
              employee.violationCount ||
                0
            ) >= 3
        ).length,
      [employees]
    );

  const highRiskEmployees =
    useMemo(
      () =>
        employees.filter(
          (employee) =>
            employee.riskLevel ===
            "High Risk"
        ).length,
      [employees]
    );

  const goodStandingEmployees =
    useMemo(
      () =>
        employees.filter(
          (employee) => {
            const riskLevel =
              String(
                employee.riskLevel ||
                  ""
              ).toLowerCase();

            return (
              Number(
                employee.violationCount ||
                  0
              ) === 0 &&
              Number(
                employee.criticalIncidentCount ||
                  0
              ) === 0 &&
              !riskLevel.includes(
                "high"
              ) &&
              !riskLevel.includes(
                "repeat"
              )
            );
          }
        ).length,
      [employees]
    );

  const compliantEmployees =
    useMemo(
      () =>
        employees.filter(
          (employee) =>
            Number(
              employee.violationCount ||
                0
            ) === 0
        ).length,
      [employees]
    );

  const complianceRate =
    totalEmployees > 0
      ? Math.round(
          (compliantEmployees /
            totalEmployees) *
            100
        )
      : 0;

  const pendingRecommendationCount =
    useMemo(
      () =>
        employees.filter(
          (employee) =>
            isPendingForReview(
              employee,
              decisionHistory
            )
        ).length,
      [employees, decisionHistory]
    );

  const criticalAlerts =
    useMemo(() => {
      const activeIncidents =
        incidentsRaw.filter(
          (incident) =>
            [
              "Open",
              "Investigating",
              "For Review",
            ].includes(
              incident.status
            )
        );

      const activeCriticalCases =
        activeIncidents.filter(
          (incident) =>
            incident.severity ===
            "Critical"
        ).length;

      const activeNonCritical =
        activeIncidents.filter(
          (incident) =>
            incident.severity !==
            "Critical"
        );

      const underInvestigation =
        activeNonCritical.filter(
          (incident) =>
            incident.status ===
              "Investigating" ||
            incident.status ===
              "For Review"
        ).length;

      const openMonitoring =
        activeNonCritical.filter(
          (incident) =>
            incident.status === "Open"
        ).length;

      return [
        {
          level: "HIGH",
          text: `${activeCriticalCases} active critical case(s) requiring priority HR attention`,
        },
        {
          level: "MEDIUM",
          text: `${underInvestigation} non-critical case(s) under investigation or review`,
        },
        {
          level: "LOW",
          text: `${openMonitoring} non-critical open case(s) for monitoring`,
        },
      ];
    }, [incidentsRaw]);

  const analyticsScope =
    useMemo(
      () =>
        filterKpiRecords({
          employees: employeesRaw,
          incidents: incidentsRaw,
          filters: analyticsFilters,
          buildKPIEmployees,
        }),
      [
        employeesRaw,
        incidentsRaw,
        analyticsFilters,
      ]
    );

  const isLoading =
    isKpiLoading ||
    isDecisionSnapshotLoading;

  const pageError =
    refreshError ||
    getErrorMessage(kpiError, "") ||
    getErrorMessage(
      decisionSnapshotError,
      ""
    );

  const hasKPIData =
    Boolean(kpiData);

  async function handleRefreshData() {
    if (isManualRefreshing) {
      return;
    }

    setIsManualRefreshing(true);
    setRefreshError("");
    setSuccessMessage("");

    try {
      const [
        kpiResult,
        decisionResult,
      ] = await Promise.all([
        refetchKPIData(),
        refetchDecisionSnapshot(),
      ]);

      const refetchError =
        kpiResult?.error ||
        decisionResult?.error;

      if (
        kpiResult?.isError ||
        decisionResult?.isError ||
        refetchError
      ) {
        setRefreshError(
          getErrorMessage(
            refetchError,
            "Unable to refresh KPI data."
          )
        );
        return;
      }

      setSuccessMessage(
        "KPI data was refreshed successfully."
      );
    } catch (error) {
      console.error(
        "KPI refresh error:",
        error
      );

      setRefreshError(
        getErrorMessage(
          error,
          "Unable to refresh KPI data."
        )
      );
    } finally {
      setIsManualRefreshing(false);
    }
  }

  function handleDecisionSaved() {
    setRefreshError("");

    setSuccessMessage(
      "The HR decision was saved and the review status was updated."
    );
  }

  function handleExportPDF() {
    exportKPIReportPDF({
      user,
      totalEmployees,
      deployedEmployees,
      complianceRate,
      repeatOffenders,
      highRiskEmployees,
      goodStandingEmployees,
      criticalAlerts,
      employees,
    });
  }

  return (
    <main className="min-w-0 max-w-full space-y-5 overflow-x-hidden p-4 sm:p-6 lg:p-7">
      <PageHeader
        eyebrow="Decision Support"
        title="KPI Reports"
        description={
          isSuperAdmin
            ? "View workforce KPI, risk, recommendations, decisions, and analytics."
            : isHRManager
              ? "Review workforce KPI, risk, recommendations, decisions, and analytics."
              : "View workforce KPI, risk, recommendations, decisions, and analytics."
        }
        icon={
          <FiBarChart2
            size={22}
            aria-hidden="true"
          />
        }
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              leftIcon={
                <FiRefreshCw
                  aria-hidden="true"
                  className={
                    isManualRefreshing
                      ? "animate-spin"
                      : ""
                  }
                />
              }
              loading={
                isManualRefreshing
              }
              disabled={
                isLoading ||
                isManualRefreshing
              }
              onClick={
                handleRefreshData
              }
            >
              Refresh Data
            </Button>

            <RoleGuard
              permission={
                PERMISSIONS.CAN_EXPORT_PDF
              }
            >
              <Button
                type="button"
                variant="success"
                leftIcon={
                  <FiDownload
                    aria-hidden="true"
                  />
                }
                disabled={
                  isLoading ||
                  employees.length === 0
                }
                onClick={
                  handleExportPDF
                }
              >
                Export PDF (Full Workforce)
              </Button>
            </RoleGuard>
          </>
        }
      />

      {kpiData?.fetchedAt && (
        <div className="-mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <FiRefreshCw
            size={13}
            aria-hidden="true"
          />

          <span>
            Updated{" "}
            {new Date(
              kpiData.fetchedAt
            ).toLocaleString(
              "en-PH"
            )}
          </span>
        </div>
      )}

      {pageError && (
        <ErrorState
          compact
          title="KPI data error"
          message={pageError}
          retryLabel={
            isManualRefreshing
              ? "Reloading KPI data..."
              : "Reload KPI data"
          }
          onRetry={
            isManualRefreshing
              ? undefined
              : handleRefreshData
          }
        />
      )}

      <div className="sticky top-0 z-20 -mx-4 border-y border-slate-200 bg-slate-50/95 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6 lg:-mx-7 lg:px-7">
        <div
          role="tablist"
          aria-label="KPI report sections"
          className="flex gap-2 overflow-x-auto"
        >
          {TABS.map((tab) => {
            const isActive =
              activeTab === tab.id;

            const showPendingBadge =
              tab.id === "review" &&
              pendingRecommendationCount >
                0;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={
                  isActive
                }
                aria-controls={`kpi-panel-${tab.id}`}
                disabled={isLoading}
                onClick={() => {
                  setActiveTab(tab.id);

                  if (tab.id === "review") {
                    setReviewView("pending");
                  }
                }}
                className={`flex min-h-12 min-w-fit items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 lg:flex-1 lg:justify-center ${
                  isActive
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                }`}
              >
                <KPIReportTabIcon
                  tabId={tab.id}
                  size={16}
                />

                <span className="min-w-0">
                  <span className="flex items-center gap-2 whitespace-nowrap text-sm font-bold">
                    {tab.label}

                    {showPendingBadge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        }`}
                      >
                        {
                          pendingRecommendationCount
                        }
                      </span>
                    )}
                  </span>

                  <span
                    className={`mt-0.5 hidden whitespace-nowrap text-[11px] font-medium sm:block ${
                      isActive
                        ? "text-indigo-100"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {tab.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton
          rows={6}
          columns={4}
          showHeader
        />
      ) : !hasKPIData ||
        employees.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <EmptyState
            icon="records"
            title="No KPI employee data"
            description="KPI reports will appear when employee records are available."
            secondaryActionLabel={
              isManualRefreshing
                ? "Reloading KPI data..."
                : "Reload KPI data"
            }
            onSecondaryAction={
              isManualRefreshing
                ? undefined
                : handleRefreshData
            }
          />
        </section>
      ) : (
        <div
          id={`kpi-panel-${activeTab}`}
          role="tabpanel"
          className="space-y-5"
        >
          {activeTab ===
            "overview" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="p-4 sm:p-5">
                <KPISummarySection
                  totalEmployees={
                    totalEmployees
                  }
                  complianceRate={
                    complianceRate
                  }
                  repeatOffenders={
                    repeatOffenders
                  }
                  highRiskEmployees={
                    highRiskEmployees
                  }
                />
              </div>

              <div className="border-t border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                <WorkforceStandingSnapshot
                  employees={employees}
                  totalEmployees={
                    totalEmployees
                  }
                  goodStandingEmployees={
                    goodStandingEmployees
                  }
                  highRiskEmployees={
                    highRiskEmployees
                  }
                  pendingRecommendationCount={
                    pendingRecommendationCount
                  }
                  onOpenIntelligence={() =>
                    setActiveTab(
                      "intelligence"
                    )
                  }
                  onOpenReview={() => {
                    setReviewView("pending");
                    setActiveTab(
                      "review"
                    );
                  }}
                />
              </div>
            </section>
          )}

          {activeTab ===
            "intelligence" && (
            <RiskIntelligenceSection
              employees={employees}
            />
          )}

          {activeTab === "review" &&
            (reviewView === "history" ? (
              <DecisionHistorySection
                canDeleteDecisions={
                  isHRManager
                }
                onBackToRecommendations={() =>
                  setReviewView("pending")
                }
              />
            ) : (
              <RecommendationReviewSection
                employees={employees}
                user={user}
                canManageDecisions={
                  isHRManager
                }
                onDecisionSaved={
                  handleDecisionSaved
                }
                onOpenDecisionHistory={() =>
                  setReviewView("history")
                }
              />
            ))}

          {activeTab ===
            "analytics" && (
            <DescriptiveAnalyticsSection
              sourceEmployees={
                employees
              }
              employees={
                analyticsScope.employees
              }
              incidents={
                analyticsScope.incidents
              }
              filters={
                analyticsFilters
              }
              onFiltersChange={
                setAnalyticsFilters
              }
            />
          )}
        </div>
      )}

      <SuccessToast
        title="KPI Reports Updated"
        message={successMessage}
        duration={3500}
        onClose={() =>
          setSuccessMessage("")
        }
      />
    </main>
  );
}