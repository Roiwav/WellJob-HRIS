import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  FiAlertTriangle,
  FiClock,
  FiPlay,
  FiShield,
  FiUserCheck,
} from "react-icons/fi";

import {
  formatDateTime,
} from "../../../utils/incidents/incidentHelpers";

import Button from "../../ui/Button";

import {
  AlertBox,
  BaseModal,
  Detail,
  InfoCard,
  ModalFooter,
} from "../shared/ModalUI";

const SEVERITY_STYLE = {
  Minor:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Major:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  Critical:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
};

const STATUS_STYLE = {
  Open:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
  Investigating:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  "For Review":
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
  Closed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
};

function StatusPill({
  value,
  styles,
}) {
  const displayValue =
    String(
      value || "-"
    ).trim() || "-";

  const currentStyle =
    styles?.[
      displayValue
    ] ||
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${currentStyle}`}
    >
      {displayValue}
    </span>
  );
}

export default function ConfirmStartInvestigationModal({
  incident,
  currentUser,
  onClose,
  onConfirm,
}) {
  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const currentDateTime =
    useMemo(() => {
      return formatDateTime(
        new Date().toISOString()
      );
    }, []);

  const safeIncident =
    useMemo(() => {
      return incident || {};
    }, [incident]);

  const safeCurrentUser =
    useMemo(() => {
      return currentUser || {};
    }, [currentUser]);

  const handleClose =
    useCallback(() => {
      if (
        isSubmitting
      ) {
        return;
      }

      onClose?.();
    }, [
      isSubmitting,
      onClose,
    ]);

  const handleConfirm =
    useCallback(
      async () => {
        if (
          isSubmitting ||
          !safeIncident?.id
        ) {
          return;
        }

        try {
          setIsSubmitting(
            true
          );

          const result =
            await onConfirm?.(
              safeIncident
            );

          if (
            result ===
            false
          ) {
            setIsSubmitting(
              false
            );
          }
        } catch (error) {
          console.error(
            "Start investigation confirmation error:",
            error
          );

          setIsSubmitting(
            false
          );
        }
      },
      [
        isSubmitting,
        onConfirm,
        safeIncident,
      ]
    );

  if (!incident) {
    return null;
  }

  const incidentCode =
    safeIncident.displayId ||
    safeIncident.id ||
    "-";

  const employeeName =
    safeIncident.employee ||
    safeIncident.employeeName ||
    "Unknown Employee";

  const violation =
    safeIncident.violation ||
    safeIncident.violationType ||
    "-";

  const investigatorName =
    safeCurrentUser.name ||
    safeCurrentUser.fullName ||
    safeCurrentUser.full_name ||
    "-";

  const investigatorRole =
    safeCurrentUser.role ||
    "-";

  return (
    <BaseModal
      onClose={
        handleClose
      }
      title="Start Investigation"
      subtitle={`${incidentCode} • ${employeeName}`}
      color="amber"
      size="sm"
      preventClose={
        isSubmitting
      }
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
              aria-hidden="true"
            >
              <FiShield
                size={18}
              />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                Confirm Investigation Assignment
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">
                Starting the investigation will move this case to Investigating and record the responsible user, role, date, and time in the case timeline.
              </p>
            </div>
          </div>
        </section>

        <AlertBox
          type="warning"
          title="This action changes the case workflow"
          message="Review the case and investigator details below before confirming."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <FiAlertTriangle
                aria-hidden="true"
              />
              Severity
            </div>

            <StatusPill
              value={
                safeIncident.severity
              }
              styles={
                SEVERITY_STYLE
              }
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <FiClock
                aria-hidden="true"
              />
              Current Status
            </div>

            <StatusPill
              value={
                safeIncident.status
              }
              styles={
                STATUS_STYLE
              }
            />
          </div>
        </div>

        <InfoCard title="Case to Investigate">
          <Detail
            label="Incident ID"
            value={
              incidentCode
            }
          />

          <Detail
            label="Employee"
            value={
              employeeName
            }
          />

          <Detail
            label="Violation"
            value={
              violation
            }
          />

          <Detail
            label="Case Age"
            value={`${Number(
              safeIncident.caseAgeDays ||
                0
            )} day(s)`}
          />
        </InfoCard>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
              aria-hidden="true"
            >
              <FiUserCheck />
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Investigation Responsibility
              </h3>

              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                The following user will be recorded as the investigator starting this case.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {investigatorName}
            </p>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {investigatorRole}
              {safeCurrentUser.username
                ? ` • @${safeCurrentUser.username}`
                : ""}
            </p>
          </div>

          <div className="mt-3 space-y-2">
            <Detail
              label="User ID"
              value={
                safeCurrentUser.id ||
                safeCurrentUser.userId
              }
            />

            <Detail
              label="Date and Time"
              value={
                currentDateTime
              }
            />
          </div>
        </section>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={
              isSubmitting
            }
            onClick={
              handleClose
            }
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="warning"
            leftIcon={
              <FiPlay
                aria-hidden="true"
              />
            }
            loading={
              isSubmitting
            }
            disabled={
              isSubmitting ||
              !safeIncident?.id
            }
            onClick={
              handleConfirm
            }
          >
            {isSubmitting
              ? "Starting Investigation..."
              : "Start Investigation"}
          </Button>
        </ModalFooter>
      </div>
    </BaseModal>
  );
}