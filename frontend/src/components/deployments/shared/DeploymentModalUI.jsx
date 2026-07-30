import {
  FiAlertTriangle,
  FiCheckCircle,
} from "react-icons/fi";

import ConfirmDialog from "../../ui/ConfirmDialog";

export function DeploymentInfoCard({
  icon,
  label,
  value,
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    String(value).trim() === ""
      ? "-"
      : value;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}

        <span className="text-sm">
          {label}
        </span>
      </div>

      <p className="break-words text-base font-semibold text-gray-900 dark:text-white">
        {displayValue}
      </p>
    </div>
  );
}

export function ConfirmDeploymentActionModal({
  open = true,
  action,
  employee,
  loading = false,
  disabled = false,
  onClose,
  onConfirm,
}) {
  const isCancel =
    action === "cancel";

  const title = isCancel
    ? "Cancel Deployment?"
    : "Mark as Completed?";

  const confirmLabel = isCancel
    ? "Yes, Cancel Deployment"
    : "Yes, Mark Completed";

  const employeeName =
    String(employee || "").trim() ||
    "this employee";

  const handleClose = () => {
    if (loading) {
      return;
    }

    onClose?.();
  };

  const handleConfirm = () => {
    if (loading || disabled) {
      return;
    }

    onConfirm?.();
  };

  return (
    <ConfirmDialog
      open={Boolean(open)}
      title={title}
      tone={isCancel ? "danger" : "success"}
      confirmLabel={confirmLabel}
      cancelLabel="No, Go Back"
      loading={loading}
      disabled={disabled}
      closeOnBackdrop={!loading}
      onClose={handleClose}
      onConfirm={handleConfirm}
    >
      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            isCancel
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          }`}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              isCancel
                ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
            }`}
          >
            {isCancel ? (
              <FiAlertTriangle
                size={22}
                aria-hidden="true"
              />
            ) : (
              <FiCheckCircle
                size={22}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="min-w-0">
            <p className="font-extrabold">
              Deployment Status Update
            </p>

            <p className="mt-1 text-sm leading-6">
              This action updates the deployment status only.
              Existing contract dates will remain unchanged.
            </p>
          </div>
        </div>

        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          {isCancel
            ? `Are you sure you want to cancel the deployment record of ${employeeName}?`
            : `Are you sure you want to mark the deployment record of ${employeeName} as completed?`}
        </p>

        {isCancel && (
          <p className="text-sm font-semibold text-red-600 dark:text-red-300">
            The deployment will no longer be treated as active.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}