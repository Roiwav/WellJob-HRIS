const NUMBER_FORMATTER = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
});

function hasDisplayValue(value) {
  return !(
    value === null ||
    value === undefined ||
    value === ""
  );
}

function formatTooltipValue(value) {
  if (!hasDisplayValue(value)) {
    return "-";
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? NUMBER_FORMATTER.format(value)
      : "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map(formatTooltipValue).join(", ")
      : "-";
  }

  if (typeof value === "object") {
    return "-";
  }

  return String(value);
}

function getEntryLabel(entry) {
  return (
    entry?.name ||
    entry?.dataKey ||
    "Value"
  );
}

function getEntryColor(entry) {
  return (
    entry?.color ||
    entry?.fill ||
    entry?.stroke ||
    "#64748b"
  );
}

export default function SharedTooltip({
  active,
  payload,
  label,
}) {
  const safePayload = Array.isArray(payload)
    ? payload.filter(
        (entry) =>
          entry &&
          hasDisplayValue(entry.value)
      )
    : [];

  if (!active || safePayload.length === 0) {
    return null;
  }

  const hasLabel =
    hasDisplayValue(label);

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800"
    >
      {hasLabel && (
        <p className="mb-1.5 text-sm font-semibold text-slate-900 dark:text-white">
          {formatTooltipValue(label)}
        </p>
      )}

      <div className="space-y-1">
        {safePayload.map(
          (entry, index) => {
            const entryLabel =
              getEntryLabel(entry);

            const entryValue =
              formatTooltipValue(
                entry.value
              );

            const entryKey = [
              entry?.dataKey,
              entry?.name,
              index,
            ]
              .filter(
                (value) =>
                  value !== null &&
                  value !== undefined
              )
              .join("-");

            return (
              <div
                key={entryKey}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        getEntryColor(
                          entry
                        ),
                    }}
                  />

                  <span className="truncate">
                    {entryLabel}
                  </span>
                </span>

                <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
                  {entryValue}
                </span>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}