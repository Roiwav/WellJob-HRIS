
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
import FilterBar from "../../ui/FilterBar";
import LoadingSkeleton from "../../ui/LoadingSkeleton";
import SearchInput from "../../ui/SearchInput";

import {
  DECISION_CONFIDENCE,
  HR_ACTION_WORKFLOW,
  RECOMMENDATION_LABELS,
  WELLJOB_LOW_KPI_ACTIONS,
  getDecisionConfidenceClasses,
  getSuggestedHRActionClasses,
  hasCurrentKPIDecisionReview,
} from "../../../utils/kpi/kpiHelpers";

import {
  useCreateKPIDecisionMutation,
  useKPIDecisionLatestQuery,
  useKPIDecisionHistoryPageQuery,
} from "../../../hooks/useKPIDecisionQueries";

// ======================================================
// CONFIGURATION
// ======================================================

const HISTORY_PAGE_SIZE = 20;

const REVIEW_VIEWS = [
  {
    id: "Pending",
    label: "Pending",
    icon: FiClock,
  },
  {
    id: "Accepted",
    label: "Accepted",
    icon: FiCheckCircle,
  },
  {
    id: "Modified",
    label: "Modified",
    icon: FiEdit3,
  },
  {
    id: "Rejected",
    label: "Rejected",
    icon: FiXCircle,
  },
];

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
  "w-full rounded-2xl border border-slate-300",
  "bg-white px-4 py-3 text-sm font-semibold",
  "text-slate-700 outline-none transition",
  "focus:border-indigo-500",
  "focus:ring-4 focus:ring-indigo-500/10",
  "disabled:cursor-not-allowed",
  "disabled:bg-slate-100",
  "disabled:text-slate-500",
  "dark:border-slate-700",
  "dark:bg-slate-950",
  "dark:text-slate-200",
  "dark:disabled:bg-slate-800",
].join(" ");

const CARD_CLASS_NAME =
  "rounded-3xl border border-slate-200 bg-white " +
  "p-5 shadow-sm dark:border-slate-800 " +
  "dark:bg-slate-900";

// ======================================================
// SHARED HELPERS
// ======================================================

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

function getInitials(name) {
  return String(name || "Employee")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getDecisionTypeClasses(type) {
  switch (type) {
    case "Accepted":
      return (
        "border-emerald-200 bg-emerald-50 " +
        "text-emerald-700 dark:border-emerald-900/60 " +
        "dark:bg-emerald-950/20 dark:text-emerald-300"
      );

    case "Modified":
      return (
        "border-amber-200 bg-amber-50 " +
        "text-amber-700 dark:border-amber-900/60 " +
        "dark:bg-amber-950/20 dark:text-amber-300"
      );

    case "Rejected":
      return (
        "border-red-200 bg-red-50 " +
        "text-red-700 dark:border-red-900/60 " +
        "dark:bg-red-950/20 dark:text-red-300"
      );

    default:
      return (
        "border-slate-200 bg-slate-50 " +
        "text-slate-700 dark:border-slate-800 " +
        "dark:bg-slate-950/40 dark:text-slate-300"
      );
  }
}

function StatusBadge({
  children,
  className = "",
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1",
        "rounded-full border px-2.5 py-1",
        "text-[11px] font-extrabold",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

// ======================================================
// HR DECISION MODAL
// Preserves existing Accept / Modify / Reject workflow
// ======================================================

function DecisionModal({
  employee,
  mode,
  user,
  onClose,
  onSaved,
}) {
  const createDecisionMutation =
    useCreateKPIDecisionMutation();

  const systemRecommendation =
    employee?.recommendation ||
    RECOMMENDATION_LABELS.RETAIN;

  const systemSuggestedAction =
    employee?.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  const [finalAction, setFinalAction] = useState(
    () => {
      if (mode === "reject") {
        return "No Action Required";
      }

      if (mode === "modify") {
        return systemRecommendation;
      }

      return systemSuggestedAction;
    }
  );

  const [notes, setNotes] = useState("");

  const modeConfig = {
    accept: {
      title: "Accept System Suggestion",
      icon: <FiThumbsUp aria-hidden="true" />,
      tone: "success",
      buttonLabel: "Accept Recommendation",
      buttonVariant: "success",
      decisionType: "Accepted",
      panelClassName:
        "border-emerald-200 bg-emerald-50 text-emerald-700 " +
        "dark:border-emerald-900/60 dark:bg-emerald-950/20 " +
        "dark:text-emerald-300",
    },

    modify: {
      title: "Modify Final HR Action",
      icon: <FiEdit3 aria-hidden="true" />,
      tone: "warning",
      buttonLabel: "Save Modified Action",
      buttonVariant: "primary",
      decisionType: "Modified",
      panelClassName:
        "border-amber-200 bg-amber-50 text-amber-700 " +
        "dark:border-amber-900/60 dark:bg-amber-950/20 " +
        "dark:text-amber-300",
    },

    reject: {
      title: "Reject System Suggestion",
      icon: <FiXCircle aria-hidden="true" />,
      tone: "warning",
      buttonLabel: "Reject Recommendation",
      buttonVariant: "warning",
      decisionType: "Rejected",
      panelClassName:
        "border-red-200 bg-red-50 text-red-700 " +
        "dark:border-red-900/60 dark:bg-red-950/20 " +
        "dark:text-red-300",
    },
  };

  const config =
    modeConfig[mode] || modeConfig.accept;

  const isPending =
    createDecisionMutation.isPending;

  const isRejectMissingNotes =
    mode === "reject" && !notes.trim();

  const isFinalActionMissing =
    !String(finalAction || "").trim();

  async function handleSave() {
    if (
      !employee ||
      !employee.id ||
      isPending ||
      isRejectMissingNotes ||
      isFinalActionMissing
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

      suggestedHRAction: systemSuggestedAction,

      systemRecommendation,

      finalAction,

      decisionType: config.decisionType,

      notes:
        notes.trim() ||
        `${config.decisionType} based on HR review of the system-generated recommendation.`,

      decidedBy:
        user?.name ||
        user?.username ||
        "HR User",

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
        config.decisionType
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
      title={config.title}
      description="Record the authorized HR decision for this employee."
      tone={config.tone}
      size="lg"
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
            variant={config.buttonVariant}
            leftIcon={config.icon}
            loading={isPending}
            disabled={
              isPending ||
              isRejectMissingNotes ||
              isFinalActionMissing
            }
            onClick={handleSave}
          >
            {config.buttonLabel}
          </Button>
        </>
      }
    >
      {employee && (
        <div className="space-y-5">
          <section
            className={[
              "rounded-2xl border p-4",
              config.panelClassName,
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-lg dark:bg-slate-950/30"
                aria-hidden="true"
              >
                {config.icon}
              </div>

              <div>
                <p className="font-extrabold">
                  {config.title}
                </p>

                <p className="mt-1 text-xs font-semibold opacity-80">
                  Review the system output before
                  recording the final HR decision.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {getInitials(employee.name)}
              </div>

              <div className="min-w-0">
                <p className="font-extrabold text-slate-900 dark:text-white">
                  {employee.name || "Unknown Employee"}
                </p>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Employee ID:{" "}
                  {formatEmployeeId(employee.id)}
                  {" • "}
                  {employee.company || "Unassigned"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-3 text-xs dark:bg-slate-900">
                <p className="font-extrabold uppercase tracking-wide text-slate-400">
                  System Recommendation
                </p>

                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {systemRecommendation}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 text-xs dark:bg-slate-900">
                <p className="font-extrabold uppercase tracking-wide text-slate-400">
                  Suggested Next Step
                </p>

                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {systemSuggestedAction}
                </p>
              </div>
            </div>
          </section>

          <div>
            <label
              htmlFor="kpi-final-hr-action"
              className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Final HR Action
            </label>

            <select
              id="kpi-final-hr-action"
              value={finalAction}
              disabled={mode === "accept" || isPending}
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

            {mode === "accept" && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                The system-suggested next step is
                recorded as the accepted HR action.
              </p>
            )}

            {mode === "modify" && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Select the action determined by HR.
                The original recommendation will
                remain in the decision record.
              </p>
            )}

            {mode === "reject" && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                The recommendation will be recorded
                as rejected, without automatically
                applying the suggested action.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="kpi-hr-decision-notes"
              className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              HR Notes{" "}
              {mode === "reject"
                ? "(Required)"
                : "(Optional)"}
            </label>

            <textarea
              id="kpi-hr-decision-notes"
              value={notes}
              rows={4}
              disabled={isPending}
              placeholder={
                mode === "reject"
                  ? "Explain why HR rejected the recommendation..."
                  : "Add HR validation notes..."
              }
              className={`${INPUT_CLASS_NAME} resize-y font-normal`}
              onChange={(event) =>
                setNotes(event.target.value)
              }
            />
          </div>

          {isRejectMissingNotes && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
            >
              Rejection requires HR notes for
              accountability.
            </div>
          )}

          {createDecisionMutation.isError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
            >
              {createDecisionMutation.error?.message ||
                "Failed to save KPI decision."}
            </div>
          )}

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
            <div className="flex items-start gap-3">
              <FiShield
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <p>
                The system recommendation is
                decision-support information.
                Final administrative actions
                require authorized HR validation.
              </p>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ======================================================
// PENDING RECOMMENDATION CARD
// ======================================================

function PendingRecommendationCard({
  employee,
  canManageDecisions,
  onSelectReview,
}) {
  const confidence =
    employee.decisionConfidence ||
    DECISION_CONFIDENCE.LOW;

  const suggestedHRAction =
    employee.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  return (
    <article className={CARD_CLASS_NAME}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            {getInitials(employee.name)}
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {employee.name || "Unknown Employee"}
            </h3>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ID: {formatEmployeeId(employee.id)}
              {" • "}
              {employee.company || "Unassigned"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                <FiClock size={12} />
                Pending Review
              </StatusBadge>

              <StatusBadge
                className={getDecisionConfidenceClasses(
                  confidence
                )}
              >
                <FiZap size={12} />
                {confidence}
              </StatusBadge>

              <StatusBadge
                className={getSuggestedHRActionClasses(
                  suggestedHRAction
                )}
              >
                <FiShield size={12} />
                {suggestedHRAction}
              </StatusBadge>

              <StatusBadge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <FiAlertCircle size={12} />
                {employee.violationCount || 0}{" "}
                incident(s)
              </StatusBadge>
            </div>
          </div>
        </div>

        {canManageDecisions && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="success"
              size="sm"
              leftIcon={<FiThumbsUp />}
              onClick={() =>
                onSelectReview(employee, "accept")
              }
            >
              Accept
            </Button>

            <Button
              type="button"
              variant="warning"
              size="sm"
              leftIcon={<FiEdit3 />}
              onClick={() =>
                onSelectReview(employee, "modify")
              }
            >
              Modify
            </Button>

            <Button
              type="button"
              variant="warning"
              size="sm"
              leftIcon={<FiXCircle />}
              onClick={() =>
                onSelectReview(employee, "reject")
              }
            >
              Reject
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <FiFileText />
            System Recommendation
          </p>

          <p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            {employee.recommendation ||
              "No recommendation available."}
          </p>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            {employee.recommendationReason ||
              employee.correctiveActionReason ||
              "No recommendation reason available."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <FiClock />
            Suggested Next Step
          </p>

          <p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            {suggestedHRAction}
          </p>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            {employee.suggestedHRActionReason ||
              employee.decisionConfidenceReason ||
              "No next-step reason available."}
          </p>
        </div>
      </div>
    </article>
  );
}

// ======================================================
// ACCEPTED / MODIFIED / REJECTED DECISION CARD
// ======================================================

function ReviewedDecisionCard({ record }) {
  const decisionType =
    record?.decisionType || "Recorded";

  const decisionConfidence =
    record?.decisionConfidence ||
    DECISION_CONFIDENCE.LOW;

  const suggestedHRAction =
    record?.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  return (
    <article className={CARD_CLASS_NAME}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            {getInitials(record?.employeeName)}
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {record?.employeeName ||
                "Unknown Employee"}
            </h3>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ID:{" "}
              {formatEmployeeId(
                record?.employeeId
              )}
              {" • "}
              {record?.company || "Unassigned"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge
                className={getDecisionTypeClasses(
                  decisionType
                )}
              >
                {decisionType === "Accepted" && (
                  <FiCheckCircle size={12} />
                )}

                {decisionType === "Modified" && (
                  <FiEdit3 size={12} />
                )}

                {decisionType === "Rejected" && (
                  <FiXCircle size={12} />
                )}

                {decisionType}
              </StatusBadge>

              <StatusBadge
                className={getDecisionConfidenceClasses(
                  decisionConfidence
                )}
              >
                <FiZap size={12} />
                {decisionConfidence}
              </StatusBadge>

              <StatusBadge
                className={getSuggestedHRActionClasses(
                  suggestedHRAction
                )}
              >
                <FiShield size={12} />
                {suggestedHRAction}
              </StatusBadge>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <FiClock size={14} />
            {formatDateTime(
              record?.decidedAt ||
                record?.createdAt
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Original System Recommendation
          </p>

          <p className="mt-2 text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">
            {record?.systemRecommendation || "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Final HR Action
          </p>

          <p className="mt-2 text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">
            {record?.finalAction || "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Decided By
          </p>

          <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            {record?.decidedBy || "HR User"}
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {record?.decidedByRole ||
              "Authorized User"}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
        <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <FiFileText />
          HR Decision Notes
        </p>

        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">
          {record?.notes ||
            "No HR notes recorded."}
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          Decision Basis Snapshot
        </p>

        <p className="text-sm leading-7 text-indigo-700/90 dark:text-indigo-300/90">
          {record?.correctiveActionBasis ||
            record?.suggestedHRActionReason ||
            record?.decisionConfidenceReason ||
            record?.recommendationReason ||
            "No decision basis snapshot available."}
        </p>
      </div>
    </article>
  );
}

// ======================================================
// MAIN RECOMMENDATION REVIEW SECTION
// ======================================================

export default function RecommendationReviewSection({
  employees = [],
  user,
  onDecisionSaved,
  canManageDecisions = false,
}) {
  const [activeView, setActiveView] =
    useState("Pending");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [selectedReview, setSelectedReview] =
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

  // Current decision snapshots are used ONLY
  // to determine the current pending queue.
  const {
    data: decisionSnapshotData,
    isLoading: isLatestLoading,
    isFetching: isLatestFetching,
    error: latestError,
    refetch: refetchLatest,
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

  const recordedDecisionCount = Number(
    decisionSnapshotData?.total || 0
  );

  // Reviewed records are loaded from the existing
  // paginated backend decision-history endpoint.
  const {
    data: reviewedData,
    isLoading: isReviewedLoading,
    isFetching: isReviewedFetching,
    error: reviewedError,
    refetch: refetchReviewed,
  } = useKPIDecisionHistoryPageQuery(
    {
      page,
      pageSize: HISTORY_PAGE_SIZE,
      search: search.trim(),
      decisionType:
        activeView === "Pending"
          ? "ALL"
          : activeView,
    },
    {
      enabled: activeView !== "Pending",
    }
  );

  const reviewedRecords = useMemo(
    () =>
      Array.isArray(reviewedData?.records)
        ? reviewedData.records.filter(Boolean)
        : [],
    [reviewedData]
  );

  const pagination = reviewedData?.pagination || {
    page,
    pageSize: HISTORY_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

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

  const isPendingView =
    activeView === "Pending";

  const isLoading = isPendingView
    ? isLatestLoading
    : isReviewedLoading;

  const isFetching = isPendingView
    ? isLatestFetching
    : isReviewedFetching;

  const currentError = isPendingView
    ? latestError
    : reviewedError;

  const pageError =
    refreshError || currentError?.message || "";

  const hasSearch = Boolean(search.trim());

  // Switch between Pending / Accepted /
  // Modified / Rejected without changing
  // the saved decision records.
  function handleChangeView(nextView) {
    setActiveView(nextView);
    setSearch("");
    setPage(1);
    setRefreshError("");
    setSelectedReview(null);
  }

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setPage(1);
  }

  function handleSelectReview(employee, mode) {
    if (!canManageDecisions) return;

    setSelectedReview({
      employee,
      mode,
    });
  }

  function handleSaved(record, decisionType) {
    setSelectedReview(null);
    setSearch("");
    setPage(1);
    setRefreshError("");

    // After a successful save, show the record
    // in its corresponding reviewed-decision view.
    if (
      ["Accepted", "Modified", "Rejected"].includes(
        decisionType
      )
    ) {
      setActiveView(decisionType);
    }

    onDecisionSaved?.(record);
  }

  async function handleRefresh() {
    if (isFetching) return;

    setRefreshError("");

    try {
      const result = isPendingView
        ? await refetchLatest()
        : await refetchReviewed();

      if (result?.isError || result?.error) {
        setRefreshError(
          result?.error?.message ||
            "Unable to refresh recommendation records."
        );
      }
    } catch (error) {
      console.error(
        "Recommendation review refresh error:",
        error
      );

      setRefreshError(
        error?.message ||
          "Unable to refresh recommendation records."
      );
    }
  }

  return (
    <>
      <section
        className="space-y-5"
        aria-labelledby="recommendation-review-title"
        aria-busy={isLoading || isFetching}
      >
        {/* HEADER */}

        <div className={CARD_CLASS_NAME}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2
                id="recommendation-review-title"
                className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white"
              >
                <FiShield className="text-indigo-600 dark:text-indigo-300" />

                Recommendation Review
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Review pending recommendations and
                view accepted, modified, or rejected
                HR decisions.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Pending
                </p>

                <p className="mt-1 text-xl font-extrabold">
                  {isLatestLoading
                    ? "..."
                    : latestError
                      ? "—"
                      : allPendingEmployees.length}
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Recorded
                </p>

                <p className="mt-1 text-xl font-extrabold">
                  {isLatestLoading
                    ? "..."
                    : latestError
                      ? "—"
                      : recordedDecisionCount}
                </p>
              </div>
            </div>
          </div>

          {/* FOUR REVIEW VIEWS */}

          <div
            role="group"
            aria-label="Recommendation review status"
            className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4"
          >
            {REVIEW_VIEWS.map((view) => {
              const Icon = view.icon;

              const isActive =
                activeView === view.id;

              return (
                <button
                  key={view.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    handleChangeView(view.id)
                  }
                  className={[
                    "flex items-center justify-center",
                    "gap-2 rounded-2xl border px-4 py-3",
                    "text-sm font-bold transition",
                    "focus:outline-none",
                    "focus-visible:ring-4",
                    "focus-visible:ring-indigo-500/20",

                    isActive
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-800",
                  ].join(" ")}
                >
                  <Icon
                    size={16}
                    aria-hidden="true"
                  />

                  <span>{view.label}</span>

                  {view.id === "Pending" &&
                    !isLatestLoading &&
                    !latestError &&
                    allPendingEmployees.length > 0 && (
                      <span
                        className={[
                          "rounded-full px-2 py-0.5",
                          "text-[10px] font-extrabold",

                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                        ].join(" ")}
                      >
                        {allPendingEmployees.length}
                      </span>
                    )}
                </button>
              );
            })}
          </div>

          {/* SEARCH AND REFRESH */}

          <div className="mt-5">
            <FilterBar
              resultCount={
                isPendingView
                  ? pendingEmployees.length
                  : Number(
                      pagination.total || 0
                    )
              }
              resultLabel={
                isPendingView
                  ? "recommendation"
                  : "decision record"
              }
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!hasSearch}
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
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
                </>
              }
            >
              <div className="w-full sm:col-span-2 xl:w-[520px]">
                <SearchInput
                  label="Search recommendation records"
                  hideLabel
                  placeholder={
                    isPendingView
                      ? "Search pending employees, company, action, or risk..."
                      : `Search ${activeView.toLowerCase()} decisions, employee, reviewer, or notes...`
                  }
                  value={search}
                  onChange={handleSearchChange}
                  onClear={() => {
                    setSearch("");
                    setPage(1);
                  }}
                />
              </div>
            </FilterBar>
          </div>
        </div>

        {/* REQUEST ERROR */}

        {pageError && (
          <ErrorState
            compact
            title="Recommendation review error"
            message={pageError}
            retryLabel="Reload records"
            onRetry={
              isFetching
                ? undefined
                : handleRefresh
            }
          />
        )}

        {/* RECORDS */}

        {isLoading ? (
          <LoadingSkeleton
            rows={5}
            columns={4}
            showHeader
          />
        ) : currentError ? null : isPendingView ? (
          // PENDING RECOMMENDATIONS

          pendingEmployees.length === 0 ? (
            <div className={CARD_CLASS_NAME}>
              <EmptyState
                icon={
                  hasSearch ? "search" : "records"
                }
                title={
                  hasSearch
                    ? "No recommendations matched"
                    : "No pending recommendations"
                }
                description={
                  hasSearch
                    ? "No pending recommendations matched your search."
                    : "There are no current recommendations awaiting HR validation. Previously reviewed decisions remain available under Accepted, Modified, Rejected, and Decision History."
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
            <div className="grid gap-4">
              {pendingEmployees.map((employee) => (
                <PendingRecommendationCard
                  key={employee.id}
                  employee={employee}
                  canManageDecisions={
                    canManageDecisions
                  }
                  onSelectReview={
                    handleSelectReview
                  }
                />
              ))}
            </div>
          )
        ) : (
          // ACCEPTED / MODIFIED / REJECTED

          <>
            {reviewedRecords.length === 0 ? (
              <div className={CARD_CLASS_NAME}>
                <EmptyState
                  icon={
                    hasSearch ? "search" : "records"
                  }
                  title={
                    hasSearch
                      ? `No ${activeView.toLowerCase()} decisions matched`
                      : `No ${activeView.toLowerCase()} decisions recorded`
                  }
                  description={
                    hasSearch
                      ? "No saved HR decisions matched the current search."
                      : `Saved ${activeView.toLowerCase()} decisions will appear here after HR completes the recommendation review.`
                  }
                  secondaryActionLabel={
                    hasSearch
                      ? "Clear search"
                      : ""
                  }
                  onSecondaryAction={
                    hasSearch
                      ? () => {
                          setSearch("");
                          setPage(1);
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="grid gap-4">
                {reviewedRecords.map((record) => (
                  <ReviewedDecisionCard
                    key={record.id}
                    record={record}
                  />
                ))}
              </div>
            )}

            {/* PAGINATION */}

            {Number(pagination.total || 0) > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Page {pagination.page || page} of{" "}
                  {pagination.totalPages || 1}
                  {" • "}
                  {pagination.total || 0}{" "}
                  {activeView.toLowerCase()} decision
                  record(s)
                </p>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={
                      isFetching || page <= 1
                    }
                    onClick={() =>
                      setPage((currentPage) =>
                        Math.max(
                          1,
                          currentPage - 1
                        )
                      )
                    }
                  >
                    Previous
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={
                      isFetching ||
                      page >=
                        Number(
                          pagination.totalPages || 1
                        )
                    }
                    onClick={() =>
                      setPage((currentPage) =>
                        Math.min(
                          Number(
                            pagination.totalPages ||
                              1
                          ),
                          currentPage + 1
                        )
                      )
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {isFetching && !isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400"
          >
            <FiRefreshCw
              className="animate-spin"
              aria-hidden="true"
            />

            Updating recommendation records...
          </div>
        )}
      </section>

      {/* DECISION MODAL */}

      {selectedReview && canManageDecisions && (
        <DecisionModal
          key={`${selectedReview.employee.id}-${selectedReview.mode}`}
          employee={selectedReview.employee}
          mode={selectedReview.mode}
          user={user}
          onClose={() =>
            setSelectedReview(null)
          }
          onSaved={handleSaved}
        />
      )}
    </>
  );
}