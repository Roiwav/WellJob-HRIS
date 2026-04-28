export default function FilterSelect({ value, onChange, options, labels = {} }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels[option] || option}
        </option>
      ))}
    </select>
  );
}