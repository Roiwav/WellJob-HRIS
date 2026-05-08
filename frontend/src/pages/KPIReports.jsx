import { useMemo, useState } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiClock,
  FiShield,
  FiTarget,
} from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import KPISummarySection from "../components/kpi/sections/KPISummarySection";
import CriticalAlerts from "../components/kpi/sections/CriticalAlerts";
import HighRiskEmployees from "../components/kpi/sections/HighRiskEmployees";
import GoodStandingEmployees from "../components/kpi/sections/GoodStandingEmployees";
import RiskIntelligenceSection from "../components/kpi/sections/RiskIntelligenceSection";
import AnalyticsTrendsSection from "../components/kpi/sections/AnalyticsTrendsSection";
import RecommendationReviewSection from "../components/kpi/sections/RecommendationReviewSection";
import DecisionHistorySection from "../components/kpi/sections/DecisionHistorySection";

import {
  buildKPIEmployees,
  buildViolationTrend,
  buildComplianceTrend,
  buildUtilizationTrend,
} from "../utils/kpi/kpiHelpers";

import { exportKPIReportPDF } from "../utils/kpi/kpiPdfExport";
import { useKPIDataQuery } from "../hooks/useKPIQueries";

const DECISION_HISTORY_KEY = "welljob_kpi_decision_history";

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

function getDecisionHistoryRecords() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(DECISION_HISTORY_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isPendingForReview(employee, decidedEmployeeIds) {
  if (decidedEmployeeIds.has(String(employee.id))) {
    return false;
  }

  const recommendation = String(employee.recommendation || "").toLowerCase();
  const suggestedAction = String(employee.suggestedHRAction || "").toLowerCase();

  const hasConcern =
    Number(employee.violationCount || 0) > 0 ||
    Number(employee.criticalIncidentCount || 0) > 0 ||
    employee.riskLevel === "High Risk" ||
    employee.riskLevel === "Repeat";

  const isRetain =
    recommendation.includes("retain") ||
    recommendation.includes("maintain good standing");

  const isMonitoringOnly = suggestedAction.includes("continue monitoring");

  return hasConcern && (!isRetain || !isMonitoringOnly);
}

export default function KPIReports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState("overview");
  const [decisionHistoryRefreshKey, setDecisionHistoryRefreshKey] = useState(0);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useKPIDataQuery({
    refetchInterval: 10000,
  });

  const employeesRaw = data?.employeesRaw || [];
  const incidentsRaw = data?.incidentsRaw || [];

  const employees = useMemo(() => {
    return buildKPIEmployees(employeesRaw, incidentsRaw);
  }, [employeesRaw, incidentsRaw]);

  const decisionHistory = useMemo(() => {
    decisionHistoryRefreshKey;
    return getDecisionHistoryRecords();
  }, [decisionHistoryRefreshKey]);

  const decidedEmployeeIds = useMemo(() => {
    return new Set(decisionHistory.map((record) => String(record.employeeId)));
  }, [decisionHistory]);

  const totalEmployees = employees.length;

  const deployedEmployees = employees.filter((emp) => emp.isDeployed).length;

  const repeatOffenders = employees.filter(
    (emp) => emp.riskLevel === "Repeat" || emp.violationCount >= 3
  ).length;

  const highRiskEmployees = employees.filter(
    (emp) => emp.riskLevel === "High Risk"
  ).length;

  const goodStandingEmployees = employees.filter((emp) => {
    const violationCount = Number(emp.violationCount || 0);
    const criticalIncidentCount = Number(emp.criticalIncidentCount || 0);
    const riskLevel = String(emp.riskLevel || "").toLowerCase();

    return (
      violationCount === 0 &&
      criticalIncidentCount === 0 &&
      !riskLevel.includes("high") &&
      !riskLevel.includes("repeat")
    );
  }).length;

  const compliantEmployees = employees.filter(
    (emp) => emp.violationCount === 0
  ).length;

  const complianceRate =
    totalEmployees > 0
      ? Math.round((compliantEmployees / totalEmployees) * 100)
      : 0;

  const pendingRecommendationCount = employees.filter((employee) =>
    isPendingForReview(employee, decidedEmployeeIds)
  ).length;

  const criticalAlerts = useMemo(() => {
    const openIncidents = incidentsRaw.filter(
      (incident) => incident.status === "Open"
    ).length;

    const investigatingIncidents = incidentsRaw.filter(
      (incident) => incident.status === "Investigating"
    ).length;

    const forReviewIncidents = incidentsRaw.filter(
      (incident) => incident.status === "For Review"
    ).length;

    const criticalIncidents = incidentsRaw.filter(
      (incident) => incident.severity === "Critical"
    ).length;

    return [
      {
        level: "HIGH",
        text: `${criticalIncidents} critical incident case(s) detected`,
      },
      {
        level: "MEDIUM",
        text: `${investigatingIncidents} incident(s) under investigation`,
      },
      {
        level: "LOW",
        text: `${openIncidents} open case(s), ${forReviewIncidents} for Super Admin review`,
      },
    ];
  }, [incidentsRaw]);

  const violationTrend = useMemo(() => {
    return buildViolationTrend(incidentsRaw);
  }, [incidentsRaw]);

  const complianceTrend = useMemo(() => {
    return buildComplianceTrend({
      employees,
      incidentsRaw,
      totalEmployees,
    });
  }, [employees, incidentsRaw, totalEmployees]);

  const utilizationTrend = useMemo(() => {
    return buildUtilizationTrend({
      totalEmployees,
      deployedEmployees,
    });
  }, [totalEmployees, deployedEmployees]);

  const handleRefreshData = async () => {
    await refetch();
    setDecisionHistoryRefreshKey((prev) => prev + 1);
  };

  const handleDecisionSaved = () => {
    setDecisionHistoryRefreshKey((prev) => prev + 1);
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
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            KPI Reports
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            {isSuperAdmin
              ? "View-only KPI analytics access for Super Admin."
              : "A tab-based KPI workspace for workforce overview, decision intelligence, recommendation review, decision history, and analytics."}
          </p>

          {data?.fetchedAt && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Last synced: {new Date(data.fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefreshData}
            disabled={isFetching}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
          >
            {isFetching ? "Syncing..." : "Sync Now"}
          </button>

          <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isLoading || employees.length === 0}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export PDF
            </button>
          </RoleGuard>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error.message || "Unable to load KPI backend data."}
        </div>
      )}

      <div className="sticky top-0 z-20 -mx-4 border-y border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const showPendingBadge =
              tab.id === "review" && pendingRecommendationCount > 0;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-fit items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
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
                  <Icon size={17} />
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
                        {pendingRecommendationCount}
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
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Loading KPI data from backend...
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === "overview" && (
            <>
              <section className="space-y-6">
                <KPISummarySection
                  totalEmployees={totalEmployees}
                  complianceRate={complianceRate}
                  repeatOffenders={repeatOffenders}
                  highRiskEmployees={highRiskEmployees}
                />

                <CriticalAlerts alerts={criticalAlerts} />
              </section>

              <section className="space-y-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Employee Standing Monitoring
                    </h2>

                    <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                      A quick balanced view of employees requiring corrective
                      attention and employees with no recorded violations.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                      {highRiskEmployees} high risk
                    </span>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                      {goodStandingEmployees} good standing
                    </span>

                    <span className="rounded-full bg-indigo-100 px-3 py-1 font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                      {pendingRecommendationCount} pending review
                    </span>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
                  <HighRiskEmployees employees={employees} />
                  <GoodStandingEmployees employees={employees} />
                </div>
              </section>
            </>
          )}

          {activeTab === "intelligence" && (
            <RiskIntelligenceSection employees={employees} />
          )}

          {activeTab === "review" && (
            <RecommendationReviewSection
              employees={employees}
              user={user}
              onDecisionSaved={handleDecisionSaved}
            />
          )}

          {activeTab === "history" && <DecisionHistorySection />}

          {activeTab === "analytics" && (
            <AnalyticsTrendsSection
              violationTrend={violationTrend}
              complianceTrend={complianceTrend}
              utilizationTrend={utilizationTrend}
            />
          )}
        </div>
      )}
    </div>
  );
}