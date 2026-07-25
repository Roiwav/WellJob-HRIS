import { useEffect } from "react";
import { FiCheckCircle, FiX } from "react-icons/fi";

export default function SuccessToast({
  message = "",
  title = "Success",
  duration = 3500,
  onClose,
  className = "",
}) {
  useEffect(() => {
    if (!message || typeof onClose !== "function") return undefined;

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4 sm:justify-end sm:px-6"
    >
      <div
        role="status"
        className={[
          "pointer-events-auto w-full max-w-sm rounded-2xl border border-emerald-200",
          "bg-white p-4 shadow-2xl",
          "dark:border-emerald-500/30 dark:bg-slate-900",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <FiCheckCircle aria-hidden="true" size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              {title}
            </h2>

            <p className="mt-1 break-words text-sm leading-5 text-gray-600 dark:text-gray-300">
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification"
            title="Close notification"
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              "text-gray-400 transition hover:bg-gray-100 hover:text-gray-700",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              "dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200",
            ].join(" ")}
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}