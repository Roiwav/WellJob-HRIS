export default function StatusBadge({ status }) {

  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 dark:bg-gray-700">
      {status}
    </span>
  );

}