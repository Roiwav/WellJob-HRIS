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

function normalizeValue(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
}

function formatRole(
  value
) {
  const role = String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_"
    );

  const labels = {
    HR_MANAGER:
      "HR Manager",
    HR_STAFF:
      "HR Staff",
    SUPER_ADMIN:
      "Super Admin",
    IT_SUPPORT:
      "IT Support",
  };

  return (
    labels[role] ||
    String(
      value || ""
    ).trim()
  );
}

function formatActorIdentity({
  name,
  username,
  role,
}) {
  const safeName =
    String(
      name || ""
    ).trim() ||
    "Unknown User";

  const safeUsername =
    String(
      username || ""
    ).trim();

  const safeRole =
    formatRole(role);

  const usernameText =
    safeUsername &&
    safeUsername.toLowerCase() !==
      safeName.toLowerCase()
      ? ` (@${safeUsername.replace(
          /^@/,
          ""
        )})`
      : "";

  const roleText =
    safeRole
      ? ` • ${safeRole}`
      : "";

  return `${safeName}${usernameText}${roleText}`;
}

function getAlertEvent(
  alert
) {
  const status =
    normalizeValue(
      alert?.status
    );

  const workflowAction =
    String(
      alert?.workflowAction ||
        alert?.lastActionType ||
        alert?.last_action_type ||
        ""
    )
      .trim()
      .toUpperCase();

  const reviewDecision =
    normalizeValue(
      alert?.reviewDecision ||
        alert?.review_decision
    );

  if (
    workflowAction ===
      "RETURN_INCIDENT" ||
    reviewDecision ===
      "returned" ||
    reviewDecision ===
      "rejected"
  ) {
    return "RETURNED";
  }

  if (
    workflowAction ===
      "CLOSE_INCIDENT" ||
    status === "closed"
  ) {
    return "CLOSED";
  }

  if (
    workflowAction ===
      "SUBMIT_RESOLUTION" ||
    workflowAction ===
      "SUBMIT_INVESTIGATION" ||
    status ===
      "for review"
  ) {
    return "FOR_REVIEW";
  }

  if (
    workflowAction ===
      "START_INVESTIGATION" ||
    status ===
      "investigating"
  ) {
    return "INVESTIGATING";
  }

  if (
    workflowAction ===
      "CREATE_INCIDENT" ||
    status === "open"
  ) {
    return "REPORTED";
  }

  return "GENERAL";
}

function getEventConfig(
  event,
  priority
) {
  const configs = {
    REPORTED: {
      eyebrow:
        "New Incident",
      actorLabel:
        "Reported by",
      icon: FiInfo,
      accent:
        "text-sky-600 dark:text-sky-300",
      iconClass:
        "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
      border:
        "border-sky-200 dark:border-sky-500/30",
      buttonClass:
        "bg-sky-600 text-white hover:bg-sky-700",
    },
    INVESTIGATING: {
      eyebrow:
        "Investigation Started",
      actorLabel:
        "Investigation started by",
      icon: FiPlayCircle,
      accent:
        "text-amber-600 dark:text-amber-300",
      iconClass:
        "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
      border:
        "border-amber-200 dark:border-amber-500/30",
      buttonClass:
        "bg-amber-500 text-slate-950 hover:bg-amber-400",
    },
    FOR_REVIEW: {
      eyebrow:
        "Review Required",
      actorLabel:
        "Submitted for review by",
      icon: FiSend,
      accent:
        "text-violet-600 dark:text-violet-300",
      iconClass:
        "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
      border:
        "border-violet-200 dark:border-violet-500/30",
      buttonClass:
        "bg-violet-600 text-white hover:bg-violet-700",
    },
    RETURNED: {
      eyebrow:
        "Correction Required",
      actorLabel:
        "Returned by",
      icon: FiRotateCcw,
      accent:
        "text-orange-600 dark:text-orange-300",
      iconClass:
        "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
      border:
        "border-orange-200 dark:border-orange-500/30",
      buttonClass:
        "bg-orange-500 text-slate-950 hover:bg-orange-400",
    },
    CLOSED: {
      eyebrow:
        "Approved and Closed",
      actorLabel:
        "Approved by",
      icon: FiCheckCircle,
      accent:
        "text-emerald-600 dark:text-emerald-300",
      iconClass:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
      border:
        "border-emerald-200 dark:border-emerald-500/30",
      buttonClass:
        "bg-emerald-600 text-white hover:bg-emerald-700",
    },
    GENERAL: {
      eyebrow:
        priority ===
        "High"
          ? "Critical Alert"
          : priority ===
              "Medium"
            ? "Major Alert"
            : "Smart Alert",
      actorLabel:
        "Related user",
      icon:
        priority ===
        "High"
          ? FiAlertTriangle
          : priority ===
              "Medium"
            ? FiClock
            : FiInfo,
      accent:
        "text-slate-600 dark:text-slate-300",
      iconClass:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      border:
        "border-slate-200 dark:border-slate-700",
      buttonClass:
        "bg-indigo-600 text-white hover:bg-indigo-700",
    },
  };

  return (
    configs[event] ||
    configs.GENERAL
  );
}

function getActorDetails(
  alert,
  event
) {
  if (
    event === "CLOSED" ||
    event === "RETURNED"
  ) {
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

  if (
    event === "FOR_REVIEW"
  ) {
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

  if (
    event === "INVESTIGATING"
  ) {
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

  const event =
    getAlertEvent(alert);

  const config =
    getEventConfig(
      event,
      alert.priority
    );

  const EventIcon =
    config.icon;

  const actor =
    formatActorIdentity(
      getActorDetails(
        alert,
        event
      )
    );

  const recommendedAction =
    alert.recommendedAction ||
    "Review the affected record and validate the recommended action.";

  return (
    <div
      className="pointer-events-none fixed right-4 top-20 z-[70] w-[calc(100vw-2rem)] max-w-sm sm:right-5 sm:top-24"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        role="alert"
        className={`pointer-events-auto max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border bg-white shadow-2xl dark:bg-slate-900 ${config.border}`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconClass}`}
              aria-hidden="true"
            >
              <EventIcon />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${config.accent}`}
                  >
                    {
                      config.eyebrow
                    }
                  </p>

                  <h3 className="mt-1 break-words text-sm font-extrabold text-slate-900 dark:text-white">
                    {alert.title ||
                      "Smart Alert"}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onDismiss?.(
                      alert
                    )
                  }
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Dismiss smart alert"
                >
                  <FiX
                    aria-hidden="true"
                  />
                </button>
              </div>

              <p className="mt-2 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                {alert.message ||
                  "A monitored record requires attention."}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 dark:bg-slate-950/40">
              <FiUser
                className={`mt-0.5 shrink-0 ${config.accent}`}
                aria-hidden="true"
              />

              <div className="min-w-0">
                <p
                  className={`font-bold ${config.accent}`}
                >
                  {
                    config.actorLabel
                  }
                </p>

                <p className="mt-0.5 break-words font-semibold text-slate-700 dark:text-slate-200">
                  {actor}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 dark:border-slate-700 dark:bg-slate-950/40">
              <p
                className={`mb-1 flex items-center gap-2 font-bold ${config.accent}`}
              >
                <FiZap
                  aria-hidden="true"
                />
                Recommended Action
              </p>

              <p className="text-slate-600 dark:text-slate-300">
                {
                  recommendedAction
                }
              </p>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() =>
                onView?.(
                  alert
                )
              }
              className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${config.buttonClass}`}
            >
              <FiEye
                aria-hidden="true"
              />
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}