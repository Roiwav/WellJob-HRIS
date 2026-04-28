import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

export function DeploymentInfoCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-sm">{label}</span>
      </div>

      <p className="text-base font-semibold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

export function ConfirmDeploymentActionModal({
  action,
  employee,
  onClose,
  onConfirm,
}) {
  const isCancel = action === "cancel";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              isCancel
                ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"
                : "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300"
            }`}
          >
            {isCancel ? (
              <FiAlertTriangle size={22} />
            ) : (
              <FiCheckCircle size={22} />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {isCancel ? "Cancel Deployment?" : "Mark as Completed?"}
            </h3>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              This action will update deployment status only.
            </p>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {isCancel
            ? `Are you sure you want to cancel the deployment record of ${
                employee || "this employee"
              }? Contract dates will remain unchanged.`
            : `Are you sure you want to mark ${
                employee || "this deployment"
              } as completed? Contract dates will remain unchanged.`}
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
          >
            No, go back
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              isCancel
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isCancel ? "Yes, cancel deployment" : "Yes, mark completed"}
          </button>
        </div>
      </div>
    </div>
  );
}