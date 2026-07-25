function SkeletonBlock({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={[
        "animate-pulse rounded-lg bg-gray-200 dark:bg-slate-700",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export default function LoadingSkeleton({
  rows = 5,
  columns = 6,
  showHeader = true,
  className = "",
}) {
  const safeRows = Math.max(1, Number(rows) || 1);
  const safeColumns = Math.max(1, Number(columns) || 1);

  return (
    <section
      aria-label="Loading content"
      aria-busy="true"
      className={[
        "overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm",
        "dark:border-white/10 dark:bg-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showHeader && (
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-44" />
            <SkeletonBlock className="h-3.5 w-64 max-w-full" />
          </div>

          <SkeletonBlock className="h-8 w-24 rounded-full" />
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div
            className="grid gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-white/10 dark:bg-slate-800"
            style={{
              gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: safeColumns }).map((_, index) => (
              <SkeletonBlock
                key={`header-${index}`}
                className="h-3.5 w-20"
              />
            ))}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {Array.from({ length: safeRows }).map((_, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                className="grid gap-4 px-6 py-5"
                style={{
                  gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: safeColumns }).map((_, columnIndex) => (
                  <SkeletonBlock
                    key={`cell-${rowIndex}-${columnIndex}`}
                    className={[
                      "h-4",
                      columnIndex === 1 ? "w-32" : "",
                      columnIndex === safeColumns - 1
                        ? "ml-auto w-24"
                        : "w-20",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Loading records...</span>
    </section>
  );
}

export function CardLoadingSkeleton({
  cards = 4,
  className = "",
}) {
  const safeCards = Math.max(1, Number(cards) || 1);

  return (
    <div
      aria-label="Loading content"
      aria-busy="true"
      className={[
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Array.from({ length: safeCards }).map((_, index) => (
        <div
          key={`card-${index}`}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="h-8 w-16" />
              <SkeletonBlock className="h-3.5 w-32" />
            </div>

            <SkeletonBlock className="h-11 w-11 rounded-2xl" />
          </div>
        </div>
      ))}

      <span className="sr-only">Loading cards...</span>
    </div>
  );
}

export function FormLoadingSkeleton({
  fields = 6,
  className = "",
}) {
  const safeFields = Math.max(1, Number(fields) || 1);

  return (
    <div
      aria-label="Loading form"
      aria-busy="true"
      className={[
        "grid grid-cols-1 gap-5 md:grid-cols-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Array.from({ length: safeFields }).map((_, index) => (
        <div key={`field-${index}`} className="space-y-2">
          <SkeletonBlock className="h-3.5 w-24" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
        </div>
      ))}

      <span className="sr-only">Loading form...</span>
    </div>
  );
}