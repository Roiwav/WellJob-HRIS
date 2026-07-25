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

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
  "2xl": "max-w-6xl",
  full: "max-w-[calc(100vw-2rem)]",
};

const HEIGHT_CLASSES = {
  auto: "max-h-[calc(100vh-2rem)]",
  lg: "h-[80vh] max-h-[calc(100vh-2rem)]",
  xl: "h-[90vh] max-h-[calc(100vh-2rem)]",
  full: "h-[calc(100vh-2rem)]",
};

const TONE_CLASSES = {
  default:
    "bg-gradient-to-r from-indigo-600 to-blue-600",
  success:
    "bg-gradient-to-r from-emerald-600 to-green-600",
  danger:
    "bg-gradient-to-r from-red-600 to-rose-600",
  warning:
    "bg-gradient-to-r from-amber-500 to-orange-500",
  neutral:
    "bg-gradient-to-r from-slate-700 to-slate-900",
};

function getFocusableElements(container) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll(FOCUSABLE_SELECTOR)
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null
  );
}

export default function Dialog({
  open = false,
  onClose,
  title,
  description,
  children,
  footer = null,
  header = null,

  size = "md",
  height = "auto",
  tone = "default",

  closeOnOverlay = true,
  closeOnEscape = true,
  preventClose = false,
  showCloseButton = true,
  showHeader = true,

  stickyHeader = true,
  stickyFooter = true,
  scrollBody = true,

  initialFocusRef,
  restoreFocusRef,

  overlayClassName = "",
  className = "",
  headerClassName = "",
  bodyClassName = "",
  footerClassName = "",
}) {
  const titleId = useId();
  const descriptionId = useId();

  const panelRef = useRef(null);
  const pointerStartedOnOverlayRef = useRef(false);

  const requestClose = useCallback(() => {
    if (preventClose) {
      return;
    }

    onClose?.();
  }, [onClose, preventClose]);

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocusedElement =
      document.activeElement;

    const explicitRestoreTarget =
      restoreFocusRef?.current || null;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const preferredTarget =
        initialFocusRef?.current;

      const firstFocusable =
        getFocusableElements(panelRef.current)[0];

      const target =
        preferredTarget ||
        firstFocusable ||
        panelRef.current;

      target?.focus?.({
        preventScroll: true,
      });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);

      document.body.style.overflow =
        previousOverflow;

      const restoreTarget =
        explicitRestoreTarget ||
        previouslyFocusedElement;

      window.setTimeout(() => {
        if (
          restoreTarget &&
          document.contains(restoreTarget) &&
          !restoreTarget.disabled &&
          typeof restoreTarget.focus === "function"
        ) {
          restoreTarget.focus({
            preventScroll: true,
          });
        }
      }, 0);
    };
  }, [
    initialFocusRef,
    open,
    restoreFocusRef,
  ]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (
          closeOnEscape &&
          !preventClose
        ) {
          event.preventDefault();
          event.stopPropagation();
          requestClose();
        }

        return;
      }

      if (
        event.key !== "Tab" ||
        !panelRef.current
      ) {
        return;
      }

      const focusableElements =
        getFocusableElements(panelRef.current);

      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstElement =
        focusableElements[0];

      const lastElement =
        focusableElements[
          focusableElements.length - 1
        ];

      const activeElement =
        document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement === firstElement ||
          !panelRef.current.contains(
            activeElement
          )
        ) {
          event.preventDefault();
          lastElement.focus();
        }

        return;
      }

      if (
        activeElement === lastElement ||
        !panelRef.current.contains(
          activeElement
        )
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
      true
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
        true
      );
    };
  }, [
    closeOnEscape,
    open,
    preventClose,
    requestClose,
  ]);

  if (!open) {
    return null;
  }

  const handleOverlayPointerDown = (
    event
  ) => {
    pointerStartedOnOverlayRef.current =
      event.target === event.currentTarget;
  };

  const handleOverlayPointerUp = (
    event
  ) => {
    const endedOnOverlay =
      event.target === event.currentTarget;

    if (
      pointerStartedOnOverlayRef.current &&
      endedOnOverlay &&
      closeOnOverlay &&
      !preventClose
    ) {
      requestClose();
    }

    pointerStartedOnOverlayRef.current =
      false;
  };

  const sizeClass =
    SIZE_CLASSES[size] ||
    SIZE_CLASSES.md;

  const heightClass =
    HEIGHT_CLASSES[height] ||
    HEIGHT_CLASSES.auto;

  const toneClass =
    TONE_CLASSES[tone] ||
    TONE_CLASSES.default;

  return (
    <div
      className={[
        "fixed inset-0 z-[9999] flex items-center justify-center",
        "overflow-y-auto bg-black/60 p-4 backdrop-blur-sm",
        overlayClassName,
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={
        handleOverlayPointerDown
      }
      onPointerUp={handleOverlayPointerUp}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          title ? titleId : undefined
        }
        aria-describedby={
          description
            ? descriptionId
            : undefined
        }
        tabIndex={-1}
        className={[
          "my-4 flex w-full flex-col overflow-hidden",
          "rounded-modal border border-gray-200 bg-white shadow-modal outline-none",
          "dark:border-white/10 dark:bg-slate-900",
          sizeClass,
          heightClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showHeader && (
          <header
            className={[
              "flex shrink-0 items-start justify-between gap-4 px-6 py-5 text-white",
              stickyHeader
                ? "sticky top-0 z-20"
                : "",
              toneClass,
              headerClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {header || (
              <div className="min-w-0">
                {title && (
                  <h2
                    id={titleId}
                    className="text-lg font-extrabold sm:text-xl"
                  >
                    {title}
                  </h2>
                )}

                {description && (
                  <p
                    id={descriptionId}
                    className="mt-1 text-sm leading-6 text-white/85"
                  >
                    {description}
                  </p>
                )}
              </div>
            )}

            {showCloseButton && (
              <button
                type="button"
                onClick={requestClose}
                disabled={preventClose}
                aria-label="Close dialog"
                title="Close dialog"
                className={[
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control",
                  "bg-white/10 text-white transition duration-ui",
                  "hover:bg-white/20",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
              >
                <FiX
                  size={20}
                  aria-hidden="true"
                />
              </button>
            )}
          </header>
        )}

        <div
          className={[
            "min-h-0 flex-1 text-gray-700 dark:text-gray-200",
            scrollBody
              ? "overflow-y-auto"
              : "overflow-visible",
            bodyClassName || "p-6",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>

        {footer && (
          <footer
            className={[
              "flex shrink-0 flex-wrap justify-end gap-3",
              "border-t border-gray-200 bg-white px-6 py-4",
              "dark:border-white/10 dark:bg-slate-900",
              stickyFooter
                ? "sticky bottom-0 z-20"
                : "",
              footerClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}