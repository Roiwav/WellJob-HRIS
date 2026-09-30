import { useMemo, useState } from "react";

import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiThumbsUp,
  FiXCircle,
  FiZap,
} from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import LoadingSkeleton from "../../ui/LoadingSkeleton";
import SearchInput from "../../ui/SearchInput";

import KPIBadge from "../badges/KPIBadge";
import RiskBadge from "../badges/RiskBadge";

import {
  DECISION_CONFIDENCE,
  HR_ACTION_WORKFLOW,
  RECOMMENDATION_LABELS,
  WELLJOB_LOW_KPI_ACTIONS,
  getDecisionConfidenceClasses,
  hasCurrentKPIDecisionReview,
} from "../../../utils/kpi/kpiHelpers";

import {
  useCreateKPIDecisionMutation,
  useKPIDecisionLatestQuery,
} from "../../../hooks/useKPIDecisionQueries";

const FINAL_ACTION_OPTIONS = Array.from(
  new Set([
    RECOMMENDATION_LABELS.RETAIN,
    ...WELLJOB_LOW_KPI_ACTIONS.map(
      (action) => action.title
    ),
    ...Object.values(HR_ACTION_WORKFLOW),
    "Suspension Review",
    "Termination Review",
    "No Action Required",
  ])
);

const INPUT_CLASS_NAME = [
  "w-full rounded-xl border border-slate-300",
  "bg-white px-3 py-2.5 text-sm font-semibold",
  "text-slate-700 outline-none transition",
  "focus:border-indigo-500",
  "focus:ring-2 focus:ring-indigo-500/10",
  "disabled:cursor-not-allowed",
  "disabled:bg-slate-100",
  "disabled:text-slate-500",
  "dark:border-slate-700",
  "dark:bg-slate-950",
  "dark:text-slate-200",
  "dark:disabled:bg-slate-800",
].join(" ");

function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function formatEmployeeId(value) {
  return String(value ?? "-").replace(
    /^KPI-/i,
    ""
  );
}

function getReviewerFullName(user) {
  const directName =
    user?.fullName ||
    user?.full_name ||
    user?.displayName ||
    user?.display_name ||
    user?.name;

  if (
    typeof directName === "string" &&
    directName.trim()
  ) {
    return directName.trim();
  }

  const combinedName = [
    user?.firstName || user?.first_name,
    user?.middleName || user?.middle_name,
    user?.lastName || user?.last_name,
  ]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join(" ");

  return (
    combinedName ||
    user?.username ||
    "HR User"
  );
}

function isPendingRecommendation(employee) {
  const recommendation = String(
    employee?.recommendation || ""
  ).toLowerCase();

  const suggestedAction = String(
    employee?.suggestedHRAction ||
      HR_ACTION_WORKFLOW.MONITOR
  ).toLowerCase();

  const hasConcern =
    Number(employee?.violationCount || 0) > 0 ||
    Number(employee?.criticalIncidentCount || 0) > 0 ||
    employee?.riskLevel === "High Risk" ||
    employee?.riskLevel === "Repeat";

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

function EmployeeNumberBadge({ value }) {
  return (
    <div
      className="flex h-11 min-w-[48px] shrink-0 items-center justify-center rounded-2xl bg-indigo-50 px-3 text-xs font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
      title={`Employee number ${formatEmployeeId(value)}`}
    >
      {formatEmployeeId(value)}
    </div>
  );
}

function ReviewFact({
  label,
  children,
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1.5">
        {children}
      </div>
    </div>
  );
}

function ChoiceButton({
  active,
  icon,
  title,
  description,
  tone,
  onClick,
}) {
  const toneClasses = {
    accept: active
      ? "border-emerald-400 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/15 dark:border-emerald-700 dark:bg-emerald-950/25 dark:text-emerald-300"
      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-950/20 dark:text-slate-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/15",
    modify: active
      ? "border-indigo-400 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/15 dark:border-indigo-700 dark:bg-indigo-950/25 dark:text-indigo-300"
      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-950/20 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/15",
    reject: active
      ? "border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-500/15 dark:border-rose-700 dark:bg-rose-950/25 dark:text-rose-300"
      : "border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50/60 dark:border-slate-700 dark:bg-slate-950/20 dark:text-slate-200 dark:hover:border-rose-800 dark:hover:bg-rose-950/15",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex min-h-[82px] w-full items-start gap-3 rounded-xl border p-3 text-left transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
        toneClasses[tone],
      ].join(" ")}
    >
      <span
        className="mt-0.5 shrink-0 text-base"
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-black">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 opacity-75">
          {description}
        </span>
      </span>
    </button>
  );
}

function ReviewRecommendationModal({
  employee,
  user,
  onClose,
  onSaved,
}) {
  const createDecisionMutation =
    useCreateKPIDecisionMutation();

  const recommendation =
    employee?.recommendation ||
    RECOMMENDATION_LABELS.RETAIN;

  const recommendedFollowUp =
    employee?.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  const assessmentConfidence =
    employee?.decisionConfidence ||
    DECISION_CONFIDENCE.LOW;

  const recommendationReason =
    employee?.recommendationReason ||
    employee?.correctiveActionReason ||
    "No recommendation explanation is available.";

  const followUpReason =
    employee?.suggestedHRActionReason ||
    employee?.decisionConfidenceReason ||
    "No follow-up explanation is available.";

  const [decisionChoice, setDecisionChoice] =
    useState("");

  const [finalAction, setFinalAction] = useState(
    recommendedFollowUp
  );

  const [notes, setNotes] = useState("");

  const isPending =
    createDecisionMutation.isPending;

  const decisionType =
    decisionChoice === "accept"
      ? "Accepted"
      : decisionChoice === "modify"
      ? "Modified"
      : decisionChoice === "reject"
      ? "Rejected"
      : "";

  const isRejectMissingNotes =
    decisionChoice === "reject" &&
    !notes.trim();

  const isFinalActionMissing =
    !String(finalAction || "").trim();

  const canSave =
    Boolean(decisionChoice) &&
    !isPending &&
    !isRejectMissingNotes &&
    !isFinalActionMissing;

  function handleDecisionChoice(nextChoice) {
    setDecisionChoice(nextChoice);

    if (nextChoice === "accept") {
      setFinalAction(recommendedFollowUp);
      return;
    }

    if (nextChoice === "modify") {
      setFinalAction(recommendation);
      return;
    }

    if (nextChoice === "reject") {
      setFinalAction("No Action Required");
    }
  }

  async function handleSave() {
    if (
      !employee ||
      !employee.id ||
      !canSave
    ) {
      return;
    }

    const payload = {
      employeeId: employee.id,

      employeeName:
        employee.name || "Unknown Employee",

      company:
        employee.company || "Unassigned",

      riskLevel:
        employee.riskLevel || "Low Risk",

      kpiLevel:
        employee.kpiLevel || "Good Standing",

      violationCount: Number(
        employee.violationCount || 0
      ),

      severityScore: Number(
        employee.severityScore || 0
      ),

      criticalIncidentCount: Number(
        employee.criticalIncidentCount || 0
      ),

      decisionConfidence:
        employee.decisionConfidence ||
        DECISION_CONFIDENCE.LOW,

      suggestedHRAction: recommendedFollowUp,

      systemRecommendation: recommendation,

      finalAction,

      decisionType,

      notes:
        notes.trim() ||
        `${decisionType} after HR review of the recommendation.`,

      decidedBy:
        getReviewerFullName(user),

      decidedByRole:
        user?.role || "Authorized User",

      recommendationReason:
        employee.recommendationReason ||
        employee.correctiveActionReason ||
        "",

      decisionConfidenceReason:
        employee.decisionConfidenceReason || "",

      suggestedHRActionReason:
        employee.suggestedHRActionReason || "",

      correctiveActionBasis:
        employee.correctiveActionBasis || "",
    };

    try {
      const result =
        await createDecisionMutation.mutateAsync(
          payload
        );

      onSaved?.(
        result?.record || result,
        decisionType
      );
    } catch (error) {
      console.error(
        "KPI decision save error:",
        error
      );
    }
  }

  return (
    <Dialog
      open={Boolean(employee)}
      onClose={onClose}
      title="Review Recommendation"
      description="Review the employee information and record the HR decision."
      tone="default"
      size="xl"
      preventClose={isPending}
      closeOnOverlay={!isPending}
      closeOnEscape={!isPending}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            leftIcon={<FiCheckCircle />}
            loading={isPending}
            disabled={!canSave}
            onClick={handleSave}
          >
            Save HR Decision
          </Button>
        </>
      }
    >
      {employee && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="flex min-w-0 items-center gap-3">
              <EmployeeNumberBadge value={employee.id} />

              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-900 dark:text-white">
                  {employee.name || "Unknown Employee"}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {employee.company || "Unassigned"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
              <ReviewFact label="KPI Standing">
                <KPIBadge
                  level={
                    employee.kpiLevel ||
                    "Good Standing"
                  }
                />
              </ReviewFact>

              <ReviewFact label="Risk Level">
                <RiskBadge
                  level={
                    employee.riskLevel ||
                    "Low Risk"
                  }
                />
              </ReviewFact>

              <ReviewFact label="Recorded Violations">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {Number(employee.violationCount || 0)}
                </p>
              </ReviewFact>

              <ReviewFact label="Severity Score">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {Number(employee.severityScore || 0)}
                </p>
              </ReviewFact>
            </div>

            {Number(
              employee.criticalIncidentCount || 0
            ) > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300">
                <FiAlertCircle aria-hidden="true" />
                {Number(
                  employee.criticalIncidentCount || 0
                )} critical incident(s) recorded
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Recommendation for HR Review
            </h3>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Review the recommendation and the suggested follow-up before recording the HR decision.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Recommendation
                </p>

                <p className="mt-1.5 text-sm font-black leading-5 text-slate-900 dark:text-white">
                  {recommendation}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {recommendationReason}
                </p>
              </div>

              <div className="min-w-0 border-t border-slate-200 pt-4 dark:border-slate-800 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Recommended HR Follow-up
                </p>

                <p className="mt-1.5 text-sm font-black leading-5 text-slate-900 dark:text-white">
                  {recommendedFollowUp}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {followUpReason}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Assessment confidence:
              </span>

              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${getDecisionConfidenceClasses(
                  assessmentConfidence
                )}`}
              >
                <FiZap size={12} aria-hidden="true" />
                {assessmentConfidence}
              </span>
            </div>
          </section>

          <section>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                HR Decision
              </h3>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Choose the action that reflects HR's review.
              </p>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <ChoiceButton
                active={decisionChoice === "accept"}
                icon={<FiThumbsUp aria-hidden="true" />}
                title="Accept Recommendation"
                description="Use the recommended HR follow-up as the final action."
                tone="accept"
                onClick={() =>
                  handleDecisionChoice("accept")
                }
              />

              <ChoiceButton
                active={decisionChoice === "modify"}
                icon={<FiEdit3 aria-hidden="true" />}
                title="Modify HR Action"
                description="Choose a different final action after HR review."
                tone="modify"
                onClick={() =>
                  handleDecisionChoice("modify")
                }
              />

              <ChoiceButton
                active={decisionChoice === "reject"}
                icon={<FiXCircle aria-hidden="true" />}
                title="Reject Recommendation"
                description="Do not proceed with the recommendation and record the reason."
                tone="reject"
                onClick={() =>
                  handleDecisionChoice("reject")
                }
              />
            </div>
          </section>

          {decisionChoice && (
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/30">
              <div>
                <label
                  htmlFor="kpi-final-hr-action"
                  className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Final HR Action
                </label>

                <select
                  id="kpi-final-hr-action"
                  value={finalAction}
                  disabled={
                    decisionChoice === "accept" ||
                    decisionChoice === "reject" ||
                    isPending
                  }
                  className={INPUT_CLASS_NAME}
                  onChange={(event) =>
                    setFinalAction(event.target.value)
                  }
                >
                  {FINAL_ACTION_OPTIONS.map((option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  ))}
                </select>

                {decisionChoice === "accept" && (
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    The recommended HR follow-up will be recorded as the final action.
                  </p>
                )}

                {decisionChoice === "modify" && (
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Select the final action decided by HR. The original recommendation will remain in the review record.
                  </p>
                )}

                {decisionChoice === "reject" && (
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    No action will be recorded from this recommendation. HR notes are required to explain the decision.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <label
                  htmlFor="kpi-hr-decision-notes"
                  className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  HR Notes{" "}
                  {decisionChoice === "reject"
                    ? "(Required)"
                    : "(Optional)"}
                </label>

                <textarea
                  id="kpi-hr-decision-notes"
                  value={notes}
                  rows={4}
                  disabled={isPending}
                  placeholder={
                    decisionChoice === "reject"
                      ? "Explain why HR rejected the recommendation..."
                      : "Add HR review notes..."
                  }
                  className={`${INPUT_CLASS_NAME} resize-y font-normal`}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                />
              </div>
            </section>
          )}

          {isRejectMissingNotes && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300"
            >
              Please add HR notes before saving a rejected recommendation.
            </div>
          )}

          {createDecisionMutation.isError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300"
            >
              {createDecisionMutation.error?.message ||
                "The HR decision could not be saved. Please try again."}
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
            <FiShield
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <p className="text-xs leading-5">
              The recommendation is provided to support HR review. The authorized HR reviewer is responsible for validating the information and recording the final decision.
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function PendingRecommendationCard({
  employee,
  canManageDecisions,
  onReview,
}) {
  const recommendation =
    employee?.recommendation ||
    RECOMMENDATION_LABELS.RETAIN;

  const recommendedFollowUp =
    employee?.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeeNumberBadge value={employee.id} />

            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-slate-900 dark:text-white">
                {employee.name || "Unknown Employee"}
              </h3>

              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {employee.company || "Unassigned"}
              </p>
            </div>
          </div>

          {canManageDecisions && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<FiFileText />}
              onClick={() => onReview(employee)}
            >
              Review Recommendation
            </Button>
          )}
        </div>

        <div className="grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,1.05fr)]">
          <div className="rounded-xl bg-slate-50/70 p-3 dark:bg-slate-950/30">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReviewFact label="KPI Standing">
                <KPIBadge
                  level={
                    employee.kpiLevel ||
                    "Good Standing"
                  }
                />
              </ReviewFact>

              <ReviewFact label="Risk Level">
                <RiskBadge
                  level={
                    employee.riskLevel ||
                    "Low Risk"
                  }
                />
              </ReviewFact>

              <div className="col-span-2 flex items-center justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Recorded Violations
                </p>

                <span className="text-base font-black text-slate-900 dark:text-white">
                  {Number(employee.violationCount || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="min-w-0 border-t border-slate-200 pt-4 dark:border-slate-800 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Recommendation
            </p>

            <p className="mt-1.5 text-sm font-black leading-5 text-slate-900 dark:text-white">
              {recommendation}
            </p>

            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {employee.recommendationReason ||
                employee.correctiveActionReason ||
                "No recommendation explanation is available."}
            </p>
          </div>

          <div className="min-w-0 border-t border-slate-200 pt-4 dark:border-slate-800 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Recommended HR Follow-up
            </p>

            <p className="mt-1.5 text-sm font-black leading-5 text-slate-900 dark:text-white">
              {recommendedFollowUp}
            </p>

            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {employee.suggestedHRActionReason ||
                employee.decisionConfidenceReason ||
                "No follow-up explanation is available."}
            </p>
          </div>
        </div>

        {!canManageDecisions && (
          <p className="border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            This recommendation is available for viewing. An authorized HR Manager records the final HR decision.
          </p>
        )}
      </div>
    </article>
  );
}

export default function RecommendationReviewSection({
  employees = [],
  user,
  onDecisionSaved,
  onOpenDecisionHistory,
  canManageDecisions = false,
}) {
  const [search, setSearch] = useState("");

  const [selectedEmployee, setSelectedEmployee] =
    useState(null);

  const [refreshError, setRefreshError] =
    useState("");

  const safeEmployees = useMemo(
    () =>
      Array.isArray(employees)
        ? employees.filter(Boolean)
        : [],
    [employees]
  );

  const {
    data: decisionSnapshotData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useKPIDecisionLatestQuery();

  const decisionHistory = useMemo(
    () =>
      Array.isArray(
        decisionSnapshotData?.decisions
      )
        ? decisionSnapshotData.decisions
        : [],
    [decisionSnapshotData]
  );

  const allPendingEmployees = useMemo(() => {
    return safeEmployees
      .filter(isPendingRecommendation)
      .filter(
        (employee) =>
          !hasCurrentKPIDecisionReview(
            employee,
            decisionHistory
          )
      )
      .sort((first, second) => {
        const firstScore =
          Number(first.severityScore || 0) +
          Number(first.violationCount || 0) +
          Number(
            first.criticalIncidentCount || 0
          ) *
            3;

        const secondScore =
          Number(second.severityScore || 0) +
          Number(second.violationCount || 0) +
          Number(
            second.criticalIncidentCount || 0
          ) *
            3;

        return secondScore - firstScore;
      });
  }, [safeEmployees, decisionHistory]);

  const pendingEmployees = useMemo(() => {
    const normalizedSearch =
      normalizeSearchText(search);

    const searchTerms = normalizedSearch
      ? normalizedSearch.split(/\s+/)
      : [];

    if (searchTerms.length === 0) {
      return allPendingEmployees;
    }

    return allPendingEmployees.filter(
      (employee) => {
        const searchableText =
          normalizeSearchText(
            [
              employee.name,
              employee.id,
              formatEmployeeId(employee.id),
              employee.company,
              employee.kpiLevel,
              employee.riskLevel,
              employee.decisionConfidence,
              employee.suggestedHRAction,
              employee.recommendation,
              employee.recommendationReason,
              employee.correctiveActionReason,
              employee.suggestedHRActionReason,
              employee.decisionConfidenceReason,
              employee.correctiveActionBasis,
              employee.violationCount,
              employee.criticalIncidentCount,
              employee.severityScore,
            ]
              .filter(
                (value) =>
                  value !== null &&
                  value !== undefined &&
                  value !== ""
              )
              .join(" ")
          );

        return searchTerms.every((term) =>
          searchableText.includes(term)
        );
      }
    );
  }, [allPendingEmployees, search]);

  const pageError =
    refreshError || error?.message || "";

  const hasSearch = Boolean(search.trim());

  async function handleRefresh() {
    if (isFetching) return;

    setRefreshError("");

    try {
      const result = await refetch();

      if (result?.isError || result?.error) {
        setRefreshError(
          result?.error?.message ||
            "Unable to refresh recommendations."
        );
      }
    } catch (refreshRequestError) {
      console.error(
        "Recommendation review refresh error:",
        refreshRequestError
      );

      setRefreshError(
        refreshRequestError?.message ||
          "Unable to refresh recommendations."
      );
    }
  }

  async function handleSaved(record) {
    setSelectedEmployee(null);
    setSearch("");
    setRefreshError("");

    onDecisionSaved?.(record);

    try {
      await refetch();
    } catch (refreshRequestError) {
      console.error(
        "Recommendation refresh after save error:",
        refreshRequestError
      );
    }
  }

  return (
    <>
      <section
        className="space-y-4"
        aria-labelledby="recommendation-review-title"
        aria-busy={isLoading || isFetching}
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2
                id="recommendation-review-title"
                className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white"
              >
                <FiShield
                  className="text-indigo-600 dark:text-indigo-300"
                  aria-hidden="true"
                />
                Recommendation Review
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Review employee recommendations that are waiting for HR validation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-300">
                  {isLoading
                    ? "..."
                    : error
                    ? "—"
                    : allPendingEmployees.length}
                </span>

                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  waiting for review
                </span>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={
                  <FiClock aria-hidden="true" />
                }
                onClick={
                  onOpenDecisionHistory
                }
              >
                Decision History
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <SearchInput
                label="Search recommendations"
                hideLabel
                placeholder="Search employee, company, recommendation, KPI, or risk..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                onClear={() => setSearch("")}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {pendingEmployees.length} recommendation(s)
              </span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!hasSearch}
                onClick={() => setSearch("")}
              >
                Clear Search
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={
                  <FiRefreshCw
                    className={
                      isFetching
                        ? "animate-spin"
                        : ""
                    }
                  />
                }
                loading={isFetching}
                disabled={isFetching}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            Use Decision History to review completed HR decisions and recorded actions.
          </p>
        </div>

        {pageError && (
          <ErrorState
            compact
            title="Recommendation review error"
            message={pageError}
            retryLabel="Reload recommendations"
            onRetry={
              isFetching
                ? undefined
                : handleRefresh
            }
          />
        )}

        {isLoading ? (
          <LoadingSkeleton
            rows={5}
            columns={4}
            showHeader
          />
        ) : error ? null : pendingEmployees.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <EmptyState
              icon={
                hasSearch ? "search" : "records"
              }
              title={
                hasSearch
                  ? "No recommendations matched"
                  : "No recommendations waiting for review"
              }
              description={
                hasSearch
                  ? "No pending recommendations matched your search."
                  : "There are no employee recommendations waiting for HR validation. Use Decision History to review completed HR decisions."
              }
              secondaryActionLabel={
                hasSearch ? "Clear search" : ""
              }
              onSecondaryAction={
                hasSearch
                  ? () => setSearch("")
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="grid gap-3">
            {pendingEmployees.map((employee) => (
              <PendingRecommendationCard
                key={employee.id}
                employee={employee}
                canManageDecisions={
                  canManageDecisions
                }
                onReview={
                  setSelectedEmployee
                }
              />
            ))}
          </div>
        )}

        {isFetching && !isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"
          >
            <FiRefreshCw
              className="animate-spin"
              aria-hidden="true"
            />

            Updating recommendations...
          </div>
        )}
      </section>

      {selectedEmployee && canManageDecisions && (
        <ReviewRecommendationModal
          key={selectedEmployee.id}
          employee={selectedEmployee}
          user={user}
          onClose={() =>
            setSelectedEmployee(null)
          }
          onSaved={handleSaved}
        />
      )}
    </>
  );
}