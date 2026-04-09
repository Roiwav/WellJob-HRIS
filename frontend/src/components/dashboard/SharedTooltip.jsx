export default function SharedTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
        {label}
      </p>

      {payload.map((entry, index) => (
        <p key={index} className="text-sm text-slate-600 dark:text-slate-300">
          {`${entry.name || entry.dataKey}: ${entry.value}`}
        </p>
      ))}
    </div>
  );
}