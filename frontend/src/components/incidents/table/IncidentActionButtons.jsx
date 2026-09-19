import { useMemo } from "react";
import {
  FiAlertCircle,
  FiEye,
  FiLock,
  FiPlay,
  FiUpload,
  FiUserCheck,
} from "react-icons/fi";

const STATUS = {
  OPEN: "open",
  INVESTIGATING: "investigating",
  FOR_REVIEW: "for review",
  CLOSED: "closed",
};

const INVESTIGATOR_ROLES = new Set([
  "HR_MANAGER",
  "HR_STAFF",
]);

const REVIEWER_ROLES = new Set([
  "HR_MANAGER",
  "SUPER_ADMIN",
]);

const ACTION_BUTTON_STYLES = {
  view:
    "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:ring-slate-500/30 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",

  start:
    "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 focus-visible:ring-amber-500/30 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50",

  resolve:
    "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 focus-visible:ring-emerald-500/30 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50",

  review:
    "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-800 focus-visible:ring-indigo-500/30 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50",
};

function normalizeIdentity(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeRole(value) {
  const role =
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  if (
    role === "SUPERADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "ADMIN"
  ) {
    return "SUPER_ADMIN";
  }

  if (
    role === "HRMANAGER" ||
    role === "HR_MANAGER"
  ) {
    return "HR_MANAGER";
  }

  if (
    role === "HRSTAFF" ||
    role === "HR_STAFF"
  ) {
    return "HR_STAFF";
  }

  if (
    role === "HRCOORDINATOR" ||
    role === "HR_COORDINATOR"
  ) {
    return "HR_COORDINATOR";
  }

  if (
    role === "ITSUPPORT" ||
    role === "IT_SUPPORT"
  ) {
    return "IT_SUPPORT";
  }

  return role;
}

function normalizeStatus(value) {
  return normalizeIdentity(
    value
  )
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
}

function buildUserAliases(user) {
  return new Set(
    [
      user?.id,
      user?.userId,
      user?.user_id,
      user?.employeeId,
      user?.employee_id,
      user?.username,
      user?.email,
      user?.name,
      user?.fullName,
      user?.full_name,
      user?.fullname,
      user?.displayName,
      user?.display_name,
    ]
      .map(
        normalizeIdentity
      )
      .filter(
        Boolean
      )
  );
}

function hasAliasMatch(
  aliases,
  values = []
) {
  if (
    !(aliases instanceof Set) ||
    aliases.size === 0
  ) {
    return false;
  }

  return values.some(
    (value) => {
      const normalizedValue =
        normalizeIdentity(
          value
        );

      return (
        normalizedValue &&
        aliases.has(
          normalizedValue
        )
      );
    }
  );
}

function getLastActionType(
  incident
) {
  return normalizeIdentity(
    incident?.lastActionType ||
      incident?.last_action_type
  ).toUpperCase();
}

function getInvestigatorValues(
  incident
) {
  const lastActionType =
    getLastActionType(
      incident
    );

  const lastActionValues =
    lastActionType ===
    "START_INVESTIGATION"
      ? [
          incident
            ?.lastActionById,
          incident
            ?.last_action_by_id,
          incident
            ?.lastActionByUsername,
          incident
            ?.last_action_by_username,
          incident
            ?.lastActionByName,
          incident
            ?.last_action_by_name,
        ]
      : [];

  return [
    incident
      ?.investigation
      ?.startedById,

    incident
      ?.investigation
      ?.started_by_id,

    incident
      ?.investigation
      ?.startedByUsername,

    incident
      ?.investigation
      ?.started_by_username,

    incident
      ?.investigation
      ?.startedByName,

    incident
      ?.investigation
      ?.started_by_name,

    incident
      ?.investigationStartedById,

    incident
      ?.investigation_started_by_id,

    incident
      ?.investigationStartedByUsername,

    incident
      ?.investigation_started_by_username,

    incident
      ?.investigationStartedByName,

    incident
      ?.investigation_started_by_name,

    ...lastActionValues,
  ].filter(
    Boolean
  );
}

function getInvestigatorName(
  incident
) {
  const lastActionType =
    getLastActionType(
      incident
    );

  return (
    incident
      ?.investigation
      ?.startedByName ||
    incident
      ?.investigation
      ?.started_by_name ||
    incident
      ?.investigationStartedByName ||
    incident
      ?.investigation_started_by_name ||
    (
      lastActionType ===
      "START_INVESTIGATION"
        ? incident
            ?.lastActionByName ||
          incident
            ?.last_action_by_name
        : ""
    ) ||
    "Assigned HR"
  );
}

function ActionButton({
  icon,
  title,
  variant = "view",
  onClick,
  disabled = false,
}) {
  const variantStyle =
    ACTION_BUTTON_STYLES[
      variant
    ] ||
    ACTION_BUTTON_STYLES.view;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm shadow-sm transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${variantStyle}`}
    >
      {icon}
    </button>
  );
}

function DisabledActionPill({
  icon,
  label,
  title,
}) {
  return (
    <span
      role="status"
      title={
        title ||
        label
      }
      className="inline-flex max-w-[190px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
    >
      <span
        className="shrink-0"
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="truncate">
        {label}
      </span>
    </span>
  );
}

export default function ActionButtons({
  incident,
  isSuperAdmin = false,
  currentUser,
  onView,
  onStartReview,
  onResolve,
  onReview,
}) {
  const status =
    normalizeStatus(
      incident?.status
    );

  const currentRole =
    normalizeRole(
      currentUser?.role
    );

  /*
   * ==================================================
   * INCIDENT ROLE CAPABILITIES
   * ==================================================
   *
   * HR_MANAGER:
   * - investigate
   * - submit proof
   * - review
   *
   * HR_STAFF:
   * - investigate
   * - submit proof
   *
   * SUPER_ADMIN:
   * - review only
   *
   * HR_COORDINATOR:
   * - view only from this action component
   * - incident creation is handled by the page
   * - no investigation
   * - no proof submission
   * - no case review
   */
  const isInvestigator =
    INVESTIGATOR_ROLES.has(
      currentRole
    );

  const isReviewer =
    isSuperAdmin ||
    REVIEWER_ROLES.has(
      currentRole
    );

  const isHrCoordinator =
    currentRole ===
    "HR_COORDINATOR";

  const investigatorName =
    getInvestigatorName(
      incident
    );

  const currentUserAliases =
    useMemo(
      () =>
        buildUserAliases(
          currentUser
        ),
      [
        currentUser,
      ]
    );

  const investigatorValues =
    useMemo(
      () =>
        getInvestigatorValues(
          incident
        ),
      [
        incident,
      ]
    );

  const currentUserIsInvestigator =
    useMemo(
      () =>
        hasAliasMatch(
          currentUserAliases,
          investigatorValues
        ),
      [
        currentUserAliases,
        investigatorValues,
      ]
    );

  if (!incident) {
    return null;
  }

  /*
   * Authorized reviewers receive the review action
   * only while the incident is waiting for review.
   */
  if (
    isReviewer &&
    status ===
      STATUS.FOR_REVIEW
  ) {
    return (
      <ActionButton
        icon={
          <FiAlertCircle
            size={15}
            aria-hidden="true"
          />
        }
        title="Review submitted case"
        variant="review"
        onClick={() =>
          onReview?.(
            incident
          )
        }
      />
    );
  }

  /*
   * Only HR Manager / HR Staff may start an
   * investigation.
   *
   * This intentionally prevents HR Coordinator from
   * receiving the action merely because the user is
   * not a Super Admin.
   */
  if (
    isInvestigator &&
    status ===
      STATUS.OPEN
  ) {
    return (
      <ActionButton
        icon={
          <FiPlay
            size={15}
            aria-hidden="true"
          />
        }
        title="Start investigation"
        variant="start"
        onClick={() =>
          onStartReview?.(
            incident
          )
        }
      />
    );
  }

  /*
   * Investigation proof submission remains available
   * only to HR Manager / HR Staff.
   */
  if (
    isInvestigator &&
    status ===
      STATUS.INVESTIGATING
  ) {
    if (
      currentUserIsInvestigator
    ) {
      return (
        <ActionButton
          icon={
            <FiUpload
              size={15}
              aria-hidden="true"
            />
          }
          title="Submit or resubmit resolution proof"
          variant="resolve"
          onClick={() =>
            onResolve?.(
              incident
            )
          }
        />
      );
    }

    return (
      <DisabledActionPill
        icon={
          <FiUserCheck
            size={14}
            aria-hidden="true"
          />
        }
        label={`Investigating by ${investigatorName}`}
        title={`This case is already being investigated by ${investigatorName}.`}
      />
    );
  }

  /*
   * Existing HR Staff behavior is preserved while a
   * submitted case is waiting for an authorized
   * reviewer.
   *
   * HR Coordinator remains able to open the record
   * because their role is explicitly view-only.
   */
  if (
    !isReviewer &&
    !isHrCoordinator &&
    status ===
      STATUS.FOR_REVIEW
  ) {
    return (
      <DisabledActionPill
        icon={
          <FiLock
            size={14}
            aria-hidden="true"
          />
        }
        label="Waiting for reviewer"
        title="This case has already been submitted to an authorized reviewer."
      />
    );
  }

  /*
   * HR Coordinator always falls through to View for:
   *
   * - Open
   * - Investigating
   * - For Review
   * - Closed
   *
   * No mutation callback is exposed.
   */
  return (
    <ActionButton
      icon={
        <FiEye
          size={15}
          aria-hidden="true"
        />
      }
      title={
        status ===
        STATUS.CLOSED
          ? "View closed incident details"
          : "View incident details"
      }
      variant="view"
      onClick={() =>
        onView?.(
          incident
        )
      }
    />
  );
}