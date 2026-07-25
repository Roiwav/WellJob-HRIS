import {
  FiAlertTriangle,
  FiInfo,
} from "react-icons/fi";

import Button from "./Button";
import Dialog from "./Dialog";

const TONE_CONFIG = {
  danger: {
    dialogTone: "danger",
    icon: FiAlertTriangle,
    iconClassName:
      "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    confirmVariant: "danger",
  },

  warning: {
    dialogTone: "warning",
    icon: FiAlertTriangle,
    iconClassName:
      "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    confirmVariant: "warning",
  },

  info: {
    dialogTone: "default",
    icon: FiInfo,
    iconClassName:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
    confirmVariant: "primary",
  },
};

export default function ConfirmDialog({
  open = false,
  title = "Confirm action",
  message = "",
  children = null,
  tone = "danger",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  disabled = false,
  closeOnBackdrop = true,
  onConfirm,
  onClose,
  className = "",
}) {
  const config =
    TONE_CONFIG[tone] || TONE_CONFIG.danger;

  const Icon = config.icon;

  const handleClose = () => {
    if (loading) {
      return;
    }

    onClose?.();
  };

  const handleConfirm = async () => {
    if (loading || disabled) {
      return;
    }

    await onConfirm?.();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      size="md"
      tone={config.dialogTone}
      closeOnOverlay={closeOnBackdrop}
      closeOnEscape
      preventClose={loading}
      showCloseButton
      className={className}
      footer={
        <>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={handleClose}
          >
            {cancelLabel}
          </Button>

          <Button
            variant={config.confirmVariant}
            loading={loading}
            disabled={disabled || loading}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            config.iconClassName,
          ].join(" ")}
        >
          <Icon
            aria-hidden="true"
            size={22}
          />
        </div>

        <div className="min-w-0 flex-1">
          {message && (
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
              {message}
            </p>
          )}

          {children && (
            <div
              className={[
                "text-sm leading-6 text-gray-600 dark:text-gray-300",
                message ? "mt-3" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}