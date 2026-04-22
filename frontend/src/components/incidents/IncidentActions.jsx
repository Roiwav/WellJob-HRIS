import { useMemo, useState } from "react";
import AddActionModal from "./AddActionModal";

const INCIDENTS_KEY = "incidents";

function isImageFile(file = "") {
  return typeof file === "string" && file.startsWith("data:image");
}

function isPdfFile(file = "") {
  return typeof file === "string" && file.startsWith("data:application/pdf");
}

export default function IncidentActions({ incident }) {
  const [openAddAction, setOpenAddAction] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isHRManager = user?.role === "HR_MANAGER";

  const actions = useMemo(() => {
    if (!incident?.actions || !Array.isArray(incident.actions)) return [];
    return [...incident.actions].sort(
      (a, b) => new Date(b.actionDate || 0) - new Date(a.actionDate || 0)
    );
  }, [incident]);

  const canCloseCase =
    isHRManager &&
    incident?.status !== "Resolved" &&
    actions.length > 0;

  const handleCloseCase = () => {
    if (!canCloseCase) return;

    const confirmClose = window.confirm(
      "Are you sure you want to mark this case as Resolved?"
    );

    if (!confirmClose) return;

    try {
      const storedIncidents = JSON.parse(
        localStorage.getItem(INCIDENTS_KEY) || "[]"
      );

      const updatedIncidents = storedIncidents.map((item) =>
        item.id === incident.id
          ? {
              ...item,
              status: "Resolved",
              resolvedAt: new Date().toISOString(),
              resolvedBy: user?.name || "HR Manager",
            }
          : item
      );

      localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updatedIncidents));
      window.dispatchEvent(new Event("dataUpdated"));
    } catch (error) {
      console.error("Failed to close case:", error);
      alert("Failed to close case.");
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Actions Taken
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Record all HR actions related to this incident.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpenAddAction(true)}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
          >
            + Add Action
          </button>

          {isHRManager && (
            <button
              type="button"
              onClick={handleCloseCase}
              disabled={!canCloseCase}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${
                canCloseCase
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              Close Case
            </button>
          )}
        </div>
      </div>

      {!isHRManager && incident?.status !== "Resolved" && actions.length === 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
          At least one action must be recorded before this case can be resolved.
        </div>
      )}

      {isHRManager && incident?.status !== "Resolved" && actions.length === 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
          You cannot close this case yet. Add at least one action first.
        </div>
      )}

      {incident?.status === "Resolved" && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-500/10 dark:text-green-300">
          This case has already been resolved.
        </div>
      )}

      <div className="space-y-3">
        {actions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4 py-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No action has been recorded for this incident yet.
            </p>
          </div>
        ) : (
          actions.map((action, index) => (
            <div
              key={action.id || index}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {action.actionTaken || "No action title"}
                  </p>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {action.actionDate || "-"} • {action.createdBy || "Unknown"}
                  </p>
                </div>

                {action.proofName && (
                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                    Proof Attached
                  </span>
                )}
              </div>

              {action.remarks && (
                <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
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
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        View Proof
                      </button>
                    )}

                    {isPdfFile(action.proofFile) && (
                      <a
                        href={action.proofFile}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Open PDF
                      </a>
                    )}
                  </div>

                  {isImageFile(action.proofFile) && (
                    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 max-w-xs">
                      <img
                        src={action.proofFile}
                        alt={action.proofName || "Proof"}
                        className="w-full h-32 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AddActionModal
        isOpen={openAddAction}
        onClose={() => setOpenAddAction(false)}
        incident={incident}
      />

      {previewFile && (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full">
            <button
              type="button"
              onClick={() => setPreviewFile(null)}
              className="absolute -top-10 right-0 rounded-lg bg-white px-3 py-1 text-sm font-medium text-gray-800"
            >
              Close Preview
            </button>

            <img
              src={previewFile}
              alt="Proof Preview"
              className="w-full max-h-[80vh] object-contain rounded-xl bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}