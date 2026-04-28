import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { formatDateTime } from "../../../utils/incidents/incidentHelpers";

export function BaseModal({
  children,
  onClose,
  title,
  subtitle,
  color = "red",
  size = "lg",
}) {
  const colors = {
    red: "from-red-600 to-rose-600",
    green: "from-green-600 to-emerald-600",
    indigo: "from-indigo-600 to-blue-600",
    amber: "from-amber-500 to-orange-500",
  };

  const sizes = {
    sm: "max-w-2xl",
    lg: "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div
        className={`mx-auto my-8 w-full ${
          sizes[size] || sizes.lg
        } overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900`}
      >
        <div className={`bg-gradient-to-r ${colors[color]} px-6 py-5 text-white`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold">{title}</h2>
              <p className="mt-1 text-sm text-white/80">{subtitle}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 p-2 hover:bg-white/20"
              aria-label="Close"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="p-6">{children}</div>
        <ModalStyle />
      </div>
    </div>
  );
}

export function NoticeModal({ type = "success", title, message, onClose }) {
  const isSuccess = type === "success";
  const color = isSuccess
    ? "from-emerald-600 to-green-600"
    : "from-red-600 to-rose-600";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className={`bg-gradient-to-r ${color} px-6 py-5 text-white`}>
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3">
              {isSuccess ? (
                <FiCheckCircle size={24} />
              ) : (
                <FiAlertCircle size={24} />
              )}
            </div>

            <div>
              <h3 className="text-lg font-extrabold">{title}</h3>
              <p className="mt-1 text-sm text-white/85">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-5">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white ${
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

export function AlertBox({ type = "warning", title, message }) {
  const style =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";

  return (
    <div className={`flex items-start gap-4 rounded-2xl border p-5 ${style}`}>
      <div className="rounded-full bg-white/50 p-3">
        <FiAlertCircle size={22} />
      </div>

      <div>
        <h3 className="text-lg font-extrabold">{title}</h3>
        <p className="mt-1 text-sm leading-6">{message}</p>
      </div>
    </div>
  );
}

export function CaseTimeline({ incident }) {
  const fallbackSteps = [
    {
      id: "reported",
      title: "Reported",
      description: incident.reportedBy
        ? `Reported by ${incident.reportedBy}`
        : "Incident report created",
      createdAt: incident.reportedAt || incident.date,
      status: "Open",
    },
    {
      id: "investigation",
      title: "Investigation Started",
      description: incident.investigation
        ? `By ${incident.investigation.startedByName}`
        : "Waiting for HR action",
      createdAt: incident.investigation?.startedAt,
      status: "Investigating",
    },
    {
      id: "proof",
      title: "Proof Submitted",
      description: incident.resolution
        ? `By ${incident.resolution.submittedByName}`
        : "Waiting for resolution proof",
      createdAt: incident.resolution?.submittedAt,
      status: "For Review",
    },
    {
      id: "review",
      title: incident.review?.decision === "Rejected" ? "Returned" : "Closed",
      description: incident.review
        ? `${incident.review.decision} by ${incident.review.reviewedByName}`
        : "Waiting for Super Admin review",
      createdAt: incident.review?.reviewedAt,
      status:
        incident.review?.decision === "Rejected" ? "Investigating" : "Closed",
    },
  ];

  const timelineItems =
    Array.isArray(incident.timeline) && incident.timeline.length > 0
      ? incident.timeline
      : fallbackSteps;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950">
      <p className="mb-5 text-xs font-bold uppercase tracking-wide text-gray-500">
        Case Timeline
      </p>

      <div className="space-y-5">
        {timelineItems.map((item, index) => {
          const isRejected =
            item.status === "Rejected" ||
            item.status === "Returned" ||
            item.title?.toLowerCase().includes("returned");

          return (
            <div
              key={item.id || `${item.title}-${index}`}
              className="relative flex gap-3"
            >
              {index !== timelineItems.length - 1 && (
                <span className="absolute left-[15px] top-8 h-full w-px bg-gray-200 dark:bg-white/10" />
              )}

              <div
                className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
                  isRejected
                    ? "border-red-300 bg-red-100 text-red-700"
                    : "border-green-300 bg-green-100 text-green-700"
                }`}
              >
                {isRejected ? <FiXCircle /> : <FiCheckCircle />}
              </div>

              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {item.description}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <FiClock />
                  {formatDateTime(item.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProofReview({ resolution }) {
  return (
    <InfoCard title="Resolution Proof Review">
      <Detail label="Submitted By" value={resolution.submittedByName || "-"} />
      <Detail
        label="Submitted Date"
        value={formatDateTime(resolution.submittedAt)}
      />

      <TextDetail label="Action Taken" value={resolution.actionTaken || "-"} />
      <TextDetail label="Remarks" value={resolution.remarks || "-"} />

      <ProofList files={resolution.proofFiles || []} />
    </InfoCard>
  );
}

export function TextDetail({ label, value }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm leading-6">{value}</p>
    </div>
  );
}

export function ProofList({ files = [] }) {
  if (!files.length) {
    return <p className="mt-3 text-sm text-gray-500">No proof uploaded.</p>;
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {files.map((file) => (
        <div
          key={file.id || file.name}
          className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
              <FiFileText />
            </div>

            <div className="min-w-0">
              <p className="break-all text-sm font-bold text-gray-900 dark:text-white">
                {file.name}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {file.type || "Uploaded file"}
              </p>
              <p className="text-xs text-gray-400">
                {file.uploadedAt ? formatDateTime(file.uploadedAt) : "-"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InfoCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Detail({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <span className="font-semibold text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white">
        {value || "-"}
      </span>
    </div>
  );
}

export function Field({ label, required = false, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function ModalFooter({ children }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-5 dark:border-white/10">
      {children}
    </div>
  );
}

function ModalStyle() {
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
        border-color: rgb(99 102 241);
        box-shadow: 0 0 0 3px rgb(224 231 255);
      }

      .dark .input-field {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgb(15 23 42);
        color: white;
      }

      .dark .input-field::placeholder {
        color: rgb(148 163 184);
      }

      .btn-light {
        border-radius: 0.75rem;
        border: 1px solid rgb(229 231 235);
        padding: 0.625rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 700;
        color: rgb(55 65 81);
      }

      .dark .btn-light {
        border-color: rgba(255, 255, 255, 0.1);
        color: rgb(209 213 219);
      }

      .btn-green,
      .btn-red,
      .btn-amber {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 0.75rem;
        padding: 0.625rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 700;
        color: white;
      }

      .btn-green {
        background: rgb(22 163 74);
      }

      .btn-green:hover {
        background: rgb(21 128 61);
      }

      .btn-red {
        background: rgb(220 38 38);
      }

      .btn-red:hover {
        background: rgb(185 28 28);
      }

      .btn-amber {
        background: rgb(245 158 11);
      }

      .btn-amber:hover {
        background: rgb(217 119 6);
      }
    `}</style>
  );
}