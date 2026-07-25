import {
  FiFileText,
  FiInbox,
  FiSearch,
  FiUsers,
} from "react-icons/fi";

import Button from "./Button";

const ICONS = {
  default: FiInbox,
  search: FiSearch,
  employees: FiUsers,
  records: FiFileText,
};

export default function EmptyState({
  title = "No records found",
  description = "There are currently no records available.",
  icon = "default",
  customIcon = null,
  actionLabel = "",
  onAction,
  actionIcon = null,
  actionVariant = "primary",
  secondaryActionLabel = "",
  onSecondaryAction,
  className = "",
}) {
  const Icon = ICONS[icon] || ICONS.default;

  return (
    <section
      className={[
        "flex min-h-[320px] flex-col items-center justify-center rounded-3xl",
        "border border-dashed border-gray-300 bg-white px-6 py-12 text-center",
        "dark:border-slate-700 dark:bg-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        {customIcon || <Icon aria-hidden="true" size={28} />}
      </div>

      <h2 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">
        {title}
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          {actionLabel && typeof onAction === "function" && (
            <Button
              variant={actionVariant}
              leftIcon={actionIcon}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}

          {secondaryActionLabel &&
            typeof onSecondaryAction === "function" && (
              <Button
                variant="secondary"
                onClick={onSecondaryAction}
              >
                {secondaryActionLabel}
              </Button>
            )}
        </div>
      )}
    </section>
  );
}