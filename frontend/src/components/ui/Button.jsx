import { forwardRef } from "react";

const VARIANT_CLASSES = {
  primary:
    "border-transparent bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus-visible:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600",

  secondary:
    "border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:hover:bg-slate-700",

  success:
    "border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600",

  danger:
    "border-transparent bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600",

  warning:
    "border-transparent bg-amber-500 text-white shadow-sm hover:bg-amber-600 focus-visible:ring-amber-500 dark:bg-amber-500 dark:hover:bg-amber-600",

  ghost:
    "border-transparent bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-indigo-500 dark:text-gray-200 dark:hover:bg-white/10",

  outline:
    "border-indigo-300 bg-transparent text-indigo-700 hover:bg-indigo-50 focus-visible:ring-indigo-500 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10",
};

const SIZE_CLASSES = {
  sm: "min-h-9 rounded-lg px-3 py-1.5 text-xs",
  md: "min-h-10 rounded-xl px-4 py-2 text-sm",
  lg: "min-h-11 rounded-xl px-5 py-2.5 text-sm",
};

const ICON_SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

const Button = forwardRef(function Button(
  {
    children,
    type = "button",
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    fullWidth = false,
    leftIcon = null,
    rightIcon = null,
    className = "",
    onClick,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  const variantClass =
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const iconSizeClass =
    ICON_SIZE_CLASSES[size] || ICON_SIZE_CLASSES.md;

  const handleClick = (event) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={[
        "inline-flex items-center justify-center gap-2 border font-semibold",
        "transition duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "dark:focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "active:scale-[0.98]",
        variantClass,
        sizeClass,
        fullWidth ? "w-full" : "w-auto",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <LoadingSpinner />
      ) : (
        leftIcon && (
          <span
            aria-hidden="true"
            className={`shrink-0 ${iconSizeClass}`}
          >
            {leftIcon}
          </span>
        )
      )}

      {children && <span>{children}</span>}

      {!loading && rightIcon && (
        <span
          aria-hidden="true"
          className={`shrink-0 ${iconSizeClass}`}
        >
          {rightIcon}
        </span>
      )}
    </button>
  );
});

export default Button;