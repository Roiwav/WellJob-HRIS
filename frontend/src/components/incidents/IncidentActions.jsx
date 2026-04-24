import { useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiMessageSquare,
  FiRefreshCw,
  FiShield,
  FiX,
} from "react-icons/fi";
import AddActionModal from "./AddActionModal";

const INCIDENTS_KEY = "incidents";

function isImageFile(file = "") {
  return typeof file === "string" && file.startsWith("data:image");
}

function isPdfFile(file = "") {
  return typeof file === "string" && file.startsWith("data:application/pdf");
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function IncidentActions({ incident }) {
  const [openAddAction, setOpenAddAction] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role || "";
  const userName = user?.name || user?.username || "Unknown";

  const isHR = role === "HR_MANAGER" || role === "HR_STAFF";
  const isSuperAdmin = role === "SUPER_ADMIN";

  const actions = useMemo(() => {
    if (!incident?.actions || !Array.isArray(incident.actions)) return [];
    return [...incident.actions].sort(
      (a, b) => new Date(b.actionDate || 0) - new Date(a.actionDate || 0)
    );
  }, [incident]);

  const hasProof = actions.some((action) => action.proofFile || action.proofName);

  const canStartInvestigation = isHR && incident?.status === "Open";
  const canAddAction = isHR && incident?.status === "Investigating";
  const canResolve =
    isHR && incident?.status === "Investigating" && actions.length > 0 && hasProof;
  const canClose = isSuperAdmin && incident?.status === "Resolved";
  const canReturn = isSuperAdmin && incident?.status === "Resolved";

  const updateIncident = (updater) => {
    try {
      const storedIncidents = JSON.parse(
        localStorage.getItem(INCIDENTS_KEY) || "[]"
      );

      const updatedIncidents = storedIncidents.map((item) =>
        item.id === incident.id ? updater(item) : item
      );

      localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updatedIncidents));
      window.dispatchEvent(new Event("dataUpdated"));
    } catch (error) {
      console.error("Failed to update incident:", error);
      alert("Failed to update incident.");
    }
  };

  const handleStartInvestigation = () => {
    if (!canStartInvestigation) return;

    const confirmed = window.confirm("Start investigation for this case?");
    if (!confirmed) return;

    updateIncident((item) => ({
      ...item,
      status: "Investigating",
      investigatedBy: userName,
      investigatedAt: new Date().toISOString(),
    }));
  };

  const handleResolve = () => {
    if (!canResolve) {
      alert("Add at least one action with proof before marking as resolved.");
      return;
    }

    const confirmed = window.confirm("Mark this case as Resolved?");
    if (!confirmed) return;

    updateIncident((item) => ({
      ...item,
      status: "Resolved",
      resolvedBy: userName,
      resolvedAt: new Date().toISOString(),
    }));
  };

  const handleClose = () => {
    if (!canClose) return;

    const confirmed = window.confirm("Close this case after final review?");
    if (!confirmed) return;

    updateIncident((item) => ({
      ...item,
      status: "Closed",
      closedBy: userName,
      closedAt: new Date().toISOString(),
    }));
  };

  const handleReturnToInvestigation = () => {
    if (!canReturn) return;

    const comment = window.prompt(
      "Enter Super Admin comment before returning this case to investigation:"
    );

    if (!comment || !comment.trim()) {
      alert("Comment is required.");
      return;
    }

    updateIncident((item) => ({
      ...item,
      status: "Investigating",
      returnedBy: userName,
      returnedAt: new Date().toISOString(),
      reviewComments: [
        ...(item.reviewComments || []),
        {
          id: `RC-${Date.now()}`,
          comment: comment.trim(),
          createdBy: userName,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  };

  return (
    <div className="space-y-6 border-t border-gray-200 pt-6 dark:border-slate-700">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Case Workflow
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Open → Investigating → Resolved → Closed
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canStartInvestigation && (
              <button
                type="button"
                onClick={handleStartInvestigation}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
              >
                <FiClock />
                Start Investigation
              </button>
            )}

            {canAddAction && (
              <button
                type="button"
                onClick={() => setOpenAddAction(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <FiFileText />
                Add Proof Action
              </button>
            )}

            {isHR && incident?.status === "Open" && (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500"
              >
                Add Proof Action
              </button>
            )}

            {isHR && incident?.status === "Investigating" && (
              <button
                type="button"
                onClick={handleResolve}
                disabled={!canResolve}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  canResolve
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "cursor-not-allowed bg-gray-200 text-gray-500"
                }`}
              >
                <FiRefreshCw />
                Mark as Resolved
              </button>
            )}

            {canReturn && (
              <button
                type="button"
                onClick={handleReturnToInvestigation}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                <FiMessageSquare />
                Return with Comment
              </button>
            )}

            {canClose && (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                <FiCheckCircle />
                Close Case
              </button>
            )}
          </div>
        </div>

        <Timeline incident={incident} />
      </div>

      {incident?.status === "Open" && (
        <Notice tone="amber">
          This case is open. Start the investigation before adding proof action.
        </Notice>
      )}

      {incident?.status === "Investigating" && actions.length === 0 && (
        <Notice tone="amber">
          Add at least one proof action before marking this case as resolved.
        </Notice>
      )}

      {incident?.status === "Investigating" && actions.length > 0 && !hasProof && (
        <Notice tone="amber">
          Proof attachment is required before this case can be resolved.
        </Notice>
      )}

      {incident?.status === "Resolved" && (
        <Notice tone="blue">
          This case is resolved and waiting for Super Admin final review.
        </Notice>
      )}

      {incident?.status === "Closed" && (
        <Notice tone="green">
          This case has been closed after Super Admin review.
        </Notice>
      )}

      {(incident?.reviewComments || []).length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-orange-800 dark:border-orange-900/40 dark:bg-orange-500/10 dark:text-orange-300">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <FiMessageSquare />
            Super Admin Comments
          </h4>

          <div className="space-y-3">
            {(incident.reviewComments || []).map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-white/70 p-3 text-sm dark:bg-slate-900/50"
              >
                <p className="font-semibold">{item.comment}</p>
                <p className="mt-1 text-xs opacity-75">
                  {item.createdBy || "-"} • {formatDateTime(item.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Proof Actions
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Recorded HR actions and supporting proof for this incident.
          </p>
        </div>

        <div className="space-y-3">
          {actions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No proof action has been recorded yet.
              </p>
            </div>
          ) : (
            actions.map((action, index) => (
              <div
                key={action.id || index}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {action.actionTaken || "No action title"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {action.actionDate || "-"} •{" "}
                      {action.createdBy || "Unknown"}
                    </p>
                  </div>

                  {action.proofName && (
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                      Proof Attached
                    </span>
                  )}
                </div>

                {action.remarks && (
                  <p className="mt-3 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">
                    {action.remarks}
                  </p>
                )}

                {action.proofName && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      File: {action.proofName}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {isImageFile(action.proofFile) && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile(action.proofFile)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          <FiEye />
                          View Proof
                        </button>
                      )}

                      {isPdfFile(action.proofFile) && (
                        <a
                          href={action.proofFile}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          <FiFileText />
                          Open PDF
                        </a>
                      )}
                    </div>

                    {isImageFile(action.proofFile) && (
                      <div className="max-w-xs overflow-hidden rounded-xl border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                        <img
                          src={action.proofFile}
                          alt={action.proofName || "Proof"}
                          className="h-32 w-full rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <AddActionModal
        isOpen={openAddAction}
        onClose={() => setOpenAddAction(false)}
        incident={incident}
      />

      {previewFile && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              onClick={() => setPreviewFile(null)}
              className="absolute -top-12 right-0 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow"
            >
              <FiX />
              Close Preview
            </button>

            <img
              src={previewFile}
              alt="Proof Preview"
              className="max-h-[82vh] w-full rounded-2xl bg-white object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ incident }) {
  const steps = [
    {
      label: "Open",
      active: true,
      meta: incident?.reportedAt
        ? `Reported by ${incident.reportedBy || "Unknown"}`
        : "Incident created",
    },
    {
      label: "Investigating",
      active: ["Investigating", "Resolved", "Closed"].includes(incident?.status),
      meta: incident?.investigatedBy
        ? `${incident.investigatedBy} • ${formatDateTime(incident.investigatedAt)}`
        : "Pending",
    },
    {
      label: "Resolved",
      active: ["Resolved", "Closed"].includes(incident?.status),
      meta: incident?.resolvedBy
        ? `${incident.resolvedBy} • ${formatDateTime(incident.resolvedAt)}`
        : "Pending",
    },
    {
      label: "Closed",
      active: incident?.status === "Closed",
      meta: incident?.closedBy
        ? `${incident.closedBy} • ${formatDateTime(incident.closedAt)}`
        : "Pending",
    },
  ];

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-4">
      {steps.map((step) => (
        <div
          key={step.label}
          className={`rounded-2xl border p-4 ${
            step.active
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-gray-200 bg-gray-50 text-gray-500"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                step.active ? "bg-green-600 text-white" : "bg-gray-300 text-white"
              }`}
            >
              <FiCheckCircle size={14} />
            </span>
            <p className="text-sm font-bold">{step.label}</p>
          </div>
          <p className="mt-2 text-xs leading-5">{step.meta}</p>
        </div>
      ))}
    </div>
  );
}

function Notice({ tone = "amber", children }) {
  const style =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-500/10 dark:text-green-300"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${style}`}>
      <div className="flex gap-2">
        <FiShield className="mt-0.5 shrink-0" />
        <span>{children}</span>
      </div>
    </div>
  );
}