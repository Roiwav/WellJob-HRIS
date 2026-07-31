import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiInfo,
  FiPlayCircle,
  FiRotateCcw,
  FiSend,
  FiUser,
  FiX,
  FiZap,
} from "react-icons/fi";

function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function formatRole(value) {
  const role = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const labels = {
    HR_MANAGER: "HR Manager",
    HR_STAFF: "HR Staff",
    SUPER_ADMIN: "Super Admin",
    IT_SUPPORT: "IT Support",
  };

  return labels[role] || String(value || "").trim();
}

function formatActorIdentity({ name, username, role }) {
  const safeName = String(name || "").trim() || "Unknown User";
  const safeUsername = String(username || "").trim();
  const safeRole = formatRole(role);

  const usernameText =
    safeUsername &&
    safeUsername.toLowerCase() !== safeName.toLowerCase()
      ? ` (@${safeUsername.replace(/^@/, "")})`
      : "";

  const roleText = safeRole ? ` • ${safeRole}` : "";

  return `${safeName}${usernameText}${roleText}`;
}

function getAlertEvent(alert) {
  const status = normalizeValue(alert?.status);
  const workflowAction = String(
    alert?.workflowAction ||
      alert?.lastActionType ||
      alert?.last_action_type ||
      ""
  )
    .trim()
    .toUpperCase();

  const reviewDecision = normalizeValue(
    alert?.reviewDecision ||
      alert?.review_decision
  );

  if (
    workflowAction === "RETURN_INCIDENT" ||
    reviewDecision === "returned" ||
    reviewDecision === "rejected"
  ) {
    return "RETURNED";
  }

  if (
    workflowAction === "CLOSE_INCIDENT" ||
    status === "closed"
  ) {
    return "CLOSED";
  }

  if (
    workflowAction === "SUBMIT_RESOLUTION" ||
    workflowAction === "SUBMIT_INVESTIGATION" ||
    status === "for review"
  ) {
    return "FOR_REVIEW";
  }

  if (
    workflowAction === "START_INVESTIGATION" ||
    status === "investigating"
  ) {
    return "INVESTIGATING";
  }

  if (
    workflowAction === "CREATE_INCIDENT" ||
    status === "open"
  ) {
    return "REPORTED";
  }

  return "GENERAL";
}

function getEventConfig(event, priority) {
  const configs = {
    REPORTED: {
      eyebrow: "New Incident",
      actorLabel: "Reported by",
      icon: FiInfo,
      card:
        "border-sky-400/35 bg-gradient-to-br from-sky-950/95 via-slate-950/95 to-slate-950/95 text-sky-100",
      iconClass:
        "bg-sky-400/15 text-sky-300 ring-1 ring-inset ring-sky-400/25",
      actorClass:
        "border border-sky-400/15 bg-sky-400/10",
      accentClass:
        "text-sky-300",
      buttonClass:
        "bg-sky-400 text-slate-950 hover:bg-sky-300 focus:ring-sky-400/30",
    },

    INVESTIGATING: {
      eyebrow: "Investigation Started",
      actorLabel: "Investigation started by",
      icon: FiPlayCircle,
      card:
        "border-amber-400/35 bg-gradient-to-br from-amber-950/95 via-slate-950/95 to-slate-950/95 text-amber-100",
      iconClass:
        "bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/25",
      actorClass:
        "border border-amber-400/15 bg-amber-400/10",
      accentClass:
        "text-amber-300",
      buttonClass:
        "bg-amber-400 text-slate-950 hover:bg-amber-300 focus:ring-amber-400/30",
    },

    FOR_REVIEW: {
      eyebrow: "Review Required",
      actorLabel: "Submitted for review by",
      icon: FiSend,
      card:
        "border-violet-400/35 bg-gradient-to-br from-violet-950/95 via-slate-950/95 to-slate-950/95 text-violet-100",
      iconClass:
        "bg-violet-400/15 text-violet-300 ring-1 ring-inset ring-violet-400/25",
      actorClass:
        "border border-violet-400/15 bg-violet-400/10",
      accentClass:
        "text-violet-300",
      buttonClass:
        "bg-violet-400 text-slate-950 hover:bg-violet-300 focus:ring-violet-400/30",
    },

    RETURNED: {
      eyebrow: "Correction Required",
      actorLabel: "Returned by",
      icon: FiRotateCcw,
      card:
        "border-orange-400/35 bg-gradient-to-br from-orange-950/95 via-slate-950/95 to-slate-950/95 text-orange-100",
      iconClass:
        "bg-orange-400/15 text-orange-300 ring-1 ring-inset ring-orange-400/25",
      actorClass:
        "border border-orange-400/15 bg-orange-400/10",
      accentClass:
        "text-orange-300",
      buttonClass:
        "bg-orange-400 text-slate-950 hover:bg-orange-300 focus:ring-orange-400/30",
    },

    CLOSED: {
      eyebrow: "Approved and Closed",
      actorLabel: "Approved by",
      icon: FiCheckCircle,
      card:
        "border-emerald-400/35 bg-gradient-to-br from-emerald-950/95 via-slate-950/95 to-slate-950/95 text-emerald-100",
      iconClass:
        "bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/25",
      actorClass:
        "border border-emerald-400/15 bg-emerald-400/10",
      accentClass:
        "text-emerald-300",
      buttonClass:
        "bg-emerald-400 text-slate-950 hover:bg-emerald-300 focus:ring-emerald-400/30",
    },

    GENERAL: {
      eyebrow:
        priority === "High"
          ? "Critical Alert"
          : priority === "Medium"
          ? "Major Alert"
          : "Smart Alert",
      actorLabel: "Related user",
      icon:
        priority === "High"
          ? FiAlertTriangle
          : priority === "Medium"
          ? FiClock
          : FiInfo,
      card:
        "border-slate-400/30 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-950/95 text-slate-100",
      iconClass:
        "bg-slate-400/15 text-slate-300 ring-1 ring-inset ring-slate-400/25",
      actorClass:
        "border border-slate-400/15 bg-slate-400/10",
      accentClass:
        "text-slate-300",
      buttonClass:
        "bg-white text-slate-950 hover:bg-slate-200 focus:ring-white/30",
    },
  };

  return configs[event] || configs.GENERAL;
}

function getActorDetails(alert, event) {
  if (event === "CLOSED" || event === "RETURNED") {
    return {
      name:
        alert.reviewedByName ||
        alert.reviewedBy ||
        "Unknown Reviewer",
      username:
        alert.reviewedByUsername ||
        alert.reviewed_by_username ||
        "",
      role:
        alert.reviewedByRole ||
        alert.reviewed_by_role ||
        "",
    };
  }

  if (event === "FOR_REVIEW") {
    return {
      name:
        alert.resolutionSubmittedByName ||
        alert.submittedBy ||
        "Unknown Submitter",
      username:
        alert.resolutionSubmittedByUsername ||
        alert.resolution_submitted_by_username ||
        "",
      role:
        alert.resolutionSubmittedByRole ||
        alert.resolution_submitted_by_role ||
        "",
    };
  }

  if (event === "INVESTIGATING") {
    return {
      name:
        alert.investigationStartedByName ||
        alert.investigationBy ||
        "Unknown Investigator",
      username:
        alert.investigationStartedByUsername ||
        alert.investigation_started_by_username ||
        "",
      role:
        alert.investigationStartedByRole ||
        alert.investigation_started_by_role ||
        "",
    };
  }

  return {
    name:
      alert.reportedByName ||
      alert.reporterName ||
      alert.reportedBy ||
      "Unknown Reporter",
    username:
      alert.reportedByUsername ||
      alert.reported_by_username ||
      "",
    role:
      alert.reportedByRole ||
      alert.reported_by_role ||
      "",
  };
}

export default function SmartAlertToast({
  alert,
  onView,
  onDismiss,
}) {
  if (!alert) {
    return null;
  }

  const event = getAlertEvent(alert);
  const config = getEventConfig(event, alert.priority);
  const EventIcon = config.icon;

  const actor = formatActorIdentity(
    getActorDetails(alert, event)
  );

  const recommendedAction =
    alert.recommendedAction ||
    "Review the affected record and validate the recommended action.";

  return (
    <div
      className="pointer-events-none fixed right-4 top-20 z-[70] w-[calc(100vw-2rem)] max-w-md sm:right-5 sm:top-24"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        role="alert"
        className={`pointer-events-auto max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border shadow-2xl backdrop-blur ${config.card}`}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${config.iconClass}`}
          >
            <EventIcon aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`text-xs font-black uppercase tracking-[0.12em] ${config.accentClass}`}
                >
                  {config.eyebrow}
                </p>

                <h3 className="mt-1 break-words text-sm font-black text-white">
                  {alert.title || "Smart Alert"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => onDismiss?.(alert)}
                className="shrink-0 rounded-xl p-1.5 text-white/65 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/10"
                aria-label="Dismiss smart alert"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            <p className="mt-2 break-words text-sm leading-6 text-white/80">
              {alert.message ||
                "A monitored record requires attention."}
            </p>

            <div
              className={`mt-3 flex items-start gap-2 rounded-2xl p-3 text-xs leading-5 ${config.actorClass}`}
            >
              <FiUser
                className={`mt-0.5 shrink-0 ${config.accentClass}`}
                aria-hidden="true"
              />

              <div className="min-w-0">
                <p className={`font-black ${config.accentClass}`}>
                  {config.actorLabel}
                </p>

                <p className="mt-0.5 break-words font-bold text-white">
                  {actor}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs font-semibold leading-5">
              <p
                className={`mb-1 flex items-center gap-2 font-black ${config.accentClass}`}
              >
                <FiZap aria-hidden="true" />
                Recommended Action
              </p>

              <p className="text-white/80">
                {recommendedAction}
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => onView?.(alert)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition focus:outline-none focus:ring-4 ${config.buttonClass}`}
              >
                <FiEye aria-hidden="true" />
                View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}