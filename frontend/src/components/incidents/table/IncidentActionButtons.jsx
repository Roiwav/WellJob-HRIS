import {
  FiAlertCircle,
  FiEye,
  FiLock,
  FiPlay,
  FiUpload,
  FiUserCheck,
} from "react-icons/fi";

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

function buildUserAliases(user) {
  return new Set(
    [
      user?.id,
      user?.userId,
      user?.user_id,
      user?.username,
      user?.name,
      user?.fullName,
      user?.full_name,
      user?.fullname,
      user?.displayName,
      user?.display_name,
    ]
      .map(normalizeIdentity)
      .filter(Boolean)
  );
}

function hasAliasMatch(aliases, values = []) {
  if (!aliases || aliases.size === 0) return false;

  return values.some((value) => aliases.has(normalizeIdentity(value)));
}

function getInvestigatorValues(incident) {
  return [
    incident?.investigation?.startedById,
    incident?.investigation?.startedByUsername,
    incident?.investigation?.startedByName,

    incident?.investigationStartedById,
    incident?.investigation_started_by_id,

    incident?.investigationStartedByUsername,
    incident?.investigation_started_by_username,

    incident?.investigationStartedByName,
    incident?.investigation_started_by_name,

    incident?.lastActionType === "START_INVESTIGATION"
      ? incident?.lastActionById
      : null,
    incident?.last_action_type === "START_INVESTIGATION"
      ? incident?.last_action_by_id
      : null,

    incident?.lastActionType === "START_INVESTIGATION"
      ? incident?.lastActionByUsername
      : null,
    incident?.last_action_type === "START_INVESTIGATION"
      ? incident?.last_action_by_username
      : null,

    incident?.lastActionType === "START_INVESTIGATION"
      ? incident?.lastActionByName
      : null,
    incident?.last_action_type === "START_INVESTIGATION"
      ? incident?.last_action_by_name
      : null,
  ].filter(Boolean);
}

function getInvestigatorName(incident) {
  return (
    incident?.investigation?.startedByName ||
    incident?.investigationStartedByName ||
    incident?.investigation_started_by_name ||
    (incident?.lastActionType === "START_INVESTIGATION"
      ? incident?.lastActionByName
      : "") ||
    (incident?.last_action_type === "START_INVESTIGATION"
      ? incident?.last_action_by_name
      : "") ||
    "Assigned HR"
  );
}

function isCurrentUserInvestigator(incident, currentUser) {
  const investigatorValues = getInvestigatorValues(incident);

  if (investigatorValues.length === 0) {
    return false;
  }

  return hasAliasMatch(buildUserAliases(currentUser), investigatorValues);
}

function ActionButton({ icon, title, color, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm shadow-sm transition ${color}`}
    >
      {icon}
    </button>
  );
}

function DisabledActionPill({ icon, label, title }) {
  return (
    <span
      title={title || label}
      className="inline-flex max-w-[190px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

export default function ActionButtons({
  incident,
  isSuperAdmin,
  currentUser,
  onView,
  onStartReview,
  onResolve,
  onReview,
}) {
  const status = String(incident?.status || "").trim();
  const investigatorName = getInvestigatorName(incident);
  const currentUserIsInvestigator = isCurrentUserInvestigator(
    incident,
    currentUser
  );

  if (isSuperAdmin && status === "For Review") {
    return (
      <ActionButton
        icon={<FiAlertCircle size={15} />}
        title="Review submitted case"
        color="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
        onClick={() => onReview?.(incident)}
      />
    );
  }

  if (!isSuperAdmin && status === "Open") {
    return (
      <ActionButton
        icon={<FiPlay size={15} />}
        title="Start investigation"
        color="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
        onClick={() => onStartReview?.(incident)}
      />
    );
  }

  if (!isSuperAdmin && status === "Investigating") {
    if (currentUserIsInvestigator) {
      return (
        <ActionButton
          icon={<FiUpload size={15} />}
          title="Submit or resubmit proof"
          color="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          onClick={() => onResolve?.(incident)}
        />
      );
    }

    return (
      <DisabledActionPill
        icon={<FiUserCheck size={14} />}
        label={`Investigating by ${investigatorName}`}
        title={`This case is already being investigated by ${investigatorName}`}
      />
    );
  }

  if (!isSuperAdmin && status === "For Review") {
    return (
      <DisabledActionPill
        icon={<FiLock size={14} />}
        label="Waiting for SA review"
        title="This case is already submitted to Super Admin for review."
      />
    );
  }

  return (
    <ActionButton
      icon={<FiEye size={15} />}
      title="View incident details"
      color="border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      onClick={() => onView?.(incident)}
    />
  );
}