export default function FilterBar({
  children,
  actions = null,
  resultCount = null,
  resultLabel = "result",
  className = "",
  filtersClassName = "",
  actionsClassName = "",
}) {
  const hasResultCount =
    typeof resultCount === "number" && Number.isFinite(resultCount);

  const resultText = hasResultCount
    ? `${resultCount} ${resultLabel}${resultCount === 1 ? "" : "s"}`
    : "";

  return (
    <section
      className={[
        "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm",
        "dark:border-white/10 dark:bg-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div
          className={[
            "grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end",
            filtersClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>

        {(actions || hasResultCount) && (
          <div
            className={[
              "flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:w-auto xl:justify-end",
              actionsClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {hasResultCount && (
              <span className="whitespace-nowrap text-sm font-semibold text-gray-500 dark:text-gray-400">
                {resultText}
              </span>
            )}

            {actions && (
              <div className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}