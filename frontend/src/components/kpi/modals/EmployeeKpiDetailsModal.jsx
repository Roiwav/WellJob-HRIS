import {
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiClipboard,
  FiFileText,
  FiMessageSquare,
  FiRefreshCw,
  FiShield,
  FiTarget,
  FiUser,
  FiUsers,
  FiVideo,
  FiZap,
} from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";

import KPIBadge from "../badges/KPIBadge";
import RiskBadge from "../badges/RiskBadge";

import {
  DECISION_CONFIDENCE,
  HR_ACTION_WORKFLOW,
  WELLJOB_LOW_KPI_ACTIONS,
  getDecisionConfidenceClasses,
  getSuggestedHRActionClasses,
} from "../../../utils/kpi/kpiHelpers";

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}

function getDisplayValue(value) {
  if (value === 0) {
    return 0;
  }

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return value;
}

function DetailItem({
  icon,
  label,
  value,
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <span
          className="text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        >
          {icon}
        </span>
        {label}
      </div>

      <p
        className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white"
        title={String(getDisplayValue(value))}
      >
        {getDisplayValue(value)}
      </p>
    </div>
  );
}

function DecisionBadge({
  icon,
  label,
  className,
}) {
  return (
    <span
      className={[
        "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
        "text-xs font-bold",
        className,
      ].join(" ")}
      title={label}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

function IndicatorRow({
  icon,
  label,
  value,
  helper,
  tone = "slate",
}) {
  const toneClass = {
    slate:
      "border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-100",
    amber:
      "border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/15 dark:text-amber-300",
    rose:
      "border-rose-200 bg-rose-50/60 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/15 dark:text-rose-300",
  }[tone];

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${toneClass}`}>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5"
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">
          {label}
        </p>

        {helper && (
          <p className="mt-0.5 truncate text-[10px] opacity-70">
            {helper}
          </p>
        )}
      </div>

      <p className="shrink-0 text-lg font-black leading-none">
        {getDisplayValue(value)}
      </p>
    </div>
  );
}

function ExplanationRow({
  label,
  icon,
  children,
}) {
  return (
    <div className="grid gap-2 border-b border-slate-200 py-3 last:border-b-0 dark:border-slate-800 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
        <span
          className="mt-0.5 text-indigo-500 dark:text-indigo-300"
          aria-hidden="true"
        >
          {icon}
        </span>
        {label}
      </div>

      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
        {children}
      </p>
    </div>
  );
}

function getActionIcon(code) {
  switch (code) {
    case "VERBAL_COUNSELING":
      return <FiMessageSquare aria-hidden="true" />;

    case "PERFORMANCE_IMPROVEMENT_PLAN":
      return <FiTarget aria-hidden="true" />;

    case "REASSIGNMENT_OF_POSITION":
      return <FiRefreshCw aria-hidden="true" />;

    case "SEMINAR_WEBINAR":
      return <FiVideo aria-hidden="true" />;

    case "EMPLOYEE_TRAINING":
      return <FiUsers aria-hidden="true" />;

    default:
      return <FiShield aria-hidden="true" />;
  }
}

function ActionOption({
  action,
  isRecommended = false,
}) {
  return (
    <div
      className={[
        "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2.5",
        isRecommended
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-500/10 dark:text-amber-300"
          : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
      ].join(" ")}
    >
      <span className="shrink-0 text-sm" aria-hidden="true">
        {getActionIcon(action.code)}
      </span>

      <span className="min-w-0 flex-1 truncate text-xs font-bold">
        {action.title}
      </span>

      {isRecommended && (
        <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
          Recommended
        </span>
      )}
    </div>
  );
}

export default function EmployeeKpiDetailsModal({
  employee,
  onClose,
}) {
  const isOpen = Boolean(employee);

  const recommendation =
    employee?.recommendation ||
    "Retain / Maintain Good Standing";

  const correctiveActionCode =
    employee?.correctiveActionCode ||
    "RETAIN";

  const isRetain =
    correctiveActionCode === "RETAIN" ||
    recommendation === "Retain" ||
    recommendation ===
      "Retain / Maintain Good Standing";

  const decisionConfidence =
    employee?.decisionConfidence ||
    DECISION_CONFIDENCE.LOW;

  const suggestedHRAction =
    employee?.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  const decisionConfidenceReason =
    employee?.decisionConfidenceReason ||
    "The confidence level considers the employee's incident count, severity score, critical incidents, and current risk level.";

  const suggestedHRActionReason =
    employee?.suggestedHRActionReason ||
    "The recommended HR follow-up is based on the employee's current KPI standing and incident record and still requires HR review.";

  const recommendationReason =
    employee?.correctiveActionReason ||
    employee?.recommendationReason ||
    "No recommendation reason is available.";

  const correctiveActionBasis =
    employee?.correctiveActionBasis ||
    "The recommendation considers the employee's KPI standing, recorded violations, severity score, and risk level.";

  const employeeName =
    employee?.name ||
    "Unknown Employee";

  const employeeCompany =
    employee?.company ||
    "Unassigned";

  const employeeNumber = formatEmployeeId(
    employee?.id
  );

  const violationCount = Number(
    employee?.violationCount || 0
  );

  const severityScore = Number(
    employee?.severityScore || 0
  );

  const criticalIncidentCount =
    employee?.criticalIncidentCount;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Employee KPI Details"
      description="Review the employee's KPI standing, incident record, risk level, and recommended HR follow-up."
      size="xl"
      tone="default"
      footer={
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          Close
        </Button>
      }
    >
      {employee && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 min-w-[48px] shrink-0 items-center justify-center rounded-2xl bg-indigo-50 px-3 text-xs font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {employeeNumber}
              </div>

              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-900 dark:text-white">
                  {employeeName}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {employeeCompany}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2">
              <DetailItem
                icon={<FiBriefcase aria-hidden="true" />}
                label="Company"
                value={employeeCompany}
              />

              <DetailItem
                icon={<FiUser aria-hidden="true" />}
                label="Employment Status"
                value={employee.status || "Unknown"}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                KPI Review Summary
              </h3>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Review the employee's recorded incident information together with the resulting KPI and risk assessment.
              </p>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                    Incident Record
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Recorded incident information considered in the review.
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  <IndicatorRow
                    icon={<FiFileText aria-hidden="true" />}
                    label="Recorded Violations"
                    value={violationCount}
                    helper="Total recorded violations"
                    tone={
                      violationCount >= 5
                        ? "rose"
                        : violationCount >= 1
                        ? "amber"
                        : "slate"
                    }
                  />

                  <IndicatorRow
                    icon={<FiBarChart2 aria-hidden="true" />}
                    label="Severity Score"
                    value={severityScore}
                    helper="Overall severity from recorded incidents"
                    tone={
                      severityScore >= 8
                        ? "rose"
                        : severityScore >= 4
                        ? "amber"
                        : "slate"
                    }
                  />

                  {criticalIncidentCount !== undefined &&
                    criticalIncidentCount !== null && (
                      <IndicatorRow
                        icon={<FiAlertTriangle aria-hidden="true" />}
                        label="Critical Incidents"
                        value={Number(criticalIncidentCount || 0)}
                        helper="Recorded incidents marked as critical"
                        tone={
                          Number(criticalIncidentCount || 0) > 0
                            ? "rose"
                            : "slate"
                        }
                      />
                    )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                    HR Review Outcome
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Current assessment based on the employee's recorded KPI and incident information.
                  </p>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                    <p className="mb-2 whitespace-nowrap text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      KPI Standing
                    </p>

                    <KPIBadge
                      level={
                        employee.kpiLevel ||
                        "Good Standing"
                      }
                    />
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                    <p className="mb-2 whitespace-nowrap text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Risk Level
                    </p>

                    <RiskBadge
                      level={
                        employee.riskLevel ||
                        "Low Risk"
                      }
                    />
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                    <p className="mb-2 whitespace-nowrap text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Assessment Confidence
                    </p>

                    <DecisionBadge
                      icon={
                        <FiZap
                          size={12}
                          aria-hidden="true"
                        />
                      }
                      label={decisionConfidence}
                      className={getDecisionConfidenceClasses(
                        decisionConfidence
                      )}
                    />
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                    <p className="mb-2 whitespace-nowrap text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Recommended HR Follow-up
                    </p>

                    <DecisionBadge
                      icon={
                        <FiShield
                          size={12}
                          aria-hidden="true"
                        />
                      }
                      label={suggestedHRAction}
                      className={getSuggestedHRActionClasses(
                        suggestedHRAction
                      )}
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-xs leading-5 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
                  The incident record on the left provides the basis for the KPI standing and risk assessment shown here. HR should review these results together with the employee's full record before taking action.
                </div>
              </div>
            </div>
          </section>

          <section
            className={[
              "rounded-2xl border p-4",
              isRetain
                ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                : "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
            ].join(" ")}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Recommended HR Action
                </p>

                <div
                  className={[
                    "mt-2 flex items-center gap-2 text-sm font-black",
                    isRetain
                      ? "text-emerald-800 dark:text-emerald-300"
                      : "text-amber-800 dark:text-amber-300",
                  ].join(" ")}
                >
                  {isRetain ? (
                    <FiCheckCircle aria-hidden="true" />
                  ) : (
                    <FiShield aria-hidden="true" />
                  )}

                  <span>{recommendation}</span>
                </div>
              </div>

              <span className="w-fit shrink-0 rounded-md bg-white/70 px-2 py-1 text-[10px] font-black text-slate-600 dark:bg-slate-950/30 dark:text-slate-300">
                For HR review
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {recommendationReason}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="mb-1">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <FiClipboard
                  className="text-indigo-500 dark:text-indigo-300"
                  aria-hidden="true"
                />
                Basis for Recommendation
              </h3>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Supporting reasons behind the recommended HR action.
              </p>
            </div>

            <div className="mt-3">
              <ExplanationRow
                label="Review Basis"
                icon={<FiClipboard aria-hidden="true" />}
              >
                {correctiveActionBasis}
              </ExplanationRow>

              <ExplanationRow
                label="Why this confidence level"
                icon={<FiZap aria-hidden="true" />}
              >
                {decisionConfidenceReason}
              </ExplanationRow>

              <ExplanationRow
                label="Why this follow-up is recommended"
                icon={<FiShield aria-hidden="true" />}
              >
                {suggestedHRActionReason}
              </ExplanationRow>
            </div>
          </section>

          {!isRetain && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  HR Action Options
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Other available HR actions are shown for reference. The recommended option is highlighted.
                </p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {WELLJOB_LOW_KPI_ACTIONS.map(
                  (action) => (
                    <ActionOption
                      key={action.code}
                      action={action}
                      isRecommended={
                        action.code ===
                        correctiveActionCode
                      }
                    />
                  )
                )}
              </div>
            </section>
          )}

          <section className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
            <FiClipboard
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <div>
              <p className="text-xs font-black">
                Final HR decision
              </p>

              <p className="mt-1 text-xs leading-5">
                This page summarizes the employee's KPI and incident information to support HR review. The HR Manager remains responsible for validating the recommendation and making the final decision.
              </p>
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}