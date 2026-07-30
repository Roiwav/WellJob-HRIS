import {
  useMemo,
  useState,
} from "react";
import {
  FiActivity,
  FiBarChart2,
  FiClock,
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
import CriticalAlerts from "../components/kpi/sections/CriticalAlerts";
import RiskIntelligenceSection from "../components/kpi/sections/RiskIntelligenceSection";
import WorkforceStandingSnapshot from "../components/kpi/sections/WorkforceStandingSnapshot";
import AnalyticsTrendsSection from "../components/kpi/sections/AnalyticsTrendsSection";
import RecommendationReviewSection from "../components/kpi/sections/RecommendationReviewSection";
import DecisionHistorySection from "../components/kpi/sections/DecisionHistorySection";

import {
  buildKPIEmployees,
  buildViolationTrend,
  buildComplianceTrend,
  buildUtilizationTrend,
} from "../utils/kpi/kpiHelpers";

import {
  exportKPIReportPDF,
} from "../utils/kpi/kpiPdfExport";

import {
  useKPIDataQuery,
} from "../hooks/useKPIQueries";

import {
  useKPIDecisionHistoryQuery,
} from "../hooks/useKPIDecisionQueries";

const TABS = [
  {
    id: "overview",
    label: "Overview",
    description: "Executive KPI summary",
    icon: FiActivity,
  },
  {
    id: "intelligence",
    label: "Employee Intelligence",
    description: "KPI risk table",
    icon: FiShield,
  },
  {
    id: "review",
    label: "Recommendation Review",
    description: "HR validation queue",
    icon: FiTarget,
  },
  {
    id: "history",
    label: "Decision History",
    description: "Recorded HR actions",
    icon: FiClock,
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Trend visualization",
    icon: FiBarChart2,
  },
];

function isPendingForReview(
  employee,
  decidedEmployeeIds
) {
  if (
    decidedEmployeeIds.has(
      String(employee.id)
    )
  ) {
    return false;
  }

  const recommendation = String(
    employee.recommendation || ""
  ).toLowerCase();

  const suggestedAction = String(
    employee.suggestedHRAction || ""
  ).toLowerCase();

  const hasConcern =
    Number(
      employee.violationCount || 0
    ) > 0 ||
    Number(
      employee.criticalIncidentCount || 0
    ) > 0 ||
    employee.riskLevel ===
      "High Risk" ||
    employee.riskLevel ===
      "Repeat";

  const isRetain =
    recommendation.includes(
      "retain"
    ) ||
    recommendation.includes(
      "maintain good standing"
    );

  const isMonitoringOnly =
    suggestedAction.includes(
      "continue monitoring"
    );

  return (
    hasConcern &&
    (!isRetain ||
      !isMonitoringOnly)
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

  const [
    activeTab,
    setActiveTab,
  ] = useState("overview");

  const [
    refreshError,
    setRefreshError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const {
    data: kpiData,
    isLoading: isKpiLoading,
    isFetching: isKpiFetching,
    error: kpiError,
    refetch: refetchKPIData,
  } = useKPIDataQuery({
    refetchInterval: 10000,
  });

  const {
    data: decisionHistoryData,
    isLoading:
      isDecisionHistoryLoading,
    isFetching:
      isDecisionHistoryFetching,
    error:
      decisionHistoryError,
    refetch:
      refetchDecisionHistory,
  } =
    useKPIDecisionHistoryQuery({
      refetchInterval: 10000,
    });

  const employeesRawSource =
    kpiData?.employeesRaw;

  const incidentsRawSource =
    kpiData?.incidentsRaw;

  const employeesRaw =
    useMemo(() => {
      return Array.isArray(
        employeesRawSource
      )
        ? employeesRawSource
        : [];
    }, [employeesRawSource]);

  const incidentsRaw =
    useMemo(() => {
      return Array.isArray(
        incidentsRawSource
      )
        ? incidentsRawSource
        : [];
    }, [incidentsRawSource]);

  const decisionHistory =
    useMemo(() => {
      return Array.isArray(
        decisionHistoryData
      )
        ? decisionHistoryData
        : [];
    }, [decisionHistoryData]);

  const employees =
    useMemo(() => {
      return buildKPIEmployees(
        employeesRaw,
        incidentsRaw
      );
    }, [
      employeesRaw,
      incidentsRaw,
    ]);

  const decidedEmployeeIds =
    useMemo(() => {
      return new Set(
        decisionHistory.map(
          (record) =>
            String(
              record.employeeId
            )
        )
      );
    }, [decisionHistory]);

  const totalEmployees =
    employees.length;

  const deployedEmployees =
    useMemo(() => {
      return employees.filter(
        (employee) =>
          employee.isDeployed
      ).length;
    }, [employees]);

  const repeatOffenders =
    useMemo(() => {
      return employees.filter(
        (employee) =>
          employee.riskLevel ===
            "Repeat" ||
          Number(
            employee.violationCount ||
              0
          ) >= 3
      ).length;
    }, [employees]);

  const highRiskEmployees =
    useMemo(() => {
      return employees.filter(
        (employee) =>
          employee.riskLevel ===
          "High Risk"
      ).length;
    }, [employees]);

  const goodStandingEmployees =
    useMemo(() => {
      return employees.filter(
        (employee) => {
          const violationCount =
            Number(
              employee.violationCount ||
                0
            );

          const criticalIncidentCount =
            Number(
              employee.criticalIncidentCount ||
                0
            );

          const riskLevel =
            String(
              employee.riskLevel ||
                ""
            ).toLowerCase();

          return (
            violationCount === 0 &&
            criticalIncidentCount ===
              0 &&
            !riskLevel.includes(
              "high"
            ) &&
            !riskLevel.includes(
              "repeat"
            )
          );
        }
      ).length;
    }, [employees]);

  const compliantEmployees =
    useMemo(() => {
      return employees.filter(
        (employee) =>
          Number(
            employee.violationCount ||
              0
          ) === 0
      ).length;
    }, [employees]);

  const complianceRate =
    totalEmployees > 0
      ? Math.round(
          (compliantEmployees /
            totalEmployees) *
            100
        )
      : 0;

  const pendingRecommendationCount =
    useMemo(() => {
      return employees.filter(
        (employee) =>
          isPendingForReview(
            employee,
            decidedEmployeeIds
          )
      ).length;
    }, [
      employees,
      decidedEmployeeIds,
    ]);

  const criticalAlerts =
    useMemo(() => {
      const activeStatuses = [
        "Open",
        "Investigating",
        "For Review",
      ];

      const activeIncidents =
        incidentsRaw.filter(
          (incident) =>
            activeStatuses.includes(
              incident.status
            )
        );

      const activeCriticalCases =
        activeIncidents.filter(
          (incident) =>
            incident.severity ===
            "Critical"
        ).length;

      const activeNonCriticalIncidents =
        activeIncidents.filter(
          (incident) =>
            incident.severity !==
            "Critical"
        );

      const underInvestigationCases =
        activeNonCriticalIncidents.filter(
          (incident) =>
            incident.status ===
              "Investigating" ||
            incident.status ===
              "For Review"
        ).length;

      const openMonitoringCases =
        activeNonCriticalIncidents.filter(
          (incident) =>
            incident.status ===
            "Open"
        ).length;

      return [
        {
          level: "HIGH",
          text: `${activeCriticalCases} active critical case(s) requiring priority HR attention`,
        },
        {
          level: "MEDIUM",
          text: `${underInvestigationCases} non-critical case(s) under investigation or review`,
        },
        {
          level: "LOW",
          text: `${openMonitoringCases} non-critical open case(s) for monitoring`,
        },
      ];
    }, [incidentsRaw]);

  const violationTrend =
    useMemo(() => {
      return buildViolationTrend(
        incidentsRaw
      );
    }, [incidentsRaw]);

  const complianceTrend =
    useMemo(() => {
      return buildComplianceTrend({
        employees,
        incidentsRaw,
        totalEmployees,
      });
    }, [
      employees,
      incidentsRaw,
      totalEmployees,
    ]);

  const utilizationTrend =
    useMemo(() => {
      return buildUtilizationTrend({
        totalEmployees,
        deployedEmployees,
      });
    }, [
      totalEmployees,
      deployedEmployees,
    ]);

  const isLoading =
    isKpiLoading ||
    isDecisionHistoryLoading;

  const isFetching =
    isKpiFetching ||
    isDecisionHistoryFetching;

  const pageError =
    refreshError ||
    getErrorMessage(
      kpiError,
      ""
    ) ||
    getErrorMessage(
      decisionHistoryError,
      ""
    );

  const hasKPIData =
    Boolean(kpiData);

  const handleRefreshData =
    async () => {
      if (isFetching) {
        return;
      }

      setRefreshError("");
      setSuccessMessage("");

      try {
        const [
          kpiResult,
          historyResult,
        ] = await Promise.all([
          refetchKPIData(),
          refetchDecisionHistory(),
        ]);

        const refetchError =
          kpiResult?.error ||
          historyResult?.error;

        if (
          kpiResult?.isError ||
          historyResult?.isError ||
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
          "KPI data was synchronized successfully."
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
      }
    };

  const handleDecisionSaved =
    async () => {
      setRefreshError("");

      try {
        const [
          kpiResult,
          historyResult,
        ] = await Promise.all([
          refetchKPIData(),
          refetchDecisionHistory(),
        ]);

        const refetchError =
          kpiResult?.error ||
          historyResult?.error;

        if (
          kpiResult?.isError ||
          historyResult?.isError ||
          refetchError
        ) {
          setRefreshError(
            getErrorMessage(
              refetchError,
              "The decision was saved, but the KPI data could not be refreshed."
            )
          );

          return;
        }

        setSuccessMessage(
          "The HR decision was saved and KPI data was updated."
        );
      } catch (error) {
        console.error(
          "Decision refresh error:",
          error
        );

        setRefreshError(
          getErrorMessage(
            error,
            "The decision was saved, but the KPI data could not be refreshed."
          )
        );
      }
    };

  const handleExportPDF = () => {
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
  };

  return (
    <main className="min-w-0 max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Decision Support"
        title="KPI Reports"
        description={
          isSuperAdmin
            ? "View-only KPI analytics access for Super Admin."
            : "Review workforce performance, risk intelligence, recommendations, decision history, and KPI trends."
        }
        icon={
          <FiBarChart2 size={22} />
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
                    isFetching
                      ? "animate-spin"
                      : ""
                  }
                />
              }
              loading={isFetching}
              disabled={
                isLoading ||
                isFetching
              }
              onClick={
                handleRefreshData
              }
            >
              Sync Now
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
                  isFetching ||
                  employees.length === 0
                }
                onClick={
                  handleExportPDF
                }
              >
                Export PDF
              </Button>
            </RoleGuard>
          </>
        }
      />

      {kpiData?.fetchedAt && (
        <p className="-mt-4 text-xs font-medium text-slate-400 dark:text-slate-500">
          Last synchronized:{" "}
          {new Date(
            kpiData.fetchedAt
          ).toLocaleString(
            "en-PH"
          )}
        </p>
      )}

      {pageError && (
        <ErrorState
          compact
          title="KPI data error"
          message={pageError}
          retryLabel="Reload KPI data"
          onRetry={
            handleRefreshData
          }
        />
      )}

      <div className="sticky top-0 z-20 -mx-4 border-y border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="KPI report sections"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;

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
                disabled={
                  isLoading ||
                  isFetching
                }
                onClick={() =>
                  setActiveTab(tab.id)
                }
                className={`flex min-w-fit items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive
                    ? "border-indigo-200 bg-indigo-600 text-white shadow-sm dark:border-indigo-500"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <Icon
                    size={17}
                    aria-hidden="true"
                  />
                </span>

                <span>
                  <span className="flex items-center gap-2 text-sm font-extrabold">
                    {tab.label}

                    {showPendingBadge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
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
                    className={`mt-0.5 block text-xs ${
                      isActive
                        ? "text-indigo-100"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {tab.description}
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
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
          <EmptyState
            icon="records"
            title="No KPI employee data"
            description="KPI reports will appear after active employee records are available from the backend."
            secondaryActionLabel={
              isFetching
                ? "Reloading KPI data..."
                : "Reload KPI data"
            }
            onSecondaryAction={
              isFetching
                ? undefined
                : handleRefreshData
            }
          />
        </section>
      ) : (
        <div
          role="tabpanel"
          className="space-y-6"
        >
          {activeTab ===
            "overview" && (
            <>
              <section className="space-y-6">
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

                <CriticalAlerts
                  alerts={
                    criticalAlerts
                  }
                />
              </section>

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
              />
            </>
          )}

          {activeTab ===
            "intelligence" && (
            <RiskIntelligenceSection
              employees={employees}
            />
          )}

          {activeTab ===
            "review" && (
            <RecommendationReviewSection
              employees={employees}
              user={user}
              onDecisionSaved={
                handleDecisionSaved
              }
            />
          )}

          {activeTab ===
            "history" && (
            <DecisionHistorySection />
          )}

          {activeTab ===
            "analytics" && (
            <AnalyticsTrendsSection
              violationTrend={
                violationTrend
              }
              complianceTrend={
                complianceTrend
              }
              utilizationTrend={
                utilizationTrend
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