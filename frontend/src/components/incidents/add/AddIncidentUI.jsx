import { useState } from "react";

import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiEye,
  FiFileText,
  FiShield,
  FiUser,
} from "react-icons/fi";

import Button from "../../ui/Button";

import Dialog from "../../ui/Dialog";

import {
  formatDateTime,
  getDateOnly,
} from "../../../utils/incidents/addIncidentHelpers";

function getSafePolicyDescriptionText(value) {
  const rawValue =
    String(value || "").trim();
  if (!rawValue) {
    return "";
  }
  const withReadableBreaks =
    rawValue
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(
        /<\s*\/?\s*(p|div|li|ul|ol)\s*>/gi,
        "\n"
      )
      .replace(
        /<\s*li(?:\s[^>]*)?>/gi,
        "• "
      );
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const document = parser.parseFromString(
      withReadableBreaks,
      "text/html"
    );
    return String(
      document.body.textContent || ""
    )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return withReadableBreaks
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function SectionTitle({ icon, title }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
      {icon}
      {title}
    </h3>
  );
}

export function Field({
  label,
  required = false,
  icon = null,
  children,
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {icon}
        <span>
          {label}
          {required && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </span>
      </label>
      {children}
    </div>
  );
}

export function ReadonlyBadge({
  label,
  value,
  styleMap,
  placeholder,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="flex min-h-[46px] items-center rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
        {value ? (
          <span
            className={[
              "inline-flex rounded-full border px-3 py-1 text-xs font-bold",
              styleMap?.[value] ||
                "border-gray-200 bg-gray-100 text-gray-700 dark:border-white/10 dark:bg-slate-800 dark:text-gray-300",
            ].join(" ")}
          >
            {value}
          </span>
        ) : (
          <span className="text-sm text-gray-400">
            {placeholder}
          </span>
        )}
      </div>
    </div>
  );
}

export function PolicyCard({ formData }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Policy Details
      </p>
      <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
        {formData.violationCategory} •{" "}
        {formData.violationSection}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600 dark:text-gray-400">
        {getSafePolicyDescriptionText(
          formData.violationDescription
        )}
      </p>
    </div>
  );
}

export function PenaltiesCard({
  penalties = [],
  offenseCount,
}) {
  if (
    !Array.isArray(penalties) ||
    penalties.length === 0
  ) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Prescribed Sanctions
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          No prescribed sanctions are listed for this violation.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Prescribed Sanctions
      </p>
      <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
        {penalties.map((penalty, index) => {
          const offenseNumber =
            penalty &&
            typeof penalty === "object"
              ? penalty.offenseNo
              : index + 1;
          const label =
            penalty &&
            typeof penalty === "object"
              ? penalty.label ||
                `Offense ${index + 1}`
              : `Offense ${index + 1}`;
          const action =
            typeof penalty === "string"
              ? penalty
              : penalty?.action ||
                "Not specified";
          const isSelected =
            Number(offenseNumber) ===
            Number(offenseCount);
          return (
            <li
              key={`${label}-${index}`}
              className={[
                "flex gap-2 rounded-xl px-2 py-1.5",
                isSelected
                  ? "bg-red-50 font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300"
                  : "",
              ].join(" ")}
            >
              <span
                className="text-red-500"
                aria-hidden="true"
              >
                •
              </span>
              <span>
                <span className="font-semibold">
                  {label}:
                </span>{" "}
                {action}
                {isSelected && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:bg-red-500/20 dark:text-red-300">
                    Applies
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ReviewItem({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

export function FooterButtons({
  children,
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 bg-white pt-5 dark:border-white/10 dark:bg-slate-900">
      {children}
    </div>
  );
}

export function ModalStyle() {
  return (
    <style>{`
      .input-field {
        width: 100%;
        min-height: 2.875rem;
        border-radius: 0.875rem;
        border: 1px solid rgb(209 213 219);
        background: white;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        outline: none;
        transition:
          border-color 150ms ease,
          box-shadow 150ms ease,
          background-color 150ms ease;
      }
      .input-field:focus {
        border-color: rgb(239 68 68);
        box-shadow: 0 0 0 3px rgb(254 226 226);
      }
      .input-field:disabled {
        cursor: not-allowed;
        opacity: 0.75;
      }
      .dark .input-field {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgb(15 23 42);
        color: white;
      }
      .dark .input-field::placeholder {
        color: rgb(148 163 184);
      }
      .dark .input-field:focus {
        border-color: rgb(248 113 113);
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
      }
    `}</style>
  );
}

export function DuplicateIncidentVerificationPanel({
  candidates = [],
  checked = false,
  onChange,
}) {
  const [
    selectedIncident,
    setSelectedIncident,
  ] = useState(null);
  const hasCandidates =
    candidates.length > 0;
  const getValue = (...values) => {
    return (
      values.find((value) =>
        String(value || "").trim()
      ) || "-"
    );
  };
  const getIncidentCode = (incident) => {
    return (
      incident.displayId ||
      incident.incidentCode ||
      (incident.id
        ? `INC-${String(
            incident.id
          ).padStart(4, "0")}`
        : "Existing Case")
    );
  };
  const getIncidentBusinessDateRaw = (
    incident
  ) => {
    return (
      incident.date ||
      incident.incidentDate ||
      incident.incident_date ||
      incident.reportedAt ||
      incident.reported_at ||
      incident.createdAtTimestamp ||
      incident.created_at_timestamp ||
      incident.createdAt ||
      incident.created_at ||
      ""
    );
  };
  const getIncidentReportedAtRaw = (
    incident
  ) => {
    return (
      incident.reportedAt ||
      incident.reported_at ||
      incident.createdAtTimestamp ||
      incident.created_at_timestamp ||
      incident.createdAt ||
      incident.created_at ||
      incident.date ||
      incident.incidentDate ||
      incident.incident_date ||
      ""
    );
  };
  const formatIncidentDate = (
    incident
  ) => {
    const dateOnly =
      getDateOnly(
        getIncidentBusinessDateRaw(
          incident
        )
      );
    if (
      !dateOnly ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        dateOnly
      )
    ) {
      return "-";
    }
    const date =
      new Date(
        `${dateOnly}T00:00:00+08:00`
      );
    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }
    return new Intl.DateTimeFormat(
      "en-PH",
      {
        timeZone:
          "Asia/Manila",
        year:
          "numeric",
        month:
          "short",
        day:
          "2-digit",
      }
    ).format(
      date
    );
  };
  const formatIncidentDateTime = (
    incident
  ) => {
    return formatDateTime(
      getIncidentReportedAtRaw(
        incident
      )
    );
  };
  if (!hasCandidates) {
    return (
      <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        <div className="flex gap-3">
          <FiCheckCircle
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="font-extrabold">
              No matching active case found
            </p>
            <p className="mt-1 text-xs leading-5">
              No active case with the same employee
              and violation was found.
            </p>
          </div>
        </div>
      </aside>
    );
  }
  return (
    <>
      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <div className="flex gap-3">
          <FiAlertTriangle
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">
              Possible Related Case
            </p>
            <p className="mt-1 text-xs leading-5">
              An active case with the same employee
              and violation already exists. Review
              it before saving this report to confirm
              that this is a separate incident.
            </p>
            <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
              {candidates.map(
                (incident, index) => {
                  const incidentId =
                    getIncidentCode(incident);
                  const formattedDate =
                    formatIncidentDate(
                      incident
                    );
                  return (
                    <div
                      key={
                        incident.id ||
                        `${incidentId}-${formattedDate}-${index}`
                      }
                      className="rounded-xl border border-amber-200 bg-white px-3 py-3 dark:border-amber-900/50 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold">
                            {incidentId}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 opacity-90">
                            {getValue(
                              incident.violation,
                              incident.violationType,
                              incident.violation_type
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] opacity-70">
                            Date:{" "}
                            {formattedDate}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {incident.status ||
                            "Open"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        leftIcon={<FiEye />}
                        className="mt-3"
                        onClick={() =>
                          setSelectedIncident(
                            incident
                          )
                        }
                      >
                        View Existing Case
                      </Button>
                    </div>
                  );
                }
              )}
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-300 bg-white p-3 text-xs font-bold leading-5 dark:border-amber-900/60 dark:bg-slate-900">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange?.(
                    event.target.checked
                  )
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                I reviewed the existing case(s) and
                confirm that this report is for a
                separate incident.
              </span>
            </label>
          </div>
        </div>
      </aside>
      <Dialog
        open={Boolean(selectedIncident)}
        onClose={() =>
          setSelectedIncident(null)
        }
        title={
          selectedIncident
            ? getIncidentCode(
                selectedIncident
              )
            : "Existing Case"
        }
        description="Review this case and confirm whether the new report is for a separate incident."
        tone="warning"
        size="xl"
        footer={
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setSelectedIncident(null)
            }
          >
            Close
          </Button>
        }
      >
        {selectedIncident && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <FiEye aria-hidden="true" />
              Existing Case
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DuplicateReviewItem
                icon={<FiUser />}
                label="Employee"
                value={getValue(
                  selectedIncident.employee,
                  selectedIncident.employeeName,
                  selectedIncident.employee_name
                )}
              />
              <DuplicateReviewItem
                icon={<FiBriefcase />}
                label="Client Company"
                value={getValue(
                  selectedIncident.company
                )}
              />
              <DuplicateReviewItem
                icon={<FiShield />}
                label="Violation"
                value={getValue(
                  selectedIncident.violation,
                  selectedIncident.violationType,
                  selectedIncident.violation_type
                )}
              />
              <DuplicateReviewItem
                icon={<FiAlertTriangle />}
                label="Severity"
                value={getValue(
                  selectedIncident.severity
                )}
              />
              <DuplicateReviewItem
                icon={<FiCheckCircle />}
                label="Status"
                value={getValue(
                  selectedIncident.status
                )}
              />
              <DuplicateReviewItem
                icon={<FiCalendar />}
                label="Reported On"
                value={formatIncidentDateTime(
                  selectedIncident
                )}
              />
              <DuplicateReviewItem
                icon={<FiBriefcase />}
                label="Location"
                value={getValue(
                  selectedIncident.location
                )}
              />
              <DuplicateReviewItem
                icon={<FiUser />}
                label="Reported By"
                value={getValue(
                  selectedIncident.reportedBy,
                  selectedIncident.reported_by
                )}
              />
            </div>
            <DuplicateReviewText
              icon={<FiFileText />}
              label="Case Description"
              value={getValue(
                selectedIncident.description
              )}
            />
            <DuplicateReviewText
              icon={<FiShield />}
              label="Action / Sanction"
              value={getValue(
                selectedIncident.actionTaken,
                selectedIncident.action_taken,
                selectedIncident.sanction
              )}
            />
            <DuplicateReviewText
              icon={<FiCheckCircle />}
              label="Recommendation"
              value={getValue(
                selectedIncident.recommendation
              )}
            />
            <DuplicateReviewText
              icon={<FiFileText />}
              label="Resolution Remarks"
              value={getValue(
                selectedIncident.resolutionNotes,
                selectedIncident.resolution_notes
              )}
            />
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-extrabold">
                Before You Continue
              </p>
              <p className="mt-1 leading-6">
                If this is a different incident, close
                this window and confirm the checkbox
                before saving the new report.
              </p>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function DuplicateReviewItem({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-950/50">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <p className="break-words text-sm font-extrabold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

function DuplicateReviewText({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <p className="whitespace-pre-line break-words text-sm leading-6 text-gray-700 dark:text-gray-300">
        {value || "-"}
      </p>
    </div>
  );
}