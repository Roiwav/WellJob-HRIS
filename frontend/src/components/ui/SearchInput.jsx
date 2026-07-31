import { forwardRef, useId } from "react";
import { FiSearch, FiX } from "react-icons/fi";

const SearchInput = forwardRef(function SearchInput(
  {
    id,
    name = "search",
    label = "Search",
    value = "",
    onChange,
    onClear,
    placeholder = "Search...",
    disabled = false,
    autoComplete = "off",
    className = "",
    inputClassName = "",
    containerClassName = "",
    showClearButton = true,
    hideLabel = false,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hasValue = String(value || "").length > 0;

  const handleClear = () => {
    if (disabled) return;

    if (typeof onClear === "function") {
      onClear();
      return;
    }

    onChange?.({
      target: {
        name,
        value: "",
      },
    });
  };

  return (
    <div
      className={["min-w-0", containerClassName]
        .filter(Boolean)
        .join(" ")}
    >
      {!hideLabel && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200"
        >
          {label}
        </label>
      )}

      <div
        className={["relative min-w-0", className]
          .filter(Boolean)
          .join(" ")}
      >
        <FiSearch
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        />

        <input
          ref={ref}
          id={inputId}
          name={name}
          type="text"
          role="searchbox"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-label={hideLabel ? label : undefined}
          className={[
            "min-h-11 w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 text-sm text-gray-900 shadow-sm outline-none transition",
            "placeholder:text-gray-400",
            "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
            "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
            "dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-gray-500",
            "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
            "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
            showClearButton && hasValue ? "pr-11" : "pr-3",
            inputClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {showClearButton && hasValue && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear search"
            title="Clear search"
            className={[
              "absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg",
              "text-gray-400 transition hover:bg-gray-100 hover:text-gray-700",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200",
            ].join(" ")}
          >
            <FiX aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
});

export default SearchInput;