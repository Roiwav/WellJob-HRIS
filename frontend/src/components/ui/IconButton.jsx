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
  sm: "h-9 w-9 rounded-lg text-sm",
  md: "h-10 w-10 rounded-xl text-base",
  lg: "h-11 w-11 rounded-xl text-lg",
};

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

const IconButton = forwardRef(function IconButton(
  {
    icon,
    label,
    type = "button",
    variant = "secondary",
    size = "md",
    loading = false,
    disabled = false,
    className = "",
    onClick,
    title,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.secondary;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

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
      aria-label={label}
      aria-busy={loading || undefined}
      title={title || label}
      onClick={handleClick}
      className={[
        "inline-flex shrink-0 items-center justify-center border font-semibold",
        "transition duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "dark:focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "active:scale-[0.96]",
        variantClass,
        sizeClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? <LoadingSpinner /> : icon}
    </button>
  );
});

export default IconButton;