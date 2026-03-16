export default function ComplianceBadge({ status }) {

  const styles = {
    Valid: "text-green-600",
    "Expiring Soon": "text-amber-500",
    Expired: "text-red-600",
    "No Data": "text-gray-500",
  };

  return (
    <span className={`text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );

}