import { FiAlertTriangle, FiClock, FiCheckCircle } from "react-icons/fi";

export default function NotificationCard({ type, message, date }) {

  const styles = {
    High: "border-red-500 text-red-500",
    Medium: "border-amber-500 text-amber-500",
    Low: "border-green-500 text-green-500"
  };

  const icons = {
    High: <FiAlertTriangle />,
    Medium: <FiClock />,
    Low: <FiCheckCircle />
  };

  return (
    <div className={`p-4 border-l-4 rounded-lg bg-white dark:bg-slate-900 shadow-sm flex justify-between items-center ${styles[type]}`}>

      <div className="flex items-center gap-3">
        <span className="text-xl">{icons[type]}</span>

        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{message}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{date}</p>
        </div>
      </div>

      <span className="text-xs font-semibold">
        {type}
      </span>

    </div>
  );
}