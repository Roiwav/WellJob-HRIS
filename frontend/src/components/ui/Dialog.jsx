import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { FiX } from "react-icons/fi";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null
  );
}

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  tone = "default",
  closeOnOverlay = true,
  closeOnEscape = true,
  preventClose = false,
  showCloseButton = true,
  initialFocusRef,
  restoreFocusRef,
  className = "",
}) {
  const titleId = useId();
  const descriptionId = useId();

  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const pointerStartedOnOverlayRef = useRef(false);

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-5xl",
  };

  const toneClasses = {
    default: "bg-gradient-to-r from-indigo-600 to-blue-600",
    success: "bg-gradient-to-r from-emerald-600 to-green-600",
    danger: "bg-gradient-to-r from-red-600 to-rose-600",
    warning: "bg-gradient-to-r from-amber-500 to-orange-500",
  };

  const requestClose = useCallback(() => {
    if (preventClose) return;
    onClose?.();
  }, [onClose, preventClose]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const previouslyFocusedElement = document.activeElement;
    const explicitRestoreTarget = restoreFocusRef?.current || null;
    const previousOverflow = document.body.style.overflow;

    previouslyFocusedRef.current = previouslyFocusedElement;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const preferredTarget = initialFocusRef?.current;
      const firstFocusable = getFocusableElements(panelRef.current)[0];
      const target = preferredTarget || firstFocusable || panelRef.current;

      target?.focus?.({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;

      const fallbackRestoreTarget = previouslyFocusedElement;
      const target = explicitRestoreTarget || fallbackRestoreTarget;

      window.setTimeout(() => {
        if (
          target &&
          document.contains(target) &&
          !target.disabled &&
          typeof target.focus === "function"
        ) {
          target.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, [open, initialFocusRef, restoreFocusRef]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (closeOnEscape && !preventClose) {
          event.preventDefault();
          event.stopPropagation();
          requestClose();
        }

        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusableElements = getFocusableElements(panelRef.current);

      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement === firstElement ||
          !panelRef.current.contains(activeElement)
        ) {
          event.preventDefault();
          lastElement.focus();
        }

        return;
      }

      if (
        activeElement === lastElement ||
        !panelRef.current.contains(activeElement)
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, closeOnEscape, preventClose, requestClose]);

  if (!open) return null;

  const handleOverlayPointerDown = (event) => {
    pointerStartedOnOverlayRef.current = event.target === event.currentTarget;
  };

  const handleOverlayPointerUp = (event) => {
    const endedOnOverlay = event.target === event.currentTarget;

    if (
      pointerStartedOnOverlayRef.current &&
      endedOnOverlay &&
      closeOnOverlay &&
      !preventClose
    ) {
      requestClose();
    }

    pointerStartedOnOverlayRef.current = false;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onPointerDown={handleOverlayPointerDown}
      onPointerUp={handleOverlayPointerUp}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`my-8 w-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl outline-none dark:border-white/10 dark:bg-slate-900 ${
          sizeClasses[size] || sizeClasses.md
        } ${className}`}
      >
        <header
          className={`flex items-start justify-between gap-4 px-6 py-5 text-white ${
            toneClasses[tone] || toneClasses.default
          }`}
        >
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold sm:text-xl">
              {title}
            </h2>

            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-white/85">
                {description}
              </p>
            )}
          </div>

          {showCloseButton && (
            <button
              type="button"
              onClick={requestClose}
              disabled={preventClose}
              aria-label="Close dialog"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiX size={20} aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="p-6 text-gray-700 dark:text-gray-200">{children}</div>

        {footer && (
          <footer className="flex flex-wrap justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-white/10">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}