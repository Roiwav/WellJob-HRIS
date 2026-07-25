import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";

import Button from "./Button";

export default function ErrorState({
  title = "Something went wrong",
  message = "We were unable to load the requested data.",
  retryLabel = "Try again",
  onRetry,
  compact = false,
  className = "",
}) {
  return (
    <section
      role="alert"
      className={[
        "rounded-3xl border border-red-200 bg-red-50 text-red-900",
        "dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100",
        compact ? "p-4" : "px-6 py-10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "flex",
          compact
            ? "items-start gap-3"
            : "flex-col items-center text-center",
        ].join(" ")}
      >
        <div
          className={[
            "flex shrink-0 items-center justify-center rounded-2xl",
            "bg-red-100 text-red-600",
            "dark:bg-red-500/15 dark:text-red-300",
            compact ? "h-10 w-10" : "h-16 w-16",
          ].join(" ")}
        >
          <FiAlertCircle
            aria-hidden="true"
            size={compact ? 20 : 28}
          />
        </div>

        <div className={compact ? "min-w-0 flex-1" : "mt-5"}>
          <h2
            className={[
              "font-bold",
              compact ? "text-sm" : "text-lg",
            ].join(" ")}
          >
            {title}
          </h2>

          <p
            className={[
              "leading-6 text-red-700 dark:text-red-200",
              compact ? "mt-1 text-sm" : "mt-2 max-w-md text-sm",
            ].join(" ")}
          >
            {message}
          </p>

          {typeof onRetry === "function" && (
            <div className={compact ? "mt-3" : "mt-6"}>
              <Button
                variant="danger"
                leftIcon={<FiRefreshCw />}
                onClick={onRetry}
              >
                {retryLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}