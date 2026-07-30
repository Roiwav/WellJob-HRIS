import { useId, useMemo } from "react";

export default function FilterSelect({
  id,
  label = "Filter incident records",
  value = "",
  onChange,
  options = [],
  labels = {},
  disabled = false,
  className = "",
}) {
  const generatedId = useId();
  const selectId = id || `incident-filter-${generatedId}`;

  const safeOptions = useMemo(() => {
    return Array.isArray(options)
      ? options.filter(
          (option) =>
            option !== null &&
            option !== undefined
        )
      : [];
  }, [options]);

  const normalizedValue =
    value === null || value === undefined
      ? ""
      : String(value);

  const handleChange = (event) => {
    onChange?.(event.target.value);
  };

  return (
    <div className="min-w-0">
      <label
        htmlFor={selectId}
        className="sr-only"
      >
        {label}
      </label>

      <select
        id={selectId}
        value={normalizedValue}
        onChange={handleChange}
        disabled={disabled}
        aria-label={label}
        className={`w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm outline-none transition hover:border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-slate-600 ${className}`}
      >
        {safeOptions.map((option) => {
          const optionValue = String(option);

          return (
            <option
              key={optionValue}
              value={optionValue}
            >
              {labels?.[optionValue] ||
                optionValue}
            </option>
          );
        })}
      </select>
    </div>
  );
}