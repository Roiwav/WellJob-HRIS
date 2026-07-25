import { forwardRef } from "react";

const PageHeader = forwardRef(function PageHeader(
  {
    title,
    description = "",
    eyebrow = "",
    icon = null,
    actions = null,
    children = null,
    className = "",
    contentClassName = "",
    actionsClassName = "",
  },
  ref
) {
  return (
    <section
      ref={ref}
      className={[
        "rounded-3xl border border-gray-200 bg-white p-5 shadow-sm",
        "dark:border-white/10 dark:bg-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div
          className={[
            "min-w-0",
            contentClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {eyebrow && (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              {eyebrow}
            </p>
          )}

          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <div
                aria-hidden="true"
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
              >
                {icon}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="break-words text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                {title}
              </h1>

              {description && (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
          </div>

          {children && <div className="mt-4">{children}</div>}
        </div>

        {actions && (
          <div
            className={[
              "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end",
              actionsClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {actions}
          </div>
        )}
      </div>
    </section>
  );
});

export default PageHeader;