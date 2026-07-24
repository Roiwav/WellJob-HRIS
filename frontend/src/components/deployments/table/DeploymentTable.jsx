import { useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiEye,
  FiEdit2,
  FiX,
} from "react-icons/fi";

const SEPARATION_REASON_OPTIONS = [
  "Resignation",
  "Termination",
  "Other Separation",
];

function formatDisplayDate(dateValue) {
  if (!dateValue || dateValue === "-") return "-";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateForInput(dateValue) {
  if (!dateValue || dateValue === "-") return "";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().split("T")[0];
}

function StatusBadge({ status }) {
  const styles = {
    Active:
      "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
    Completed:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    Pending:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    Cancelled:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
      }`}
    >
      {status || "-"}
    </span>
  );
}

function SeparationModal({ deployment, onClose, onSubmit }) {
  const [separationDate, setSeparationDate] = useState(
    formatDateForInput(deployment?.separationDate || deployment?.contractEnd)
  );
  const [separationReason, setSeparationReason] = useState("");
  const [separationRemarks, setSeparationRemarks] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!deployment) return null;

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setError("");

    if (!separationDate) {
      setError("Please select the employee's separation date.");
      return;
    }

    if (!separationReason) {
      setError("Please select a separation reason.");
      return;
    }

    if (separationReason === "Other Separation" && !separationRemarks.trim()) {
      setError("Please provide details for Other Separation.");
      return;
    }

    setIsSubmitting(true);

    try {
      const wasSaved = await onSubmit({
        ...deployment,
        separationDate,
        separationReason,
        separationRemarks: separationRemarks.trim(),
      });

      if (!wasSaved) {
        setError(
          "The separation could not be saved. Review the page error and try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] overflow-y-auto bg-black/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6"
      onClick={isSubmitting ? undefined : onClose}
    >
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="separation-dialog-title"
          className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <FiBriefcase size={22} />
              </div>

              <h2 id="separation-dialog-title" className="text-xl font-extrabold text-gray-900 dark:text-white">
                Separate Employee
              </h2>

              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Record separation only when the employee resigns, is terminated,
                or leaves for another reason.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="shrink-0 rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close separation dialog"
            >
              <FiX size={22} />
            </button>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/60">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Employee
            </p>
            <p className="mt-1 font-extrabold text-slate-900 dark:text-white">
              {deployment.employee}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {deployment.company || "-"} • {deployment.location || "-"}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                Separation Date
              </label>

              <input
                type="date"
                value={separationDate}
                onChange={(event) => setSeparationDate(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                Separation Reason
              </label>

              <select
                value={separationReason}
                onChange={(event) => setSeparationReason(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select reason...</option>
                {SEPARATION_REASON_OPTIONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                Separation Details
                <span className="ml-1 text-xs font-medium text-gray-400">
                  {separationReason === "Other Separation" ? "required" : "optional"}
                </span>
              </label>

              <textarea
                value={separationRemarks}
                onChange={(event) => setSeparationRemarks(event.target.value)}
                rows={3}
                placeholder="Add short note or HR remarks..."
                className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <div className="flex items-center gap-2">
                <FiAlertTriangle />
                {error}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <b>Employment rule:</b> Deployment is continuous. Saving this form
            records that the employee has left employment and ends the active
            deployment.
          </div>

          <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving Separation..." : "Confirm Separation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeploymentTable({
  deployments = [],
  openView,
  onUpdateRow,
  isSuperAdmin,
}) {
  const [separationTarget, setSeparationTarget] = useState(null);

  const handleOpenEndModal = (deployment) => {
    setSeparationTarget(deployment);
  };

  const handleCloseEndModal = () => {
    setSeparationTarget(null);
  };

  const handleSubmitSeparation = async (updatedDeployment) => {
    if (!onUpdateRow) return false;

    const wasSaved = await onUpdateRow(updatedDeployment);
    if (!wasSaved) return false;

    setSeparationTarget(null);
    return true;
  };

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 dark:border-white/10">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
              <FiBriefcase className="text-indigo-600 dark:text-indigo-400" />
              Deployment Records
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              View and monitor employee deployment assignments.
            </p>
          </div>

          <span className="rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            {deployments.length} record{deployments.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
              <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
                  Employee ID
                </th>
                <th className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
                  Employee
                </th>
                <th className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
                  Company
                </th>
                <th className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
                  Location
                </th>
                <th className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
                  Deployment Start
                </th>
                <th className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
                  Separation
                </th>
                <th className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
                  Status
                </th>
                <th className="border-b border-gray-200 px-6 py-4 text-center dark:border-white/10">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {deployments.length > 0 ? (
                deployments.map((deployment) => {
                  const canEndDeployment =
                    !isSuperAdmin && deployment.status === "Active";

                  return (
                    <tr
                      key={deployment.id}
                      className="transition hover:bg-indigo-50/50 dark:hover:bg-white/5"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {deployment.id || "-"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {deployment.employee || "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {deployment.company || "-"}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                        {deployment.location || "-"}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                        {formatDisplayDate(deployment.start)}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                        <div>
                          <p>{formatDisplayDate(deployment.separationDate || deployment.contractEnd)}</p>

                          {(deployment.separationReason || deployment.endReason) && (
                            <p className="mt-1 max-w-[180px] text-xs font-semibold text-gray-400 dark:text-gray-500">
                              {deployment.separationReason || deployment.endReason}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={deployment.status} />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {canEndDeployment && (
                            <button
                              type="button"
                              onClick={() => handleOpenEndModal(deployment)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 transition hover:bg-blue-600 hover:text-white dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500"
                              title="Separate Employee"
                              aria-label={`Separate ${deployment.employee}`}
                            >
                              <FiEdit2 />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openView(deployment)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500"
                            title="View Deployment"
                          >
                            <FiEye />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-white/10">
                        <FiBriefcase size={24} />
                      </div>
                      <p className="font-extrabold text-gray-900 dark:text-white">
                        No deployments found
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Deployment records will appear here once an employee is
                        deployed.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {separationTarget && (
        <SeparationModal
          deployment={separationTarget}
          onClose={handleCloseEndModal}
          onSubmit={handleSubmitSeparation}
        />
      )}
    </>
  );
}