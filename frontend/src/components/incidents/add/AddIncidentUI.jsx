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
  FiX,
} from "react-icons/fi";

export function CustomAlert({ type = "error", title, message, onClose }) {
  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div
          className={`px-6 py-5 ${
            isSuccess
              ? "bg-gradient-to-r from-emerald-600 to-green-600"
              : "bg-gradient-to-r from-red-600 to-rose-600"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
              {isSuccess ? (
                <FiCheckCircle size={24} />
              ) : (
                <FiAlertTriangle size={24} />
              )}
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-white">{title}</h3>
              <p className="mt-1 text-sm text-white/85">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm ${
              isSuccess
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export function SectionTitle({ icon, title }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
      {icon}
      {title}
    </h3>
  );
}

export function Field({ label, required = false, icon = null, children }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {icon}
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

export function ReadonlyBadge({ label, value, styleMap, placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <div className="flex min-h-[46px] items-center rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
        {value ? (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
              styleMap[value] || "border-gray-200 bg-gray-100 text-gray-700"
            }`}
          >
            {value}
          </span>
        ) : (
          <span className="text-sm text-gray-400">{placeholder}</span>
        )}
      </div>
    </div>
  );
}

export function PolicyCard({ formData }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        Policy Reference
      </p>

      <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
        {formData.violationCategory} • {formData.violationSection}
      </p>

      <p
        className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400"
        dangerouslySetInnerHTML={{
          __html: formData.violationDescription || "",
        }}
      />
    </div>
  );
}

export function PenaltiesCard({ penalties = [], offenseCount }) {
  if (!Array.isArray(penalties) || penalties.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Penalties
        </p>
        <p className="mt-2 text-sm text-gray-500">No penalties configured.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        Penalties
      </p>

      <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
        {penalties.map((penalty, index) => {
          const isSelected =
            Number(penalty?.offenseNo) === Number(offenseCount);

          return (
            <li
              key={`${penalty?.label || "penalty"}-${index}`}
              className={`flex gap-2 rounded-xl px-2 py-1.5 ${
                isSelected
                  ? "bg-red-50 font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300"
                  : ""
              }`}
            >
              <span className="text-red-500">•</span>
              <span>
                <span className="font-semibold">
                  {penalty?.label || `${index + 1} offense`}:
                </span>{" "}
                {penalty?.action || "No penalty specified"}
                {isSelected && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                    Selected
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

export function ReviewItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

export function FooterButtons({ children }) {
  return (
    <div className="flex justify-end gap-3 border-t border-gray-200 bg-white pt-5 dark:border-white/10 dark:bg-slate-900">
      {children}
    </div>
  );
}

export function ModalStyle() {
  return (
    <style>{`
      .input-field {
        width: 100%;
        border-radius: 0.875rem;
        border: 1px solid rgb(209 213 219);
        background: white;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        outline: none;
      }

      .input-field:focus {
        border-color: rgb(239 68 68);
        box-shadow: 0 0 0 3px rgb(254 226 226);
      }

      .dark .input-field {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgb(15 23 42);
        color: white;
      }

      .dark .input-field::placeholder {
        color: rgb(148 163 184);
      }
    `}</style>
  );
}

export function DuplicateIncidentVerificationPanel({
  candidates = [],
  checked = false,
  onChange,
}) {
  const [selectedIncident, setSelectedIncident] = useState(null);

  const hasCandidates = candidates.length > 0;

  const getValue = (...values) => {
    return values.find((value) => String(value || "").trim()) || "-";
  };

  const getIncidentCode = (incident) => {
    return (
      incident.displayId ||
      incident.incidentCode ||
      (incident.id
        ? `INC-${String(incident.id).padStart(4, "0")}`
        : "Existing Case")
    );
  };

  const getIncidentDateRaw = (incident) => {
    return (
      incident.reportedAt ||
      incident.reported_at ||
      incident.date ||
      incident.incidentDate ||
      incident.incident_date ||
      incident.createdAt ||
      incident.created_at ||
      ""
    );
  };

  const formatIncidentDate = (incident) => {
    const dateValue = getIncidentDateRaw(incident);

    if (!dateValue) return "-";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const formatIncidentDateTime = (incident) => {
    const dateValue = getIncidentDateRaw(incident);

    if (!dateValue) return "-";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (!hasCandidates) {
    return (
      <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        <div className="flex gap-3">
          <FiCheckCircle className="mt-0.5 shrink-0" />

          <div>
            <p className="font-extrabold">No active duplicate found</p>

            <p className="mt-1 text-xs leading-5">
              No open, investigating, or for-review record with the same
              employee and violation.
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
          <FiAlertTriangle className="mt-0.5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="font-extrabold">Possible duplicate / related case</p>

            <p className="mt-1 text-xs leading-5">
              Same employee and same violation found in active incident records.
              This will not block saving, but HR verification is required.
            </p>

            <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
              {candidates.map((incident) => {
                const incidentId = getIncidentCode(incident);
                const formattedDate = formatIncidentDate(incident);

                return (
                  <div
                    key={incident.id || `${incidentId}-${formattedDate}`}
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
                          Date: {formattedDate}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        {incident.status || "Open"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedIncident(incident)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-extrabold text-amber-800 transition hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                    >
                      <FiEye />
                      Review Existing Record
                    </button>
                  </div>
                );
              })}
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-300 bg-white p-3 text-xs font-bold leading-5 dark:border-amber-900/60 dark:bg-slate-900">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-1"
              />

              <span>
                I verified the existing active record(s) and confirm that this
                is a separate incident report.
              </span>
            </label>
          </div>
        </div>
      </aside>

      {selectedIncident && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-slate-50 px-6 py-5 dark:border-white/10 dark:bg-slate-950">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <FiEye />
                  Existing Incident Review
                </div>

                <h3 className="mt-3 text-xl font-extrabold text-gray-900 dark:text-white">
                  {getIncidentCode(selectedIncident)}
                </h3>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Review this existing active record before confirming the new
                  incident report.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <FiX size={22} />
              </button>
            </div>

            <div className="max-h-[calc(88vh-120px)] space-y-5 overflow-y-auto px-6 py-6">
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
                  label="Company / Client"
                  value={getValue(selectedIncident.company)}
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
                  value={getValue(selectedIncident.severity)}
                />

                <DuplicateReviewItem
                  icon={<FiCheckCircle />}
                  label="Status"
                  value={getValue(selectedIncident.status)}
                />

                <DuplicateReviewItem
                  icon={<FiCalendar />}
                  label="Reported Date / Incident Date"
                  value={formatIncidentDateTime(selectedIncident)}
                />

                <DuplicateReviewItem
                  icon={<FiBriefcase />}
                  label="Location"
                  value={getValue(selectedIncident.location)}
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
                label="Incident Description"
                value={getValue(selectedIncident.description)}
              />

              <DuplicateReviewText
                icon={<FiShield />}
                label="Action Taken / Sanction"
                value={getValue(
                  selectedIncident.actionTaken,
                  selectedIncident.action_taken,
                  selectedIncident.sanction
                )}
              />

              <DuplicateReviewText
                icon={<FiCheckCircle />}
                label="Recommendation"
                value={getValue(selectedIncident.recommendation)}
              />

              <DuplicateReviewText
                icon={<FiFileText />}
                label="Resolution Notes"
                value={getValue(
                  selectedIncident.resolutionNotes,
                  selectedIncident.resolution_notes
                )}
              />

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <p className="font-extrabold">Verification Reminder</p>

                <p className="mt-1 leading-6">
                  If this existing incident is not the same event, close this
                  review and check the verification box before saving the new
                  incident report.
                </p>
              </div>

              <div className="flex justify-end border-t border-gray-200 pt-5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-100"
                >
                  Close Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DuplicateReviewItem({ icon, label, value }) {
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

function DuplicateReviewText({ icon, label, value }) {
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