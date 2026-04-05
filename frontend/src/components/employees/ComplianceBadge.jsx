export default function ComplianceBadge({ status }) {

  const styles = {
    Valid: "text-green-600 dark:text-green-400",
    "Expiring Soon": "text-amber-500 dark:text-amber-400",
    Expired: "text-red-600 dark:text-red-400",
    "No Data": "text-gray-500 dark:text-gray-400",
  };

  return (
    <span className={`text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );

}