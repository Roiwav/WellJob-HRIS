import { forwardRef, useId } from "react";
import { FiAlertTriangle } from "react-icons/fi";

const FormField = forwardRef(function FormField(
  {
    label,
    name,
    htmlFor,
    description = "",
    error = "",
    required = false,
    children,
    className = "",
    labelClassName = "",
    contentClassName = "",
    descriptionClassName = "",
    errorClassName = "",
  },
  ref
) {
  const generatedId = useId();
  const fieldId = htmlFor || name || generatedId;

  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div
      ref={ref}
      className={["space-y-1.5", className].filter(Boolean).join(" ")}
    >
      {label && (
        <label
          htmlFor={fieldId}
          className={[
            "block text-sm font-semibold text-gray-700 dark:text-gray-200",
            labelClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {label}

          {required && (
            <span
              aria-hidden="true"
              className="ml-1 text-red-500 dark:text-red-400"
            >
              *
            </span>
          )}
        </label>
      )}

      <div
        className={["min-w-0", contentClassName].filter(Boolean).join(" ")}
      >
        {typeof children === "function"
          ? children({
              id: fieldId,
              name,
              required,
              hasError: Boolean(error),
              "aria-invalid": Boolean(error),
              "aria-describedby":
                [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
            })
          : children}
      </div>

      {description && !error && (
        <p
          id={descriptionId}
          className={[
            "text-xs leading-5 text-gray-500 dark:text-gray-400",
            descriptionClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {description}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className={[
            "flex items-start gap-1.5 text-xs font-medium leading-5 text-red-600 dark:text-red-400",
            errorClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <FiAlertTriangle
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

export default FormField;